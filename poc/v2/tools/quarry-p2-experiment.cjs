'use strict';
// Manual bounded, naturally evolving P1.5 vs P2. CI may only run 30 days/one
// seed for smoke; full 30/60/120/180 three-seed matrix is NOT CI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const W=require('../src/sim.js');
const Common=require('./mineral-natural-experiment.cjs');
const Core=require('./mineral-natural-core.js');
const P2=require('../config/mineral-rights-p2-v0.1.json');
const SEEDS=Core.SEEDS,DAYS=Core.SNAPSHOTS;
const round=v=>Math.round(v*1e3)/1e3;
const fingerprint=str=>{let h=2166136261;for(const c of str){h^=c.charCodeAt(0);
  h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
function options(seed,mode){
  assert.ok(SEEDS.includes(seed)&&['P1.5','P2'].includes(mode));
  const old=Common.options(seed,'finite-rights-p1-5');
  return mode==='P1.5'?old:{...old,politicsProfile:{...old.politicsProfile,
    mineralRights:P2.mineralRights}};
}
function originHash(s){
  return fingerprint(JSON.stringify({seed:s.seed,rng:s.rng,people:s.people,
    households:s.households,settlements:s.settlements,
    terrain:s.tiles.map(t=>t.terrain),hotspots:s.mobilityHotspots}));
}
function snap(s,day){
  const rights=s.politics.quarryClaims||[];
  const disputes=s.politics.disputes.filter(c=>c.quarryClaimId);
  const terminal=disputes.filter(c=>['resolved','withdrawn'].includes(c.status));
  const permits=s.politics.quarryNegotiations||[];
  return {day,claims:rights.length,guards:rights.filter(c=>c.status==='protected').length,
    truceClaims:rights.filter(c=>(c.truceUntilHour||0)>s.hour).length,
    granted:permits.filter(q=>q.status==='granted').length,
    usablePermits:s.counts.quarryUsablePermits||0,
    unusablePermitRejections:s.counts.quarryUnusablePermitRejections||0,
    actuallyExtractedUnderPermit:round(s.counts.quarryPermittedUnits||0),
    actuallyDeliveredPermitTrips:s.counts.quarryPermittedTripsDelivered||0,
    actuallyDeliveredPermitUnits:round(s.counts.quarryPermittedUnitsDelivered||0),
    alternativeDeliveredUnits:round(s.counts.quarryAlternativeUnitsDelivered||0),
    physicalWarnings:(s.politics.quarryEncounters||[]).filter(e=>e.outcome==='guard-warning').length,
    actualChallenges:s.counts.quarryActualChallenges||0,
    territorialIncidents:disputes.length,activeDisputes:disputes.filter(c=>
      ['marching','clashing'].includes(c.status)).length,
    settledDisputes:terminal.length,
    transfers:s.counts.quarryRightsTransferred||0,
    ceasefires:s.counts.quarryCeasefires||0,
    defenses:s.counts.quarryDefenses||0,
    leadersDeclinedArms:s.counts.quarryArmedChallengesDeclined||0,
    activeNaturalStock:round((s.mobilityHotspots||[]).filter(q=>q.kind==='stone')
      .reduce((n,q)=>n+(s.tiles[q.y*s.width+q.x].mineral?.available||0),0)),
    totalDeaths:s.counts.deaths||0,
    disputeEvidence:disputes.slice(-5).map(c=>({id:c.id,status:c.status,
      startedAtHour:c.startedAtHour,warningAtHour:c.warningAtHour,
      challengeAtHour:c.challengeAtHour,clashAtHour:c.clashStartedAtHour??null,
      endedAtHour:c.resolvedAtHour??null,rounds:c.roundsCompleted||0,
      winnerId:c.winnerId,reason:c.reason||c.trigger})),
    claimOutcomes:rights.filter(q=>q.lastOutcome).map(q=>({site:q.site,
      ownerTownId:q.townId,guardId:q.guardId,protected:q.status==='protected',
      outcome:q.lastOutcome}))};
}
function run(s,mode,days){
  const initial=originHash(s),snapshots=[];
  for(let day=1;day<=days;day++){
    W.advanceTicks(s,3);
    const v=W.validate(s);
    if(!v.ok)throw Error(s.seed+' '+mode+' Day '+day+': '+v.errors.join(';'));
    if(DAYS.includes(day))snapshots.push(snap(s,day));
  }
  const save=JSON.stringify(s),restored=W.restore(save);
  assert.equal(JSON.stringify(restored),save,'JSON restore must preserve exact world state');
  W.advanceTicks(restored,3);W.advanceTicks(s,3);
  assert.equal(JSON.stringify(restored),JSON.stringify(s),'same-world replay at +24h');
  return {mode,seed:s.seed,initialHash:initial,snapshots,
    verification:'daily W.validate, exact JSON restore, deterministic extra day'};
}
function execute({seeds=SEEDS,days=180}={}){
  assert.ok(seeds.length&&seeds.every(s=>SEEDS.includes(s))&&DAYS.includes(days));
  const cases=seeds.map(seed=>{
    const a=run(W.create(options(seed,'P1.5')),'P1.5',days);
    const b=run(W.create(options(seed,'P2')),'P2',days);
    assert.equal(a.initialHash,b.initialHash,'both modes have the same initial physical world');
    return {seed,baseline:a,p2:b};
  });
  return {issue:14,stage:'P2-minimal-quarry-dispute',node:process.version,
    category:'natural worlds only; no cast, no injected soldiers, ores, religions or leader choices',
    seeds,days,profile:P2.mineralRights,matchedGenesis:true,cases,
    limitations:['A controlled two-intrusion human test is separate from these natural rates',
      'A granted permit is not an economic benefit until an actual resident brings stone home',
      'Matching initial RNG does not preserve all later RNG decisions',
      'Full three-seed 180-day runs are manual, not a GitHub CI requirement']};
}
if(require.main===module){
  const args=process.argv.slice(2);
  assert.ok(args.every(v=>v.startsWith('--days=')||v.startsWith('--seed=')||
    v==='--stdout-only'),'only bounded days/seed/stdout-only');
  const value=(key,def)=>args.find(v=>v.startsWith(key+'='))?.slice(key.length+1)||def;
  const days=Number(value('--days','180')),seed=value('--seed','all');
  assert.ok(DAYS.includes(days)&&['all',...SEEDS].includes(seed));
  const start=Date.now();
  const out=execute({seeds:seed==='all'?SEEDS:[seed],days});
  out.elapsedMs=Date.now()-start;
  if(!args.includes('--stdout-only')){
    const dest=path.resolve(__dirname,'../reports/issue-14-quarry-p2-2026-10-24.json');
    fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
    console.log('full JSON:',dest);
  }
  for(const item of out.cases)
    console.log('natural',item.seed,JSON.stringify({
      snapshots:item.p2.snapshots.map(s=>({day:s.day,warnings:s.physicalWarnings,
        actualChallenges:s.actualChallenges,war:s.territorialIncidents,
        transfers:s.transfers,ceasefires:s.ceasefires,permittedArrival:s.actuallyDeliveredPermitUnits})),
      p15Final:item.baseline.snapshots.at(-1)}));
  console.log('elapsedMs',out.elapsedMs);
}
module.exports={options,execute,run,snap,originHash};
