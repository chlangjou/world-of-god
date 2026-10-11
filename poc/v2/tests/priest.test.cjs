'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),ag=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=(priest=true,agriculture=false)=>W.create({seed:'valley-spring-01',
 religionProfile:{...religion,priesthoodEnabled:priest},...(agriculture?{balanceProfile:ag}:{})});
const after=(s,days)=>{W.advanceTicks(s,3*days);return s;};
const valid=s=>assert.equal(W.validate(s).ok,true);

test('Priest appears autonomously and is distinct from the Saint',()=>{
 const s=after(fresh(true,true),14);
 assert.equal(s.religion.priests.length,1);
 assert.ok(s.religion.saints.length>=1);
 assert.ok(!s.religion.saints.includes(s.religion.priests[0]));
 valid(s);
});

test('direct prayer exists with and without Priest; only Priest collects it',()=>{
 const a=after(fresh(true),21),b=after(fresh(false),21);
 const pa=a.religion.prayers.find(p=>p.status==='open'&&p.type==='food-water');
 const pb=b.religion.prayers.find(p=>p.status==='open'&&p.type==='food-water');
 assert.ok(pa&&pb&&pa.by.length&&pb.by.length);
 assert.equal(b.religion.priests.length,0);
 const reports=W.priestPetitions(a,a.religion.priests[0]);
 assert.equal(reports.length,1);assert.equal(reports[0].id,pa.id);
 assert.equal(reports[0].supporterCount,pa.by.length);
 assert.ok(reports[0].settlementName);
 assert.equal(!!pb.collectedBy,false);
 valid(a);valid(b);
});

test('fulfilled petitions leave the bubble without extra faith rewards',()=>{
 const s=after(fresh(true),21),priestId=s.religion.priests[0];
 const target=W.priestPetitions(s,priestId)[0];assert.ok(target);
 assert.equal(W.castRain(s,{x:s.camp.x,y:s.camp.y,radius:8,intensity:1,durationDays:16}).ok,true);
 after(s,28);
 assert.equal(s.religion.prayers.find(p=>p.id===target.id).status,'answered');
 assert.ok(W.priestPetitions(s,priestId).every(p=>p.id!==target.id));
 valid(s);
});

test('a healthy, well-fed community does not invent Priest prayer bubbles',()=>{
 const s=after(fresh(true,true),90);
 assert.equal(W.priestPetitions(s,s.religion.priests[0]).length,0);
 valid(s);
});

test('an actual injured believer prompts a local healing petition',()=>{
 const s=after(fresh(true,true),45),id=s.religion.priests[0];
 s.people.find(p=>p.id==='p1').health=55;
 after(s,1);
 const petition=W.priestPetitions(s,id).find(p=>p.type==='healing');
 assert.ok(petition);
 assert.ok(petition.summary.includes('身體欠佳'));
 valid(s);
});

test('regional requests belong to local clergy, not a worldwide Priest',()=>{
 const s=after(fresh(true,true),120),original=s.settlements[0],homes=s.households.slice(-2);
 const next={...copy(original),id:'s2',name:'試驗拓荒聚落',x:Math.min(s.width-3,original.x+19),
  y:original.y+1,foundedAtHour:s.hour,householdIds:homes.map(h=>h.id),
  storage:{food:0,wood:0,stone:0,fiber:0},granary:null,foodShortageDays:0,lastDailyUnmetFood:0};
 original.householdIds=original.householdIds.filter(id=>!next.householdIds.includes(id));
 s.settlements.push(next);
 for(const [i,h] of homes.entries()){
  h.x=next.x+i;h.y=next.y;h.inventory.food=0;
  for(const id of h.members){const p=s.people.find(p=>p.id===id);p.x=h.x;p.y=h.y;p.settlementId=next.id;}
 }
 for(const t of s.tiles)if(Math.hypot(t.x-next.x,t.y-next.y)<13){
  t.forage=0;if(t.terrain==='field'){t.cropStock=0;t.crop=0;t.moisture=.02;}
 }
 after(s,1);
 const remote=s.religion.priests.find(id=>s.people.find(p=>p.id===id)?.settlementId==='s2');
 assert.ok(remote);
 assert.ok(W.priestPetitions(s,remote).some(p=>p.settlementId==='s2'&&p.supporterCount>0));
 for(const id of s.religion.priests.filter(id=>id!==remote))
  assert.ok(W.priestPetitions(s,id).every(p=>p.settlementId!=='s2'));
 valid(s);
});

test('same-seed no-Priest ablation reduces consolidation without changing Miracle inputs',()=>{
 const withPriest=after(fresh(true,true),180),without=after(fresh(false,true),180);
 assert.ok(withPriest.religion.priests.length);
 assert.equal(without.religion.priests.length,0);
 assert.ok(W.stats(withPriest).avgDevotion>W.stats(without).avgDevotion);
 assert.ok(W.stats(withPriest).followers>=W.stats(without).followers);
 assert.equal(withPriest.counts.rainCasts,without.counts.rainCasts);
 valid(withPriest);valid(without);
});

test('collected request assignments preserve exact save/replay semantics',()=>{
 const a=after(fresh(true),21),b=W.restore(JSON.stringify(a));
 assert.deepEqual(b,a);
 assert.ok(W.priestPetitions(b,b.religion.priests[0]).length);
 after(a,14);after(b,14);
 assert.deepEqual(b,a);valid(b);
});

test('Priest separately strengthens recruitment and may convert weak but never committed rivals',()=>{
 for(const seed of ['valley-spring-01','calm-river','river-dawn-01']){
  const scenario=enabled=>{
    const s=W.create({seed,balanceProfile:ag,
      religionProfile:{...religion,priesthoodEnabled:enabled}});
    for(const id of ['p10','p11','p13','p14','p19','p20']){
      const p=s.people.find(v=>v.id===id);p.religionId=null;p.devotion=8;
    }
    for(const id of ['p16','p17','p22','p23']){
      const p=s.people.find(v=>v.id===id);p.religionId='rival';p.devotion=29;
    }
    const committed=s.people.find(v=>v.id==='p24');
    committed.religionId='rival';committed.devotion=65;
    after(s,110);
    return s;
  };
  const withPriest=scenario(true),noPriest=scenario(false);
  assert.ok(withPriest.counts.newBelievers>noPriest.counts.newBelievers,
    seed+': local Priest should distinctly accelerate adoption of the same cohort');
  assert.ok(withPriest.counts.priestAdoptions>0,'Priest has independently counted converts');
  assert.ok(withPriest.counts.rivalConversions>=2,'weak foreign faith can convert after sustained real preaching');
  assert.ok(withPriest.counts.rivalDoubts>0,'foreign faith must weaken before conversion');
  assert.equal(noPriest.counts.priestAdoptions,0);
  assert.equal(noPriest.counts.rivalConversions,0);
  assert.equal(noPriest.counts.rivalDoubts,0);
  assert.equal(withPriest.people.find(p=>p.id==='p24').religionId,'rival');
  assert.equal(withPriest.people.find(p=>p.id==='p24').devotion,65);
  assert.equal(noPriest.people.find(p=>p.id==='p24').devotion,65);
  valid(withPriest);valid(noPriest);
 }
});

test('weak foreign faith does not flip immediately, and old profile defaults migrate safely',()=>{
 const s=fresh(true);
 const weak=s.people.find(p=>p.id==='p8');
 weak.religionId='rival';weak.devotion=35;
 after(s,11);
 assert.equal(weak.religionId,'rival','Priest teaching is not instant coercion');
 assert.ok(weak.devotion>=20,'initial contact must not instantly erase an existing belief');
 valid(s);

 const legacy=after(fresh(true,true),23);
 legacy.religionPropagation.priestJoinChance=.075;
 delete legacy.religionPropagation.priestRivalDoubtChance;
 delete legacy.religionPropagation.priestRivalConversionChance;
 delete legacy.religionPropagation.priestRivalDoubtStep;
 delete legacy.counts.priestAdoptions;
 delete legacy.counts.rivalConversions;
 delete legacy.counts.rivalDoubts;
 const previous=copy({people:legacy.people,households:legacy.households,
  settlements:legacy.settlements,events:legacy.events,prayers:legacy.religion.prayers});
 const loaded=W.restore(JSON.stringify(legacy));
 assert.equal(loaded.religionPropagation.priestJoinChance,religion.priestJoinChance);
 assert.equal(loaded.religionPropagation.priestRivalDoubtStep,religion.priestRivalDoubtStep);
 assert.equal(loaded.counts.priestAdoptions,0);
 assert.equal(loaded.counts.rivalConversions,0);
 assert.deepEqual({people:loaded.people,households:loaded.households,
  settlements:loaded.settlements,events:loaded.events,prayers:loaded.religion.prayers},previous);
 valid(loaded);
});

test('open prayer centers expose real evaluation origin, including founding-area legacy saves',()=>{
  const s=after(fresh(true),21);
  const prayer=s.religion.prayers.find(p=>p.type==='food-water'&&p.status==='open');
  assert.ok(prayer,'founding-area water petition must be real');
  const location=W.prayerLocation(s,prayer.id);
  assert.deepEqual(location.center,{x:s.camp.x,y:s.camp.y});
  assert.equal(location.radius,11,'water demand is evaluated over nearby fields');
  const reports=W.priestPetitions(s,s.religion.priests[0]);
  const collected=reports.find(v=>v.id===prayer.id);
  assert.deepEqual(collected.location.center,location.center);
  const legacy=copy(prayer);delete legacy.center;
  const fallback=W.prayerLocation(s,legacy);
  assert.deepEqual(fallback.center,location.center);
  assert.equal(fallback.source,'founding-fallback');
  assert.equal(W.prayerLocation(s,'missing-need'),null);
  valid(s);
});

test('several regional water needs preserve separate, stable centers for map navigation',()=>{
  const s=after(fresh(true,true),22);
  const locs=[{x:8,y:12},{x:26,y:36},{x:49,y:45}];
  const ids=[];
  for(const [i,center] of locs.entries()){
    const id='need-locator-'+i;ids.push(id);
    s.religion.prayers.push({id,type:'food-water',status:'open',center,
      settlementId:'region-'+i,by:['p1'],createdAtHour:s.hour,
      needSummary:'附近農田真實缺雨',collectedBy:null});
  }
  const points=ids.map(id=>W.prayerLocation(s,id).center);
  assert.deepEqual(points,locs,'each request must retain its own origin');
  assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,3);
  const saved=W.restore(JSON.stringify(s));
  assert.deepEqual(ids.map(id=>W.prayerLocation(saved,id).center),locs);
  valid(saved);
});
