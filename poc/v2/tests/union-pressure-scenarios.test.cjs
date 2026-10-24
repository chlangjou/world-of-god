'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../tools/union-pressure-scenarios.cjs');
// Small controller fixtures only; full natural-world runs are in the saved report.
function fixture(name='combined_sustained'){
  const context={actorId:'a',peerId:'b',outsideId:'c',actorTownId:'A',peerTownId:'B',outsideTownId:'C'};
  const source={startDay:42,context},sidecar=E.controller(source,name);
  const world={hour:42*24,people:[{id:'person',religionId:'r1',devotion:60}],households:[{id:'home'}],
    settlements:['A','B','C'].map((id,i)=>({id,storage:{stone:(i+1)*4,wood:9,food:50}})),
    politics:{polities:[{id:'a',leaderId:'person'}],
      unions:[{id:'union-1',memberPolityIds:['a','b'],pressure:0,history:[{type:'formed'}]}],
      diplomacy:{union:{fracture:structuredClone(E.DEFAULTS)},relations:[
        {aId:'a',bId:'b',status:'alliance',trust:75},
        {aId:'a',bId:'c',status:'alliance',trust:80,nonAggressionUntilHour:1234},
        {aId:'b',bId:'c',status:'competition',trust:12}]}},rng:12345};
  return {source,world,sidecar};
}
test('scenario interventions preserve union decisions, people, faith, leaders, defaults and RNG',()=>{
  const {world:s,sidecar:c}=fixture(),before=structuredClone({u:s.politics.unions,p:s.people,h:s.households,
    local:s.politics.polities,rng:s.rng,defaults:s.politics.diplomacy.union.fracture,internal:s.politics.diplomacy.relations[0]});
  E.interventions(s,c,1);
  assert.deepEqual({u:s.politics.unions,p:s.people,h:s.households,local:s.politics.polities,rng:s.rng,
    defaults:s.politics.diplomacy.union.fracture,internal:s.politics.diplomacy.relations[0]},before);
  assert.equal(s.politics.diplomacy.relations[1].trust,80);assert.equal(s.politics.diplomacy.relations[1].nonAggressionUntilHour,1234);
  assert.equal(s.politics.diplomacy.relations[1].status,'competition');assert.equal(s.politics.diplomacy.relations[2].status,'peace');
});
test('reserve locks keep ownership and conserve actual stone, including newly produced stocks',()=>{
  const {world:s,sidecar:c}=fixture('resource_sustained'),original=s.settlements.map(t=>t.storage.stone);
  E.interventions(s,c,1);assert.equal(s.settlements[0].storage.stone,0);assert.equal(s.settlements[2].storage.stone,0);
  assert.equal(s.settlements[1].storage.stone,original[1]);
  s.settlements[0].storage.stone+=1.5;E.interventions(s,c,2);
  assert.equal(c.escrow.A,original[0]+1.5);assert.equal(c.escrow.C,original[2]);
  E.interventions(s,c,61);assert.equal(s.settlements[0].storage.stone,original[0]+1.5);
  assert.equal(s.settlements[2].storage.stone,original[2]);assert.ok(Object.values(c.escrow).every(n=>n===0));
  const after=structuredClone(s);E.interventions(s,c,62);assert.deepEqual(s,after,'release is not duplicated');
});
test('transient and sustained cases have fixed exposure terms and identical default gates',()=>{
  const a=fixture('combined_transient'),b=fixture('combined_sustained');
  E.interventions(a.world,a.sidecar,1);E.interventions(b.world,b.sidecar,1);
  assert.equal(a.world.politics.diplomacy.relations[1].renegotiateAfterHour,42*24+14*24);
  assert.equal(b.world.politics.diplomacy.relations[1].renegotiateAfterHour,42*24+60*24);
  assert.deepEqual(a.world.politics.diplomacy.union.fracture,b.world.politics.diplomacy.union.fracture);
  E.interventions(a.world,a.sidecar,15);assert.equal(a.sidecar.escrow.A,0);
});
test('no-intervention control does not change world state',()=>{
  const {world:s,sidecar:c}=fixture('control'),before=structuredClone(s);
  E.interventions(s,c,1);assert.deepEqual(s,before);assert.equal(c.ledger.length,0);assert.equal(c.policies.length,0);
});
test('controller replay includes in-progress escrow and policy terms',()=>{
  const {world:s,sidecar:c}=fixture();E.interventions(s,c,1);
  const restored=JSON.parse(JSON.stringify({s,c}));s.settlements[0].storage.stone=2;restored.s.settlements[0].storage.stone=2;
  E.interventions(s,c,2);E.interventions(restored.s,restored.c,2);
  assert.deepEqual(restored,{s,c});
});
test('changed exit gates, unknown cases and unbounded horizons are rejected',()=>{
  const {world:s,sidecar:c,source}=fixture();s.politics.diplomacy.union.fracture.exitPressure=1;
  assert.throws(()=>E.interventions(s,c,1),/default exit\/breach/);
  assert.throws(()=>E.controller(source,'search-until-split'));
  assert.throws(()=>E.run(source,'control',1000));assert.throws(()=>E.run(source,'control',60));
});
