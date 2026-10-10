'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../sim.js');
const fresh = (o={}) => W.create({seed:'valley-spring-01',...o});
const clone = x => JSON.parse(JSON.stringify(x));
function afterDays(s,n) {W.advanceTicks(s,n*3);return s;}
function valid(s){const v=W.validate(s);assert.equal(v.ok,true,v.errors.join('\n'));}
function fields(s){return W.stats(s).avgMoisture;}

test('pure browser API and clean-room game initial state',()=>{
  const s=fresh();assert.equal(s.tiles.length,4096);assert.equal(s.people.length,24);
  assert.equal(s.households.length,8);assert.equal(s.settlements.length,0);
  assert.equal(W.stats(s).followers,3);assert.equal(W.VERSION,'mvp0-web-1');valid(s);
});
test('real households autonomously build houses and establish settlement; no player intervention',()=>{
  const s=fresh();afterDays(s,90);const st=W.stats(s);
  assert.ok(st.houses>=4,'real houses should be built');assert.equal(st.settlements,1);
  assert.ok(s.history.settlementFoundedHour>0);
  assert.ok(s.events.some(e=>e.kind==='housing'));
  assert.ok(s.events.some(e=>e.kind==='settlement'));
  assert.ok(s.metrics.workChoices>0);valid(s);
});
test('world food production is independent of god inputs and inventory never becomes negative',()=>{
  const s=fresh();afterDays(s,100);
  assert.ok(s.counts.foodFromLabor>0);assert.ok(W.stats(s).food>=0);
  for(const h of s.households)for(const qty of Object.values(h.inventory))assert.ok(qty>=0);
  for(const t of s.settlements)for(const qty of Object.values(t.storage))assert.ok(qty>=0);
  valid(s);
});
test('same seed, ruleset and input timestamps produce identical simulation including RNG',()=>{
  function play(){const s=fresh({seed:'deterministic-a'});afterDays(s,18);
    assert.equal(W.issueOracle(s).ok,true);afterDays(s,7);
    const cast=W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:8,intensity:1,durationDays:14});assert.ok(cast.ok);
    afterDays(s,35);return s;}
  assert.deepEqual(play(),play());
});
test('batched fast-forward equals one-tick-at-a-time',()=>{
  const a=fresh(),b=fresh();W.advanceTicks(a,180);for(let i=0;i<180;i++)W.advanceTicks(b,1);
  assert.deepEqual(a,b);
});
test('rain reliably changes physical state, not food inventory; rejects invalid inputs without spending',()=>{
  const a=fresh(),b=fresh();const before=W.stats(a).food;
  const invalid=W.castRain(a,{x:-3,y:3});assert.equal(invalid.ok,false);assert.equal(W.stats(a).food,before);
  assert.equal(a.god.dp,a.rules.initialDp);
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:7,intensity:1,durationDays:31}).ok,false);
  const ok=W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:8,intensity:1,durationDays:12});
  assert.equal(ok.ok,true);assert.ok(a.god.dp<a.rules.initialDp);assert.equal(W.stats(a).food,before);
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y}).ok,false,'independent rain cooldown');
  afterDays(a,10);afterDays(b,10);
  assert.ok(fields(a)>fields(b)+.06,`wetter world expected: ${fields(a)} vs ${fields(b)}`);
  afterDays(a,4);assert.equal(a.effects.length,0,'rain input expires on simulation clock');valid(a);
});
test('spatial Divine Presence derives from weighted actual people, not stored DP',()=>{
  const s=fresh();let original=W.presenceAt(s,s.camp).weighted;
  assert.ok(original>0);s.god.dp=100;
  assert.equal(W.presenceAt(s,s.camp).weighted,original);
  for(const p of s.people){p.devotion=0;p.religionId=null;}
  assert.equal(W.presenceAt(s,s.camp).weighted,0);assert.equal(W.presenceAt(s,s.camp).share,0);
  const dp=s.god.dp;s.god.dp=0;afterDays(s,2);assert.ok(s.god.dp>0,'natural recovery exists without believers');
});
test('devotion thresholds and effective weights are correct',()=>{
  assert.deepEqual([0,19,20,39,40,79,80,89,90,100].map(W.faithfulWeight),[0,0,1,1,2,2,4,4,8,8]);
  const s=fresh();const p=s.people[0];p.devotion=39;
  assert.equal(s.people.filter(x=>x.devotion>=40).length,2);
});
test('Saint is a receiver, Oracle charges Saint quota not DP; transmission is delayed',()=>{
  const s=fresh();afterDays(s,4);const saintId=W.stats(s).saintId;
  assert.ok(saintId);const dp=s.god.dp;
  const attempt=W.issueOracle(s,{saintId:'p3'});assert.equal(attempt.ok,false);
  const issued=W.issueOracle(s,{saintId});assert.equal(issued.ok,true);
  assert.equal(s.god.dp,dp);assert.equal(issued.quotaLeft,3);
  assert.equal(s.religion.oracles[0].propagatedAtHour,null);
  assert.equal(W.issueOracle(s,{saintId}).ok,false,'same Saint active type must be locked');
  afterDays(s,2);
  assert.ok(s.religion.oracles[0].propagatedAtHour!==null);
  assert.ok(s.religion.oracles[0].heardCount>0);
});
test('Oracle can change autonomous work decisions, never forces impossible work',()=>{
  function run(oracle){const s=fresh();afterDays(s,12);
    if(oracle)assert.equal(W.issueOracle(s).ok,true);
    afterDays(s,90);return s;}
  const a=run(false),b=run(true);
  assert.equal(a.metrics.oracleInfluencedChoices,0);
  assert.ok(b.metrics.oracleInfluencedChoices>0,'calling must affect at least one decision');
  assert.ok(b.religion.oracles[0].influenceWorkCount>0);
  assert.ok(b.people.some(p=>p.lastDecision&&p.lastDecision.oracleInfluence>0));
  const test=fresh();afterDays(test,4);W.issueOracle(test);
  for(const t of test.tiles){t.forage=0;t.wood=0;t.fiber=0;t.stone=0;if(t.terrain==='field')t.terrain='meadow';}
  afterDays(test,5);
  assert.ok(test.people.filter(p=>p.stage==='adult').some(p=>p.lastDecision?.work==='rest' || p.lastDecision?.work==='build'));
  valid(test);
});
test('Oracle lifecycle expiry and Saint death do not transfer assignments',()=>{
  const s=fresh();afterDays(s,4);const id=W.stats(s).saintId;
  W.issueOracle(s,{durationDays:3});afterDays(s,4);
  assert.equal(s.religion.oracles[0].status,'expired');
  assert.equal(s.religion.saintQuota[id].quota,3);
  assert.equal(W.issueOracle(s,{durationDays:10}).ok,true);
  assert.equal(W.die(s,id,'測試中受傷離世').ok,true);
  assert.equal(s.religion.oracles[1].status,'saint_dead');
  afterDays(s,4);const successor=W.stats(s).saintId;
  assert.notEqual(successor,id);
  assert.equal(s.religion.oracles[1].status,'saint_dead');valid(s);
});
test('Oracle conclusion overdraw floor -1 and deterministic quota refill',()=>{
  const s=fresh();afterDays(s,4);const id=W.stats(s).saintId;
  assert.equal(W.issueOracle(s).ok,true);
  const quota=s.religion.saintQuota[id];quota.quota=0;
  const o=s.religion.oracles[0];
  assert.deepEqual(W.concludeOracle(s,o.id),{ok:true,quotaLeft:-1});
  assert.equal(W.issueOracle(s).ok,false);
  assert.equal(W.concludeOracle(s,o.id).ok,false);
  afterDays(s,90);assert.equal(quota.quota,0);
  assert.equal(W.issueOracle(s).ok,false);
  afterDays(s,90);assert.equal(quota.quota,1);
  assert.equal(W.issueOracle(s).ok,true);
});
test('rain plus a real answered drought prayer can update devotion once, not per cast',()=>{
  const s=fresh();afterDays(s,21);
  const prayer=s.religion.prayers.find(p=>p.status==='open');assert.ok(prayer,'real prayer should arise from drought/crops');
  const pre=s.people.filter(p=>p.devotion>=40).length;
  const rain=W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:8,intensity:1,durationDays:16});assert.ok(rain.ok);
  afterDays(s,28);
  assert.ok(s.religion.prayers.some(p=>p.status==='answered'),'fulfilled need should be credited');
  const after=s.people.filter(p=>p.devotion>=40).length;
  assert.ok(after>=pre);assert.ok(s.events.some(e=>e.kind==='faith'));
  const first=s.religion.prayers.find(p=>p.status==='answered');
  const faithAfter=s.people.map(p=>p.devotion);
  afterDays(s,1);
  assert.equal(first.status,'answered');
  assert.deepEqual(s.people.map(p=>p.devotion),faithAfter,'no per-tick credit for same need');
});
test('controlled births, death and family coherence',()=>{
  const s=fresh();afterDays(s,4);
  const mother=s.people.find(p=>p.genderRole==='gestate'&&p.stage==='adult');
  const family=s.households.find(h=>h.id===mother.householdId);
  mother.pregnancyDueHour=s.hour+30*24;
  const before=s.people.length;
  afterDays(s,30);
  assert.equal(s.people.length,before+1);assert.equal(s.counts.births,1);
  assert.ok(family.members.includes(s.people[s.people.length-1].id));
  W.die(s,s.people[s.people.length-1].id,'可測試死亡');
  assert.equal(s.counts.deaths,1);valid(s);
});
test('save/reload preserves RNG and active timed effects/Oracle in same ruleset',()=>{
  const a=fresh();afterDays(a,8);W.issueOracle(a);
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:7,durationDays:10}).ok,true);
  const b=W.restore(JSON.stringify(a));
  afterDays(a,40);afterDays(b,40);
  assert.deepEqual(a,b);valid(b);
  assert.throws(()=>W.restore('{"version":"broken"}'));
});
test('controlled food shortage can drive autonomous household relocation',()=>{
  const s=fresh();afterDays(s,14);assert.ok(s.settlements.length);
  for(const t of s.tiles){t.forage=0;if(t.terrain==='field'){t.crop=.02;t.moisture=.03;}}
  for(const h of s.households) h.inventory.food=0;
  s.settlements[0].storage.food=0;
  s.settlements[0].foodShortageDays=29;
  s.settlements[0].workDemand.foodPressure=1;
  // Set a controlled monthly trigger while maintaining the shared clock.
  afterDays(s,16);
  assert.ok(s.counts.relocations>=1,'prolonged shortage should move a household');valid(s);
});
