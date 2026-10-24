'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../tools/union-behavior-comparison.cjs');
const source=B.source('valley-spring-01');
test('same natural pre-formation fork yields actual marching versus a member-treaty veto',()=>{
  const a=B.run(source,'member-treaty',false),b=B.run(source,'member-treaty',true);
  assert.equal(a.sourceHash,b.sourceHash);assert.equal(a.summary.targetIncidents,1);assert.equal(b.summary.targetIncidents,0);
  assert.ok(a.summary.recordedGridDisplacement>0);assert.equal(b.summary.recordedGridDisplacement,0);
  assert.ok(a.summary.actualMilitiaActivityDays.march>0);assert.equal(b.summary.actualMilitiaActivityDays.march,undefined);
  assert.equal(source.target.memberPolityIds.length,2);
});
test('central-vacancy comparison injects exactly the same real death, preserving the independent local actor',()=>{
  const a=B.run(source,'central-vacancy',false),b=B.run(source,'central-vacancy',true);
  assert.equal(a.death.id,b.death.id);assert.equal(a.death.result.ok,true);assert.equal(b.death.result.ok,true);
  assert.equal(a.summary.targetIncidents,1);assert.equal(b.summary.targetIncidents,0);
  assert.ok(b.rows.every(r=>r.locals.find(p=>p.id===b.context.actorId).leader));
});
