'use strict';
// Evidence-attraction mechanism study. Reuses a 30-person controlled world,
// actual Oracle work + comparative unmet needs + live cross-town preachers.
// Equal reductions 5 points /14d -> 2.5 points/7d preserve nominal drift,
// not time-to-conversion. 100d primary endpoint, 30d passive retention check.
const W=require('../src/sim.js');
const Prior=require('./oracle-30-core-ratio-sweep.cjs');
const T=require('../config/oracle-attraction-evidence-study-v0.1.json');
const fs=require('node:fs');
const CHECKPOINTS=[0,30,50,60,75,90,100,130];

function validateParameters(){
  if(T.profileId!=='oracle-attraction-evidence-study-v0.1'||
    T.startingDevotion!==60||T.initialPerFaith!==15||
    T.initialTotal!==30||T.forkDay!==10||T.studyDays!==100||
    T.retentionDays!==30||T.scaled.lossPoints!==T.original.lossPoints/2||
    T.scaled.repeatDays!==T.original.repeatDays/2)
    throw Error('unsupported or incorrectly scaled diagnostic fixture');
  if(T.ratioPairs.length!==3||T.cases.length!==2||T.seeds.length!==3)
    throw Error('comparison requires 3 pairs x 2 channels x 3 seeds');
}
validateParameters();

function fixedSimulation(seed){
  if(!T.seeds.includes(seed))throw RangeError('unknown registered seed');
  const s=Prior.fixture({seed});
  const core=W.stats(s);
  if(s.people.length!==30||core.followers!==15||core.opponentFollowers!==15||
    s.people.some(p=>p.devotion!==60||!p.alive)||!W.validate(s).ok)
    throw Error('diagnostic fork is not exactly 15v15 at 60');
  return s;
}
function setup(s,ratio,channel){
  const r=s.oracleStrategy;
  Object.assign(r,{
    counterFractionalLoss:true,
    counterDoubtStep:T.scaled.lossPoints,
    counterRepeatDays:T.scaled.repeatDays,
    counterRepeatIncludesFollowup:T.scaled.allPhaseRepeat,
    counterPairedRandom:T.pairedRandom,
    counterDiagnosticsEnabled:true,
    counterAttractionEnabled:channel==='earned-attraction',
    counterAttractionGain:T.attraction.gainPerCredibleObservation,
    counterAttractionMinEvidence:T.attraction.minEvidenceObservations,
    counterAttractionMargin:T.attraction.minimumMarginOverRemainingDevotion,
    counterAttractionConversionChance:T.attraction.conversionChance,
    counterAttractionMaxChance:T.attraction.maxConversionChance,
    counterAttractionRecencyDays:T.attraction.recencyDays
  });
  r.faithDefenseMatrix['family.nurture']['food.produce']=ratio.nurtureDefense;
  r.faithDefenseMatrix['food.produce']['family.nurture']=ratio.foodDefense;
}
function initialCohort(s){
  return new Map(s.people.map(p=>[p.id,{
    id:p.id,originalFaith:p.religionId,initialDevotion:p.devotion,
    minimumDevotion:p.devotion,firstBelow40:null,firstBelow20:null,
    firstConverted:null,deathDay:null
  }]));
}
function recordDay(s,track,day){
  for(const [id,t] of track){
    const p=s.people.find(v=>v.id===id);
    if(!p?.alive){t.deathDay??=day;continue;}
    t.minimumDevotion=Math.min(t.minimumDevotion,p.devotion);
    if(t.firstBelow40===null&&p.devotion<40)t.firstBelow40=day;
    if(t.firstBelow20===null&&p.devotion<20)t.firstBelow20=day;
    if(t.firstConverted===null&&p.religionId!==t.originalFaith)
      t.firstConverted=day;
  }
}
function checkpoint(s,track,elapsed){
  const st=W.stats(s),citizens=s.people,
    list=[...track.values()],origAI=list.filter(t=>t.originalFaith==='r2'),
    origPlayer=list.filter(t=>t.originalFaith==='r1');
  const trackedCount=(data,key)=>data.filter(t=>t[key]!==null).length;
  const countFaith=id=>citizens.filter(p=>p.alive&&p.religionId===id&&p.devotion>=20).length;
  const converted=data=>data.filter(t=>{
    const p=citizens.find(v=>v.id===t.id);
    return p?.alive&&p.religionId!==t.originalFaith;
  }).length;
  return {day:elapsed,originalAlive:citizens.filter(p=>p.alive).length,
    core40:{player:st.followers,AI:st.opponentFollowers},
    followers20:{player:countFaith('r1'),AI:countFaith('r2')},
    fromOriginalAI:{
      everBelow40:trackedCount(origAI,'firstBelow40'),
      everBelow20:trackedCount(origAI,'firstBelow20'),
      convertedByNow:converted(origAI),
      firstConversionDay:Math.min(...origAI.map(t=>t.firstConverted).filter(x=>x!==null))
    },
    fromOriginalPlayer:{convertedByNow:converted(origPlayer),
      everBelow40:trackedCount(origPlayer,'firstBelow40')},
    sourceEvidence:{coreChallengerPlayer:s.counts.playerStrategyCoreDoubts||0,
      coreChallengerAI:s.counts.aiStrategyCoreDoubts||0,
      attractionEvidence:s.counts.strategyAttractionEvidence||0,
      attractionOffers:s.counts.strategyAttractionOffers||0,
      attributionConversions:s.counts.strategyAttractionConversions||0},
    valid:W.validate(s).ok};
}
function simulate(snapshot,seed,ratio,channel,budgetMs){
  const started=Date.now(),s=W.restore(snapshot);
  if(JSON.stringify(s)!==snapshot)throw Error('fork mutated on restore');
  setup(s,ratio,channel);
  const before=s.people.map(p=>[p.id,p.religionId,p.devotion]);
  const player=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'family.nurture'});
  const AI=W.issueOracle(s,{godId:s.opponentGod.id,
    saintId:s.opponentReligion.saints[0],intentType:'food.produce'});
  if(!player.ok||!AI.ok)throw Error('fixed Oracle action rejected');
  if(JSON.stringify(s.people.map(p=>[p.id,p.religionId,p.devotion]))!==JSON.stringify(before))
    throw Error('Oracle issuance directly changed any resident');
  const cohort=initialCohort(s),checkpoints=[checkpoint(s,cohort,0)];
  const stopped={player:null,AI:null};
  for(let day=1;day<=T.studyDays+T.retentionDays;day++){
    W.advanceTicks(s,3);
    recordDay(s,cohort,day);
    for(const [name,faith,id] of [
      ['player',s.religion,player.oracleId],
      ['AI',s.opponentReligion,AI.oracleId]]){
      const o=faith.oracles.find(o=>o.id===id);
      if(stopped[name]===null&&o?.status!=='active')
        stopped[name]={day,reason:o?.status||'missing'};
    }
    if(CHECKPOINTS.includes(day))checkpoints.push(checkpoint(s,cohort,day));
    if(day%30===0&&Date.now()-started>budgetMs)
      throw Error(seed+' '+ratio.id+' '+channel+' exceeded budget at '+day);
  }
  const day100=checkpoints.find(x=>x.day===100),day130=checkpoints.find(x=>x.day===130);
  const originallyAI=[...cohort.values()].filter(t=>t.originalFaith==='r2');
  const aiConvertedAt100=originallyAI.filter(t=>t.firstConverted!==null&&t.firstConverted<=100);
  const retained=aiConvertedAt100.filter(t=>s.people.find(p=>p.id===t.id)?.religionId==='r1').length;
  const acquired=day100.fromOriginalAI.convertedByNow;
  const lost=day100.fromOriginalPlayer.convertedByNow;
  const converted=s.people.filter(p=>p.lastStrategicConversion).map(p=>({
    personId:p.id,originalFaith:cohort.get(p.id)?.originalFaith,
    finalFaith:p.religionId,firstConversionDay:cohort.get(p.id)?.firstConverted,
    ...p.lastStrategicConversion
  }));
  const studiedCitizens=[...cohort.values()].map(t=>{
    const p=s.people.find(v=>v.id===t.id);
    return {...t,finalFaith:p?.religionId||null,finalDevotion:p?.devotion??null,
      attraction:p?.strategyAttraction||null};
  });
  return {seed,ratio:ratio.id,defense:[ratio.nurtureDefense,ratio.foodDefense],
    channel,issued:[player.ok,AI.ok],oraclesStopped:stopped,
    elapsedMs:Date.now()-started,checkpoints,
    score:{advantagedNetOriginalConversions:acquired-lost,
      originalAIConverted:acquired,originalPlayerConverted:lost,
      originalAIStayedNewFaith30d:retained,
      day130NewFaithAmongOriginalAI:day130.fromOriginalAI.convertedByNow,
      originalAIEverBelow40:day100.fromOriginalAI.everBelow40,
      firstOriginalAIConvertedDay:Number.isFinite(day100.fromOriginalAI.firstConversionDay)?
        day100.fromOriginalAI.firstConversionDay:null,
      evidence:day100.sourceEvidence,
      peopleStillAliveAt130:day130.originalAlive},
    converted,studiedCitizens};
}
function run({seed='dry-stress',only=null,budgetMs=15000}={}){
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)
    throw RangeError('budgetMs must be 1000..30000');
  const all=T.cases.flatMap(channel=>T.ratioPairs.map(ratio=>({
    id:channel+'/'+ratio.id,channel,ratio
  })));
  if(only!==null&&(!Array.isArray(only)||!only.length||
    only.some(id=>!all.some(v=>v.id===id))))
    throw RangeError('unknown study arm');
  const world=fixedSimulation(seed),snapshot=JSON.stringify(world),
    fingerprint=Prior.hash(snapshot),started=Date.now();
  const cases=(only?all.filter(x=>only.includes(x.id)):all).map(c=>
    simulate(snapshot,seed,c.ratio,c.channel,budgetMs));
  return {schema:'world-of-god/oracle-earned-attraction-100d-study/v0.1',
    studyStatus:'experimental research, not live balance',
    seed,checkpointDays:CHECKPOINTS,forkDay:T.forkDay,
    mainWindowDays:T.studyDays,retentionWindowDays:T.retentionDays,
    nominalLossRatePerDay:{original:T.original.lossPoints/T.original.repeatDays,
      scaled:T.scaled.lossPoints/T.scaled.repeatDays},
    samePlayerNurtureAndAIFoodWork:true,
    pairedRandom:T.pairedRandom,
    fixedStartingCore:{player:15,AI:15,devotion:60},
    initialSnapshotFingerprint:fingerprint,caseCount:cases.length,cases,
    elapsedMs:Date.now()-started,
    caveat:'Paired deterministic per-person/day contact draws are variance-reduction diagnostics; not the current live RNG policy. Attraction can permit evidence-rich conversion before the former <20 threshold, only in opt-in model.'};
}
if(require.main===module){
  const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
  const result=run({seed:arg('--seed')||'dry-stress',
    only:arg('--only')?arg('--only').split(','):null,
    budgetMs:arg('--budget-ms')===null?15000:Number(arg('--budget-ms'))});
  const json=JSON.stringify(result,null,2)+'\n';
  if(arg('--out'))fs.writeFileSync(arg('--out'),json);
  process.stdout.write(json);
}
module.exports={CHECKPOINTS,fixedSimulation,run,simulate};
