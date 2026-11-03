'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Cartoon=require('../src/village-cartoon-art.js');
const Art=require('../src/character-art.js');
const {boot}=require('./browser-harness.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function loaded(w,h){return {complete:true,naturalWidth:w,naturalHeight:h};}
function ctxSpy(){
 const draws=[];
 const ctx=new Proxy({},{
   get(obj,key){
     if(key==='drawImage')return (...args)=>draws.push(args);
     if(key==='fillStyle'||key==='imageSmoothingEnabled')return obj[key];
     return key in obj?obj[key]:()=>{};
   },set(obj,key,value){obj[key]=value;return true;}
 });
 return {ctx,draws};
}
test('B artwork is 3 real independently loadable vector sheets, not an enlarged concept scene',()=>{
 const spec=[['characters.svg',512,288],['ground.svg',128,384],['objects.svg',128,384]];
 for(const [name,w,h] of spec){
   const svg=read('assets/cartoon-v0/'+name);
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.ok(svg.includes('width="'+w+'" height="'+h+'"'),name+' dimensions');
   assert.ok(!svg.includes('<script')&&!svg.includes('<foreignObject'),'no executable third-party content');
   assert.ok(svg.length>1000,'real illustrated vector content');
 }
 const chars=read('assets/cartoon-v0/characters.svg');
 assert.equal((chars.match(/<g transform="translate\(\d+ \d+\)"/g)||[]).length,24);
 for(let row=0;row<3;row++)for(let frame=0;frame<8;frame++)
   assert.ok(chars.includes('transform="translate('+(frame*64)+' '+(row*96)+')"'));
 assert.equal(Cartoon.ROLE_ROW.child,2);
 assert.equal(new Set(['characters.svg','ground.svg','objects.svg']).size,3);
});
test('B painter draws only real terrain, built homes and native resident states without mutating them',()=>{
 const world={seed:73,width:3,height:2,tiles:[
   {x:0,y:0,terrain:'meadow',moisture:.8},
   {x:1,y:0,terrain:'river'},{x:2,y:0,terrain:'forest'},
   {x:0,y:1,terrain:'rock'},{x:1,y:1,terrain:'field',crop:.8},
   {x:2,y:1,terrain:'field',crop:0}]};
 const before=JSON.stringify(world),{ctx,draws}=ctxSpy();
 for(const t of world.tiles)assert.equal(Cartoon.drawTile(ctx,loaded(128,384),t,world,12),true);
 assert.equal(draws.length,6);
 assert.equal(draws[1][2],3*64,'real river row');
 assert.equal(draws[4][2],5*64,'real field row');
 assert.equal(Cartoon.drawHouse(ctx,loaded(128,384),{x:0,y:0,home:false},12),false);
 assert.equal(Cartoon.drawHouse(ctx,loaded(128,384),{x:0,y:0,home:true},12),true);
 assert.equal(draws.at(-1)[2],0,'house illustration row');
 assert.equal(Cartoon.drawTerrainObject(ctx,loaded(128,384),
   {terrain:'meadow',x:0,y:0},12,73),false);
 assert.equal(JSON.stringify(world),before,'drawing does not mutate simulation');
 const again=ctxSpy();for(const t of world.tiles)Cartoon.drawTile(again.ctx,loaded(128,384),t,world,12);
 assert.deepEqual(draws.slice(0,6).map(c=>c.slice(1,5)),again.draws.map(c=>c.slice(1,5)),
  'same seed and location always choose same SVG tile');
});
test('SVG sheet uses fixed foot anchors, actual adult and child rows, state-driven pose',()=>{
 const {ctx,draws}=ctxSpy();
 const a={id:'pA',stage:'adult',age:26,health:100,activity:'rest'};
 const c={id:'pC',stage:'child',age:8,health:100,activity:'pray'};
 assert.ok(['adult-a','adult-b'].includes(Cartoon.roleFor(a,{},Art)));
 assert.equal(Cartoon.roleFor(c,{},Art),'child');
 assert.equal(Cartoon.drawPerson(ctx,loaded(512,288),a,100,120,12,1,{},Art),true);
 assert.equal(Cartoon.drawPerson(ctx,loaded(512,288),c,120,130,12,1,{},Art),true);
 assert.equal(draws[1][2],192,'children use their own sprite row');
 assert.equal(draws[1][1],6*64,'child prayer has real pose frame');
 const adult=draws[0],child=draws[1];
 assert.equal(adult[5],100-12*1.10/2);
 assert.equal(child[6],130+12*.56-12*1.66);
 assert.equal(Cartoon.frameFor({...a,activity:'farm'},{},1,Art),5);
 assert.equal(Cartoon.frameFor({...a,activity:'travel'},{moving:true},1,Art)>=1,true);
 assert.equal(Cartoon.frameFor({...a,health:50},{},1,Art),7);
 assert.equal(Cartoon.drawPerson(ctx,loaded(512,288),a,100,120,12,1,{priest:true},Art),false,
  'unmade Priest art uses existing fallback, not a fake adult job');
});
test('real native world switches B/Pixel at fixed 4x and 8x without changing a single world field',async()=>{
 const ui=await boot(),world=ui.world(),baseline=JSON.stringify(world);
 const assets=[
  ['cartoonVillagers',512,288],['cartoonGround',128,384],['cartoonObjects',128,384],
  ['pixelVillagers',256,144],['pixelGround',32,96],['pixelObjects',64,192]];
 for(const [id,w,h] of assets){const im=ui.el(id);im.complete=true;im.naturalWidth=w;im.naturalHeight=h;}
 ui.el('villageArtBtn').onclick();
 assert.equal(ui.camera().zoom,8,'real village camera is 8x');
 const eight=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(eight.some(c=>c.args[0]===ui.el('cartoonGround')),'B ground is drawn from real world');
 if(world.households.some(h=>h.home))assert.ok(eight.some(c=>c.args[0]===ui.el('cartoonObjects')),
   'actual native built homes are cartoon');
 ui.el('zoomOutBtn').onclick();assert.equal(ui.camera().zoom,4);
 const four=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(four.some(c=>c.args[0]===ui.el('cartoonGround')),'B visible in 4x Camera');
 ui.el('cartoonStyleBtn').onclick();
 const old=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(old.some(c=>c.args[0]===ui.el('pixelGround')),'reversible pixel baseline at same 4x zoom');
 assert.ok(!old.some(c=>c.args[0]===ui.el('cartoonGround')),'no mixed cartoon floor in Pixel mode');
 ui.el('cartoonStyleBtn').onclick();
 const modern=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(modern.some(c=>c.args[0]===ui.el('cartoonGround')));
 ui.el('followPersonBtn').onclick();
 const actor=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(actor.some(c=>c.args[0]===ui.el('cartoonVillagers')),
   'actual selected resident uses SVG sprite at close zoom');
 assert.equal(JSON.stringify(world),baseline,'view buttons, redraw and following never mutate state');
 ui.el('zoomResetBtn').onclick();
 assert.ok(!ui.draw().some(c=>c.kind==='drawImage'),'strategic 1x remains old overview');
});
test('failed B load falls back to complete old Pixel art instead of mixing styles',async()=>{
 const ui=await boot();
 for(const [id,w,h] of [
   ['pixelVillagers',256,144],['pixelGround',32,96],['pixelObjects',64,192],
   ['cartoonVillagers',512,288],['cartoonGround',128,384]]){
   const im=ui.el(id);im.complete=true;im.naturalWidth=w;im.naturalHeight=h;
 }
 const missing=ui.el('cartoonObjects');missing.complete=false;
 ui.el('villageArtBtn').onclick();
 const draw=ui.draw().filter(c=>c.kind==='drawImage');
 assert.ok(draw.some(c=>c.args[0]===ui.el('pixelGround')));
 assert.ok(!draw.some(c=>c.args[0]===ui.el('cartoonGround')));
});
