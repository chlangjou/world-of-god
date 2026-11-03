/* Issue #15 — chosen B style: small, real vector sprite renderer.
 * Decorative only: consumes existing world tiles, households, real resident
 * identities and activity. Does NOT advance or mutate the simulation/RNG. */
(function(root){
'use strict';
const TILE=64,OBJECT=128,CHAR_W=64,CHAR_H=96;
const ROLE_ROW=Object.freeze({'adult-a':0,'adult-b':1,child:2});
const TYPES=Object.freeze({meadow:0,dry:1,forest:2,river:3,rock:4,field:5});
function imageReady(img,w,h){return !!img&&img.complete===true&&img.naturalWidth===w&&img.naturalHeight===h;}
function hash(str){
  let n=2166136261;
  for(const c of String(str)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
  return n>>>0;
}
function terrainRow(t){
  if(t.terrain==='river')return TYPES.river;
  if(t.terrain==='field')return TYPES.field;
  if(t.terrain==='forest')return TYPES.forest;
  if(t.terrain==='rock')return TYPES.rock;
  return (t.moisture||0)<.3?TYPES.dry:TYPES.meadow;
}
function tileAt(world,x,y){
  if(x<0||y<0||x>=world.width||y>=world.height)return null;
  return world.tiles[y*world.width+x]||null;
}
function drawTile(c,img,t,world,cell){
  if(!imageReady(img,128,384))return false;
  const type=terrainRow(t),variation=hash(world.seed+'|'+t.x+'|'+t.y+'|cartoon-ground')&1;
  const x=t.x*cell,y=t.y*cell;
  c.save();c.imageSmoothingEnabled=true;
  // All pixels originate in an independently editable vector atlas, not
  // arbitrary procedural ground icons. No change to walkability or minerals.
  c.drawImage(img,variation*TILE,type*TILE,TILE,TILE,x,y,cell+.045,cell+.045);
  const water=t.terrain==='river';
  const neighbors=[
    [tileAt(world,t.x,t.y-1),'top'],[tileAt(world,t.x,t.y+1),'bottom'],
    [tileAt(world,t.x-1,t.y),'left'],[tileAt(world,t.x+1,t.y),'right']
  ];
  for(const [other,edge] of neighbors){
    if(!other||(other.terrain==='river')===water)continue;
    // Soft banks only where genuine water touches genuine land.
    c.fillStyle=water?'#e7d6a7':'#e0d1a9';
    const d=cell*.10;
    c.beginPath();
    if(edge==='top'){c.moveTo(x,y);c.lineTo(x+cell,y);c.quadraticCurveTo(x+cell*.53,y+d*.4,x,y+d);}
    if(edge==='bottom'){c.moveTo(x,y+cell);c.lineTo(x+cell,y+cell);c.quadraticCurveTo(x+cell*.48,y+cell-d*.5,x,y+cell-d);}
    if(edge==='left'){c.moveTo(x,y);c.lineTo(x,y+cell);c.quadraticCurveTo(x+d*.5,y+cell*.53,x+d,y);}
    if(edge==='right'){c.moveTo(x+cell,y);c.lineTo(x+cell,y+cell);c.quadraticCurveTo(x+cell-d*.5,y+cell*.4,x+cell-d,y);}
    c.closePath();c.fill();
  }
  // Crop is not painted unless the existing world actually has a crop.
  if(t.terrain==='field'&&(t.crop||0)>.16){
    const maturity=Math.max(0,Math.min(1,t.crop));
    const jitter=(hash(world.seed+'|'+t.x+'|'+t.y+'|cartoon-plants')%9-4)*.009;
    for(let col=0;col<2;col++)for(let row=0;row<2;row++){
      const cx=x+cell*(.26+col*.47+jitter),cy=y+cell*(.27+row*.45);
      const h=cell*(.07+.10*maturity),w=cell*(.055+.024*maturity);
      c.strokeStyle='#4a8d65';c.lineWidth=cell*.023;c.lineCap='round';
      c.beginPath();c.moveTo(cx,cy);c.lineTo(cx,cy-h);c.stroke();
      c.fillStyle=maturity>.55?'#b4ce82':'#83b781';
      c.beginPath();c.ellipse(cx-w*.5,cy-h*.52,w,h*.33,-.45,0,Math.PI*2);c.fill();
      c.beginPath();c.ellipse(cx+w*.5,cy-h*.7,w,h*.33,.45,0,Math.PI*2);c.fill();
      if(maturity>.7){c.fillStyle='#e6cd78';c.beginPath();c.ellipse(cx,cy-h,w*.32,h*.35,0,0,Math.PI*2);c.fill();}
    }
  }
  c.restore();return true;
}
function drawObject(c,img,row,x,y,cell){
  if(!imageReady(img,128,384))return false;
  const w=cell*2.35,h=cell*2.35;
  c.save();c.imageSmoothingEnabled=true;
  c.drawImage(img,0,row*OBJECT,OBJECT,OBJECT,x-w/2,y+cell*.55-h,w,h);
  c.restore();return true;
}
function drawHouse(c,img,house,cell){
  return !!(house.home&&drawObject(c,img,0,(house.x+.5)*cell,(house.y+.5)*cell,cell));
}
function drawTerrainObject(c,img,t,cell,seed){
  const h=hash(seed+'|'+t.x+'|'+t.y+'|cartoon-dressing');
  if(t.terrain==='forest'&&h%4===0)
    return drawObject(c,img,1,(t.x+.5)*cell,(t.y+.5)*cell,cell);
  if(t.terrain==='rock'&&h%5===0)
    return drawObject(c,img,2,(t.x+.5)*cell,(t.y+.5)*cell,cell*.67);
  return false;
}
function roleFor(p,roles,Art){
  const role=Art.archetype(p,roles||{});
  return Object.hasOwn(ROLE_ROW,role)?role:null;
}
function frameFor(p,roles,time,Art){
  const a=Art.appearance(p,roles||{});
  if(a.wounded)return 7;
  if(a.walking)return 1+(Math.floor(time*6+a.hash%4)%4);
  if(a.praying)return 6;
  if(a.working)return 5;
  return 0;
}
function drawPerson(c,img,p,x,y,cell,time,roles,Art){
  const role=roleFor(p,roles,Art);
  if(!role||!imageReady(img,CHAR_W*8,CHAR_H*3))return false;
  const index=frameFor(p,roles,time,Art),row=ROLE_ROW[role];
  const w=cell*1.22,h=cell*1.83;
  c.save();c.imageSmoothingEnabled=true;
  c.drawImage(img,index*CHAR_W,row*CHAR_H,CHAR_W,CHAR_H,
    x-w*.5,y+cell*.56-h,w,h);
  // One stable personal fabric mark: identity-based, not affected by nearby
  // crowd size or simulation RNG. Keep the pictorial silhouettes distinct.
  const id=Art.identity(p);
  c.fillStyle=id.fabric;
  c.beginPath();
  c.roundRect(x-cell*.080,y+cell*.032,cell*.16,cell*.048,cell*.02);
  c.fill();c.restore();return true;
}
const API={TYPES,ROLE_ROW,imageReady,hash,terrainRow,tileAt,
 drawTile,drawHouse,drawTerrainObject,roleFor,frameFor,drawPerson};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_CARTOON_ART=API;
})(typeof window!=='undefined'?window:null);
