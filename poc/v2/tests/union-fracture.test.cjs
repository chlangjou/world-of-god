'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js'),{options}=require('../tools/diplomacy-experiment.cjs');
// Explicit controlled contacts, reserves and policy disagreement. Not natural incidence.
function fixture(breach=false){
  const o=options('valley-spring-01',true,true,true);o.politicsProfile.disputeEveryDays=90;
  Object.assign(o.politicsProfile.diplomacy,{peaceTrust:1,allianceTrust:1,peaceDays:1,shipmentEveryDays:90});
  Object.assign(o.politicsProfile.diplomacy.union,{allianceDays:1,trust:1,delivered:.1,contactDays:5,maxReluctance:1});
  Object.assign(o.politicsProfile.diplomacy.union.fracture,{minUnionDays:1,exitPressure:4,breachPressure:6,noticeDays:3,breachAmbition:breach?0:1});
  const s=W.create(o);W.advanceTicks(s,3);const [a,b]=s.politics.polities;
  const ta=s.settlements.find(t=>t.id===a.townId),tb=s.settlements.find(t=>t.id===b.townId);
  ta.storage.stone=30;tb.storage.stone=0;
  const pulse=()=>{s.hour+=24;s.tick+=3;s.contactLog.push({hour:s.hour,aTownId:ta.id,bTownId:tb.id,a:'controlled',b:'controlled'});P.daily(s,()=>{},W.die);};
  for(let i=0;i<45&&!P.unionOf(s,a.id);i++)pulse();const u=P.unionOf(s,a.id);assert.ok(u);
  const external=s.politics.polities.find(p=>p.id==='polity-n3'),te=s.settlements.find(t=>t.id===external.townId);
  const crisis=()=>{ta.storage.stone=0;tb.storage.stone=0;te.storage.stone=0;
    Object.assign(P.relation(s,a.id,external.id),{status:'competition',trust:0});
    P.relation(s,b.id,external.id).status='peace';};
  const split=()=>{crisis();for(let i=0;i<20&&!Number.isFinite(u.dissolvedAtHour);i++)pulse();assert.ok(Number.isFinite(u.dissolvedAtHour));return u;};
  return {s,a,b,ta,tb,u,external,te,pulse,crisis,split};
}
test('sustained real resource/treaty conflict gives notice then peaceful exit, preserving all local ownership',()=>{
  const f=fixture();f.crisis();const people=f.s.people.map(p=>[p.id,p.householdId,p.religionId,p.devotion]);
  const heads=f.s.politics.polities.map(p=>p.leaderId),stocks=JSON.stringify(f.s.settlements.map(t=>t.storage));
  for(let i=0;i<3&&!f.u.exitNotice;i++)f.pulse();assert.ok(f.u.exitNotice);assert.equal(P.unionOf(f.s,f.a.id),f.u);
  const until=f.u.exitNotice.deadlineHour;while(f.s.hour<until-24)f.pulse();assert.equal(f.u.dissolvedAtHour,undefined);
  f.pulse();assert.equal(f.u.dissolutionKind,'exit');assert.equal(P.unionOf(f.s,f.a.id),null);
  assert.equal(P.relation(f.s,f.a.id,f.b.id).status,'peace');
  assert.deepEqual(f.s.people.map(p=>[p.id,p.householdId,p.religionId,p.devotion]),people);
  assert.deepEqual(f.s.politics.polities.map(p=>p.leaderId),heads);assert.equal(JSON.stringify(f.s.settlements.map(t=>t.storage)),stocks);
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('short disturbance can be negotiated away; religion changes alone create no exit pressure',()=>{
  const f=fixture();f.crisis();for(let i=0;i<3&&!f.u.exitNotice;i++)f.pulse();assert.ok(f.u.exitNotice);
  f.ta.storage.stone=15;f.tb.storage.stone=15;f.ta.storage.wood=15;f.tb.storage.wood=15;
  f.ta.storage.food=300;f.tb.storage.food=300;
  for(const p of f.s.people.filter(p=>f.tb.householdIds.includes(p.householdId))){p.religionId=f.s.opponentReligion.id;p.devotion=60;}
  for(let i=0;i<6;i++)f.pulse();assert.equal(P.unionOf(f.s,f.a.id),f.u);assert.equal(f.u.exitNotice,null);
  assert.ok(f.u.history.some(e=>e.type==='notice-retracted'));
});
test('ambitious unilateral repudiation breaks treaty but observes a bilateral cooling period',()=>{
  const f=fixture(true);f.split();const r=P.relation(f.s,f.a.id,f.b.id);
  assert.equal(f.u.dissolutionKind,'breach');assert.equal(r.status,'competition');assert.ok(r.grievance>=12);
  const end=r.nonAggressionUntilHour;f.s.politics.disputeEveryDays=1;
  for(let i=0;i<13;i++){f.pulse();assert.ok(f.s.hour<end);
    assert.ok(!f.s.politics.disputes.some(c=>c.startedAtHour>f.u.dissolvedAtHour&&
      [c.aId,c.bId].includes(f.a.id)&&[c.aId,c.bId].includes(f.b.id)));}
  assert.equal(r.status,'competition','contact must not instantly erase breach');
});
test('outbound cargo returns along travelled tiles and refunds once; delivered cargo is never confiscated',()=>{
  const f=fixture();f.crisis();
  const from=f.ta,to=f.tb,carrier=f.s.people.find(p=>from.householdIds.includes(p.householdId)&&
    p.id!==f.a.leaderId&&!f.a.militia.memberIds.includes(p.id)&&!f.s.politics.diplomacy.shipments.some(q=>['outbound','returning'].includes(q.status)&&q.carrierId===p.id));
  assert.ok(carrier);
  // Controlled stock is reserved once; route comes from the actual prior aid trip.
  from.storage.wood=20;from.storage.wood-=2;
  const path=f.s.politics.diplomacy.shipments.find(q=>q.delivered&&q.path.length>8).path.slice().reverse();
  const q={id:'controlled-cargo',aId:f.a.id,bId:f.b.id,fromTownId:from.id,toTownId:to.id,
    carrierId:carrier.id,resource:'wood',amount:2,path,pathIndex:1,status:'outbound',delivered:false,lost:0,startedAtHour:f.s.hour};
  const deliveredBefore=f.s.politics.diplomacy.shipments.filter(q=>q.delivered).map(q=>[q.id,q.amount,q.deliveredAtHour]);
  // Preserve cargo outbound until the last notice day; inject the already reserved cargo then.
  for(let i=0;i<3&&!f.u.exitNotice;i++)f.pulse();
  while(f.s.hour<f.u.exitNotice.deadlineHour-24)f.pulse();
  f.s.politics.diplomacy.shipments.push(q);
  const dest=to.storage.wood,origin=from.storage.wood;f.pulse();assert.equal(q.cancelReason,'union-exit');
  assert.equal(q.status,'returning');assert.equal(to.storage.wood,dest);
  const travelled=q.path.length;assert.ok(travelled<=6,'only already travelled prefix returns');
  for(let i=0;i<8&&q.status!=='complete';i++)f.pulse();assert.equal(q.refunded,true);assert.equal(from.storage.wood,origin+2);
  f.pulse();assert.equal(from.storage.wood,origin+2);
  assert.deepEqual(f.s.politics.diplomacy.shipments.filter(q=>deliveredBefore.some(v=>v[0]===q.id)).map(q=>[q.id,q.amount,q.deliveredAtHour]),deliveredBefore);
});
test('separation cancels existing external command, not just membership labels',()=>{
  const f=fixture();f.crisis();for(let i=0;i<3&&!f.u.exitNotice;i++)f.pulse();
  while(f.s.hour<f.u.exitNotice.deadlineHour-24)f.pulse();
  // While troops are busy, a separate unresolved public-reserve dispute persists.
  f.ta.storage.food=0;f.tb.storage.food=300;
  const c={id:'controlled-active',aId:f.b.id,bId:f.external.id,status:'clashing',
    clashStartedAtHour:f.s.hour-24,roundsCompleted:0,site:{x:f.tb.x,y:f.tb.y}};
  f.s.politics.disputes.push(c);f.b.militia.stance='clash';f.external.militia.stance='clash';
  f.pulse();assert.equal(c.status,'withdrawn');assert.equal(c.reason,'union-exit');assert.equal(c.winnerId,null);
  assert.equal(f.b.militia.stance,'return');assert.equal(f.external.militia.stance,'return');
});
test('archived unions cannot revive on leader death, and save/replay keeps split and cooldown',()=>{
  const f=fixture();f.split();const history=structuredClone(f.u.history);
  W.die(f.s,f.a.leaderId,'controlled-death-after-exit');assert.deepEqual(f.u.history,history);
  const copy=W.restore(JSON.stringify(f.s));assert.deepEqual(copy,f.s);
  W.advanceTicks(f.s,6);W.advanceTicks(copy,6);assert.deepEqual(copy,f.s);
  assert.equal(P.unionOf(f.s,f.b.id),null);assert.deepEqual(W.validate(f.s).errors,[]);
});
test('reunion requires cooldown and fresh delivered cooperation, not the old ledger',()=>{
  const f=fixture();f.split();const r=P.relation(f.s,f.a.id,f.b.id);
  f.ta.storage.stone=15;f.tb.storage.stone=15;f.ta.storage.wood=15;f.tb.storage.wood=15;
  Object.assign(r,{status:'alliance',allianceAtHour:f.s.hour-100*24,trust:100,contactDays:100});
  f.pulse();assert.equal(P.unionOf(f.s,f.a.id),null,'cooldown');
  f.s.hour=r.reunionAfterHour;f.s.tick+=3;f.pulse();assert.equal(P.unionOf(f.s,f.a.id),null,'no fresh delivery');
  const q=f.s.politics.diplomacy.shipments.find(q=>q.delivered);assert.ok(q);
  q.deliveredAtHour=f.s.hour;f.pulse();assert.ok(P.unionOf(f.s,f.a.id));
  assert.equal(f.s.politics.unions.length,2);assert.deepEqual(P.validate(f.s),[]);
});
test('old union saves keep fracture opt-in disabled',()=>{
  const s=W.create(options('valley-spring-01',true,true,false));W.advanceTicks(s,6);
  const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);assert.equal(copy.politics.diplomacy.union.fracture,undefined);
});
test('default thresholds also split a sustained controlled dispute after the full notice period',()=>{
  const f=fixture();f.s.politics.diplomacy.union.fracture={...require('../config/polity-command-v0.1.json').diplomacy.union.fracture};
  f.crisis();for(let i=0;i<70&&!Number.isFinite(f.u.dissolvedAtHour);i++)f.pulse();
  assert.ok(Number.isFinite(f.u.dissolvedAtHour));
  const notice=f.u.history.find(e=>e.type==='exit-notice');assert.ok(notice.evidence.pressure>=24);
  assert.ok(notice.hour-f.u.formedAtHour>=21*24);assert.ok(f.u.dissolvedAtHour-notice.hour>=7*24);
});
test('central death alone creates no resource grievance or automatic dissolution',()=>{
  const f=fixture();for(const t of [f.ta,f.tb])Object.assign(t.storage,{wood:15,stone:15,food:300});
  W.die(f.s,f.u.leaderId,'controlled-central-death');for(let i=0;i<15;i++)f.pulse();
  assert.equal(P.unionOf(f.s,f.a.id),f.u);assert.ok(!f.u.exitNotice);
  assert.ok(Object.values(f.u.interests).every(i=>i.pressure===0));
});
test('a new coalition cannot bypass the former partners non-aggression clock',()=>{
  const f=fixture(true);f.split();
  const u={...structuredClone(f.u),id:'controlled-new-union',memberPolityIds:[f.b.id,f.external.id],
    memberTownIds:[f.tb.id,f.te.id],leaderId:f.b.leaderId,vacantUntilHour:null,formedAtHour:f.s.hour};
  delete u.dissolvedAtHour;delete u.dissolutionKind;f.s.politics.unions.push(u);
  assert.equal(P.offensePolicy(f.s,f.external,f.a).ok,false);
});
test('a quarry still under conflict cooldown is not an actionable veto grievance',()=>{
  const f=fixture();f.crisis();for(const t of [f.ta,f.tb]){t.storage.wood=15;t.storage.food=300;}
  f.s.politics.disputes.push({id:'controlled-recent-war',aId:f.a.id,bId:f.external.id,
    status:'resolved',startedAtHour:f.s.hour,roundsCompleted:0});
  for(let i=0;i<10;i++)f.pulse();assert.equal(f.u.interests[f.a.id].pressure,0);assert.ok(!f.u.exitNotice);
});
test('map drops shared political identity and inspector explains separation',async()=>{
  const f=fixture(true);f.split();const {boot}=require('./browser-harness.cjs');
  const ui=await boot({sim:{...W,create:()=>f.s},politicsProfile:options('valley-spring-01',true,true,true).politicsProfile});
  ui.render();assert.match(ui.el('townPanel').innerHTML,/破約分裂|破約後競爭/);
  const drawn=ui.draw();assert.ok(drawn.some(x=>x.kind==='fillText'&&String(x.args[0]).includes('破約後競爭')));
  assert.ok(!drawn.some(x=>x.kind==='fillText'&&String(x.args[0]).includes('政治聯合 '+f.u.name)));
});
