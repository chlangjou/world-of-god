'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const S=require('../config/oracle-specialization-v0.1.json');
const T=require('../config/oracle-30-core-ratio-sweep-v0.1.json');
const X=require('../tools/oracle-30-core-ratio-sweep.cjs');

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,String(a)+' not equal '+String(b));

test('controlled starting world is 30 people, 15:15, all Devotion 60, with two valid towns',()=>{
  const world=X.fixture();
  assert.equal(world.people.length,30);
  assert.equal(world.households.length,10);
  assert.equal(world.settlements.length,2);
  assert.ok(world.people.every(p=>p.alive&&p.devotion===60));
  assert.equal(world.people.filter(p=>p.religionId==='r1').length,15);
  assert.equal(world.people.filter(p=>p.religionId==='r2').length,15);
  assert.ok(world.households.every(h=>h.home));
  assert.ok(world.settlements.every(t=>t.householdIds.length===5));
  assert.ok(world.religion.saints.length&&world.opponentReligion.saints.length);
  assert.ok(world.religion.priests.length&&world.opponentReligion.priests.length);
  assert.deepEqual(W.validate(world).errors,[]);
  assert.equal(W.days(world),10);
  assert.equal(world.opponent.casts,0);
  assert.equal(world.opponent.turns,0);
});

test('extreme defenses are independent and distinguishable with odds scaling',()=>{
  assert.equal(T.runDays,100);
  assert.equal(T.initialPeople,30);
  assert.equal(T.initialDevotion,60);
  const world=X.fixture(),r=world.oracleStrategy;
  assert.equal(r.faithDefenseModel,'odds-scaled');
  for(const [food,nurture] of [[.4,1.6],[.35,2.2],[.3,3],[.25,4],[.2,5.5]]){
    r.faithDefenseMatrix['food.produce']['family.nurture']=food;
    r.faithDefenseMatrix['family.nurture']['food.produce']=nurture;
    close(W.oracleFaithDefense(r,'food.produce','family.nurture'),food);
    close(W.oracleFaithDefense(r,'family.nurture','food.produce'),nurture);
    close(W.oracleDefenseContactChance(r,'food.produce','family.nurture'),
      .45/(.45+food*.55));
    close(W.oracleDefenseContactChance(r,'family.nurture','food.produce'),
      .45/(.45+nurture*.55));
  }
  r.faithDefenseMatrix['food.produce']['family.nurture']=.4;
  const normal=W.oracleDefenseContactChance(r,'food.produce','family.nurture');
  r.faithDefenseMatrix['food.produce']['family.nurture']=.2;
  const extreme=W.oracleDefenseContactChance(r,'food.produce','family.nurture');
  assert.ok(extreme>normal);
  assert.ok(extreme<r.faithDefenseChanceCeiling);
});

test('previous matrix remains linear-clamped and older saves are unchanged',()=>{
  const legacy=W.create({oracleStrategyProfile:S});
  assert.equal(legacy.oracleStrategy.faithDefenseModel,undefined);
  assert.equal(legacy.oracleStrategy.counterDiagnosticsEnabled,undefined);
  const rerun=W.create({oracleStrategyProfile:{...S,faithDefenseMatrix:{
    ...S.faithDefenseMatrix,
    'food.produce':{...S.faithDefenseMatrix['food.produce'],'family.nurture':.2},
    'family.nurture':{...S.faithDefenseMatrix['family.nurture'],'food.produce':5.5}
  }}});
  assert.equal(W.oracleFaithDefense(rerun.oracleStrategy,'food.produce','family.nurture'),.25);
  assert.equal(W.oracleFaithDefense(rerun.oracleStrategy,'family.nurture','food.produce'),2);
  assert.equal(W.oracleDefenseContactChance(rerun.oracleStrategy,'food.produce','family.nurture'),.9);
  assert.equal(W.restore(JSON.stringify(legacy)).oracleStrategy.faithDefenseModel,undefined);
});

test('100-day fixed-strategy controls record real eligibility, not automatic Devotion changes',()=>{
  const baseline=X.fixture();
  const before=baseline.people.map(p=>[p.id,p.devotion,p.religionId]);
  const player=W.issueOracle(baseline,{saintId:baseline.religion.saints[0],intentType:'family.nurture'});
  const AI=W.issueOracle(baseline,{godId:baseline.opponentGod.id,
    saintId:baseline.opponentReligion.saints[0],intentType:'food.produce'});
  assert.ok(player.ok&&AI.ok);
  assert.deepEqual(baseline.people.map(p=>[p.id,p.devotion,p.religionId]),before);
  const testRun=X.run({only:['neutral-1:1','1.6:0.4'],days:100,budgetMs:15000});
  assert.equal(testRun.initialPeople,30);
  assert.deepEqual(testRun.initialCore40,{player:15,AI:15});
  assert.equal(testRun.cases.length,2);
  for(const c of testRun.cases){
    assert.equal(c.checkpoints.length,X.CHECKPOINTS.length);
    assert.ok(c.checkpoints.every(cp=>cp.valid));
    assert.ok(c.checkpoints.at(-1).contact.eligible>0);
    assert.ok(c.checkpoints.at(-1).originalAI.everBelow40>0);
    assert.ok(c.oracleIssued.every(Boolean));
  }
  const neutral=testRun.cases.find(c=>c.name==='neutral-1:1');
  const counter=testRun.cases.find(c=>c.name==='1.6:0.4');
  assert.ok(counter.eligibleContactProbability.foodDefender>
    neutral.eligibleContactProbability.foodDefender);
  assert.ok(counter.eligibleContactProbability.nurtureDefender<
    neutral.eligibleContactProbability.nurtureDefender);
  assert.equal(neutral.checkpoints[0].contact.eligible,0);
});
