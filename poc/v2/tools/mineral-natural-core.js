/* Pure, bounded observation kernel. No filesystem, clocks, God actions or injected miners.
 * Shared by the Node 24 CLI and isolated local V8 validation runs.
 */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.WoGMineralNaturalCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
const MODES=['legacy','finite-shared','finite-rights','finite-rights-p1-5'];
const SNAPSHOTS=[30,60,120,180];
const round=x=>Math.round(x*1e4)/1e4;
const fingerprint=str=>{let h=2166136261;for(let i=0;i<str.length;i++){
  h^=str.charCodeAt(i);h=Math.imul(h,16777619);
}return (h>>>0).toString(16).padStart(8,'0');};
const total=(items,f)=>items.reduce((n,v)=>n+f(v),0);
const snapshot=(s,day,metrics)=>{
  const rocks=(s.mobilityHotspots||[]).filter(q=>q.kind==='stone')
    .map(q=>({x:q.x,y:q.y,t:s.tiles[q.y*s.width+q.x]}));
  const mineStats=rocks.map(q=>({
    x:q.x,y:q.y,capacity:q.t.mineral?.capacity??null,
    available:round(q.t.mineral?.available??q.t.stone),
    extracted:q.t.mineral?round(q.t.mineral.extracted):null,
    regenerated:q.t.mineral?round(q.t.mineral.regenerated):null,
    byTown:q.t.mineral?Object.fromEntries(Object.entries(q.t.mineral.byTown)
      .map(([id,n])=>[id,round(n)])):null
  }));
  const claims=s.politics?.quarryClaims||[];
  return {day,population:s.people.filter(p=>p.alive).length,settlements:s.settlements.length,
    publicStone:round(total(s.settlements,t=>t.storage.stone)),
    stoneMined:s.mobility.finiteMineralsEnabled?
      round(total(rocks,q=>q.t.mineral?.extracted||0)):null,
    stoneRegenerated:s.mobility.finiteMineralsEnabled?
      round(total(rocks,q=>q.t.mineral?.regenerated||0)):null,
    stoneAvailable:round(total(rocks,q=>q.t.mineral?.available??q.t.stone)),
    sharedMines:rocks.filter(q=>Object.values(q.t.mineral?.byTown||{})
      .filter(n=>n>1e-8).length>=2).length,
    temporarilyExhaustedMines:rocks.filter(q=>q.t.mineral&&q.t.mineral.available<1e-8).length,
    declarations:claims.length,
    guardedClaims:claims.filter(c=>c.status==='protected').length,
    guardPersonDays:metrics.guardPersonDays,sharedUnprotectedMineDays:metrics.sharedUnprotectedMineDays,
    firstDeclarationDay:metrics.firstDeclarationDay,
    firstGuardedDay:metrics.firstGuardedDay,
    firstDetourDay:metrics.firstDetourDay,
    protectedDays:total(claims,c=>c.protectedDays||0),
    quarryDetours:s.counts.quarryDetours||0,
    protectedArrivals:s.counts.quarryBlockedArrivals||0,
    quarryNegotiations:(s.politics.quarryNegotiations||[]).length,
    accessRequests:s.counts.quarryAccessRequested||0,
    accessGrants:s.counts.quarryAccessGranted||0,
    accessRejections:s.counts.quarryAccessRejected||0,
    permittedUnits:round(s.counts.quarryPermittedUnits||0),
    safeChoices:s.counts.quarrySafeChoices||0,
    challengeChoices:s.counts.quarryChallengeDecisions||0,
    actualChallenges:s.counts.quarryActualChallenges||0,
    oreTripsDelivered:s.counts.quarryOreTripsDelivered||0,
    oreUnitsDelivered:round(s.counts.quarryOreUnitsDelivered||0),
    alternativeOreTripsDelivered:s.counts.quarryAlternativeTripsDelivered||0,
    alternativeOreUnitsDelivered:round(s.counts.quarryAlternativeUnitsDelivered||0),
    deliveries:(s.politics.quarryDeliveries||[]).slice(-12),
    quarryChoiceEvidence:(s.politics.quarryChoices||[]).map(q=>({
      claimId:q.claimId,visitorTownId:q.visitorTownId,ownerTownId:q.ownerTownId,
      action:q.action,alternative:q.alternative,contactEvidence:q.contactEvidence})),
    conflicts:s.politics.disputes.length,
    resourceVisits:s.counts.resourceVisitsCompleted||0,
    crossTownMeetings:s.counts.crossTownMeetings||0,
    foodFromLabor:round(s.counts.foodFromLabor),
    mines:mineStats};
};
function run(W,s,mode,days=180){
  if(!MODES.includes(mode)||![30,60,120,180].includes(days))
    throw Error('bounded mode/day only');
  const commonGenesis=JSON.stringify({seed:s.seed,rng:s.rng,
    people:s.people,households:s.households,settlements:s.settlements,
    terrain:s.tiles.map(t=>t.terrain),hotspots:s.mobilityHotspots});
  const metrics={guardPersonDays:0,sharedUnprotectedMineDays:0,
    firstDeclarationDay:null,firstGuardedDay:null,firstDetourDay:null};
  const snaps=[];
  for(let day=1;day<=days;day++){
    W.advanceTicks(s,3); // complete natural 24h, no God control
    const verdict=W.validate(s);
    if(!verdict.ok)throw Error(s.seed+'/'+mode+' day '+day+': '+verdict.errors.join('|'));
    const claims=s.politics.quarryClaims||[];
    if(metrics.firstDeclarationDay===null&&claims.length)metrics.firstDeclarationDay=day;
    if(metrics.firstGuardedDay===null&&claims.some(c=>c.status==='protected'))metrics.firstGuardedDay=day;
    if(metrics.firstDetourDay===null&&(s.counts.quarryDetours||0)>0)metrics.firstDetourDay=day;
    metrics.guardPersonDays+=s.people.filter(p=>p.alive&&p.activity==='quarry_guard').length;
    for(const site of s.mobilityHotspots||[]){
      if(site.kind!=='stone')continue;
      const mineral=s.tiles[site.y*s.width+site.x].mineral;
      if(!mineral||Object.values(mineral.byTown).filter(v=>v>1e-8).length<2)continue;
      if(claims.some(c=>c.site.x===site.x&&c.site.y===site.y&&c.status==='protected'))continue;
      metrics.sharedUnprotectedMineDays++;
    }
    if(SNAPSHOTS.includes(day))snaps.push(snapshot(s,day,metrics));
  }
  const saved=JSON.stringify(s),restored=W.restore(saved);
  if(JSON.stringify(restored)!==saved)throw Error('restore mismatch '+s.seed+'/'+mode);
  W.advanceTicks(s,3);W.advanceTicks(restored,3);
  if(JSON.stringify(restored)!==JSON.stringify(s))throw Error('extra-day replay mismatch '+s.seed+'/'+mode);
  return {seed:s.seed,mode,days,commonGenesisHash:fingerprint(commonGenesis),metrics,snapshots:snaps,
    validation:'validated daily; restore identity; deterministic extra 24h'};
}
return {SEEDS,MODES,SNAPSHOTS,run,snapshot};
});
