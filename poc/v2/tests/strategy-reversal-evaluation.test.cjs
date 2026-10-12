'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const E=require('../tools/strategy-reversal-evaluation.cjs');

test('P0/P1 runner accepts only bounded days, seeds and the four registered strategies',()=>{
  assert.deepEqual(E.STRATEGIES,['passive','missionary','development','intervention']);
  assert.deepEqual(E.STUDY_SEEDS,['dry-stress','opponent-competition-replay']);
  assert.throws(()=>E.runScenario({seed:'other',days:1}),/Unapproved seed/);
  assert.throws(()=>E.runScenario({strategy:'optimized',days:1}),/Invalid strategy/);
  assert.throws(()=>E.runScenario({days:720}),/P0\/P1 only/);
  assert.throws(()=>E.runScenario({days:180,budgetMs:500}),/budgetMs/);
});

test('the runner maps distinct own-side/frontier/rival native villages at Genesis',()=>{
  for(const seed of E.STUDY_SEEDS){
    const s=W.create({seed,balanceProfile:agriculture,religionProfile:religion,
      divineProfile:divine,opponentProfile:{...opponent,difficulty:'standard'}});
    const plan=E.initialPlan(s);
    assert.deepEqual([plan.own.id,plan.frontier.id,plan.rival.id],['n1','n3','n2']);
  }
});

test('P0 passive dry-stress reference is valid and consumes zero player actions',()=>{
  const result=E.runScenario({seed:'dry-stress',strategy:'passive',days:30,budgetMs:12000});
  assert.equal(result.aborted,false);
  assert.equal(result.valid,true);
  assert.equal(result.ticks,90);
  assert.equal(result.final.player,12);
  assert.equal(result.final.ai,13);
  assert.equal(result.operations.miracleAttempts,0);
  assert.equal(result.operations.oracleAttempts,0);
  assert.equal(result.checks[0].day,0);
  assert.equal(result.checks.at(-1).day,30);
});

test('missionary uses exactly one fixed Miracle slot and one Oracle slot by day 30',()=>{
  const result=E.runScenario({seed:'dry-stress',strategy:'missionary',days:30,budgetMs:12000});
  assert.equal(result.aborted,false);
  assert.equal(result.valid,true);
  assert.equal(result.operations.miracleAttempts,1);
  assert.equal(result.operations.oracleAttempts,1);
  assert.equal(result.operations.samples[0].day,15);
  assert.equal(result.operations.samples[0].type,'religion.spread');
  assert.equal(result.operations.samples[1].day,21);
  assert.equal(result.operations.samples[1].type,'ripening');
});

test('three approaches make distinct, fixed first Miracle attempts without omniscient rerolls',()=>{
  const s=W.create({seed:'dry-stress',balanceProfile:agriculture,
    religionProfile:religion,divineProfile:divine,opponentProfile:opponent});
  const plan=E.initialPlan(s);
  assert.equal(E.miracleCommand(s,'missionary',0,plan).type,'ripening');
  assert.equal(E.miracleCommand(s,'development',0,plan).type,'ripening');
  assert.equal(E.miracleCommand(s,'intervention',0,plan).type,'heal');
  assert.equal(E.miracleCommand(s,'passive',0,plan),null);
  assert.equal(E.miracleCommand(s,'intervention',2,plan).type,'confusion');
  assert.equal(E.miracleCommand(s,'missionary',1,plan).args.x,plan.frontier.x);
});
