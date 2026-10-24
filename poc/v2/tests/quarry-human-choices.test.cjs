'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const M=require('../src/mobility.js');
const Politics=require('../src/politics.js');
const Common=require('../tools/mineral-natural-experiment.cjs');
const Opt=require('../config/mineral-rights-p1-5-v0.1.json');
const Old=require('../config/mineral-rights-experiment-v0.1.json');
const oldBase=require('../config/polity-command-v0.1.json');
const deep=s=>JSON.parse(JSON.stringify(s));
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
const world=(mode='finite-rights-p1-5')=>W.create(Common.options('valley-spring-01',mode));
const days=(s,n)=>W.advanceTicks(s,n*3);
const quarry=s=>{const claim=s.politics.quarryClaims.find(c=>c.status==='protected');
  assert.ok(claim,'the same unmodified natural seed creates a real guarded claim');
  return {claim,tile:s.tiles[claim.site.y*s.width+claim.site.x]};};

test('P1.5 is strictly opt-in; P1, legacy and off choices preserve original state',()=>{
  assert.equal(Old.mineralRights.choicesEnabled,undefined);
  const p1=world('finite-rights');
  assert.equal(p1.politics.quarryChoices,undefined);
  assert.equal(p1.politics.quarryNegotiations,undefined);
  const legacy=world('legacy');
  assert.equal(legacy.mobility.finiteMineralsEnabled,undefined);
  assert.equal(legacy.politics.mineralRights,undefined);
  const opt={...Common.options('valley-spring-01','finite-rights'),
    politicsProfile:{...oldBase,mineralRights:{...Old.mineralRights,choicesEnabled:false}}};
  const off=W.create(opt);
  assert.deepEqual(off,p1,'explicit disabled policy must not modify baseline');
  days(off,5);days(p1,5);assert.deepEqual(off,p1);
  good(legacy);good(p1);
});

test('natural world produces real human choices and a measured safe alternative delivered to inventory',()=>{
  const s=world();
  days(s,70);
  good(s);
  const claims=s.politics.quarryClaims;
  assert.ok(claims.length>0&&claims.some(c=>c.status==='protected'));
  const choice=s.politics.quarryChoices;
  assert.ok(choice.some(q=>['avoid','negotiate','permit'].includes(q.action)));
  assert.ok(choice.some(q=>q.alternative),'safe choice has real quarry coordinates');
  assert.ok((s.counts.quarryAlternativeTripsDelivered||0)>0,'alternative miner really arrived home');
  const receipt=s.politics.quarryDeliveries.find(v=>v.avoidedClaimId&&v.kind==='stone');
  assert.ok(receipt&&receipt.personId&&receipt.amount>0);
  const t=s.tiles[receipt.site.y*s.width+receipt.site.x];
  assert.ok(t.mineral?.extracted>=receipt.amount,'alternate stone was debited from actual mine');
  assert.ok(t.mineral.byTown[receipt.townId]>=receipt.amount);
  const restored=W.restore(JSON.stringify(s));
  days(restored,1);days(s,1);assert.deepEqual(restored,s);
});

test('natural human contact allows delayed trust-based permission; extraction debits limited real mineral quota',()=>{
  const s=world();days(s,55);
  const {claim,tile}=quarry(s);
  const agreement=s.politics.quarryNegotiations.find(q=>q.claimId===claim.id&&
    q.status==='granted'&&q.untilHour>s.hour&&q.remainingUnits>0);
  assert.ok(agreement,'real prior contact leads to a finite human access agreement');
  assert.ok(agreement.resolvedAtHour>=agreement.dueAtHour);
  assert.equal(agreement.contactEvidence,true);
  const outsider=s.people.find(p=>p.alive&&p.stage==='adult'&&
    p.settlementId===agreement.visitorTownId);
  assert.ok(outsider);
  assert.equal(M.protectedBy(s,tile,outsider),null,'permit temporarily allows real access');
  const startStone=tile.stone,startPublic=s.settlements.reduce((sum,v)=>sum+v.storage.stone,0);
  const startQuota=agreement.remainingUnits;
  const actual=Math.min(startQuota,startStone,1.5);
  const trip={purpose:'resource',path:[tile.y*s.width+tile.x]};
  M.gather(s,outsider,trip);
  assert.ok(Math.abs(trip.cargo.amount-actual)<1e-9);
  assert.ok(Math.abs(agreement.remainingUnits-(startQuota-actual))<1e-9);
  assert.ok(Math.abs(tile.stone-(startStone-actual))<1e-9);
  assert.equal(s.settlements.reduce((sum,v)=>sum+v.storage.stone,0),startPublic,
    'a negotiated agreement does not teleport stock to either town');
  agreement.remainingUnits=0; // controlled permit exhaustion
  assert.equal(M.protectedBy(s,tile,outsider)?.id,claim.id);
  const rejected={purpose:'resource',path:[tile.y*s.width+tile.x]};
  M.gather(s,outsider,rejected);
  assert.equal(rejected.cargo,undefined);
  assert.equal(s.politics.quarryEncounters.at(-1).outcome,'guard-warning');
  good(s);
});

test('no real contact cannot open a negotiation; no guard cannot enforce invisible borders',()=>{
  const s=world();days(s,50);
  const {claim,tile}=quarry(s);
  const outsider=s.people.find(p=>p.alive&&p.stage==='adult'&&
    p.settlementId!==claim.townId&&M.protectedBy(s,tile,p));
  assert.ok(outsider,'a real foreign resident is subject to existing guard');
  s.contactLog=[]; // controlled communication blackout, not a natural-world statistic
  s.politics.quarryNegotiations=[];s.politics.quarryChoices=[];
  s.politics.mineralRights.reviewDays=1;
  const count=s.counts.quarryAccessRequested||0;
  Politics.quarryChoicesDaily(s,()=>{});
  assert.equal(s.politics.quarryNegotiations.length,0,'no invented contact/automatic treaties');
  assert.equal(s.counts.quarryAccessRequested||0,count);
  const guard=s.people.find(p=>p.id===claim.guardId);assert.ok(guard?.alive);
  W.die(s,guard.id,'受控守衛死亡');
  assert.equal(M.protectedBy(s,tile,outsider),null);
  const collected={purpose:'resource',path:[tile.y*s.width+tile.x]};
  M.gather(s,outsider,collected);
  assert.ok(collected.cargo?.amount>0,'a real unguarded mine becomes physically shareable');
  good(s);
});

test('finite quarry physical warnings preserve material and are not counted as territorial wars',()=>{
  const s=world();days(s,48);
  const {claim,tile}=quarry(s);
  const foreign=s.people.find(p=>p.alive&&p.stage==='adult'&&
    p.settlementId!==claim.townId&&M.protectedBy(s,tile,p));
  assert.ok(foreign);
  const stock=tile.mineral.available,battles=s.politics.disputes.length;
  const trip={purpose:'resource',path:[tile.y*s.width+tile.x]};
  M.gather(s,foreign,trip);
  assert.equal(trip.cargo,undefined);
  assert.equal(tile.mineral.available,stock);
  assert.equal(s.politics.disputes.length,battles);
  assert.ok(['guard-warning','challenge-resisted'].includes(
    s.politics.quarryEncounters.at(-1).outcome));
  good(s);
});

test('CONTROLLED only: an autonomous challenge order still requires a real path and ends in guard resistance, not war',()=>{
  const s=world();days(s,48);
  const {claim,tile}=quarry(s),w=s.width;
  function legalPath(from,to){
    const first=from.y*w+from.x,last=to.y*w+to.x,prev=new Int32Array(s.tiles.length);
    prev.fill(-1);prev[first]=first;
    const queue=[first];
    for(let cur=0;cur<queue.length&&prev[last]<0;cur++){
      const at=queue[cur],x=at%w,y=Math.floor(at/w);
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=w||ny>=s.height)continue;
        if(s.tiles[ny*w+nx].terrain==='river'&&ny%s.mobility.fordSpacing!==0)continue;
        const next=ny*w+nx;
        if(prev[next]>=0)continue;
        prev[next]=at;queue.push(next);
      }
    }
    if(prev[last]<0)return null;
    const path=[];for(let at=last;;at=prev[at]){path.push(at);if(at===first)break;}
    return path.reverse();
  }
  const cases=s.people.filter(p=>p.alive&&p.stage==='adult'&&p.health>=35&&
    p.settlementId!==claim.townId&&M.protectedBy(s,tile,p)&&!p.mobilityTrip)
    .map(p=>({p,home:s.households.find(h=>h.id===p.householdId)}))
    .filter(x=>x.home).map(x=>({...x,path:legalPath(x.home,claim.site)}))
    .filter(x=>x.path&&x.path.length-1<=s.mobility.maxTripCells)
    .sort((a,b)=>a.path.length-b.path.length);
  assert.ok(cases.length>0,'at least one actual foreign adult can physically reach this guarded quarry');
  const {p,home,path}=cases[0];
  let choice=s.politics.quarryChoices.find(q=>q.claimId===claim.id&&q.visitorTownId===p.settlementId);
  assert.ok(choice,'an existing human leader has actually evaluated the guarded site');
  // Controlled branch from real population, real terrain and real guard; the
  // decision is forced ONLY in this test, never treated as a natural world rate.
  choice.action='challenge';choice.decidedAtHour=s.hour;
  const before=tile.stone,oldCount=s.counts.quarryActualChallenges||0;
  const wars=s.politics.disputes.length;
  p.mobilityTrip={purpose:'resource',path,index:0,phase:'out',siteTicks:0,
    origin:{x:home.x,y:home.y},resourceKind:'stone',cargo:null,startedAtHour:s.hour};
  p.x=home.x;p.y=home.y;
  for(let i=0;i<20&&(s.counts.quarryActualChallenges||0)===oldCount;i++){
    s.hour+=s.rules.tickHours;s.tick++;
    M.step(s,p,()=>{throw Error('guarded no-cargo expedition must not credit stores');});
  }
  assert.equal(s.counts.quarryActualChallenges,oldCount+1);
  const event=s.politics.quarryEncounters.at(-1);
  assert.equal(event.outcome,'challenge-resisted');
  assert.equal(event.visitorId,p.id);
  assert.equal(event.guardId,claim.guardId);
  assert.equal(tile.stone,before,'no material teleports past an actual guard');
  assert.equal(s.politics.disputes.length,wars,'P1.5 challenge is not full territorial war');
  good(s);
});
