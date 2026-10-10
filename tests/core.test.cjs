'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../sim.js');
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
  assert.equal(W.castRain(a,{x:a.camp.x,y:a.camp.y}).ok,false,'independent rain cooldown');
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
