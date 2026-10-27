'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Living=require('../src/living-world.js');
const W=require('../src/sim.js');
const {boot}=require('./browser-harness.cjs');

function near(a,b,epsilon=1e-6){assert.ok(Math.abs(a-b)<epsilon,a+' should equal '+b);}

test('1× overview and 2–8× anchor zoom retain inverse world/screen coordinates',()=>{
  const c=Living.createCamera(64,64);
  const center=Living.toScreen(c,32,32,768,768);
  near(center.x,384);near(center.y,384);
  const anchor={x:390,y:375};
  const world=Living.toWorld(c,anchor.x,anchor.y,768,768);
  for(const zoom of [2,4,8]){
    Living.setZoom(c,zoom,anchor.x,anchor.y,768,768);
    const after=Living.toWorld(c,anchor.x,anchor.y,768,768);
    near(after.x,world.x);near(after.y,world.y);
  }
  assert.equal(c.zoom,8);
  const visible=Living.bounds(c,768,768);
  near(visible.maxX-visible.minX,8);
  Living.setZoom(c,1,384,384,768,768);
  assert.equal(c.zoom,1);
  assert.deepEqual(Living.bounds(c,768,768),{minX:0,minY:0,maxX:64,maxY:64});
});

test('drag pan is clamped to the world, never mutates any simulation fields',()=>{
  const c=Living.createCamera(64,64),baseline=JSON.stringify(c);
  Living.setZoom(c,4,384,384,768,768);
  Living.pan(c,200,70,768,768);
  assert.notEqual(JSON.stringify(c),baseline);
  Living.pan(c,100000,-100000,768,768);
  const v=Living.bounds(c,768,768);
  assert.ok(v.minX>=-1e-8&&v.minY>=-1e-8);
  assert.ok(v.maxX<=64+1e-8&&v.maxY<=64+1e-8);
  Living.pan(c,-100000,100000,768,768);
  const right=Living.bounds(c,768,768);
  assert.ok(right.maxX<=64+1e-8&&right.minY>=-1e-8);
});

test('actual mobilityTrace controls the animated path, not a fabricated straight line',()=>{
  const s={people:[{id:'p1',alive:true,x:2,y:2,activity:'travel',
    mobilityTrace:[{x:0,y:0},{x:0,y:2},{x:2,y:2}]}]};
  const old=new Map([['p1',{x:0,y:0}]]);
  const baseline=JSON.stringify(s);
  const motions=Living.transitions(old,s,1000,1000);
  assert.equal(motions.size,1);
  const midway=Living.position(motions.get('p1'),s.people[0],1500);
  near(midway.x,0);near(midway.y,2);
  const end=Living.position(motions.get('p1'),s.people[0],2000);
  near(end.x,2);near(end.y,2);assert.equal(end.moving,false);
  assert.equal(JSON.stringify(s),baseline,'visual interpolation must never alter a real person');
});

test('missing route for a long relocation never pretends to be walkable travel',()=>{
  const s={people:[{id:'p1',alive:true,x:32,y:32,activity:'rest'}]};
  const old=new Map([['p1',{x:1,y:1}]]);
  assert.equal(Living.transitions(old,s,0,500).size,0);
  const now=Living.position(undefined,s.people[0],250);
  assert.deepEqual(now,{x:32,y:32,moving:false});
});

test('close-up faces and gestures are derived from actual state, not a new mood model',()=>{
  let strokes=0,fillTexts=0;
  const c=new Proxy({},{get(target,name){
    if(name==='stroke')return ()=>{strokes++;};
    if(name==='fillText')return ()=>{fillTexts++;};
    return name in target?target[name]:()=>{};
  },set(target,key,v){target[key]=v;return true;}});
  const p={id:'p17',stage:'adult',health:46,hunger:.90,activity:'pray',alive:true};
  const original=JSON.stringify(p);
  Living.drawActing(c,p,50,40,12,4,{zoom:8,moving:false});
  assert.ok(strokes>0&&fillTexts>0);
  assert.equal(JSON.stringify(p),original);
});

test('browser zoom, follow, and pan change only camera; a zoomed Heal still hits a real person',async()=>{
  const ui=await boot(),s=ui.world(),person=s.people.find(p=>p.alive);
  assert.ok(person);
  const original=JSON.stringify(s);
  ui.el('zoomInBtn').onclick();
  ui.el('zoomInBtn').onclick();
  assert.equal(ui.camera().zoom,4);
  assert.equal(JSON.stringify(s),original,'zoom cannot mutate simulation');
  ui.el('followPersonBtn').onclick();
  assert.equal(ui.camera().followId,person.id);
  assert.equal(ui.el('followStatus').hidden,false);
  assert.match(ui.el('followStatus').textContent,/健康/);
  ui.el('followPersonBtn').onclick();
  assert.equal(ui.camera().followId,null);
  const before=ui.camera();
  ui.canvas.listeners.pointerdown({button:0,pointerId:1,clientX:350,clientY:350});
  ui.canvas.listeners.pointermove({button:0,clientX:440,clientY:385});
  ui.canvas.listeners.pointerup({});
  assert.notEqual(ui.camera().x,before.x,'pointer drag pans the view');
  assert.equal(JSON.stringify(s),original,'dragging is display-only');

  // Retarget the actual selected living citizen after panning.
  ui.el('followPersonBtn').onclick();
  s.god.dp=s.god.cap;
  person.health=48;
  ui.choose('heal');
  const at=Living.toScreen(ui.camera(),person.x+.5,person.y+.5,768,768);
  const tickBefore=s.tick,healthBefore=person.health;
  ui.canvas.listeners.click({clientX:at.x,clientY:at.y}); // ignore drag's synthetic click
  ui.canvas.listeners.click({clientX:at.x,clientY:at.y}); // intentional world click
  assert.ok(person.health>healthBefore,'zoomed target must resolve to actual simulation coordinates');
  assert.equal(s.tick,tickBefore,'clicking Miracle cannot fabricate a simulation tick');
  assert.ok(ui.el('followStatus').textContent.includes(person.name));
  assert.deepEqual(W.validate(s).errors,[]);
});

test('pause and frame rendering do not advance world time or invent movement',async()=>{
  const ui=await boot(),s=ui.world();
  ui.el('zoomInBtn').onclick();
  ui.el('zoomInBtn').onclick();
  const hour=s.hour,initial=JSON.stringify(s);
  for(let i=1;i<8;i++)ui.frame(i*80);
  assert.equal(s.hour,hour);
  assert.equal(JSON.stringify(s),initial);
  assert.equal(ui.camera().zoom,4);
});

test('HTML loads Living World before app and offline build declares the same module',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const build=fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  const first=html.indexOf('src/living-world.js'),last=html.indexOf('src/app.js');
  assert.ok(first>=0&&last>first,'camera module must load before adapter');
  assert.match(build,/read\('src\/living-world\.js'\)/);
  assert.match(app,/const S = window.WoG2, Playtest = window.WOG_PLAYTEST, L = window.WOG_LIVING_WORLD/);
  assert.match(html,/id="zoomResetBtn"/);
  assert.match(html,/id="followStatus"/);
});

test('Heal targets the authoritative patient when their animated avatar trails the 8-hour tick',async()=>{
  const ui=await boot(),s=ui.world(),p=s.people.find(p=>p.alive);
  s.god.dp=s.god.cap;p.health=40;
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  ui.el('followPersonBtn').onclick();
  const oldX=p.x>8?p.x-4:p.x+4;
  ui.setMotion(p.id,{from:{x:oldX,y:p.y},to:{x:p.x,y:p.y},
    path:[{x:oldX,y:p.y},{x:p.x,y:p.y}],startedAt:0,duration:1000});
  ui.render();
  const shown=ui.position(p.id);
  assert.ok(Math.abs(shown.x-p.x)>=3,'a playing avatar may trail its already-advanced tick');
  ui.choose('heal');
  // A visible close-up aim pause must snap that trail to the real world first,
  // rather than secretly moving the Miracle after the user clicks.
  const actual=ui.position(p.id);
  near(actual.x,p.x);near(actual.y,p.y);
  assert.equal(ui.runtime().paused,true);
  assert.equal(ui.runtime().aimHold.active,true);
  const screen=Living.toScreen(ui.camera(),actual.x+.5,actual.y+.5,768,768);
  const hour=s.hour,originalHealth=p.health;
  ui.canvas.listeners.click({clientX:screen.x,clientY:screen.y});
  assert.ok(p.health>originalHealth,'clicking visual avatar must heal their current world coordinates');
  assert.equal(s.hour,hour);
  assert.equal(ui.camera().followId,p.id);
});
