/* Shared physical movement/contact layer for World of God PoC v2.
 * Self-contained UMD module so both Node simulations and offline browser use it.
 * No religious conversion occurs here: other systems consume actual encounters.
 */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.WoGMobility=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BASE=Object.freeze({profileId:'mobility-contact-v0.1',enabled:false,
  contactRadius:5,contactWindowDays:7,tripChancePerDay:.35,
  tripCooldownDays:6,minTripCells:9,maxTripCells:27,
  stepsPerTick:7,onsiteTicks:2,specialOnsiteTicks:6,
  workSiteReach:7,fordSpacing:16,maxContacts:6000,
  quarryCount:6,goldCount:2,resourceSpacingCells:10,
  campInjuryChance:.12,campInjuryCooldownDays:45,campInjuryMinHealth:60,
  missionBaseChancePerDay:.10,missionSpreadChancePerDay:.65,
  missionStayTicks:9,missionMaxTripCells:96});
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const day=s=>Math.floor(s.hour/24);
function hash(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function normalize(profile){
  const m={...BASE};
  if(profile?.profileId===m.profileId){
    m.enabled=profile.enabled===true;
    for(const k of Object.keys(m))if(typeof m[k]==='number'&&Number.isFinite(profile[k]))m[k]=profile[k];
  }
  m.contactRadius=bound(m.contactRadius,1,8);
  m.contactWindowDays=Math.round(bound(m.contactWindowDays,1,30));
  m.tripChancePerDay=bound(m.tripChancePerDay,0,1);
  m.tripCooldownDays=Math.round(bound(m.tripCooldownDays,0,90));
  m.minTripCells=Math.round(bound(m.minTripCells,3,40));
  m.maxTripCells=Math.round(bound(m.maxTripCells,m.minTripCells,64));
  m.stepsPerTick=Math.round(bound(m.stepsPerTick,1,16));
  m.onsiteTicks=Math.round(bound(m.onsiteTicks,1,9));
  m.workSiteReach=bound(m.workSiteReach,1,16);
  m.fordSpacing=Math.round(bound(m.fordSpacing,8,32));
  m.maxContacts=Math.round(bound(m.maxContacts,500,20000));
  for(const k of ['quarryCount','goldCount','resourceSpacingCells','specialOnsiteTicks',
    'missionStayTicks','missionMaxTripCells','campInjuryCooldownDays'])
    m[k]=Math.round(bound(m[k],1,k==='missionMaxTripCells'?256:90));
  m.quarryCount=bound(m.quarryCount,2,12);
  m.goldCount=bound(m.goldCount,1,6);
  m.campInjuryChance=bound(m.campInjuryChance,0,.5);
  m.campInjuryMinHealth=bound(m.campInjuryMinHealth,35,90);
  for(const k of ['missionBaseChancePerDay','missionSpreadChancePerDay'])
    m[k]=bound(m[k],0,1);
  return m;
}
function home(s,p){return s.households.find(h=>h.id===p.householdId);}
const cell=(s,x,y)=>s.tiles[y*s.width+x];
function walkable(s,x,y){
  if(x<0||y<0||x>=s.width||y>=s.height)return false;
  return cell(s,x,y).terrain!=='river'||(s.mobility?.enabled&&y%s.mobility.fordSpacing===0);
}
function available(t,p){
  if(!t||t.terrain==='river')return 0;
  const food=Math.max(0,t.forage||0),wood=Math.max(0,t.wood||0),
    fiber=Math.max(0,t.fiber||0),stone=Math.max(0,t.stone||0);
  return (p.occupation==='food_producer'?1.8:1)*food*1.4+
    (p.occupation==='gatherer'?1.5:1)*
      (Math.min(wood,15)*.25+Math.min(stone,18)*.13+Math.min(fiber,10)*.12);
}

function seedHotspots(s){
  if(!s.mobility?.enabled)return;
  const m=s.mobility,w=s.width,h=s.height,chosen=[],areas=[];
  const locations=[s.camp,s.opponentCamp,...(s.settlements||[])].filter(Boolean);
  const targets=[
    locations[0]||{x:w*.2,y:h*.5},locations[1]||{x:w*.75,y:h*.25},
    {x:w*.17,y:h*.2},{x:w*.8,y:h*.75},
    {x:w*.26,y:h*.77},{x:w*.75,y:h*.2},
    {x:w*.48,y:h*.4},{x:w*.5,y:h*.7}];
  function choose(kind,count){
    for(let i=0;i<count;i++){
      const anchor=kind==='stone'?targets[i%6]:targets[6+(i%2)];
      let best=null,score=-Infinity;
      for(const t of s.tiles){
        if(t.terrain==='river'||t.terrain==='field')continue;
        if(chosen.some(x=>distance(x,t)<m.resourceSpacingCells))continue;
        const jitter=(hash(s.seed+'|resource-node|'+kind+'|'+i+'|'+t.x+'|'+t.y)%1000)/1000;
        const quality=kind==='stone'&&t.terrain==='rock'?1.5:0;
        const rating=-distance(t,anchor)+quality+jitter;
        if(rating>score){score=rating;best=t;}
      }
      if(!best)continue;
      best.resourceNode=kind;
      if(kind==='stone')best.stone=1000;
      else best.gold=1000;
      chosen.push({x:best.x,y:best.y,kind});
      areas.push({kind,x:best.x,y:best.y});
    }
  }
  // Legacy worlds preserve their old diffuse stone. Scarce nodes exist only
  // in mobility-enabled new worlds and always remain productive.
  for(const t of s.tiles)if(t.terrain!=='river')t.stone=0;
  choose('stone',m.quarryCount);
  choose('gold',m.goldCount);
  s.mobilityHotspots=areas;
}
function activeSpread(s,p){
  const faith=[s.religion,s.opponentReligion].find(f=>f&&f.id===p.religionId);
  if(!faith||!faith.priests.includes(p.id))return null;
  return faith.oracles.find(o=>o.status==='active'&&
    o.intentType==='religion.spread'&&Number.isFinite(o.propagatedAtHour)&&
    (o.reachedSettlements?.[p.settlementId]||
      s.people.some(q=>q.id===o.saintId&&q.alive&&distance(p,q)<=o.reachRadius)))||null;
}
function recoverWound(s,p){
  if(p.campInjury&&!p.campInjury.recoveredAtHour&&p.health>=95)
    p.campInjury.recoveredAtHour=s.hour;
}
function campRisk(s,p,trip){
  if(trip.campChecked)return;
  trip.campChecked=true;
  if(trip.purpose!=='resource'||!['gold','stone'].includes(trip.resourceKind))return;
  recoverWound(s,p);
  const m=s.mobility;
  if(p.campInjury&&!p.campInjury.recoveredAtHour)return;
  if(Number.isFinite(p.lastCampInjuryAtHour)&&
    s.hour-p.lastCampInjuryAtHour<m.campInjuryCooldownDays*24)return;
  const dice=hash(s.seed+'|camp-injury|'+p.id+'|'+trip.startedAtHour)/4294967296;
  if(dice>=m.campInjuryChance||p.health<=m.campInjuryMinHealth)return;
  const damage=10+(hash(s.seed+'|camp-damage|'+p.id+'|'+trip.startedAtHour)%9);
  const before=p.health;
  p.health=Math.max(m.campInjuryMinHealth,p.health-damage);
  const applied=before-p.health;
  if(applied<=0)return;
  p.campInjury={hour:s.hour,damage:applied,resource:trip.resourceKind,
    x:p.x,y:p.y,recoveredAtHour:null};
  p.lastCampInjuryAtHour=s.hour;
  s.counts.campInjuries=(s.counts.campInjuries||0)+1;
}

function plan(s,p,purpose='resource'){
  const m=s.mobility,h=home(s,p);
  if(!h||!s.tiles.length)return null;
  const sx=Math.round(bound(h.x,0,s.width-1)),sy=Math.round(bound(h.y,0,s.height-1));
  if(!walkable(s,sx,sy))return null;
  const mission=purpose==='mission',possible=mission?
    s.households.filter(target=>target.id!==h.id&&
      s.people.some(q=>q.alive&&q.householdId===target.id&&
        q.settlementId!==p.settlementId&&q.religionId!==p.religionId)):[];
  if(mission&&!possible.length)return null;
  const limit=mission?m.missionMaxTripCells:m.maxTripCells;
  const start=sy*s.width+sx,prev=new Int32Array(s.tiles.length),
    steps=new Int16Array(s.tiles.length),queue=[start];
  prev.fill(-1);steps.fill(-1);steps[start]=0;
  let best=-1,quality=-Infinity;
  for(let cursor=0;cursor<queue.length;cursor++){
    const idx=queue[cursor],length=steps[idx],x=idx%s.width,y=Math.floor(idx/s.width);
    if(length>=m.minTripCells&&cell(s,x,y).terrain!=='river'){
      const t=cell(s,x,y);
      let strength=mission?(possible.some(q=>distance(t,q)<=2)?40:0):available(t,p);
      for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&ny>=0&&nx<s.width&&ny<s.height)
          strength+=.45*available(cell(s,nx,ny),p);
      }
      const jitter=(hash(s.seed+'|hotspot|'+p.id+'|'+Math.floor(day(s)/14)+'|'+idx)%1000)/1000*.65;
      const nodeWeight=p.occupation==='gatherer'&&!mission?
        (t.resourceNode==='stone'?65:t.resourceNode==='gold'?75:0):0;
      const score=strength+nodeWeight-length*(mission?.14:.025)+jitter;
      if((mission?strength>0:strength+nodeWeight>=2)&&score>quality){
        quality=score;best=idx;
      }
    }
    if(length>=limit)continue;
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nx=x+dx,ny=y+dy;
      if(!walkable(s,nx,ny))continue;
      const next=ny*s.width+nx;
      if(steps[next]>=0)continue;
      steps[next]=length+1;prev[next]=idx;queue.push(next);
    }
  }
  if(best<0)return null;
  const path=[];
  for(let idx=best;idx!==start;idx=prev[idx]){if(idx<0)return null;path.push(idx);}
  path.push(start);path.reverse();
  const site=s.tiles[best];
  return {path,index:0,phase:'out',siteTicks:0,purpose,
    resourceKind:mission?null:site.resourceNode||null,
    origin:{x:h.x,y:h.y},cargo:null,startedAtHour:s.hour};
}
function begin(s,p){
  const m=s.mobility;
  if(!m?.enabled||p.stage!=='adult'||p.health<35||p.hunger>.7||
    (Number.isFinite(p.lastVisitStartHour)&&s.hour-p.lastVisitStartHour<m.tripCooldownDays*24))
    return false;
  const spread=activeSpread(s,p);
  const priest=[s.religion,s.opponentReligion].some(f=>f?.priests.includes(p.id));
  const chance=spread?m.missionSpreadChancePerDay:
    priest?m.missionBaseChancePerDay:0;
  const missionRoll=hash(s.seed+'|mission|'+p.id+'|'+day(s))/4294967296;
  let trip=priest&&missionRoll<chance?plan(s,p,'mission'):null;
  if(!trip){
    if(hash(s.seed+'|visit|'+p.id+'|'+day(s))/4294967296>=m.tripChancePerDay)
      return false;
    trip=plan(s,p);
  }
  if(!trip)return false;
  if(trip.purpose==='mission'&&spread)trip.spreadOracleId=spread.id;
  p.mobilityTrip=trip;p.lastVisitStartHour=s.hour;
  if(trip.purpose==='mission')
    s.counts.missionTripsStarted=(s.counts.missionTripsStarted||0)+1;
  else s.counts.resourceVisitsStarted=(s.counts.resourceVisitsStarted||0)+1;
  return true;
}
function gather(s,p,trip){
  if(trip.purpose==='mission'){p.lastPreachHour=s.hour;return;}
  const t=s.tiles[trip.path[trip.path.length-1]];
  if(t.resourceNode==='stone'||t.resourceNode==='gold'){
    trip.resourceKind=t.resourceNode;
    trip.cargo={kind:t.resourceNode,amount:t.resourceNode==='stone'?1.5:.6};
    p.lastWorkHour=s.hour;
    s.counts.rareResourceGathered=(s.counts.rareResourceGathered||0)+1;
    return; // perpetual quarry/vein, without inventing a new deposit on each visit
  }
  const opts=[{kind:'food',key:'forage',w:p.occupation==='food_producer'?2:1},
    {kind:'wood',key:'wood',w:p.occupation==='gatherer'?1.5:1},
    {kind:'stone',key:'stone',w:p.occupation==='gatherer'?1.4:1},
    {kind:'fiber',key:'fiber',w:p.occupation==='gatherer'?1.3:1}];
  opts.sort((a,b)=>t[b.key]*b.w-t[a.key]*a.w);
  const pick=opts[0],amount=Math.min(Math.max(0,t[pick.key]),pick.kind==='food'?.75:1.25);
  if(amount>0){t[pick.key]-=amount;trip.cargo={kind:pick.kind,amount};}
  p.lastWorkHour=s.hour;
}
function step(s,p,distribute){
  const trip=p.mobilityTrip,m=s.mobility,h=home(s,p);
  if(!trip||!h)return false;
  // Positions sampled at equal points during this 8-hour tick. A traveller
  // must be within three cells at the *same* step, not merely cross a path
  // visited at some different time.
  const trace=[{x:p.x,y:p.y}];
  if(h.x!==trip.origin.x||h.y!==trip.origin.y){
    p.x=h.x;p.y=h.y;
    if(trip.cargo)distribute(s,h,trip.cargo.kind,trip.cargo.amount);
    delete p.mobilityTrip;p.mobilityTrace=[{x:p.x,y:p.y}];return true;
  }
  if(trip.phase==='site'){
    const mission=trip.purpose==='mission';
    p.activity=mission?'preach':'visit';
    p.activityReason=mission?'祭司在外村進行實際傳教':
      trip.resourceKind?'在珍稀資源區野營並工作':'在資源熱點停留';
    if(mission){
      p.lastPreachHour=s.hour;
      const faith=[s.religion,s.opponentReligion].find(f=>f?.id===p.religionId);
      const oracle=faith?.oracles.find(o=>o.id===trip.spreadOracleId&&o.status==='active');
      if(oracle){
        oracle.influenceSermonCount=(oracle.influenceSermonCount||0)+1;
        s.counts.missionOracleSermons=(s.counts.missionOracleSermons||0)+1;
      }
    }else if(trip.resourceKind&&trip.siteTicks===1)campRisk(s,p,trip);
    if(!mission&&s.tick%3===2&&p.stage==='adult'&&p.devotion>=20){
      const faith=[s.religion,s.opponentReligion].find(f=>f&&f.id===p.religionId);
      if(faith&&(faith.priests.includes(p.id)||hash(s.seed+'|visit-preach|'+p.id+'|'+s.hour)%4===0)){
        p.activity='preach';p.lastPreachHour=s.hour;
      }
    }
    trip.siteTicks++;
    const duration=mission?m.missionStayTicks:
      trip.resourceKind?m.specialOnsiteTicks:m.onsiteTicks;
    if(trip.siteTicks>=duration)trip.phase='back';
    p.mobilityTrace=trace;return true;
  }
  const direction=trip.phase==='out'?1:-1;
  for(let i=0;i<m.stepsPerTick;i++){
    const next=trip.index+direction;
    if(next<0||next>=trip.path.length)break;
    trip.index=next;p.x=trip.path[next]%s.width;p.y=Math.floor(trip.path[next]/s.width);
    trace.push({x:p.x,y:p.y});
  }
  if(trip.phase==='out'&&trip.index===trip.path.length-1){
    trip.phase='site';gather(s,p,trip);
    p.activity='visit';p.activityReason='步行抵達資源熱點並實際採集';
  }else if(trip.phase==='back'&&trip.index===0){
    p.x=h.x;p.y=h.y;
    if(trip.cargo)distribute(s,h,trip.cargo.kind,trip.cargo.amount);
    delete p.mobilityTrip;
    const metric=trip.purpose==='mission'?'missionTripsCompleted':'resourceVisitsCompleted';
    s.counts[metric]=(s.counts[metric]||0)+1;
    p.activity='rest';p.activityReason='短期出訪後返回家戶';
  }else{
    p.activity='travel';p.activityReason=trip.phase==='out'?
      '步行前往資源熱點（途中可能遇見居民）':'沿原路返回家戶';
  }
  p.mobilityTrace=trace;
  return true;
}
function workLocation(s,p,h,place){
  if(!s.mobility?.enabled||!place||distance(place,h)>s.mobility.workSiteReach)return false;
  // A single work shift may reach a nearby site; crossing the river still
  // requires a marked ford, not a straight-line teleport over deep water.
  for(let i=1;i<=8;i++){
    const x=Math.round(h.x+(place.x-h.x)*i/8),y=Math.round(h.y+(place.y-h.y)*i/8);
    if(!walkable(s,x,y))return false;
  }
  p.x=place.x;p.y=place.y;return true;
}
function record(s){
  const m=s.mobility;if(!m?.enabled)return;
  s.contactLog=(s.contactLog||[]).filter(e=>e.hour>=s.hour-m.contactWindowDays*24);
  for(const p of s.people)if(p.alive)recoverWound(s,p);
  const recent=new Set(s.contactLog.filter(e=>e.hour>s.hour-24).map(e=>e.a+'|'+e.b));
  const size=m.contactRadius,key=(x,y)=>x+','+y;
  const people=s.people.filter(p=>p.alive);
  for(let moment=0;moment<=m.stepsPerTick;moment++){
    const bins=new Map(),entries=[];
    for(const p of people){
      const trace=p.mobilityTrace;
      const pos=trace?.length?trace[Math.min(moment,trace.length-1)]:p;
      const item={p,pos},k=key(Math.floor(pos.x/size),Math.floor(pos.y/size));
      if(!bins.has(k))bins.set(k,[]);
      bins.get(k).push(item);entries.push(item);
    }
    for(const {p,pos} of entries){
      const bx=Math.floor(pos.x/size),by=Math.floor(pos.y/size);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
        for(const {p:q,pos:qp} of bins.get(key(bx+dx,by+dy))||[]){
          if(q.id<=p.id||q.householdId===p.householdId)continue;
          const separation=distance(pos,qp);
          if(separation>m.contactRadius)continue;
          const pair=p.id+'|'+q.id;
          if(recent.has(pair))continue;
          recent.add(pair);
          s.contactLog.push({hour:s.hour,a:p.id,b:q.id,
            aFaithId:p.religionId,bFaithId:q.religionId,
            aTownId:p.settlementId||null,bTownId:q.settlementId||null,
            x:(pos.x+qp.x)/2,y:(pos.y+qp.y)/2,distance:separation});
          s.counts.physicalContacts=(s.counts.physicalContacts||0)+1;
          // A meeting can create actual sermon opportunity. It never converts
          // a 40+ rival by itself; existing evidence and faith rules still apply.
          for(const speaker of [p,q]){
            const faith=[s.religion,s.opponentReligion].find(f=>
              f&&f.id===speaker.religionId);
            if(!faith||speaker.stage!=='adult'||speaker.devotion<20)continue;
            const priest=faith.priests.includes(speaker.id);
            if(priest||hash(s.seed+'|meeting-sermon|'+pair+'|'+day(s)+'|'+speaker.id)%4===0){
              speaker.lastPreachHour=s.hour;
              s.counts.physicalSermons=(s.counts.physicalSermons||0)+1;
            }
          }
          if(p.religionId&&q.religionId&&p.religionId!==q.religionId)
            s.counts.crossFaithMeetings=(s.counts.crossFaithMeetings||0)+1;
          if(p.settlementId&&q.settlementId&&p.settlementId!==q.settlementId)
            s.counts.crossTownMeetings=(s.counts.crossTownMeetings||0)+1;
        }
    }
  }
  for(const p of people)delete p.mobilityTrace; // Never persist transient traces.
  if(s.contactLog.length>m.maxContacts)
    s.contactLog.splice(0,s.contactLog.length-m.maxContacts);
}
function recentContact(s,p,q,sourceFaithId,windowDays){
  if(!s.mobility?.enabled||!p||!q)return null;
  const log=s.contactLog||[],cutoff=s.hour-(windowDays||s.mobility.contactWindowDays)*24;
  for(let i=log.length-1;i>=0;i--){
    const e=log[i];if(e.hour<cutoff)break;
    if(e.a===p.id&&e.b===q.id&&(!sourceFaithId||e.bFaithId===sourceFaithId))return e;
    if(e.a===q.id&&e.b===p.id&&(!sourceFaithId||e.aFaithId===sourceFaithId))return e;
  }
  return null;
}
function townContact(s,faith,fromId,toId){
  if(!s.mobility?.enabled)return false;
  const people=new Map(s.people.filter(p=>p.alive).map(p=>[p.id,p]));
  return (s.contactLog||[]).some(e=>{
    if(e.hour<s.hour-s.mobility.contactWindowDays*24)return false;
    for(const [aId,bId,at,bt] of [[e.a,e.b,e.aTownId,e.bTownId],[e.b,e.a,e.bTownId,e.aTownId]]){
      const a=people.get(aId),b=people.get(bId);
      if(at===fromId&&bt===toId&&a?.religionId===faith.id&&a.devotion>=20&&
        b?.religionId===faith.id&&b.devotion>=20&&
        ((e.a===aId&&e.aFaithId===faith.id&&e.bFaithId===faith.id)||
         (e.b===aId&&e.bFaithId===faith.id&&e.aFaithId===faith.id)))return true;
    }
    return false;
  });
}
return {BASE,normalize,seedHotspots,begin,step,workLocation,record,recentContact,townContact,recoverWound};
});