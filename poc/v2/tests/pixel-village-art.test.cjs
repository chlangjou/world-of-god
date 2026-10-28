'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const Village=require('../src/village-pixel-art.js');
const Art=require('../src/character-art.js');
const {boot}=require('./browser-harness.cjs');
const root=path.resolve(__dirname,'..');

// Byte-level validation, not a mock that merely counts draw calls. Decode the
// actual committed PNG bytes and verify frame dimensions and distinct pixels.
function decodePNG(pathname){
  const data=fs.readFileSync(path.join(root,pathname));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let offset=8,w=0,h=0,bitDepth=0,colorType=0,transparency=null;
  const idat=[],plte=[];
  const table=new Uint32Array(256);
  for(let k=0;k<256;k++){let crc=k;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;table[k]=crc>>>0;}
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  while(offset<data.length){
    const len=data.readUInt32BE(offset),type=data.toString('ascii',offset+4,offset+8);
    const bytes=data.subarray(offset+8,offset+8+len);
    const actual=data.readUInt32BE(offset+8+len);
    assert.equal(crc32(data.subarray(offset+4,offset+8+len)),actual,'bad PNG CRC in '+type);
    if(type==='IHDR'){w=bytes.readUInt32BE(0);h=bytes.readUInt32BE(4);bitDepth=bytes[8];colorType=bytes[9];}
    if(type==='IDAT')idat.push(bytes);
    if(type==='PLTE')plte.push(bytes);
    if(type==='tRNS')transparency=bytes;
    offset+=len+12;
    if(type==='IEND')break;
  }
  assert.equal(offset,data.length,'missing or trailing PNG bytes');
  assert.equal(bitDepth,8);assert.equal(colorType,3,'this hand-authored atlas must use indexed pixels');
  const stream=zlib.inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(w*h);
  assert.equal(stream.length,(w+1)*h);
  for(let y=0;y<h;y++){
    const filter=stream[y*(w+1)],at=y*(w+1)+1;
    for(let x=0;x<w;x++){
      const left=x>0?pixels[y*w+x-1]:0;
      const up=y>0?pixels[(y-1)*w+x]:0;
      const upperLeft=x>0&&y>0?pixels[(y-1)*w+x-1]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      if(filter===2)predictor=up;
      if(filter===3)predictor=Math.floor((left+up)/2);
      if(filter===4){
        const p=left+up-upperLeft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft);
        predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;
      }
      assert.ok(filter>=0&&filter<=4,'unsupported PNG filter');
      pixels[y*w+x]=(stream[at+x]+predictor)&255;
    }
  }
  const palettes=plte.flatMap(b=>Array.from({length:b.length/3},(_,i)=>[b[i*3],b[i*3+1],b[i*3+2]]));
  const opaque=pixels.reduce((n,p)=>n+((transparency&&p<transparency.length?transparency[p]:255)>0?1:0),0);
  return {w,h,pixels,opaque,palette:palettes,bytes:data};
}
function frameBytes(sheet,x,y,w,h){
  const out=[];for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)out.push(sheet.pixels[j*sheet.w+i]);
  return out;
}
test('three real binary PNG atlases have valid CRC, dimensions and meaningful nontransparent artwork',()=>{
  const people=decodePNG('assets/pixel-villagers-v0.png');
  const land=decodePNG('assets/pixel-ground-v0.png');
  const obj=decodePNG('assets/pixel-village-objects-v0.png');
  assert.deepEqual([people.w,people.h],[256,144]);
  assert.deepEqual([land.w,land.h],[32,96]);
  assert.deepEqual([obj.w,obj.h],[64,192]);
  assert.ok(people.opaque>3000&&people.opaque<people.w*people.h*.7);
  assert.ok(obj.opaque>1500&&obj.opaque<obj.w*obj.h*.7);
  assert.ok(land.opaque>3000);
  const idle=frameBytes(people,0,0,32,48).join(',');
  for(const frame of [1,2,3,4,5,6,7])
    assert.notEqual(frameBytes(people,frame*32,0,32,48).join(','),idle,
      'PNG animation frame '+frame+' must contain different pixels');
  assert.notDeepEqual(frameBytes(people,0,0,32,48),frameBytes(people,0,96,32,48),
    'a child frame is not just a scaled adult geometry export');
  assert.ok(obj.palette.length>=8&&people.palette.length>=12);
});
function canvas(){
  const calls=[];
  const ctx=new Proxy({},{
    get(target,key){if(key==='drawImage')return (...args)=>calls.push({type:'image',args});
      if(key==='fillRect')return (...args)=>calls.push({type:'rect',args});
      if(key==='stroke')return ()=>calls.push({type:'stroke'});
      return key in target?target[key]:()=>{};
    },
    set(target,key,value){target[key]=value;return true;}
  });
  return {ctx,calls};
}
function loaded(w,h){return {complete:true,naturalWidth:w,naturalHeight:h};}
function natural(){
  const types=['meadow','river','forest','rock','field','meadow'];
  return {width:3,height:2,seed:'native-river-test',
    tiles:types.map((terrain,i)=>({x:i%3,y:Math.floor(i/3),terrain,
      moisture:terrain==='meadow'?.8:.5,crop:terrain==='field'?.75:0}))};
}
test('terrain atlas maps only actual tiles, uses stable seed/coordinate variation and truthful crop/riverbank',()=>{
  const s=natural(),before=JSON.stringify(s),{ctx,calls}=canvas(),png=loaded(32,96);
  for(const t of s.tiles)assert.equal(Village.drawTile(ctx,png,t,s,24),true);
  assert.equal(calls.filter(c=>c.type==='image').length,s.tiles.length);
  assert.ok(calls.some(c=>c.type==='stroke'),'actual mature field has crop drawing');
  assert.ok(calls.some(c=>c.type==='rect'),'only actual water neighbors generate bank edge');
  const src=calls.filter(c=>c.type==='image').map(c=>c.args.slice(1,5));
  assert.equal(src[1][1],3*16,'real river must select river atlas row');
  assert.equal(src[2][1],2*16,'real forest must select forest atlas row');
  assert.equal(src[3][1],4*16,'real stone terrain must select rock atlas row');
  assert.equal(src[4][1],5*16,'real farm must select farm atlas row');
  const again=canvas();for(const t of s.tiles)Village.drawTile(again.ctx,png,t,s,24);
  assert.deepEqual(again.calls.filter(c=>c.type==='image').map(c=>c.args.slice(1,5)),src,
    'same seed and locations never reshuffle tile art');
  assert.equal(JSON.stringify(s),before);
  assert.equal(Village.drawTile(ctx,{complete:false,naturalWidth:32,naturalHeight:96},s.tiles[0],s,24),false);
});
test('built houses and real forest/rock terrain are the only materialized village objects',()=>{
  const {ctx,calls}=canvas(),png=loaded(64,192),home={x:7,y:9,home:true};
  const empty={x:7,y:9,home:false};
  assert.equal(Village.drawHouse(ctx,png,home,24),true);
  assert.equal(Village.drawHouse(ctx,png,empty,24),false);
  assert.equal(calls.filter(c=>c.type==='image').length,1);
  assert.equal(calls[0].args[2],0,'house image comes from row 0');
  assert.equal(Village.drawTerrainObject(ctx,png,{x:2,y:2,terrain:'meadow'},24,'seed'),false);
  // Forest / rock can deterministically omit a purely decorative tree or stone,
  // but they can never be painted on other physical terrain types.
  for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    Village.drawTerrainObject(ctx,png,{x,y,terrain:'forest'},24,'seed');
    Village.drawTerrainObject(ctx,png,{x,y,terrain:'rock'},24,'seed');
  }
  assert.ok(calls.filter(c=>c.type==='image'&&c.args[2]===64).length>5);
  assert.ok(calls.filter(c=>c.type==='image'&&c.args[2]===128).length>5);
});
test('adult A/B and children animate through real PNG frames; Priest and soldier use existing compatible fallback',()=>{
  const {ctx,calls}=canvas(),png=loaded(256,144);
  const p={id:'p18',stage:'adult',age:30,health:100,hunger:0,activity:'rest',alive:true};
  const child={...p,id:'pchild',stage:'child',age:9},before=JSON.stringify({p,child});
  const role=Village.roleFor(p,{},Art);
  assert.ok(['adult-a','adult-b'].includes(role));
  assert.equal(Village.roleFor(child,{},Art),'child');
  assert.equal(Village.drawPerson(ctx,png,p,100,100,12,1.25,{faithColor:'#aacc99'},Art),true);
  const a=calls.find(c=>c.type==='image').args;
  assert.equal(a[2],(Village.ROLE_ROW[role])*48);
  assert.equal(Village.drawPerson(ctx,png,child,120,95,12,1.25,{},Art),true);
  const childDraw=calls.filter(c=>c.type==='image').at(-1).args;
  assert.equal(childDraw[2],96);
  for(const activity of ['travel','farm','pray']){
    p.activity=activity;
    const f=Village.frameFor(p,{moving:activity==='travel'},1.1,Art);
    assert.ok(f>=1&&f<=6);
  }
  p.activity='rest';p.health=45;
  assert.equal(Village.frameFor(p,{healed:true},1.1,Art),7,
    'health 45 cannot play a falsely recovered state');
  p.health=100;
  assert.equal(Village.drawPerson(ctx,png,p,100,100,12,1,{priest:true},Art),false);
  assert.equal(Village.drawPerson(ctx,png,p,100,100,12,1,{soldier:true},Art),false);
  p.health=100;p.activity='rest';
  assert.equal(JSON.stringify({p,child}),before);
});
test('normal native world draws pixel assets at 8x, old icons at 1x; no world state or fake village buildings',async()=>{
  const ui=await boot(),state=ui.world(),original=JSON.stringify(state);
  for(const [id,w,h] of [['pixelVillagers',256,144],['pixelGround',32,96],['pixelObjects',64,192]]){
    const img=ui.el(id);img.complete=true;img.naturalWidth=w;img.naturalHeight=h;
  }
  const far=ui.draw();
  assert.equal(far.filter(c=>c.kind==='drawImage').length,0,'overview remains lightweight');
  ui.el('followPersonBtn').onclick();
  assert.ok(ui.camera().zoom>=4);
  const close=ui.draw();
  const png=close.filter(c=>c.kind==='drawImage');
  assert.ok(png.length>3,'real close-up world draws multiple PNG tiles/characters');
  assert.ok(png.some(c=>c.args[0]===ui.el('pixelGround')));
  assert.ok(png.some(c=>c.args[0]===ui.el('pixelVillagers')));
  assert.equal(JSON.stringify(state),original,'presentation must not create resources or change household contents');
  ui.el('zoomResetBtn').onclick();
  assert.equal(ui.draw().filter(c=>c.kind==='drawImage').length,0);
});
test('Village focus targets an existing built home, not a made-up cinematic town',async()=>{
  const ui=await boot(),s=ui.world(),homes=s.households.filter(h=>h.home);
  const before=JSON.stringify(s);
  ui.el('villageArtBtn').onclick();
  if(homes.length){
    assert.equal(ui.camera().zoom,8);
    assert.equal(ui.runtime().speed,.1);
    assert.ok(homes.some(h=>Math.hypot((h.x+.5)-ui.camera().x,
      (h.y+.5)-ui.camera().y)<14));
  }else{
    assert.equal(ui.camera().zoom,1,'no built hut cannot be hallucinated by UI');
  }
  assert.equal(JSON.stringify(s),before);
});
test('real PNG atlases, runtime entry point and released offline file all agree',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const src=fs.readFileSync(path.join(root,'src/village-pixel-art.js'),'utf8');
  const builder=fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8');
  const independent=fs.readFileSync(path.join(root,'World-of-God-Playable.html'),'utf8');
  assert.match(html,/id="villageArtBtn"/);
  assert.ok(html.indexOf('src/village-pixel-art.js')<html.indexOf('src/app.js'));
  for(const p of ['pixel-villagers-v0.png','pixel-ground-v0.png','pixel-village-objects-v0.png']){
    assert.ok(html.includes('assets/'+p));
    assert.ok(builder.includes('assets/'+p));
  }
  assert.match(src,/drawImage\(img,frame\*CHAR_W/);
  assert.ok(independent.includes('data:image/png;base64,'));
  assert.equal((independent.match(/data:image\/png;base64,/g)||[]).length,3);
});
