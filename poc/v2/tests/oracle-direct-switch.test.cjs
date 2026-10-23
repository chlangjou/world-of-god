'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const Strategy=require('../config/oracle-specialization-v0.1.json');

function fresh(){
  const s=W.create({seed:'direct-oracle-switch-v1',balanceProfile:A,
    religionProfile:R,divineProfile:D,oracleStrategyProfile:Strategy,
    opponentProfile:O});
  W.advanceTicks(s,12);
  assert.ok(s.religion.saints.length>0);
  return s;
}
test('same Saint switches Oracle with one issue and no Reset step',()=>{
  const s=fresh(),saintId=s.religion.saints[0];
  const before=s.religion.saintQuota[saintId].quota;
  const old=W.issueOracle(s,{saintId,intentType:'food.produce'});
  assert.ok(old.ok);
  const oldOracle=s.religion.oracles.find(o=>o.id===old.oracleId);
  const dp=s.god.dp,hour=s.hour,people=JSON.stringify(s.people);
  const eligibility=W.checkOracle(s,saintId,'family.nurture');
  assert.ok(eligibility.ok);
  assert.equal(eligibility.replace.length,1);
  const next=W.issueOracle(s,{saintId,intentType:'family.nurture'});
  assert.ok(next.ok);
  assert.equal(next.replaced.length,1);
  assert.equal(next.replaced[0].id,old.oracleId);
  assert.equal(oldOracle.status,'replaced');
  assert.equal(oldOracle.replacedByOracleId,next.oracleId);
  assert.equal(s.religion.oracles.filter(o=>o.status==='active'&&o.saintId===saintId).length,1);
  assert.equal(s.religion.saintQuota[saintId].quota,before-2);
  assert.equal(s.hour,hour);
  assert.equal(s.god.dp,dp);
  assert.equal(JSON.stringify(s.people),people);
  assert.equal(W.checkOracle(s,saintId,'family.nurture').ok,false);
  assert.ok(W.validate(s).ok);
  const copy=W.restore(JSON.stringify(s));
  assert.equal(copy.religion.oracles.find(o=>o.id===old.oracleId).status,'replaced');
  assert.equal(copy.religion.oracles.filter(o=>o.status==='active').length,1);
});
test('insufficient quota preserves old Oracle atomically',()=>{
  const s=fresh(),saintId=s.religion.saints[0];
  const old=W.issueOracle(s,{saintId,intentType:'family.nurture'});
  const quota=s.religion.saintQuota[saintId];
  quota.quota=0;
  const result=W.issueOracle(s,{saintId,intentType:'settlement.explore'});
  assert.equal(result.ok,false);
  assert.equal(s.religion.oracles.find(o=>o.id===old.oracleId).status,'active');
  assert.equal(s.religion.oracles.length,1);
  assert.equal(quota.quota,0);
  const reset=W.issueOracle(s,{saintId,intentType:'life.balance'});
  assert.equal(reset.ok,true);
  assert.equal(s.religion.oracles[0].status,'released');
  assert.equal(quota.quota,0,'free reset still free');
  assert.ok(W.validate(s).ok);
});
