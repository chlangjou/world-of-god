/* Autonomous polity command and frontier dispute experiment.
 * No God-level RTS controls, no fake soldiers, supplies or fortifications.
 * Opt-in only; the normal Web PoC remains untouched without this profile.
 */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.WoGPolitics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BASE=Object.freeze({
  profileId:'polity-command-v0.1',enabled:false,
  successionMinDays:90,successionMaxDays:180,vacantCommandFactor:.5,
  militiaLimit:2,minReserveFood:8,
  watchtowerWood:3,watchtowerStone:1,watchtowerWork:5,watchtowerDefense:2,
  commandDefense:2,resourceNeedStone:10,
  disputeEveryDays:14,disputeCooldownDays:120,maxClaimDistance:25,
  maxMarchDays:18,marchCellsPerDay:4,claimStoneUnits:1.5,battleRounds:3
});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const day=s=>Math.floor(s.hour/24);
function hash(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function normalize(profile){
  const out={...BASE};
  if(profile?.profileId===BASE.profileId){
    out.enabled=profile.enabled===true;
    for(const k of Object.keys(BASE))
      if(typeof BASE[k]==='number'&&Number.isFinite(profile[k]))out[k]=profile[k];
  }
  out.successionMinDays=Math.round(clamp(out.successionMinDays,7,360));
  out.successionMaxDays=Math.round(clamp(out.successionMaxDays,out.successionMinDays,540));
  out.vacantCommandFactor=clamp(out.vacantCommandFactor,0,1);
  for(const k of ['watchtowerWood','watchtowerStone','watchtowerWork','watchtowerDefense','commandDefense',
     'resourceNeedStone','minReserveFood','claimStoneUnits'])
    out[k]=clamp(out[k],0,k==='minReserveFood'?1000:100);
  out.militiaLimit=Math.round(clamp(out.militiaLimit,1,6));
  out.disputeEveryDays=Math.round(clamp(out.disputeEveryDays,1,90));
  out.disputeCooldownDays=Math.round(clamp(out.disputeCooldownDays,7,720));
  out.maxClaimDistance=clamp(out.maxClaimDistance,2,100);
  out.maxMarchDays=Math.round(clamp(out.maxMarchDays,1,60));
  out.marchCellsPerDay=Math.round(clamp(out.marchCellsPerDay,1,12));
  out.battleRounds=Math.round(clamp(out.battleRounds,2,7));
  const d=profile?.diplomacy;
  if(d?.enabled===true)out.diplomacy={enabled:true,
    coreShare:clamp(d.coreShare??.4,.1,1),minCore:Math.round(clamp(d.minCore??3,1,100)),
    peaceTrust:clamp(d.peaceTrust??18,1,100),allianceTrust:clamp(d.allianceTrust??38,1,100),
    peaceDays:Math.round(clamp(d.peaceDays??14,1,180)),
    shipmentUnits:clamp(d.shipmentUnits??1.5,.1,10),shipmentEveryDays:Math.round(clamp(d.shipmentEveryDays??7,1,90))};
  if(out.diplomacy&&d.identity20Enabled===true)out.diplomacy.identity20Enabled=true;
  if(out.diplomacy&&d.union?.enabled===true)out.diplomacy.union={enabled:true,
    allianceDays:Math.round(clamp(d.union.allianceDays??30,1,180)),
    trust:clamp(d.union.trust??65,1,100),delivered:clamp(d.union.delivered??1.5,.1,100),
    contactDays:Math.round(clamp(d.union.contactDays??20,1,180)),
    recentContactDays:Math.round(clamp(d.union.recentContactDays??7,1,30)),
    maxReluctance:clamp(d.union.maxReluctance??.8,0,1)};
  const f=d?.union?.fracture;
  if(out.diplomacy?.union&&f?.enabled===true)out.diplomacy.union.fracture={enabled:true,
    minUnionDays:Math.round(clamp(f.minUnionDays??21,1,180)),
    exitPressure:clamp(f.exitPressure??24,2,200),breachPressure:clamp(f.breachPressure??36,2,200),
    noticeDays:Math.round(clamp(f.noticeDays??7,1,30)),
    breachAmbition:clamp(f.breachAmbition??.7,0,1),
    nonAggressionDays:Math.round(clamp(f.nonAggressionDays??14,1,90)),
    negotiationDays:Math.round(clamp(f.negotiationDays??30,1,180)),
    reunionDays:Math.round(clamp(f.reunionDays??90,1,360))};
  return out;
}
function init(s,profile){
  const cfg=normalize(profile);
  if(!cfg.enabled)return;
  s.politics={...cfg,polities:[],disputes:[],claims:[],nextDisputeId:1};
  if(cfg.diplomacy)s.politics.diplomacy={...cfg.diplomacy,relations:[],shipments:[],nextShipmentId:1};
  if(cfg.diplomacy?.union){s.politics.unions=[];s.politics.nextUnionId=1;}
}
const active=s=>!!s.politics?.enabled;
const townOf=(s,p)=>s.settlements.find(t=>t.id===p.townId);
function residents(s,town){
  if(!town)return [];
  const homes=new Set(town.householdIds);
  return s.people.filter(p=>p.alive&&homes.has(p.householdId));
}
function eligible(s,town){
  return residents(s,town).filter(p=>p.stage==='adult'&&p.health>=35);
}
function merit(p){
  const skill=p.proficiency||{};
  return p.health/50+(skill.build||0)+(skill.gather||0)*.3+
    clamp(p.age||0,18,55)/120;
}
function pickLeader(s,town){
  return eligible(s,town).filter(p=>!courier(s,p.id)).sort((a,b)=>merit(b)-merit(a)||a.id.localeCompare(b.id))[0]||null;
}
function byTown(s,townId){
  return s.politics?.polities.find(p=>p.townId===townId)||null;
}
function leader(s,polity){
  return s.people.find(p=>p.id===polity.leaderId&&p.alive)||null;
}
function ensurePolities(s,emit){
  for(const town of s.settlements){
    if(byTown(s,town.id))continue;
    const first=pickLeader(s,town);
    if(!first)continue; // no invented mayor without a real adult resident
    const polity={id:'polity-'+town.id,townId:town.id,memberTownIds:[town.id],
      leaderId:first.id,vacantUntilHour:null,establishedAtHour:s.hour,
      watchtower:{status:'unbuilt',materialsPaid:false,progress:0},
      militia:{memberIds:[],stance:'defend',x:town.x,y:town.y,path:[],pathIndex:0},
      lastAttackHour:-1};
    s.politics.polities.push(polity);
    emit(s,'politics',town.name+' 推舉 '+first.name+' 為地方領導者。',
      ['從實際在世成年居民推舉；政治職位不代表居民宗教歸屬',
       '國家與軍隊由人類自主決定，神明不能直接下達軍令']);
  }
}
function chooseMilitia(s,polity){
  const town=townOf(s,polity),unit=polity.militia;
  if(!town)return;
  const members=new Set(unit.memberIds);
  // Keep a deployed group intact until it returns home.
  if(unit.stance!=='defend'){
    unit.memberIds=unit.memberIds.filter(id=>eligible(s,town).some(p=>p.id===id));
    return;
  }
  const offices=new Set([s.religion,...[s.opponentReligion,...(s.additionalReligions||[])].filter(Boolean)]
    .flatMap(f=>[...(f.priests||[]),...(f.saints||[])]));
  const all=eligible(s,town).filter(p=>p.id!==polity.leaderId&&!p.mobilityTrip&&
    !offices.has(p.id)&&!courier(s,p.id));
  const selected=all.sort((a,b)=>
    Number(members.has(b.id))-Number(members.has(a.id))||
    b.health-a.health||a.id.localeCompare(b.id)).slice(0,s.politics.militiaLimit);
  unit.memberIds=selected.map(p=>p.id);
  unit.x=town.x;unit.y=town.y;
}
function vacancyDays(s,polity,personId){
  const p=s.politics,range=p.successionMaxDays-p.successionMinDays+1;
  return p.successionMinDays+
    hash(s.seed+'|succession|'+polity.id+'|'+personId+'|'+s.hour)%range;
}
function walkable(s,x,y){
  if(x<0||x>=s.width||y<0||y>=s.height)return false;
  const t=s.tiles[y*s.width+x];
  return t?.terrain!=='river'||(s.mobility?.enabled&&y%s.mobility.fordSpacing===0);
}
function route(s,from,to){
  const start={x:Math.round(from.x),y:Math.round(from.y)};
  const end={x:Math.round(to.x),y:Math.round(to.y)};
  if(!walkable(s,start.x,start.y)||!walkable(s,end.x,end.y))return null;
  const w=s.width,n=w*s.height,a=start.y*w+start.x,z=end.y*w+end.x;
  const parent=new Int32Array(n);parent.fill(-1);parent[a]=a;
  const queue=new Int32Array(n);queue[0]=a;
  let head=0,tail=1;
  // Cardinal steps only. Crossing water is limited to the same fords as Mobility.
  while(head<tail&&parent[z]===-1){
    const cur=queue[head++],x=cur%w,y=Math.floor(cur/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(!walkable(s,nx,ny))continue;
      const next=ny*w+nx;if(parent[next]!==-1)continue;
      parent[next]=cur;queue[tail++]=next;
    }
  }
  if(parent[z]===-1)return null;
  const path=[];
  for(let i=z;;i=parent[i]){
    path.push({x:i%w,y:Math.floor(i/w)});
    if(i===a)break;
  }
  return path.reverse();
}
function beginReturn(s,polity){
  const unit=polity.militia,town=townOf(s,polity);
  if(!town)return;
  const path=route(s,unit,town);
  if(!path){unit.stance='defend';unit.x=town.x;unit.y=town.y;unit.path=[];unit.pathIndex=0;return;}
  unit.stance='return';unit.path=path;unit.pathIndex=0;
}
function onDeath(s,p,emit,departure=false){
  if(!active(s))return;
  for(const u of s.politics.unions||[])if(unionActive(u)&&u.leaderId===p.id)vacateUnion(s,u,p,emit,departure);
  if(!departure)for(const c of s.politics.disputes.filter(c=>c.status==='clashing')){
    if(s.politics.polities.some(v=>[c.aId,c.bId].includes(v.id)&&v.militia.memberIds.includes(p.id))){
      const r=relation(s,c.aId,c.bId);if(r){r.battleDeaths=(r.battleDeaths||0)+1;r.grievance+=4;}
    }
  }
  for(const q of s.politics.diplomacy?.shipments||[])if(!departure&&q.carrierId===p.id&&['outbound','returning'].includes(q.status)){
    q.status='lost';q.lost=q.delivered?0:q.amount;q.finishedAtHour=s.hour;
    emit(s,'diplomacy','合作運輸居民死亡，運送中物資未加入收貨村。',['運輸 '+q.id+'；遺失 '+q.lost]);
  }
  for(const polity of s.politics.polities){
    polity.militia.memberIds=polity.militia.memberIds.filter(id=>id!==p.id);
    if(polity.leaderId!==p.id)continue;
    const duration=vacancyDays(s,polity,p.id);
    polity.leaderId=null;polity.vacantUntilHour=s.hour+duration*24;
    if(['march','clash'].includes(polity.militia.stance))beginReturn(s,polity);
    const town=townOf(s,polity);
    emit(s,'politics',(town?.name||polity.id)+' 的領袖 '+p.name+(departure?' 離開原聚落':' 離世')+'，進入指揮真空。',
      ['空窗 '+duration+' 日；禁止新攻勢，已有攻勢轉為撤退',
       '指揮型防禦加成乘 '+s.politics.vacantCommandFactor+
        '；城牆等實體防禦不會憑空損毀']);
    for(const conflict of s.politics.disputes.filter(c=>['marching','clashing'].includes(c.status)&&
      (c.aId===polity.id||c.bId===polity.id))){
      const other=s.politics.polities.find(v=>v.id===(conflict.aId===polity.id?conflict.bId:conflict.aId));
      conflict.status='withdrawn';conflict.winnerId=other?.id||null;
      conflict.resolvedAtHour=s.hour;
      if(other?.militia.stance==='march')beginReturn(s,other);
      emit(s,'conflict',(town?.name||polity.id)+' 因統帥空缺退出礦區爭端。',
        ['已出發軍隊撤退，未憑空改變任一方人數或資源存量']);
    }
  }
}
function personDuty(s,p){
  if(!active(s))return false;
  const shipment=courier(s,p.id);
  if(shipment){const at=shipment.path[shipment.pathIndex];p.x=at.x;p.y=at.y;
    p.activity='transport';p.activityReason=shipment.status==='outbound'?'依人類盟約運送 '+shipment.resource+' '+shipment.amount+'；抵達才入庫':
      shipment.delivered?'物資已送達，沿原路返村':'攜帶撤回的 '+shipment.resource+' '+shipment.amount+' 返回來源村';return true;}
  const polity=s.politics.polities.find(v=>v.militia.memberIds.includes(p.id));
  if(!polity)return false;
  const unit=polity.militia;p.x=unit.x;p.y=unit.y;
  p.activity=unit.stance==='march'?'march':unit.stance==='clash'?'fight':unit.stance==='return'?'retreat':'guard';
  p.activityReason=unit.stance==='march'?'受人類領袖指揮前往爭議資源區':
    unit.stance==='clash'?'於爭議礦區交戰，可接受真實治療與神蹟影響':
    unit.stance==='return'?'結束軍事行動，返回原聚落':'當地民兵守備，無法同時從事日常生產';
  return true;
}
function construct(s,p,emit){
  if(!active(s)||s.tick%3!==1||p.stage!=='adult'||p.health<35||p.mobilityTrip||courier(s,p.id))return false;
  const polity=s.politics.polities.find(v=>v.watchtower.status==='building'&&
    residents(s,townOf(s,v)).some(q=>q.id===p.id));
  if(!polity||polity.militia.memberIds.includes(p.id))return false;
  const town=townOf(s,polity);
  const workers=eligible(s,town).filter(q=>!polity.militia.memberIds.includes(q.id)&&
    !q.mobilityTrip&&!courier(s,q.id)).sort((a,b)=>(b.proficiency?.build||0)-(a.proficiency?.build||0)||
      a.id.localeCompare(b.id));
  if(workers[0]?.id!==p.id)return false;
  const fort=polity.watchtower;
  fort.progress+=1+(p.proficiency?.build||0)*.5;
  p.activity='build_watchtower';
  p.activityReason='由人類領袖規劃，使用已投入的公共建材修築瞭望塔';
  p.lastWorkHour=s.hour;
  if(fort.progress>=s.politics.watchtowerWork){
    fort.status='built';fort.progress=s.politics.watchtowerWork;
    emit(s,'construction',town.name+' 的居民建成防禦瞭望塔。',
      ['公共木材與石材已實際扣除，建設消耗居民工作時間',
       '瞭望塔提供固定防禦及需要統籌的指揮加成']);
  }
  return true;
}
function defense(s,polity,at){
  const town=townOf(s,polity),isHome=!!town&&distance(at,town)<=5;
  const people=polity.militia.memberIds.map(id=>s.people.find(p=>p.id===id&&p.alive))
    .filter(Boolean);
  const manpower=people.reduce((n,p)=>n+p.health/100,0);
  const fort=isHome&&polity.watchtower.status==='built'?s.politics.watchtowerDefense:0;
  const commandFactor=leader(s,polity)?1:s.politics.vacantCommandFactor;
  const commanded=isHome?s.politics.commandDefense*commandFactor:0;
  return {manpower,fort,commanded,total:manpower+fort+commanded};
}
function advanceUnit(s,unit){
  if(!['march','return'].includes(unit.stance)||!unit.path.length)return;
  unit.pathIndex=Math.min(unit.path.length-1,unit.pathIndex+s.politics.marchCellsPerDay);
  const pos=unit.path[unit.pathIndex];unit.x=pos.x;unit.y=pos.y;
  if(unit.stance==='return'&&unit.pathIndex===unit.path.length-1){
    unit.stance='defend';unit.path=[];unit.pathIndex=0;
  }
}
function assignRoute(s,polity,site){
  const u=polity.militia;
  const path=route(s,u,site);
  if(!path||path.length-1>s.politics.maxMarchDays*s.politics.marchCellsPerDay)return false;
  u.stance='march';u.path=path;u.pathIndex=0;
  return true;
}
function unoccupied(polity){
  return polity.leaderId&&polity.militia.stance==='defend'&&polity.militia.memberIds.length>0;
}
function startDispute(s,emit){
  const cfg=s.politics,polities=cfg.polities;
  if(!s.mobility?.enabled||!Array.isArray(s.mobilityHotspots))return;
  const nodes=s.mobilityHotspots.filter(t=>t.kind==='stone');
  for(let i=0;i<polities.length;i++)for(let j=i+1;j<polities.length;j++){
    const a=polities[i],b=polities[j],ta=townOf(s,a),tb=townOf(s,b);
    if(s.hour<(relation(s,a.id,b.id)?.nonAggressionUntilHour||0))continue;
    if(!offensePolicy(s,a,b).ok||!offensePolicy(s,b,a).ok)continue;
    if(relation(s,a.id,b.id)?.status!=='competition'&&relation(s,a.id,b.id))continue;
    if(!ta||!tb||!unoccupied(a)||!unoccupied(b))continue;
    if(ta.storage.stone>=cfg.resourceNeedStone||tb.storage.stone>=cfg.resourceNeedStone)continue;
    if(cfg.disputes.some(c=>[c.aId,c.bId].includes(a.id)&&[c.aId,c.bId].includes(b.id)&&
      s.hour-c.startedAtHour<cfg.disputeCooldownDays*24))continue;
    const sites=nodes.filter(site=>distance(site,ta)<=cfg.maxClaimDistance&&
      distance(site,tb)<=cfg.maxClaimDistance).sort((x,y)=>
      distance(x,ta)+distance(x,tb)-distance(y,ta)-distance(y,tb)||
      x.x-y.x||x.y-y.y);
    for(const site of sites){
      const routeA=route(s,ta,site),routeB=route(s,tb,site);
      if(!routeA||!routeB||
         routeA.length>cfg.maxMarchDays*cfg.marchCellsPerDay+1||
         routeB.length>cfg.maxMarchDays*cfg.marchCellsPerDay+1)continue;
      if(!assignRoute(s,a,site)||!assignRoute(s,b,site))continue;
      const id='conflict-'+cfg.nextDisputeId++;
      cfg.disputes.push({id,aId:a.id,bId:b.id,site:{x:site.x,y:site.y,kind:site.kind},
        startedAtHour:s.hour,status:'marching',trigger:'both stone reserves below '+cfg.resourceNeedStone,
        winnerId:null,resolvedAtHour:null});
      const incident=cfg.disputes.at(-1);
      for(const [side,p,other]of [['a',a,b],['b',b,a]]){
        const u=unionOf(s,p.id);if(!u)continue;
        incident[side+'UnionId']=u.id;incident[side+'CoordinatorId']=u.leaderId;
        u.decisions.push({hour:s.hour,disputeId:id,representativeId:p.id,otherPolityId:other.id,
          coordinatorId:u.leaderId,reason:'由共同領袖協調單一對外礦區行動；尊重所有成員既有和平協議'});
      }
      emit(s,'conflict',ta.name+' 與 '+tb.name+' 因同一處石礦發生邊境爭端。',
        ['雙方現有石材都低於 '+cfg.resourceNeedStone,'民兵由真實成年居民組成並步行前往礦區',
         '非神明直接指揮，衝突需要雙方有人類領袖與可行軍道路']);
      return; // bounded: at most one new incident per decision day
    }
  }
}
function combatStations(s,site,a,b){
  // Keep two formations on separate *reachable* tiles beside the same physical
  // quarry. This makes Heal targeting meaningful without faking an RTS order.
  const slots=[];
  for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-3,0],[3,0],[0,-3],[0,3]]){
    const at={x:site.x+dx,y:site.y+dy};
    if(walkable(s,at.x,at.y)&&route(s,site,at)?.length<=5)slots.push(at);
  }
  let best=null,rank=-Infinity;
  const ta=townOf(s,a),tb=townOf(s,b);
  for(const first of slots)for(const second of slots){
    const separation=distance(first,second);
    if(separation<3)continue;
    const score=separation*2-distance(first,ta)*.25-distance(second,tb)*.25;
    if(score>rank){rank=score;best=[first,second];}
  }
  return best||[site,site];
}
function resolveDisputes(s,emit,die,notify){
  const cfg=s.politics;
  for(const c of cfg.disputes.filter(c=>['marching','clashing'].includes(c.status))){
    const a=cfg.polities.find(p=>p.id===c.aId),b=cfg.polities.find(p=>p.id===c.bId);
    if(!a||!b)continue;
    const ua=a.militia,ub=b.militia;
    if(!leader(s,a)||!leader(s,b)||!ua.memberIds.length||!ub.memberIds.length){
      c.status='withdrawn';c.winnerId=leader(s,a)?a.id:leader(s,b)?b.id:null;
      c.resolvedAtHour=s.hour;beginReturn(s,a);beginReturn(s,b);
      continue;
    }
    if(c.status==='marching'){
      if(ua.stance!=='march'||ub.stance!=='march')continue;
      if(ua.pathIndex!==ua.path.length-1||ub.pathIndex!==ub.path.length-1)continue;
      if(distance(ua,ub)>1.5)continue;
      // Encounter is now an actual playable interval, not a same-tick combat roll.
      c.status='clashing';c.clashStartedAtHour=s.hour;c.roundsCompleted=0;
      ua.stance='clash';ub.stance='clash';
      const [placeA,placeB]=combatStations(s,c.site,a,b);
      ua.x=placeA.x;ua.y=placeA.y;ub.x=placeB.x;ub.y=placeB.y;
      const townA=townOf(s,a),townB=townOf(s,b);
      emit(s,'conflict',townA.name+' 與 '+townB.name+' 的民兵在石礦開始交戰。',
        ['雙方實際抵達礦區；交戰預計 '+cfg.battleRounds+' 日',
         '玩家可在交戰期間使用合法 Miracle；不需指揮士兵']);
      if(typeof notify==='function')
        notify(s,'pause','battle','石礦交戰：'+townA.name+' vs '+townB.name,
          c.site,{disputeId:c.id});
      continue;
    }
    // Each day resolves only one round. Heal during the interval can change
    // real participants' health and therefore the next engagement's outcome.
    if(s.hour<=c.clashStartedAtHour)continue;
    const powerA=defense(s,a,c.site),powerB=defense(s,b,c.site);
    const jitter=(hash(s.seed+'|round|'+c.id+'|'+c.roundsCompleted)/4294967296-.5)*.24;
    const advantaged=powerA.total+jitter>=powerB.total?a:b;
    for(const force of [a,b]){
      const damage=force===advantaged?2:5;
      for(const id of force.militia.memberIds.slice()){
        const person=s.people.find(p=>p.id===id&&p.alive);
        if(!person)continue;
        person.health=Math.max(0,person.health-damage);
        if(person.health===0)die(s,person.id,'礦區衝突受傷致死');
      }
    }
    c.roundsCompleted++;
    c.lastRoundAtHour=s.hour;
    if(c.status!=='clashing')continue; // a participant death could break command
    if(c.roundsCompleted===1&&c.roundsCompleted<cfg.battleRounds&&typeof notify==='function'){
      const wa=ua.memberIds.filter(id=>s.people.some(p=>p.id===id&&p.alive&&p.health<100)).length;
      const wb=ub.memberIds.filter(id=>s.people.some(p=>p.id===id&&p.alive&&p.health<100)).length;
      if(wa+wb>0)notify(s,'pause','battle-wounded','石礦首輪交戰出現傷兵',c.site,
        {disputeId:c.id,woundedCount:wa+wb});
    }
    if(c.roundsCompleted<cfg.battleRounds)continue;
    const strengthA=defense(s,a,c.site).total,strengthB=defense(s,b,c.site).total;
    const tie=(hash(s.seed+'|battle|'+c.id)/4294967296-.5)*.3;
    const winner=strengthA+tie>=strengthB?a:b;
    for(const force of [a,b])beginReturn(s,force);
    c.status='resolved';c.winnerId=winner.id;c.resolvedAtHour=s.hour;
    const node=s.tiles[c.site.y*s.width+c.site.x];
    const amount=Math.min(cfg.claimStoneUnits,Math.max(0,node?.stone||0));
    const home=townOf(s,winner);
    if(amount>0&&home){node.stone-=amount;home.storage.stone+=amount;}
    cfg.claims.push({site:c.site,polityId:winner.id,hour:s.hour,stoneGathered:amount});
    emit(s,'conflict',townOf(s,winner).name+' 在石礦衝突中取得優勢，雙方部隊撤回。',
      ['實際交戰 '+c.roundsCompleted+' 日，連續傷害與 Healing 會影響最終戰力',
       '雙方由既有居民參戰，結果按健康、民兵人數與陣地支援計算',
       '獲取石材 '+amount+'，從地圖現有石材庫存扣除，非憑空生成']);
  }
}
function syncMembership(s,emit){
  if(!active(s))return;
  for(const p of s.politics.polities){
    const local=new Set(residents(s,townOf(s,p)).map(q=>q.id));
    p.militia.memberIds=p.militia.memberIds.filter(id=>local.has(id));
    if(p.leaderId&&!local.has(p.leaderId)){
      const departed=s.people.find(q=>q.id===p.leaderId);
      if(departed)onDeath(s,departed,emit,true);
    }
  }
  for(const u of s.politics.unions||[])if(unionActive(u)&&u.leaderId&&!unionMembers(s,u).some(p=>p.leaderId===u.leaderId)){
    const departed=s.people.find(p=>p.id===u.leaderId);if(departed)vacateUnion(s,u,departed,emit,true);
  }
}
function unionMembers(s,u){return s.politics.polities.filter(p=>u.memberPolityIds.includes(p.id));}
const unionActive=u=>!Number.isFinite(u.dissolvedAtHour);
function unionOf(s,polityId){return s.politics?.unions?.find(u=>unionActive(u)&&u.memberPolityIds.includes(polityId))||null;}
function reluctance(s,a,b){return ((hash(s.seed+'|ambition|'+a.leaderId)%100)+
  (hash(s.seed+'|ambition|'+b.leaderId)%100))/200;}
function offensePolicy(s,p,other){
  const u=unionOf(s,p.id);if(!u)return {ok:true};
  const enemyUnion=unionOf(s,other.id),others=enemyUnion?unionMembers(s,enemyUnion):[other];
  if(u===enemyUnion)return {ok:false,reason:'同一政治聯合'};
  if(!u.leaderId||!s.people.some(q=>q.id===u.leaderId&&q.alive))return {ok:false,reason:'共同指揮真空'};
  const members=unionMembers(s,u);
  if(members.some(a=>others.some(b=>{const r=relation(s,a.id,b.id);return r&&(r.status!=='competition'||s.hour<(r.nonAggressionUntilHour||0));})))
    return {ok:false,reason:'共同對外政策尊重成員的和平或同盟'};
  if(s.politics.disputes.some(c=>['marching','clashing'].includes(c.status)&&
    members.some(a=>[c.aId,c.bId].includes(a.id))))return {ok:false,reason:'聯合已有對外行動'};
  return {ok:true,unionId:u.id,coordinatorId:u.leaderId};
}
function withdrawUnion(s,u,emit,reason,onlyAgainst=[]){
  for(const c of s.politics.disputes)if(['marching','clashing'].includes(c.status)&&
    u.memberPolityIds.some(id=>[c.aId,c.bId].includes(id))&&
    (!onlyAgainst.length||onlyAgainst.some(id=>[c.aId,c.bId].includes(id)))){
    c.status='withdrawn';c.winnerId=null;c.resolvedAtHour=s.hour;c.reason=reason;
    for(const id of [c.aId,c.bId]){const p=s.politics.polities.find(p=>p.id===id);if(p)beginReturn(s,p);}
    emit(s,'conflict',u.name+' 協調撤回對外礦區行動。',[reason,'雙方實際部隊返回原村；沒有資源或戰果轉移']);
  }
}
function vacateUnion(s,u,person,emit,departure){
  u.leaderId=null;u.vacantUntilHour=s.hour+vacancyDays(s,u,person.id)*24;
  u.history.push({type:'vacancy',hour:s.hour,personId:person.id,untilHour:u.vacantUntilHour});
  withdrawUnion(s,u,emit,'union-command-vacancy');
  emit(s,'politics',u.name+' 的共同領袖 '+person.name+(departure?' 離開職位':' 離世')+'，對外指揮暫停。',
    ['空窗 '+Math.round((u.vacantUntilHour-s.hour)/24)+' 日','地方領袖、守備、行政、庫存與盟村運輸繼續依原規則運作']);
}
function electUnionLeader(s,members){return members.map(p=>leader(s,p)).filter(Boolean)
  .sort((a,b)=>merit(b)-merit(a)||a.id.localeCompare(b.id))[0]||null;}
function memberInterests(s,u,p,peer){
  const own=townOf(s,p),other=townOf(s,peer),shipments=s.politics.diplomacy.shipments;
  const need=t=>residents(s,t).reduce((n,q)=>n+(q.stage==='adult'?s.rules.foodNeedAdult:s.rules.foodNeedChild),0);
  const foodDays=t=>t.storage.food/Math.max(.01,need(t));
  const reasons=[],inputs={stone:own.storage.stone,peerStone:other.storage.stone,
    publicFoodDays:foodDays(own),peerPublicFoodDays:foodDays(other)};
  let blocked=null;
  // A real reachable quarry opportunity conflicts with the partner's treaty.
  if(unoccupied(p)&&own.storage.stone<s.politics.resourceNeedStone){
    for(const outside of s.politics.polities){
      if(u.memberPolityIds.includes(outside.id)||!unoccupied(outside))continue;
      const mine=relation(s,p.id,outside.id),theirs=relation(s,peer.id,outside.id),town=townOf(s,outside);
      if((mine&&(mine.status!=='competition'||s.hour<(mine.nonAggressionUntilHour||0)))||!theirs||theirs.status==='competition'||
        !town||town.storage.stone>=s.politics.resourceNeedStone)continue;
      if(s.politics.disputes.some(c=>[c.aId,c.bId].includes(p.id)&&[c.aId,c.bId].includes(outside.id)&&
        s.hour-c.startedAtHour<s.politics.disputeCooldownDays*24))continue;
      const rivalUnion=unionOf(s,outside.id);
      if(rivalUnion&&unionMembers(s,rivalUnion).some(q=>{const r=relation(s,p.id,q.id);
        return r&&(r.status!=='competition'||s.hour<(r.nonAggressionUntilHour||0));}))continue;
      const site=(s.mobilityHotspots||[]).find(at=>at.kind==='stone'&&
        (s.tiles[at.y*s.width+at.x]?.stone||0)>0&&
        distance(at,own)<=s.politics.maxClaimDistance&&distance(at,town)<=s.politics.maxClaimDistance&&
        [own,town].every(from=>{const path=route(s,from,at);return path&&path.length-1<=s.politics.maxMarchDays*s.politics.marchCellsPerDay;}));
      if(site){blocked=outside.id;inputs.quarry={x:site.x,y:site.y};break;}
    }
  }
  if(blocked){reasons.push('本村缺石，但盟村的對外協議阻止可達礦區行動');inputs.blockedPolityId=blocked;}
  const delayed=['food','stone','wood'].find(resource=>{
    const target=resource==='food'?need(own)*3:3,reserve=resource==='food'?need(other)*7:5;
    if(own.storage[resource]>=target||other.storage[resource]<reserve+s.politics.diplomacy.shipmentUnits)return false;
    return !shipments.some(q=>q.fromTownId===other.id&&q.toTownId===own.id&&q.resource===resource&&
      ((q.status==='outbound')||(q.delivered&&q.deliveredAtHour>s.hour-7*24)));
  });
  if(delayed){reasons.push('本村公共 '+delayed+' 儲備低，盟村有餘裕但近期無到貨或在途支援');inputs.unmetResource=delayed;}
  const burden=['stone','wood'].find(resource=>{
    if(own.storage[resource]>=5||other.storage[resource]<=own.storage[resource])return false;
    const recent=shipments.filter(q=>q.resource===resource&&q.delivered&&q.deliveredAtHour>Math.max(u.formedAtHour,s.hour-30*24));
    const given=recent.filter(q=>q.fromTownId===own.id&&q.toTownId===other.id).reduce((n,q)=>n+q.amount,0);
    const got=recent.filter(q=>q.fromTownId===other.id&&q.toTownId===own.id).reduce((n,q)=>n+q.amount,0);
    return given-got>=s.politics.diplomacy.shipmentUnits;
  });
  if(burden){reasons.push('近期淨輸出 '+burden+'，但目前本村比盟村短缺');inputs.exportBurden=burden;}
  return {reasons,inputs,blockedPolityId:blocked,weight:(blocked?2:0)+(delayed?1:0)+(burden?1:0)};
}
function dissolveUnion(s,u,p,kind,emit){
  const cfg=s.politics.diplomacy.union.fracture,[a,b]=unionMembers(s,u),r=relation(s,a.id,b.id);
  const reason=u.interests[p.id].reasons.join('；');
  withdrawUnion(s,u,emit,'union-'+kind);
  // Only undelivered cargo is recalled. It walks the already travelled prefix home.
  for(const q of s.politics.diplomacy.shipments)if(q.status==='outbound'&&
    u.memberTownIds.includes(q.fromTownId)&&u.memberTownIds.includes(q.toTownId)){
    q.path=q.path.slice(0,q.pathIndex+1).reverse();q.pathIndex=0;q.status='returning';
    q.cancelledAtHour=s.hour;q.cancelReason='union-'+kind;
  }
  u.dissolvedAtHour=s.hour;u.dissolutionKind=kind;u.dissolutionReason=reason;u.exitByPolityId=p.id;
  u.history.push({type:kind,hour:s.hour,polityId:p.id,personId:p.leaderId,reason,
    evidence:structuredEvidence(u.interests[p.id])});
  u.leaderId=null;u.vacantUntilHour=null;u.exitNotice=null;
  r.status=kind==='breach'?'competition':'peace';r.changedAtHour=s.hour;
  r.peaceAtHour=kind==='exit'?s.hour:null;r.allianceAtHour=null;
  r.trust=Math.min(r.trust,s.politics.diplomacy.peaceTrust*.5);
  if(kind==='breach')r.grievance+=12;
  r.cooperationSinceHour=s.hour;r.nonAggressionUntilHour=s.hour+cfg.nonAggressionDays*24;
  r.renegotiateAfterHour=s.hour+cfg.negotiationDays*24;r.reunionAfterHour=s.hour+cfg.reunionDays*24;
  r.lastSeparation={kind,hour:s.hour,reason,unionId:u.id};
  r.transitions||=[];r.transitions.push({status:r.status,hour:s.hour,reason,kind});
  emit(s,'politics',u.name+(kind==='breach'?' 因單方破約而分裂。':' 協商後退出政治聯合，保留和平。'),
    [townOf(s,p).name+' 的地方領袖決定退出；'+reason,
      '各村人物、地方領袖、庫存與工事保留；未抵達貨物原路退回',
      cfg.nonAggressionDays+' 日禁止相互攻勢；'+cfg.reunionDays+' 日後才可重新申請聯合']);
}
function structuredEvidence(interest){return JSON.parse(JSON.stringify({pressure:interest.pressure,reasons:interest.reasons,inputs:interest.inputs}));}
function unionStabilityDaily(s,u,emit){
  if(u.stabilityHour===s.hour)return;u.stabilityHour=s.hour;
  const cfg=s.politics.diplomacy.union.fracture,members=unionMembers(s,u);u.interests||={};
  for(const p of members){
    const observation=memberInterests(s,u,p,members.find(q=>q!==p)),old=u.interests[p.id]?.pressure||0;
    u.interests[p.id]={...observation,pressure:clamp(old+(observation.weight||-2),0,200),hour:s.hour};
  }
  if(u.exitNotice){
    const notice=u.exitNotice,p=members.find(p=>p.id===notice.polityId),interest=u.interests[p.id];
    if(interest.pressure<cfg.exitPressure/2){
      u.history.push({type:'notice-retracted',hour:s.hour,polityId:p.id,reason:'實際利益衝突緩解'});u.exitNotice=null;
      emit(s,'politics',u.name+' 的退出爭議緩解，繼續合作。',['短缺或共同政策衝突已改善，退出通知撤回']);
    }else if(s.hour>=notice.deadlineHour&&leader(s,p)&&interest.weight>0){
      const ambitious=hash(s.seed+'|ambition|'+p.leaderId)%100/100>=cfg.breachAmbition;
      const breach=ambitious&&interest.blockedPolityId&&interest.pressure>=cfg.breachPressure;
      dissolveUnion(s,u,p,breach?'breach':'exit',emit);
    }
    return;
  }
  if(s.hour-u.formedAtHour<cfg.minUnionDays*24)return;
  const p=members.filter(p=>leader(s,p)&&u.interests[p.id].weight>0&&u.interests[p.id].pressure>=cfg.exitPressure)
    .sort((a,b)=>u.interests[b.id].pressure-u.interests[a.id].pressure||a.id.localeCompare(b.id))[0];
  if(!p)return;
  u.exitNotice={polityId:p.id,leaderId:p.leaderId,hour:s.hour,deadlineHour:s.hour+cfg.noticeDays*24,
    reason:u.interests[p.id].reasons.join('；')};
  u.history.push({type:'exit-notice',hour:s.hour,polityId:p.id,reason:u.interests[p.id].reasons.join('；'),
    evidence:structuredEvidence(u.interests[p.id])});
  emit(s,'politics',townOf(s,p).name+' 提出退出 '+u.name+' 的通知。',
    [u.interests[p.id].reasons.join('；'),cfg.noticeDays+' 日協商期；實際支援或利益改善可撤回通知']);
}
function unionsDaily(s,emit){
  const cfg=s.politics.diplomacy?.union;if(!cfg?.enabled)return;
  for(const u of s.politics.unions){
    if(!unionActive(u))continue;
    if(cfg.fracture)unionStabilityDaily(s,u,emit);
    if(!unionActive(u))continue;
    if(!u.leaderId&&s.hour>=u.vacantUntilHour){
      const elected=electUnionLeader(s,unionMembers(s,u));
      if(elected){u.leaderId=elected.id;u.vacantUntilHour=null;
        u.history.push({type:'succession',hour:s.hour,personId:elected.id});
        emit(s,'politics',u.name+' 推舉 '+elected.name+' 接任共同領袖。',['由實際在世地方領袖協調；不合併各村行政與庫存']);
      }else u.vacantUntilHour=s.hour+7*24;
    }
  }
  // A bounded two-village union. Existing unions neither absorb nor overlap.
  for(const r of s.politics.diplomacy.relations.filter(r=>r.status==='alliance')
    .sort((a,b)=>b.trust-a.trust||a.aId.localeCompare(b.aId)||a.bId.localeCompare(b.bId))){
    const delivered=r.cooperationSinceHour===undefined?r.delivered:
      s.politics.diplomacy.shipments.filter(q=>q.delivered&&q.deliveredAtHour>r.cooperationSinceHour&&
        [q.aId,q.bId].includes(r.aId)&&[q.aId,q.bId].includes(r.bId)).reduce((n,q)=>n+q.amount,0);
    if(s.hour<(r.reunionAfterHour||0)||unionOf(s,r.aId)||unionOf(s,r.bId)||r.trust<cfg.trust||delivered<cfg.delivered||
      r.contactDays<cfg.contactDays||s.hour-r.allianceAtHour<cfg.allianceDays*24)continue;
    const a=s.politics.polities.find(p=>p.id===r.aId),b=s.politics.polities.find(p=>p.id===r.bId);
    if(!a||!b||!leader(s,a)||!leader(s,b)||reluctance(s,a,b)>cfg.maxReluctance)continue;
    if(s.politics.disputes.some(c=>['marching','clashing'].includes(c.status)&&
      [c.aId,c.bId].some(id=>id===a.id||id===b.id)))continue;
    const ta=townOf(s,a),tb=townOf(s,b);
    const contacted=(s.contactLog||[]).some(e=>e.hour>s.hour-cfg.recentContactDays*24&&
      ((e.aTownId===ta.id&&e.bTownId===tb.id)||(e.aTownId===tb.id&&e.bTownId===ta.id)));
    if(!contacted)continue;
    const elected=electUnionLeader(s,[a,b]);
    const reason='同盟維持 '+Math.floor((s.hour-r.allianceAtHour)/24)+' 日；實際運抵 '+delivered+
      '；接觸 '+r.contactDays+' 日；雙方領袖同意協調，地方自治保留';
    const u={id:'union-'+s.politics.nextUnionId++,name:ta.name+'・'+tb.name+'聯合',
      memberPolityIds:[a.id,b.id],memberTownIds:[ta.id,tb.id],leaderId:elected.id,
      formedAtHour:s.hour,vacantUntilHour:null,reason,decisions:[],
      history:[{type:'formed',hour:s.hour,personId:elected.id,reason}]};
    s.politics.unions.push(u);
    emit(s,'politics',u.name+' 成立，推舉 '+elected.name+' 為共同協調領袖。',
      [reason,'各村領袖與庫存不合併；每次至多一支地方民兵代表聯合對外行動']);
  }
}
function relation(s,a,b){return s.politics?.diplomacy?.relations.find(r=>
  (r.aId===a&&r.bId===b)||(r.aId===b&&r.bId===a));}
function courier(s,id){return s.politics?.diplomacy?.shipments.find(q=>q.carrierId===id&&
  ['outbound','returning'].includes(q.status));}
function coreFaith(s,town){
  const cfg=s.politics.diplomacy,people=residents(s,town),counts={};
  for(const p of people)if(p.religionId&&p.devotion>=40)counts[p.religionId]=(counts[p.religionId]||0)+1;
  const best=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
  return {id:best&&best[1]>=cfg.minCore&&best[1]/Math.max(1,people.length)>=cfg.coreShare?best[0]:null,
    core:best?.[1]||0,population:people.length};
}
function identityFaith(s,town){
  const cfg=s.politics.diplomacy,people=residents(s,town),counts={};
  for(const p of people)if(p.religionId&&p.devotion>=20){
    const f=counts[p.religionId]||={believers:0,core:0};f.believers++;f.core+=Number(p.devotion>=40);}
  const ranked=Object.entries(counts).sort((a,b)=>b[1].believers-a[1].believers||a[0].localeCompare(b[0]));
  const best=ranked[0],population=people.length;
  return {id:best&&best[1].believers>=cfg.minCore&&best[1].believers/Math.max(1,population)>=cfg.coreShare&&
    best[1].believers>(ranked[1]?.[1].believers||0)?best[0]:null,
    believers:best?.[1].believers||0,core:best?.[1].core||0,population,
    coreShare:(best?.[1].core||0)/Math.max(1,population)};
}
function transition(s,r,status,a,b,emit){
  r.status=status;r.changedAtHour=s.hour;r[status+'AtHour']=s.hour;
  r.transitions||=[];r.transitions.push({status,hour:s.hour,reason:r.reason,
    ...(r.faithAssessment?{faithAssessment:JSON.parse(JSON.stringify(r.faithAssessment))}:{})});
  // Stop actual running sorties on either side, not just their future decisions.
  for(const c of s.politics.disputes)if(['marching','clashing'].includes(c.status)&&
    [c.aId,c.bId].includes(a.id)&&[c.aId,c.bId].includes(b.id)){
    c.status='withdrawn';c.winnerId=null;c.resolvedAtHour=s.hour;c.reason='negotiated-peace';
    beginReturn(s,a);beginReturn(s,b);
  }
  for(const [p,other]of [[a,b],[b,a]]){
    const u=unionOf(s,p.id),opponent=unionOf(s,other.id);
    if(u)withdrawUnion(s,u,emit,'union-member-treaty',opponent?opponent.memberPolityIds:[other.id]);
  }
  emit(s,'diplomacy',townOf(s,a).name+' 與 '+townOf(s,b).name+(status==='peace'?' 達成和解。':' 建立互助同盟。'),
    [r.reason,'實際跨村接觸日數 '+r.contactDays+'；信任 '+r.trust.toFixed(1),
      '地方領袖、庫存、宗教與防禦工事仍各自保留']);
}
function transportDaily(s,emit){
  const d=s.politics.diplomacy;
  for(const q of d.shipments){
    if(!['outbound','returning'].includes(q.status))continue;
    const person=s.people.find(p=>p.id===q.carrierId&&p.alive);
    if(!person)continue; // onDeath accounts for lost cargo.
    q.pathIndex=Math.min(q.path.length-1,q.pathIndex+s.politics.marchCellsPerDay);
    const at=q.path[q.pathIndex];person.x=at.x;person.y=at.y;
    if(q.pathIndex!==q.path.length-1)continue;
    if(q.status==='outbound'){
      const recipient=s.settlements.find(t=>t.id===q.toTownId);
      if(!recipient){q.path=q.path.slice().reverse();q.pathIndex=0;q.status='returning';continue;}
      recipient.storage[q.resource]+=q.amount;q.delivered=true;q.deliveredAtHour=s.hour;
      const r=relation(s,q.aId,q.bId);if(r)r.delivered+=q.amount;
      emit(s,'diplomacy',recipient.name+' 收到盟村運來的 '+q.resource+' '+q.amount+'。',
        ['運輸居民 '+person.name+' 已沿可行路線抵達','出發時已從來源村扣庫存；不是新生資源']);
      q.path=q.path.slice().reverse();q.pathIndex=0;q.status='returning';
    }else{
      // Failed destination returns cargo to the original owner if it still exists.
      if(!q.delivered){const origin=s.settlements.find(t=>t.id===q.fromTownId);
        if(origin){origin.storage[q.resource]+=q.amount;q.refunded=true;}else q.lost=q.amount;}
      q.status='complete';q.finishedAtHour=s.hour;
    }
  }
}
function sendAid(s,r,a,b,emit){
  const d=s.politics.diplomacy;
  if(s.hour-(r.lastShipmentHour??-1e9)<d.shipmentEveryDays*24)return;
  for(const [donor,receiver]of [[a,b],[b,a]]){
    const from=townOf(s,donor),to=townOf(s,receiver);
    if(!leader(s,donor)||!leader(s,receiver))continue;
    const soldiers=new Set(s.politics.polities.flatMap(p=>p.militia.memberIds));
    const offices=new Set([s.religion,s.opponentReligion,...(s.additionalReligions||[])].filter(Boolean)
      .flatMap(f=>[...(f.priests||[]),...(f.saints||[])]));
    const carrier=eligible(s,from).filter(p=>p.id!==donor.leaderId&&!soldiers.has(p.id)&&
      !offices.has(p.id)&&!p.mobilityTrip&&!courier(s,p.id)).sort((x,y)=>x.id.localeCompare(y.id))[0];
    if(!carrier)continue;
    // Food reserve uses real residents' daily needs; materials retain a local buffer.
    for(const resource of ['stone','wood','food']){
      const reserve=resource==='food'?residents(s,from).length*s.rules.foodNeedAdult*7:5;
      const needed=resource==='food'?residents(s,to).length*s.rules.foodNeedAdult*3:3;
      if(from.storage[resource]<reserve+d.shipmentUnits||to.storage[resource]>=needed)continue;
      const path=route(s,carrier,to);
      if(!path||path.length<2||path.length-1>s.politics.maxMarchDays*s.politics.marchCellsPerDay)continue;
      // Reserve one real resident's work time, and reserve real cargo immediately.
      const amount=d.shipmentUnits;from.storage[resource]-=amount;
      const q={id:'aid-'+d.nextShipmentId++,aId:a.id,bId:b.id,fromTownId:from.id,toTownId:to.id,
        carrierId:carrier.id,resource,amount,path,pathIndex:0,status:'outbound',
        startedAtHour:s.hour,delivered:false,lost:0};
      d.shipments.push(q);r.lastShipmentHour=s.hour;
      carrier.activity='transport';carrier.activityReason='依盟約攜帶實際物資前往盟村';
      emit(s,'diplomacy',from.name+' 派 '+carrier.name+' 運送物資支援 '+to.name+'。',
        ['來源庫存已扣除 '+resource+' '+amount,'沿實際非河水格／渡口運輸；抵達前不加入收貨庫存']);
      return;
    }
  }
}
function diplomacyDaily(s,emit){
  const d=s.politics.diplomacy;if(!d?.enabled)return;
  transportDaily(s,emit);
  const polities=s.politics.polities;
  for(let i=0;i<polities.length;i++)for(let j=i+1;j<polities.length;j++){
    const a=polities[i],b=polities[j],ta=townOf(s,a),tb=townOf(s,b);
    if(!ta||!tb||distance(ta,tb)>s.politics.maxClaimDistance*2)continue;
    let r=relation(s,a.id,b.id);
    if(!r){r={aId:a.id,bId:b.id,status:'competition',trust:0,contactDays:0,delivered:0,
      grievance:0,seenDisputes:[],lastEvaluatedHour:s.hour-24,changedAtHour:s.hour,reason:'尚無跨村協議'};d.relations.push(r);}
    for(const c of s.politics.disputes)if([c.aId,c.bId].includes(a.id)&&[c.aId,c.bId].includes(b.id)){
      if(!r.seenDisputes.includes(c.id)){r.seenDisputes.push(c.id);r.grievance+=8;r.trust=Math.max(0,r.trust-4);}
      r.seenRounds||={};const rounds=c.roundsCompleted||0;
      r.grievance+=Math.max(0,rounds-(r.seenRounds[c.id]||0))*1.5;r.seenRounds[c.id]=rounds;
    }
    const contacts=(s.contactLog||[]).filter(e=>e.hour>r.lastEvaluatedHour&&e.hour<=s.hour&&
      ((e.aTownId===ta.id&&e.bTownId===tb.id)||(e.aTownId===tb.id&&e.bTownId===ta.id)));
    r.lastEvaluatedHour=s.hour;
    const fa=d.identity20Enabled?identityFaith(s,ta):coreFaith(s,ta),fb=d.identity20Enabled?identityFaith(s,tb):coreFaith(s,tb),same=!!fa.id&&fa.id===fb.id;
    if(d.identity20Enabled)r.faithAssessment={a:fa,b:fb,sameIdentity:same};
    else delete r.faithAssessment;
    const leaderSame=leader(s,a)?.religionId&&leader(s,a)?.religionId===leader(s,b)?.religionId;
    const benefit=['wood','stone','food'].some(k=>Math.abs(ta.storage[k]-tb.storage[k])>=5);
    // Preference is seed/person-derived and stable across replay and reload.
    const reserve=reluctance(s,a,b);
    r.reason=(d.identity20Enabled?(same?'主要宗教認同相同':'主要宗教認同不同或不足')+
      '（40+核心 '+fa.core+'/'+fa.population+'、'+fb.core+'/'+fb.population+'）':
      same?'主要核心信仰相同':'主要核心信仰不同或不足')+'；'+
      (leaderSame?'領袖同教':'領袖信仰各自獨立')+'；'+(benefit?'有庫存互補':'互補有限')+
      '；接觸 '+contacts.length+'；舊怨 '+r.grievance.toFixed(1)+'；領袖保留 '+reserve.toFixed(2);
    if(contacts.length){
      r.contactDays++;r.grievance=Math.max(0,r.grievance-.3);
      r.trust=Math.min(100,r.trust+(1+(same?1.4:0)+(leaderSame?.2:0)+(benefit?.7:0))*(1-reserve*.5)/(1+r.grievance/10));
    }
    if(s.hour>=(r.renegotiateAfterHour||0)&&contacts.length&&leader(s,a)&&leader(s,b)){
      if(r.status==='competition'&&r.trust>=d.peaceTrust&&r.grievance<12&&r.contactDays>=5)
        transition(s,r,'peace',a,b,emit);
      else if(r.status==='peace'&&r.trust>=d.allianceTrust&&s.hour-r.peaceAtHour>=d.peaceDays*24&&benefit)
        transition(s,r,'alliance',a,b,emit);
    }
    if(r.status==='alliance')sendAid(s,r,a,b,emit);
  }
}
function daily(s,emit,die,notify){
  if(!active(s))return;
  ensurePolities(s,emit);
  const cfg=s.politics;
  for(const polity of cfg.polities){
    const town=townOf(s,polity);
    if(!town)continue;
    if(!leader(s,polity)&&polity.vacantUntilHour!==null&&s.hour>=polity.vacantUntilHour){
      const elected=pickLeader(s,town);
      if(elected){
        polity.leaderId=elected.id;polity.vacantUntilHour=null;
        emit(s,'politics',town.name+' 經過繼承空窗，推舉 '+elected.name+' 接任。',
          ['實際在世居民繼任；集中指揮能力恢復']);
      }else polity.vacantUntilHour=s.hour+7*24; // vacant town cannot invent successors
    }
    chooseMilitia(s,polity);
    const fort=polity.watchtower;
    if(fort.status==='unbuilt'&&leader(s,polity)&&
      town.storage.food>=cfg.minReserveFood&&
      town.storage.wood>=cfg.watchtowerWood&&
      town.storage.stone>=cfg.watchtowerStone){
      town.storage.wood-=cfg.watchtowerWood;town.storage.stone-=cfg.watchtowerStone;
      fort.status='building';fort.materialsPaid=true;
      emit(s,'construction',town.name+' 的領袖決定使用現有木材與石材修築瞭望塔。',
        ['已從公共庫存扣除木材 '+cfg.watchtowerWood+' 與石材 '+cfg.watchtowerStone,
         '仍需居民實際投入 '+cfg.watchtowerWork+' 工作量']);
    }
    advanceUnit(s,polity.militia);
  }
  diplomacyDaily(s,emit);
  unionsDaily(s,emit);
  resolveDisputes(s,emit,die,notify);
  if(day(s)>0&&day(s)%cfg.disputeEveryDays===0)startDispute(s,emit);
}
function overview(s,townId){
  if(!active(s))return null;
  const p=byTown(s,townId);if(!p)return null;
  const head=leader(s,p);
  const vacancy=Number.isFinite(p.vacantUntilHour)?
    Math.max(0,Math.ceil((p.vacantUntilHour-s.hour)/24)):0;
  return {polityId:p.id,leaderId:head?.id||null,leaderName:head?.name||null,
    vacantDays:vacancy,militia:p.militia.memberIds.length,
    stance:p.militia.stance,fort:p.watchtower.status,
    fortProgress:p.watchtower.progress,
    commandFactor:head?1:s.politics.vacantCommandFactor,
    defense:defense(s,p,townOf(s,p)),
    union:unionOf(s,p.id)?(()=>{const u=unionOf(s,p.id),head=s.people.find(q=>q.id===u.leaderId&&q.alive);
      return {id:u.id,name:u.name,memberTownIds:u.memberTownIds,leaderId:u.leaderId,
        leaderName:head?.name||null,vacantDays:u.vacantUntilHour===null?0:Math.max(0,Math.ceil((u.vacantUntilHour-s.hour)/24)),
        formedAtHour:u.formedAtHour,reason:u.reason,exitNotice:u.exitNotice||null,
        interest:u.interests?.[p.id]||null};})():null,
    lastUnionSeparation:(s.politics.unions||[]).filter(u=>!unionActive(u)&&u.memberPolityIds.includes(p.id)).at(-1)||null,
    relations:(s.politics.diplomacy?.relations||[]).filter(r=>r.aId===p.id||r.bId===p.id).map(r=>({
      ...r,partnerTownId:s.politics.polities.find(v=>v.id===(r.aId===p.id?r.bId:r.aId))?.townId}))};
}
function reconcile(s){
  if(!s.politics)return;
  const cfg=normalize(s.politics);
  if(cfg.diplomacy)cfg.diplomacy={...s.politics.diplomacy,...cfg.diplomacy};
  Object.assign(s.politics,cfg);
  s.politics.polities ||= [];
  s.politics.disputes ||= [];
  s.politics.claims ||= [];
  s.politics.nextDisputeId ||= 1;
  if(cfg.diplomacy?.union){s.politics.unions ||= [];s.politics.nextUnionId ||= 1;}
}
function validate(s){
  if(!active(s))return [];
  const errors=[],cfg=s.politics;
  const seen=new Set(),soldiers=new Set();
  const d=cfg.diplomacy,carriers=new Set();
  const unionIds=new Set(),unionMembersSeen=new Set();
  for(const u of cfg.unions||[]){
    if(unionIds.has(u.id))errors.push('政治聯合 ID 重複');unionIds.add(u.id);
    if(!Array.isArray(u.memberPolityIds)||u.memberPolityIds.length!==2||new Set(u.memberPolityIds).size!==2){errors.push('政治聯合成員不正確');continue;}
    const members=unionMembers(s,u);
    if(members.length!==2||JSON.stringify(members.map(p=>p.townId).sort())!==JSON.stringify([...(u.memberTownIds||[])].sort()))
      errors.push('政治聯合缺少原有地方政體或村落');
    if(!unionActive(u)){
      if(u.dissolvedAtHour<u.formedAtHour||!['exit','breach'].includes(u.dissolutionKind)||
        !u.memberPolityIds.includes(u.exitByPolityId)||!u.dissolutionReason)errors.push('聯合分裂紀錄不正確');
    }else{
      for(const id of u.memberPolityIds){if(unionMembersSeen.has(id))errors.push('地方政體重複加入聯合');unionMembersSeen.add(id);}
      if(u.leaderId){if(!members.some(p=>p.leaderId===u.leaderId&&leader(s,p)))errors.push('共同領袖不是在世地方領袖');
        if(u.vacantUntilHour!==null)errors.push('共同領袖與真空期限衝突');
      }else if(!Number.isFinite(u.vacantUntilHour))errors.push('共同指揮真空缺少期限');
      if(u.exitNotice&&(!u.memberPolityIds.includes(u.exitNotice.polityId)||
        !Number.isFinite(u.exitNotice.deadlineHour)||u.exitNotice.deadlineHour<u.exitNotice.hour))errors.push('退出通知不正確');
    }
    for(const interest of Object.values(u.interests||{}))if(!Number.isFinite(interest.pressure)||
      interest.pressure<0||interest.pressure>200)errors.push('聯合利益壓力不正確');
    if(!Number.isFinite(u.formedAtHour)||!Array.isArray(u.decisions)||!Array.isArray(u.history))errors.push('政治聯合歷史不完整');
  }
  if(d?.enabled){
    for(const r of d.relations||[]){
      if(!['competition','peace','alliance'].includes(r.status)||!Number.isFinite(r.trust)||r.trust<0||r.trust>100)
        errors.push('外交關係狀態不正確');
      if(r.aId===r.bId||![r.aId,r.bId].every(id=>cfg.polities.some(p=>p.id===id)))errors.push('外交缺少地方政體');
      for(const field of ['cooperationSinceHour','nonAggressionUntilHour','renegotiateAfterHour','reunionAfterHour'])
        if(r[field]!==undefined&&!Number.isFinite(r[field]))errors.push('外交冷卻期限不正確');
    }
    for(const q of d.shipments||[]){
      if(!['wood','stone','food'].includes(q.resource)||!Number.isFinite(q.amount)||q.amount<=0)errors.push('盟約貨物不正確');
      if(q.delivered&&q.refunded)errors.push('盟約貨物重複入庫與退款');
      if(!['outbound','returning'].includes(q.status))continue;
      if(carriers.has(q.carrierId))errors.push('運輸居民重複值勤');carriers.add(q.carrierId);
      if(!s.people.some(p=>p.id===q.carrierId&&p.alive))errors.push('運輸缺少在世居民');
      if(!Array.isArray(q.path)||!q.path.length||q.pathIndex<0||q.pathIndex>=q.path.length||
        q.path.some(at=>!walkable(s,at.x,at.y)))errors.push('運輸路徑不正確');
    }
  }
  for(const p of cfg.polities){
    if(seen.has(p.townId))errors.push('政體重複控制同一聚落');
    seen.add(p.townId);
    const town=townOf(s,p);
    if(!town)errors.push('政體缺少實際聚落 '+p.townId);
    if(p.leaderId&&!residents(s,town).some(q=>q.id===p.leaderId))errors.push('領袖已非在世本地居民');
    if(p.watchtower.status!=='unbuilt'&&!p.watchtower.materialsPaid)
      errors.push('瞭望塔未投入材料');
    if(!Number.isFinite(p.watchtower.progress)||p.watchtower.progress<0)
      errors.push('防禦工事工期不正確');
    for(const id of p.militia.memberIds){
      if(soldiers.has(id))errors.push('同一居民加入不同軍隊');
      soldiers.add(id);
      if(carriers.has(id))errors.push('運輸居民同時參軍');
      if(!residents(s,town).some(q=>q.id===id))errors.push('民兵不是在世本地居民');
      if(id===p.leaderId)errors.push('地方領袖重複占用民兵職位');
    }
  }
  return errors;
}
return {BASE,normalize,init,daily,onDeath,personDuty,construct,overview,validate,reconcile,defense,coreFaith,identityFaith,relation,syncMembership,unionOf,offensePolicy};
});
