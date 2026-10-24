'use strict';
// Local observer/limited player only. Never writes people, belief or politics.
const W=require('../src/sim.js'),P=require('../src/politics.js'),{options}=require('./diplomacy-experiment.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {gzipSync,gunzipSync}=require('node:zlib');
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
const ARMS={passive:180,both:180,oracle_only:120};
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function fresh(seed){return W.create({...options(seed,true,true,true),oracleStrategyProfile:require('../config/oracle-specialization-v0.1.json')});}
function towns(s){return s.settlements.map(t=>{
  const people=s.people.filter(p=>p.alive&&t.householdIds.includes(p.householdId)),faiths={};
  for(const p of people)if(p.religionId){const f=faiths[p.religionId]||={believers20:0,core40:0,weighted:0,devotion:0};
    f.believers20+=Number(p.devotion>=20);f.core40+=Number(p.devotion>=40);f.weighted+=W.faithfulWeight(p.devotion);f.devotion+=p.devotion;}
  const ranking=Object.entries(faiths).sort((a,b)=>b[1].believers20-a[1].believers20||a[0].localeCompare(b[0]));
  const cfg=s.politics.diplomacy,best=ranking[0],identity20=best&&best[1].believers20>=cfg.minCore&&
    best[1].believers20/Math.max(1,people.length)>=cfg.coreShare&&best[1].believers20>(ranking[1]?.[1].believers20||0)?best[0]:null;
  for(const f of Object.values(faiths)){f.believerShare=f.believers20/Math.max(1,people.length);f.coreShare=f.core40/Math.max(1,people.length);}
  const polity=s.politics.polities.find(p=>p.townId===t.id),leader=s.people.find(p=>p.id===polity?.leaderId&&p.alive);
  return {id:t.id,population:people.length,faiths,coreIdentity:P.coreFaith(s,t).id,identity20,
    leader:leader?{id:leader.id,religionId:leader.religionId,devotion:leader.devotion}:null};
});}
function politicalSnapshot(s){const villages=towns(s),byId=new Map(villages.map(t=>[t.id,t]));
  const pairs=s.politics.diplomacy.relations.map(r=>{
    const a=s.politics.polities.find(p=>p.id===r.aId),b=s.politics.polities.find(p=>p.id===r.bId),ta=byId.get(a?.townId),tb=byId.get(b?.townId);
    return {a:r.aId,b:r.bId,status:r.status,contactDays:r.contactDays,trust:r.trust,grievance:r.grievance,delivered:r.delivered,
      // The kernel's saved evaluation reason is authoritative; faith may update later in the same tick.
      coreBonus:r.reason.includes('主要核心信仰相同'),identityBonus:r.reason.includes('主要宗教認同相同'),leaderBonus:r.reason.includes('領袖同教'),
      complementary:r.reason.includes('有庫存互補'),identity20Shared:!!ta?.identity20&&ta.identity20===tb?.identity20};});
  return {hour:s.hour,towns:villages,pairs};
}
function limitedAction(s,day,arm){
  const out=[];if(arm==='passive')return out;
  if(day===14||day===104){const saint=[...s.religion.saints].sort()[0]||null;
    const before=s.religion.saintQuota?.[saint]?.quota,result=W.issueOracle(s,{saintId:saint,intentType:'religion.spread'});
    out.push({day,kind:'oracle',saintId:saint,quotaBefore:before??null,input:'religion.spread',result});}
  if(arm!=='both'||day%21!==0)return out;
  // Only publicly collected petitions and the player's visible Saint/camp location.
  const needs=s.religion.priests.flatMap(id=>W.priestPetitions(s,id)).filter(n=>n.location)
    .sort((a,b)=>b.createdAtHour-a.createdAtHour||a.id.localeCompare(b.id));
  const need=needs[0],saint=s.people.find(p=>p.alive&&p.id===s.religion.saints[0]);
  const at=need?.location.center||saint||s.camp;
  const type=need?.type==='healing'?'heal':need?.type==='food-water'?'rain':need?.type==='food-shortage'?'harvest':'efficiency';
  const input={x:at.x,y:at.y,radius:7,intensity:type==='rain'?.85:1,durationDays:type==='rain'?7:10};
  const check=W.evaluateMiracle(s,type,input),dp=s.god.dp;
  const result=check.overcast?{ok:false,reason:'predeclared policy never overcasts'}:W.castMiracle(s,type,input);
  out.push({day,kind:'miracle',type,input,source:need?{prayerId:need.id,type:need.type,location:need.location}:
    {visibleSaint:saint?.id||null,campFallback:!saint},dpBefore:dp,dpAfter:s.god.dp,result});return out;
}
function peopleState(s){return new Map(s.people.map(p=>[p.id,{alive:p.alive,faith:p.religionId,devotion:p.devotion,health:p.health,
  evidence:JSON.stringify(p.lastFaithEvidence),conversion:JSON.stringify(p.lastStrategicConversion)}]));}
function observePeople(s,before,trace,counters,seen){
  for(const p of s.people){const prev=before.get(p.id);if(!p.alive||!prev?.alive)continue;
    const evidence=JSON.stringify(p.lastFaithEvidence),conversion=JSON.stringify(p.lastStrategicConversion);
    const changed=p.devotion!==prev.devotion||p.religionId!==prev.faith;
    const newEvidence=evidence!==prev.evidence&&p.lastFaithEvidence;
    if(changed)counters.personFaithChanges++;
    if(p.religionId!==prev.faith){counters.affiliationChanges++;
      if(p.religionId===s.religion.id)counters.newPlayerAffiliations++;}
    if(p.religionId===s.religion.id&&p.devotion>=40&&(prev.faith!==p.religionId||prev.devotion<40))counters.playerCoreCrossings++;
    if(newEvidence&&p.lastFaithEvidence.godId===s.god.id){counters.playerEvidenceUpdates++;
      if(p.lastFaithEvidence.change)counters.playerEvidenceWithDevotionDelta++;
      counters.playerEvidenceDevotionNet+=p.lastFaithEvidence.change||0;}
    if(conversion!==prev.conversion&&p.lastStrategicConversion)counters.strategyConversions++;
    if(!changed&&!newEvidence)continue;
    const key=p.id+'|'+(newEvidence?p.lastFaithEvidence.godId+':'+p.lastFaithEvidence.cause:'belief-change')+'|'+Math.floor(s.hour/(30*24));
    if(!seen.has(key)&&trace.length<400){seen.add(key);trace.push({hour:s.hour,id:p.id,householdId:p.householdId,townId:p.settlementId,
      before:{religionId:prev.faith,devotion:prev.devotion,health:prev.health},after:{religionId:p.religionId,devotion:p.devotion,health:p.health},
      freshEvidence:newEvidence?p.lastFaithEvidence:null,freshStrategicConversion:conversion!==prev.conversion?p.lastStrategicConversion||null:null,
      note:newEvidence?'actual new attribution record; not inferred from cast count':'no fresh attribution: change alone does not establish player causation'});}
  }
}
function faithGateSummary(daily){const previous=new Map();let core=0,identity=0,leader=0;
  for(const d of daily)for(const p of d.pairs){const key=p.a+'|'+p.b,contact=p.contactDays>(previous.get(key)||0);
    if(contact){core+=Number(p.coreBonus);identity+=Number(p.identityBonus);leader+=Number(p.leaderBonus);}
    previous.set(key,p.contactDays);}
  return {coreBonusPairDays:core,identityBonusPairDays:identity,leaderBonusPairDays:leader,
    coreEligiblePairDays:daily.reduce((n,d)=>n+d.pairs.filter(p=>p.coreBonus).length,0),
    identityEligiblePairDays:daily.reduce((n,d)=>n+d.pairs.filter(p=>p.identityBonus).length,0),
    shadowIdentity20PairDays:daily.reduce((n,d)=>n+d.pairs.filter(p=>p.identity20Shared).length,0)};
}
function run(source,arm,days=ARMS[arm]){
  assert.ok(Object.hasOwn(ARMS,arm));assert.ok(Number.isInteger(days)&&days>=1&&days<=180);
  const s=W.restore(source),start=performance.now(),genesisHash=hash(s),actions=[],daily=[],traces=[],seen=new Set(),events=[],checkpoints=[];
  const counters={personFaithChanges:0,affiliationChanges:0,newPlayerAffiliations:0,playerCoreCrossings:0,
    playerEvidenceUpdates:0,playerEvidenceWithDevotionDelta:0,playerEvidenceDevotionNet:0,strategyConversions:0};
  const original=P.daily;const seenTransitions=new Map(),seenUnionEvents=new Set();
  P.daily=(state,...args)=>{
    original(state,...args);if(state!==s)return;
    daily.push(politicalSnapshot(state));
    for(const r of state.politics.diplomacy.relations){const key=r.aId+'|'+r.bId,from=seenTransitions.get(key)||0;
      for(const e of (r.transitions||[]).slice(from))events.push({kind:'diplomatic-transition',a:r.aId,b:r.bId,...e,
        personFaithEvidenceRecently:traces.filter(t=>t.freshEvidence?.godId===s.god.id&&t.hour>=state.hour-7*24).map(t=>({id:t.id,hour:t.hour})),
        note:'temporal evidence links are not a counterfactual proof'});
      seenTransitions.set(key,(r.transitions||[]).length);}
    for(const u of state.politics.unions||[])for(let i=0;i<u.history.length;i++){
      const key=u.id+'|'+i;if(seenUnionEvents.has(key))continue;seenUnionEvents.add(key);
      events.push({kind:'union-event',unionId:u.id,members:u.memberTownIds,...u.history[i]});}
  };
  try{
    for(let day=1;day<=days;day++){
      let before=peopleState(s);actions.push(...limitedAction(s,day,arm));observePeople(s,before,traces,counters,seen);
      for(let tick=0;tick<3;tick++){before=peopleState(s);W.advanceTicks(s,1);observePeople(s,before,traces,counters,seen);}
      assert.deepEqual(W.validate(s).errors,[]);
      if([30,60,120,180].includes(day))checkpoints.push({day,...politicalSnapshot(s),
        counts:{...counters},oracles:s.religion.oracles.map(o=>({id:o.id,intent:o.intentType,status:o.status,
          heard:o.heardCount,sermons:o.influenceSermonCount,work:o.influenceWorkCount})),
        conflicts:s.politics.disputes.length,unions:s.politics.unions.filter(u=>!Number.isFinite(u.dissolvedAtHour)).length,
        shipments:s.politics.diplomacy.shipments.filter(q=>q.delivered).length});
    }
  }finally{P.daily=original;}
  const endpoint=JSON.parse(JSON.stringify(s)),copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s);
  const e=endpoint.politics;
  return {seed:endpoint.seed,arm,days,genesisHash,elapsedMs:performance.now()-start,actions,counters,checkpoints,events,
    summary:{...faithGateSummary(daily),
      peace:e.diplomacy.relations.filter(r=>r.peaceAtHour).length,alliances:e.diplomacy.relations.filter(r=>r.allianceAtHour).length,
      unions:e.unions.length,coordinatedSorties:e.unions.reduce((n,u)=>n+u.decisions.length,0),
      conflicts:e.disputes.length,deliveredBatches:e.diplomacy.shipments.filter(q=>q.delivered).length,
      deliveredByResource:e.diplomacy.shipments.filter(q=>q.delivered).reduce((n,q)=>{n[q.resource]=(n[q.resource]||0)+q.amount;return n;},{})},
    traces,traceSampling:'all changes counted; first per person/cause/30-day bin, max400 samples',daily,
    validation:'daily valid; same full genesis; observer restored; endpoint save and next-day replay'};
}
function reportParts(report,auditName){const audits=[];
  const results=report.results.map(r=>{
    const {daily,traces,...rest}=r;audits.push({seed:r.seed,arm:r.arm,daily,traces});
    const selected=[...traces.filter(t=>t.freshEvidence?.godId==='g1').slice(0,16),
      ...traces.filter(t=>t.before.religionId!==t.after.religionId).slice(0,20)];
    return {...rest,traces:selected,dailyAudit:{file:auditName,key:r.seed+'|'+r.arm,days:daily.length,
      dailyHash:hash(daily),fullSampledTraces:traces.length},
      traceSampling:'summary shows first16 actual player-evidence and first20 affiliation transitions; full original bounded trace samples in compressed audit'};
  });
  return {main:{...report,gateCountDefinition:'bonus pair-days require actual contactDays increase; mere eligibility is separate',results},
    audit:{schema:'issue14/daily-religion-politics-audit-v1',results:audits}};
}
function writeReport(report,out){const auditFile=out.replace(/\.json$/,'.audit.json.gz');
  const parts=reportParts(report,path.basename(auditFile));
  fs.writeFileSync(auditFile,gzipSync(JSON.stringify(parts.audit),{level:9}));
  fs.writeFileSync(out,JSON.stringify(parts.main,null,2)+'\n');
}
function readAudit(filename){return JSON.parse(gunzipSync(fs.readFileSync(filename)).toString('utf8'));}
if(require.main===module){const start=performance.now(),results=[];
  for(const seed of SEEDS){const source=JSON.stringify(fresh(seed));for(const arm of Object.keys(ARMS)){
    const r=run(source,arm);results.push(r);console.log(seed,arm,JSON.stringify({summary:r.summary,evidence:r.counters,actions:r.actions.filter(a=>a.result.ok).length}));}
    const group=results.filter(r=>r.seed===seed);assert.ok(group.every(r=>r.genesisHash===group[0].genesisHash));}
  const out=path.resolve(__dirname,'../reports/issue-14-religion-causality-2026-10-24.json');
  writeReport({issue:14,baseCommit:'dfab2d4',node:process.version,elapsedMs:performance.now()-start,
    strategy:'Oracle religion.spread at days14/104; one Miracle attempt every21 days from collected petition, else visible Saint efficiency; no overcast/retry/state injection',
    categories:{passive:'unintervened natural with standard AI',both:'limited legal player Oracle+Miracle',oracle_only:'120-day channel ablation'},results},out);console.log(out);
}
module.exports={SEEDS,ARMS,fresh,towns,politicalSnapshot,limitedAction,peopleState,observePeople,faithGateSummary,run,hash,reportParts,writeReport,readAudit};
