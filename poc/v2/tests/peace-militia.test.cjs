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
test('natural remobilization is delayed, real and replay-valid',()=>{
 const s=W.create(E.options('opponent-competition-replay',true));
 for(let day=1;day<=90;day++){
  W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
  for(const m of s.politics.mobilizations||[]){
   assert.equal(m.readyAtHour-m.startedAtHour,3*24);
   if(m.status==='launched'){
    assert.ok(m.resolvedAtHour>=m.readyAtHour);
    assert.ok(s.politics.disputes.some(c=>c.startedAtHour===m.resolvedAtHour&&
      [c.aId,c.bId].includes(m.aId)&&[c.aId,c.bId].includes(m.bId)));
   }
  }
 }
 assert.ok(s.politics.mobilizations.some(m=>m.status==='launched'));
 const restored=W.restore(JSON.stringify(s));assert.deepEqual(restored,s);
 W.advanceTicks(s,3);W.advanceTicks(restored,3);assert.deepEqual(restored,s);
});
test('peace in the middle of mustering cancels pending attack',()=>{
 const s=W.create(E.options('opponent-competition-replay',true));
 let pending;
 for(let d=0;d<90&&!pending;d++){
  W.advanceTicks(s,3);pending=s.politics.mobilizations?.find(m=>m.status==='forming');
 }
 assert.ok(pending);
 const count=s.politics.disputes.length,r=P.relation(s,pending.aId,pending.bId);
 assert.ok(r);r.status='peace'; // explicit controlled agreement
 W.advanceTicks(s,3);
 assert.equal(pending.status,'cancelled');
 assert.equal(s.politics.disputes.length,count);
 assert.deepEqual(W.validate(s).errors,[]);
});
test('opt-in worlds preserve actual population and map at genesis',()=>{
 const a=W.create(E.options('valley-spring-01',false));
 const b=W.create(E.options('valley-spring-01',true));
 for(const k of ['people','households','settlements','tiles','rng'])assert.deepEqual(a[k],b[k]);
});
