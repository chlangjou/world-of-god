'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const Old=require('../tools/oracle-30-core-ratio-sweep.cjs');
const S=require('../config/oracle-specialization-v0.1.json');
const T=require('../config/oracle-core30-cadence-loss-sweep-v0.1.json');
const Sweep=require('../tools/oracle-core30-cadence-loss-sweep.cjs');

test('cadence fixture keeps 15+15 existing core at Devotion 60',()=>{
  const world=Sweep.prepare(),stats=W.stats(world);
  assert.equal(stats.people,30);
  assert.equal(stats.followers,15);
  assert.equal(stats.opponentFollowers,15);
  assert.ok(world.people.every(p=>p.alive&&p.devotion===60));
  assert.equal(world.opponent.turns,0);
  assert.equal(world.religion.oracles.length,0);
  assert.equal(world.opponentReligion.oracles.length,0);
  assert.equal(Sweep.stamp(JSON.stringify(world)),Old.hash(JSON.stringify(world)));
  assert.deepEqual(W.validate(world).errors,[]);
});

test('new repeat-window rule is off in existing v0.1 saved worlds',()=>{
  const before=Old.fixture();
  assert.equal(before.oracleStrategy.counterRepeatIncludesFollowup,undefined);
  assert.equal(W.restore(JSON.stringify(before)).oracleStrategy.counterRepeatIncludesFollowup,
    undefined);
  assert.equal(S.counterRepeatIncludesFollowup,undefined);
  assert.equal(S.counterRepeatDays,10);
  assert.equal(S.counterDoubtStep,8);
});

test('grid includes old follow-up control and 25 configurable combinations',()=>{
  assert.equal(T.runDays,100);
  assert.deepEqual(T.lossPoints,[3,4,5,6,8]);
  assert.deepEqual(T.repeatDays,[7,10,14,21,28]);
  assert.equal(Sweep.CASES.length,26);
  assert.equal(new Set(Sweep.CASES.map(v=>v.name)).size,26);
  assert.ok(Sweep.CASES.some(v=>v.name==='legacy-8pt-10d'&&!v.followupRepeat));
  assert.ok(Sweep.CASES.some(v=>v.name==='5pt-14d'&&v.followupRepeat));
  assert.throws(()=>Sweep.run({only:['not-an-arm']}),/unknown sweep case/);
  assert.throws(()=>Sweep.run({budgetMs:10}),/budget-ms/);
});

test('100 day controlled outcomes obey selected gap even after dropping below 40',()=>{
  const r=Sweep.run({only:['legacy-8pt-10d','5pt-14d','6pt-14d',
    '8pt-10d'],budgetMs:15000});
  assert.deepEqual(r.originalCore,{player:15,AI:15});
  assert.equal(r.days,100);
  assert.equal(r.cases.length,4);
  const cases=Object.fromEntries(r.cases.map(c=>[c.name,c]));
  const legacy=cases['legacy-8pt-10d'];
  const moderate=cases['5pt-14d'];
  const stronger=cases['6pt-14d'];
  const rapid=cases['8pt-10d'];
  assert.equal(legacy.followupUsesSameInterval,false);
  assert.equal(moderate.followupUsesSameInterval,true);
  assert.ok(legacy.summary.AIeverBelow40>moderate.summary.AIeverBelow40);
  assert.ok(moderate.summary.AIeverBelow40>0);
  assert.equal(moderate.summary.AIconverted,0);
  assert.equal(moderate.oracleStopped.AI,null);
  assert.ok(stronger.summary.AIeverBelow40>=moderate.summary.AIeverBelow40);
  assert.ok(rapid.summary.followupDoubts>0);
  for(const arm of r.cases){
    assert.equal(arm.originalCohort.length,30);
    assert.ok(arm.issued.player&&arm.issued.AI);
    assert.equal(arm.checkpoints[0].core40.player,15);
    assert.equal(arm.checkpoints[0].core40.AI,15);
    assert.equal(arm.checkpoints.at(-1).elapsedDays,100);
    assert.ok(arm.checkpoints.every(x=>x.valid));
    assert.ok(arm.originalCohort.every(t=>t.initialDevotion===60));
    if(arm.followupUsesSameInterval){
      assert.equal(arm.summary.invalidGaps,0);
      for(const individual of arm.eventTraces){
        const list=individual.events;
        for(let i=1;i<list.length;i++)
          assert.ok(list[i].hour-list[i-1].hour>=arm.repeatDays*24,
            arm.name+' violated min gap on '+individual.personId);
      }
    }
  }
});
