'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const Playtest=require('../src/playtest.js');
const Agriculture=require('../config/balance-agriculture-v0.1.json');
const Religion=require('../config/religion-propagation-v0.1.json');
const Divine=require('../config/divine-powers-v0.1.json');
const Opponent=require('../config/opponent-v0.2.json');
const Strategy=require('../config/oracle-specialization-v0.1.json');
const Playable=require('../config/playable-evidence-v0.1.json');
const Mobility=require('../config/mobility-contact-v0.1.json');
const Shrine=require('../config/shrine-temple-v0.1.json');

function fresh(mode='duel'){
  return Playtest.createWorld(W,{
    mode,seed:Playable[mode].seed,playtestProfile:Playable,
    oracleStrategyProfile:Strategy,opponentProfile:Opponent,
    balanceProfile:Agriculture,religionProfile:Religion,
    mobilityProfile:Mobility,divineProfile:Divine,shrineProfile:Shrine,
    opponentMode:'ai',difficulty:'standard'
  });
}
const at=s=>(s.people.filter(p=>p.alive&&p.stage==='adult'&&!p.partnerId));

test('scenario Genesis is balanced and does not fabricate people, faith or homes',()=>{
  const duel=fresh('duel'),native=fresh('native');
  assert.equal(duel.people.length,30);
  assert.equal(duel.households.length,10);
  assert.equal(native.people.length,51);
  assert.equal(native.households.length,17);
  assert.equal(at(duel).length,0,'30-person established Oracle lesson is not re-seeded');
  assert.equal(at(native).length,10,'five real communities each have two unpartnered adults');
  assert.equal(at(native).filter(p=>p.genderRole==='gestate').length,5);
  assert.equal(at(native).filter(p=>p.genderRole==='fertilize').length,5);
  for(const s of [duel,native]){
    const children=s.people.filter(p=>p.alive&&p.stage==='child');
    assert.ok(children.some(p=>p.genderRole==='gestate'));
    assert.ok(children.some(p=>p.genderRole==='fertilize'));
    assert.deepEqual(W.validate(s).errors,[]);
    assert.equal(s.counts.newFamilies,0);
    assert.equal(W.frontierStatus(s).waiting,0);
  }
});

test('outpost requires real independent households and finished homes',()=>{
  const s=fresh('duel'),F=s.agriculture.familyExpansion;
  const town=s.settlements[0],houses=s.households.filter(h=>town.householdIds.includes(h.id)).slice(0,2);
  let loc=null;
  for(let y=5;y<s.height-6&&!loc;y++)for(let x=5;x<s.width-10&&!loc;x++){
    if(s.settlements.every(t=>
      Math.hypot(x-t.x,y-t.y)>s.rules.settlementClusterDistance+8&&
      Math.hypot(x+4-t.x,y-t.y)>s.rules.settlementClusterDistance+8))
      loc={x,y};
  }
  assert.ok(loc,'fixture needs a distinct physical frontier area');
  for(let i=0;i<houses.length;i++){
    const h=houses[i];town.householdIds=town.householdIds.filter(id=>id!==h.id);
    h.x=loc.x+i*4;h.y=loc.y;h.home=false;h.buildProgress=0;
    h.buildMaterialsPaid=false;h.frontierOriginTownId=town.id;
    for(const p of s.people.filter(p=>p.householdId===h.id)){
      p.x=h.x;p.y=h.y;p.settlementId=null;
    }
  }
  const before=s.settlements.length;
  let progress=W.frontierStatus(s);
  assert.equal(progress.waiting,2);
  assert.equal(progress.camps.length,1);
  assert.equal(progress.camps[0].missingHomes,F.outpostMinHuts);
  W.advanceTicks(s,3);
  assert.equal(s.settlements.length,before,'no auto-town from tents alone');
  houses[0].home=true;houses[0].buildMaterialsPaid=true;
  W.advanceTicks(s,3);
  assert.equal(s.settlements.length,before,'one finished hut is insufficient');
  houses[1].home=true;houses[1].buildMaterialsPaid=true;
  W.advanceTicks(s,3);
  assert.equal(s.settlements.length,before+1);
  assert.equal(s.counts.newSettlements,1);
  assert.deepEqual(W.validate(s).errors,[]);
  const restored=W.restore(JSON.stringify(s));
  assert.equal(W.frontierStatus(restored).waiting,0);
  assert.equal(W.frontierStatus(restored).formed,1);
});

test('real native-world growth permits family formation, pioneer departure and settlement founding',()=>{
  const s=fresh('native');
  W.advanceTicks(s,3*240); // bounded 240 days; not a multi-seed balance sweep
  const frontier=W.frontierStatus(s);
  assert.ok(s.counts.newFamilies>=1,'young adults must be able to marry autonomously');
  assert.ok(frontier.departures>=1,'viable existing families must be able to explore');
  assert.ok(s.events.some(e=>e.kind==='migration'&&e.text.includes('自主離開')),
    'outward migration must be attributable to actual families');
  assert.ok(s.events.some(e=>e.kind==='settlement'&&e.text.includes('新拓聚落')&&e.text.includes('戶已建屋')),
    'a physical new village must appear before the two-year mark in this bounded seed');
  assert.deepEqual(W.validate(s).errors,[]);
  const copy=W.restore(JSON.stringify(s));
  assert.deepEqual(W.frontierStatus(copy),frontier);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);
  assert.deepEqual(W.frontierStatus(copy),W.frontierStatus(s),'restore keeps physical town state');
  assert.deepEqual(W.validate(copy).errors,[]);
});

test('non-agriculture legacy worlds keep frontier expansion disabled',()=>{
  const s=W.create({seed:'no-autonomous-frontier'});
  assert.equal(W.frontierStatus(s).enabled,false);
  W.advanceTicks(s,3);
  assert.deepEqual(W.validate(s).errors,[]);
});
