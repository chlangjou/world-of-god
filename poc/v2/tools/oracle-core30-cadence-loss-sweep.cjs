'use strict';
// Controlled 30 original Devotion-60 citizens (15 vs 15), two actual fixed
// Oracle policies, a 100-day finite replay from one identical Day-10 fork.
// This tests counter-evidence timing/amount, not natural game balance.
const W=require('../src/sim.js');
const Previous=require('./oracle-30-core-ratio-sweep.cjs');
const T=require('../config/oracle-core30-cadence-loss-sweep-v0.1.json');
const fs=require('node:fs');

const CASES=Object.freeze([
  {name:'legacy-8pt-10d',lossPoints:8,repeatDays:10,followupRepeat:false},
  ...T.lossPoints.flatMap(lossPoints=>T.repeatDays.map(repeatDays=>({
    name:lossPoints+'pt-'+repeatDays+'d',lossPoints,repeatDays,
    followupRepeat:T.tieFollowupToRepeatDays===true
  })))
]);
const CHECKPOINTS=T.checkpoints;
const stamp=Previous.hash;
function prepare(){
  const s=Previous.fixture();
  const stats=W.stats(s);
  if(stats.people!==30||stats.followers!==15||stats.opponentFollowers!==15||
    s.people.some(p=>!p.alive||p.devotion!==60)||
    !s.religion.saints.length||!s.opponentReligion.saints.length||
    s.opponent.startDay<360||!W.validate(s).ok)
      throw Error('controlled Day-10 baseline does not have 15:15 core 60');
  return s;
}
function setup(s,caseInfo){
  const r=s.oracleStrategy;
  r.faithDefenseEnabled=true;
  r.faithDefenseModel=T.defenseModel;
  r.faithDefenseMatrix['family.nurture']['food.produce']=T.fixedRatio.nurtureDefense;
  r.faithDefenseMatrix['food.produce']['family.nurture']=T.fixedRatio.foodDefense;
  r.counterRepeatDays=caseInfo.repeatDays;
  r.counterDoubtStep=caseInfo.lossPoints;
  r.counterDiagnosticsEnabled=true;
  if(caseInfo.followupRepeat)r.counterRepeatIncludesFollowup=true;
  else delete r.counterRepeatIncludesFollowup;
}
function initialTrack(s){
  return new Map(s.people.map(p=>[p.id,{
    id:p.id,startingFaith:p.religionId,initialDevotion:p.devotion,
    minDevotion:p.devotion,firstBelow40:null,firstBelow20:null,
    firstConverted:null,dead:false
  }]));
}
function scan(s,track,day){
  for(const [id,t] of track){
    const p=s.people.find(v=>v.id===id);
    if(!p?.alive){t.dead=true;continue;}
    t.minDevotion=Math.min(t.minDevotion,p.devotion);
    if(t.firstBelow40===null&&p.devotion<40)t.firstBelow40=day;
    if(t.firstBelow20===null&&p.devotion<20)t.firstBelow20=day;
    if(t.firstConverted===null&&p.religionId!==t.startingFaith)t.firstConverted=day;
  }
}
function checkpoint(s,track,day){
  const st=W.stats(s),all=[...track.values()],
    ai=all.filter(t=>t.startingFaith==='r2'),
    player=all.filter(t=>t.startingFaith==='r1'),
    current=id=>s.people.find(p=>p.id===id),
    count=(arr,predicate)=>arr.filter(predicate).length;
  return {elapsedDays:day,simulationDay:W.days(s),
    core40:{player:st.followers,AI:st.opponentFollowers},
    originalAI:{
      everBelow40:count(ai,t=>t.firstBelow40!==null),
      below40Now:count(ai,t=>current(t.id)?.alive&&current(t.id).devotion<40),
      everBelow20:count(ai,t=>t.firstBelow20!==null),
      converted:count(ai,t=>t.firstConverted!==null),
      alive:count(ai,t=>!t.dead),
      meanDevotion:Math.round(ai.reduce((n,t)=>n+(current(t.id)?.devotion||0),0)/ai.length*100)/100
    },
    originalPlayer:{
      everBelow40:count(player,t=>t.firstBelow40!==null),
      converted:count(player,t=>t.firstConverted!==null),
      alive:count(player,t=>!t.dead)
    },
    evidence:{
      eligiblePlayer:s.counts.playerEligibleChecks||0,
      eligibleAI:s.counts.aiEligibleChecks||0,
      coreDoubtsPlayer:s.counts.playerStrategyCoreDoubts||0,
      coreDoubtsAI:s.counts.aiStrategyCoreDoubts||0,
      followupDoubts:s.counts.strategyFollowupDoubts||0,
      creditedCoreContacts:s.counts.strategyContacts||0,
      strategyConversions:s.counts.strategyConversions||0
    },
    people:st.people,food:Math.round(st.food),valid:W.validate(s).ok};
}
function runArm(snapshot,arm,budgetMs){
  const started=Date.now(),s=W.restore(snapshot);
  if(JSON.stringify(s)!==snapshot)throw Error('snapshot differs after restore');
  setup(s,arm);
  const issuePlayer=W.issueOracle(s,{saintId:s.religion.saints[0],
    intentType:'family.nurture'});
  const issueAI=W.issueOracle(s,{godId:s.opponentGod.id,
    saintId:s.opponentReligion.saints[0],intentType:'food.produce'});
  if(!issuePlayer.ok||!issueAI.ok)throw Error('failed legitimate fixed Oracle issue');
  const track=initialTrack(s),checkpoints=[checkpoint(s,track,0)];
  const stopped={player:null,AI:null};
  for(let day=1;day<=T.runDays;day++){
    W.advanceTicks(s,3);
    scan(s,track,day);
    for(const [key,faith,oracleId] of [
      ['player',s.religion,issuePlayer.oracleId],
      ['AI',s.opponentReligion,issueAI.oracleId]]){
      const item=faith.oracles.find(o=>o.id===oracleId);
      if(stopped[key]===null&&item?.status!=='active')
        stopped[key]={day,reason:item?.status||'missing'};
    }
    if(CHECKPOINTS.includes(day))checkpoints.push(checkpoint(s,track,day));
    if(day%20===0&&Date.now()-started>budgetMs)
      throw Error(arm.name+' over budget at day '+day);
  }
  if(!W.validate(s).ok)throw Error('invalid final world '+arm.name);
  const records=[...track.values()].map(t=>({
    ...t,finalDevotion:s.people.find(p=>p.id===t.id)?.devotion??null,
    finalReligion:s.people.find(p=>p.id===t.id)?.religionId??null
  }));
  const eventTraces=s.people.filter(p=>p.strategyCounterHistory?.length).map(p=>({
    personId:p.id,startingFaith:track.get(p.id)?.startingFaith,
    // Diagnostic traces are only on the opt-in all-phase repeat-window arms.
    events:p.strategyCounterHistory.map(e=>({...e,
      elapsedDay:Math.floor(e.hour/24)-T.forkDay}))
  }));
  let minObservedRepeatGap=null,invalidGaps=0;
  for(const person of eventTraces){
    const arr=person.events;
    for(let i=1;i<arr.length;i++){
      const gap=(arr[i].hour-arr[i-1].hour)/24;
      minObservedRepeatGap=minObservedRepeatGap===null?gap:Math.min(minObservedRepeatGap,gap);
      if(gap+1e-9<arm.repeatDays)invalidGaps++;
    }
  }
  if(arm.followupRepeat&&invalidGaps>0)
    throw Error('credit events occurred earlier than interval: '+arm.name);
  const last=checkpoints.at(-1),coreAI=records.filter(r=>r.startingFaith==='r2');
  const first=(key)=>Math.min(...coreAI.map(r=>r[key]).filter(v=>v!==null));
  const firstSafe=(key)=>Number.isFinite(first(key))?first(key):null;
  return {
    name:arm.name,lossPoints:arm.lossPoints,repeatDays:arm.repeatDays,
    followupUsesSameInterval:arm.followupRepeat,
    original30PreservedAtFork:true,
    issued:{player:issuePlayer.ok,AI:issueAI.ok},
    oracleStopped:stopped,checkpoints,
    summary:{AIeverBelow40:last.originalAI.everBelow40,
      AIbelow40At100:last.originalAI.below40Now,
      AIeverBelow20:last.originalAI.everBelow20,
      AIconverted:last.originalAI.converted,
      playerEverBelow40:last.originalPlayer.everBelow40,
      firstAIBelow40:firstSafe('firstBelow40'),
      firstAIBelow20:firstSafe('firstBelow20'),
      firstAIConversion:firstSafe('firstConverted'),
      finalCore40:last.core40,eligiblePlayer:last.evidence.eligiblePlayer,
      coreDoubtsPlayer:last.evidence.coreDoubtsPlayer,
      followupDoubts:last.evidence.followupDoubts,
      minObservedRepeatGap,invalidGaps},
    originalCohort:records,eventTraces,elapsedMs:Date.now()-started
  };
}
function run({only=null,budgetMs=12000}={}){
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)
    throw RangeError('budget-ms must be 1000..30000');
  if(only!==null&&(!Array.isArray(only)||!only.length||
      only.some(id=>!CASES.some(c=>c.name===id))))
    throw RangeError('unknown sweep case');
  if(T.profileId!=='oracle-core30-cadence-loss-sweep-v0.1'||
    T.runDays!==100||T.initialCorePerSide!==15||
    T.initialDevotion!==60||T.seed!==Previous.SEED)
    throw Error('unsupported diagnostic fixture');
  const started=Date.now(),world=prepare(),snapshot=JSON.stringify(world);
  const fingerprint=stamp(snapshot),cohort=world.people.map(p=>[p.id,p.religionId,p.devotion]);
  const cases=(only?CASES.filter(c=>only.includes(c.name)):CASES).map(c=>
    runArm(snapshot,c,budgetMs));
  return {schema:'world-of-god/oracle-core30-cadence-loss-sweep/v0.1',
    origin:'fixed 30-person Day-10 diagnostic; 15 Nurture vs 15 Food at devotion 60',
    seed:T.seed,forkDay:T.forkDay,days:T.runDays,ratio:T.fixedRatio,
    model:T.defenseModel,
    rules:'No direct 40+ ordinary preaching; requires actual Oracle benefit, unmet need, live sermon encounter. Additional spacing flag experimental only.',
    startCohort:cohort,originalCore:{player:15,AI:15},
    fingerprint,cases,totalElapsedMs:Date.now()-started};
}
if(require.main===module){
  const args=process.argv.slice(2);
  const get=key=>{const at=args.indexOf(key);return at<0?null:args[at+1];};
  const report=run({budgetMs:get('--budget-ms')===null?12000:Number(get('--budget-ms')),
    only:get('--only')?get('--only').split(','):null});
  const txt=JSON.stringify(report,null,2)+'\n';
  if(get('--out'))fs.writeFileSync(get('--out'),txt);
  process.stdout.write(txt);
}
module.exports={CASES,CHECKPOINTS,prepare,run,runArm,stamp};
