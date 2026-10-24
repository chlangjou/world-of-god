'use strict';
// Bounded local-only Issue #14 study. Natural arms never inject faith, stock or contacts.
const W=require('../src/sim.js'),P=require('../src/politics.js');
const {options}=require('./diplomacy-experiment.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
function stressVacancy(source){
  const s=W.restore(JSON.stringify(source)),u=s.politics.unions[0],victim=u.leaderId;
  const localBefore=P.unionOf(s,u.memberPolityIds[0]);assert.ok(localBefore);
  const others=s.politics.polities.filter(p=>u.memberPolityIds.includes(p.id)&&p.leaderId!==victim);
  const snapshot=others.map(p=>({id:p.id,leaderId:p.leaderId,members:[...p.militia.memberIds],
    defense:P.defense(s,p,s.settlements.find(t=>t.id===p.townId))}));
  const storage=JSON.stringify(s.settlements.map(t=>[t.id,t.storage]));
  assert.equal(W.die(s,victim,'controlled intervention: common leader death').ok,true);
  assert.equal(JSON.stringify(s.settlements.map(t=>[t.id,t.storage])),storage);
  for(const before of snapshot){const p=s.politics.polities.find(p=>p.id===before.id);
    assert.equal(p.leaderId,before.leaderId);assert.deepEqual(p.militia.memberIds,before.members);
    assert.deepEqual(P.defense(s,p,s.settlements.find(t=>t.id===p.townId)),before.defense);}
  const deathAt=s.hour,deadline=u.vacantUntilHour,duration=(deadline-deathAt)/24;
  assert.ok(duration>=90&&duration<=180);assert.equal(u.leaderId,null);
  const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  const localStates=[];
  for(let d=0;d<=duration;d++){
    W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
    if(s.hour<deadline)assert.equal(u.leaderId,null,'cannot skip central vacancy');
    if(d===0||s.hour>=deadline)localStates.push({hour:s.hour,centralLeader:u.leaderId,
      locals:s.politics.polities.filter(p=>u.memberPolityIds.includes(p.id)).map(p=>({id:p.id,leader:p.leaderId,militia:p.militia.memberIds.length,stance:p.militia.stance}))});
  }
  assert.ok(!s.politics.disputes.some(c=>c.startedAtHour>deathAt&&c.startedAtHour<deadline&&
    u.memberPolityIds.some(id=>[c.aId,c.bId].includes(id))),'central vacancy blocks new union offense');
  return {type:'controlled fork of first naturally formed union; one real death injected',unionId:u.id,
    victim,deathDay:deathAt/24,scheduledVacancyDays:duration,scheduledSuccessionDay:deadline/24,
    unaffectedLocalLeaders:snapshot.map(p=>({id:p.id,leaderId:p.leaderId})),
    survivedImmediately:true,stockUnchangedAtDeath:true,centralHistory:u.history,localStates,
    validation:'daily valid; no premature successor or new offense; local defense retained at death; save roundtrip passed'};
}
function run(seed,enabled,days=180){
  assert.ok(SEEDS.includes(seed));assert.ok(Number.isInteger(days)&&days>=1&&days<=180);
  const s=W.create(options(seed,true,enabled)),genesis={people:structuredClone(s.people),households:structuredClone(s.households),settlements:structuredClone(s.settlements)};
  const start=performance.now(),moments=[];let firstUnionSource=null;
  for(let d=1;d<=days;d++){
    W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[],seed+' day '+d);
    if(enabled&&!firstUnionSource&&s.politics.unions?.some(u=>u.leaderId))firstUnionSource=JSON.stringify(s);
    if([30,60,120,180].includes(d))moments.push({day:d,unions:structuredClone(s.politics.unions||[]),
      localPolities:s.politics.polities.map(p=>({id:p.id,town:p.townId,leader:p.leaderId,militia:[...p.militia.memberIds]}))});
  }
  const endpoint=structuredClone(s),copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(s,copy);
  const unions=endpoint.politics.unions||[],shipments=endpoint.politics.diplomacy.shipments;
  return {seed,unionEnabled:enabled,days,elapsedMs:performance.now()-start,genesis,moments,unions,
    conflicts:endpoint.politics.disputes,relations:endpoint.politics.diplomacy.relations,
    shipments:shipments.map(({path,...q})=>({...q,pathCells:path.length})),
    villageStocks:endpoint.settlements.map(t=>({id:t.id,storage:t.storage})),
    summary:{unions:unions.length,firstUnionDay:unions.length?Math.min(...unions.map(u=>u.formedAtHour/24)):null,
      conflicts:endpoint.politics.disputes.length,coordinatedSorties:unions.reduce((n,u)=>n+u.decisions.length,0),
      deliveredBatches:shipments.filter(q=>q.delivered).length,deliveredUnits:shipments.filter(q=>q.delivered).reduce((n,q)=>n+q.amount,0),
      commonLeaderVacancies:unions.reduce((n,u)=>n+u.history.filter(e=>e.type==='vacancy').length,0)},
    validation:'every day valid; exact save roundtrip and extra-day deterministic replay',
    controlledDeathFork:firstUnionSource?stressVacancy(W.restore(firstUnionSource)):null};
}
if(require.main===module){
  const start=performance.now(),results=[];
  for(const seed of SEEDS){for(const enabled of [false,true]){
    const r=run(seed,enabled);results.push(r);console.log(seed,enabled?'union':'alliance-only',JSON.stringify(r.summary));}
    assert.deepEqual(results.at(-1).genesis,results.at(-2).genesis,'same natural genesis');}
  const out=path.resolve(__dirname,'../reports/issue-14-political-union-2026-10-24.json');
  fs.writeFileSync(out,JSON.stringify({issue:14,baseCommit:'f244a8d',node:process.version,
    elapsedMs:performance.now()-start,unionProfile:require('../config/polity-command-v0.1.json').diplomacy.union,
    note:'Natural 180-day A/B plus separately labelled controlled-death forks; no CI workloads added',results},null,2)+'\n');
  console.log(out);
}
module.exports={run,stressVacancy};
