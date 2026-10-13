'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const S=require('../config/oracle-specialization-v0.1.json');
const fresh=(specialized=true)=>W.create({seed:'oracle-reset-check',
  balanceProfile:A,religionProfile:R,divineProfile:D,
  opponentProfile:{...O,difficulty:'standard'},
  ...(specialized?{oracleStrategyProfile:S}:{})});
const mature=s=>{for(let d=0;d<16&&!s.religion.saints.length;d++)W.advanceTicks(s,3);
  assert.ok(s.religion.saints.length>0,'natural Saint must emerge');return s.religion.saints[0];};
test('strategy flag is opt-in and keeps old Oracle validation',()=>{
  const old=fresh(false),saint=mature(old);
  assert.equal(old.oracleStrategy,undefined);
  assert.equal(W.checkOracle(old,saint,'family.nurture').ok,false);
  assert.equal(W.checkOracle(old,saint,'life.balance').ok,false);
});
test('reset ends one lasting Saint policy without touching people, faith, homes or food',()=>{
  const s=fresh(),saint=mature(s);
  assert.equal(s.oracleStrategy.profileId,'oracle-specialization-v0.1');
  assert.ok(W.checkOracle(s,saint,'food.produce').ok);
  const first=W.issueOracle(s,{saintId:saint,intentType:'family.nurture'});
  assert.equal(first.ok,true);
  const active=s.religion.oracles.find(o=>o.id===first.oracleId);
  assert.equal(active.expiresAtHour,null);
  assert.equal(W.checkOracle(s,saint,'settlement.explore').ok,false);
  const before={people:JSON.stringify(s.people),homes:JSON.stringify(s.households),
    towns:JSON.stringify(s.settlements),hour:s.hour,dp:s.god.dp,
    quota:s.religion.saintQuota[saint].quota};
  const reset=W.issueOracle(s,{saintId:saint,intentType:'life.balance'});
  assert.equal(reset.ok,true);
  assert.equal(reset.reset,true);
  assert.equal(reset.ended,1);
  assert.equal(active.status,'released');
  assert.equal(s.god.dp,before.dp);
  assert.equal(s.religion.saintQuota[saint].quota,before.quota);
  assert.equal(s.hour,before.hour);
  assert.equal(JSON.stringify(s.people),before.people);
  assert.equal(JSON.stringify(s.households),before.homes);
  assert.equal(JSON.stringify(s.settlements),before.towns);
  assert.equal(W.checkOracle(s,saint,'life.balance').ok,false);
  const next=W.issueOracle(s,{saintId:saint,intentType:'settlement.explore'});
  assert.equal(next.ok,true);
  assert.equal(s.religion.saintQuota[saint].quota,before.quota-1);
  W.advanceTicks(s,6);
  assert.equal(s.religion.oracles.filter(o=>o.status==='active'&&o.saintId===saint).length,1);
  assert.ok(W.validate(s).ok);
  assert.equal(JSON.stringify(W.restore(JSON.stringify(s))),JSON.stringify(s));
});
test('three long-term choices are distinct, and a reset is not a free faith attack',()=>{
  for(const type of ['food.produce','family.nurture','settlement.explore']){
    const s=fresh(),saint=mature(s);
    const issue=W.issueOracle(s,{saintId:saint,intentType:type});
    assert.equal(issue.ok,true,type);
    W.advanceTicks(s,6);
    const o=s.religion.oracles.find(v=>v.id===issue.oracleId);
    assert.equal(o.status,'active');
    assert.ok(o.propagatedAtHour!==null);
    const devotees=s.people.map(p=>[p.id,p.religionId,p.devotion]);
    assert.equal(W.issueOracle(s,{saintId:saint,intentType:'life.balance'}).ok,true);
    assert.deepEqual(s.people.map(p=>[p.id,p.religionId,p.devotion]),devotees);
    assert.ok(W.validate(s).ok);
  }
});
test('invalid tuning cannot produce out-of-range pressure or permanent zero quota',()=>{
  const s=W.create({oracleStrategyProfile:{...S,counterContactChance:5,
    counterDoubtStep:999,nurtureConceptionMultiplier:20}});
  assert.equal(s.oracleStrategy.counterContactChance,1);
  assert.equal(s.oracleStrategy.counterDoubtStep,10);
  assert.equal(s.oracleStrategy.nurtureConceptionMultiplier,4);
});

test('visible 40+ counter pressure requires a real rival doctrine, live preaching and results',()=>{
  const s=W.create({seed:'dry-stress',balanceProfile:A,religionProfile:R,
    divineProfile:D,opponentProfile:{...O,difficulty:'standard'},
    oracleStrategyProfile:S});
  for(let d=0;d<45;d++)W.advanceTicks(s,3);
  const original=s.people.filter(p=>p.alive&&p.religionId===s.opponentReligion.id&&p.devotion>=40).map(p=>p.id);
  assert.equal(original.length,12);
  const control=W.restore(JSON.stringify(s));
  assert.equal(W.issueOracle(s,{saintId:s.religion.saints[0],
    intentType:'family.nurture'}).ok,true);
  for(let d=0;d<60;d++){W.advanceTicks(control,3);W.advanceTicks(s,3);}
  const below=original.filter(id=>{
    const p=s.people.find(x=>x.id===id);return p.alive&&p.religionId===s.opponentReligion.id&&p.devotion<40;
  }).length;
  assert.equal(original.filter(id=>control.people.find(p=>p.id===id)?.devotion<40).length,0);
  assert.ok(below>0,'actual AI core must weaken from evidence-driven nurture in this fixed seed');
  assert.ok((s.counts.playerStrategyCoreDoubts||0)>0);
  assert.ok(s.people.some(p=>p.lastStrategyEncounter?.challengerReligionId===s.religion.id));
  assert.equal(s.counts.strategyConversions||0,0,'doubt is not an automatic conversion');
  assert.ok(W.validate(s).ok);
});
