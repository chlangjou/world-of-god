'use strict';
// Diagnostic matrix study: one legitimate Day-45 world, paired Oracle choices
// chosen once at fork, standard AI decisions thereafter. Hard stop at 60 days.
// No forced followers or edited inventories; no invented local need.
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const S=require('../config/oracle-specialization-v0.1.json');
const fs=require('node:fs');
const FORK_DAY=45,MAX_AFTER_DAYS=60,CHECKPOINTS=[45,60,75,90,105];
const CASES=Object.freeze([
  {name:'passive',player:null,ai:'food.produce',matrix:'proposed'},
  {name:'same-food',player:'food.produce',ai:'food.produce',matrix:'proposed'},
  {name:'nurture-v-food:legacy',player:'family.nurture',ai:'food.produce',matrix:'off'},
  {name:'nurture-v-food:neutral',player:'family.nurture',ai:'food.produce',matrix:'uniform'},
  {name:'nurture-v-food:proposed',player:'family.nurture',ai:'food.produce',matrix:'proposed'},
  {name:'nurture-reset-to-food',player:'family.nurture',ai:'food.produce',matrix:'proposed',resetDay:76},
  {name:'food-v-explore',player:'food.produce',ai:'settlement.explore',matrix:'proposed'},
  {name:'explore-v-nurture',player:'settlement.explore',ai:'family.nurture',matrix:'proposed'}
]);
const fingerprint=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return ('00000000'+(h>>>0).toString(16)).slice(-8);};
function matrixMode(s,mode){
  if(mode==='off'){s.oracleStrategy.faithDefenseEnabled=false;return;}
  if(mode==='uniform'){
    const rows=s.oracleStrategy.faithDefenseMatrix;
    for(const [key,row] of Object.entries(rows))
      for(const challenger of Object.keys(row))row[challenger]=1;
  }
}
function challengeCount(s,cohort){
  return cohort.filter(id=>s.people.some(p=>p.id===id&&p.alive&&
    p.religionId===s.opponentReligion.id&&p.devotion<40)).length;
}
function point(s,cohort,seen,day){
  const st=W.stats(s);
  return {day,core40:[st.followers,st.opponentFollowers],
    originalAIcoreStill40:cohort.filter(id=>s.people.some(p=>p.id===id&&p.alive&&
      p.religionId===s.opponentReligion.id&&p.devotion>=40)).length,
    originalAIcoreBelow40:challengeCount(s,cohort),
    originalAIeverBelow40:[...seen].filter(([,v])=>v.below).length,
    originalAIConverted:[...seen].filter(([,v])=>v.converted).length,
    playerEvidenceDoubts:s.counts.playerStrategyCoreDoubts||0,
    aiEvidenceDoubts:s.counts.aiStrategyCoreDoubts||0,
    strategyConversions:s.counts.strategyConversions||0,
    totalFood:Math.round(st.food),housed:st.houses+'/'+st.households,
    valid:W.validate(s).ok};
}
function run({seed='dry-stress',days=MAX_AFTER_DAYS,budgetMs=30000,caseNames=null}={}){
  if(!['dry-stress','opponent-competition-replay','valley-spring-01'].includes(seed))
    throw RangeError('invalid approved seed');
  if(caseNames!==null&&(!Array.isArray(caseNames)||!caseNames.length||
    caseNames.some(name=>!CASES.some(v=>v.name===name))))
    throw RangeError('invalid case selection');
  if(!Number.isInteger(days)||days<15||days>MAX_AFTER_DAYS)throw RangeError('days 15..60');
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)throw RangeError('budget-ms 1000..30000');
  const start=Date.now();
  const born=W.create({seed,balanceProfile:A,religionProfile:R,
    divineProfile:D,oracleStrategyProfile:S,
    opponentProfile:{...O,difficulty:'standard'}});
  for(let d=1;d<=FORK_DAY;d++){
    W.advanceTicks(born,3);
    if(d%15===0&&Date.now()-start>budgetMs)throw Error('fork preparation over budget');
  }
  if(!W.validate(born).ok)throw Error('invalid fork');
  const serial=JSON.stringify(born),fp=fingerprint(serial);
  const ids=born.people.filter(p=>p.alive&&p.religionId===born.opponentReligion.id&&p.devotion>=40).map(p=>p.id);
  const cases=[];
  for(const scenario of (caseNames?CASES.filter(x=>caseNames.includes(x.name)):CASES)){
    const fork=W.restore(serial),before=Date.now();
    if(JSON.stringify(fork)!==serial)throw Error('restore drift');
    const originalFood=Number(W.stats(fork).food.toFixed(5));
    matrixMode(fork,scenario.matrix);
    const aiSaint=fork.opponentReligion.saints[0],playerSaint=fork.religion.saints[0];
    if(!aiSaint||!playerSaint)throw Error('no real Saint at Day-45');
    const actions=[];
    const aiActive=fork.opponentReligion.oracles.find(o=>o.status==='active'&&o.saintId===aiSaint);
    if(scenario.ai!==aiActive?.intentType){
      if(aiActive){
        const z=W.issueOracle(fork,{godId:fork.opponentGod.id,saintId:aiSaint,intentType:'life.balance'});
        actions.push({side:'AI',intent:'life.balance',day:FORK_DAY+1,ok:z.ok});
        if(!z.ok)throw Error('AI reset rejected: '+z.reason);
      }
      if(scenario.ai){
        const z=W.issueOracle(fork,{godId:fork.opponentGod.id,saintId:aiSaint,intentType:scenario.ai});
        actions.push({side:'AI',intent:scenario.ai,day:FORK_DAY+1,ok:z.ok});
        if(!z.ok)throw Error('AI choice rejected: '+z.reason);
      }
    }
    if(scenario.player){
      const z=W.issueOracle(fork,{saintId:playerSaint,intentType:scenario.player});
      actions.push({side:'player',intent:scenario.player,day:FORK_DAY+1,ok:z.ok});
      if(!z.ok)throw Error('player choice rejected: '+z.reason);
    }
    const seen=new Map(ids.map(id=>[id,{below:false,converted:false,
      start:fork.people.find(p=>p.id===id).devotion,min:fork.people.find(p=>p.id===id).devotion}]));
    const inspect=()=>{
      for(const [id,entry] of seen){
        const p=fork.people.find(v=>v.id===id);
        if(!p||!p.alive)continue;
        entry.min=Math.min(entry.min,p.devotion);
        if(p.devotion<40)entry.below=true;
        if(p.religionId!==fork.opponentReligion.id)entry.converted=true;
      }
    };
    const checkpoints=[point(fork,ids,seen,FORK_DAY)];
    for(let day=FORK_DAY+1;day<=FORK_DAY+days;day++){
      if(day===scenario.resetDay){
        const reset=W.issueOracle(fork,{saintId:playerSaint,intentType:'life.balance'});
        const next=W.issueOracle(fork,{saintId:playerSaint,intentType:'food.produce'});
        actions.push({side:'player',intent:'life.balance',day,ok:reset.ok},
          {side:'player',intent:'food.produce',day,ok:next.ok});
        if(!reset.ok||!next.ok)throw Error('reset-to-food failed');
      }
      W.advanceTicks(fork,3);inspect();
      if(CHECKPOINTS.includes(day))checkpoints.push(point(fork,ids,seen,day));
      if(day%15===0&&Date.now()-before>budgetMs)
        throw Error('scenario '+scenario.name+' exceeded budget at day '+day);
    }
    if(!W.validate(fork).ok)throw Error('invalid '+scenario.name);
    cases.push({name:scenario.name,oracleChoices:{player:scenario.player||'default',
      AI:scenario.ai||'default'},defenseMode:scenario.matrix,
      actions,checkpointResults:checkpoints,
      originalAIcoreTrace:[...seen].filter(([,v])=>v.below||v.converted)
        .map(([id,v])=>({id,...v,final:fork.people.find(p=>p.id===id)?.devotion??null})),
      finalFood:Math.round(W.stats(fork).food),
      forkFood:originalFood,elapsedMs:Date.now()-before});
  }
  return {schema:'world-of-god/oracle-faith-defense-matrix-v0.1',
    sourceBranch:'feature/opponent-difficulty-profiles-v0.3',
    seed,forkDay:FORK_DAY,days,originalAIcoreCount:ids.length,
    forkFingerprint:fp,AI:'standard autonomous after fixed fork-time doctrine',
    evidence:'True world events only; counterfactual Oracle choices are fixed at fork. 40+ core individually tracked.',
    caveats:['No forced followers, resources or manual core Devotion edits.',
      'The existing abundance of food/housing can leave exploration matchups untested in this particular world.',
      'The original 40 threshold and offensive Presence limits still apply.',
      'A default religion cannot attribute a strategy-specific result to a nonexistent Oracle.'],
    cases,totalMs:Date.now()-start};
}
if(require.main===module){
  const argv=process.argv.slice(2);
  const arg=k=>{const i=argv.indexOf(k);return i<0?undefined:argv[i+1];};
  const result=run({seed:arg('--seed')||'dry-stress',
    days:arg('--days')===undefined?MAX_AFTER_DAYS:Number(arg('--days')),
    budgetMs:arg('--budget-ms')===undefined?30000:Number(arg('--budget-ms')),
    caseNames:arg('--only')?arg('--only').split(','):null});
  const json=JSON.stringify(result,null,2)+'\n';
  if(arg('--out'))fs.writeFileSync(arg('--out'),json);
  process.stdout.write(json);
}
module.exports={FORK_DAY,MAX_AFTER_DAYS,CASES,run,fingerprint};
