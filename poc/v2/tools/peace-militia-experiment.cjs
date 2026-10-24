'use strict';
const W=require('../src/sim.js'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const policy=require('../config/polity-command-v0.1.json');
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
const WORK=new Set(['farm','forage','stone','wood','fiber','build','care',
  'build_watchtower','build_ritual','visit','transport']);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function options(seed,enabled){
 assert.ok(SEEDS.includes(seed)&&typeof enabled==='boolean');
 return {seed,
  balanceProfile:require('../config/balance-agriculture-v0.1.json'),
  religionProfile:require('../config/religion-propagation-v0.1.json'),
  mobilityProfile:require('../config/mobility-contact-v0.1.json'),
  divineProfile:require('../config/divine-powers-v0.1.json'),
  opponentProfile:require('../config/opponent-v0.2.json'),
  oracleStrategyProfile:require('../config/oracle-specialization-v0.1.json'),
  shrineProfile:require('../config/shrine-temple-v0.1.json'),
  politicsProfile:{...policy,peaceMilitia:{...policy.peaceMilitia,enabled}}};
}
function run(seed,enabled,days=120){
 assert.ok(SEEDS.includes(seed)&&[30,60,90,120,180].includes(days));
 const start=performance.now(),s=W.create(options(seed,enabled));
 const initialHash=hash({people:s.people,households:s.households,settlements:s.settlements,
   tiles:s.tiles,rng:s.rng});
 const metrics={guards:0,ordinaryWork:0,fights:0,marching:0,retreats:0,
   freedReserveSlots:0,militiaPersonDays:0};
 const snapshots=[];
 for(let day=1;day<=days;day++){
  W.advanceTicks(s,1);
  for(const p of s.people.filter(p=>p.alive)){
   metrics.guards+=Number(p.activity==='guard');
   metrics.ordinaryWork+=Number(WORK.has(p.activity));
   metrics.fights+=Number(p.activity==='fight');
   metrics.marching+=Number(p.activity==='march');
   metrics.retreats+=Number(p.activity==='retreat');
  }
  W.advanceTicks(s,2);
  metrics.militiaPersonDays+=s.politics.polities.reduce((n,p)=>n+p.militia.memberIds.length,0);
  metrics.freedReserveSlots+=s.politics.polities.reduce((n,p)=>
    n+Math.max(0,s.politics.militiaLimit-p.militia.memberIds.length),0);
  assert.deepEqual(W.validate(s).errors,[],seed+' day '+day);
  if([30,60,90,120,180].includes(day))snapshots.push({
   day,alive:s.people.filter(p=>p.alive).length,
   settlements:s.settlements.length,
   alliances:s.politics.diplomacy?.relations.filter(r=>r.status==='alliance').length||0,
   unions:s.politics.unions?.filter(u=>!Number.isFinite(u.dissolvedAtHour)).length||0,
   conflicts:s.politics.disputes.length,
   stationedGuards:s.politics.polities.reduce((n,p)=>n+p.militia.memberIds.length,0),
   foodFromLabor:s.counts.foodFromLabor,
   publicFood:s.settlements.reduce((n,t)=>n+t.storage.food,0),metrics:{...metrics}});
 }
 const endpoint=JSON.parse(JSON.stringify(s));
 const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
 W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s);
 return {seed,enabled,days,initialHash,elapsedMs:performance.now()-start,snapshots,metrics,
  endpoint:{foodFromLabor:endpoint.counts.foodFromLabor,
   publicFood:endpoint.settlements.reduce((n,t)=>n+t.storage.food,0),
   conflicts:endpoint.politics.disputes.length,
   alliances:endpoint.politics.diplomacy.relations.filter(r=>r.status==='alliance').length,
   mobilizations:(endpoint.politics.mobilizations||[]).map(m=>({
    status:m.status,startDay:m.startedAtHour/24,readyDay:m.readyAtHour/24,
    resolvedDay:m.resolvedAtHour/24,ids:[m.aId,m.bId]}))},
  validation:'daily W.validate; deterministic restore and extra-day replay'};
}
function compare(days=120){
 const results=[];
 for(const seed of SEEDS){
  const baseline=run(seed,false,days),reserve=run(seed,true,days);
  assert.equal(baseline.initialHash,reserve.initialHash);
  results.push({seed,baseline,reserve,difference:{
   guardShifts:reserve.metrics.guards-baseline.metrics.guards,
   ordinaryWorkShifts:reserve.metrics.ordinaryWork-baseline.metrics.ordinaryWork,
   foodFromLabor:reserve.endpoint.foodFromLabor-baseline.endpoint.foodFromLabor,
   conflicts:reserve.endpoint.conflicts-baseline.endpoint.conflicts,
   mobilizations:reserve.endpoint.mobilizations.length}});
 }
 return results;
}
if(require.main===module){
 const arg=process.argv.find(x=>x.startsWith('--days='));
 const days=arg?Number(arg.slice(7)):120;
 assert.ok([30,60,90,120,180].includes(days),'bounded days only');
 const start=performance.now(),results=compare(days);
 const out=path.resolve(__dirname,'../reports/issue-14-peace-militia-2026-10-24.json');
 fs.writeFileSync(out,JSON.stringify({issue:14,category:'matched natural world A/B; no artificial world inputs or God casts',
  node:process.version,elapsedMs:performance.now()-start,days,peaceMilitia:policy.peaceMilitia,results},null,2)+'\n');
 for(const x of results)console.log(x.seed,JSON.stringify(x.difference));
 console.log('report:',out);
}
module.exports={SEEDS,options,run,compare};
