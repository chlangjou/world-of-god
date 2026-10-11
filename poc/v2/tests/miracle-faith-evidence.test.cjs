'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=(versus=false,profile=agriculture)=>W.create({
  seed:'valley-spring-01',balanceProfile:profile,
  religionProfile:religion,divineProfile:divine,
  ...(versus?{opponentProfile:opponent}:{})
});
const advance=(s,days)=>W.advanceTicks(s,days*3);
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('real Heal improves recipient Devotion substantially and nearby witnesses mildly',()=>{
  const s=fresh(),p=s.people[0],near=s.people[1];
  assert.ok(distance(p,near)<2);
  p.health=45;const before=p.devotion,witness=near.devotion;
  const cast=W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:3,intensity:1});
  assert.ok(cast.ok);
  assert.ok(p.health>45);
  assert.ok(p.devotion-before>=15,'recipient should perceive a substantial credited benefit');
  assert.ok(near.devotion-witness>=1&&near.devotion-witness<=3,
    'a witness gets small, not the direct healing credit');
  assert.ok(p.lastFaithEvidence?.godId==='g1');
  good(s);
});

test('no meaningful Heal outcome cannot create faith and a rejected cast spends nothing',()=>{
  const s=fresh(),p=s.people[0];
  p.health=97;
  const before=s.people.map(p=>[p.religionId,p.devotion]);
  const cast=W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:1,intensity:1});
  assert.ok(cast.ok,'small real healing remains a valid physical action');
  assert.deepEqual(s.people.map(p=>[p.religionId,p.devotion]),before);
  assert.ok(!s.events.some(e=>e.kind==='faith'));
  const after=s.people.map(p=>[p.religionId,p.devotion]);
  assert.equal(W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:1,intensity:1}).ok,false);
  assert.deepEqual(s.people.map(p=>[p.religionId,p.devotion]),after);
  good(s);
});

test('positive Miracle challenges rival 40+ only with a credible local attribution',()=>{
  const s=fresh(true);
  const target=s.people.find(p=>p.religionId==='r2');
  target.health=35;target.devotion=62;
  const before=target.devotion;
  const player=s.people[0];
  target.x=player.x;target.y=player.y;
  const cast=W.castMiracle(s,'heal',{x:target.x,y:target.y,radius:3,intensity:1});
  assert.ok(cast.ok);
  assert.equal(target.religionId,'r2','benefit never forces instant conversion');
  assert.ok(target.devotion<before,'foreign 40+ belief can be challenged by actual evidence');
  assert.equal(target.lastFaithEvidence?.godId,'g1');
  good(s);
});

test('unaffiliated healed person accumulates bounded god-specific interest before deciding',()=>{
  const s=fresh(true),p=s.people.find(v=>v.nativeOrigin&&v.religionId===null);
  p.health=42;
  // Credible attribution requires an existing believer near the observation.
  const trusted=s.people.find(v=>v.religionId==='r1'&&v.devotion>=40);
  trusted.x=p.x;trusted.y=p.y;
  const cast=W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:2,intensity:1});
  assert.ok(cast.ok);
  assert.equal(p.religionId,null,'individual remains free after miracle');
  assert.ok(p.miracleInterest?.g1?.score>=religion.miracleInterestThreshold);
  assert.equal(p.lastFaithEvidence?.godId,'g1');
  good(s);
});

test('a receptive unaligned person can personally adopt after witnessed healing evidence',()=>{
  const s=fresh(true),native=s.people.find(p=>p.nativeOrigin&&p.religionId===null);
  native.receptivity=.99;native.health=30;
  const source=s.people.find(p=>p.religionId==='r1');
  source.x=native.x;source.y=native.y;
  assert.ok(W.castMiracle(s,'heal',{x:native.x,y:native.y,radius:2,intensity:1}).ok);
  assert.equal(native.religionId,null,'healing does not directly order conversion');
  advance(s,21);
  assert.equal(native.religionId,'r1','credible benefit should have a real autonomous adoption path');
  assert.ok(native.devotion>=20&&native.devotion<40);
  assert.ok((s.counts.miracleAdoptions||0)>=1);
  good(s);
});

test('credible opponent Heal reducing a player belief raises the existing fast-forward alarm',()=>{
  const s=fresh(true),player=s.people[0],enemy=s.people.find(p=>p.religionId==='r2');
  player.health=40;player.devotion=61;
  player.x=enemy.x;player.y=enemy.y;
  const cast=W.castMiracle(s,'heal',{godId:'g2',x:player.x,y:player.y,
    radius:2,intensity:1});
  assert.ok(cast.ok);
  assert.equal(player.religionId,'r1');
  assert.ok(player.devotion<61);
  assert.ok(s.attention.items.some(note=>note.type==='divine-persuasion'&&
    note.level==='pause'&&note.personId===player.id));
  good(s);
});

test('Efficiency requires actual productive blessed work, not a button-only faith increase',()=>{
  const s=fresh(),p=s.people[0];
  s.households[0].inventory.food=0;
  const before=p.devotion;
  const cast=W.castMiracle(s,'efficiency',{x:p.x,y:p.y,
    radius:4,intensity:1,durationDays:10});
  assert.ok(cast.ok);
  assert.equal(p.devotion,before,'pending work does not create evidence');
  advance(s,6);
  assert.ok(p.divineStatuses?.efficiency?.faithCredited,
    'real resource extraction, production or construction creates credited evidence');
  assert.ok(p.devotion>=before+10,'productive recipient gains meaningful Devotion');
  good(s);
});

test('Harvest is a small physical crop witness event; Ripening waits for real extra growth',()=>{
  const a=fresh(),plot=a.tiles.filter(t=>t.terrain==='field')
    .sort((x,y)=>distance(x,a.camp)-distance(y,a.camp))[0];
  const p=a.people.find(p=>p.religionId==='r1'&&distance(p,plot)<8);
  assert.ok(p);
  const before=p.devotion;
  const harvest=W.castMiracle(a,'harvest',{x:plot.x,y:plot.y,radius:7,intensity:1});
  assert.ok(harvest.ok&&harvest.actual>0);
  assert.ok(p.devotion>=before&&p.devotion<=before+3);
  assert.ok(a.events.some(e=>e.kind==='faith'&&e.text.includes('豐收')));
  const b=fresh(),beforeB=b.people.map(p=>p.devotion);
  const ripening=W.castMiracle(b,'ripening',{
    x:plot.x,y:plot.y,radius:7,intensity:1.5,durationDays:8});
  assert.ok(ripening.ok);
  assert.deepEqual(b.people.map(p=>p.devotion),beforeB,
    'Ripening casting alone cannot award Devotion');
  advance(b,4);
  assert.ok(b.effects.some(e=>e.type==='ripening'&&e.faithCredited===true&&e.evidenceCropGain>0));
  assert.ok(b.events.some(e=>e.kind==='faith'&&e.text.includes('促熟')));
  good(a);good(b);
});

test('Rain alone earns no Faith; matched, locally fulfilled prayer earns it once',()=>{
  const dry=copy(agriculture);dry.seasons.dryWindows=[[0,90]];
  const s=fresh(false,dry),p=s.people[0];
  const naked=W.castRain(s,{x:s.camp.x,y:s.camp.y,
    radius:8,intensity:1.2,durationDays:16});
  assert.ok(naked.ok);
  assert.ok(!s.events.some(e=>e.kind==='faith'));
  const t=fresh(false,dry),subject=t.people[0];
  const fields=t.tiles.filter(x=>x.terrain==='field'&&distance(x,t.camp)<11);
  assert.ok(fields.length>0);
  for(const tile of fields)tile.moisture=.14;
  const petition={id:'need-evidence-player',type:'food-water',
    center:{...t.camp},createdAtHour:t.hour,status:'open',
    by:[subject.id],beforeMoisture:.14,
    foodProductionAtRequest:t.counts.foodFromLabor,
    localFoodProductionAtRequest:0,castSeen:false};
  t.religion.prayers.push(petition);
  const start=subject.devotion;
  assert.ok(W.castRain(t,{x:t.camp.x,y:t.camp.y,radius:8,
    intensity:1.2,durationDays:16}).ok);
  advance(t,12);
  assert.equal(petition.status,'answered','prayer needs matching region and actual food harvest');
  assert.ok(subject.devotion>=start+12);
  const after=subject.devotion;
  advance(t,5);
  assert.ok(subject.devotion>=after,
    'prayer cannot be credited a second time after being answered');
  good(s);good(t);
});

test('AI has its own regional prayers, matched Rain evidence, and independent attribution',()=>{
  const dry=copy(agriculture);dry.seasons.dryWindows=[[0,90]];
  const s=fresh(true,dry);
  advance(s,12);
  const town=s.settlements.find(v=>v.id==='s2');
  assert.ok(town,'enemy must have formed a real settlement');
  const faith=s.opponentReligion,subject=s.people.find(p=>p.religionId==='r2'&&p.alive);
  const fields=s.tiles.filter(t=>t.terrain==='field'&&distance(t,town)<11);
  for(const tile of fields)tile.moisture=.14;
  const prayer={id:'need-evidence-ai',type:'food-water',settlementId:town.id,
    center:{x:town.x,y:town.y},createdAtHour:s.hour,status:'open',
    by:[subject.id],beforeMoisture:.14,
    foodProductionAtRequest:s.counts.foodFromLabor,
    localFoodProductionAtRequest:s.metrics.foodProductionByTown[town.id]||0,
    castSeen:false};
  faith.prayers.push(prayer);
  const cast=W.castRain(s,{godId:'g2',x:town.x,y:town.y,
    radius:8,intensity:1.2,durationDays:16});
  assert.ok(cast.ok);
  advance(s,12);
  assert.equal(prayer.status,'answered');
  assert.ok(subject.lastFaithEvidence?.godId==='g2'||subject.devotion>=55);
  good(s);
});

test('save and restore preserve miracle impressions, fulfilled evidence and AI decisions',()=>{
  const s=fresh(true);
  advance(s,1); // Allow the existing granary plan to initialize before snapshot.
  const p=s.people.find(v=>v.nativeOrigin&&v.religionId===null),
    source=s.people.find(v=>v.religionId==='r1');
  p.health=40;source.x=p.x;source.y=p.y;
  assert.ok(W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:2,intensity:1}).ok);
  const restored=W.restore(JSON.stringify(s));
  assert.deepEqual(restored,s);
  advance(s,65);advance(restored,65);
  assert.deepEqual(restored,s);
  good(s);
});
