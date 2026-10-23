'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V=require('../src/victory.js');
const W=require('../src/sim.js');
const profile=require('../config/victory-dominance-v0.1.json');
const opponent=require('../config/opponent-v0.1.json');

function world(groups){
  const religions=groups.map((g,i)=>({id:'r'+(i+1),godId:'g'+(i+1),name:'Faith '+(i+1)}));
  const people=groups.flatMap((g,i)=>Array.from({length:g.count},(_,j)=>({
    id:'p'+i+'-'+j,alive:true,religionId:religions[i].id,devotion:g.devotion
  })));
  return {hour:0,people,rules:{daysPerMonth:30,daysPerYear:360},
    religion:religions[0],opponent:{enabled:true},opponentReligion:religions[1],
    additionalReligions:religions.slice(2)};
}
const weight=W.faithfulWeight;
const share=(v,id)=>v.teams.find(x=>x.id===id).share;

test('existing 0/1/2/4/8 Devotion weights outrank raw follower headcount',()=>{
  const s=world([{count:10,devotion:90},{count:30,devotion:50}]);
  V.reset(s,weight,profile);
  const v=V.overview(s,weight);
  assert.equal(v.totalWeight,140);
  assert.equal(v.teams[0].weight,80);
  assert.equal(v.teams[1].weight,60);
  assert.ok(Math.abs(share(v,'r1')-4/7)<1e-12);
  assert.equal(v.leaderId,'r1');
  assert.equal(v.teams[0].tiers[0].qualified,true);
});

test('two-god thresholds are 55/65/70/90 percent',()=>{
  for(const [i,expected] of [.55,.65,.70,.90].entries())
    assert.ok(Math.abs(V.threshold(2,profile.tiers[i].margin)-expected)<1e-12);
});

test('three-god 40% first tier; only unique first place accrues',()=>{
  const s=world([{count:45,devotion:50},{count:42,devotion:50},{count:13,devotion:50}]);
  V.reset(s,weight,profile);
  const view=V.overview(s,weight);
  assert.ok(Math.abs(V.threshold(3,.1)-.4)<1e-12);
  assert.equal(view.leaderId,'r1');
  assert.equal(view.teams[0].tiers[0].qualified,true);
  assert.equal(view.teams[1].tiers[0].qualified,false);
  assert.equal(s.victory.starts.r2[0],null);
  s.people[0].religionId='r2';s.people[1].religionId='r2'; // 43:44:13
  s.hour=24;
  V.update(s,weight);
  assert.equal(s.victory.starts.r1[0],null);
  assert.equal(s.victory.starts.r2[0],24);
});

test('dropping from 75% to 68% resets only 70% tier, not 55/65',()=>{
  const s=world([{count:75,devotion:50},{count:25,devotion:50}]);
  V.reset(s,weight,profile);
  s.hour=120*24;V.update(s,weight);
  for(const i of [0,1,2])assert.equal(s.victory.starts.r1[i],0);
  for(let i=0;i<7;i++)s.people[i].religionId='r2';
  s.hour=121*24;V.update(s,weight);
  assert.deepEqual(s.victory.starts.r1.slice(0,3),[0,0,null]);
  s.people[7].religionId='r2';
  for(let i=8;i<21;i++)s.people[i].religionId='r2'; // 54% => reset first two too
  s.hour=122*24;V.update(s,weight);
  assert.equal(s.victory.starts.r1[0],null);
  assert.equal(s.victory.starts.r1[1],null);
});

test('90% one-month victory is exact, persistent, and does not loop in sandbox',()=>{
  const s=world([{count:95,devotion:50},{count:5,devotion:50}]);
  V.reset(s,weight,profile);
  s.hour=29*24;assert.equal(V.update(s,weight),null);
  assert.equal(s.victory.winner,null);
  s.hour=30*24;const result=V.update(s,weight);
  assert.equal(result.godId,'g1');
  assert.equal(result.tier,3);
  assert.equal(result.hour,720);
  assert.equal(V.continueAfterVictory(s),true);
  s.hour=40*24;assert.equal(V.update(s,weight),null);
  assert.deepEqual(s.victory.winner,result);
  assert.equal(V.overview(s,weight).continued,true);
});

test('zero-belief and equal-first-place worlds never accumulate victory clocks',()=>{
  const s=world([{count:5,devotion:10},{count:5,devotion:10}]);
  V.reset(s,weight,profile);
  s.hour=3600*24;V.update(s,weight);
  assert.equal(s.victory.winner,null);
  for(const p of s.people)p.devotion=60;
  V.update(s,weight);
  assert.equal(V.overview(s,weight).leaderId,null);
  assert.equal(s.victory.starts.r1[0],null);
  assert.equal(s.victory.starts.r2[0],null);
});

test('integration: 8-hour tick clock, save/restore, legacy saves, and one victory event',()=>{
  const s=W.create({seed:'victory-fast-check',opponentProfile:opponent});
  for(const p of s.people){if(p.alive){p.religionId='r1';p.devotion=90;}}
  const short={profileId:V.PROFILE_ID,tiers:profile.tiers.map(t=>({...t,days:1}))};
  W.resetVictory(s,short);
  W.advanceTicks(s,2);
  assert.equal(s.victory.winner,null);
  const restored=W.restore(JSON.stringify(s));
  assert.deepEqual(restored.victory,s.victory);
  W.advanceTicks(restored,1);
  assert.equal(restored.victory.winner.godId,'g1');
  assert.equal(restored.events.filter(e=>e.kind==='victory').length,1);
  W.continueVictory(restored);
  W.advanceTicks(restored,3);
  assert.equal(restored.events.filter(e=>e.kind==='victory').length,1);
  assert.deepEqual(W.validate(restored).errors,[]);
  const legacy=JSON.parse(JSON.stringify(restored));
  delete legacy.victory;
  const upgraded=W.restore(legacy);
  assert.equal(upgraded.victory.winner,null);
  assert.equal(upgraded.victory.starts.r1[3],upgraded.hour);
  const solo=W.create({seed:'solo-victory'});
  assert.equal(W.victoryOverview(solo).enabled,false);
});

test('playable UI, separate stylesheet, builder and 22+ runtime are wired',()=>{
  const root=path.join(__dirname,'..');
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  assert.ok(read('index.html').includes('id="victoryDialog"'));
  assert.ok(read('index.html').includes('src/victory.js'));
  assert.ok(read('src/app.js').includes('announceVictoryIfNeeded()'));
  assert.ok(read('src/app.js').includes('S.continueVictory(state)'));
  assert.ok(read('tools/build-single.cjs').includes('WOG_VICTORY_PROFILE'));
  assert.ok(read('tools/build-single.cjs').includes("read('src/victory.js')"));
  assert.ok(Number(process.versions.node.split('.')[0])>=22);
});

test('four-God 50% requires a ten-point lead for a continuous year, with independent reset and exact deadline',()=>{
  const s=world([{count:50,devotion:50},{count:40,devotion:50},
    {count:5,devotion:50},{count:5,devotion:50}]);
  V.reset(s,weight,profile);
  assert.deepEqual(V.overview(s,weight).teams[0].tiers.map(t=>t.threshold),[.35,.4,.5,.65]);
  assert.equal(s.victory.starts.r1[2],0);
  s.hour=100*24;V.update(s,weight);
  // 50/41/4/5: still 50%, but the lead is too narrow.
  s.people.find(p=>p.religionId==='r3').religionId='r2';
  s.hour=101*24;V.update(s,weight);
  assert.deepEqual(s.victory.starts.r1,[0,0,null,null]);
  s.people.find(p=>p.religionId==='r2').religionId='r3';
  s.hour=102*24;V.update(s,weight);
  s.hour=(102+360)*24-8;assert.equal(V.update(s,weight),null);
  s.hour=(102+360)*24;const won=V.update(s,weight);
  assert.equal(won.tier,2);assert.equal(won.threshold,.5);
  assert.equal(won.requiredDays,360);
  assert.ok(V.continueAfterVictory(s));
  assert.equal(V.update(s,weight),null);
});

test('four-God near tie, dropped share and legacy saved victory rules do not receive new progress',()=>{
  const s=world([{count:50,devotion:50},{count:48,devotion:50},
    {count:1,devotion:50},{count:1,devotion:50}]);
  V.reset(s,weight,profile);
  assert.ok(s.victory.starts.r1.every(x=>x===null));
  const legacy={profileId:profile.profileId,tiers:profile.tiers};
  V.reset(s,weight,legacy);
  const saved=JSON.parse(JSON.stringify(s.victory));
  s.hour=24;V.ensure(s,weight);
  assert.deepEqual(s.victory,saved);
  assert.ok(Math.abs(V.overview(s,weight).teams[0].tiers[2].threshold-.55)<1e-12);
  V.reset(s,weight,profile);
  // 50/30/19/1, then 49/30/20/1 must restart the 50% clock.
  for(const p of s.people.filter(p=>p.religionId==='r2').slice(0,18))p.religionId='r3';
  V.update(s,weight);assert.equal(s.victory.starts.r1[2],24);
  s.people.find(p=>p.religionId==='r1').religionId='r3';
  s.hour=48;V.update(s,weight);assert.equal(s.victory.starts.r1[2],null);
});

test('four-God 65% closes in one month and equal leaders never qualify',()=>{
  const s=world([{count:65,devotion:50},{count:15,devotion:50},
    {count:10,devotion:50},{count:10,devotion:50}]);
  V.reset(s,weight,profile);
  s.hour=30*24-8;assert.equal(V.update(s,weight),null);
  s.hour=30*24;assert.equal(V.update(s,weight).tier,3);
  const tied=world(Array.from({length:4},()=>({count:5,devotion:50})));
  V.reset(tied,weight,profile);tied.hour=3600*24;
  assert.equal(V.update(tied,weight),null);
});
