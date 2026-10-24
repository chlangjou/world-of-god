'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js');
const {options}=require('../tools/diplomacy-experiment.cjs');
// Controlled fixtures deliberately add contacts and stocks. Natural runs never do.
function fixture(){
  const o=options('valley-spring-01',true);
  o.politicsProfile.diplomacy={...o.politicsProfile.diplomacy,peaceTrust:1,allianceTrust:1,peaceDays:1,shipmentEveryDays:90};
  const s=W.create(o);P.daily(s,()=>{},W.die);
  const [a,b]=s.politics.polities,ta=s.settlements.find(t=>t.id===a.townId),tb=s.settlements.find(t=>t.id===b.townId);
  const pulse=(contact=true)=>{s.hour+=24;s.tick+=3;
    if(contact)s.contactLog.push({hour:s.hour,aTownId:ta.id,bTownId:tb.id,a:'controlled-a',b:'controlled-b'});
    P.daily(s,()=>{},W.die);return P.relation(s,a.id,b.id);};
  return {s,a,b,ta,tb,pulse};
}
test('core faith uses actual 40+ majority, never nominal 20 devotion',()=>{
  const {s,ta}=fixture(),people=s.people.filter(p=>ta.householdIds.includes(p.householdId));
  people.forEach(p=>{p.religionId='r1';p.devotion=20;});assert.equal(P.coreFaith(s,ta).id,null);
  people.forEach(p=>p.devotion=40);assert.equal(P.coreFaith(s,ta).id,'r1');
  people.forEach((p,i)=>{p.religionId='mixed-'+i;});assert.equal(P.coreFaith(s,ta).id,null);
});
test('no physical contact means no treaty; disabled diploma preserves old world',()=>{
  const f=fixture();for(let i=0;i<20;i++)f.pulse(false);
  assert.equal(P.relation(f.s,f.a.id,f.b.id).status,'competition');
  const a=W.create(options('valley-spring-01',false)),o=options('valley-spring-01',false);delete o.politicsProfile.diplomacy;
  const b=W.create(o);W.advanceTicks(a,6);W.advanceTicks(b,6);assert.deepEqual(a,b);
});
test('different and mixed religions can make peace without changing individual faith',()=>{
  const f=fixture();const before=f.s.people.map(p=>[p.id,p.religionId,p.devotion]);
  f.s.people.find(p=>p.id===f.b.leaderId).religionId='controlled-different';
  const changed=f.s.people.map(p=>[p.id,p.religionId,p.devotion]);
  for(let i=0;i<7;i++)f.pulse();
  assert.notEqual(P.relation(f.s,f.a.id,f.b.id).status,'competition');
  assert.deepEqual(f.s.people.map(p=>[p.id,p.religionId,p.devotion]),changed);
  assert.notDeepEqual(before,changed);
});
test('peace withdraws a marching or clashing force and blocks further internal disputes',()=>{
  for(const status of ['marching','clashing']){
    const f=fixture();for(let i=0;i<4;i++)f.pulse();
    f.s.politics.disputes.push({id:'controlled-conflict',aId:f.a.id,bId:f.b.id,status,
      startedAtHour:0,site:{x:f.ta.x,y:f.ta.y}});
    f.a.militia.stance=status==='marching'?'march':'clash';
    f.b.militia.stance=f.a.militia.stance;
    f.pulse();
    assert.equal(f.s.politics.disputes[0].status,'withdrawn');
    assert.equal(f.s.politics.disputes[0].reason,'negotiated-peace');
    assert.notEqual(f.a.militia.stance,'clash');
    for(let i=0;i<14;i++)f.pulse();
    assert.equal(f.s.politics.disputes.filter(c=>[c.aId,c.bId].includes(f.a.id)&&[c.aId,c.bId].includes(f.b.id)).length,1);
  }
});
test('deep conflict history is not erased by a brief shared faith',()=>{
  const f=fixture();for(const p of f.s.people){p.religionId='r1';p.devotion=60;}
  for(let i=0;i<4;i++)f.s.politics.disputes.push({id:'old-'+i,aId:f.a.id,bId:f.b.id,status:'resolved'});
  for(let i=0;i<7;i++)f.pulse();assert.equal(P.relation(f.s,f.a.id,f.b.id).status,'competition');
});
test('aid reserves real stock and an adult, follows walkable path and deposits only on arrival',()=>{
  const f=fixture();f.ta.storage.stone=30;f.tb.storage.stone=0;
  for(let i=0;i<6;i++)f.pulse();
  const q=f.s.politics.diplomacy.shipments.find(q=>q.fromTownId===f.ta.id&&q.toTownId===f.tb.id);
  assert.ok(q);assert.equal(q.status,'outbound');assert.equal(q.delivered,false);
  const r=P.relation(f.s,f.a.id,f.b.id);r.lastShipmentHour=f.s.hour+10000;
  const total=()=>f.ta.storage.stone+f.tb.storage.stone+(q.delivered?0:q.amount);
  const stock=total(),dest=f.tb.storage.stone;
  const p=f.s.people.find(p=>p.id===q.carrierId);assert.ok(P.personDuty(f.s,p));
  assert.equal(p.activity,'transport');assert.ok(!f.a.militia.memberIds.includes(p.id));
  assert.ok(q.path.every(t=>f.s.tiles[t.y*f.s.width+t.x].terrain!=='river'||t.y%f.s.mobility.fordSpacing===0));
  for(let i=0;i<30&&!q.delivered;i++){f.pulse(false);assert.ok(Math.abs(total()-stock)<1e-8);}
  assert.equal(q.delivered,true);assert.equal(f.tb.storage.stone,dest+q.amount);
  const copy=W.restore(JSON.stringify(f.s));assert.deepEqual(copy.politics,f.s.politics);
  f.pulse(false);copy.hour=f.s.hour;copy.tick=f.s.tick;P.daily(copy,()=>{},W.die);
  assert.deepEqual(copy.politics,f.s.politics);assert.deepEqual(copy.people,f.s.people);
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('carrier death accounts for lost cargo; leader death retains peace and local fort',()=>{
  const f=fixture();f.ta.storage.stone=30;f.tb.storage.stone=0;for(let i=0;i<6;i++)f.pulse();
  const q=f.s.politics.diplomacy.shipments[0];assert.ok(q);const to=f.s.settlements.find(t=>t.id===q.toTownId),before=to.storage[q.resource];
  W.die(f.s,q.carrierId,'controlled-courier-death');assert.equal(q.status,'lost');assert.equal(q.lost,q.amount);
  assert.equal(to.storage[q.resource],before);
  const status=P.relation(f.s,f.a.id,f.b.id).status,fort=structuredClone(f.a.watchtower);
  W.die(f.s,f.a.leaderId,'controlled-leader-death');
  assert.equal(f.a.leaderId,null);assert.ok(f.a.vacantUntilHour>=f.s.hour+90*24);
  assert.deepEqual(f.a.watchtower,fort);assert.equal(P.relation(f.s,f.a.id,f.b.id).status,status);
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('demographic departures cannot leave a nonlocal militia or leader behind',()=>{
  const f=fixture(),id=f.a.militia.memberIds[0],p=f.s.people.find(p=>p.id===id),leader=f.s.people.find(p=>p.id===f.a.leaderId);
  f.ta.householdIds=f.ta.householdIds.filter(h=>h!==p.householdId&&h!==leader.householdId);
  P.syncMembership(f.s,()=>{});assert.ok(!f.a.militia.memberIds.includes(id));assert.equal(f.a.leaderId,null);
  assert.deepEqual(P.validate(f.s),[]);
});
test('conversion after alliance never rewrites or automatically dissolves political loyalty',()=>{
  const f=fixture();for(let i=0;i<7;i++)f.pulse();const r=P.relation(f.s,f.a.id,f.b.id);
  assert.equal(r.status,'alliance');
  const people=f.s.people.filter(p=>f.tb.householdIds.includes(p.householdId));
  for(const p of people){p.religionId=f.s.opponentReligion.id;p.devotion=60;}
  const beliefs=people.map(p=>[p.id,p.religionId,p.devotion]);f.pulse();
  assert.equal(r.status,'alliance');assert.deepEqual(people.map(p=>[p.id,p.religionId,p.devotion]),beliefs);
});
test('map and inspector show diplomatic identity and actual transport',async()=>{
  const {boot}=require('./browser-harness.cjs');const ui=await boot({politicsProfile:options('valley-spring-01',true).politicsProfile});
  const s=ui.world();W.advanceTicks(s,6);const [a,b]=s.politics.polities;
  const r=P.relation(s,a.id,b.id);assert.ok(r);r.status='alliance';r.reason='controlled-visible-reason';r.delivered=1.5;
  ui.render();const drawn=ui.draw();assert.ok(drawn.some(x=>x.kind==='fillText'&&String(x.args[0]).includes('互助同盟')));
  assert.match(ui.el('townPanel').innerHTML,/互助同盟|controlled-visible-reason/);
});
