'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const M=require('../src/mobility.js');
const Playtest=require('../src/playtest.js');
const mobility=require('../config/mobility-contact-v0.1.json');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const oracle=require('../config/oracle-specialization-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const playable=require('../config/playable-evidence-v0.1.json');

const fresh=(override={})=>W.create({seed:'dry-stress',
  mobilityProfile:mobility,balanceProfile:agriculture,
  religionProfile:religion,...override});
const duel=()=>Playtest.createWorld(W,{mode:'duel',
  mobilityProfile:mobility,playtestProfile:playable,oracleStrategyProfile:oracle,
  opponentProfile:opponent,religionProfile:religion,balanceProfile:agriculture,
  opponentMode:'ai',difficulty:'standard'});

test('5-cell contact is physical, sparse mineral sites are permanent and visits keep producing actual stores',()=>{
  const s=fresh();
  assert.equal(s.mobility.contactRadius,5);
  assert.equal(s.mobilityHotspots.filter(t=>t.kind==='stone').length,6);
  assert.equal(s.mobilityHotspots.filter(t=>t.kind==='gold').length,2);
  assert.equal(s.tiles.filter(t=>t.terrain!=='river'&&t.stone>0&&!t.resourceNode).length,0);
  const deposits=s.mobilityHotspots.map(({x,y,kind})=>({kind,x,y,
    before:s.tiles[y*s.width+x][kind==='stone'?'stone':'gold']}));
  W.advanceTicks(s,3*20);
  assert.ok(s.counts.rareResourceGathered>0);
  assert.ok(s.counts.resourceVisitsCompleted>0);
  assert.ok(s.counts.physicalContacts>0);
  for(const record of s.contactLog)assert.ok(record.distance<=5+1e-9);
  for(const item of deposits){
    const t=s.tiles[item.y*s.width+item.x];
    assert.equal(t[item.kind==='stone'?'stone':'gold'],item.before,
      'perpetual mineral deposit cannot be consumed');
  }
  const storedGold=s.households.reduce((sum,h)=>sum+(h.inventory.gold||0),0)+
    s.settlements.reduce((sum,t)=>sum+(t.storage.gold||0),0);
  assert.ok(storedGold>0);
  assert.ok(W.validate(s).ok);
});

test('camping injury is nonfatal, checked once per trip, has a long repeat cooldown and responds to Heal',()=>{
  const s=fresh(),p=s.people.find(x=>x.alive&&x.stage==='adult');
  const node=s.mobilityHotspots.find(x=>x.kind==='gold');
  s.hour=24;s.tick=3;s.mobility.campInjuryChance=1;
  p.x=node.x;p.y=node.y;
  const site=s.tiles.findIndex(t=>t.x===node.x&&t.y===node.y);
  const mkTrip=hour=>({path:[site],index:0,phase:'site',siteTicks:1,
    purpose:'resource',resourceKind:'gold',origin:{x:s.households[0].x,y:s.households[0].y},
    cargo:null,startedAtHour:hour});
  p.mobilityTrip=mkTrip(0);p.health=100;
  M.step(s,p,()=>{});
  assert.ok(p.campInjury);
  assert.ok(p.health>=s.mobility.campInjuryMinHealth&&p.health<100);
  const after=p.health;
  M.step(s,p,()=>{});M.step(s,p,()=>{});
  assert.equal(p.health,after,'no repeated hit in one camp');
  p.mobilityTrip=mkTrip(18);
  M.step(s,p,()=>{});
  assert.equal(p.health,after,'new camp within injury cooldown cannot strike again');
  const healed=W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:2,intensity:2});
  assert.ok(healed.ok,healed.reason);
  assert.equal(p.health,100);
  assert.equal(p.campInjury.recoveredAtHour,s.hour);
  const weak=s.people.find(q=>q.id!==p.id&&q.stage==='adult');
  weak.x=node.x;weak.y=node.y;weak.health=50;weak.mobilityTrip=mkTrip(0);
  M.step(s,weak,()=>{});
  assert.equal(weak.health,50,'camping must never heal an already-injured citizen');
  assert.ok(W.validate(s).ok);
});

test('spread Oracle has 1.4:0.6 protection and physical missionary travel, while default is 1.2:0.8',()=>{
  const s=fresh({oracleStrategyProfile:oracle});
  const matrix=(a,b)=>W.oracleFaithDefense(s.oracleStrategy,a,b);
  for(const type of ['food.produce','family.nurture','settlement.explore']){
    assert.equal(matrix('religion.spread',type),1.4);
    assert.equal(matrix(type,'religion.spread'),.6);
    assert.equal(matrix(type,'default'),1.2);
    assert.equal(matrix('default',type),.8);
    assert.equal(matrix(type,type),1);
  }
  const old=W.create({oracleStrategyProfile:{...oracle,spreadMatrixEnabled:false}});
  assert.equal(W.oracleFaithDefense(old.oracleStrategy,'religion.spread','food.produce'),.8,
    'legacy Spread remains the historical default doctrine (not a fifth strategy)');
  const active=duel(),passive=duel();
  const issued=W.issueOracle(active,{saintId:active.religion.saints[0],intentType:'religion.spread'});
  assert.ok(issued.ok);
  assert.equal(active.counts.strategyCoreDoubts||0,0,
    'an Oracle cast alone does not damage rival faith');
  W.advanceTicks(active,3*30);W.advanceTicks(passive,3*30);
  assert.ok((active.counts.missionTripsStarted||0)>(passive.counts.missionTripsStarted||0),
    'spread doctrine should cause more real missionary journeys');
  assert.ok(active.counts.missionOracleSermons>0);
  assert.ok(active.counts.crossFaithMeetings>0);
  assert.equal(active.people.length,30);
  assert.ok(W.validate(active).ok);
});

test('injury and rare-resource movement save/restore are deterministic; old saves stay disabled',()=>{
  const s=fresh();W.advanceTicks(s,3*10);
  const again=W.restore(JSON.stringify(s));
  W.advanceTicks(s,3*7);W.advanceTicks(again,3*7);
  assert.deepEqual(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(again)));
  const legacy=W.create({seed:'dry-stress'});
  const old=JSON.parse(JSON.stringify(legacy));delete old.mobility;delete old.contactLog;
  const restored=W.restore(old);
  assert.equal(restored.mobility.enabled,false);
  assert.equal(restored.mobilityHotspots,undefined);
});