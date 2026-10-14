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
  // A conversion is allowed after real contacts, repeated doubt and the
  // original low-Devotion conversion gate. It is never automatic on issue.
  assert.ok((s.counts.strategyConversions||0)<=original.length);
  for(const person of s.people.filter(p=>original.includes(p.id)&&
    p.religionId===s.religion.id)){
    assert.ok(person.lastStrategyEncounter?.counterOracleId,
      'converted former core must have witnessed a real counterpart');
  }
  assert.ok(W.validate(s).ok);
});

test('Oracle defenses follow the explicit reciprocal matrix, not an automatic attack',()=>{
  const s=fresh();
  const f=(own,rival)=>W.oracleFaithDefense(s.oracleStrategy,own,rival);
  const pairs=[
    ['family.nurture','food.produce',1.6,.4],
    ['food.produce','settlement.explore',1.6,.4],
    ['settlement.explore','family.nurture',1.6,.4],
    ['family.nurture','default',1.2,.8],
    ['food.produce','default',1.2,.8],
    // No explored rule was given for this matchup: do not invent one.
    ['settlement.explore','default',1,1]
  ];
  for(const [a,b,forward,reverse] of pairs){
    assert.equal(f(a,b),forward,a+' defense against '+b);
    assert.equal(f(b,a),reverse,b+' defense against '+a);
  }
  for(const a of ['default','food.produce','family.nurture','settlement.explore']){
    assert.equal(f(a,a),1,'equal strategies have no intrinsic advantage');
    assert.equal(f(a,'religion.spread'),f(a,'default'),
      'routine spreading is not a fifth defensive attribute');
  }
  assert.equal(W.oracleFaithDefense({},'food.produce','family.nurture'),1);
  assert.equal(W.oracleFaithDefense({...s.oracleStrategy,faithDefenseEnabled:false},
    'food.produce','family.nurture'),1);
});
test('configurable defense safely clamps matrix and cannot alter matching strategies',()=>{
  const s=W.create({oracleStrategyProfile:{...S,
    faithDefenseChanceCeiling:99,
    faithDefenseMatrix:{'food.produce':{
      'family.nurture':0,'food.produce':20,'default':9
    }}}});
  assert.equal(s.oracleStrategy.faithDefenseChanceCeiling,.95);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,'food.produce','family.nurture'),.25);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,'food.produce','food.produce'),1);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,'food.produce','default'),2);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,'family.nurture','food.produce'),1.6);
});
test('issuing a strong Oracle cannot directly debuff or convert a rival core',()=>{
  const s=fresh(),saint=mature(s);
  const prior=s.people.filter(p=>p.alive&&p.religionId===s.opponentReligion.id&&p.devotion>=40)
    .map(p=>[p.id,p.devotion,p.religionId]);
  const issued=W.issueOracle(s,{saintId:saint,intentType:'family.nurture'});
  assert.equal(issued.ok,true);
  assert.deepEqual(s.people.filter(p=>prior.some(x=>x[0]===p.id))
    .map(p=>[p.id,p.devotion,p.religionId]),prior);
  assert.equal(s.counts.strategyCoreDoubts||0,0);
});

test('faith defense rescales only earned contact chance, and clamps extreme values',()=>{
  const s=fresh(),r=s.oracleStrategy;
  const chance=(def,att)=>W.oracleDefenseContactChance(r,def,att);
  const base=r.counterContactChance;
  assert.equal(chance('food.produce','food.produce'),base);
  assert.equal(chance('default','default'),base);
  assert.equal(chance('food.produce','family.nurture'),r.faithDefenseChanceCeiling,
    '0.4 resistance is strong but bounded by the encounter cap');
  assert.equal(chance('family.nurture','food.produce'),base/1.6);
  assert.equal(chance('default','food.produce'),base/.8);
  assert.equal(chance('food.produce','default'),base/1.2);
  assert.ok(chance('food.produce','family.nurture')>
    chance('family.nurture','food.produce'));
  assert.equal(W.oracleDefenseContactChance({...r,faithDefenseEnabled:false},
    'food.produce','family.nurture'),base);
  assert.ok(chance('food.produce','family.nurture')<=.95);
});

test('Reset immediately replaces a weak doctrine defense with neutral defense',()=>{
  const s=fresh(),saint=mature(s);
  const first=W.issueOracle(s,{saintId:saint,intentType:'food.produce'});
  assert.equal(first.ok,true);
  const active=()=>s.religion.oracles.find(o=>o.saintId===saint&&o.status==='active');
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,active()?.intentType,'family.nurture'),.4);
  const snapshot=s.people.map(p=>[p.id,p.religionId,p.devotion]);
  const reset=W.issueOracle(s,{saintId:saint,intentType:'life.balance'});
  assert.equal(reset.ok,true);
  assert.equal(active(),undefined);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,active()?.intentType,'family.nurture'),.8);
  assert.deepEqual(s.people.map(p=>[p.id,p.religionId,p.devotion]),snapshot,
    'Reset adjusts defense but never changes Devotion without an event');
});

test('an earlier v0.1 Oracle save without the opt-in flag keeps prior balancing',()=>{
  const profile={...S};
  delete profile.faithDefenseEnabled;
  delete profile.faithDefenseMatrix;
  const s=W.create({oracleStrategyProfile:profile});
  assert.equal(s.oracleStrategy.faithDefenseEnabled,false);
  assert.equal(W.oracleFaithDefense(s.oracleStrategy,'food.produce','family.nurture'),1);
  assert.equal(W.oracleDefenseContactChance(s.oracleStrategy,'food.produce','family.nurture'),
    profile.counterContactChance);
  const restored=W.restore(JSON.stringify(s));
  assert.equal(restored.oracleStrategy.faithDefenseEnabled,false);
});
