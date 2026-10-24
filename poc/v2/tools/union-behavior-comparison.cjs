'use strict';
// Explicit controlled counterfactuals from the day before a natural union.
const W=require('../src/sim.js'),E=require('./religion-politics-causality.cjs'),Q=require('./union-pressure-scenarios.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function source(seed){const s=E.fresh(seed);let before=JSON.stringify(s);
  for(let d=1;d<=180;d++){before=JSON.stringify(s);W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
    const u=s.politics.unions.find(u=>!Number.isFinite(u.dissolvedAtHour));if(!u)continue;
    const nonCentral=s.politics.polities.filter(p=>u.memberPolityIds.includes(p.id)&&p.leaderId!==u.leaderId).map(p=>p.id);
    return {seed,snapshot:before,hash:E.hash(before),startDay:s.hour/24-1,target:structuredClone(u),
      policyContext:Q.contextFor(s,u),vacancyContext:Q.contextFor(s,u,nonCentral)};
  }return {seed,notApplicable:'no natural union by day180'};
}
function run(src,scenario,unionEnabled){
  assert.ok(['member-treaty','central-vacancy','joint-authorization'].includes(scenario));
  const ctx=scenario==='central-vacancy'?src.vacancyContext:src.policyContext;
  if(!ctx)return {seed:src.seed,scenario,unionEnabled,notApplicable:'no feasible fixed third-party context for selected local actor'};
  const s=W.restore(src.snapshot);assert.equal(E.hash(s),src.hash);
  const intervention={type:'upper-layer counterfactual only',before:s.politics.diplomacy.union.enabled,after:unionEnabled};
  s.politics.diplomacy.union.enabled=unionEnabled;
  W.advanceTicks(s,3); // source naturally forms target union here; no injected union object.
  if(unionEnabled)assert.ok(s.politics.unions.some(u=>u.memberPolityIds.includes(ctx.actorId)&&u.memberPolityIds.includes(ctx.peerId)));
  const c=Q.controller({startDay:s.hour/24,context:ctx},'combined_transient'),startHour=s.hour;
  const activityDays={},rows=[],initialCounts={...s.counts},initialDisputes=s.politics.disputes.length;
  let displacement=0,death=null;
  for(let day=1;day<=28;day++){
    Q.interventions(s,c,day);
    if(day===1&&scenario!=='member-treaty'){
      const r=s.politics.diplomacy.relations.find(r=>[r.aId,r.bId].includes(ctx.peerId)&&[r.aId,r.bId].includes(ctx.outsideId));
      const before=structuredClone(r);r.status='competition';r.peaceAtHour=null;r.allianceAtHour=null;
      r.renegotiateAfterHour=Math.max(r.renegotiateAfterHour||0,startHour+14*24);
      c.policies.push({hour:s.hour,description:'both local members contest the external quarry; isolates central command instead of treaty veto',before,after:structuredClone(r)});
      if(scenario==='central-vacancy'){
      const other=s.politics.polities.find(p=>p.id===ctx.actorId),head=other.leaderId;
      assert.notEqual(head,src.target.leaderId,'local actor must survive the same injected death');
      death={hour:s.hour,id:src.target.leaderId,result:W.die(s,src.target.leaderId,'controlled same-person leader death in both arms')};
      assert.equal(death.result.ok,true);assert.equal(other.leaderId,head);
      }
    }
    const units=new Map(s.politics.polities.map(p=>[p.id,{x:p.militia.x,y:p.militia.y}]));
    W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
    for(const p of s.politics.polities.filter(p=>[ctx.actorId,ctx.peerId].includes(p.id))){
      const before=units.get(p.id);displacement+=Math.abs(before.x-p.militia.x)+Math.abs(before.y-p.militia.y);
      for(const id of p.militia.memberIds){const person=s.people.find(p=>p.id===id&&p.alive);if(person)activityDays[person.activity]=(activityDays[person.activity]||0)+1;}}
    rows.push({day,worldDay:s.hour/24,locals:s.politics.polities.filter(p=>[ctx.actorId,ctx.peerId].includes(p.id)).map(p=>({id:p.id,leader:p.leaderId,
      stance:p.militia.stance,x:p.militia.x,y:p.militia.y,people:[...p.militia.memberIds]})),
      central:s.politics.unions.filter(u=>!Number.isFinite(u.dissolvedAtHour)).map(u=>({id:u.id,leader:u.leaderId,until:u.vacantUntilHour}))});
  }
  assert.ok(Object.values(c.escrow).every(v=>v===0));
  const endpoint=JSON.parse(JSON.stringify(s)),copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s);
  const target=endpoint.politics.disputes.filter(d=>d.startedAtHour>=startHour&&[d.aId,d.bId].includes(ctx.actorId)&&[d.aId,d.bId].includes(ctx.outsideId));
  return {seed:src.seed,scenario,unionEnabled,sourceHash:src.hash,worldStartDay:startHour/24,days:28,context:ctx,intervention,death,
    summary:{targetIncidents:target.length,allNewIncidents:endpoint.politics.disputes.length-initialDisputes,
      coordinatedSorties:endpoint.politics.unions.reduce((n,u)=>n+u.decisions.length,0),recordedGridDisplacement:displacement,
      actualMilitiaActivityDays:activityDays,foodFromLabor:endpoint.counts.foodFromLabor-initialCounts.foodFromLabor,
      targetQuarryStoneWon:endpoint.politics.claims.filter(q=>q.hour>=startHour&&[ctx.actorId,ctx.peerId].includes(q.polityId)).reduce((n,q)=>n+q.stoneGathered,0)},
    targetIncidents:target,unionDecisions:endpoint.politics.unions.flatMap(u=>u.decisions),rows,externalInterventions:c,
    validation:'same full pre-formation source; only union flag differs within pair; same real death where specified; daily valid and endpoint replay'};
}
if(require.main===module){const start=performance.now(),results=[],sources=[];
  for(const seed of E.SEEDS){const src=source(seed);const {snapshot,...meta}=src;sources.push(meta);
    for(const scenario of ['member-treaty','central-vacancy','joint-authorization'])for(const enabled of [false,true]){
      const r=run(src,scenario,enabled);results.push(r);console.log(seed,scenario,enabled?'union':'alliance',JSON.stringify(r.summary||r.notApplicable));}}
  const out=path.resolve(__dirname,'../reports/issue-14-union-behavior-2026-10-24.json');
  fs.writeFileSync(out,JSON.stringify({issue:14,baseCommit:'dfab2d4',node:process.version,elapsedMs:performance.now()-start,
    category:'controlled full-world fork; never a natural war rate',sources,results},null,2)+'\n');console.log(out);
}
module.exports={source,run};
