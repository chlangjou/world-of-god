/* Shrine / Temple v0.1. Religious facilities coordinate real people, never create faith or Presence. */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.WoGTemple=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BASE=Object.freeze({
  profileId:'shrine-temple-v0.1',enabled:false,
  walkReach:7,contactRadius:5,attendanceInformal:.17,attendanceShrine:.27,
  attendanceTemple:.38,priestExtraAttendance:.10,
  recentDays:30,shrineVisits:12,templeVisits:35,
  shrineMinDistinct:2,templeMinDistinct:4,
  shrineWood:1,shrineStone:0,shrineWork:2,
  templeWood:4,templeStone:1,templeWork:6,
  buildPriority:7.6,minimumFoodDays:3,declineAfterDays:70
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hash(x){let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function draw(s,...parts){return hash([s.seed,...parts].join('|'))/4294967296;}
function normalize(profile){
 const p={...BASE};
 if(profile?.profileId!==BASE.profileId)return p;
 p.enabled=profile.enabled===true;
 for(const [k,v] of Object.entries(BASE))
   if(typeof v==='number'&&Number.isFinite(profile[k]))p[k]=profile[k];
 for(const k of ['attendanceInformal','attendanceShrine','attendanceTemple','priestExtraAttendance'])
   p[k]=clamp(p[k],0,.8);
 for(const k of ['shrineVisits','templeVisits','shrineMinDistinct','templeMinDistinct','recentDays','declineAfterDays'])
   p[k]=Math.round(clamp(p[k],1,365));
 p.walkReach=clamp(p.walkReach,1,12);
 p.contactRadius=clamp(p.contactRadius,1,8);
 for(const k of ['shrineWood','shrineStone','shrineWork','templeWood','templeStone','templeWork'])
   p[k]=clamp(p[k],0,50);
 p.buildPriority=clamp(p.buildPriority,0,15);
 p.minimumFoodDays=clamp(p.minimumFoodDays,0,30);
 return p;
}
function init(s,profile){s.shrineTemple=normalize(profile);s.religiousSites=[];}
function active(s){return !!s.shrineTemple?.enabled;}
function members(s,town,faithId){const homes=new Set(town.householdIds);
 return s.people.filter(p=>p.alive&&homes.has(p.householdId)&&p.religionId===faithId&&p.devotion>=20);
}
function walkable(s,x,y){
 if(x<0||y<0||x>=s.width||y>=s.height)return false;
 const terrain=s.tiles[y*s.width+x]?.terrain;
 return terrain!=='river'||(s.mobility?.enabled&&y%s.mobility.fordSpacing===0);
}
function route(s,start,site,limit){
 if(d(start,site)>limit)return null;
 const steps=Math.max(Math.abs(Math.round(site.x-start.x)),Math.abs(Math.round(site.y-start.y)),1);
 if(steps>limit)return null;
 const trace=[];
 for(let i=0;i<=steps;i++){
   const x=Math.round(start.x+(site.x-start.x)*i/steps),
     y=Math.round(start.y+(site.y-start.y)*i/steps);
   if(!walkable(s,x,y))return null;
   trace.push({x,y});
 }
 return trace;
}
function location(s,town,faithId){
 const residents=members(s,town,faithId);
 if(!residents.length)return null;
 const homes=residents.map(p=>s.households.find(h=>h.id===p.householdId)).filter(Boolean);
 const midpoint={x:homes.reduce((z,h)=>z+h.x,0)/homes.length,
   y:homes.reduce((z,h)=>z+h.y,0)/homes.length};
 let best=null,bestScore=Infinity;
 for(let y=Math.max(1,Math.floor(midpoint.y-6));y<Math.min(s.height-1,Math.ceil(midpoint.y+7));y++)
   for(let x=Math.max(1,Math.floor(midpoint.x-6));x<Math.min(s.width-1,Math.ceil(midpoint.x+7));x++){
     const cell=s.tiles[y*s.width+x];
     if(!cell||cell.terrain==='river'||cell.terrain==='field')continue;
     if(s.households.some(h=>h.home&&d(h,{x,y})<1.25))continue;
     if(s.settlements.some(t=>t.granary&&d(t.granary,{x,y})<1.7))continue;
     if((s.religiousSites||[]).some(t=>d(t,{x,y})<3.5))continue;
     const reachable=homes.filter(h=>route(s,h,{x,y},s.shrineTemple.walkReach)).length;
     if(!reachable)continue;
     const score=d(midpoint,{x,y})+5*(1-reachable/homes.length)+
       draw(s,'site',town.id,faithId,x,y)*.2;
     if(score<bestScore){best={x,y};bestScore=score;}
   }
 return best;
}
function observe(s,emit){
 if(!active(s))return;
 s.religiousSites ||= [];
 for(const town of s.settlements){
   for(const faith of [s.religion,s.opponentReligion].filter(Boolean)){
     if(s.religiousSites.some(site=>site.townId===town.id&&site.religionId===faith.id))continue;
     // Informal meeting places require a real believer with a lived social/prayer reason.
     const followers=members(s,town,faith.id);
     if(!followers.some(p=>p.activity==='pray'||p.activity==='preach'||faith.priests.includes(p.id)))
       continue;
     const pos=location(s,town,faith.id);if(!pos)continue;
     const site={id:'rs'+(s.religiousSites.length+1),townId:town.id,religionId:faith.id,
       controller:'religious-community',x:pos.x,y:pos.y,stage:'gathering',
       condition:100,activity:0,visits:[],totalVisits:0,lastVisitHour:-1,
       proposed:null,buildProgress:0,materialsPaid:false,createdAtHour:s.hour};
     s.religiousSites.push(site);
     emit(s,'religion',faith.name+'的居民在 '+town.name+' 約定一處共同祈禱地點。',
       ['居民自然形成集會場所，尚未建造 Shrine','場所本身不提供 Divine Power 或 Presence']);
   }
 }
}
function recent(s,site){
 const cutoff=s.hour-s.shrineTemple.recentDays*24;
 site.visits=(site.visits||[]).filter(v=>v.hour>=cutoff);
 site.activity=site.visits.length/s.shrineTemple.recentDays;
 return {total:site.visits.length,distinct:new Set(site.visits.map(v=>v.personId)).size};
}
function templeCoreFree(s,site){
 return !(s.religiousSites||[]).some(other=>other!==site&&
   other.stage==='temple'&&d(other,site)<4);
}
function daily(s,emit){
 if(!active(s))return;
 observe(s,emit);
 const rule=s.shrineTemple,day=Math.floor(s.hour/24);
 for(const site of s.religiousSites){
   const use=recent(s,site);
   if(site.stage==='temple'&&day%30===0){
     const town=s.settlements.find(t=>t.id===site.townId);
     if(use.total&&town?.storage.wood>=.5){
       town.storage.wood-=.5;site.condition=Math.min(100,site.condition+3);
     }else site.condition=Math.max(0,site.condition-4);
   }
   if(site.stage!=='gathering'&&
     s.hour-site.lastVisitHour>rule.declineAfterDays*24)
       site.condition=Math.max(0,site.condition-1);
   if(site.condition===0&&site.stage!=='ruin'){
     site.stage='ruin';site.proposed=null;site.buildProgress=0;
     emit(s,'religion','一處宗教設施因長期荒廢成為遺址。',
       ['建築衰敗不刪除任何人的信仰，居民仍可自行恢復祈禱']);
   }
   if(site.proposed)continue;
   const proposed=(site.stage==='gathering'||site.stage==='ruin')&&
     use.total>=rule.shrineVisits&&use.distinct>=rule.shrineMinDistinct?'shrine':
     site.stage==='shrine'&&use.total>=rule.templeVisits&&
     use.distinct>=rule.templeMinDistinct&&templeCoreFree(s,site)?'temple':null;
   if(proposed){
     site.proposed=proposed;site.buildProgress=0;site.materialsPaid=false;
     emit(s,'religion','居民因反覆實際集會，開始籌建 '+(proposed==='temple'?'Temple':'Shrine')+'。',
       ['須由願意的居民投入建材與工作時間，神明不能直接放置']);
   }
 }
}
function candidates(s,p,town,foodDays){
 if(!active(s)||!town||p.devotion<20||p.health<35||p.hunger>.55||
   foodDays<s.shrineTemple.minimumFoodDays)return null;
 const h=s.households.find(v=>v.id===p.householdId);
 if(!h)return null;
 const site=(s.religiousSites||[]).find(t=>t.townId===town.id&&
   t.religionId===p.religionId&&t.proposed&&
   route(s,h,t,s.shrineTemple.walkReach)&&
   (t.proposed!=='temple'||templeCoreFree(s,t))&&
   (t.materialsPaid||(town.storage.wood+(h.inventory.wood||0)>=
     s.shrineTemple[t.proposed+'Wood']&&
     town.storage.stone+(h.inventory.stone||0)>=s.shrineTemple[t.proposed+'Stone'])));
 return site||null;
}
function spend(town,h,kind,amount){
 const common=Math.min(town.storage[kind]||0,amount);
 town.storage[kind]-=common;
 h.inventory[kind]=Math.max(0,(h.inventory[kind]||0)-(amount-common));
}
function build(s,p,h,town,site,efficiency,emit){
 if(!active(s)||!site?.proposed||p.religionId!==site.religionId)return false;
 if(!site.materialsPaid){
   const type=site.proposed,rule=s.shrineTemple;
   if(town.storage.wood+(h.inventory.wood||0)+1e-9<rule[type+'Wood']||
     town.storage.stone+(h.inventory.stone||0)+1e-9<rule[type+'Stone'])return false;
   spend(town,h,'wood',rule[type+'Wood']);
   spend(town,h,'stone',rule[type+'Stone']);
   site.materialsPaid=true;
 }
 site.buildProgress+=(1+p.proficiency.build*.55)*efficiency;
 if(site.buildProgress>=s.shrineTemple[site.proposed+'Work']){
   const built=site.proposed;
   site.stage=built;site.condition=100;site.proposed=null;site.buildProgress=0;
   emit(s,'religion',town.name+' 的居民自主建成 '+(built==='temple'?'Temple':'Shrine')+'。',
     ['耗用實際工作與建材，並非由神明建造',
      '建築不直接增加信仰、Divine Power 或 Local Presence']);
 }
 return true;
}
function attend(s,p){
 if(!active(s)||!s.mobility?.enabled||p.mobilityTrip||p.stage!=='adult'||
    p.health<30||p.hunger>.7||p.devotion<20)return false;
 const home=s.households.find(h=>h.id===p.householdId);
 if(!home)return false;
 const faith=[s.religion,s.opponentReligion].find(f=>f&&f.id===p.religionId);
 if(!faith)return false;
 const sites=(s.religiousSites||[]).filter(t=>t.religionId===p.religionId&&
   t.townId===p.settlementId).sort((a,b)=>d(a,home)-d(b,home));
 const day=Math.floor(s.hour/24),r=s.shrineTemple;
 for(const site of sites){
   const trace=route(s,home,site,r.walkReach);if(!trace)continue;
   const base=site.stage==='temple'?r.attendanceTemple:
     site.stage==='shrine'?r.attendanceShrine:r.attendanceInformal;
   const priest=faith.priests.includes(p.id);
   const chance=clamp(base+ (priest?r.priestExtraAttendance:0),0,.85)*
     clamp(.5+p.devotion/100,.5,1.5);
   if(draw(s,'attendance',p.id,site.id,day)>=chance)continue;
   p.x=site.x;p.y=site.y;
   // Every sampled position lies on walkable land; physical encounters are
   // recorded by the shared mobility layer, never created by temple influence.
   p.mobilityTrace=trace;
   p.activity='worship';
   p.activityReason='自主步行到 '+(site.stage==='temple'?'Temple':site.stage==='shrine'?'Shrine':'集會點')+' 共同祈禱';
   p.religiousVisit={siteId:site.id,hour:s.hour};
   site.visits.push({hour:s.hour,personId:p.id});
   site.totalVisits++;site.lastVisitHour=s.hour;
   s.counts.ritualAttendances=(s.counts.ritualAttendances||0)+1;
   return true;
 }
 return false;
}
function afterContacts(s,oracleFor){
 if(!active(s)||!s.mobility?.enabled)return;
 for(const site of s.religiousSites||[]){
   const participants=s.people.filter(p=>p.alive&&
     p.religiousVisit?.siteId===site.id&&p.religiousVisit.hour===s.hour&&d(p,site)<=1);
   if(participants.length<2)continue;
   const faith=[s.religion,s.opponentReligion].find(f=>f?.id===site.religionId);
   if(!faith)continue;
   for(const priest of participants.filter(p=>faith.priests.includes(p.id))){
     const hasRealContact=participants.some(other=>other!==priest&&
       (s.contactLog||[]).some(e=>e.hour===s.hour&&
         ((e.a===priest.id&&e.b===other.id)||(e.a===other.id&&e.b===priest.id))));
     if(!hasRealContact)continue;
     priest.lastPreachHour=s.hour;
     const oracle=oracleFor(priest);
     if(oracle?.status==='active'&&oracle.propagatedAtHour!==null){
       oracle.influenceSermonCount=(oracle.influenceSermonCount||0)+1;
       s.counts.ritualOracleSermons=(s.counts.ritualOracleSermons||0)+1;
     }
   }
 }
}
function validate(s){
 if(!active(s))return [];
 const errors=[],seen=new Set();
 for(const site of s.religiousSites||[]){
   if(seen.has(site.id))errors.push('宗教設施 ID 重複');
   seen.add(site.id);
   if(!s.settlements.some(t=>t.id===site.townId)||
      ![s.religion,s.opponentReligion].some(f=>f?.id===site.religionId))
       errors.push('宗教設施歸屬無效');
   if(!Number.isFinite(site.condition)||site.condition<0||site.condition>100||
      !Number.isFinite(site.x)||!Number.isFinite(site.y)||!walkable(s,site.x,site.y))
       errors.push('宗教設施位置／狀況無效');
   if(site.stage==='temple'&&!templeCoreFree(s,site))errors.push('Temple Core 重疊');
 }
 return errors;
}
return {BASE,normalize,init,daily,candidates,build,attend,afterContacts,validate};
});