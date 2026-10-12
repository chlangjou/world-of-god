'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/sim.js');
const fresh = (o={}) => W.create({seed:'valley-spring-01',...o});
const clone = x => JSON.parse(JSON.stringify(x));
function afterDays(s,n) {W.advanceTicks(s,n*3);return s;}
function valid(s){const v=W.validate(s);assert.equal(v.ok,true,v.errors.join('\n'));}
function fields(s){return W.stats(s).avgMoisture;}

test('pure browser API and clean-room game initial state',()=>{
  const s=fresh();assert.equal(s.tiles.length,4096);assert.equal(s.people.length,24);
  assert.equal(s.households.length,8);assert.equal(s.settlements.length,0);
  assert.equal(W.stats(s).followers,3);assert.equal(W.VERSION,'mvp0-web-2');valid(s);
});
test('real households autonomously build houses and establish settlement; no player intervention',()=>{
  const s=fresh();afterDays(s,90);const st=W.stats(s);
  assert.ok(st.houses>=4,'real houses should be built');assert.equal(st.settlements,1);
  assert.ok(s.history.settlementFoundedHour>0);
  assert.equal(s.events.some(e=>e.kind==='housing'),false,'building work is routine, not a history headline');
  assert.ok(s.events.some(e=>e.kind==='settlement'));
  assert.ok(s.metrics.workChoices>0);valid(s);
});
test('abundant private reserves do not indefinitely stall shelter work or settlement founding',()=>{
  const latest=require('../config/balance-agriculture-v0.1.json');
  for(const legacy of [false,true]){
    const profile=clone(latest);
    if(legacy)delete profile.workDemand.unhousedMaterialPriorityBonus; // older embedded-save profile
    const world=W.create({seed:'valley-spring-01',balanceProfile:profile});
    // Represents an old overstocked private-food save; the fixture changes no building materials.
    for(const h of world.households)h.inventory.food=1600;
    const s=W.restore(JSON.stringify(world));
    afterDays(s,60);
    const st=W.stats(s);
    assert.ok(st.houses>=4,`${legacy?'legacy':'current'} profile: food surplus must not indefinitely block housing`);
    assert.equal(st.settlements,1,'real completed houses must allow settlement to form');
    assert.ok(s.households.filter(h=>h.home).every(h=>h.buildMaterialsPaid),'houses must use real materials');
    valid(s);
  }
});

test('world food production is independent of god inputs and inventory never becomes negative',()=>{
  const s=fresh();afterDays(s,100);
  assert.ok(s.counts.foodFromLabor>0);assert.ok(W.stats(s).food>=0);
  for(const h of s.households)for(const qty of Object.values(h.inventory))assert.ok(qty>=0);
  for(const t of s.settlements)for(const qty of Object.values(t.storage))assert.ok(qty>=0);
  valid(s);
});
test('same seed, ruleset and input timestamps produce identical simulation including RNG',()=>{
  function play(){const s=fresh({seed:'deterministic-a'});afterDays(s,18);
    assert.equal(W.issueOracle(s).ok,true);afterDays(s,7);
    const cast=W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:8,intensity:1,durationDays:14});assert.ok(cast.ok);
    afterDays(s,35);return s;}
  assert.deepEqual(play(),play());
});
test('batched fast-forward equals one-tick-at-a-time',()=>{
  const a=fresh(),b=fresh();W.advanceTicks(a,180);for(let i=0;i<180;i++)W.advanceTicks(b,1);
  assert.deepEqual(a,b);
});
test('rain reliably changes physical state, not food inventory; rejects invalid inputs without spending',()=>{
  const a=fresh(),b=fresh();const before=W.stats(a).food;
  const invalid=W.castRain(a,{x:-3,y:3});assert.equal(invalid.ok,false);assert.equal(W.stats(a).food,before);
  assert.equal(a.god.dp,a.rules.initialDp);
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:7,intensity:1,durationDays:31}).ok,false);
  const ok=W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:8,intensity:1,durationDays:12});
  assert.equal(ok.ok,true);assert.ok(a.god.dp<a.rules.initialDp);assert.equal(W.stats(a).food,before);
  const surcharge=W.evalRain(a,{x:a.camp.x,y:a.camp.y});
  assert.equal(surcharge.costMultiplier,2,'Rain is in its own 2x forced-cast interval');
  assert.ok(surcharge.cost>a.god.dp,'the current DP cannot pay this forced cast');
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y}).ok,false,
    'insufficient DP blocks an escalated cast, not cooldown alone');
  afterDays(a,10);afterDays(b,10);
  assert.ok(fields(a)>fields(b)+.06,`wetter world expected: ${fields(a)} vs ${fields(b)}`);
  afterDays(a,4);assert.equal(a.effects.length,0,'rain input expires on simulation clock');valid(a);
});
test('spatial Divine Presence derives from weighted actual people, not stored DP',()=>{
  const s=fresh();let original=W.presenceAt(s,s.camp).weighted;
  assert.ok(original>0);s.god.dp=100;
  assert.equal(W.presenceAt(s,s.camp).weighted,original);
  for(const p of s.people){p.devotion=0;p.religionId=null;}
  assert.equal(W.presenceAt(s,s.camp).weighted,0);assert.equal(W.presenceAt(s,s.camp).share,0);
  const dp=s.god.dp;s.god.dp=0;afterDays(s,2);assert.ok(s.god.dp>0,'natural recovery exists without believers');
});
test('devotion thresholds and effective weights are correct',()=>{
  assert.deepEqual([0,19,20,39,40,79,80,89,90,100].map(W.faithfulWeight),[0,0,1,1,2,2,4,4,8,8]);
  const s=fresh();const p=s.people[0];p.devotion=39;
  assert.equal(s.people.filter(x=>x.devotion>=40).length,2);
});
test('Saint is a receiver, Oracle charges Saint quota not DP; transmission is delayed',()=>{
  const s=fresh();afterDays(s,4);const saintId=W.stats(s).saintId;
  assert.ok(saintId);const dp=s.god.dp;
  const attempt=W.issueOracle(s,{saintId:'p3'});assert.equal(attempt.ok,false);
  const issued=W.issueOracle(s,{saintId});assert.equal(issued.ok,true);
  assert.equal(s.god.dp,dp);assert.equal(issued.quotaLeft,3);
  assert.equal(s.religion.oracles[0].propagatedAtHour,null);
  assert.equal(W.issueOracle(s,{saintId}).ok,false,'same Saint active type must be locked');
  afterDays(s,2);
  assert.ok(s.religion.oracles[0].propagatedAtHour!==null);
  assert.ok(s.religion.oracles[0].heardCount>0);
});
test('Oracle can change autonomous work decisions, never forces impossible work',()=>{
  function run(oracle){const s=fresh();afterDays(s,12);
    if(oracle)assert.equal(W.issueOracle(s).ok,true);
    afterDays(s,90);return s;}
  const a=run(false),b=run(true);
  assert.equal(a.metrics.oracleInfluencedChoices,0);
  assert.ok(b.metrics.oracleInfluencedChoices>0,'calling must affect at least one decision');
  assert.ok(b.religion.oracles[0].influenceWorkCount>0);
  assert.ok(b.people.some(p=>p.lastDecision&&p.lastDecision.oracleInfluence>0));
  const test=fresh();afterDays(test,4);W.issueOracle(test);
  for(const t of test.tiles){t.forage=0;t.wood=0;t.fiber=0;t.stone=0;if(t.terrain==='field')t.terrain='meadow';}
  afterDays(test,5);
  assert.ok(test.people.filter(p=>p.stage==='adult').some(p=>p.lastDecision?.work==='rest' || p.lastDecision?.work==='build' || p.lastDecision?.work==='care'));
  valid(test);
});
test('Oracle lifecycle expiry and Saint death do not transfer assignments',()=>{
  const s=fresh();afterDays(s,4);const id=W.stats(s).saintId;
  W.issueOracle(s,{durationDays:3});afterDays(s,4);
  assert.equal(s.religion.oracles[0].status,'expired');
  assert.equal(s.religion.saintQuota[id].quota,3);
  assert.equal(W.issueOracle(s,{durationDays:10}).ok,true);
  assert.equal(W.die(s,id,'測試中受傷離世').ok,true);
  assert.equal(s.religion.oracles[1].status,'saint_dead');
  afterDays(s,4);const successor=W.stats(s).saintId;
  assert.notEqual(successor,id);
  assert.equal(s.religion.oracles[1].status,'saint_dead');valid(s);
});
test('Oracle conclusion overdraw floor -1 and deterministic quota refill',()=>{
  const s=fresh();afterDays(s,4);const id=W.stats(s).saintId;
  assert.equal(W.issueOracle(s).ok,true);
  const quota=s.religion.saintQuota[id];quota.quota=0;
  const o=s.religion.oracles[0];
  assert.deepEqual(W.concludeOracle(s,o.id),{ok:true,quotaLeft:-1});
  assert.equal(W.issueOracle(s).ok,false);
  assert.equal(W.concludeOracle(s,o.id).ok,false);
  afterDays(s,90);assert.equal(quota.quota,0);
  assert.equal(W.issueOracle(s).ok,false);
  afterDays(s,90);assert.equal(quota.quota,1);
  assert.equal(W.issueOracle(s).ok,true);
});
test('rain plus a real answered drought prayer can update devotion once, not per cast',()=>{
  const s=fresh();afterDays(s,21);
  const prayer=s.religion.prayers.find(p=>p.status==='open');assert.ok(prayer,'real prayer should arise from drought/crops');
  const pre=s.people.filter(p=>p.devotion>=40).length;
  const rain=W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:8,intensity:1,durationDays:16});assert.ok(rain.ok);
  afterDays(s,28);
  assert.ok(s.religion.prayers.some(p=>p.status==='answered'),'fulfilled need should be credited');
  const after=s.people.filter(p=>p.devotion>=40).length;
  assert.ok(after>=pre);assert.ok(s.events.some(e=>e.kind==='faith'));
  const first=s.religion.prayers.find(p=>p.status==='answered');
  const faithAfter=s.people.map(p=>p.devotion);
  afterDays(s,1);
  assert.equal(first.status,'answered');
  assert.deepEqual(s.people.map(p=>p.devotion),faithAfter,'no per-tick credit for same need');
});
test('controlled births, death and family coherence',()=>{
  const s=fresh();afterDays(s,4);
  const mother=s.people.find(p=>p.genderRole==='gestate'&&p.stage==='adult');
  const family=s.households.find(h=>h.id===mother.householdId);
  mother.pregnancyDueHour=s.hour+30*24;
  const before=s.people.length;
  afterDays(s,30);
  assert.equal(s.people.length,before+1);assert.equal(s.counts.births,1);
  assert.ok(family.members.includes(s.people[s.people.length-1].id));
  W.die(s,s.people[s.people.length-1].id,'可測試死亡');
  assert.equal(s.counts.deaths,1);valid(s);
});
test('save/reload preserves RNG and active timed effects/Oracle in same ruleset',()=>{
  const a=fresh();afterDays(a,8);W.issueOracle(a);
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y,radius:7,durationDays:10}).ok,true);
  const b=W.restore(JSON.stringify(a));
  afterDays(a,40);afterDays(b,40);
  assert.deepEqual(a,b);valid(b);
  assert.throws(()=>W.restore('{"version":"broken"}'));
});
test('controlled food shortage can drive autonomous household relocation',()=>{
  const s=fresh();afterDays(s,14);assert.ok(s.settlements.length);
  for(const t of s.tiles){t.forage=0;if(t.terrain==='field'){t.crop=.02;t.moisture=.03;}}
  for(const h of s.households) h.inventory.food=0;
  s.settlements[0].storage.food=0;
  s.settlements[0].foodShortageDays=29;
  s.settlements[0].workDemand.foodPressure=1;
  // Ensure an actual food opportunity exists beyond the community service radius.
  for(let y=s.camp.y+14;y<=s.camp.y+20;y++)for(let x=s.camp.x-3;x<=s.camp.x+3;x++){
    const t=s.tiles[y*s.width+x];if(t.terrain!=='river')t.forage=1.3;
  }
  // Set a controlled monthly trigger while maintaining the shared clock.
  afterDays(s,16);
  assert.ok(s.counts.relocations>=1,'prolonged shortage should move a household');valid(s);
});

test('private food is zero but accessible public pantry prevents false emergency and supports conception',()=>{
  const s=fresh();afterDays(s,30);
  const town=s.settlements[0];assert.ok(town);
  for(const h of s.households)h.inventory.food=0;
  town.storage.food=300;
  const first=s.households[0], detail=W.inspectHousehold(s,first.id);
  assert.equal(detail.privateFood,0);
  assert.equal(detail.settlementId,town.id);
  assert.ok(detail.foodCoverageDays>15,'common pantry must count as feasible food access');
  const person=s.people.find(p=>p.householdId===first.id&&p.stage==='adult');
  afterDays(s,1);
  assert.ok(person.lastDecision);
  assert.ok(person.lastDecision.foodDays>10,'work priority must use reachable food, not just private stock');
  assert.equal(person.lastDecision.reason.includes('優先處理實際需求'),false);
  assert.equal(person.hunger,0,'a household should not starve next to stocked community storage');
  valid(s);
});

test('out-of-service household keeps its production rather than depositing into unreachable pantry',()=>{
  const s=fresh();afterDays(s,16);
  const h=s.households[0],town=s.settlements[0];
  town.householdIds=town.householdIds.filter(id=>id!==h.id);
  h.x=s.camp.x+17;h.y=s.camp.y;
  for(const id of h.members){const p=s.people.find(x=>x.id===id);p.x=h.x;p.y=h.y;p.settlementId=null;}
  const detail=W.inspectHousehold(s,h.id);
  assert.equal(detail.settlementId,null);
  assert.equal(detail.forecastCommonShare,0);
  h.inventory.food=0;
  // Make local forage visibly available, without a global stock mutation by the household.
  for(let y=h.y-2;y<=h.y+2;y++)for(let x=h.x-2;x<=h.x+2;x++){
    const t=s.tiles[y*s.width+x];if(t.terrain!=='river')t.forage=1.2;
  }
  afterDays(s,1);
  assert.ok(h.inventory.food>0,'outside household should own the entire gathered output');
  valid(s);
});

test('stranded distant household autonomously returns if community has accessible surplus',()=>{
  const s=fresh();afterDays(s,20);
  const h=s.households[1],town=s.settlements[0];
  town.householdIds=town.householdIds.filter(id=>id!==h.id);
  h.x=2;h.y=2;h.inventory.food=0;
  for(const id of h.members){const p=s.people.find(x=>x.id===id);p.x=h.x;p.y=h.y;p.settlementId=null;}
  for(const t of s.tiles)if(Math.hypot(t.x-h.x,t.y-h.y)<8){t.forage=0;if(t.terrain==='field')t.terrain='meadow';}
  town.storage.food=280;
  afterDays(s,8);
  assert.equal(W.inspectHousehold(s,h.id).settlementId,town.id,'realistic return, not infinite-distance rationing');
  assert.ok(town.householdIds.includes(h.id));
  assert.ok(h.foodShortageDays<3);
  assert.ok(s.events.some(e=>e.kind==='migration'&&e.text.includes('搬回')));
  assert.ok(h.members.every(id=>s.people.find(p=>p.id===id).settlementId===town.id));
  valid(s);
});

test('autonomous pregnancy and several births occur in a normal long-running small world',()=>{
  const s=fresh();afterDays(s,1600);
  assert.ok(s.counts.births>=3,`expected meaningful growth, got ${s.counts.births}`);
  assert.equal(s.counts.deaths,0,'curated normal preset should not starve people through broken food access');
  assert.equal(W.stats(s).people,24+s.counts.births-s.counts.deaths);
  assert.ok(s.people.some(p=>p.stage==='child'&&p.name.startsWith('新生')));
  valid(s);
});

test('event feed contains significant history, not periodic inventory and weather diary',()=>{
  const s=fresh();afterDays(s,1600);
  const routineKinds=new Set(['world','housing','weather','prayer']);
  assert.ok(s.events.every(e=>!routineKinds.has(e.kind)), 'never save routine snapshots as history');
  assert.ok(s.events.some(e=>e.kind==='birth'));
  assert.ok(s.events.length < 80,`unexpected event flood: ${s.events.length}`);
  assert.ok(s.events.filter(e=>e.kind==='famine').length<12,'only sustained food crises count as major events');
});

test('history retains the newest 200 events, dropping only the oldest when overflowing',()=>{
  const s=fresh();
  assert.equal(s.rules.eventLimit,200);
  s.events=Array.from({length:200},(_,i)=>({
    id:i+1,hour:i*24,kind:'religion',text:'重大事件 '+(i+1),reasons:[],entities:[]
  }));
  s.eventSeq=200;
  const cast=W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:7,intensity:0.85,durationDays:10});
  assert.equal(cast.ok,true,'a real Miracle event should enter History');
  assert.equal(s.events.length,200,'the 201st event must trim exactly one item');
  assert.equal(s.events[0].id,2,'the oldest event is removed first');
  assert.equal(s.events.at(-1).id,201,'newest event is retained');
  assert.equal(s.events.at(-1).kind,'miracle');
  valid(s);
});

test('restoring a legacy 130-event save raises future retention to 200 without deleting history',()=>{
  const world=fresh();
  world.rules.eventLimit=130;
  world.events=[
    {id:1,hour:1,kind:'settlement',text:'保留先前事件',reasons:[],entities:[]}
  ];
  world.eventSeq=1;
  const oldEvents=clone(world.events);
  const oldPeople=clone(world.people);
  const oldFood=W.stats(world).food;
  const restored=W.restore(JSON.stringify(world));
  assert.equal(restored.rules.eventLimit,200,'the old baseline should adopt the new history cap');
  assert.deepEqual(restored.events,oldEvents,'events already stored must be preserved');
  assert.deepEqual(restored.people,oldPeople);
  assert.equal(W.stats(restored).food,oldFood);
  const custom=fresh({rules:{eventLimit:72}});
  assert.equal(W.restore(JSON.stringify(custom)).rules.eventLimit,72,
    'a deliberately customized limit other than the old default remains unchanged');
  assert.deepEqual(W.restore(JSON.stringify(restored)),restored,'save/load should be stable');
  valid(restored);
});

test('work and non-work phases have distinct, specific explanations instead of universal shortage reason',()=>{
  const s=fresh();afterDays(s,22);
  const adults=s.people.filter(p=>p.alive&&p.stage==='adult');
  const reasons=new Set(adults.map(p=>p.lastDecision?.reason));
  assert.ok(reasons.size>=4,'individuals should have distinct situated reasons');
  assert.ok(adults.every(p=>p.activityReason?.includes('休息')||p.activityReason?.includes('非工作')||p.activityReason?.includes('祈禱')));
  assert.ok(adults.every(p=>p.lastDecision.hour>=0));
  assert.ok(adults.every(p=>!p.lastDecision.reason.includes('優先處理實際需求')));
  valid(s);
});

test('first MVP saves upgrade without resurrecting people or bringing back routine diary entries',()=>{
  const s=fresh();afterDays(s,60);
  s.version='mvp0-web-1';s.events.push({id:++s.eventSeq,hour:s.hour,kind:'world',text:'第 60 日：普通糧食摘要',reasons:[]});
  delete s.rules.farmYieldMultiplier;
  for(const p of s.people){delete p.recoveryUntilHour;delete p.activityReason;}
  for(const h of s.households)delete h.foodShortageDays;
  const oldBirths=s.counts.births, oldDeaths=s.counts.deaths;
  const saved=W.restore(JSON.stringify(s));
  assert.equal(saved.version,W.VERSION);
  assert.ok(saved.events.every(e=>e.kind!=='world'));
  assert.equal(saved.counts.births,oldBirths);assert.equal(saved.counts.deaths,oldDeaths);
  assert.ok(saved.people.every(p=>p.recoveryUntilHour!==undefined));
  afterDays(saved,3);valid(saved);
});

test('optional Agriculture v0.1 profile is deterministic and crop stock remains physical',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const profile=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/balance-agriculture-v0.1.json'),'utf8'));
  const play=()=>{
    const world=W.create({seed:'calm-river',balanceProfile:profile});
    assert.equal(world.balanceProfileId,profile.profileId);
    const before=world.people.map(p=>p.proficiency.food);
    afterDays(world,160);
    valid(world);
    const fields=world.tiles.filter(t=>t.terrain==='field');
    assert.ok(fields.every(t=>Number.isFinite(t.cropStock)&&t.cropStock>=0));
    assert.ok(fields.some(t=>t.cropStock>0));
    assert.ok(world.counts.foodFromLabor>0);
    assert.ok(world.people.some((p,i)=>p.proficiency.food>before[i]),'actual agricultural work improves skill');
    const restored=W.restore(JSON.stringify(world));
    assert.deepEqual(restored,world);
    return world;
  };
  assert.deepEqual(play(),play());
  assert.equal(W.create({seed:'calm-river'}).balanceProfileId,'original');
});

test('Agriculture keeps autonomous food reserves through seasons without Rain Miracle',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  for(const seed of ['valley-spring-01','calm-river','river-dawn-01']){
    const s=W.create({seed,balanceProfile:profile});
    let farm=0,work=0,foodAt90=0;
    for(let day=1;day<=360;day++){
      W.advanceTicks(s,3);
      const st=W.stats(s);
      const need=s.people.filter(p=>p.alive).reduce((sum,p)=>sum+(p.stage==='child'?s.rules.foodNeedChild:s.rules.foodNeedAdult),0);
      assert.ok(st.food>=need*4,`${seed}: food shortage at day ${day}`);
      farm+=s.people.filter(p=>p.alive&&p.stage==='adult'&&p.lastDecision?.work==='farm').length;
      work+=s.people.filter(p=>p.alive&&p.stage==='adult').length;
      if(day===90)foodAt90=st.food;
    }
    assert.ok(foodAt90>150,`${seed}: expected reasonable pre-drought reserves`);
    const share=farm/work;
    assert.ok(share>=.08&&share<=.30,`${seed}: farm work is autonomous, got ${share}`);
    assert.equal(s.counts.deaths,0);
    assert.equal(s.counts.rainCasts,0);
    assert.equal(W.validate(s).ok,true);
  }
});
test('Agriculture crop regeneration exactly accounts for unharvested stock plus harvest',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  const s=W.create({seed:'calm-river',balanceProfile:profile});
  for(const t of s.tiles){t.forage=0;if(t.terrain==='field'){t.cropStock=0;t.crop=0;}}
  const before=s.counts.foodFromLabor;
  W.advanceTicks(s,1);
  const L=profile.land;
  const generated=s.tiles.filter(t=>t.terrain==='field').reduce((sum,t)=>
    sum+L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
    (t.moisture/L.referenceMoisture)**L.moistureExponent*s.rules.tickHours/24,0);
  const remaining=s.tiles.filter(t=>t.terrain==='field').reduce((sum,t)=>sum+t.cropStock,0);
  assert.ok(Math.abs(generated-remaining-(s.counts.foodFromLabor-before))<1e-7,'No harvested Food may arise without crop-stock transfer');
  assert.equal(W.validate(s).ok,true);
});

test('high-growth Agriculture supports a 4,000-day world without Rain or food collapse',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  const s=W.create({seed:'valley-spring-01',balanceProfile:profile});
  afterDays(s,4000);
  const st=W.stats(s);
  const need=s.people.filter(p=>p.alive).reduce((n,p)=>n+(p.stage==='child'?s.rules.foodNeedChild:s.rules.foodNeedAdult),0);
  assert.ok(st.people>=45,'the population should outgrow the initial 24-person settlement');
  assert.ok(st.food>need*12,'agriculture must have a meaningful reserve at day 4000');
  assert.equal(st.deaths,0);
  assert.equal(s.counts.rainCasts,0);
  valid(s);
});

test('farmers autonomously expand fields only through work, with initially zero crops',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  const s=W.create({seed:'calm-river',balanceProfile:profile});
  afterDays(s,120);
  const originalFields=s.tiles.filter(t=>t.terrain==='field').length;
  // A synthetic high-population load tests food capacity; it is not a birth mechanic.
  const adult=s.people.find(p=>p.stage==='adult'), child=s.people.find(p=>p.stage==='child');
  for(let i=0;i<176;i++){
    const a=i%4===0,source=a?adult:child,h=s.households[i%s.households.length];
    const person={...source,id:'stress-'+i,householdId:h.id,stage:a?'adult':'child',
      occupation:a?'food_producer':'dependent',partnerId:null,genderRole:'fertilize',
      pregnancyDueHour:null,religionId:null,devotion:0,proficiency:{...source.proficiency}};
    h.members.push(person.id);s.people.push(person);
  }
  afterDays(s,180);
  const st=W.stats(s);
  assert.ok(st.farmFields>originalFields+20,'people must be able to cultivate additional reachable land');
  assert.ok(st.newFields>20,'field expansion must be done by real farm work');
  assert.equal(st.deaths,0);
  assert.equal(s.counts.rainCasts,0);
  valid(s);
});

test('a 4,000-day Agriculture save can adopt current profile without inventory creation',()=>{
  const latest=require('../config/balance-agriculture-v0.1.json');
  const earlier=clone(latest);
  earlier.land.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture=.2;
  earlier.land.autonomousExpansionEnabled=false;
  const s=W.create({seed:'calm-river',balanceProfile:earlier});
  afterDays(s,180);
  const before=clone({people:s.people,households:s.households,settlements:s.settlements,
    events:s.events,tiles:s.tiles});
  assert.equal(W.applyAgricultureProfile(s,latest).ok,true);
  assert.deepEqual({people:s.people,households:s.households,settlements:s.settlements,
    events:s.events,tiles:s.tiles},before,'profile update itself must not create Food, crop or people');
  assert.equal(s.agriculture.land.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture,.8);
  assert.equal(W.applyAgricultureProfile(W.create(),latest).ok,false,'Original remains isolated');
  valid(s);
  afterDays(s,10);
  valid(s);
});


test('adult partners can form new households without conjured housing or transferred food',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  const s=W.create({seed:'valley-spring-01',balanceProfile:profile});
  // The original village normally completes settlement founding after day 300.
  afterDays(s,389);
  const a=s.people.find(p=>p.id==='p3'),b=s.people.find(p=>p.id==='p6');
  for(const p of [a,b]){p.age=22;p.stage='adult';p.health=100;p.hunger=0;p.partnerId=null;}
  b.genderRole='gestate';a.genderRole='fertilize';
  s.agriculture.familyExpansion.pairChancePerMonth=1;
  const control=clone(s);
  control.agriculture.familyExpansion.enabled=false;
  afterDays(s,1);afterDays(control,1);
  assert.equal(s.counts.newFamilies,1);
  assert.equal(s.households.length,control.households.length+1);
  const newHome=s.households.at(-1);
  assert.equal(newHome.home,false,'pairing does not spawn a finished house');
  assert.equal(newHome.inventory.wood,0);assert.equal(newHome.inventory.fiber,0);
  assert.equal(a.partnerId,b.id);assert.equal(b.partnerId,a.id);
  assert.equal(a.householdId,newHome.id);assert.equal(b.householdId,newHome.id);
  const totalFood=w=>w.households.reduce((n,h)=>n+h.inventory.food,0)+w.settlements.reduce((n,t)=>n+t.storage.food,0);
  assert.ok(Math.abs(totalFood(s)-totalFood(control))<1e-8,'real startup food transfer must conserve stock');
  valid(s);
  const saved=W.restore(JSON.stringify(s));
  assert.deepEqual(saved,s);
  afterDays(s,12);afterDays(saved,12);
  assert.deepEqual(saved,s,'new-generation worlds must replay exactly after save/restore');
});
test('real housing forms additional settlements with local crop access',()=>{
  const profile=require('../config/balance-agriculture-v0.1.json');
  const s=W.create({seed:'valley-spring-01',balanceProfile:profile});
  afterDays(s,100);
  const F=s.agriculture.familyExpansion;
  F.pioneerAfterHouseholds=8;F.pioneerChance=1;F.pairChancePerMonth=1;F.maxCouplesPerMonth=3;
  const mother=s.people.find(p=>p.genderRole==='gestate'&&p.stage==='adult');
  const father=s.people.find(p=>p.genderRole==='fertilize'&&p.stage==='adult');
  for(let i=0;i<8;i++){
    const a=s.households[i],b=s.households[(i+4)%8];
    const woman={...clone(mother),id:'fixture-w'+i,age:22,partnerId:null,householdId:a.id,
      originHouseholdId:'origin-w'+i,parentIds:[],x:a.x,y:a.y,religionId:null,devotion:0};
    const man={...clone(father),id:'fixture-m'+i,age:23,partnerId:null,householdId:b.id,
      originHouseholdId:'origin-m'+i,parentIds:[],x:b.x,y:b.y,religionId:null,devotion:0};
    a.members.push(woman.id);b.members.push(man.id);s.people.push(woman,man);
  }
  afterDays(s,300);
  assert.ok(s.counts.newFamilies>=6,'grown adults should create independent households');
  assert.ok(s.settlements.length>=2,'built pioneer homes should found another real settlement');
  assert.ok(s.counts.newFields>0,'pioneers should cultivate reachable meadow when needed');
  assert.equal(s.counts.deaths,0,'healthy early pioneer fixtures should not starve for lack of any fields');
  assert.ok(s.settlements.slice(1).every(t=>t.householdIds.filter(id=>s.households.find(h=>h.id===id)?.home).length>=3));
  valid(s);
});
