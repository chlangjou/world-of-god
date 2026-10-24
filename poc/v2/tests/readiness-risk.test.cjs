'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js'),
 E=require('../tools/peace-militia-experiment.cjs');
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
function genuineConflict(seed){
 const s=W.create(E.options(seed,false));
 for(let day=1;day<=14;day++)W.advanceTicks(s,3);
 const c=s.politics.disputes[0];
 assert.ok(c,'expect the first real, non-injected stone dispute at day 14');
 return c;
}
function understrength(seed){
 const baseline=genuineConflict(seed);
 const s=W.create(E.options(seed,true));
 for(let day=1;day<14;day++)W.advanceTicks(s,3);
 const a=s.politics.polities.find(p=>p.id===baseline.aId),
   b=s.politics.polities.find(p=>p.id===baseline.bId);
 assert.ok(a&&b);
 const third=s.politics.polities.find(p=>p.id!==a.id&&p.id!==b.id&&P.relation(s,a.id,p.id));
 assert.ok(third,'must have an unrelated real village');
 // Controlled non-aggression treaty with a third polity, not with the quarry rival.
 const rel=P.relation(s,a.id,third.id);rel.status='peace';
 W.advanceTicks(s,3); // real day-14 autonomous quarry decision
 const c=s.politics.disputes.find(c=>c.startedAtHour===s.hour&&
   [c.aId,c.bId].includes(a.id)&&[c.aId,c.bId].includes(b.id));
 assert.ok(c,'same real route and mapped quarry must still be contested');
 return {s,a,b,c,third};
}
function bothReserves(seed){
 const baseline=genuineConflict(seed),s=W.create(E.options(seed,true));
 for(let d=1;d<14;d++)W.advanceTicks(s,3);
 const a=s.politics.polities.find(p=>p.id===baseline.aId),
   b=s.politics.polities.find(p=>p.id===baseline.bId);
 const third=s.politics.polities.find(p=>p.id!==a.id&&p.id!==b.id&&
   P.relation(s,a.id,p.id)&&P.relation(s,b.id,p.id));
 assert.ok(third);
 // Two independent local non-aggression treaties, neither with the rival.
 P.relation(s,a.id,third.id).status='peace';
 P.relation(s,b.id,third.id).status='peace';
 W.advanceTicks(s,3);
 const m=s.politics.mobilizations.find(m=>m.status==='forming'&&
   [m.aId,m.bId].includes(a.id)&&[m.aId,m.bId].includes(b.id));
 assert.ok(m,'two genuinely depleted parties must schedule the bounded assembly');
 return {s,a,b,m};
}
for(const seed of SEEDS){
 test(seed+': full-ready rival meets one-person peace reserve on actual quarry route',()=>{
   const {s,a,b,c}=understrength(seed);
   assert.equal(c.status,'marching');
   assert.equal(a.militia.memberIds.length,1,'peace reserve is literally one existing adult');
   assert.equal(b.militia.memberIds.length,2,'unallied rival retains two real adults');
   assert.equal(c.readiness?.understrengthPolityId,a.id);
   assert.equal(c.readiness?.readyPolityId,b.id);
   assert.equal(c.readiness?.availableAtContact,1);
   assert.equal(c.readiness?.authorizedStrength,2);
   assert.equal(c.site.kind,'stone');
   assert.ok(c.site.x>=0&&c.site.x<s.width&&c.site.y>=0&&c.site.y<s.height);
   // Both squads actually walk along a route, no teleporting newly created troop.
   assert.equal(a.militia.stance,'march');assert.equal(b.militia.stance,'march');
   assert.ok(a.militia.path.length>1&&b.militia.path.length>1);
   const ids=[...a.militia.memberIds,...b.militia.memberIds];
   for(const id of ids)assert.ok(s.people.some(p=>p.id===id&&p.alive));
   const snap=W.restore(JSON.stringify(s));assert.deepEqual(snap,s);
   for(let day=0;day<20&&c.status!=='resolved';day++)W.advanceTicks(s,3);
   assert.equal(c.status,'resolved','same battle rules should eventually determine winner');
   assert.equal(c.winnerId,b.id,'the outnumbering group wins without a strength buff');
   assert.ok(c.roundsCompleted>0);
   assert.deepEqual(W.validate(s).errors,[]);
 });
}
test('both real under-strength parties must wait three days and recruit before dispatch',()=>{
 const {s,a,b,m}=bothReserves('opponent-competition-replay');
 assert.equal(a.militia.memberIds.length,1);
 assert.equal(b.militia.memberIds.length,1);
 const before=s.politics.disputes.length;
 for(let d=1;d<3;d++){
   W.advanceTicks(s,3);
   assert.equal(s.politics.disputes.length,before);
 }
 W.advanceTicks(s,3);
 assert.equal(m.status,'launched');
 assert.equal(m.resolvedAtHour,m.readyAtHour);
 assert.equal(a.militia.memberIds.length,2);
 assert.equal(b.militia.memberIds.length,2);
 assert.ok(s.politics.disputes.length>before);
 assert.deepEqual(W.validate(s).errors,[]);
});
test('an actual peace pact cancels a pending two-party assembly',()=>{
 const {s,a,b,m}=bothReserves('opponent-competition-replay');
 const count=s.politics.disputes.length;
 const r=P.relation(s,a.id,b.id);
 assert.ok(r);r.status='peace'; // controlled, not natural treaty formation
 W.advanceTicks(s,3);
 assert.equal(m.status,'cancelled');
 assert.equal(s.politics.disputes.length,count);
 assert.deepEqual(W.validate(s).errors,[]);
});
