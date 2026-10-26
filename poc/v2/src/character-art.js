/* Character Readability / Empathy v0
   Reusable 3/4-view sprite-like Canvas characters, not simulated emotions.
   Identity palette is a pure hash of real person ID; no world RNG or mutation.
   This module is deliberately swappable for an image sprite sheet later. */
(function(root){
'use strict';
const SKINS=['#f0c9a2','#d8aa85','#a87658','#efcfb0','#b98d72','#d8bc8d'];
const HAIRS=['#382b32','#79503c','#b38551','#5a4332','#d1a76b','#242f37'];
const FABRICS=['#7896a3','#a48c74','#7b9e83','#b68a75','#8f83ab','#9c9a6b'];
const DEEP='#25343a',SHADOW='#182c31';
function hashId(id){
  let v=2166136261;
  for(const c of String(id||'unknown')){
    v^=c.codePointAt(0);v=Math.imul(v,16777619);
  }
  return v>>>0;
}
function identity(person){
  const h=hashId(person?.id);
  return {id:String(person?.id||''),skin:SKINS[h%SKINS.length],
    hair:HAIRS[(h>>>5)%HAIRS.length],fabric:FABRICS[(h>>>11)%FABRICS.length],
    hairStyle:(h>>>16)%4,clothing:(h>>>18)%3,
    accentStyle:(h>>>21)%3,hash:h};
}
function archetype(p,opts={}){
  if(p.stage==='child')return 'child';
  if(opts.soldier)return 'soldier';
  if(opts.priest)return 'priest';
  if(p.stage==='elder'||Number(p.age)>=65)return 'elder';
  return identity(p).clothing===0?'adult-a':'adult-b';
}
function appearance(person,opts={}){
  const style=identity(person),type=archetype(person,opts);
  const fatigued=(Number(person.hunger)||0)>.75;
  const health=Number.isFinite(person.health)?person.health:100;
  const wounded=health<75||
    !!(person.campInjury&&!person.campInjury.recoveredAtHour&&person.health<95);
  const healed=!!opts.healed&&!wounded;
  const act=person.activity||'rest';
  const walking=!!opts.moving||['travel','march','retreat','transport'].includes(act);
  const praying=['pray','preach','worship'].includes(act);
  const working=['farm','forage','stone','wood','fiber','build','build_granary','build_ritual','visit','quarry_guard'].includes(act);
  const resting=['rest','care','family'].includes(act);
  return {...style,type,act,wounded,healed,fatigued,walking,praying,working,resting,
    isSaint:!!opts.saint,leader:!!opts.leader,soldier:!!opts.soldier,priest:!!opts.priest,
    faithColor:opts.faithColor||'#d2c4a0'};
}
function rect(c,x,y,w,h,color){
  c.fillStyle=color;c.fillRect(x,y,w,h);
}
function poly(c,points,fill,stroke=DEEP,width=.7){
  c.beginPath();
  c.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
  c.closePath();c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function ellipse(c,x,y,rx,ry,fill,stroke=null,width=.7){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function pathLine(c,pts,color,width){
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function outfit(c,s){
  const child=s.type==='child',old=s.type==='elder',robe=['priest','elder'].includes(s.type);
  const armor=s.type==='soldier';
  const light=robe?'#e3d5ad':armor?'#647d87':s.fabric;
  const dark=robe?'#806b65':armor?'#3e5259':'#56605c';
  const hem=child?12:17,top=child?0:-1;
  // Distinct silhouettes: adult A belt tunic, adult B long apron,
  // child short romper, elder stooped robe, priest hooded stole, militia armor.
  if(robe){
    poly(c,[[-5,top],[5,top],[8,hem],[0,hem+2],[-9,hem]],light);
    poly(c,[[-1,0],[2,0],[2,hem+1],[-1,hem+1]],dark,null);
  }else if(armor){
    poly(c,[[-6,top],[6,top],[6,13],[2,16],[-6,13]],'#647e87');
    rect(c,-5,1,10,3,'#9cabb2');
    rect(c,-2,5,4,8,'#576974');
    rect(c,-6,11,12,2,'#314851');
  }else if(s.clothing===1&&s.type!=='child'){
    poly(c,[[-5,top],[5,top],[8,hem],[0,hem+2],[-8,hem]],light);
    poly(c,[[-3,2],[4,2],[6,16],[-5,16]],'#e1c69e');
    rect(c,-3,6,6,2,s.faithColor);
  }else{
    poly(c,[[-5,top],[5,top],[6,12],[4,15],[-5,15],[-6,12]],light);
    rect(c,-6,11,12,2,dark);
    if(!child)rect(c,-1,11,2,2,'#d7c6a4');
    if(s.clothing===2)poly(c,[[-5,0],[0,1],[1,11],[-5,10]],'#cfb68d',null);
  }
  // Faith has a small persistent affiliation cue without recoloring every face.
  rect(c,-5,2,2,5,s.faithColor);
  if(old){poly(c,[[-5,1],[-1,0],[0,3],[-4,7]],'#988479',null);}
}
function hairstyle(c,s){
  if(s.type==='soldier'){
    poly(c,[[-8,-12],[-7,-20],[-3,-23],[5,-23],[9,-18],[8,-11]],'#6c7880');
    rect(c,-8,-15,16,3,'#d4b983');
    rect(c,-4,-21,7,2,'#a6b5b6');return;
  }
  if(s.type==='priest'){
    poly(c,[[-9,-12],[-9,-20],[-4,-26],[4,-26],[10,-20],[9,-11]],
      '#e1d5bc');
    rect(c,-9,-15,18,4,'#b3a48f');
    rect(c,-5,-23,10,2,s.faithColor);return;
  }
  const color=s.type==='elder'?'#ded9c3':s.hair;
  if(s.hairStyle===0){
    poly(c,[[-8,-17],[-6,-23],[2,-24],[8,-20],[8,-16],[2,-18],[-4,-18]],color);
  }else if(s.hairStyle===1){
    poly(c,[[-8,-12],[-9,-21],[-5,-24],[6,-23],[9,-18],[8,-11],[6,-7],
      [4,-16],[-5,-16],[-5,-9]],color);
  }else if(s.hairStyle===2){
    poly(c,[[-9,-17],[-6,-23],[0,-25],[6,-24],[9,-19],[8,-15],
      [5,-17],[2,-19],[0,-16],[-6,-17]],color);
    for(const x of [-6,-2,3,7])rect(c,x,-22,2,3,color);
  }else{
    poly(c,[[-8,-16],[-8,-22],[-4,-24],[6,-24],[8,-21],
      [8,-16],[5,-15],[3,-18],[-7,-17]],color);
    rect(c,6,-14,3,7,color);
  }
  if(s.type==='child'){rect(c,7,-14,3,5,color);}
}
function face(c,s,time){
  const x=s.type==='elder'?1:0;
  const headY=s.type==='child'?-13.5:-14.5;
  const rx=s.type==='child'?9:8;
  const ry=s.type==='child'?9:8.2;
  ellipse(c,x,headY,rx+1,ry+1,SHADOW);
  ellipse(c,x,headY,rx,ry,s.skin);
  ellipse(c,x-2,headY+3,5,2.6,'#f5d4b3');
  if(s.type==='elder'){
    pathLine(c,[[-6,-18],[-3,-19]],'#796e65',.7);
    pathLine(c,[[3,-19],[6,-18]],'#796e65',.7);
  }
  // Eyes and expressive brows face slightly toward the camera.
  const lid=(s.fatigued||s.wounded)?-1.1:0;
  ellipse(c,x-3,headY-.8,1,1.4+lid*.2,'#24323c');
  ellipse(c,x+3.2,headY-.8,1,1.4+lid*.2,'#24323c');
  rect(c,x-3.4,headY-1.1,.7,.5,'#f4ebda');
  rect(c,x+2.9,headY-1.1,.7,.5,'#f4ebda');
  pathLine(c,[[x-.2,headY+.3],[x+.65,headY+1.5]],'#946c61',.7);
  if(s.wounded||s.fatigued){
    pathLine(c,[[x-3,headY-3],[x-1,headY-3.8]],'#674b4a',.8);
    pathLine(c,[[x+2,headY-3.8],[x+4,headY-3]],'#674b4a',.8);
    pathLine(c,[[x-2,headY+4.6],[x,headY+3.8],[x+2.2,headY+4.5]],
      '#8a5452',.8);
  }else if(s.healed){
    pathLine(c,[[x-2.2,headY+3.6],[x,headY+5.4],[x+2.2,headY+3.6]],
      '#965f56',1.2);
  }else{
    pathLine(c,[[x-2,headY+4],[x+.5,headY+4.5],[x+2.2,headY+3.8]],
      '#985c54',.8);
  }
  if(s.type==='elder'){
    for(const offset of [-5,5]){
      pathLine(c,[[x+offset-1,headY+2],[x+offset+1,headY+2.5]],
        '#aa8c77',.5);
    }
  }
  hairstyle(c,s);
}
function legs(c,s,beat){
  const move=s.walking?2.3*beat:s.working?beat*.65:0;
  const legY=s.type==='child'?11:14;
  const crouch=s.resting?3:0;
  for(const side of [-1,1]){
    const x=side*3.2;
    poly(c,[[x-2,legY-crouch],[x+2,legY-crouch],
      [x+2+move*side,18-crouch],[x-2+move*side,18-crouch]],
      s.type==='priest'?'#765c50':'#36484a');
    poly(c,[[x-3+move*side,17-crouch],[x+3+move*side,17-crouch],
      [x+4+move*side,20-crouch],[x-3+move*side,20-crouch]],
      s.type==='child'?'#765f47':'#29343a');
  }
}
function arms(c,s,beat){
  const swing=s.walking?2*beat:s.working?3*beat:0;
  const praying=s.praying;
  const skin=s.skin;
  const originY=s.type==='child'?2:1;
  if(praying){
    poly(c,[[-7,originY],[-4,originY],[0,7],[-2,9],[-7,5]],s.fabric);
    poly(c,[[7,originY],[4,originY],[0,7],[2,9],[7,5]],s.fabric);
    ellipse(c,-1,8,2,2,skin);ellipse(c,1.5,8,2,2,skin);
    return;
  }
  const left=[[ -6,originY],[-4,originY],[-7-swing*.35,10],[-9-swing*.35,9]];
  const right=[[ 6,originY],[4,originY],[7+swing*.35,10],[9+swing*.35,9]];
  poly(c,left,s.type==='soldier'?'#6d8b91':s.fabric);
  poly(c,right,s.type==='soldier'?'#6d8b91':s.fabric);
  ellipse(c,-8-swing*.35,10,1.9,2.4,skin);
  ellipse(c,8+swing*.35,10,1.9,2.4,skin);
}
function accessory(c,s,beat){
  const type=s.type;
  if(type==='soldier'){
    // Short shield and strapped helmet, readable without reading the Inspector.
    poly(c,[[7,0],[13,1],[12,13],[8,16],[5,12],[5,3]],'#9b694b');
    poly(c,[[7,2],[11,3],[10,12],[8,14],[7,11]],s.faithColor,null);
    pathLine(c,[[9,-20],[11,-24]],'#ebbe72',1.7);
  }else if(type==='priest'){
    // Priest staff, two-tone long stole.
    pathLine(c,[[11,-11],[12,19]],'#927149',1.6);
    ellipse(c,11,-12,3.3,3.3,'#e8cf83',DEEP,.7);
    rect(c,0,3,3,12,s.faithColor);
    poly(c,[[-3,5],[-1,2],[1,5],[-1,8]],'#e2c47a',null);
  }else if(type==='elder'){
    pathLine(c,[[10,1],[12,19],[10,20]],'#92714a',1.5);
    ellipse(c,10,1,1.5,1.5,'#bc9771');
  }else if(type==='child'){
    // Light satchel creates a recognizably smaller, different profile.
    poly(c,[[4,4],[10,5],[9,12],[5,11]],'#b48b5f');
    pathLine(c,[[1,0],[7,8]],'#eee0b5',.75);
  }
  if(s.working&&!['priest','soldier'].includes(type)){
    const angle=beat*.8;
    pathLine(c,[[8,7],[14+angle,-4]],'#876742',1.7);
    if(['farm','forage','wood','stone'].includes(s.act)){
      pathLine(c,[[12+angle,-5],[18+angle,-3]],'#b8c4b7',2.2);
    }else{
      rect(c,13+angle,-6,5,3,'#a5afab');
    }
  }
  if(s.praying&&!s.priest){
    pathLine(c,[[1,10],[1,14]],s.faithColor,2);
  }
  if(s.isSaint){
    poly(c,[[0,-27],[2,-23],[6,-23],[3,-20],[4,-16],[0,-18],
      [-4,-16],[-3,-20],[-6,-23],[-2,-23]],'#f8d47b',DEEP,.6);
  }else if(s.leader){
    poly(c,[[-7,-22],[-5,-28],[-1,-24],[2,-29],[5,-24],[8,-28],[7,-21]],
      '#e4bd75',DEEP,.6);
  }
  if(s.wounded){
    // Bandage on the upper arm, paired with lowered posture and pain mouth.
    rect(c,-8,3,4,2,'#f2e2c9');
    rect(c,-9,5,4,2,'#f2e2c9');
  }
  if(s.healed){
    rect(c,13,-14,1.6,9,'#b2f6db');
    rect(c,9.5,-10.5,9,1.6,'#b2f6db');
    ellipse(c,15,-4,1.5,1.5,'#f4e5a8');
  }
}
function draw(c,person,x,y,cell,time=0,options={}){
  const s=appearance(person,options);
  const beat=Math.sin(time*(s.walking?10:s.working?5:2.5)+s.hash%17);
  // Sprite coordinates -16…+18 × -28…+21. World stage/y anchor remains
  // exactly the same as earlier icons, so selection and heal stay authoritative.
  const u=cell/38;
  if(!(u>0))return s;
  c.save();
  c.translate(x,y);
  c.scale(u,u);
  if(s.wounded){c.translate(1.3,1.5);c.rotate(-.055);}
  else if(s.walking)c.translate(0,Math.abs(beat)*.6);
  ellipse(c,0,19,12,3.2,'#0c262b65');
  legs(c,s,beat);
  outfit(c,s);
  arms(c,s,beat);
  face(c,s,time);
  accessory(c,s,beat);
  c.restore();
  return s;
}
const API={hashId,identity,archetype,appearance,draw};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_CHARACTER_ART=API;
})(typeof window!=='undefined'?window:null);
