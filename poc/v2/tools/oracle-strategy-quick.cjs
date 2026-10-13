'use strict';
// Bounded world-first Oracle differentiation check. One serialized Day-45 fork,
// then at most 60 days per arm. No forced followers, scripted outcomes or AI cheats.
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const S=require('../config/oracle-specialization-v0.1.json');
const fs=require('node:fs');
const FORK_DAY=45,MAX_DAYS=60,CHECKPOINTS=[45,60,75,90,105];
const ARMS=['passive','reserve','nurture','explore','nurture-reset-reserve'];
const focus={
  reserve:'food.produce',nurture:'family.nurture',explore:'settlement.explore',
  'nurture-reset-reserve':'family.nurture'
};
const fp=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return ('00000000'+(h>>>0).toString(16)).slice(-8);};
function world(){return W.create({seed:'dry-stress',balanceProfile:A,
  religionProfile:R,divineProfile:D,oracleStrategyProfile:S,
  opponentProfile:{...O,difficulty:'standard'}});}
function summary(s,cohort,day,history=null){
  const v=W.stats(s),ai=new Map(s.people.map(p=>[p.id,p]));
  const kept=cohort.filter(id=>ai.get(id)?.alive&&ai.get(id).religionId===s.opponentReligion.id&&ai.get(id).devotion>=40);
  const below=cohort.filter(id=>ai.get(id)?.alive&&ai.get(id).devotion<40);
  const events=s.religion.oracles.filter(o=>o.status==='active').map(o=>({intent:o.intentType,
    worked:o.influenceWorkCount,care:o.influenceCareCount,houses:o.housesCompleted}));
  return {day,core:[v.followers,v.opponentFollowers],
    believers20:[v.believers,v.opponentBelievers],
    originalAIcore40:kept.length,originalAIbelow40:below.length,
    originalAIeverBelow40:history?[...history.values()].filter(v=>v.everBelow40).length:0,
    originalAIeverChangedReligion:history?[...history.values()].filter(v=>v.everChangedReligion).length:0,
    originalAIcounterContacted:cohort.filter(id=>ai.get(id)?.lastStrategyEncounter?.challengerReligionId===s.religion.id).length,
    naturalRivalConversions:s.counts.rivalConversions||0,
    realContactDoubts:s.counts.strategyCoreDoubts||0,
    playerCoreCounterDoubts:s.counts.playerStrategyCoreDoubts||0,
    aiCoreCounterDoubts:s.counts.aiStrategyCoreDoubts||0,
    strategyConversions:s.counts.strategyConversions||0,
    totalContactEvents:s.counts.strategyContacts||0,
    food:Math.round(v.food),housed:v.houses+'/'+v.households,
    births:v.births,conceptions:s.counts.strategyConceptions||0,
    focus:events,valid:W.validate(s).ok};
}
function boundedSteps(s,from,to,budgetMs,label){
  const started=Date.now();
  for(let day=from+1;day<=to;day++){
    W.advanceTicks(s,3);
    if(day%15===0&&Date.now()-started>budgetMs)
      throw new Error(label+' exceeded '+budgetMs+'ms by Day '+day);
  }
}
function run({days=MAX_DAYS,budgetMs=15000}={}){
  if(!Number.isInteger(days)||days<15||days>MAX_DAYS)throw RangeError('days must be 15..60');
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)throw RangeError('budget-ms must be 1000..30000');
  const genesis=world(),time=Date.now();
  boundedSteps(genesis,0,FORK_DAY,budgetMs,'preparation');
  if(!W.validate(genesis).ok)throw Error('invalid Day-45 fork');
  const snapshot=JSON.stringify(genesis),fingerprint=fp(snapshot);
  const preparedMs=Date.now()-time;
  const cohort=genesis.people.filter(p=>p.alive&&p.religionId===genesis.opponentReligion.id&&p.devotion>=40).map(p=>p.id);
  const cases=[];
  for(const arm of ARMS){
    const s=W.restore(snapshot);
    if(fp(JSON.stringify(s))!==fingerprint)throw Error('branch parity mismatch');
    const history=new Map(cohort.map(id=>{
      const p=s.people.find(v=>v.id===id);
      return [id,{start:p.devotion,min:p.devotion,everBelow40:false,
        everChangedReligion:false}];
    }));
    const observe=()=>{for(const [id,h] of history){
      const p=s.people.find(v=>v.id===id);if(!p||!p.alive)continue;
      h.min=Math.min(h.min,p.devotion);
      if(p.devotion<40)h.everBelow40=true;
      if(p.religionId!==s.opponentReligion.id)h.everChangedReligion=true;
    }};
    const actions=[],results=[summary(s,cohort,FORK_DAY,history)];
    const started=Date.now();
    for(let day=FORK_DAY+1;day<=FORK_DAY+days;day++){
      if(day===FORK_DAY+1&&focus[arm]){
        const r=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:focus[arm]});
        actions.push({day,intent:focus[arm],ok:r.ok,reason:r.reason||null});
      }
      if(arm==='nurture-reset-reserve'&&day===FORK_DAY+31){
        const reset=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'life.balance'});
        actions.push({day,intent:'life.balance',ok:reset.ok,reason:reset.reason||null});
        const newIssue=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'food.produce'});
        actions.push({day,intent:'food.produce',ok:newIssue.ok,reason:newIssue.reason||null});
      }
      W.advanceTicks(s,3);
      observe();
      if(CHECKPOINTS.includes(day))results.push(summary(s,cohort,day,history));
      if(day%15===0&&Date.now()-started>budgetMs)
        throw Error(arm+' exceeded '+budgetMs+'ms by Day '+day);
    }
    const valid=W.validate(s);
    if(!valid.ok)throw Error(arm+' invalid: '+valid.errors.join(';'));
    cases.push({arm,actions,checkpoints:results,
      originalAIcoreTrace:[...history].map(([id,h])=>({id,...h,
        final:s.people.find(p=>p.id===id)?.devotion??null})).filter(h=>h.everBelow40||
          h.everChangedReligion).slice(0,12),
      elapsedMs:Date.now()-started});
  }
  return {schema:'world-of-god/oracle-quick-v0.1',seed:genesis.seed,
    forkDay:FORK_DAY,afterDays:days,identicalSnapshotFingerprint:fingerprint,
    oldAIcoreCohort:cohort.length,autonomousAI:'standard',
    assertions:'World behavior only, no injected player followers or forced conversions. Mechanistic fixture tests separately verify Reset.',
    preparationMs:preparedMs,totalElapsedMs:Date.now()-time,cases};
}
if(require.main===module){
  const args=process.argv.slice(2);
  const number=flag=>{const n=args.indexOf(flag);return n<0?undefined:Number(args[n+1]);};
  const result=run({days:number('--days')??MAX_DAYS,budgetMs:number('--budget-ms')??15000});
  const report=JSON.stringify(result,null,2)+'\n';
  const pathIndex=args.indexOf('--out');
  if(pathIndex>=0){if(!args[pathIndex+1])throw Error('--out requires path');
    fs.writeFileSync(args[pathIndex+1],report);}
  process.stdout.write(report);
}
module.exports={FORK_DAY,MAX_DAYS,CHECKPOINTS,ARMS,run,fp};
