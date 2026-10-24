'use strict';
// Issue #14: bounded real-kernel A/B. No population, faith, stock or contacts injected.
const W=require('../src/sim.js'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const profile=require('../config/polity-command-v0.1.json');
function options(seed,enabled,unionEnabled=false,fractureEnabled=false){return {seed,
  balanceProfile:require('../config/balance-agriculture-v0.1.json'),
  religionProfile:require('../config/religion-propagation-v0.1.json'),
  mobilityProfile:require('../config/mobility-contact-v0.1.json'),
  shrineProfile:require('../config/shrine-temple-v0.1.json'),
  divineProfile:require('../config/divine-powers-v0.1.json'),
  opponentProfile:require('../config/opponent-v0.2.json'),
  politicsProfile:{...profile,diplomacy:{...profile.diplomacy,enabled,
    union:{...profile.diplomacy.union,enabled:unionEnabled,
      fracture:{...profile.diplomacy.union.fracture,enabled:fractureEnabled}}}}};}
function run(seed,enabled,days=180){
  assert.ok(Number.isInteger(days)&&days>=1&&days<=180,'bounded 1–180 days');
  const start=performance.now(),s=W.create(options(seed,enabled));
  const genesis=s.people.map(p=>({id:p.id,householdId:p.householdId,religionId:p.religionId,devotion:p.devotion}));
  let maxCargo=0;const moments=[];
  for(let d=0;d<days;d++){
    W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[],seed+' day '+d);
    const shipments=s.politics.diplomacy?.shipments||[];
    maxCargo=Math.max(maxCargo,shipments.filter(q=>q.status==='outbound').reduce((n,q)=>n+q.amount,0));
    if([30,60,120,180].includes(d+1))moments.push({day:d+1,alive:s.people.filter(p=>p.alive).length,
      disputes:s.politics.disputes.length,relations:JSON.parse(JSON.stringify(s.politics.diplomacy?.relations||[]))});
  }
  const endpoint=JSON.parse(JSON.stringify(s));
  const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s,'save/restore');
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s,'post-restore replay');
  const diploma=endpoint.politics.diplomacy;
  return {seed,enabled,days,elapsedMs:performance.now()-start,genesis,
    // Report at the requested endpoint, excluding the extra replay day.
    endpoint:moments.at(-1),conflicts:endpoint.politics.disputes.map(c=>({
      id:c.id,aId:c.aId,bId:c.bId,status:c.status,startDay:c.startedAtHour/24,reason:c.reason||null})),
    relations:diploma?.relations.map(r=>({...r}))||[],
    shipments:diploma?.shipments.map(q=>({id:q.id,from:q.fromTownId,to:q.toTownId,carrierId:q.carrierId,
      resource:q.resource,amount:q.amount,status:q.status,startDay:q.startedAtHour/24,
      arrivedDay:q.deliveredAtHour? q.deliveredAtHour/24:null,lost:q.lost}))||[],maxCargo,
    politicalEvents:endpoint.events.filter(e=>e.kind==='diplomacy'),
    validation:'daily valid; roundtrip and next-day deterministic replay passed'};
}
if(require.main===module){
  const start=performance.now(),results=[];
  for(const seed of ['valley-spring-01','dry-stress','opponent-competition-replay']){
    for(const enabled of [false,true]){const r=run(seed,enabled);results.push(r);
      console.log(seed,enabled?'diplomacy':'control','conflicts',r.conflicts.length,'relations',r.relations.map(x=>x.status),'shipments',r.shipments.length);}
    assert.deepEqual(results.at(-1).genesis,results.at(-2).genesis,'paired natural genesis');
  }
  const out=path.resolve(__dirname,'../reports/issue-14-diplomacy-2026-10-24.json');
  fs.writeFileSync(out,JSON.stringify({issue:14,baseCommit:'2c59219dcb5838b34fefc53f17c1f6d06450a3f2',
    node:process.version,days:180,elapsedMs:performance.now()-start,profile,results},null,2)+'\n');console.log(out);
}
module.exports={options,run};
