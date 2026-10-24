'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),Politics=require('../src/politics.js');
const R=require('../tools/political-agenda-experiment.cjs');
test('without Agenda the current natural world retains exact old trajectory',()=>{
 const src=R.source(),a=W.restore(src.snapshot),b=W.restore(src.snapshot);
 b.politics.diplomacy.union.fracture.agenda={enabled:false};
 for(let k=0;k<9;k++){W.advanceTicks(a,3);W.advanceTicks(b,3);}
 delete b.politics.diplomacy.union.fracture.agenda;
 assert.deepEqual(a,b);assert.deepEqual(W.validate(a).errors,[]);
});
test('real political leader proposes actual unequal export and central grants enforceable veto',()=>{
 const {source,arms}=R.compare();
 const [baseline,enhanced]=arms;
 assert.equal(enhanced.enabled,true);
 assert.equal(baseline.enabled,false);
 assert.equal(enhanced.summary.agenda,'granted');
 assert.ok(enhanced.summary.proposerId);
 assert.ok(enhanced.summary.deciderId);
 assert.notEqual(enhanced.summary.proposerId,enhanced.summary.deciderId);
 assert.ok(enhanced.summary.autonomyUntilHour);
 assert.ok(enhanced.events.some(e=>e.type==='open'));
 assert.ok(enhanced.events.some(e=>e.type==='granted'));
 assert.ok(baseline.summary.realSourceToRecipientShipments.some(q=>q.delivered));
 assert.ok(enhanced.summary.realSourceToRecipientShipments.some(q=>q.delivered));
 assert.equal(baseline.summary.cargoDeliveryAfterFirstShock,1,'baseline really sends one more stone courier');
 assert.equal(enhanced.summary.cargoDeliveryAfterFirstShock,0,'autonomy actually blocks that outbound courier');
 assert.equal(enhanced.summary.unionSurvived,true);
 assert.equal(enhanced.snapshots.at(-1).escrow.donor,0);
 assert.equal(enhanced.snapshots.at(-1).escrow.receiver,0);
});
