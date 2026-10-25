/* Living World: display-only camera, interpolation and character acting.
   Never touches simulation RNG, world time, resources or save fields. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createCamera(width=64,height=64){
  return {width,height,zoom:1,x:width/2,y:height/2,followId:null};
}
function constrain(c){
  c.zoom=clamp(Number(c.zoom)||1,1,8);
  const halfX=c.width/(2*c.zoom),halfY=c.height/(2*c.zoom);
  c.x=clamp(c.x,halfX,c.width-halfX);
  c.y=clamp(c.y,halfY,c.height-halfY);
  return c;
}
function transform(c,screenWidth,screenHeight){
  constrain(c);
  const scaleX=screenWidth/c.width*c.zoom,scaleY=screenHeight/c.height*c.zoom;
  return {scaleX,scaleY,tx:screenWidth/2-c.x*scaleX,ty:screenHeight/2-c.y*scaleY};
}
function toWorld(c,px,py,w,h){
  const t=transform(c,w,h);
  return {x:(px-t.tx)/t.scaleX,y:(py-t.ty)/t.scaleY};
}
function toScreen(c,x,y,w,h){
  const t=transform(c,w,h);
  return {x:x*t.scaleX+t.tx,y:y*t.scaleY+t.ty};
}
function focus(c,x,y){c.x=x;c.y=y;return constrain(c);}
function setZoom(c,z,anchorX,anchorY,w,h){
  const before=toWorld(c,anchorX,anchorY,w,h);
  c.zoom=clamp(z,1,8);
  const t=transform(c,w,h);
  c.x=before.x-(anchorX-w/2)/t.scaleX;
  c.y=before.y-(anchorY-h/2)/t.scaleY;
  return constrain(c);
}
function pan(c,dx,dy,w,h){
  const t=transform(c,w,h);
  c.x-=dx/t.scaleX;c.y-=dy/t.scaleY;
  return constrain(c);
}
function bounds(c,w,h){
  const topLeft=toWorld(c,0,0,w,h),bottomRight=toWorld(c,w,h,w,h);
  return {minX:topLeft.x,minY:topLeft.y,maxX:bottomRight.x,maxY:bottomRight.y};
}
function snapshot(world){
  return new Map((world.people||[]).filter(p=>p.alive).map(p=>
    [p.id,{x:p.x,y:p.y,health:p.health,activity:p.activity}]));
}
function validPath(trace,from,to){
  if(!Array.isArray(trace)||trace.length<2||trace.length>200)return null;
  if(!trace.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
  if(distance(trace[0],from)>.15||distance(trace[trace.length-1],to)>.15)return null;
  return trace.map(p=>({x:p.x,y:p.y}));
}
function transitions(previous,world,at,duration){
  const result=new Map();
  if(!(duration>0))return result;
  for(const p of world.people||[]){
    const from=previous.get(p.id);
    if(!p.alive||!from||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const to={x:p.x,y:p.y},length=distance(from,to);
    if(length<.01)continue;
    const route=validPath(p.mobilityTrace,from,to);
    // Long jumps without a real trace are relocations, not invented walks.
    if(length>8&&!route)continue;
    result.set(p.id,{from:{x:from.x,y:from.y},to,
      path:route||[{x:from.x,y:from.y},to],
      startedAt:at,duration,moving:true});
  }
  return result;
}
function position(record,person,now){
  if(!record)return {x:person.x,y:person.y,moving:false};
  const fraction=clamp((now-record.startedAt)/record.duration,0,1);
  if(fraction>=1)return {x:person.x,y:person.y,moving:false};
  const path=record.path;
  const lengths=[],total=path.slice(1).reduce((acc,v,i)=>{
    const step=distance(path[i],v);
    lengths.push(step);return acc+step;
  },0);
  if(total<.00001)return {x:person.x,y:person.y,moving:false};
  let along=fraction*total;
  for(let i=0;i<lengths.length;i++){
    if(along<=lengths[i]||i===lengths.length-1){
      const a=path[i],b=path[i+1],u=lengths[i]?clamp(along/lengths[i],0,1):1;
      return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,moving:true};
    }
    along-=lengths[i];
  }
  return {x:person.x,y:person.y,moving:false};
}
/* Detail is a truthful, state-derived physical performance, not a mood model.
   Receives the base person pictogram and augments eyes, mouth and gestures. */
function drawActing(c,p,x,y,cell,time,options={}){
  const zoom=options.zoom||1;
  if(zoom<3)return;
  const hurt=p.health<75||!!(p.campInjury&&!p.campInjury.recoveredAtHour&&p.health<95);
  const hungry=p.hunger>.75;
  const healed=!!options.healed;
  const travel=!!options.moving;
  const work=['farm','forage','wood','stone','fiber','build','build_granary','build_ritual','visit'].includes(p.activity);
  const prayer=['pray','worship','preach'].includes(p.activity);
  const resting=p.activity==='rest'||p.activity==='family'||p.activity==='care';
  const small=p.stage==='child',headR=cell*(small?.23:.32);
  const beat=Math.sin(time*(travel?11:work?6:3)+(p.id.charCodeAt(p.id.length-1)||0));
  c.save();
  // Eyes and eyebrows on actual faction-coloured head.
  c.fillStyle='#18332d';
  for(const sign of [-1,1]){
    c.beginPath();c.arc(x+sign*headR*.35,y-headR*.14,Math.max(.045*cell,headR*.09),0,Math.PI*2);c.fill();
  }
  c.strokeStyle='#19332e';c.lineWidth=Math.max(.035*cell,.35);
  c.beginPath();
  if(hurt||hungry){
    c.moveTo(x-headR*.40,y+headR*.44);
    c.quadraticCurveTo(x,y+headR*.12,x+headR*.4,y+headR*.44);
  }else if(healed||prayer){
    c.moveTo(x-headR*.40,y+headR*.26);
    c.quadraticCurveTo(x,y+headR*.65,x+headR*.40,y+headR*.26);
  }else{
    c.moveTo(x-headR*.24,y+headR*.34);
    c.lineTo(x+headR*.24,y+headR*.34);
  }
  c.stroke();
  // Activity-appropriate hands, tools and ground cues. No forced new work.
  c.strokeStyle=options.coat||'#cddbc4';
  c.lineWidth=Math.max(.08*cell,.8);c.lineCap='round';
  if(prayer){
    c.beginPath();
    c.moveTo(x-cell*.25,y+cell*.34);
    c.lineTo(x-cell*.13,y-cell*(.25+.06*beat));
    c.moveTo(x+cell*.25,y+cell*.34);
    c.lineTo(x+cell*.13,y-cell*(.25-.06*beat));c.stroke();
    if(zoom>=5){
      c.fillStyle='#ffe4a0';c.font='bold '+(cell*.43)+'px system-ui';
      c.textAlign='center';c.fillText(p.activity==='preach'?'言':'祈',x,y-cell*1.38);
    }
  }else if(work){
    c.beginPath();
    c.moveTo(x+cell*.28,y+cell*.38);
    c.lineTo(x+cell*(.52+.10*beat),y+cell*(.20-.20*beat));c.stroke();
    c.strokeStyle='#dfcc9f';c.lineWidth=.07*cell;c.beginPath();
    c.moveTo(x+cell*(.52+.10*beat),y+cell*(.20-.20*beat));
    c.lineTo(x+cell*(.80+.10*beat),y+cell*(.65-.20*beat));c.stroke();
    if(zoom>=5){
      c.fillStyle='#f1d399';c.font='bold '+(cell*.36)+'px system-ui';
      c.fillText('•',x+cell*.77,y+cell*.69);
    }
  }else if(resting){
    c.strokeStyle='#d0d8bc';c.lineWidth=.08*cell;c.beginPath();
    c.moveTo(x-cell*.25,y+cell*.45);c.lineTo(x-cell*.31,y+cell*.70);
    c.moveTo(x+cell*.25,y+cell*.45);c.lineTo(x+cell*.31,y+cell*.70);c.stroke();
  }
  if(hurt){
    c.strokeStyle='#eb6669';c.lineWidth=.10*cell;
    c.beginPath();c.moveTo(x+cell*.51,y-cell*.9);c.lineTo(x+cell*.83,y-cell*.9);
    c.moveTo(x+cell*.67,y-cell*1.06);c.lineTo(x+cell*.67,y-cell*.74);c.stroke();
  }else if(healed){
    c.fillStyle='#9bf2c9';c.font='bold '+(cell*.43)+'px system-ui';
    c.textAlign='center';c.fillText('+',x+cell*.67,y-cell*.83);
  }
  c.restore();
}

// Crowd layout is exclusively visual. Every person retains their real position;
// God casts, meetings, trips and saves continue using the simulation state.
const CROWD_SLOTS=Object.freeze([
  [-.34,-.34],[.34,-.34],[0,.36],[-.34,.36],[.34,.36],
  [0,-.60],[-.34,-.76],[.34,-.76]
]);
function crowdLimit(zoom){
  return zoom<1.5?1:zoom<3?3:zoom<6?5:8;
}
function arrangeCrowds(people,pose,zoom,slotMemory=new Map(),selectedId=null){
  const byCell=new Map(),sprites=new Map(),groups=[];
  for(const p of people||[]){
    if(!p.alive||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const tileX=Math.floor(p.x),tileY=Math.floor(p.y);
    const key=tileX+':'+tileY;
    if(!byCell.has(key))byCell.set(key,{key,tileX,tileY,members:[]});
    byCell.get(key).members.push(p);
  }
  const limit=crowdLimit(zoom);
  for(const group of byCell.values()){
    const members=group.members.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    const count=members.length;
    const groupId=group.key;
    const visible=members.slice(0,limit);
    // Selecting a previously collapsed resident must reveal their own avatar.
    const chosen=members.find(p=>p.id===selectedId);
    if(chosen&&!visible.includes(chosen)&&visible.length)visible[visible.length-1]=chosen;
    const shown=new Set(visible.map(p=>p.id));
    const assigned=new Map(),occupied=new Set();
    // Reserve retained unique slots first; Zoom changes or new selected people
    // can otherwise accidentally assign two avatars to one slot.
    for(const p of visible){
      const saved=slotMemory.get(p.id);
      if(count>1&&saved?.key===groupId&&saved.slot<limit&&!occupied.has(saved.slot)){
        assigned.set(p.id,saved.slot);occupied.add(saved.slot);
      }
    }
    for(const p of visible){
      if(!assigned.has(p.id)){
        let slot=0;
        while(occupied.has(slot)&&slot<limit)slot++;
        assigned.set(p.id,slot);occupied.add(slot);
      }
    }
    const scale=count===1||zoom<1.5?1:
      count<=2?.55:count<=5?.37:.28;
    const shownIds=visible.map(p=>p.id);
    for(const p of members){
      const presentation=pose?.get(p.id)||p;
      const shownHere=shown.has(p.id);
      const slot=shownHere?(assigned.get(p.id)??0):null;
      if(shownHere&&count>1)slotMemory.set(p.id,{key:groupId,slot});
      const offset=count>1&&zoom>=1.5&&shownHere?CROWD_SLOTS[slot]||[0,0]:[0,0];
      const x=count>1&&zoom>=1.5?
        group.tileX+.5+offset[0]+(presentation.x-p.x):presentation.x;
      const y=count>1&&zoom>=1.5?
        group.tileY+.5+offset[1]+(presentation.y-p.y):presentation.y;
      sprites.set(p.id,{id:p.id,key:groupId,x,y,scale,visible:shownHere,
        size:count,moving:!!presentation.moving,slot,
        realX:p.x,realY:p.y});
    }
    if(count>1)groups.push({key:groupId,count,ids:members.map(p=>p.id),
      visibleIds:shownIds,hidden:count-shown.size,
      x:group.tileX+.5,y:group.tileY+.5});
  }
  return {sprites,groups};
}
function crowdBadge(camera,group,w,h){
  const p=toScreen(camera,group.x,group.y,w,h);
  const tile=Math.min(w/camera.width,h/camera.height)*camera.zoom;
  return {x:p.x+Math.max(9,Math.min(26,tile*.43)),
    y:p.y-Math.max(10,Math.min(30,tile*.58)),
    radius:group.count>=100?15:12};
}
function hitCrowd(groups,camera,px,py,w,h){
  let closest=null,dist=Infinity;
  for(const g of groups||[]){
    const marker=crowdBadge(camera,g,w,h),d=distance({x:px,y:py},marker);
    if(d<=marker.radius+3&&d<dist){closest=g;dist=d;}
  }
  return closest;
}
function hitCharacter(sprites,camera,px,py,w,h){
  const tile=Math.min(w/camera.width,h/camera.height)*camera.zoom;
  let closest=null,dist=Infinity;
  for(const item of sprites?.values()||[]){
    if(!item.visible)continue;
    const screen=toScreen(camera,item.x+.5,item.y+.5,w,h);
    const d=distance(screen,{x:px,y:py});
    // The hit disk matches the displayed scaled head. Never use real position.
    const radius=Math.max(6,Math.min(24,tile*item.scale*.49));
    if(d<=radius&&d<dist){closest=item;dist=d;}
  }
  return closest;
}

const API={createCamera,transform,toWorld,toScreen,focus,setZoom,pan,bounds,
  snapshot,transitions,position,drawActing,
  arrangeCrowds,crowdBadge,hitCrowd,hitCharacter};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_LIVING_WORLD=API;
})(typeof window!=='undefined'?window:null);
