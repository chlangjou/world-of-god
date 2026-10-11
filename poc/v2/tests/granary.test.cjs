'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const profile=require('../config/balance-agriculture-v0.1.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=(seed='valley-spring-01')=>W.create({seed,balanceProfile:profile});
const afterDays=(s,days)=>{W.advanceTicks(s,days*3);return s};
function valid(s){const r=W.validate(s);assert.equal(r.ok,true,r.errors.join('\n'))}

test('a settlement proposes a real granary rather than spawning a completed building',()=>{
 const s=fresh();
 let day=0;while(!s.settlements.length&&day++<100)afterDays(s,1);
 assert.equal(s.settlements.length,1);
 const town=s.settlements[0];
 assert.equal(town.granary.built,false,'settlement founding must not conjure a finished building');
 assert.equal(town.granary.materialsPaid,false);
 assert.equal(town.granary.progress,0);
 assert.equal(town.storage.food,0,'new shared storage is empty, not filled by founding');
 assert.ok(town.granary.x>=0&&town.granary.x<s.width&&town.granary.y>=0&&town.granary.y<s.height);
 assert.notEqual(s.tiles[town.granary.y*s.width+town.granary.x].terrain,'river');
 valid(s);
});

test('real communal materials and adult construction produce the first granary',()=>{
 for(const seed of ['valley-spring-01','calm-river','river-dawn-01']){
  const s=fresh(seed);afterDays(s,90);
  const t=s.settlements[0];
  assert.ok(t.granary?.built,seed+' must autonomously build a granary');
  assert.equal(t.granary.materialsPaid,true,'real Wood/Stone must be deducted before building');
  assert.ok(t.granary.progress>=profile.granary.workRequired);
  assert.ok(s.events.some(e=>e.kind==='settlement'&&e.text.includes('公共糧倉完工')));
  assert.ok(t.storage.food>0,'communal production still accumulates at that town');
  valid(s);
 }
});

test('granary cannot finish when stone is physically unavailable; materials are not created',()=>{
 const s=fresh();
 let day=0;while(!s.settlements.length&&day++<100)afterDays(s,1);
 const t=s.settlements[0];
 assert.equal(t.granary.materialsPaid,false);
 for(const tile of s.tiles)tile.stone=0;
 t.storage.stone=0;
 afterDays(s,40);
 assert.equal(t.granary.built,false,'a project cannot pay for stone that does not exist');
 assert.equal(t.granary.materialsPaid,false);
 const h=s.households.find(h=>t.householdIds.includes(h.id));
 const stone=s.tiles.find(cell=>cell.terrain!=='river'&&Math.abs(cell.x-h.x)<=5&&Math.abs(cell.y-h.y)<=5);
 assert.ok(stone);
 stone.stone=80; // controlled local input source, not free public inventory
 afterDays(s,100);
 assert.ok(t.granary.built,'local workers can gather genuine stone and complete the project');
 valid(s);
});

test('new outpost settlements autonomously build their own granaries and stores',()=>{
 const s=fresh();afterDays(s,100);
 const F=s.agriculture.familyExpansion;
 F.pioneerAfterHouseholds=8;F.pioneerChance=1;F.pairChancePerMonth=1;F.maxCouplesPerMonth=3;
 const mother=s.people.find(p=>p.genderRole==='gestate'&&p.stage==='adult');
 const father=s.people.find(p=>p.genderRole==='fertilize'&&p.stage==='adult');
 for(let i=0;i<8;i++){
  const a=s.households[i],b=s.households[(i+4)%8];
  const woman={...copy(mother),id:'fixture-w'+i,age:22,partnerId:null,householdId:a.id,
    originHouseholdId:'origin-w'+i,parentIds:[],x:a.x,y:a.y,religionId:null,devotion:0};
  const man={...copy(father),id:'fixture-m'+i,age:23,partnerId:null,householdId:b.id,
    originHouseholdId:'origin-m'+i,parentIds:[],x:b.x,y:b.y,religionId:null,devotion:0};
  a.members.push(woman.id);b.members.push(man.id);s.people.push(woman,man);
 }
 afterDays(s,360);
 assert.ok(s.settlements.length>=2,'must produce a genuine secondary settlement');
 for(const t of s.settlements){
  assert.ok(t.granary?.built,t.name+' should build its own granary');
  assert.ok(t.granary.materialsPaid);
  assert.ok(t.storage.food>0,'public food belongs to the respective settlement');
 }
 assert.equal(s.counts.deaths,0);
 valid(s);
});

test('old saves acquire unbuilt granary proposals without reallocating shared food',()=>{
 const s=fresh();afterDays(s,100);
 const before=copy({people:s.people,households:s.households,settlements:s.settlements,
    tiles:s.tiles,god:s.god});
 for(const t of s.settlements)delete t.granary;
 const legacy=copy({people:s.people,households:s.households,settlements:s.settlements,tiles:s.tiles,god:s.god});
 const restored=W.restore(JSON.stringify(s));
 assert.equal(restored.settlements[0].granary.built,false);
 assert.deepEqual({people:restored.people,households:restored.households,settlements:restored.settlements.map(t=>({...t,granary:undefined})).map(t=>{delete t.granary;return t}),
   tiles:restored.tiles,god:restored.god},legacy);
 assert.equal(restored.settlements[0].storage.food,before.settlements[0].storage.food);
 const saved=W.restore(JSON.stringify(restored));
 assert.deepEqual(saved,restored);
 afterDays(restored,35);afterDays(saved,35);
 assert.deepEqual(saved,restored,'new granary work respects save/replay');
 assert.ok(restored.settlements[0].granary.built);
 valid(restored);
});

test('Original world uses kernel granary defaults without altering its rule snapshot',()=>{
 const s=W.create({seed:'valley-spring-01'});
 afterDays(s,150);
 assert.ok(s.settlements[0].granary?.built);
 valid(s);
});
