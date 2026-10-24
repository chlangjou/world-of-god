'use strict';
// Deliberately controlled shock to *real* stock with external escrow accounting.
// No fake goods, faith, troops, God controls, agenda state or forced treaties.
const W=require('../src/sim.js'),E=require('./peace-militia-experiment.cjs'),
 assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const AGENDA={enabled:true,minPressure:12,negotiationDays:7,autonomyDays:30,repeatCooldownDays:45};
function source(seed='valley-spring-01'){
 if(seed!=='valley-spring-01')throw Error('bounded first-natural-union source only');
 const s=W.create(E.options(seed,false));
 for(let day=1;day<=140;day++){
  W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[]);
  const u=s.politics.unions?.find(u=>!Number.isFinite(u.dissolvedAtHour));
  if(u){
   const done=s.politics.diplomacy.shipments.find(q=>q.delivered&&
     u.memberTownIds.includes(q.fromTownId)&&u.memberTownIds.includes(q.toTownId));
   assert.ok(done,'actual delivered shipment required; no synthetic logistics');
   return {snapshot:JSON.stringify(s),sourceDay:day,unionId:u.id,
     donorTownId:done.fromTownId,receiverTownId:done.toTownId,
     originalShipmentId:done.id};
  }
 }
 throw Error('No natural political union formed within 140 days');
}
function run(src,enabled){
 if(typeof enabled!=='boolean')throw Error('boolean arm');
 const s=W.restore(src.snapshot),u=s.politics.unions.find(v=>v.id===src.unionId),
   from=s.settlements.find(t=>t.id===src.donorTownId),
   to=s.settlements.find(t=>t.id===src.receiverTownId),
   proposer=s.politics.polities.find(p=>p.townId===from.id);
 assert.ok(u&&from&&to&&proposer);
 if(enabled)s.politics.diplomacy.union.fracture.agenda={...AGENDA};
 const sourceGen={people:JSON.stringify(s.people),households:JSON.stringify(s.households),
   inventories:JSON.stringify(s.settlements.map(t=>t.storage))};
 // Resource embargo in the lab: the actual existing recipient stock is held
 // in a per-town escrow, enabling exactly one new *real courier* shipment.
 const escrow={donor:0,receiver:Math.max(0,to.storage.stone-1)};
 to.storage.stone-=escrow.receiver;
 const events=[],snapshots=[],originalHour=s.hour;
 let delivered=false,postShockLedger=0;
 for(let day=1;day<=45;day++){
  W.advanceTicks(s,3);
  const arrived=s.politics.diplomacy.shipments.filter(q=>
    q.fromTownId===from.id&&q.toTownId===to.id&&
    q.deliveredAtHour>originalHour&&q.delivered);
  if(arrived.length)delivered=true;
  // From the first actual arrival through day33 keep the exporter from
  // accessing its temporarily held stone and the receiver below reserve.
  if(delivered&&day<=33){
   escrow.donor+=from.storage.stone;from.storage.stone=0;
   const excess=Math.max(0,to.storage.stone-4);
   escrow.receiver+=excess;to.storage.stone-=excess;
  }
  if(day===34){
   from.storage.stone+=escrow.donor;to.storage.stone+=escrow.receiver;
   escrow.donor=escrow.receiver=0;
  }
  if(day===35){
   postShockLedger=Math.max(0,to.storage.stone-1);
   to.storage.stone-=postShockLedger;escrow.receiver+=postShockLedger;
  }
  if(day===39){
   to.storage.stone+=escrow.receiver;escrow.receiver=0;
  }
  assert.deepEqual(W.validate(s).errors,[],'controlled day '+day);
  const agenda=u.resourceAgenda,protection=u.exportVeto?.[proposer.id];
  if([1,6,7,14,21,28,33,34,35,36,39,45].includes(day)||
    agenda?.openedAtHour===s.hour||agenda?.closedAtHour===s.hour){
   snapshots.push({day,worldDay:s.hour/24,
     donorStone:from.storage.stone,receiverStone:to.storage.stone,escrow:{...escrow},
     interest:u.interests?.[proposer.id]?.pressure,
     burden:u.interests?.[proposer.id]?.inputs?.exportBurden||null,
     agenda:agenda?{status:agenda.status,proposerId:agenda.proposerId,issue:agenda.type,
       resource:agenda.resource,openedAtHour:agenda.openedAtHour,
       closedAtHour:agenda.closedAtHour||null}:null,
     exportVeto:protection||null,
     unionActive:!Number.isFinite(u.dissolvedAtHour),
     notice:u.exitNotice?.polityId||null,
     newDeliveries:arrived.length});
  }
  if(agenda?.openedAtHour===s.hour||agenda?.closedAtHour===s.hour)
   events.push({hour:s.hour,type:agenda.status,leaderId:agenda.proposerId,central:u.leaderId});
 }
 assert.equal(escrow.donor,0);assert.equal(escrow.receiver,0);
 const endpoint=JSON.parse(JSON.stringify(s));
 const copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
 W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(copy,s);
 const aid=endpoint.politics.diplomacy.shipments.filter(q=>q.fromTownId===from.id&&q.toTownId===to.id&&q.startedAtHour>originalHour);
 return {seed:endpoint.seed,enabled,sourceDay:src.sourceDay,matchedPeople:sourceGen.people===JSON.stringify(W.restore(src.snapshot).people),
  snapshots,events,summary:{
    agenda:enabled?(u.resourceAgenda?.status||'none'):'disabled',
    proposerId:u.resourceAgenda?.proposerId||null,
    deciderId:u.resourceAgenda?.deciderId||null,
    autonomyUntilHour:u.exportVeto?.[proposer.id]?.untilHour||null,
    unionSurvived:!Number.isFinite(u.dissolvedAtHour),
    finalNotice:u.exitNotice?.polityId||null,
    realSourceToRecipientShipments:aid.map(q=>({id:q.id,status:q.status,
      delivered:q.delivered,startedAtHour:q.startedAtHour,deliveredAtHour:q.deliveredAtHour||null})),
    cargoDeliveryAfterFirstShock:aid.filter(q=>q.deliveredAtHour>originalHour+35*24).length
  },validation:'actual natural coalition and actual courier; escrow ledger zero; daily world validate; save/replay'};
}
function compare(){
 const src=source(),baseline=run(src,false),agenda=run(src,true);
 assert.equal(baseline.sourceDay,agenda.sourceDay);
 return {source:{day:src.sourceDay,unionId:src.unionId,
   donor:src.donorTownId,receiver:src.receiverTownId,fromNaturalRealShipmentId:src.originalShipmentId},
   arms:[baseline,agenda]};
}
if(require.main===module){
 const output=compare(),out=path.resolve(__dirname,'../reports/issue-14-resource-agenda-2026-10-24.json');
 fs.writeFileSync(out,JSON.stringify({issue:14,category:'controlled real-stock escrow; no natural agenda-rate inference',
   node:process.version,profile:AGENDA,...output},null,2)+'\n');
 console.log(JSON.stringify(output.arms.map(x=>({enabled:x.enabled,summary:x.summary}))));
 console.log(out);
}
module.exports={source,run,compare,AGENDA};
