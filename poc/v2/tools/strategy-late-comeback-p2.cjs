'use strict';
// P2: late-game comeback from one identical Day-300 serialized world.
// Phase 1 PREPARE once; Phase 2 RUN independent <=120-day branches.
// No UI, per-tick LLM decisions, rerolls, automatic fallback casts or tune changes.
const W=require('../src/sim.js');
const E=require('./strategy-reversal-evaluation.cjs');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');

const SEED='dry-stress', FORK_DAY=300, MAX_AFTER_DAYS=120;
const EXPECTED_FINGERPRINT='778899f9'; // fixed current-kernel passive Day-300 state
const STRATEGIES=Object.freeze(['passive','frontier-welfare','frontier-offense']);
const CHECKPOINTS=Object.freeze([300,330,360,390,420]);
const TYPES=Object.freeze({
  'frontier-welfare':['ripening','rain','harvest','ripening','rain'],
  'frontier-offense':['confusion','drought','lightning','confusion','drought']
});
const round=v=>Math.round(Number(v||0)*100)/100;
// Fast deterministic, NON-CRYPTOGRAPHIC fingerprint for snapshot parity.
function fingerprint(snapshot){
  let hash=2166136261;
  for(let i=0;i<snapshot.length;i++){
    hash^=snapshot.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return ('00000000'+(hash>>>0).toString(16)).slice(-8);
}
function budget(budgetMs) {
  if(!Number.isFinite(budgetMs)||budgetMs<1000||budgetMs>30000)
    throw new RangeError('budget-ms must be 1000..30000');
}
function nativeVillages(s){return s.settlements.filter(t=>t.native);}
function oldCohort(s){
  return {
    all:s.people.filter(p=>p.alive&&p.religionId===s.opponentReligion.id&&p.devotion>=40).map(p=>p.id),
    native:s.people.filter(p=>p.alive&&p.nativeOrigin&&p.religionId===s.opponentReligion.id&&p.devotion>=40).map(p=>p.id)
  };
}
function attributionReach(s,ids){
  const believers=s.people.filter(p=>p.alive&&p.religionId===s.religion.id&&p.devotion>=20);
  const max=s.religionPropagation.miracleAttributionRadius;
  const positions=ids.map(id=>s.people.find(p=>p.id===id)).filter(Boolean);
  return {radius:max,eligible:positions.filter(p=>believers.some(q=>
    Math.hypot(p.x-q.x,p.y-q.y)<=max)).length,total:positions.length};
}
function prepareSnapshot({budgetMs=15000}={}){
  budget(budgetMs);
  const s=W.create({seed:SEED,balanceProfile:agriculture,religionProfile:religion,
    divineProfile:divine,opponentProfile:{...opponent,difficulty:'standard'}});
  const started=Date.now();
  for(let day=1;day<=FORK_DAY;day++){
    W.advanceTicks(s,3);
    if(day%30===0&&Date.now()-started>budgetMs)
      throw new Error('P2 snapshot preparation exceeded time budget at day '+day);
  }
  const verdict=W.validate(s);
  if(!verdict.ok)throw new Error('P2 Day-300 invalid: '+verdict.errors.slice(0,3));
  const snapshot=JSON.stringify(s),restored=W.restore(snapshot);
  if(fingerprint(snapshot)!==EXPECTED_FINGERPRINT)
    throw new Error('P2 kernel/config drift: Day-300 world fingerprint changed');
  if(JSON.stringify(restored)!==snapshot)
    throw new Error('P2 snapshot restore changed serialized state');
  const cohort=oldCohort(s);
  return {snapshot,metadata:{
    seed:SEED,day:FORK_DAY,ticks:s.tick,bytes:snapshot.length,
    fingerprintAlgorithm:'FNV1a32',fingerprint:fingerprint(snapshot),
    originalCoreCount:cohort.all.length,nativeOriginalCoreCount:cohort.native.length,
    attribution:attributionReach(s,cohort.native),initial:E.checkpoint(s,FORK_DAY),
    elapsedMs:Date.now()-started,valid:true}};
}
// Commands are completely fixed at the branch, not decided from later faith data.
function plannedMiracle(s,strategy,index){
  if(!TYPES[strategy]||index<0||index>=TYPES[strategy].length)return null;
  const plan=E.initialPlan(s);
  const at=index%2===0?plan.own:plan.frontier;
  const type=TYPES[strategy][index];
  return {type,target:at.id,args:{x:at.x,y:at.y,
    radius:type==='lightning'?3:7,
    intensity:type==='rain'?.85:type==='confusion'?.7:1,
    durationDays:type==='rain'?7:type==='drought'||type==='confusion'?10:
      type==='ripening'?10:0}};
}
function cohortReview(s,ids){
  const people=new Map(s.people.map(p=>[p.id,p]));
  const original=ids.map(id=>people.get(id));
  return {atFork:ids.length,alive:original.filter(p=>p?.alive).length,
    stillAIcore40:original.filter(p=>p?.alive&&
      p.religionId===s.opponentReligion.id&&p.devotion>=40).length,
    AIbelow40:original.filter(p=>p?.alive&&
      p.religionId===s.opponentReligion.id&&p.devotion<40).length,
    adoptedPlayer:original.filter(p=>p?.alive&&p.religionId===s.religion.id).length,
    dead:original.filter(p=>!p?.alive).length};
}
function counterDelta(s,initial,name){
  return (s.counts[name]||0)-(initial[name]||0);
}
function runBranch(snapshot,strategy='passive',{days=MAX_AFTER_DAYS,budgetMs=12000}={}){
  if(!STRATEGIES.includes(strategy))throw new Error('Invalid P2 strategy: '+strategy);
  if(!Number.isInteger(days)||days<1||days>MAX_AFTER_DAYS)
    throw new RangeError('P2 branch duration must be 1..120 days');
  budget(budgetMs);
  if(typeof snapshot!=='string'||snapshot.length<10)
    throw new Error('P2 requires a serialized Day-300 save');
  const originalFingerprint=fingerprint(snapshot);
  if(originalFingerprint!==EXPECTED_FINGERPRINT)
    throw new Error('P2 source fingerprint mismatch: wrong Day-300 fork');
  const s=W.restore(snapshot);
  if(s.seed!==SEED||Math.floor(s.hour/24)!==FORK_DAY||
    !s.opponent?.enabled||s.opponent.difficulty!=='standard')
    throw new Error('P2 requires the fixed Day-300 Normal-AI dry-stress save');
  if(JSON.stringify(s)!==snapshot)
    throw new Error('P2 cannot silently migrate or mutate the fork state');
  const initialCounts={...s.counts};
  const cohort=oldCohort(s),attr=attributionReach(s,cohort.native);
  const started=Date.now(),checkpoints=[E.checkpoint(s,FORK_DAY)];
  const operations={miracleAttempts:0,miracleSuccess:0,
    oracleAttempts:0,oracleSuccess:0,casts:[],oracles:[]};
  let completed=0,aborted=false,peakRssBytes=0;
  const rss=()=>{
    if(typeof process!=='undefined'&&typeof process.memoryUsage==='function')
      peakRssBytes=Math.max(peakRssBytes,process.memoryUsage().rss);
  };
  rss();
  for(let day=FORK_DAY+1;day<=FORK_DAY+days;day++){
    W.advanceTicks(s,3);completed++;
    if(strategy!=='passive'){
      if(day===301||day===391){
        operations.oracleAttempts++;
        const res=W.issueOracle(s,{saintId:s.religion.saints[0],
          intentType:'religion.spread',durationDays:80});
        if(res.ok)operations.oracleSuccess++;
        operations.oracles.push({day,ok:!!res.ok,reason:res.ok?null:res.reason});
      }
      if((day-FORK_DAY)%21===0){
        const index=(day-FORK_DAY)/21-1,cmd=plannedMiracle(s,strategy,index);
        if(cmd){
          operations.miracleAttempts++;
          const res=W.castMiracle(s,cmd.type,cmd.args);
          if(res.ok)operations.miracleSuccess++;
          operations.casts.push({day,type:cmd.type,target:cmd.target,
            ok:!!res.ok,reason:res.ok?null:res.reason});
        }
      }
    }
    if(CHECKPOINTS.includes(day)||day===FORK_DAY+days)
      checkpoints.push(E.checkpoint(s,day));
    if(completed%30===0){
      rss();
      if(Date.now()-started>budgetMs){aborted=true;break;}
    }
  }
  rss();
  const verdict=W.validate(s);
  const final=E.checkpoint(s,FORK_DAY+completed);
  return {schema:'world-of-god/late-comeback-p2/v0.1',seed:SEED,
    strategy,sourceDay:FORK_DAY,requestedDays:days,completedDays:completed,
    finalDay:FORK_DAY+completed,ticks:completed*3,elapsedMs:Date.now()-started,
    peakRssMb:peakRssBytes?round(peakRssBytes/1048576):null,
    aborted,valid:verdict.ok,validationErrors:verdict.errors.slice(0,3),
    sourceFingerprintAlgorithm:'FNV1a32',sourceFingerprint:originalFingerprint,
    sourceBytes:snapshot.length,originalRivalCore:cohortReview(s,cohort.all),
    originalNativeRivalCore:cohortReview(s,cohort.native),
    originalNativeCoreAttributionReach:attr,
    conversionDeltas:{
      playerRivalConversions:counterDelta(s,initialCounts,'rivalConversions'),
      playerMiracleAdoptions:counterDelta(s,initialCounts,'miracleAdoptions'),
      aiRivalConversions:counterDelta(s,initialCounts,'opponentConversions')},
    operations,checkpoints,final};
}
function parseArgs(argv){
  const o={};
  for(let i=0;i<argv.length;i+=2){
    if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)
      throw new Error('Arguments must be --name value pairs');
    o[argv[i].slice(2)]=argv[i+1];
  }
  return o;
}
if(require.main===module){
  const fs=require('node:fs'),path=require('node:path'),args=parseArgs(process.argv.slice(2));
  if(args.prepare&&!args.from){
    const p=prepareSnapshot({budgetMs:Number(args['budget-ms']||15000)});
    fs.mkdirSync(path.dirname(args.prepare),{recursive:true});
    fs.writeFileSync(args.prepare,p.snapshot,'utf8');
    console.log(JSON.stringify({mode:'prepare',output:args.prepare,...p.metadata}));
  }else if(args.from&&args.strategy&&!args.prepare){
    const snapshot=fs.readFileSync(args.from,'utf8');
    const p=runBranch(snapshot,args.strategy,
      {days:Number(args.days||MAX_AFTER_DAYS),budgetMs:Number(args['budget-ms']||12000)});
    console.log(JSON.stringify(p));
    if(p.aborted||!p.valid||p.completedDays!==p.requestedDays)process.exitCode=2;
  }else{
    throw new Error('Use --prepare reports/.snapshots/p2-day300.json OR '+
      '--from reports/.snapshots/p2-day300.json --strategy passive|frontier-welfare|frontier-offense');
  }
}
module.exports={SEED,FORK_DAY,MAX_AFTER_DAYS,EXPECTED_FINGERPRINT,STRATEGIES,CHECKPOINTS,
  fingerprint,prepareSnapshot,plannedMiracle,runBranch};
