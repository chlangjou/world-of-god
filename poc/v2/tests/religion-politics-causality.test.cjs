'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js'),P=require('../src/politics.js'),E=require('../tools/religion-politics-causality.cjs');
function semantic(){const t={id:'town',householdIds:['h']};return {t,s:{politics:{diplomacy:{minCore:3,coreShare:.4}},
  people:Array.from({length:12},(_,i)=>({id:'p'+i,householdId:'h',alive:true,religionId:'r1',devotion:i<3?60:20}))}};}
test('affiliation identity and core cohesion are independent without changing core40',()=>{
  const {s,t}=semantic();assert.equal(P.coreFaith(s,t).id,null);
  assert.equal(P.identityFaith(s,t).id,'r1');assert.equal(P.identityFaith(s,t).core,3);
  assert.equal(P.identityFaith(s,t).believers,12);assert.equal(P.identityFaith(s,t).coreShare,.25);
  s.people.forEach(p=>p.devotion=20);assert.equal(P.identityFaith(s,t).id,'r1');assert.equal(P.identityFaith(s,t).core,0);
  assert.equal(P.coreFaith(s,t).core,0);
});
test('ties and insufficient affiliation do not manufacture a shared identity',()=>{
  const {s,t}=semantic();s.people.forEach((p,i)=>{p.religionId=i<6?'r1':'r2';p.devotion=20;});
  assert.equal(P.identityFaith(s,t).id,null);
  s.people.forEach((p,i)=>{p.religionId=i<2?'r1':null;});assert.equal(P.identityFaith(s,t).id,null);
});
test('off or missing profile switch preserves full legacy world and saves',()=>{
  const a=E.fresh('valley-spring-01'),b=W.restore(JSON.stringify(a));b.politics.diplomacy.identity20Enabled=false;
  const restored=W.restore(JSON.stringify(b));delete restored.politics.diplomacy.identity20Enabled;
  W.advanceTicks(a,6);W.advanceTicks(restored,6);assert.deepEqual(restored,a);
});
test('20+ identity cannot make treaties without actual contact and decision time',()=>{
  const s=E.fresh('valley-spring-01');s.politics.diplomacy.identity20Enabled=true;
  s.mobility.tripChancePerDay=0;s.mobility.missionBaseChancePerDay=0;s.mobility.missionSpreadChancePerDay=0;
  for(const p of s.people){p.religionId=s.religion.id;p.devotion=20;}
  P.daily(s,()=>{},W.die);assert.ok(s.politics.diplomacy.relations.every(r=>r.status==='competition'&&r.trust===0));
  assert.ok(s.politics.diplomacy.relations.some(r=>r.faithAssessment.sameIdentity));
});
test('limited strategy respects absent Saint and cannot overwrite belief or politics',()=>{
  const s=E.fresh('valley-spring-01'),before=JSON.stringify(s);
  assert.equal(s.religion.saints.length,0);const actions=E.limitedAction(s,14,'both');
  assert.equal(actions[0].result.ok,false);assert.equal(JSON.stringify(s),before);
  assert.equal(E.limitedAction(s,21,'oracle_only').length,0);
});
test('read-only political observer restores the original daily API and deterministic behavior',()=>{
  const s=E.fresh('valley-spring-01'),snapshot=JSON.stringify(s),original=P.daily;
  const report=E.run(snapshot,'passive',3);assert.equal(P.daily,original);
  W.advanceTicks(s,9);assert.deepEqual(report.daily.at(-1),E.politicalSnapshot(s));
  assert.equal(report.actions.length,0);assert.equal(report.counters.playerEvidenceUpdates,0);
});
test('religion gate counts actual contact days separately from mere eligibility',()=>{
  const pair={a:'a',b:'b',coreBonus:false,identityBonus:true,leaderBonus:true,identity20Shared:true};
  const result=E.faithGateSummary([{pairs:[{...pair,contactDays:0}]},{pairs:[{...pair,contactDays:1}]},{pairs:[{...pair,contactDays:1}]}]);
  assert.equal(result.identityBonusPairDays,1);assert.equal(result.identityEligiblePairDays,3);
});
test('identity-only A/B changes trust under the same contact while preserving all faith states',()=>{
  const s=E.fresh('valley-spring-01');for(const p of s.people){p.religionId=s.religion.id;p.devotion=20;}
  P.daily(s,()=>{},W.die);const [a,b]=s.politics.polities;s.hour+=24;
  s.contactLog.push({hour:s.hour,aTownId:a.townId,bTownId:b.townId,a:'controlled-a',b:'controlled-b'});
  const copy=W.restore(JSON.stringify(s));copy.politics.diplomacy.identity20Enabled=true;
  const beliefs=JSON.stringify(s.people.map(p=>[p.id,p.religionId,p.devotion]));
  P.daily(s,()=>{},W.die);P.daily(copy,()=>{},W.die);
  assert.ok(P.relation(copy,a.id,b.id).trust>P.relation(s,a.id,b.id).trust);
  assert.equal(JSON.stringify(copy.people.map(p=>[p.id,p.religionId,p.devotion])),beliefs);
  assert.equal(P.relation(copy,a.id,b.id).status,'competition');
});
test('compressed audit packaging retains full observations and sample identity',()=>{
  const sample={seed:'s',arm:'passive',daily:[{hour:24,pairs:[]}],traces:[],summary:{}};
  const parts=E.reportParts({results:[sample]},'audit.json.gz');
  const z=require('node:zlib'),decoded=JSON.parse(z.gunzipSync(z.gzipSync(JSON.stringify(parts.audit))).toString());
  assert.deepEqual(decoded.results[0].daily,sample.daily);
  assert.equal(parts.main.results[0].dailyAudit.dailyHash,E.hash(sample.daily));
  assert.equal(sample.daily.length,1,'packaging does not mutate simulation output');
});
test('candidate inspector explains affiliation separately from core cohesion within existing panel',async()=>{
  const s=E.fresh('valley-spring-01');W.advanceTicks(s,6);s.politics.diplomacy.identity20Enabled=true;
  for(const p of s.people){p.religionId=s.religion.id;p.devotion=20;}
  P.daily(s,()=>{},W.die);s.politics.diplomacy.relations[0].status='peace'; // explicit UI fixture
  const {boot}=require('./browser-harness.cjs');const ui=await boot({sim:{...W,create:()=>s},politicsProfile:{enabled:true}});
  ui.render();assert.match(ui.el('townPanel').innerHTML,/主要宗教認同相同/);assert.match(ui.el('townPanel').innerHTML,/40\+核心/);
});
test('switching candidate off clears current assessment while retaining historical decisions',()=>{
  const s=E.fresh('valley-spring-01');s.politics.diplomacy.identity20Enabled=true;P.daily(s,()=>{},W.die);
  assert.ok(s.politics.diplomacy.relations[0].faithAssessment);
  s.politics.diplomacy.identity20Enabled=false;P.daily(s,()=>{},W.die);
  assert.ok(s.politics.diplomacy.relations.every(r=>!Object.hasOwn(r,'faithAssessment')));
});
