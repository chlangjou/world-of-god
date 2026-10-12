'use strict';
// Standalone Node.js strategy experiment. Run ONE independent scenario per
// process; no per-tick LLM decisions, no event stream, no full-world output.
// Example: node --max-old-space-size=512 tools/strategy-reversal-evaluation.cjs
//   --seed dry-stress --strategy missionary --days 180 --budget-ms 12000
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');

const STRATEGIES=Object.freeze(['passive','missionary','development','intervention']);
const STUDY_SEEDS=Object.freeze(['dry-stress','opponent-competition-replay']);
const CHANNELS=Object.freeze(['both','miracle-only','oracle-only','none']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const round=(v,n=2)=>Number(Number(v||0).toFixed(n));

// Locations are chosen ONCE at Genesis, not recomputed as an optimal map search
// every tick. The visible map permits recognising nearby and contested villages.
function initialPlan(s){
  const villages=s.settlements.filter(t=>t.native);
  const stable=(a,b)=>a.id.localeCompare(b.id);
  const signed=v=>distance(v,s.camp)-distance(v,s.opponentCamp);
  // Map has three native villages: own-side, center and rival-side. The
  // geographically nearest village to either God could be the SAME frontier
  // village, so pick by relative geographical advantage, not raw proximity.
  return {
    own:villages.slice().sort((a,b)=>signed(a)-signed(b)||stable(a,b))[0]||s.camp,
    frontier:villages.slice().sort((a,b)=>
      Math.abs(signed(a))-Math.abs(signed(b))||stable(a,b))[0]||s.camp,
    rival:villages.slice().sort((a,b)=>signed(b)-signed(a)||stable(a,b))[0]||s.camp
  };
}
function miracleCommand(s,strategy,index,plan){
  if(strategy==='missionary'){
    const at=index%2===0?plan.own:plan.frontier;
    const type=index%3===0?'ripening':'rain';
    return {type,args:{x:at.x,y:at.y,radius:7,intensity:type==='rain'?.85:1,
      durationDays:type==='rain'?7:10}};
  }
  if(strategy==='development'){
    const type=['ripening','efficiency','rain'][index%3];
    return {type,args:{x:s.camp.x,y:s.camp.y,radius:7,
      intensity:type==='rain'?.85:1,durationDays:type==='rain'?7:10}};
  }
  // Breakthrough attempt is deliberately not a perfect targeting bot.
  // The same two contested coordinates and skill cycle are known at Genesis;
  // one intuitive cast is attempted even if the target has become ineligible.
  if(strategy==='intervention'){
    const at=index%2===0?plan.frontier:plan.rival;
    const type=['heal','rain','confusion','ripening','harvest'][index%5];
    return {type,args:{x:at.x,y:at.y,radius:type==='heal'?5:7,
      intensity:type==='rain'?.85:type==='confusion'?.7:1,
      durationDays:type==='rain'?7:10}};
  }
  return null;
}
function oracleIntent(strategy){
  return strategy==='development'?'food.produce':'religion.spread';
}
function checkpoint(s,day){
  const st=W.stats(s);
  const natives=s.settlements.filter(t=>t.native).map(t=>{
    const f=W.settlementReligionStats(s,t.id)||{};
    return {id:t.id,player:f.believers||0,ai:f.opponentBelievers||0,
      neutral:f.unaffiliated||0};
  });
  const counts=s.counts||{};
  return {day,people:st.people,player:st.believers,ai:st.opponentBelievers,
    playerCore:st.followers,aiCore:st.opponentFollowers,
    lead:st.believers-st.opponentBelievers,
    playerDp:round(s.god.dp),aiDp:round(s.opponentGod.dp),
    playerConversions:counts.rivalConversions||0,
    aiConversions:counts.opponentConversions||0,
    playerFaithFromMiracles:counts.miracleAdoptions||0,
    aiFaithFromMiracles:counts.opponentMiracleAdoptions||0,
    natives};
}
function runScenario({seed='dry-stress',strategy='passive',days=180,
  budgetMs=12000,checkpointDays=[0,30,90,180],channels='both'}={}){
  if(!STUDY_SEEDS.includes(seed))throw new Error('Unapproved seed: '+seed);
  if(!STRATEGIES.includes(strategy))throw new Error('Invalid strategy: '+strategy);
  if(!CHANNELS.includes(channels))throw new Error('Invalid channels: '+channels);
  const allowMiracle=channels==='both'||channels==='miracle-only';
  const allowOracle=channels==='both'||channels==='oracle-only';
  if(!Number.isSafeInteger(days)||days<1||days>180)
    throw new RangeError('P0/P1 only: days must be 1..180');
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)
    throw new RangeError('budgetMs must be 1000..30000');
  const s=W.create({seed,balanceProfile:agriculture,religionProfile:religion,
    divineProfile:divine,opponentProfile:{...opponent,difficulty:'standard'}});
  const plan=initialPlan(s),start=Date.now(),marks=[checkpoint(s,0)];
  const operations={miracleAttempts:0,miracleSuccess:0,oracleAttempts:0,oracleSuccess:0,
    successByType:{},failureReasons:{},samples:[]};
  let stopped=false,completed=0,peakRssBytes=0;
  const rss=()=>{
    if(typeof process!=='undefined'&&typeof process.memoryUsage==='function')
      peakRssBytes=Math.max(peakRssBytes,process.memoryUsage().rss);
  };
  rss();
  for(let day=1;day<=days;day++){
    W.advanceTicks(s,3);
    completed=day;
    if(strategy!=='passive'){
      // Equal budgets: 8 Miracle slots and two Oracle slots in 180 days.
      // No cooldown scan, free reroll, second choice, or per-tick agent planner.
      if(allowMiracle&&day%21===0){
        const index=day/21-1,command=miracleCommand(s,strategy,index,plan);
        if(command){
          operations.miracleAttempts++;
          const result=W.castMiracle(s,command.type,command.args);
          if(result.ok){
            operations.miracleSuccess++;
            operations.successByType[command.type]=(operations.successByType[command.type]||0)+1;
          }else{
            const cause=result.reason||'rejected';
            operations.failureReasons[cause]=(operations.failureReasons[cause]||0)+1;
          }
          if(operations.samples.length<10)operations.samples.push(
            {day,kind:'miracle',type:command.type,ok:result.ok,
              reason:result.ok?null:result.reason||null});
        }
      }
      if(allowOracle&&(day===15||day===105)){
        operations.oracleAttempts++;
        const result=W.issueOracle(s,{saintId:s.religion.saints[0],
          intentType:oracleIntent(strategy),durationDays:80});
        if(result.ok)operations.oracleSuccess++;
        else{
          const cause=result.reason||'rejected';
          operations.failureReasons[cause]=(operations.failureReasons[cause]||0)+1;
        }
        if(operations.samples.length<10)operations.samples.push(
          {day,kind:'oracle',type:oracleIntent(strategy),ok:result.ok,
            reason:result.ok?null:result.reason||null});
      }
    }
    if(checkpointDays.includes(day)||day===days)marks.push(checkpoint(s,day));
    // Inspect the budget after each 30-day chunk. A child process started via
    // the suite runner can also be hard-killed at its 12-second wall deadline.
    if(day%30===0){
      rss();
      if(Date.now()-start>budgetMs){stopped=true;break;}
    }
  }
  rss();
  const verdict=W.validate(s);
  const final=checkpoint(s,completed);
  const playerOracles=s.religion.oracles||[];
  const oracleEffects={
    issued:playerOracles.length,
    byType:Object.fromEntries(['religion.spread','food.produce'].map(type=>
      [type,playerOracles.filter(o=>o.intentType===type).length])),
    influencedSermons:playerOracles.reduce((v,o)=>v+(o.influenceSermonCount||0),0),
    influencedWorkChoices:playerOracles.reduce((v,o)=>v+(o.influenceWorkCount||0),0),
    heard:playerOracles.reduce((v,o)=>v+(o.heardCount||0),0),
    creditedFulfillments:playerOracles.filter(o=>o.fulfillmentCredited).length
  };
  const propagation={
    newBelievers:s.counts.newBelievers||0,
    household:s.counts.householdAdoptions||0,
    social:s.counts.socialAdoptions||0,
    exchange:s.counts.interSettlementAdoptions||0,
    priest:s.counts.priestAdoptions||0,
    rival:s.counts.rivalConversions||0,
    directMiracle:s.counts.miracleAdoptions||0,
    opponentNewBelievers:s.counts.opponentNewBelievers||0,
    opponentConversions:s.counts.opponentConversions||0
  };
  return {version:'strategic-reversal-p1',seed,strategy,channels,
    requestedDays:days,completedDays:completed,ticks:completed*3,
    elapsedMs:Date.now()-start,aborted:stopped,
    peakRssMb:peakRssBytes?round(peakRssBytes/1048576,1):null,
    worldJsonBytes:JSON.stringify(s).length,
    valid:verdict.ok,validationErrors:verdict.errors.slice(0,3),
    initialTargets:{own:plan.own.id||'camp',frontier:plan.frontier.id||'camp',
      rival:plan.rival.id||'camp'},
    checks:marks,operations,oracleEffects,propagation,final};
}
if(require.main===module){
  const args={};
  for(let i=2;i<process.argv.length;i+=2){
    const key=process.argv[i],value=process.argv[i+1];
    if(!key.startsWith('--')||value===undefined)throw Error('Arguments are --key value pairs');
    args[key.slice(2)]=value;
  }
  const result=runScenario({seed:args.seed||'dry-stress',
    strategy:args.strategy||'passive',days:Number(args.days||180),
    budgetMs:Number(args['budget-ms']||12000),
    channels:args.channels||'both'});
  // One short line, intended for automation and end-of-run analysis only.
  console.log(JSON.stringify(result));
  if(result.aborted||!result.valid||result.completedDays!==result.requestedDays)
    process.exitCode=2;
}
module.exports={STRATEGIES,STUDY_SEEDS,CHANNELS,initialPlan,miracleCommand,
  checkpoint,runScenario};
