'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const W=require('../src/sim.js');
const powers=require('../config/divine-powers-v0.1.json');
const same=(s,options)=>({x:s.camp.x,y:s.camp.y,...options});

test('full-month Rain retains 30 simulated-day standard cooldown',()=>{
  const s=W.create({seed:'cooldown-full',divineProfile:powers});
  const full=W.evalRain(s,same(s,{radius:s.rules.defaultRainRadius,
    intensity:s.rules.defaultRainIntensity,durationDays:30}));
  assert.equal(full.ok,true,full.reason);
  assert.equal(full.cooldownDays,30,'full-month standard Rain should preserve the v1 reference');
});

test('wide 5-day Rain must cool substantially faster than a 30-day Rain',()=>{
  const s=W.create({seed:'cooldown-wide',divineProfile:powers});
  const input={radius:14,intensity:1};
  const long=W.evalRain(s,same(s,{...input,durationDays:30}));
  const short=W.evalRain(s,same(s,{...input,durationDays:5}));
  const tiny=W.evalRain(s,same(s,{...input,durationDays:1}));
  assert.ok(long.cooldownDays>short.cooldownDays*2,
    'large radius must not saturate the duration contribution to cooldown');
  assert.ok(short.cooldownDays>tiny.cooldownDays,'shorter duration matters independently of radius');
  assert.ok(short.cooldownDays>=1,'small casts still have anti-spam cooldown');
  assert.ok(short.cost<long.cost,'Rain DP price remains cast-duration dependent');
});

test('duration-scaled Rain cooldown is charged from cast time and freezes when simulation is paused',()=>{
  const s=W.create({seed:'cooldown-actual',divineProfile:powers});
  s.god.dp=s.god.cap;
  const args=same(s,{radius:10,intensity:1,durationDays:5});
  const estimate=W.evalRain(s,args);
  const cast=W.castRain(s,args);
  assert.equal(cast.ok,true,cast.reason);
  const deadline=s.god.skills.rain.readyAtHour;
  assert.equal(deadline-s.hour,Math.round(estimate.cooldownDays*24/8)*8);
  assert.ok(deadline>s.hour+5*24,'cooldown and weather duration are distinct concepts');
  assert.equal(W.castRain(s,args).ok,false,'cannot bypass cooldown by selecting short cast');
  W.advanceTicks(s,3*5);
  assert.ok(!s.effects.some(e=>e.type==='rain'),'rain stops at its selected five-day duration');
  assert.equal(s.god.skills.rain.readyAtHour,deadline,'fixed cooldown deadline is not recomputed');
  assert.equal(W.castRain(s,args).ok,false);
  W.advanceTicks(s,(deadline-s.hour)/s.rules.tickHours);
  assert.equal(s.hour,deadline);
  assert.equal(W.evalRain(s,args).ok,true,'Rain is ready exactly at the computed deadline');
  assert.equal(W.validate(s).ok,true);
});

test('other continuous Miracles use the same duration rule; instant skills ignore duration',()=>{
  const s=W.create({seed:'cooldown-types',divineProfile:powers});
  for(const type of ['ripening','efficiency','drought','confusion','blindness']){
    const short=W.evaluateMiracle(s,type,same(s,{radius:10,intensity:1,durationDays:5}));
    const long=W.evaluateMiracle(s,type,same(s,{radius:10,intensity:1,durationDays:30}));
    assert.ok(short.cooldownDays<long.cooldownDays,type+' must use selected duration');
  }
  for(const type of ['harvest','heal','lightning']){
    const short=W.evaluateMiracle(s,type,same(s,{radius:4,intensity:1,durationDays:5}));
    const long=W.evaluateMiracle(s,type,same(s,{radius:4,intensity:1,durationDays:30}));
    assert.equal(short.durationDays,0,type+' is instantaneous');
    assert.equal(short.cooldownDays,long.cooldownDays,type+' has no duration component');
  }
});

test('Mastery shortens both cooldowns but never makes a 30-day effect equal a 5-day effect',()=>{
  const s=W.create({seed:'cooldown-mastery',divineProfile:powers});
  const center=same(s,{radius:11,intensity:1});
  const novice5=W.evalRain(s,{...center,durationDays:5}).cooldownDays;
  const novice30=W.evalRain(s,{...center,durationDays:30}).cooldownDays;
  s.god.skills.rain.level=5;
  const expert5=W.evalRain(s,{...center,durationDays:5}).cooldownDays;
  const expert30=W.evalRain(s,{...center,durationDays:30}).cooldownDays;
  assert.ok(expert5<novice5&&expert30<novice30);
  assert.ok(expert5<expert30);
});

test('saved cooldown deadline and custom duration-floor parameter survive restore',()=>{
  const custom={...powers,cooldownDurationFloorFraction:.3};
  const s=W.create({seed:'cooldown-save',divineProfile:custom});
  const input=same(s,{radius:8,intensity:1,durationDays:5});
  const normal=W.create({seed:'cooldown-save',divineProfile:powers});
  assert.ok(W.evalRain(s,input).cooldownDays>W.evalRain(normal,input).cooldownDays,
    'tunable floor should raise minimum price of short casts');
  s.god.dp=s.god.cap;
  const result=W.castRain(s,input);
  assert.equal(result.ok,true,result.reason);
  const loaded=W.restore(JSON.stringify(s));
  assert.deepEqual(loaded,s);
  assert.equal(loaded.god.skills.rain.readyAtHour,s.god.skills.rain.readyAtHour);
  assert.equal(loaded.divinePowers.cooldownDurationFloorFraction,.3);
  const ticks=(loaded.god.skills.rain.readyAtHour-loaded.hour)/loaded.rules.tickHours;
  W.advanceTicks(s,ticks);W.advanceTicks(loaded,ticks);
  assert.deepEqual(loaded,s,'save/restore should not shift any simulated cooldown');
});
