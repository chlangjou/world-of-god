'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js');
const E=require('../tools/peace-militia-experiment.cjs');
const profile=require('../config/polity-command-v0.1.json');

test('flag off preserves legacy behavior and deterministic replay',()=>{
 const opts=E.options('valley-spring-01',false),a=W.create(opts);
 const b=W.create({...opts,politicsProfile:{...opts.politicsProfile,peaceMilitia:undefined}});
 assert.deepEqual(a,b);
 for(let i=0;i<8;i++){W.advanceTicks(a,3);W.advanceTicks(b,3);}
 assert.deepEqual(a,b);assert.deepEqual(W.validate(a).errors,[]);
});
test('a real local adult leaves full-time guarding when peace is agreed',()=>{
 const s=W.create(E.options('valley-spring-01',true));
 W.advanceTicks(s,6);
 const [p,q]=s.politics.polities,before=[...p.militia.memberIds];
 assert.equal(before.length,profile.militiaLimit);
 const r=P.relation(s,p.id,q.id);assert.ok(r);
 r.status='peace'; // controlled treaty fixture, NOT natural occurrence
 W.advanceTicks(s,3);
 assert.equal(p.militia.memberIds.length,1);
 const [id]=before.filter(v=>!p.militia.memberIds.includes(v));
 assert.ok(id&&s.people.some(z=>z.id===id&&z.alive));
 assert.equal(P.overview(s,p.townId).militiaCapacity,profile.militiaLimit);
 W.advanceTicks(s,1);
 assert.notEqual(s.people.find(z=>z.id===id).activity,'guard');
 assert.deepEqual(W.validate(s).errors,[]);
});
test('natural prepared rival no longer waits for demobilized counterpart',()=>{
 const s=W.create(E.options('opponent-competition-replay',true));
 for(let day=1;day<=90;day++){
   W.advanceTicks(s,3);
   assert.deepEqual(W.validate(s).errors,[]);
 }
 const hurried=s.politics.disputes.filter(c=>c.readiness);
 assert.ok(hurried.length>0,'actual natural readiness mismatch should be observable');
 assert.ok(hurried.every(c=>c.readiness.availableAtContact<c.readiness.authorizedStrength));
 const restored=W.restore(JSON.stringify(s));
 assert.deepEqual(restored,s);
 W.advanceTicks(s,3);W.advanceTicks(restored,3);
 assert.deepEqual(restored,s);
});
test('opt-in worlds preserve actual population and map at genesis',()=>{
 const a=W.create(E.options('valley-spring-01',false));
 const b=W.create(E.options('valley-spring-01',true));
 for(const k of ['people','households','settlements','tiles','rng'])assert.deepEqual(a[k],b[k]);
});
