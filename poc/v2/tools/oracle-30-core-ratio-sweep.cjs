'use strict';
// Controlled *diagnostic fixture*, not evidence that an ordinary natural
// Genesis campaign will create these starting conditions on its own.
// 30 original residents, 15 per God, all initial Devotion 60,
// 5 already-established real households per side and symmetric food stock.
// Two legal fixed Saint Oracles; no AI Miracle/Oracle re-planner.
// Every arm forks the same exact Day-10 snapshot, runs only 100 game days.
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const S=require('../config/oracle-specialization-v0.1.json');
const fs=require('node:fs');
const T=require('../config/oracle-30-core-ratio-sweep-v0.1.json');

const SEED=T.seed,FORK_DAY=T.forkDay,MAX_DAYS=T.runDays;
const CHECKPOINTS=[0,10,20,30,40,50,75,100];
if(T.profileId!=='oracle-30-core-ratio-sweep-v0.1'||
  T.initialPeople!==30||T.perFaith!==15||T.initialDevotion!==60||
  T.runDays!==100||T.forkDay!==10)throw Error('invalid fixed-cohort sweep config');
const PLAYER_HOMES=['h1','h2','h3','h4','h9'];
const AI_HOMES=['h5','h6','h7','h8','h12'];
const OFFSETS=[[3,0],[-3,0],[0,3],[0,-3],[4,3]];
const RATIOS=Object.freeze(T.ratios.map(x=>({...x})));
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return ('00000000'+(h>>>0).toString(16)).slice(-8);};

function fixture(){
  const special={...S,
    counterContactChance:T.fixedContactBase,
    counterDoubtStep:T.fixedDoubtStep,counterRepeatDays:T.fixedRepeatDays,
    counterBridgeDoubtChance:T.fixedBridgeDoubtChance,
    counterBridgeConversionChance:T.fixedBridgeConversionChance,
    faithDefenseChanceCeiling:T.faithContactCap,
    faithDefenseModel:T.model,counterDiagnosticsEnabled:true};
  const s=W.create({seed:SEED,balanceProfile:A,religionProfile:R,
    divineProfile:D,oracleStrategyProfile:special,
    opponentProfile:{...O,difficulty:'standard',startDay:360}});
  const keep=new Set([...PLAYER_HOMES,...AI_HOMES]);
  s.households=s.households.filter(h=>keep.has(h.id));
  s.people=s.people.filter(p=>keep.has(p.householdId));
  const sample=s.settlements[0];
  const town=(id,center,hids)=>({...JSON.parse(JSON.stringify(sample)),
    id,name:id==='s1'?'育兒聚落':'存糧聚落',
    native:false,x:center.x,y:center.y,foundedAtHour:0,
    householdIds:hids.slice(),storage:{food:45,wood:0,stone:0,fiber:0},
    granary:null,workDemand:{foodPressure:0,housingPressure:0},
    foodShortageDays:0,famineDays:0,famineReliefDays:0,
    famineActive:false,lastDailyUnmetFood:0});
  s.settlements=[
    town('s1',s.camp,PLAYER_HOMES),
    town('s2',s.opponentCamp,AI_HOMES)
  ];
  for(const [faith,homeIds,center,townId] of [
    ['r1',PLAYER_HOMES,s.camp,'s1'],
    ['r2',AI_HOMES,s.opponentCamp,'s2']]){
    for(const [i,hid] of homeIds.entries()){
      const h=s.households.find(v=>v.id===hid);
      h.x=center.x+OFFSETS[i][0];h.y=center.y+OFFSETS[i][1];
      h.home=true;h.buildProgress=s.rules.hutWork;h.buildMaterialsPaid=true;
      h.inventory={food:12,wood:0,stone:0,fiber:0};
      for(const p of s.people.filter(p=>p.householdId===hid)){
        p.x=h.x;p.y=h.y;p.settlementId=townId;p.religionId=faith;p.devotion=60;
      }
    }
  }
  if(!W.validate(s).ok)throw Error('invalid controlled initial world');
  if(s.people.length!==T.initialPeople||s.households.length!==10||
     W.stats(s).followers!==T.perFaith||W.stats(s).opponentFollowers!==T.perFaith)
    throw Error('initial cohort must be 15+15, all >=40');
  // Only allow normal simulation to generate Saint and Priest:
  // no manual believer creation or artificially appointed clergy.
  for(let day=1;day<=FORK_DAY;day++)W.advanceTicks(s,3);
  if(s.people.length!==T.initialPeople||s.people.some(p=>!p.alive||p.devotion!==T.initialDevotion))
    throw Error('not all 30 residents remain at exactly 60 before first Oracle');
  if(s.religion.saints.length<1||s.opponentReligion.saints.length<1||
    s.religion.priests.length<1||s.opponentReligion.priests.length<1)
    throw Error('real Saint/Priest roles did not emerge before fork');
  if(!W.validate(s).ok)throw Error('invalid Day-10 fixture');
  return s;
}
function limit(x){if(!Number.isFinite(x)||x<1000||x>30000)
  throw RangeError('budget-ms must be 1000..30000');}
function profileFor(s,pair){
  // All rows other than this matchup remain at the shipped profile values.
  s.oracleStrategy.faithDefenseMatrix['family.nurture']['food.produce']=pair.nurture;
  s.oracleStrategy.faithDefenseMatrix['food.produce']['family.nurture']=pair.food;
}
function peopleTrack(s){
  return new Map(s.people.map(p=>[p.id,{
    id:p.id,team:p.religionId,initial:60,min:60,
    firstBelow40:null,firstBelow20:null,firstConverted:null
  }]));
}
function record(s,track,elapsed){
  for(const [id,t] of track){
    const p=s.people.find(q=>q.id===id);if(!p||!p.alive)continue;
    t.min=Math.min(t.min,p.devotion);
    if(t.firstBelow40===null&&p.devotion<40)t.firstBelow40=elapsed;
    if(t.firstBelow20===null&&p.devotion<20)t.firstBelow20=elapsed;
    if(t.firstConverted===null&&p.religionId!==t.team)t.firstConverted=elapsed;
  }
}
function metrics(s,track,elapsed){
  const st=W.stats(s),records=[...track.values()],
    originalAI=records.filter(p=>p.team==='r2'),
    originalPlayer=records.filter(p=>p.team==='r1');
  const counters=s.counts;
  return {
    elapsed,realDay:W.days(s),
    population:s.people.filter(p=>p.alive).length,
    core40:{player:st.followers,AI:st.opponentFollowers},
    originalAI:{
      everBelow40:originalAI.filter(p=>p.firstBelow40!==null).length,
      nowBelow40:originalAI.filter(t=>{
        const p=s.people.find(p=>p.id===t.id);
        return p?.alive&&p.devotion<40;
      }).length,
      everBelow20:originalAI.filter(p=>p.firstBelow20!==null).length,
      converted:originalAI.filter(p=>p.firstConverted!==null).length,
      meanDevotion:Math.round(originalAI.reduce((n,t)=>{
        const p=s.people.find(p=>p.id===t.id);return n+(p?.devotion||0);
      },0)/originalAI.length*100)/100
    },
    originalPlayer:{
      everBelow40:originalPlayer.filter(p=>p.firstBelow40!==null).length,
      converted:originalPlayer.filter(p=>p.firstConverted!==null).length
    },
    contact:{eligible:counters.strategyEligibleChecks||0,
      forPlayer:counters.playerEligibleChecks||0,
      forAI:counters.aiEligibleChecks||0,
      actual:counters.strategyContacts||0,
      playerDoubts:counters.playerStrategyCoreDoubts||0,
      aiDoubts:counters.aiStrategyCoreDoubts||0,
      conversions:counters.strategyConversions||0},
    activeOracles:{
      player:s.religion.oracles.filter(o=>o.status==='active').map(o=>o.intentType),
      AI:s.opponentReligion.oracles.filter(o=>o.status==='active').map(o=>o.intentType)
    },
    food:Math.round(st.food),housed:st.houses,
    valid:W.validate(s).ok
  };
}
function run({only=null,days=MAX_DAYS,budgetMs=15000,mode='odds-scaled'}={}){
  if(!Number.isInteger(days)||days!==MAX_DAYS)
    throw RangeError('exactly 100 simulated days required');
  if(!['odds-scaled','linear-clamped'].includes(mode))
    throw RangeError('unsupported defense interpretation');
  if(only!==null&&(!Array.isArray(only)||!only.length||
    only.some(name=>!RATIOS.some(r=>r.name===name))))throw RangeError('unknown ratio');
  limit(budgetMs);
  const prepared=Date.now(),start=fixture(),snapshot=JSON.stringify(start),
    fingerprint=hash(snapshot),prepareMs=Date.now()-prepared;
  const selected=only?RATIOS.filter(r=>only.includes(r.name)):RATIOS;
  if(selected.some(r=>!Number.isFinite(r.nurture)||!Number.isFinite(r.food)||
    r.nurture<.15||r.nurture>6||r.food<.15||r.food>6))
    throw RangeError('ratio outside supported 0.15..6 diagnostic range');
  const cases=[];
  for(const ratio of selected){
    const s=W.restore(snapshot),startTime=Date.now();
    if(hash(JSON.stringify(s))!==fingerprint)throw Error('fork parity failure');
    s.oracleStrategy.faithDefenseModel=mode;
    profileFor(s,ratio);
    if(mode==='linear-clamped'&&(ratio.nurture>2||ratio.food<.25))
      throw Error('linear model cannot represent ratios beyond 2 and .25');
    const issued=[
      W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'family.nurture'}),
      W.issueOracle(s,{godId:s.opponentGod.id,saintId:s.opponentReligion.saints[0],intentType:'food.produce'})
    ];
    if(issued.some(r=>!r.ok))throw Error('could not issue both fixed Oracle policies');
    const initialSaints=[s.religion.saints[0],s.opponentReligion.saints[0]];
    const track=peopleTrack(s),trace=[metrics(s,track,0)],ceased={player:null,AI:null};
    for(let elapsed=1;elapsed<=days;elapsed++){
      W.advanceTicks(s,3);record(s,track,elapsed);
      const lastPlayer=s.religion.oracles.find(o=>o.id===issued[0].oracleId);
      const lastAI=s.opponentReligion.oracles.find(o=>o.id===issued[1].oracleId);
      if(ceased.player===null&&lastPlayer?.status!=='active')
        ceased.player={day:elapsed,reason:lastPlayer?.status||'missing',
          saintDevotion:s.people.find(p=>p.id===initialSaints[0])?.devotion||null};
      if(ceased.AI===null&&lastAI?.status!=='active')
        ceased.AI={day:elapsed,reason:lastAI?.status||'missing',
          saintDevotion:s.people.find(p=>p.id===initialSaints[1])?.devotion||null};
      if(CHECKPOINTS.includes(elapsed))trace.push(metrics(s,track,elapsed));
      if(elapsed%20===0&&Date.now()-startTime>budgetMs)
        throw Error('100-day '+ratio.name+' exceeded '+budgetMs+'ms at day '+elapsed);
    }
    if(!W.validate(s).ok)throw Error('invalid final world: '+ratio.name);
    const end=trace.at(-1);
    const defN=W.oracleFaithDefense(s.oracleStrategy,'family.nurture','food.produce');
    const defF=W.oracleFaithDefense(s.oracleStrategy,'food.produce','family.nurture');
    const chanceN=W.oracleDefenseContactChance(s.oracleStrategy,'family.nurture','food.produce');
    const chanceF=W.oracleDefenseContactChance(s.oracleStrategy,'food.produce','family.nurture');
    cases.push({name:ratio.name,defense:{nurture:defN,food:defF},
      eligibleContactProbability:{nurtureDefender:chanceN,foodDefender:chanceF},
      oracleIssued:issued.map(x=>x.ok),oracleTerminated:ceased,
      checkpoints:trace,
      cohort:[...track.values()].map(t=>{
        const p=s.people.find(p=>p.id===t.id);
        return {...t,finalDevotion:p?.devotion??null,finalFaith:p?.religionId??null};
      }),
      outcome:{
        AIeverBelow40:end.originalAI.everBelow40,
        AIbelow40AtEnd:end.originalAI.nowBelow40,
        AIeverBelow20:end.originalAI.everBelow20,
        AIConverted:end.originalAI.converted,
        playerEverBelow40:end.originalPlayer.everBelow40,
        coreAtEnd:end.core40,
        eligibleForPlayer:end.contact.forPlayer,
        eligibleForAI:end.contact.forAI,
        creditedPlayerDoubts:end.contact.playerDoubts
      },durationMs:Date.now()-startTime});
  }
  return {schema:'world-of-god/oracle-30-core-100-day-ratio-sweep/v0.1',
    sourceBranch:'feature/opponent-difficulty-profiles-v0.3',
    scenario:'diagnostic fixed 30; 15 player Nurture, 15 AI Food, all Devotion 60',
    seed:SEED,dayFork:FORK_DAY,runDays:days,headless:true,
    defenseModel:mode,baselineCounterContactChance:start.oracleStrategy.counterContactChance,
    fixedOracleRule:'Both legally issued immediately after naturally created Saint/Priest; AI starts only after Day360; no dynamic policy switches. Oracle may end if Saint loses eligibility.',
    environment:'real Agriculture / Religion / Divine / Presence world simulation, but equalized prebuilt initial houses, food and settlement membership',
    initialPeople:start.people.length,initialCore40:{player:T.perFaith,AI:T.perFaith},
    fixedBaseline:{contactChance:T.fixedContactBase,doubtStep:T.fixedDoubtStep,repeatDays:T.fixedRepeatDays},
    forkFingerprint:fingerprint,prepareMs,cases,
    warning:'This is a controlled stress test, NOT naturally emerging gameplay evidence. Ordinary preaching still cannot directly challenge >=40.'
  };
}
if(require.main===module){
  const args=process.argv.slice(2);
  const value=name=>{const k=args.indexOf(name);return k<0?null:args[k+1];};
  const report=run({only:value('--only')?value('--only').split(','):null,
    days:value('--days')===null?100:Number(value('--days')),
    budgetMs:value('--budget-ms')===null?15000:Number(value('--budget-ms')),
    mode:value('--model')||'odds-scaled'});
  const json=JSON.stringify(report,null,2)+'\n';
  if(value('--out'))fs.writeFileSync(value('--out'),json);
  process.stdout.write(json);
}
module.exports={SEED,FORK_DAY,MAX_DAYS,CHECKPOINTS,RATIOS,fixture,run,metrics,hash};
