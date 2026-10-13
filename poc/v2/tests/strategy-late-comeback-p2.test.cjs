'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const A=require('../config/balance-agriculture-v0.1.json');
const R=require('../config/religion-propagation-v0.1.json');
const D=require('../config/divine-powers-v0.1.json');
const O=require('../config/opponent-v0.2.json');
const P=require('../tools/strategy-late-comeback-p2.cjs');

const genesis=()=>W.create({seed:P.SEED,balanceProfile:A,religionProfile:R,
  divineProfile:D,opponentProfile:{...O,difficulty:'standard'}});

test('P2 only allows the short, explicit matched day-300 strategies',()=>{
  assert.equal(P.FORK_DAY,300);
  assert.equal(P.MAX_AFTER_DAYS,120);
  assert.deepEqual(P.STRATEGIES,
    ['passive','frontier-welfare','frontier-offense']);
  assert.deepEqual(P.CHECKPOINTS,[300,330,360,390,420]);
  assert.throws(()=>P.runBranch('', 'made-up'),/Invalid P2 strategy/);
  assert.throws(()=>P.runBranch('', 'passive',{days:121}),/1\.\.120/);
  assert.throws(()=>P.runBranch('', 'passive',{budgetMs:100}),/budget-ms/);
});
test('a Genesis world cannot masquerade as the saved day-300 fork',()=>{
  assert.throws(()=>P.runBranch(JSON.stringify(genesis()),'passive',{days:1}),
    /fixed Day-300 Normal-AI/);
});
test('late action targets and choices are frozen before the resumed world evolves',()=>{
  const s=genesis();
  const welfare0=P.plannedMiracle(s,'frontier-welfare',0);
  assert.equal(welfare0.type,'ripening');
  assert.equal(welfare0.target,'n1');
  const welfare1=P.plannedMiracle(s,'frontier-welfare',1);
  assert.equal(welfare1.type,'rain');
  assert.equal(welfare1.target,'n3');
  assert.equal(P.plannedMiracle(s,'frontier-welfare',4).type,'rain');
  assert.equal(P.plannedMiracle(s,'frontier-offense',0).type,'confusion');
  assert.equal(P.plannedMiracle(s,'frontier-offense',2).type,'lightning');
  assert.equal(P.plannedMiracle(s,'passive',0),null);
  assert.equal(P.plannedMiracle(s,'frontier-offense',5),null);
});
test('snapshot fingerprint is repeatable but explicitly noncryptographic',()=>{
  assert.equal(P.fingerprint('simulated world'),P.fingerprint('simulated world'));
  assert.match(P.fingerprint('simulated world'),/^[0-9a-f]{8}$/);
  assert.notEqual(P.fingerprint('simulated world'),P.fingerprint('different world'));
});
