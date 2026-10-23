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
  maxMarchDays:18,marchCellsPerDay:4,claimStoneUnits:1.5
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
  return out;
}
function init(s,profile){
  const cfg=normalize(profile);
  if(!cfg.enabled)return;
  s.politics={...cfg,polities:[],disputes:[],claims:[],nextDisputeId:1};
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
  return eligible(s,town).sort((a,b)=>merit(b)-merit(a)||a.id.localeCompare(b.id))[0]||null;
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
    !offices.has(p.id));
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
function onDeath(s,p,emit){
  if(!active(s))return;
  for(const polity of s.politics.polities){
    polity.militia.memberIds=polity.militia.memberIds.filter(id=>id!==p.id);
    if(polity.leaderId!==p.id)continue;
    const duration=vacancyDays(s,polity,p.id);
    polity.leaderId=null;polity.vacantUntilHour=s.hour+duration*24;
    if(polity.militia.stance==='march')beginReturn(s,polity);
    const town=townOf(s,polity);
    emit(s,'politics',(town?.name||polity.id)+' 的領袖 '+p.name+' 離世，進入指揮真空。',
      ['空窗 '+duration+' 日；禁止新攻勢，已有攻勢轉為撤退',
       '指揮型防禦加成乘 '+s.politics.vacantCommandFactor+
        '；城牆等實體防禦不會憑空損毀']);
    for(const conflict of s.politics.disputes.filter(c=>c.status==='marching'&&
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
  const polity=s.politics.polities.find(v=>v.militia.memberIds.includes(p.id));
  if(!polity)return false;
  const unit=polity.militia;p.x=unit.x;p.y=unit.y;
  p.activity=unit.stance==='march'?'march':unit.stance==='return'?'retreat':'guard';
  p.activityReason=unit.stance==='march'?'受人類領袖指揮前往爭議資源區':
    unit.stance==='return'?'結束軍事行動，返回原聚落':'當地民兵守備，無法同時從事日常生產';
  return true;
}
function construct(s,p,emit){
  if(!active(s)||s.tick%3!==1||p.stage!=='adult'||p.health<35||p.mobilityTrip)return false;
  const polity=s.politics.polities.find(v=>v.watchtower.status==='building'&&
    residents(s,townOf(s,v)).some(q=>q.id===p.id));
  if(!polity||polity.militia.memberIds.includes(p.id))return false;
  const town=townOf(s,polity);
  const workers=eligible(s,town).filter(q=>!polity.militia.memberIds.includes(q.id)&&
    !q.mobilityTrip).sort((a,b)=>(b.proficiency?.build||0)-(a.proficiency?.build||0)||
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
      emit(s,'conflict',ta.name+' 與 '+tb.name+' 因同一處石礦發生邊境爭端。',
        ['雙方現有石材都低於 '+cfg.resourceNeedStone,'民兵由真實成年居民組成並步行前往礦區',
         '非神明直接指揮，衝突需要雙方有人類領袖與可行軍道路']);
      return; // bounded: at most one new incident per decision day
    }
  }
}
function resolveDisputes(s,emit,die){
  const cfg=s.politics;
  for(const c of cfg.disputes.filter(c=>c.status==='marching')){
    const a=cfg.polities.find(p=>p.id===c.aId),b=cfg.polities.find(p=>p.id===c.bId);
    if(!a||!b)continue;
    const ua=a.militia,ub=b.militia;
    if(!leader(s,a)||!leader(s,b)||!ua.memberIds.length||!ub.memberIds.length){
      c.status='withdrawn';c.winnerId=leader(s,a)?a.id:leader(s,b)?b.id:null;
      c.resolvedAtHour=s.hour;beginReturn(s,a);beginReturn(s,b);
      continue;
    }
    if(ua.stance!=='march'||ub.stance!=='march')continue;
    if(ua.pathIndex!==ua.path.length-1||ub.pathIndex!==ub.path.length-1)continue;
    if(distance(ua,ub)>1.5)continue;
    const aa=defense(s,a,c.site),bb=defense(s,b,c.site);
    const jitter=(hash(s.seed+'|battle|'+c.id)/4294967296-.5)*.3;
    const winner=aa.total+jitter>=bb.total?a:b,loser=winner===a?b:a;
    for(const polity of [a,b]){
      const loss=polity===winner?5:14;
      for(const id of polity.militia.memberIds.slice()){
        const person=s.people.find(p=>p.id===id&&p.alive);
        if(!person)continue;
        person.health=Math.max(0,person.health-loss);
        if(person.health===0)die(s,person.id,'礦區衝突受傷致死');
      }
      beginReturn(s,polity);
    }
    c.status='resolved';c.winnerId=winner.id;c.resolvedAtHour=s.hour;
    // The winning people reached a real, mapped resource node.
    const node=s.tiles[c.site.y*s.width+c.site.x];
    const amount=Math.min(cfg.claimStoneUnits,Math.max(0,node?.stone||0));
    const home=townOf(s,winner);
    if(amount>0&&home){node.stone-=amount;home.storage.stone+=amount;}
    cfg.claims.push({site:c.site,polityId:winner.id,hour:s.hour,stoneGathered:amount});
    emit(s,'conflict',townOf(s,winner).name+' 在石礦衝突中取得優勢，雙方部隊撤回。',
      ['實際行軍至石礦，雙方參戰者承受非必死的傷害',
       '結果依民兵健康與本地守備能力計算，戰鬥後自動撤退',
       '獲取石材 '+amount+'，從地圖現有石材庫存扣除，非憑空生成']);
  }
}
function daily(s,emit,die){
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
  resolveDisputes(s,emit,die);
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
    defense:defense(s,p,townOf(s,p))};
}
function reconcile(s){
  if(!s.politics)return;
  const cfg=normalize(s.politics);
  Object.assign(s.politics,cfg);
  s.politics.polities ||= [];
  s.politics.disputes ||= [];
  s.politics.claims ||= [];
  s.politics.nextDisputeId ||= 1;
}
function validate(s){
  if(!active(s))return [];
  const errors=[],cfg=s.politics;
  const seen=new Set(),soldiers=new Set();
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
      if(!residents(s,town).some(q=>q.id===id))errors.push('民兵不是在世本地居民');
      if(id===p.leaderId)errors.push('地方領袖重複占用民兵職位');
    }
  }
  return errors;
}
return {BASE,normalize,init,daily,onDeath,personDuty,construct,overview,validate,reconcile,defense};
});
