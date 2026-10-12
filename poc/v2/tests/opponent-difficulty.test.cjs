'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const W=require('../src/sim.js');
const ag=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=(difficulty='standard',seed='valley-spring-01',profile=opponent)=>W.create({
  seed,balanceProfile:ag,religionProfile:religion,divineProfile:divine,
  opponentProfile:{...profile,difficulty}
});
const days=(s,n)=>{W.advanceTicks(s,3*n);return s;};
const valid=s=>assert.deepEqual(W.validate(s).errors,[]);

test('all difficulty levels start with identical actual people, environment and DP',()=>{
  const easy=fresh('relaxed'),normal=fresh('standard'),original=fresh('challenging');
  assert.equal(normal.opponent.difficulty,'standard');
  assert.deepEqual(easy.people,original.people);
  assert.deepEqual(normal.people,original.people);
  assert.deepEqual(easy.tiles,original.tiles);
  assert.deepEqual(normal.tiles,original.tiles);
  assert.deepEqual(normal.households,original.households);
  assert.equal(easy.opponentGod.dp,opponent.initialDp);
  assert.equal(normal.opponentGod.dp,opponent.initialDp);
  assert.equal(original.opponentGod.dp,opponent.initialDp);
  valid(easy);valid(normal);valid(original);
});

test('AI thinking cadence is graduated; original historical AI is the ceiling',()=>{
  for(const seed of ['valley-spring-01','opponent-competition-replay','calm-river']){
    const easy=days(fresh('relaxed',seed),360),
      normal=days(fresh('standard',seed),360),
      original=days(fresh('challenging',seed),360);
    assert.ok(easy.opponent.turns<normal.opponent.turns);
    assert.ok(normal.opponent.turns<original.opponent.turns);
    assert.equal(original.opponent.turns,29,'original 12-day decision cadence unchanged');
    assert.ok(easy.opponent.casts<=easy.opponent.turns);
    assert.ok(normal.opponent.casts<=normal.opponent.turns);
    assert.ok(original.opponent.casts<=original.opponent.turns);
    valid(easy);valid(normal);valid(original);
  }
});

test('switching difficulty in a live world changes only AI policy',()=>{
  const s=days(fresh('standard'),77),unchanged=clone(s);
  assert.deepEqual(W.setOpponentDifficulty(s,'relaxed'),{ok:true,difficulty:'relaxed'});
  unchanged.opponent.difficulty='relaxed';
  assert.deepEqual(s,unchanged);
  assert.equal(W.setOpponentDifficulty(s,'unknown').ok,false);
  assert.deepEqual(s,unchanged);
  assert.deepEqual(W.setOpponentDifficulty(s,'challenging'),{ok:true,difficulty:'challenging'});
  valid(s);
});

test('difficulty and decisions survive deterministic save/restore and further switching',()=>{
  const s=days(fresh(),100);
  W.setOpponentDifficulty(s,'relaxed');
  const restored=W.restore(JSON.stringify(s));
  assert.deepEqual(restored,s);
  days(s,100);days(restored,100);assert.deepEqual(restored,s);
  W.setOpponentDifficulty(s,'challenging');W.setOpponentDifficulty(restored,'challenging');
  days(s,100);days(restored,100);assert.deepEqual(restored,s);
  valid(restored);
});

test('pre-difficulty v0.2 saves keep their historical AI on restore',()=>{
  const s=days(fresh('challenging'),72);
  delete s.opponent.difficulty;delete s.opponent.difficultyProfiles;
  const previous=clone(s),restored=W.restore(JSON.stringify(s));
  assert.equal(restored.opponent.difficulty,'challenging');
  assert.equal(restored.opponent.lastActionDay,previous.opponent.lastActionDay);
  assert.equal(restored.opponent.turns,previous.opponent.turns);
  assert.equal(restored.opponent.casts,previous.opponent.casts);
  assert.deepEqual(restored.people,previous.people);
  assert.equal(restored.opponentGod.dp,previous.opponentGod.dp);
  valid(restored);
});

test('legacy mixed opponent remains historical AI and no opponent rejects difficulty',()=>{
  const s=W.create({seed:'legacy',balanceProfile:ag,opponentProfile:{
    profileId:'opponent-v0.1',enabled:true,initialHouseholdIndexes:[5,6],
    startDay:14,decisionIntervalDays:12
  }});
  assert.equal(s.opponent.difficulty,'challenging');
  assert.equal(s.opponent.originMode,'mixed');
  const solo=W.create();
  assert.equal(W.setOpponentDifficulty(solo,'relaxed').ok,false);
  valid(s);valid(solo);
});

test('the decision profile is independently tunable without cheating',()=>{
  const custom=clone(opponent);custom.difficultyProfiles.standard.intervalMultiplier=2;
  const s=fresh('standard','tunable-ai',custom);
  assert.equal(s.opponent.difficultyProfiles.standard.intervalMultiplier,2);
  days(s,120);
  assert.ok(s.opponent.turns<10);
  assert.equal(s.opponent.initialDp,opponent.initialDp);
  valid(s);
});
