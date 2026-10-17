'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const P=require('../src/playtest.js');
const Mobility=require('../src/mobility.js');
const config=require('../config/mobility-contact-v0.1.json');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const oracle=require('../config/oracle-specialization-v0.1.json');
const playable=require('../config/playable-evidence-v0.1.json');

const create=(profile=config)=>W.create({
  seed:'dry-stress',balanceProfile:agriculture,religionProfile:religion,
  mobilityProfile:profile
});
const duel=(rate)=>P.createWorld(W,{
  mode:'duel',playtestProfile:playable,oracleStrategyProfile:oracle,
  opponentProfile:opponent,religionProfile:religion,balanceProfile:agriculture,
  difficulty:'standard',opponentMode:'ai',
  mobilityProfile:{...config,tripChancePerDay:rate}
});

test('the v0.1 movement profile is opt-in; old saves stay on historical contacts',()=>{
  const previous=W.create({seed:'dry-stress'});
  W.advanceTicks(previous,3*12);
  assert.equal(previous.mobility.enabled,false);
  assert.equal(previous.contactLog.length,0);
  const legacy=JSON.parse(JSON.stringify(previous));
  delete legacy.mobility;
  delete legacy.contactLog;
  const loaded=W.restore(legacy);
  assert.equal(loaded.mobility.enabled,false);
  assert.deepEqual(loaded.contactLog,[]);
  assert.deepEqual(loaded.people,previous.people);
  assert.equal(W.validate(loaded).ok,true);
  assert.equal(Mobility.normalize(config).enabled,true);
  assert.equal(Mobility.BASE.contactRadius,3);
});

test('real, reachable resource visits and same-time <=5-cell encounters occur',()=>{
  const s=create();
  W.advanceTicks(s,3*30);
  assert.equal(W.validate(s).ok,true);
  assert.ok(s.counts.resourceVisitsStarted>0,'work trips must start');
  assert.ok(s.counts.resourceVisitsCompleted>0,'actual travellers must return');
  assert.ok(s.counts.physicalContacts>0,'physical people must meet');
  assert.ok(s.counts.physicalSermons>0,'some encounters create real sermon opportunities');
  for(const person of s.people){
    assert.equal(person.mobilityTrace,undefined,'transient travel traces are never saved');
    if(!person.mobilityTrip)continue;
    const trip=person.mobilityTrip;
    const site=s.tiles[trip.path[trip.path.length-1]];
    assert.notEqual(site.terrain,'river','a water crossing cannot be a resource hotspot');
    for(const cellIndex of trip.path){
      const t=s.tiles[cellIndex];
      assert.ok(t.terrain!=='river'||t.y%s.mobility.fordSpacing===0,
        'travellers cross river cells only at explicit fords');
    }
  }
  const people=new Map(s.people.map(p=>[p.id,p]));
  const pairs=new Set();
  for(const e of s.contactLog){
    assert.ok(e.distance<=5+1e-9,'meeting occurred within five cells');
    assert.ok(e.hour>=s.hour-s.mobility.contactWindowDays*24,
      'expired contacts must be removed');
    assert.notEqual(people.get(e.a).householdId,people.get(e.b).householdId,
      'a house does not count as foreign social contact');
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y),'meeting has real coordinates');
    const key=[e.a,e.b].join('|')+'|'+Math.floor(e.hour/24);
    assert.ok(!pairs.has(key),'same pair counts at most once per day');
    pairs.add(key);
  }
});

test('physical visits, resource transactions and encounters replay after JSON save/restore',()=>{
  const first=create();
  W.advanceTicks(first,3*20);
  const restored=W.restore(JSON.stringify(first));
  assert.equal(restored.mobility.enabled,true);
  assert.ok(restored.contactLog.length>0);
  W.advanceTicks(first,3*10);W.advanceTicks(restored,3*10);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(JSON.stringify(first)));
  assert.equal(W.validate(restored).ok,true);
});

test('same 15:15 world: no trip gives zero cross-faith meetings, trips create attributable doubts but not forced conversion',()=>{
  const inactive=duel(0),active=duel(config.tripChancePerDay);
  for(const s of [inactive,active]){
    const r=W.issueOracle(s,{saintId:s.religion.saints[0],
      intentType:'family.nurture'});
    assert.ok(r.ok,'player must be able to issue a real Oracle');
    assert.equal(s.people.length,30);
    W.advanceTicks(s,3*100);
    assert.equal(W.validate(s).ok,true);
  }
  assert.equal(inactive.counts.resourceVisitsStarted||0,0);
  assert.equal(inactive.counts.crossFaithMeetings||0,0);
  assert.equal(inactive.counts.strategyCoreDoubts||0,0);
  assert.ok(active.counts.resourceVisitsCompleted>0);
  assert.ok(active.counts.crossTownMeetings>0);
  assert.ok(active.counts.crossFaithMeetings>0);
  assert.ok(active.counts.strategyCoreDoubts>0,
    'credible Oracle outcomes must now be capable of reaching opponent core in a natural world');
  assert.ok((active.counts.strategyAttractionEvidence||0)>0,
    'earned attraction must have a real, attributable meeting');
  assert.ok(P.score(active).oldAICoreStill<=15);
  for(const p of active.people.filter(p=>active.playtest.originalRivalIds.includes(p.id)&&
    p.religionId===active.religion.id)){
    assert.ok(p.lastStrategicConversion,'original AI core must not convert from speech alone');
    assert.ok(p.lastStrategicConversion.observations>=active.oracleStrategy.counterAttractionMinEvidence,
      'earned conversion requires credible evidence');
  }
});