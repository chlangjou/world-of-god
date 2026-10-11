'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const rival=require('../config/opponent-v0.2.json');
const fresh=(seed='valley-spring-01',options={})=>
  W.create({seed,balanceProfile:agriculture,opponentProfile:rival,...options});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const bank=(s,t)=>Math.max(0,Math.abs(t.x-
  (s.width*.46+Math.sin(t.y*.17)*4+Math.sin(t.y*.052)*5))-1.6);
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
const coverage=(s,t)=>{
  const homes=s.households.filter(h=>t.householdIds.includes(h.id));
  const people=s.people.filter(p=>p.alive&&homes.some(h=>h.members.includes(p.id)));
  const need=people.reduce((n,p)=>n+(p.stage==='child'?s.rules.foodNeedChild:s.rules.foodNeedAdult),0);
  return (t.storage.food+homes.reduce((n,h)=>n+h.inventory.food,0))/Math.max(.01,need);
};

test('three inhabited, unaffiliated native villages predate Gods and work in one shared world',()=>{
  const s=fresh();
  const native=s.settlements.filter(t=>t.native);
  assert.equal(native.length,3);
  assert.equal(s.people.filter(p=>p.nativeOrigin).length,27);
  assert.equal(s.people.filter(p=>p.nativeOrigin&&p.religionId===null).length,27);
  assert.equal(s.people.filter(p=>p.religionId==='r1').length,12);
  assert.equal(s.people.filter(p=>p.religionId==='r2').length,12);
  assert.equal(s.people.length,51);
  assert.ok(native.every(t=>t.foundedAtHour===0&&t.householdIds.length===3));
  assert.ok(native.every(t=>coverage(s,t)>=14));
  assert.ok(dist(s.camp,s.opponentCamp)>=rival.minimumOriginDistance);
  good(s);
});

test('native map geometry offers balanced initial opportunities without placing villages far from water',()=>{
  for(const seed of ['valley-spring-01','calm-river','opponent-competition-replay','dry-stress']){
    const s=fresh(seed);
    const [nearPlayer,nearAI,center]=s.settlements.filter(t=>t.native);
    const playerReach=dist(nearPlayer,s.camp),enemyReach=dist(nearAI,s.opponentCamp);
    assert.ok(Math.abs(playerReach-enemyReach)<=3.6,
      seed+': opposite sides should have comparable access to their native village');
    assert.ok(Math.abs(dist(center,s.camp)-dist(center,s.opponentCamp))<=3,
      seed+': shared middle village must be roughly equidistant');
    for(const village of [nearPlayer,nearAI,center])
      assert.ok(bank(s,village)<=10,seed+': no native settlement beyond river-bank selection limit');
    good(s);
  }
});

test('riskier inland settlement sets a higher autonomous food stockpile goal',()=>{
  const s=fresh(),native=s.settlements.find(t=>t.native);
  W.advanceTicks(s,3);
  const base=native.workDemand.reserveTargetDays;
  const safeFood=coverage(s,native);
  // Move only an existing fixture settlement and its residents; the policy
  // must respond to actual geography, not a hardcoded village name.
  const far=s.tiles.find(t=>t.terrain==='meadow'&&bank(s,t)>17&&t.x<8&&t.y>36);
  assert.ok(far,'test map must contain a genuinely remote arable site');
  native.x=far.x;native.y=far.y;
  for(const h of s.households.filter(h=>native.householdIds.includes(h.id))){
    h.x=far.x;h.y=far.y;
    for(const id of h.members){const p=s.people.find(v=>v.id===id);p.x=far.x;p.y=far.y;}
  }
  W.advanceTicks(s,3);
  assert.ok(native.workDemand.waterRisk>.9);
  assert.ok(native.workDemand.reserveTargetDays>=base+15,
    'a remote native village should autonomously target more days of food');
  assert.ok(native.workDemand.reserveComfortDays>agriculture.workDemand.reserveComfortDays);
  assert.ok(coverage(s,native)>=safeFood-2,'a policy check must not conjure or confiscate food');
  good(s);
});

test('separated origin settlements form autonomously and never share household membership',()=>{
  const s=fresh();W.advanceTicks(s,3*35);
  assert.ok(s.settlements.some(t=>t.id==='s1'));
  assert.ok(s.settlements.some(t=>t.id==='s2'));
  assert.ok(s.settlements.filter(t=>t.native).length===3);
  const joined=s.settlements.flatMap(t=>t.householdIds);
  assert.equal(new Set(joined).size,joined.length);
  assert.ok(s.opponent.casts>0,'AI should function in the separated world');
  good(s);
});

test('extended drought stays survivable at water-screened native starting sites',()=>{
  for(const seed of ['valley-spring-01','calm-river']){
    const balance=JSON.parse(JSON.stringify(agriculture));
    balance.seasons.dryWindows=[[14,61]];
    const s=fresh(seed,{balanceProfile:balance});
    W.advanceTicks(s,3*120);
    assert.equal(s.counts.deaths,0,seed+': no forced deaths in initial 48-day dry season');
    assert.ok(s.settlements.filter(t=>t.native).every(t=>coverage(s,t)>=2),
      seed+': each native village must maintain at least a short real buffer');
    good(s);
  }
});

test('native origins and historical food stocks serialize deterministically',()=>{
  const a=fresh();W.advanceTicks(a,3*70);
  const b=W.restore(JSON.stringify(a));
  assert.deepEqual(b,a);
  W.advanceTicks(a,3*45);W.advanceTicks(b,3*45);
  assert.deepEqual(a,b);
  good(b);
});

test('single God can start in an inhabited native world without retrofitting old saves',()=>{
  const s=W.create({seed:'solo-natives',balanceProfile:agriculture,worldGenesisMode:'native'});
  assert.equal(s.opponent,null);
  assert.equal(W.stats(s).nativeVillages,3);
  assert.equal(W.stats(s).nativePeople,27);
  const original=W.create({seed:'solo-natives',balanceProfile:agriculture});
  assert.equal(W.stats(original).nativePeople,0);
  good(s);good(original);
});
