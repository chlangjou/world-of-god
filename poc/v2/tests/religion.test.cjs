'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const ag=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=(options={})=>W.create({seed:'valley-spring-01',balanceProfile:ag,religionProfile:religion,...options});
const after=(s,days)=>{W.advanceTicks(s,3*days);return s};
const valid=s=>assert.equal(W.validate(s).ok,true);

test('religious adults and local Priests can preach in leisure instead of performing mandated work',()=>{
  const s=fresh();
  after(s,50);
  assert.ok(s.people.some(p=>p.alive&&p.stage==='adult'&&Number.isFinite(p.lastPreachHour)),
    'a non-work sermon must actually occur');
  assert.ok(s.religion.priests.length>=1,'a settlement with actual religious demand supports a Priest');
  valid(s);
});

test('a nearby adult may autonomously adopt after sermons; nonbelievers never appear without sources',()=>{
  const s=fresh();
  for(const p of s.people.filter(p=>['h4','h5'].includes(p.householdId))){p.religionId=null;p.devotion=10}
  after(s,400);
  assert.ok(s.counts.newBelievers>0,'real social activity must spread beyond original households');
  const empty=fresh({seed:'no-faith-anywhere'});
  for(const p of empty.people){p.religionId=null;p.devotion=10}
  after(empty,400);
  assert.equal(W.stats(empty).believers,0);
  assert.equal(empty.counts.newBelievers,0);
  valid(s);valid(empty);
});

test('children with two devout parents develop their own committed faith over years, not at birth',()=>{
  const s=fresh();
  const parents=s.people.filter(p=>['p1','p2'].includes(p.id));
  for(const p of parents){p.religionId='r1';p.devotion=90}
  const child=s.people.find(p=>p.id==='p3');
  child.religionId=null;child.devotion=10;child.age=4;
  assert.equal(child.religionId,null);
  after(s,820);
  assert.equal(child.religionId,'r1');
  assert.ok(child.devotion>=40,'sustained formative experience must allow committed faith');
  assert.ok(child.devotion<=55,'child does not directly inherit 90+ belief from parents');
  valid(s);
});

test('sustained social teaching can cross 40 but cannot create 80+ devotion or convert rivals',()=>{
  const s=fresh();
  const weak=s.people.find(p=>p.id==='p5');
  weak.devotion=39;weak.religionId='r1';
  const rival=s.people.find(p=>p.id==='p8');
  rival.religionId='rival';rival.devotion=61;
  after(s,820);
  assert.ok(weak.devotion>=40,'long-term exposure should cross the former hard ceiling');
  assert.ok(weak.devotion<=religion.ordinaryConsolidationCap,'routine consolidation must remain bounded');
  assert.equal(rival.religionId,'rival');
  assert.equal(rival.devotion,61);
  valid(s);
});

function withSecondSettlement(s){
  after(s,120);
  const original=s.settlements[0];
  assert.ok(original,'actual settlement must exist');
  const homes=s.households.slice(-2);
  const next={...copy(original),id:'s2',name:'試驗拓荒聚落',
    x:Math.min(s.width-3,original.x+19),y:original.y+1,
    foundedAtHour:s.hour,householdIds:homes.map(h=>h.id),
    storage:{food:0,wood:0,stone:0,fiber:0},lastDailyUnmetFood:0,famineDays:0};
  const food=Math.min(60,original.storage.food);
  original.storage.food-=food;next.storage.food=food; // real quantity transfer in fixture
  original.householdIds=original.householdIds.filter(id=>!next.householdIds.includes(id));
  s.settlements.push(next);
  for(const [i,h] of homes.entries()){
    h.x=next.x+i;h.y=next.y;
    for(const id of h.members){
      const p=s.people.find(v=>v.id===id);
      p.x=h.x;p.y=h.y;p.settlementId=next.id;
    }
  }
  return next;
}

test('new settled community forms own Priest; Oracle arrives through a social/clerical relay',()=>{
  const s=fresh();const remote=withSecondSettlement(s);
  const saint=s.people.find(p=>p.id===W.stats(s).saintId);
  const issued=W.issueOracle(s,{saintId:saint.id});
  assert.ok(issued.ok);
  const o=s.religion.oracles.find(v=>v.id===issued.oracleId);
  assert.equal(W.settlementReligionStats(s,remote.id).activeOracles,0);
  after(s,95);
  const local=W.settlementReligionStats(s,remote.id);
  assert.equal(local.population,6);
  assert.equal(local.priests,1);
  assert.equal(local.activeOracles,1);
  assert.ok(o.reachedSettlements[remote.id]);
  const saintAlive=o.status==='active';
  assert.ok(saintAlive);
  assert.ok(s.events.some(e=>e.kind==='oracle'&&e.text.includes(remote.name)));
  const saved=W.restore(JSON.stringify(s));after(saved,28);after(s,28);
  assert.deepEqual(saved,s,'relay state and subsequent social decisions must replay deterministically');
  valid(s);
});

test('Oracle cannot relay to a disconnected settlement, nor remain active after conclusion',()=>{
  const noReach=copy(religion);noReach.interSettlementReach=0;noReach.regionalSaintChancePerMonth=0;
  const s=fresh({religionProfile:noReach});
  const town=withSecondSettlement(s);
  const oracle=W.issueOracle(s);assert.ok(oracle.ok);
  after(s,35);
  const o=s.religion.oracles.find(v=>v.id===oracle.oracleId);
  assert.equal(W.settlementReligionStats(s,town.id).activeOracles,0);
  assert.equal(o.reachedSettlements[town.id],undefined);
  assert.equal(W.concludeOracle(s,oracle.oracleId).ok,true);
  assert.equal(W.settlementReligionStats(s,town.id).activeOracles,0);
  valid(s);
});

test('committed Devotion has no unexplained passive erosion in a single-religion world',()=>{
  const s=fresh({seed:'faith-stability'});
  const stable=s.people.find(p=>p.id==='p1');
  const start=stable.devotion;
  after(s,900);
  assert.equal(stable.devotion,start);
  valid(s);
});

test('older saved v2 worlds gain propagation defaults without changing inventory or people',()=>{
  const s=fresh();
  after(s,80);
  delete s.religionPropagation;delete s.religionRng;delete s.religion.reachedSettlements;
  for(const oracle of s.religion.oracles)delete oracle.reachedSettlements;
  const before=copy({people:s.people,households:s.households,settlements:s.settlements,god:s.god});
  const restored=W.restore(JSON.stringify(s));
  assert.deepEqual({people:restored.people,households:restored.households,settlements:restored.settlements,god:restored.god},before);
  assert.equal(restored.religionPropagation.profileId,religion.profileId);
  assert.ok(restored.religionRng>0);
  const a=W.restore(JSON.stringify(restored)),b=W.restore(JSON.stringify(restored));
  after(a,100);after(b,100);assert.deepEqual(a,b);
  valid(a);
});
