'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const W=require('../src/sim.js');
const powers=require('../config/divine-powers-v0.1.json');

test('Heal can cast 1x, 2x, 3x within its own cooldown, and rejects 4x if DP is insufficient',()=>{
  const s=W.create({seed:'overcast-heal',divineProfile:powers});
  s.god.dp=100;
  const p=s.people[0],at={x:p.x,y:p.y,radius:2,intensity:1};
  const costs=[];
  for(let n=1;n<=3;n++){
    p.health=20;
    const preview=W.evaluateMiracle(s,'heal',at);
    assert.equal(preview.costMultiplier,n);
    assert.equal(preview.overcast,n>1);
    assert.equal(preview.cost,n*preview.baseCost);
    costs.push(preview.cost);
    const dp=s.god.dp;
    const result=W.castMiracle(s,'heal',at);
    assert.ok(result.ok,result.reason);
    assert.equal(s.god.dp,dp-result.cost);
    assert.equal(s.god.skills.heal.cooldownCastCount,n);
  }
  p.health=20;
  const next=W.evaluateMiracle(s,'heal',at);
  assert.equal(next.costMultiplier,4);
  assert.equal(next.ok,false);
  const dp=s.god.dp,deadline=s.god.skills.heal.readyAtHour;
  assert.equal(W.castMiracle(s,'heal',at).ok,false);
  assert.equal(s.god.dp,dp);
  assert.equal(s.god.skills.heal.cooldownCastCount,3);
  assert.equal(s.god.skills.heal.readyAtHour,deadline);
  assert.deepEqual(costs,[costs[0],costs[0]*2,costs[0]*3]);
});

test('forced short Rain respects previous long-cast deadline and separate effect lifetimes',()=>{
  const s=W.create({seed:'overcast-rain',divineProfile:powers});
  s.god.dp=100;
  const common={x:s.camp.x,y:s.camp.y,radius:7,intensity:.85};
  const first=W.castRain(s,{...common,durationDays:30});
  assert.ok(first.ok,first.reason);
  const deadline=s.god.skills.rain.readyAtHour;
  const short=W.evalRain(s,{...common,durationDays:5});
  assert.equal(short.costMultiplier,2);
  const forced=W.castRain(s,{...common,durationDays:5});
  assert.ok(forced.ok,forced.reason);
  assert.equal(forced.cost,short.baseCost*2);
  assert.equal(s.god.skills.rain.readyAtHour,deadline,
    'shorter forced cast cannot shorten a prior 30-day deadline');
  assert.equal(s.effects.find(e=>e.id===forced.effectId).endsAtHour-s.hour,120);
  assert.equal(s.god.skills.rain.cooldownCastCount,2);
});

test('forcing Heal does not touch Rain, Harvest or opponent cooldown chains and persists in saves',()=>{
  const s=W.create({seed:'overcast-independent',divineProfile:powers,
    opponentProfile:{profileId:'opponent-v0.1',enabled:true}});
  s.god.dp=100;
  const p=s.people[0],heal={x:p.x,y:p.y,radius:2,intensity:1};
  p.health=25;
  assert.ok(W.castMiracle(s,'heal',heal).ok);
  p.health=25;
  assert.equal(W.castMiracle(s,'heal',heal).costMultiplier,2);
  assert.equal(W.evalRain(s,{x:s.camp.x,y:s.camp.y,radius:7,durationDays:5}).costMultiplier,1);
  assert.equal(W.evaluateMiracle(s,'harvest',heal).costMultiplier,1);
  assert.equal(W.evaluateMiracle(s,'heal',{...heal,godId:'g2'}).costMultiplier,1);
  const restored=W.restore(JSON.stringify(s));
  assert.deepEqual(restored,s);
  W.advanceTicks(s,27);W.advanceTicks(restored,27);
  assert.deepEqual(restored,s);
  assert.equal(s.god.skills.heal.cooldownCastCount,0,'expiry resets cast sequence');
  assert.equal(W.evaluateMiracle(s,'heal',heal).costMultiplier,1);
});

test('legacy active cooldown with missing chain counter means its next cast is 2x',()=>{
  const s=W.create({seed:'legacy-overcast',divineProfile:powers});
  const p=s.people[0],at={x:p.x,y:p.y,radius:2,intensity:1};
  s.god.dp=100;p.health=30;
  assert.ok(W.castMiracle(s,'heal',at).ok);
  delete s.god.skills.heal.cooldownCastCount;
  const old=W.restore(JSON.stringify(s));
  old.people[0].health=30;
  const preview=W.evaluateMiracle(old,'heal',at);
  assert.equal(preview.costMultiplier,2);
  assert.equal(preview.cost,preview.baseCost*2);
  assert.ok(W.castMiracle(old,'heal',at).ok);
  assert.equal(old.god.skills.heal.cooldownCastCount,2);
  assert.equal(W.validate(old).ok,true);
});

test('the opponent God pays its own 2x overcast price, not the player DP',()=>{
  const s=W.create({seed:'opponent-overcast',divineProfile:powers,
    opponentProfile:{profileId:'opponent-v0.1',enabled:true}});
  const p=s.people.find(v=>v.religionId==='r2');
  const at={godId:'g2',x:p.x,y:p.y,radius:2,intensity:1};
  s.opponentGod.dp=100;p.health=25;
  assert.ok(W.castMiracle(s,'heal',at).ok);
  p.health=25;
  const preview=W.evaluateMiracle(s,'heal',at);
  assert.equal(preview.costMultiplier,2);
  const previous=s.opponentGod.dp,human=s.god.dp;
  const forced=W.castMiracle(s,'heal',at);
  assert.equal(forced.ok,true,forced.reason);
  assert.equal(forced.cost,preview.baseCost*2);
  assert.equal(s.opponentGod.dp,previous-forced.cost);
  assert.equal(s.god.dp,human);
  assert.equal(s.god.skills.heal.readyAtHour,0);
  assert.equal(W.validate(s).ok,true);
});
