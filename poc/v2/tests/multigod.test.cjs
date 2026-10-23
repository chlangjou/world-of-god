'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const P=require('../src/playtest.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const Strategy=require('../config/oracle-specialization-v0.1.json');
const Playable=require('../config/playable-evidence-v0.1.json');
const Mobility=require('../config/mobility-contact-v0.1.json');
const Shrine=require('../config/shrine-temple-v0.1.json');
const Victory=require('../config/victory-dominance-v0.1.json');

function world(n=3){
  return P.createWorld(W,{mode:'native',godCount:n,
    seed:Playable.native.seed,playtestProfile:Playable,
    oracleStrategyProfile:Strategy,opponentProfile:O,
    balanceProfile:A,religionProfile:R,divineProfile:D,
    mobilityProfile:Mobility,shrineProfile:Shrine,
    victoryProfile:Victory,opponentMode:'ai',difficulty:'standard'});
}
test('2/3/4 deity scenarios share one living world with independent Faith and Divine Power',()=>{
  for(const count of [2,3,4]){
    const s=world(count);
    assert.equal(s.people.length,51);
    assert.equal(s.households.length,17);
    assert.equal(s.victory.contestants.length,count);
    assert.equal(s.additionalReligions?.length||0,count-2);
    assert.equal(s.additionalGods?.length||0,count-2);
    assert.equal(s.additionalOpponents?.length||0,count-2);
    const ids=new Set(s.victory.contestants.map(f=>f.id));
    assert.equal(ids.size,count);
    for(const faith of s.victory.contestants){
      assert.ok(s.people.some(p=>p.alive&&p.religionId===faith.id&&p.devotion>=40));
    }
    assert.deepEqual(W.validate(s).errors,[]);
  }
});
test('all AI Gods actually receive Oracle, spend DP, cast Miracles and persist through save/restore',()=>{
  const s=world(4);
  W.advanceTicks(s,3*130);
  const ais=[s.opponent,...s.additionalOpponents],
    gods=[s.opponentGod,...s.additionalGods];
  for(let i=0;i<ais.length;i++){
    assert.ok(ais[i].turns>0,'AI must make a decision');
    assert.ok(ais[i].oracleIssues>0,'AI must actually issue an Oracle');
    assert.ok(ais[i].casts>0,'AI must cast actual miracles');
    assert.ok(gods[i].dp>=0&&gods[i].dp<=s.rules.maxDp,'DP bounded for each AI');
  }
  const markers=W.oracleMap(s);
  assert.ok(markers.some(m=>m.godId==='g3'&&m.propagated));
  assert.ok(markers.some(m=>m.godId==='g4'&&m.propagated));
  assert.ok(markers.filter(m=>m.kind==='town').every(m=>m.listenerCount>=1));
  assert.ok(markers.every(m=>s.victory.contestants.some(f=>f.godId===m.godId)));
  const snapshot=JSON.stringify(s),copy=W.restore(snapshot);
  assert.deepEqual(W.validate(copy).errors,[]);
  assert.deepEqual(copy.additionalReligionRng,s.additionalReligionRng);
  assert.deepEqual(W.oracleMap(copy),markers);
  W.advanceTicks(copy,3);
  assert.deepEqual(W.validate(copy).errors,[]);
});
test('multigod Victory thresholds do not use two-god constants',()=>{
  for(const [n,limit] of [[2,.55],[3,.4],[4,.325]]){
    const v=W.victoryOverview(world(n));
    assert.equal(v.contestants,n);
    assert.ok(Math.abs(v.teams[0].tiers[0].threshold-limit)<1e-12);
  }
});
