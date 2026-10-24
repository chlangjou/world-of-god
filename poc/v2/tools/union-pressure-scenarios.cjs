'use strict';
// Issue #14 local experiment. Only external material availability and foreign policy
// are interventions; union pressure, membership, notices and outcomes are kernel-owned.
const W=require('../src/sim.js'),{options}=require('./diplomacy-experiment.cjs');
const {createHash}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const DEFAULTS=require('../config/polity-command-v0.1.json').diplomacy.union.fracture;
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
const CASES=Object.freeze({control:{days:0,resource:false,policy:false},
  resource_sustained:{days:60,resource:true,policy:false},
  policy_sustained:{days:60,resource:false,policy:true},
  combined_sustained:{days:60,resource:true,policy:true},
  combined_transient:{days:14,resource:true,policy:true}});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function ambition(seed,id){let h=2166136261;for(const c of seed+'|ambition|'+id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)%100/100;}
const town=(s,id)=>s.settlements.find(t=>t.id===id);
const relation=(s,a,b)=>s.politics.diplomacy.relations.find(r=>[r.aId,r.bId].includes(a)&&[r.aId,r.bId].includes(b));
function routeLength(s,from,to){
  const walk=(x,y)=>x>=0&&x<s.width&&y>=0&&y<s.height&&
    (s.tiles[y*s.width+x].terrain!=='river'||(s.mobility?.enabled&&y%s.mobility.fordSpacing===0));
  if(!walk(from.x,from.y)||!walk(to.x,to.y))return null;
  const distance=new Int32Array(s.width*s.height).fill(-1),queue=[[from.x,from.y]];
  distance[from.y*s.width+from.x]=0;
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],d=distance[y*s.width+x];
    if(x===to.x&&y===to.y)return d;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;
      if(walk(nx,ny)&&distance[ny*s.width+nx]<0){distance[ny*s.width+nx]=d+1;queue.push([nx,ny]);}}
  }return null;
}
function contextFor(s,u,actorIds=u.memberPolityIds){
  // Predeclared ID order and physical feasibility only. No looking at ambition,
  // future outcomes or tuning the seed until a desired separation appears.
  const sorted=[...s.politics.polities].sort((a,b)=>a.id.localeCompare(b.id));
  for(const actor of sorted.filter(p=>u.memberPolityIds.includes(p.id)&&actorIds.includes(p.id)))
    for(const outside of sorted.filter(p=>!u.memberPolityIds.includes(p.id))){
      if(!actor.leaderId||!outside.leaderId||outside.militia.stance!=='defend'||!outside.militia.memberIds.length)continue;
      if(s.politics.disputes.some(c=>[c.aId,c.bId].includes(actor.id)&&[c.aId,c.bId].includes(outside.id)&&
        s.hour-c.startedAtHour<s.politics.disputeCooldownDays*24))continue;
      const a=town(s,actor.townId),b=town(s,outside.townId);
      for(const site of [...s.mobilityHotspots].filter(q=>q.kind==='stone').sort((a,b)=>a.x-b.x||a.y-b.y)){
        if(s.tiles[site.y*s.width+site.x].stone<=0||Math.hypot(a.x-site.x,a.y-site.y)>s.politics.maxClaimDistance||
          Math.hypot(b.x-site.x,b.y-site.y)>s.politics.maxClaimDistance)continue;
        const lengths=[routeLength(s,a,site),routeLength(s,b,site)];
        if(lengths.some(n=>n===null||n>s.politics.maxMarchDays*s.politics.marchCellsPerDay))continue;
        const peer=s.politics.polities.find(p=>u.memberPolityIds.includes(p.id)&&p.id!==actor.id);
        if(!relation(s,actor.id,outside.id)||!relation(s,peer.id,outside.id))continue;
        return {actorId:actor.id,actorTownId:a.id,peerId:peer.id,peerTownId:peer.townId,
          outsideId:outside.id,outsideTownId:b.id,quarry:{x:site.x,y:site.y},routeCells:lengths};
      }
    }
  return null;
}
function naturalSource(seed){
  assert.ok(SEEDS.includes(seed));const s=W.create(options(seed,true,true,true));
  for(let day=1;day<=180;day++){W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
    const u=s.politics.unions.find(u=>!Number.isFinite(u.dissolvedAtHour));
    if(u){assert.deepEqual(s.politics.diplomacy.union.fracture,DEFAULTS);
      return {seed,world:JSON.stringify(s),hash:digest(s),unionId:u.id,startDay:s.hour/24,context:contextFor(s,u)};}}
  return {seed,notApplicable:'no natural union in first 180 days'};
}
function controller(source,name){
  assert.ok(Object.hasOwn(CASES,name));return {name,...CASES[name],startHour:source.startDay*24,
    context:source.context,escrow:{},ledger:[],policies:[],released:false};
}
function assertDefaults(s){assert.deepEqual(s.politics.diplomacy.union.fracture,DEFAULTS,'default exit/breach gates must remain untouched');}
function interventions(s,c,day){
  assertDefaults(s);const ctx=c.context;
  if((c.resource||c.policy)&&!ctx)throw Error('No eligible physical context');
  if(day===1&&c.policy){
    const end=c.startHour+c.days*24,claim=relation(s,ctx.actorId,ctx.outsideId),pact=relation(s,ctx.peerId,ctx.outsideId);
    const before=JSON.parse(JSON.stringify([claim,pact]));
    claim.status='competition';claim.peaceAtHour=null;claim.allianceAtHour=null;claim.changedAtHour=s.hour;
    // A fixed-term exogenous diplomatic dispute. Keep all prior war/ceasefire
    // clocks, people, faith, internal union treaty and trust scores intact.
    claim.renegotiateAfterHour=Math.max(claim.renegotiateAfterHour||0,end);
    if(pact.status==='competition'){pact.status='peace';pact.peaceAtHour=s.hour;pact.changedAtHour=s.hour;}
    c.policies.push({hour:s.hour,termEndHour:end,description:'one member contests an external quarry; the partner maintains a pact with that same outsider',
      before,after:JSON.parse(JSON.stringify([claim,pact]))});
  }
  if(c.resource&&day<=c.days){
    // External reserve lock at the original villages. No fake buildings,
    // consumption, transfer to another village, new goods, or people added.
    for(const id of [ctx.actorTownId,ctx.outsideTownId]){
      const t=town(s,id);if(!t)continue;const amount=t.storage.stone;
      const before=t.storage.stone+(c.escrow[id]||0);
      t.storage.stone-=amount;c.escrow[id]=(c.escrow[id]||0)+amount;
      assert.ok(Math.abs(t.storage.stone+c.escrow[id]-before)<1e-8);
      if(amount)c.ledger.push({type:'reserve-lock',hour:s.hour,townId:id,resource:'stone',amount});
    }
  }
  if(day>c.days&&!c.released){
    for(const [id,amount]of Object.entries(c.escrow)){
      const t=town(s,id);assert.ok(t,'locked reserves must keep their owner');const before=t.storage.stone+amount;
      t.storage.stone+=amount;c.escrow[id]=0;assert.ok(Math.abs(t.storage.stone-before)<1e-8);
      if(amount)c.ledger.push({type:'reserve-release',hour:s.hour,townId:id,resource:'stone',amount});
    }c.released=true;
  }
}
function step(s,c,day){interventions(s,c,day);W.advanceTicks(s,3);assertDefaults(s);assert.deepEqual(W.validate(s).errors,[]);}
function run(source,name,horizon=120){
  assert.ok(Number.isInteger(horizon)&&horizon>=61&&horizon<=180);
  const c=controller(source,name);
  if(!source.world||((c.resource||c.policy)&&!source.context))return {seed:source.seed,name,notApplicable:source.notApplicable||'no eligible quarry/third-party context'};
  const start=performance.now(),s=W.restore(source.world);assert.equal(digest(s),source.hash,'same full-world fork');
  const u=s.politics.unions.find(u=>u.id===source.unionId),rows=[],maxPressure={};let expected=null;
  for(let day=1;day<=horizon;day++){
    const historyBefore=u.history.length;step(s,c,day);
    if(day===31){assert.equal(digest({world:s,controller:c}),expected,'mid-shock sidecar/save replay');}
    for(const [id,v]of Object.entries(u.interests||{}))maxPressure[id]=Math.max(maxPressure[id]||0,v.pressure);
    if([1,7,14,21,28,30,60,61,90,horizon].includes(day)||u.history.length!==historyBefore)
      rows.push({afterForkDay:day,worldDay:s.hour/24,notice:u.exitNotice||null,dissolutionKind:u.dissolutionKind||null,
        interests:structuredClone(u.interests||{}),stocks:source.context?[source.context.actorTownId,source.context.peerTownId,source.context.outsideTownId].map(id=>({id,stone:town(s,id)?.storage.stone})):[],escrow:{...c.escrow}});
    if(day===30){const copy=W.restore(JSON.stringify(s)),sidecar=JSON.parse(JSON.stringify(c));
      assert.deepEqual(copy,s);step(copy,sidecar,31);expected=digest({world:copy,controller:sidecar});}
  }
  assert.ok(Object.values(c.escrow).every(n=>n===0),'all material locks released');
  const endpoint=JSON.parse(JSON.stringify(s)),target=endpoint.politics.unions.find(v=>v.id===source.unionId);
  const decision=target.history.find(e=>['exit','breach'].includes(e.type));
  const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s);
  return {seed:source.seed,name,sourceHash:source.hash,startDay:source.startDay,horizon,
    elapsedMs:performance.now()-start,context:source.context,defaults:DEFAULTS,
    summary:{result:target.dissolutionKind||'survived',firstNoticeDay:target.history.find(e=>e.type==='exit-notice')?.hour/24||null,
      separationDay:target.dissolvedAtHour/24||null,maxPressure,notices:target.history.filter(e=>e.type==='exit-notice').length,
      retractions:target.history.filter(e=>e.type==='notice-retracted').length,
      decidingLeader:decision?{id:decision.personId,ambition:ambition(source.seed,decision.personId),requiredForBreach:DEFAULTS.breachAmbition}:null},
    history:target.history,rows,interventions:{durationDays:c.days,resource:c.resource,policy:c.policy,ledger:c.ledger,policies:c.policies},
    end:{worldDay:endpoint.hour/24,union:target,
      actorPeerRelation:source.context?relation(endpoint,source.context.actorId,source.context.peerId):null,
      conflicts:endpoint.politics.disputes,shipments:endpoint.politics.diplomacy.shipments.map(({path,...q})=>({...q,pathCells:path.length}))},
    validation:'daily world/default gates; every reserve transaction conserves materials; day30/31 world+sidecar replay; endpoint save and extra-day replay'};
}
if(require.main===module){const start=performance.now(),results=[],sources=[];
  for(const seed of SEEDS){const source=naturalSource(seed);const {world,...metadata}=source;sources.push(metadata);
    for(const name of Object.keys(CASES)){const r=run(source,name);results.push(r);console.log(seed,name,JSON.stringify(r.summary||{notApplicable:r.notApplicable}));}}
  const out=path.resolve(__dirname,'../reports/issue-14-pressure-scenarios-2026-10-24.json');
  fs.writeFileSync(out,JSON.stringify({issue:14,baseCommit:'7bbf53e',node:process.version,elapsedMs:performance.now()-start,
    defaults:DEFAULTS,selection:'first natural union by day180, eligible quarry actors by ID and physical routes; no outcome/ambition filtering',
    scenarios:CASES,sources,results},null,2)+'\n');console.log(out);
}
module.exports={SEEDS,CASES,DEFAULTS,naturalSource,contextFor,controller,interventions,step,run,digest};
