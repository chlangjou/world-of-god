'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');

function fresh(){return W.create({seed:'divine-direct-check',balanceProfile:agriculture,divineProfile:divine});}
function nearestField(s){
  return s.tiles.filter(t=>t.terrain==='field')
    .sort((a,b)=>Math.hypot(a.x-s.camp.x,a.y-s.camp.y)-Math.hypot(b.x-s.camp.x,b.y-s.camp.y))[0];
}
function canCast(s){s.god.dp=s.god.cap;}
function advanceDays(s,days){W.advanceTicks(s,days*3);}
function valid(s){const v=W.validate(s);assert.equal(v.ok,true,v.errors.join(';'));}

test('Miracle catalog has separate cooldown and Mastery; rejected casts do not spend DP',()=>{
  const s=fresh();
  const list=['rain','ripening','harvest','heal','efficiency','drought','lightning','confusion','blindness'];
  for(const type of list)assert.ok(s.god.skills[type],type);
  const start=s.god.dp;
  assert.equal(W.castMiracle(s,'ripening',{x:-1,y:5}).ok,false);
  assert.equal(W.castMiracle(s,'unknown',{x:s.camp.x,y:s.camp.y}).ok,false);
  assert.equal(s.god.dp,start);
  valid(s);
});

test('Ripening replenishes real harvested crop stock and expires without creating Food',()=>{
  const s=fresh(),plot=nearestField(s),food=W.stats(s).food;
  plot.cropStock=0;plot.crop=0;canCast(s);
  const cast=W.castMiracle(s,'ripening',{x:plot.x,y:plot.y,radius:5,intensity:1.4,durationDays:2});
  assert.equal(cast.ok,true,cast.reason);
  assert.ok(s.god.skills.ripening.readyAtHour>s.hour);
  assert.equal(s.god.skills.harvest.readyAtHour,0,'independent skill cooldowns');
  assert.equal(W.stats(s).food,food);
  W.advanceTicks(s,1);
  assert.ok(plot.cropStock>0,'existing agricultural stock must regenerate');
  const L=s.agriculture.land;
  const cap=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*plot.fertility*
    Math.pow(1/L.referenceMoisture,L.moistureExponent)*L.cropStockCapacityDays;
  assert.ok(plot.cropStock<=cap+1e-8,'Ripening must not enlarge stock capacity');
  advanceDays(s,2);
  assert.ok(!s.effects.some(e=>e.type==='ripening'),'timed Miracle expires');
  valid(s);
});

test('Harvest improves physical standing crop, not stored Food or regeneration clock',()=>{
  const s=fresh(),plot=nearestField(s);canCast(s);
  const old=plot.cropStock,food=W.stats(s).food;
  const result=W.castMiracle(s,'harvest',{x:plot.x,y:plot.y,radius:4,intensity:1});
  assert.equal(result.ok,true,result.reason);
  assert.ok(plot.cropStock>old);
  assert.equal(W.stats(s).food,food);
  assert.equal(s.effects.some(e=>e.type==='harvest'),false,'Harvest is instantaneous, not Ripening');
  valid(s);
});

test('Heal heals injuries; Lightning does real damage without friendly immunity',()=>{
  const s=fresh(),p=s.people[0];p.health=42;canCast(s);
  const h=W.castMiracle(s,'heal',{x:p.x,y:p.y,radius:2,intensity:1});
  assert.equal(h.ok,true,h.reason);
  assert.ok(p.health>42);
  canCast(s);
  const prior=p.health;
  const bolt=W.castMiracle(s,'lightning',{x:p.x,y:p.y,radius:2,intensity:1});
  assert.equal(bolt.ok,true,bolt.reason);
  assert.ok(p.health<prior,'our own follower is not immune to lightning');
  valid(s);
});

test('Efficiency and debuffs coexist, refresh within caps and expire with simulated time',()=>{
  const s=fresh(),p=s.people[0];canCast(s);
  const good=W.castMiracle(s,'efficiency',{x:p.x,y:p.y,radius:4,intensity:1,durationDays:2});
  assert.equal(good.ok,true,good.reason);
  assert.ok(W.activeStatus(s,p,'efficiency')>0);
  canCast(s);
  assert.equal(W.castMiracle(s,'confusion',{x:p.x,y:p.y,radius:4,intensity:1,durationDays:2}).ok,true);
  canCast(s);
  assert.equal(W.castMiracle(s,'blindness',{x:p.x,y:p.y,radius:4,intensity:1,durationDays:2}).ok,true);
  assert.ok(W.activeStatus(s,p,'confusion')>0);
  assert.ok(W.activeStatus(s,p,'blindness')>0);
  const id=p.religionId;W.advanceTicks(s,1);
  assert.ok(p.lastDecision?.reason?.includes('混亂'),'decision scores must actually be affected');
  assert.ok(p.lastDecision?.reason?.includes('致盲'),'perceptual work path must see blindness');
  assert.equal(p.religionId,id,'a debuff may not directly change religious identity');
  advanceDays(s,2);
  for(const type of ['efficiency','confusion','blindness'])assert.equal(W.activeStatus(s,p,type),0);
  valid(s);
});

test('Religion Spread goes through Saint and real leisure sermons, never food Calling',()=>{
  const s=fresh();advanceDays(s,15);
  const saint=s.religion.saints[0];assert.ok(saint);
  const issued=W.issueOracle(s,{saintId:saint,intentType:'religion.spread'});
  assert.equal(issued.ok,true,issued.reason);
  const duplicate=W.issueOracle(s,{saintId:saint,intentType:'religion.spread'});
  assert.equal(duplicate.ok,false);
  const food=W.issueOracle(s,{saintId:saint,intentType:'food.produce'});
  assert.equal(food.ok,true,'different Saint intent types remain independent');
  advanceDays(s,12);
  const spread=s.religion.oracles.find(o=>o.id===issued.oracleId);
  assert.ok(spread.influenceSermonCount>0,'actual sermons should occur');
  assert.equal(spread.influenceWorkCount,0,'religion.spread must not receive food work credit');
  assert.equal(spread.fulfillmentCredited,false,'religion.spread must not receive food-faith reward');
  valid(s);
});

test('Save/restore preserves timed Miracles, statuses, seed and progression',()=>{
  const s=fresh(),p=s.people[0];canCast(s);
  assert.equal(W.castMiracle(s,'ripening',{x:s.camp.x,y:s.camp.y}).ok,true);
  canCast(s);assert.equal(W.castMiracle(s,'efficiency',{x:p.x,y:p.y}).ok,true);
  const b=W.restore(JSON.stringify(s));
  assert.deepEqual(b,s);
  W.advanceTicks(s,9);W.advanceTicks(b,9);
  assert.deepEqual(b,s);
  valid(b);
});

test('A no-presence location cannot authorize offensive high-tier casting',()=>{
  const s=fresh();
  for(const p of s.people){p.religionId=null;p.devotion=0;}
  canCast(s);const before=s.god.dp;
  const attempt=W.castMiracle(s,'drought',{x:s.camp.x,y:s.camp.y});
  assert.equal(attempt.ok,false);
  assert.equal(s.god.dp,before);
});

test('Drought is bounded physical water pressure and expires on simulation time',()=>{
  const s=fresh(),plot=nearestField(s);canCast(s);
  plot.moisture=.95; // known moist soil fixture: direct drying will be observable
  const cast=W.castMiracle(s,'drought',{x:plot.x,y:plot.y,radius:5,intensity:1.5,durationDays:2});
  assert.equal(cast.ok,true,cast.reason);
  const before=plot.moisture;
  W.advanceTicks(s,1);
  assert.ok(plot.moisture<before,'direct drought pressure changes real soil water');
  advanceDays(s,2);
  assert.ok(!s.effects.some(e=>e.type==='drought'));
  valid(s);
});

test('Original model also accepts Ripening without fabricating Food',()=>{
  const s=W.create({seed:'original-divine-compat'});
  const plot=nearestField(s);assert.ok(plot);
  const food=W.stats(s).food;plot.crop=.06;canCast(s);
  const cast=W.castMiracle(s,'ripening',{x:plot.x,y:plot.y,radius:4,intensity:1,durationDays:2});
  assert.equal(cast.ok,true,cast.reason);
  W.advanceTicks(s,1);
  assert.ok(plot.crop>.06,'Original fractional crop must grow through same actual field process');
  assert.equal(W.stats(s).food,food,'Miracle by itself must not put Food in family/common inventory');
  valid(s);
});
