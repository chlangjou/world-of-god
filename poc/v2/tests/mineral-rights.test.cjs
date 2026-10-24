'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const M=require('../src/mobility.js');
const Mobility=require('../config/mobility-contact-v0.1.json');
const Politics=require('../config/polity-command-v0.1.json');
const Experiment=require('../config/mineral-rights-experiment-v0.1.json');
const Agriculture=require('../config/balance-agriculture-v0.1.json');
const Opponent=require('../config/opponent-v0.2.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function options(mode='rights',override={}){
  const finite=mode!=='legacy';
  return {seed:'valley-spring-01',balanceProfile:Agriculture,opponentProfile:Opponent,
    mobilityProfile:{...Mobility,...(finite?{
      finiteMineralsEnabled:true,
      naturalStoneCapacity:Experiment.naturalStoneCapacity,
      naturalGoldCapacity:Experiment.naturalGoldCapacity,
      naturalStoneRegenPerDay:Experiment.naturalStoneRegenPerDay,
      naturalGoldRegenPerDay:Experiment.naturalGoldRegenPerDay
    }:{})},
    politicsProfile:{...Politics,...(mode==='rights'?{mineralRights:Experiment.mineralRights}:{})},
    ...override};
}
function node(s,kind='stone'){
  const h=s.mobilityHotspots.find(q=>q.kind===kind);
  return s.tiles[h.y*s.width+h.x];
}
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
test('opt-out: no mineral audit or new rights, old perpetual worker extraction is unchanged',()=>{
  const a=W.create(options('legacy')),b=W.create(options('legacy',{
    mobilityProfile:{...Mobility,finiteMineralsEnabled:false},
    politicsProfile:{...Politics,mineralRights:{enabled:false}}
  }));
  assert.deepEqual(a,b);
  const t=node(a),before=t.stone;
  assert.equal(M.extract(a,t,'stone',1.5,'n1'),1.5);
  assert.equal(t.stone,before,'legacy worker can take repeated stone');
  assert.equal(M.extract(a,t,'stone',1.5,'n1',true),1.5);
  assert.equal(t.stone,before-1.5,'legacy battle spoils still debit');
  assert.equal(t.mineral,undefined);
  assert.equal(a.politics.quarryClaims,undefined);
  good(a);
});
test('opt-in natural stone/gold source: cap, atomic shared withdrawals, partial cargo, depletion, slow renewal',()=>{
  const s=W.create(options('finite')),t=node(s),d=t.mineral;
  assert.equal(d.origin,'natural');assert.ok(d.regenPerDay>0);
  assert.equal(d.capacity,Experiment.naturalStoneCapacity);
  assert.equal(d.available,d.capacity);
  assert.equal(node(s,'gold').mineral.regenPerDay,Experiment.naturalGoldRegenPerDay);
  assert.equal(M.extract(s,t,'stone',10,'n1'),10);
  assert.equal(M.extract(s,t,'stone',24,'s2'),24);
  assert.equal(M.extract(s,t,'stone',100,'n1'),4);
  assert.equal(M.extract(s,t,'stone',1,'s2'),0);
  assert.equal(d.available,0);assert.equal(t.stone,0);
  assert.deepEqual(d.byTown,{n1:14,s2:24});
  assert.equal(d.extracted,38);
  const adult=s.people.find(p=>p.alive&&p.stage==='adult');
  const trip={purpose:'resource',path:[t.y*s.width+t.x]};
  M.gather(s,adult,trip);
  assert.equal(trip.cargo,undefined,'empty site creates no cargo');
  M.regenerate(s);
  assert.equal(d.available,d.regenPerDay);
  M.gather(s,adult,trip);
  assert.ok(Math.abs(trip.cargo.amount-d.regenPerDay)<1e-9,'remote worker receives only actual remainder');
  assert.equal(d.available,0);
  const battle=M.extract(s,t,'stone',1.5,'n1',true);
  assert.equal(battle,0,'battle and workers share depleted ledger');
  for(let i=0;i<1000;i++)M.regenerate(s);
  assert.equal(d.available,d.capacity,'renewal may not exceed natural capacity');
  assert.ok(d.regenerated>0);
  good(s);
});
test('finite mode conserves material for different real workers and retains it over replay',()=>{
  const s=W.create(options('finite')),t=node(s),d=t.mineral;
  const a=s.people.find(p=>p.alive&&p.stage==='adult');
  const b=s.people.find(p=>p.alive&&p.stage==='adult'&&p.settlementId!==a.settlementId);
  assert.ok(b,'two real towns exist');
  for(const person of [a,b]){
    const trip={purpose:'resource',path:[t.y*s.width+t.x]};
    M.gather(s,person,trip);
    assert.equal(trip.cargo.kind,'stone');
    assert.ok(trip.cargo.amount>0);
  }
  assert.equal(Object.values(d.byTown).length,2);
  assert.ok(Math.abs(d.capacity+d.regenerated-d.extracted-d.available)<1e-7);
  W.advanceTicks(s,3*6);good(s);
  const clone=W.restore(JSON.stringify(s));
  assert.deepEqual(clone,s);
  W.advanceTicks(s,3);W.advanceTicks(clone,3);
  assert.deepEqual(clone,s);
});
test('guard rights are declared by a living leader; actual travel precedes protection; protection costs a worker',()=>{
  const policy={...Experiment.mineralRights,decisionDays:1,declarationChance:1,maxGuardRoute:200};
  const s=W.create(options('rights',{politicsProfile:{...Politics,mineralRights:policy},
    mobilityProfile:{...Mobility,finiteMineralsEnabled:true,
      naturalStoneCapacity:38,naturalStoneRegenPerDay:.16,
      naturalGoldCapacity:18,naturalGoldRegenPerDay:.08,
      tripChancePerDay:0,missionBaseChancePerDay:0,missionSpreadChancePerDay:0}}));
  const target=node(s);M.extract(s,target,'stone',32,'n1'); // explicit controlled supply pressure
  W.advanceTicks(s,3);
  assert.ok(s.politics.quarryClaims.length>=1,'a real mayor can declare under the threshold');
  assert.equal(s.politics.disputes.length,0,'low supply alone never starts a full war');
  const mine=s.politics.quarryClaims.find(q=>q.site.x===target.x&&q.site.y===target.y);
  assert.ok(mine);
  assert.ok(mine.declaredAtHour>0);
  assert.equal(mine.status==='protected'&&mine.guardId===null,false);
  let protectedAt=Infinity;
  for(let i=0;i<40;i++){
    W.advanceTicks(s,3);
    if(mine.status==='protected'){protectedAt=s.hour;break;}
  }
  assert.ok(Number.isFinite(protectedAt),'real guard actually reaches mineral site');
  assert.ok(protectedAt>mine.declaredAtHour,'declaration is not instant occupation');
  const guard=s.people.find(p=>p.id===mine.guardId);
  assert.ok(guard.alive);
  assert.equal(guard.activity,'quarry_guard');
  assert.ok(!s.politics.polities.some(p=>p.militia.memberIds.includes(guard.id)));
  const stranger=s.people.find(p=>p.alive&&p.settlementId!==mine.townId);
  assert.ok(stranger);
  assert.equal(M.protectedBy(s,target,stranger)?.id,mine.id);
  const trip={purpose:'resource',path:[target.y*s.width+target.x]};
  M.gather(s,stranger,trip); // controlled actual-arrival guard warning
  assert.equal(trip.cargo,undefined);
  assert.equal(s.politics.quarryEncounters.at(-1).outcome,'guard-warning');
  good(s);
  W.die(s,guard.id,'受控守衛離世');
  assert.equal(M.protectedBy(s,target,stranger),null,'no invisible ownership wall without guard');
  good(s);
});
test('30-day natural world remains valid and restores deterministically, no injected miners/claims',()=>{
  const s=W.create(options('rights'));W.advanceTicks(s,3*30);
  good(s);
  assert.ok(s.counts.resourceVisitsStarted>0);
  assert.ok(s.mobilityHotspots.some(q=>s.tiles[q.y*s.width+q.x]?.mineral?.extracted>0));
  assert.equal(s.politics.disputes.length,0,'shared mine alone does not trigger old skirmish');
  const loaded=W.restore(JSON.stringify(s));assert.deepEqual(loaded,s);
  W.advanceTicks(s,3);W.advanceTicks(loaded,3);assert.deepEqual(loaded,s);
});
