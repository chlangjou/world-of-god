'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const M=require('../src/mobility.js');
const P=require('../src/politics.js');
const Common=require('../tools/mineral-natural-experiment.cjs');
const P2=require('../config/mineral-rights-p2-v0.1.json');
const baseline=seed=>Common.options(seed,'finite-rights-p1-5');
const options=seed=>{
  const opts=baseline(seed);
  return {...opts,politicsProfile:{...opts.politicsProfile,mineralRights:P2.mineralRights}};
};
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
const days=(s,n)=>W.advanceTicks(s,n*3);
function walk(s,from,to){
  const w=s.width,first=from.y*w+from.x,last=to.y*w+to.x;
  const prev=new Int32Array(s.tiles.length);prev.fill(-1);prev[first]=first;
  const queue=[first];
  for(let i=0;i<queue.length&&prev[last]<0;i++){
    const at=queue[i],x=at%w,y=Math.floor(at/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=w||ny>=s.height||
        s.tiles[ny*w+nx].terrain==='river'&&ny%s.mobility.fordSpacing!==0)continue;
      const next=ny*w+nx;
      if(prev[next]>=0)continue;
      prev[next]=at;queue.push(next);
    }
  }
  if(prev[last]<0)return null;
  const path=[];for(let i=last;;i=prev[i]){path.push(i);if(i===first)break;}
  return path.reverse();
}
function controlledIntrusion(s,p,home,path){
  // HUMAN-CONTROLLED FIXTURE: force the itinerary, not an invented person or
  // stock transfer. M.step still follows each traversable edge and guard blocks.
  assert.ok(!p.mobilityTrip);
  p.mobilityTrip={purpose:'resource',path,index:0,phase:'out',siteTicks:0,
    origin:{x:home.x,y:home.y},resourceKind:'stone',cargo:null,startedAtHour:s.hour};
  p.x=home.x;p.y=home.y;
  let seen=null;
  for(let n=0;n<55&&p.mobilityTrip;n++){
    s.hour+=s.rules.tickHours;s.tick++;
    M.step(s,p,()=>{throw Error('blocked miner cannot deliver phantom stone');});
    if(!seen&&p.mobilityTrip?.phase==='site')
      seen=s.politics.quarryEncounters.at(-1);
  }
  assert.equal(p.mobilityTrip,undefined,'resident must walk home after the warning');
  assert.ok(seen&&seen.visitorId===p.id);
  return seen;
}
function startControlledP2(){
  const s=W.create(options('valley-spring-01'));days(s,48);
  const claim=s.politics.quarryClaims.find(c=>c.status==='protected');
  assert.ok(claim,'real initial seed has a physically protected natural mine');
  const mine=s.tiles[claim.site.y*s.width+claim.site.x];
  const choices=s.politics.quarryChoices.filter(q=>q.claimId===claim.id);
  const candidates=s.people.filter(p=>p.alive&&p.stage==='adult'&&p.health>=35&&
    p.settlementId!==claim.townId&&!p.mobilityTrip&&
    !s.politics.polities.some(v=>v.militia.memberIds.includes(p.id))&&
    !(s.politics.quarryClaims||[]).some(c=>c.guardId===p.id))
    .map(p=>{
      const h=s.households.find(h=>h.id===p.householdId);
      const path=h&&walk(s,h,claim.site);
      const choice=choices.find(q=>q.visitorTownId===p.settlementId);
      return {p,h,path,choice};
    }).filter(x=>x.path&&x.path.length-1<=s.mobility.maxTripCells&&x.choice)
    .sort((a,b)=>a.path.length-b.path.length);
  assert.ok(candidates.length,'at least one actual non-militia resident can reach the guard');
  const {p,h,path,choice}=candidates[0];
  // Deliberately controlled hostile political branch: never part of the
  // natural-rate runner. We only force human choice and no existing treaty.
  const owner=s.politics.polities.find(v=>v.townId===claim.townId);
  const challenger=s.politics.polities.find(v=>v.townId===p.settlementId);
  assert.ok(owner&&challenger&&owner.militia.memberIds.length&&challenger.militia.memberIds.length);
  const rel=P.relation(s,owner.id,challenger.id);
  if(rel){rel.status='competition';rel.nonAggressionUntilHour=0;rel.trust=0;rel.grievance=20;}
  s.politics.quarryNegotiations=s.politics.quarryNegotiations.filter(q=>
    !(q.claimId===claim.id&&q.visitorTownId===challenger.townId));
  s.politics.mineralRights.reviewDays=30;
  s.politics.mineralRights.responseDays=1;
  s.politics.mineralRights.escalationChance=1;
  s.politics.mineralRights.truceDays=90;
  s.politics.mineralRights.maxDisputeDays=40;
  choice.action='challenge';choice.decidedAtHour=s.hour;
  const before=mine.mineral.available,oldConflicts=s.politics.disputes.length;
  const warning=controlledIntrusion(s,p,h,path);
  assert.equal(warning.outcome,'guard-warning','first arrival can warn but cannot escalate');
  assert.equal(s.politics.disputes.length,oldConflicts);
  choice.action='challenge';choice.decidedAtHour=s.hour;
  const violated=controlledIntrusion(s,p,h,path);
  assert.equal(violated.outcome,'challenge-resisted');
  assert.equal(violated.priorWarningHour,warning.hour);
  assert.equal(mine.mineral.available,before,'guards did not give away ore');
  s.hour+=24;s.tick+=3; // explicit controlled diplomatic response interval
  choice.decidedAtHour=s.hour; // test forced leader is still considering same real event
  P.quarryConflictDaily(s,()=>{});
  const c=s.politics.disputes.at(-1);
  assert.ok(c&&c.quarryClaimId===claim.id,'only actual warning+violation starts a P2 incident');
  assert.equal(c.trigger,'actual quarry warning then actual disobedience');
  assert.equal(c.aId,challenger.id);assert.equal(c.bId,owner.id);
  assert.equal(s.politics.disputes.length,oldConflicts+1);
  assert.equal(challenger.militia.stance,'march');assert.equal(owner.militia.stance,'march');
  good(s);
  return {s,c,claim,before,oldConflicts};
}
test('P2 is off in all P1.5 worlds, including explicit false',()=>{
  const a=W.create(baseline('valley-spring-01'));
  const opts=baseline('valley-spring-01');
  const b=W.create({...opts,politicsProfile:{...opts.politicsProfile,
    mineralRights:{...opts.politicsProfile.mineralRights,territorialEnabled:false}}});
  assert.deepEqual(a,b);
  days(a,3);days(b,3);assert.deepEqual(a,b);
  assert.equal(a.politics.mineralRights.territorialEnabled,undefined);
  assert.equal(P.normalize({...opts.politicsProfile,mineralRights:P2.mineralRights})
    .mineralRights.territorialEnabled,true);
});
test('natural P2 world cannot start old double-low-stock wars; permit needs a real reachable worker',()=>{
  const s=W.create(options('valley-spring-01'));
  days(s,30);good(s);
  assert.equal(s.politics.disputes.length,0);
  for(const q of s.politics.quarryNegotiations.filter(q=>q.status==='granted')){
    assert.ok(q.reachableMiner?.personId,'not just a political agreement');
    assert.ok(q.reachableMiner.routeCells<=s.mobility.maxTripCells);
  }
  const town=s.settlements[0],mine=s.politics.quarryClaims[0]?.site;
  if(mine){
    const worker=P.reachableQuarryMiner(s,town,mine);
    if(worker)assert.ok(s.people.some(p=>p.id===worker.personId&&p.alive));
  }
  const saved=JSON.stringify(s),restored=W.restore(saved);
  assert.equal(JSON.stringify(restored),saved);
  days(s,1);days(restored,1);assert.deepEqual(restored,s);
});
test('CONTROLLED: two real walked entries are required; bounded battle ends in truce or guarded transfer',()=>{
  const {s,c,claim,oldConflicts}=startControlledP2();
  const loots=s.politics.claims.length;
  let clash=false;
  for(let d=0;d<45&&['marching','clashing'].includes(c.status);d++){
    days(s,1);good(s);
    if(c.status==='clashing'||c.roundsCompleted>0)clash=true;
  }
  assert.ok(!['marching','clashing'].includes(c.status),'no endless territorial stalemate');
  assert.equal(s.politics.disputes.length,oldConflicts+1);
  assert.equal(s.politics.claims.length,loots,'not the old instant 1.5-stone loot');
  assert.ok(c.quarryOutcomeApplied);
  assert.ok(claim.truceUntilHour>s.hour-45*24);
  assert.ok(['resolved','withdrawn'].includes(c.status));
  if(clash&&c.status==='resolved'&&c.winnerId===c.aId){
    assert.equal(claim.townId,c.challengerTownId);
    assert.equal(claim.status==='protected',false,
      'capture alone cannot become an invisible guard');
    assert.equal(s.counts.quarryRightsTransferred,1);
  }else assert.equal(claim.townId,c.priorOwnerTownId);
  const saved=JSON.stringify(s),restore=W.restore(saved);
  assert.equal(JSON.stringify(restore),saved);
  days(s,1);days(restore,1);assert.deepEqual(restore,s);
});
test('CONTROLLED: a real treaty stops marching, with no prize or transfer',()=>{
  const {s,c,claim}=startControlledP2();
  const rel=P.relation(s,c.aId,c.bId);
  assert.ok(rel);
  rel.status='peace';rel.nonAggressionUntilHour=s.hour+90*24;
  days(s,1);good(s);
  assert.equal(c.status,'withdrawn');
  assert.equal(c.reason,'human-treaty-ceasefire');
  assert.equal(claim.townId,c.priorOwnerTownId);
  assert.equal(c.quarryOutcomeApplied,true);
  assert.equal(s.politics.claims.filter(x=>x.site.x===claim.site.x&&x.site.y===claim.site.y).length,0);
});

test('CONTROLLED: real troops can win a 7-day transfer lease; rights revert without teleporting ore',()=>{
  const {s,c,claim,before}=startControlledP2();
  const challenger=s.politics.polities.find(p=>p.id===c.aId);
  const defender=s.politics.polities.find(p=>p.id===c.bId);
  // Bounded decisive-combat fixture: all combatants existed at genesis and
  // marched for real. Only force strength is controlled here, not in natural A/B.
  assert.ok(challenger.militia.memberIds.length>0&&defender.militia.memberIds.length>0);
  s.politics.commandDefense=0;s.politics.watchtowerDefense=0;
  defender.militia.memberIds=defender.militia.memberIds.slice(0,1);
  for(const id of defender.militia.memberIds)
    s.people.find(p=>p.id===id).health=70;
  for(const id of challenger.militia.memberIds)
    s.people.find(p=>p.id===id).health=100;
  s.politics.mineralRights.transferDays=7;
  for(let d=0;d<45&&['marching','clashing'].includes(c.status);d++){
    days(s,1);good(s);
  }
  assert.equal(c.status,'resolved','combat must finish, not silently time out');
  assert.equal(c.winnerId,challenger.id,'existing challenger militia has greater combat strength');
  assert.equal(claim.townId,challenger.townId);
  assert.ok(claim.transferExpiresAtHour>s.hour,'new owner has a finite lease');
  const expiry=claim.transferExpiresAtHour,stoneAtWin=
    s.tiles[claim.site.y*s.width+claim.site.x].mineral.extracted;
  assert.equal(s.counts.quarryRightsTransferred,1);
  assert.equal(claim.status,'declared','no invisible control before guard arrives');
  while(s.hour<=expiry){days(s,1);good(s);}
  assert.equal(claim.townId,c.priorOwnerTownId,'previous title reverts when temporary lease expires');
  assert.equal(claim.transferExpiresAtHour,undefined);
  assert.equal(claim.lastOutcome.kind,'expired');
  assert.equal(s.counts.quarryLeaseExpiries,1);
  assert.ok(s.tiles[claim.site.y*s.width+claim.site.x].mineral.extracted>=stoneAtWin,
    'no rollback or minting of physical ore at expiration');
  const saved=JSON.stringify(s),restored=W.restore(saved);
  assert.equal(JSON.stringify(restored),saved);
  days(restored,1);days(s,1);assert.deepEqual(restored,s);
});
