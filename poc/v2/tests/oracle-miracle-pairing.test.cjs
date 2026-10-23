'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const R=require('../config/religion-propagation-v0.1.json');
const A=require('../config/balance-agriculture-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const Strategy=require('../config/oracle-specialization-v0.1.json');

function fresh(){
  const s=W.create({seed:'miracle-oracle-counter',balanceProfile:A,
    religionProfile:R,divineProfile:D,opponentProfile:O,
    oracleStrategyProfile:Strategy});
  W.advanceTicks(s,12);
  assert.ok(s.religion.saints.length>0);
  return s;
}
test('four exact Oracle × Miracle pairs boost a credible evidence-response probability 2x',()=>{
  const pairs={'family.nurture':'ripening','food.produce':'harvest',
    'settlement.explore':'heal','religion.spread':'efficiency'};
  assert.deepEqual(W.ORACLE_MIRACLE_COUNTERS,pairs);
  for(const [calling,miracle] of Object.entries(pairs)){
    const s=fresh(),saint=s.religion.saints[0];
    assert.ok(W.issueOracle(s,{saintId:saint,intentType:calling}).ok);
    W.advanceTicks(s,3);
    const p=s.people.find(p=>p.id===saint);
    const paired=W.oracleMiracleResponseChance(s,p,miracle);
    const unpaired=W.oracleMiracleResponseChance(s,p,'lightning');
    assert.equal(paired.match.intent,calling);
    assert.ok(Math.abs(paired.chance-2*unpaired.chance)<1e-10);
  }
});
test('pairing follows receiver actual Oracle, not all residents in a town or expired doctrine',()=>{
  const s=fresh(),saint=s.religion.saints[0];
  const o=W.issueOracle(s,{saintId:saint,intentType:'food.produce'});
  assert.ok(o.ok);
  W.advanceTicks(s,3);
  const holder=s.people.find(p=>p.id===saint);
  assert.equal(W.oracleMiracleResponseChance(s,holder,'harvest').match.oracleId,o.oracleId);
  const rival=s.people.find(p=>p.religionId===s.opponentReligion.id);
  assert.equal(W.oracleMiracleResponseChance(s,rival,'harvest').match,null);
  const next=W.issueOracle(s,{saintId:saint,intentType:'settlement.explore'});
  assert.ok(next.ok);
  assert.equal(W.oracleMiracleResponseChance(s,holder,'harvest').match,null);
  W.advanceTicks(s,3);
  assert.equal(W.oracleMiracleResponseChance(s,holder,'heal').match.intent,'settlement.explore');
});
test('legacy profile without counter flag preserves original deterministic world path',()=>{
  const legacy={...Strategy};
  delete legacy.oracleMiracleCounterEnabled;
  const s=W.create({seed:'miracle-counter-legacy',balanceProfile:A,
    religionProfile:R,divineProfile:D,oracleStrategyProfile:legacy,
    opponentProfile:O});
  W.advanceTicks(s,12);
  const p=s.people.find(x=>x.alive&&x.devotion>=20);
  assert.equal(W.oracleMiracleResponseChance(s,p,'harvest'),null);
  assert.deepEqual(W.validate(s).errors,[]);
});
test('Oracle map excludes unreached towns, and reports actual audience only',()=>{
  const s=fresh(),saint=s.religion.saints[0];
  const res=W.issueOracle(s,{saintId:saint,intentType:'family.nurture'});
  assert.ok(res.ok);
  let m=W.oracleMap(s).filter(x=>x.id===res.oracleId);
  assert.equal(m.length,1);
  assert.equal(m[0].kind,'saint');
  assert.equal(m[0].propagated,false);
  W.advanceTicks(s,3);
  m=W.oracleMap(s).filter(x=>x.id===res.oracleId);
  assert.ok(m.some(x=>x.kind==='saint'&&x.propagated));
  assert.ok(m.filter(x=>x.kind==='town').every(x=>x.listenerCount>=1));
  assert.ok(m.every(x=>x.miracle==='ripening'));
  const previous=W.issueOracle(s,{saintId:saint,intentType:'food.produce'});
  assert.ok(previous.ok);
  assert.equal(W.oracleMap(s).filter(x=>x.id===res.oracleId).length,0);
  assert.deepEqual(W.validate(s).errors,[]);
});
