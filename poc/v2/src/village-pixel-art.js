/* P1a+P2a: A single coherent close-up village painting layer.
   Assets are hand-authored original PNG pixel atlases, not resized icons.
   No simulation state or RNG calls; all locations come from world data. */
(function(root){
'use strict';
const TILE=16,OBJECT=64,CHAR_W=32,CHAR_H=48;
const TYPES=Object.freeze({meadow:0,dry:1,forest:2,river:3,rock:4,field:5});
const ROLE_ROW=Object.freeze({'adult-a':0,'adult-b':1,child:2});
function imageReady(img,w,h){
  return !!img&&img.complete===true&&img.naturalWidth===w&&img.naturalHeight===h;
}
function hash(text){
  let v=2166136261;
  for(const c of String(text)){v^=c.charCodeAt(0);v=Math.imul(v,16777619);}
  return v>>>0;
}
function terrainRow(t){
  if(t.terrain==='river')return TYPES.river;
  if(t.terrain==='field')return TYPES.field;
  if(t.terrain==='forest')return TYPES.forest;
  if(t.terrain==='rock')return TYPES.rock;
  return (t.moisture||0)<.3?TYPES.dry:TYPES.meadow;
}
function getTile(world,x,y){
  if(x<0||y<0||x>=world.width||y>=world.height)return null;
  return world.tiles[y*world.width+x]||null;
}
function neighbors(world,tile){
  return {
    top:getTile(world,tile.x,tile.y-1),
    right:getTile(world,tile.x+1,tile.y),
    bottom:getTile(world,tile.x,tile.y+1),
    left:getTile(world,tile.x-1,tile.y)
  };
}
function drawTile(c,image,t,world,cell){
  if(!imageReady(image,TILE*2,TILE*6))return false;
  const row=terrainRow(t),variant=hash(String(world.seed)+'|'+t.x+'|'+t.y+'|terrain')&1;
  const x=t.x*cell,y=t.y*cell;
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(image,variant*TILE,row*TILE,TILE,TILE,x,y,cell+.06,cell+.06);
  // Riverbanks are only shown when actual adjacent tiles are a river.
  // They do not imply a walkable ford, bridge or improved access.
  const around=neighbors(world,t);
  const water=t.terrain==='river';
  for(const [side,n] of Object.entries(around)){
    if(!n||((n.terrain==='river')===water))continue;
    c.fillStyle=water?'#bdd7bd':'#bdac7c';
    const depth=cell*.09;
    if(side==='top')c.fillRect(x,y,cell,depth);
    if(side==='bottom')c.fillRect(x,y+cell-depth,cell,depth);
    if(side==='left')c.fillRect(x,y,depth,cell);
    if(side==='right')c.fillRect(x+cell-depth,y,depth,cell);
  }
  // Real field crop only: no leaves before crop actually exists.
  if(t.terrain==='field'&&t.crop>.16){
    const mature=Math.max(0,Math.min(1,t.crop||0));
    c.strokeStyle=mature>.52?'#e0c46f':'#91ab6f';
    c.lineWidth=Math.max(.32,cell*.07);
    for(let col=0;col<3;col++)for(let row=0;row<3;row++){
      const cx=x+cell*(.17+col*.33),cy=y+cell*(.28+row*.26);
      const tall=cell*(.06+mature*.12);
      c.beginPath();c.moveTo(cx,cy);c.lineTo(cx-cell*.04,cy-tall);
      c.moveTo(cx,cy);c.lineTo(cx+cell*.07,cy-tall*.8);c.stroke();
    }
  }
  c.restore();return true;
}
function drawObject(c,img,index,x,y,cell){
  if(!imageReady(img,64,192))return false;
  c.save();c.imageSmoothingEnabled=false;
  const dx=x-cell*.93,dy=y-cell*1.34;
  c.drawImage(img,0,index*OBJECT,OBJECT,OBJECT,dx,dy,cell*1.86,cell*1.86);
  c.restore();return true;
}
function drawHouse(c,img,house,cell){
  if(!house.home)return false;
  return drawObject(c,img,0,(house.x+.5)*cell,(house.y+.5)*cell,cell);
}
function drawTerrainObject(c,img,t,cell,seed){
  const key=hash(String(seed)+'|'+t.x+'|'+t.y+'|dressing');
  if(t.terrain==='forest'&&key%4===0)
    return drawObject(c,img,1,(t.x+.5)*cell,(t.y+.5)*cell,cell);
  if(t.terrain==='rock'&&key%5===0)
    return drawObject(c,img,2,(t.x+.5)*cell,(t.y+.5)*cell,cell*.72);
  return false;
}
function roleFor(p,roles,Art){
  const role=Art.archetype(p,roles||{});
  return Object.hasOwn(ROLE_ROW,role)?role:null;
}
function frameFor(p,roles,time,Art){
  const s=Art.appearance(p,roles||{});
  if(s.wounded)return 7;
  if(s.walking)return 1+Math.floor(time*6+s.hash%4)%4;
  if(s.praying)return 6;
  if(s.working)return 5;
  return 0;
}
function drawPerson(c,img,p,x,y,cell,time,roles,Art){
  const role=roleFor(p,roles,Art);
  if(!role||!imageReady(img,CHAR_W*8,CHAR_H*3))return false;
  const frame=frameFor(p,roles,time,Art),row=ROLE_ROW[role];
  // Foot anchoring is shared by all 8 frames so steps don't resize or jump.
  // The outer app's existing characterScale controls child height and crowd UI.
  const w=cell*1.06,h=cell*1.59;
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(img,frame*CHAR_W,row*CHAR_H,CHAR_W,CHAR_H,
    x-w/2,y+cell*.56-h,w,h);
  // Small identity accent is stable for a real person, never crowd dependent.
  const identity=Art.identity(p),scarf=identity.fabric;
  c.fillStyle=scarf;
  c.fillRect(x-cell*.13,y-cell*.15,cell*.19,Math.max(.45,cell*.08));
  c.restore();return true;
}
const API={TYPES,ROLE_ROW,imageReady,terrainRow,getTile,neighbors,hash,
  drawTile,drawHouse,drawTerrainObject,roleFor,frameFor,drawPerson};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_VILLAGE_ART=API;
})(typeof window!=='undefined'?window:null);
