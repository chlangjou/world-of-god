'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js');
const {options}=require('../tools/diplomacy-experiment.cjs');
// Controlled causal cases: stocks/contact opportunities are explicitly supplied.
function fixture(){
  const o=options('valley-spring-01',true,true);
  o.politicsProfile.disputeEveryDays=90;
  Object.assign(o.politicsProfile.diplomacy,{peaceTrust:1,allianceTrust:1,peaceDays:1,
    shipmentEveryDays:90,union:{enabled:true,allianceDays:1,trust:1,delivered:.1,contactDays:5,recentContactDays:7,maxReluctance:1}});
  const s=W.create(o);W.advanceTicks(s,3);
  const [a,b]=s.politics.polities,ta=s.settlements.find(t=>t.id===a.townId),tb=s.settlements.find(t=>t.id===b.townId);
  ta.storage.stone=30;tb.storage.stone=0;
  const pulse=(contact=true)=>{s.hour+=24;s.tick+=3;
    if(contact)s.contactLog.push({hour:s.hour,aTownId:ta.id,bTownId:tb.id,
      a:s.people.find(p=>ta.householdIds.includes(p.householdId)).id,
      b:s.people.find(p=>tb.householdIds.includes(p.householdId)).id});
    P.daily(s,()=>{},W.die);return P.unionOf(s,a.id);};
  const form=()=>{for(let i=0;i<45&&!P.unionOf(s,a.id);i++)pulse();assert.ok(P.unionOf(s,a.id));return P.unionOf(s,a.id);};
  return {s,a,b,ta,tb,pulse,form};
}
test('actual delivered aid precedes union; local leaders, populations, faith, stocks stay owned locally',()=>{
  const f=fixture(),heads=[f.a.leaderId,f.b.leaderId],people=f.s.people.map(p=>[p.id,p.householdId,p.religionId,p.devotion]);
  const villages=f.s.settlements,localPolities=f.s.politics.polities,storages=[f.ta.storage,f.tb.storage];
  for(let i=0;i<6;i++)f.pulse();assert.equal(f.s.politics.unions.length,0,'in-transit goods cannot prove cooperation');
  const before=f.ta.storage.stone+f.tb.storage.stone+
    f.s.politics.diplomacy.shipments.filter(q=>!q.delivered).reduce((n,q)=>n+(q.resource==='stone'?q.amount:0),0);
  const u=f.form();assert.ok(f.s.politics.diplomacy.shipments.some(q=>q.delivered));
  assert.deepEqual([f.a.leaderId,f.b.leaderId],heads);assert.ok(heads.includes(u.leaderId));
  assert.equal(f.s.settlements,villages);assert.equal(f.s.politics.polities,localPolities);
  assert.equal(f.ta.storage,storages[0]);assert.equal(f.tb.storage,storages[1]);
  assert.ok(Math.abs(f.ta.storage.stone+f.tb.storage.stone-before)<1e-9);
  assert.deepEqual(f.s.people.map(p=>[p.id,p.householdId,p.religionId,p.devotion]),people);
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('contact, elapsed alliance, delivered aid and leader consent each gate union',()=>{
  for(const blocked of ['contact','time','aid','consent']){
    const f=fixture();const cfg=f.s.politics.diplomacy.union;
    if(blocked==='time')cfg.allianceDays=180;
    if(blocked==='aid')cfg.delivered=100;
    if(blocked==='consent')cfg.maxReluctance=0;
    for(let i=0;i<40;i++)f.pulse(blocked!=='contact');
    assert.equal(f.s.politics.unions.length,0,blocked);
  }
});
test('a polity never joins two unions; old diplomacy saves do not silently opt in',()=>{
  const f=fixture(),u=f.form();for(let i=0;i<5;i++)f.pulse();
  assert.equal(f.s.politics.unions.length,1);assert.deepEqual(u.memberTownIds,[f.ta.id,f.tb.id]);
  const legacy=W.create(options('valley-spring-01',true,false));W.advanceTicks(legacy,6);
  const copy=W.restore(JSON.stringify(legacy));assert.deepEqual(copy,legacy);assert.equal(Object.hasOwn(copy.politics,'unions'),false);
  assert.equal(Object.hasOwn(copy.politics.diplomacy,'union'),false);
  const broken=structuredClone(f.s);broken.politics.unions.push({...structuredClone(u),id:'duplicate-members'});
  assert.ok(P.validate(broken).includes('地方政體重複加入聯合'));
});
test('common foreign policy respects every member treaty and permits only one active external sortie',()=>{
  const f=fixture(),u=f.form(),external=f.s.politics.polities.find(p=>!u.memberPolityIds.includes(p.id));
  assert.equal(P.offensePolicy(f.s,f.a,f.b).ok,false);
  const r=P.relation(f.s,f.b.id,external.id);r.status='peace';
  assert.equal(P.offensePolicy(f.s,f.a,external).reason,'共同對外政策尊重成員的和平或同盟');
  r.status='competition';assert.equal(P.offensePolicy(f.s,f.a,external).ok,true);
  f.s.politics.disputes.push({id:'controlled-external',aId:f.a.id,bId:external.id,status:'marching'});
  assert.equal(P.offensePolicy(f.s,f.b,external).reason,'聯合已有對外行動');
});
test('common leader death withdraws both armies; other local command, stores and aid survive',()=>{
  const f=fixture(),u=f.form(),other=[f.a,f.b].find(p=>p.leaderId!==u.leaderId),head=other.leaderId;
  const external=f.s.politics.polities.find(p=>!u.memberPolityIds.includes(p.id));
  const stores=structuredClone(f.s.settlements.map(t=>t.storage)),defense=P.defense(f.s,other,f.s.settlements.find(t=>t.id===other.townId));
  const military=structuredClone(other.militia.memberIds);
  const c={id:'controlled-clash',aId:other.id,bId:external.id,status:'clashing',site:{x:other.militia.x,y:other.militia.y}};
  f.s.politics.disputes.push(c);other.militia.stance='clash';external.militia.stance='clash';
  W.die(f.s,u.leaderId,'controlled-common-leader-death');
  assert.equal(u.leaderId,null);assert.ok((u.vacantUntilHour-f.s.hour)/24>=90&&(u.vacantUntilHour-f.s.hour)/24<=180);
  assert.equal(c.status,'withdrawn');assert.equal(c.reason,'union-command-vacancy');assert.equal(c.winnerId,null);
  assert.equal(other.militia.stance,'return');assert.equal(external.militia.stance,'return');
  assert.equal(other.leaderId,head);assert.deepEqual(other.militia.memberIds,military);
  assert.deepEqual(P.defense(f.s,other,f.s.settlements.find(t=>t.id===other.townId)),defense);
  assert.deepEqual(f.s.settlements.map(t=>t.storage),stores);
  assert.equal(P.offensePolicy(f.s,other,external).reason,'共同指揮真空');
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('real quarry decision records the coordinator and walks one existing local force',()=>{
  const f=fixture(),u=f.form();
  for(const r of f.s.politics.diplomacy.relations)if(![r.aId,r.bId].every(id=>u.memberPolityIds.includes(id))){r.status='competition';r.trust=0;}
  for(const town of f.s.settlements)town.storage.stone=0; // controlled renewed resource shortage
  f.s.politics.disputeEveryDays=1;f.pulse(false);
  const c=f.s.politics.disputes.find(c=>c.aUnionId===u.id||c.bUnionId===u.id);assert.ok(c,'must use actual mapped quarry and paths');
  assert.equal(u.decisions.length,1);assert.equal(u.decisions[0].coordinatorId,u.leaderId);
  const p=f.s.politics.polities.find(p=>p.id===u.decisions[0].representativeId);
  assert.ok(u.memberPolityIds.includes(p.id));assert.equal(p.militia.stance,'march');
  const index=p.militia.pathIndex;f.pulse(false);assert.ok(p.militia.pathIndex>index);
  assert.equal(u.decisions.length,1,'cannot deploy a second member while first is active');
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('a new treaty by one member withdraws another members active external sortie',()=>{
  const f=fixture(),u=f.form(),external=f.s.politics.polities.find(p=>!u.memberPolityIds.includes(p.id));
  const r=P.relation(f.s,f.b.id,external.id);Object.assign(r,{status:'competition',trust:100,contactDays:10,grievance:0});
  const c={id:'controlled-treaty',aId:f.a.id,bId:external.id,status:'marching',site:{x:f.ta.x,y:f.ta.y}};
  f.s.politics.disputes.push(c);f.a.militia.stance='march';external.militia.stance='march';
  const town=f.s.settlements.find(t=>t.id===external.townId);
  f.s.contactLog.push({hour:f.s.hour+24,aTownId:f.tb.id,bTownId:town.id,a:'controlled',b:'controlled'});
  f.pulse(false);assert.equal(r.status,'peace');assert.equal(c.status,'withdrawn');assert.equal(c.reason,'union-member-treaty');
  assert.equal(c.winnerId,null);assert.notEqual(f.a.militia.stance,'march');assert.notEqual(external.militia.stance,'march');
});
test('union succession waits full deterministic vacancy, then elects an actual local leader',()=>{
  const f=fixture(),u=f.form();W.die(f.s,u.leaderId,'controlled-vacancy');
  const until=u.vacantUntilHour,other=[f.a,f.b].find(p=>p.leaderId);assert.ok(other);
  f.s.hour=until-24;P.daily(f.s,()=>{},W.die);assert.equal(u.leaderId,null);
  f.s.hour=until;P.daily(f.s,()=>{},W.die);assert.ok(u.leaderId);
  assert.ok([f.a.leaderId,f.b.leaderId].includes(u.leaderId));assert.equal(u.vacantUntilHour,null);
  assert.deepEqual(W.validate(f.s).errors,[]);
});
test('save/replay during central vacancy preserves union identity and clocks',()=>{
  const f=fixture(),u=f.form();W.die(f.s,u.leaderId,'controlled-vacancy');
  const copy=W.restore(JSON.stringify(f.s));assert.deepEqual(copy,f.s);
  W.advanceTicks(f.s,6);W.advanceTicks(copy,6);assert.deepEqual(copy,f.s);
});
test('conversion does not dissolve union or overwrite local religions',()=>{
  const f=fixture(),u=f.form();for(const p of f.s.people.filter(p=>f.tb.householdIds.includes(p.householdId))){p.religionId=f.s.opponentReligion.id;p.devotion=60;}
  const faith=f.s.people.map(p=>[p.id,p.religionId,p.devotion]);f.pulse();
  assert.equal(P.unionOf(f.s,f.a.id).id,u.id);assert.deepEqual(f.s.people.map(p=>[p.id,p.religionId,p.devotion]),faith);
});
test('leader migration vacates common office without erasing other local leaders',()=>{
  const f=fixture(),u=f.form(),home=[f.a,f.b].find(p=>p.leaderId===u.leaderId),other=[f.a,f.b].find(p=>p!==home),otherId=other.leaderId;
  const p=f.s.people.find(p=>p.id===u.leaderId),town=f.s.settlements.find(t=>t.id===home.townId);
  town.householdIds=town.householdIds.filter(id=>id!==p.householdId);P.syncMembership(f.s,()=>{});
  assert.equal(u.leaderId,null);assert.equal(p.alive,true);assert.equal(other.leaderId,otherId);assert.deepEqual(P.validate(f.s),[]);
});
test('map and inspector show union identity alongside the local leader',async()=>{
  const f=fixture(),u=f.form(),{boot}=require('./browser-harness.cjs');
  const ui=await boot({sim:{...W,create:()=>f.s},politicsProfile:options('valley-spring-01',true,true).politicsProfile});
  ui.render();assert.match(ui.el('townPanel').innerHTML,/政治聯合/);assert.match(ui.el('townPanel').innerHTML,/地方領袖/);
  assert.match(ui.el('townPanel').innerHTML,/各村庫存獨立/);
  assert.ok(ui.draw().some(x=>x.kind==='fillText'&&String(x.args[0]).includes('政治聯合 '+u.name)));
});
