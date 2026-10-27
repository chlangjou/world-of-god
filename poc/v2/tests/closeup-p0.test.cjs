'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const O=require('../src/closeup-observation.js'),L=require('../src/living-world.js');
const World=require('../src/sim.js');
const {boot}=require('./browser-harness.cjs');
const approx=(x,y,eps=1e-6)=>assert.ok(Math.abs(x-y)<eps,x+' not near '+y);

test('4x entry / 3x exit hysteresis remembers fast-forward and does not overwrite explicit speed',()=>{
  const s=O.create();assert.equal(O.zoom(s,3.99,16),null);
  assert.equal(O.zoom(s,4,16),.1);assert.equal(s.active,true);assert.equal(s.savedSpeed,16);
  assert.equal(O.zoom(s,3.6,.1),null);assert.equal(s.active,true);
  assert.equal(O.zoom(s,3,.1),16);assert.equal(s.active,false);
  assert.equal(O.zoom(s,4,16),.1);
  assert.equal(O.speedChosen(s,1),1);assert.equal(s.userOverride,true);
  assert.equal(O.zoom(s,2,1),null,'a user-selected 1x stays selected');
  assert.equal(s.active,false);
  assert.equal(O.zoom(s,4,1),.1);
  assert.equal(O.speedChosen(s,16),16);
  assert.equal(s.active,false);assert.equal(s.suppressed,true);
  assert.equal(O.zoom(s,5,16),null,'do not secretly slow down an explicit 16x');
  assert.equal(O.zoom(s,2.9,16),null);assert.equal(s.suppressed,false);
});

test('camera follow only moves beyond the central safe box, with smoothing, edge clamp and honest jumps',()=>{
  const camera=L.createCamera(64,64);camera.zoom=8;L.focus(camera,32,32);
  const c={x:camera.x,y:camera.y};
  let outcome=O.deadZoneFollow(camera,{x:33.6,y:33.4},33);
  assert.equal(outcome.moved,false);approx(camera.x,c.x);approx(camera.y,c.y);
  outcome=O.deadZoneFollow(camera,{x:35.7,y:32},33);
  assert.equal(outcome.jump,false);assert.ok(camera.x>c.x&&camera.x<35.7);
  outcome=O.deadZoneFollow(camera,{x:50,y:50},33);
  assert.equal(outcome.jump,true);approx(camera.x,50);approx(camera.y,50);
  O.deadZoneFollow(camera,{x:1000,y:-1000},33);
  const visible=L.bounds(camera,768,768);
  assert.ok(visible.minX>=0&&visible.maxX<=64&&visible.minY>=0&&visible.maxY<=64);
});

test('zoom to 4x slows real world progression without changing it while paused',async()=>{
  const ui=await boot(),s=ui.world(),baseline=JSON.stringify(s);
  ui.speedButton(16).onclick();
  ui.el('zoomInBtn').onclick();assert.equal(ui.camera().zoom,2);
  assert.equal(ui.runtime().speed,16);
  ui.el('zoomInBtn').onclick();
  assert.equal(ui.camera().zoom,4);
  assert.equal(ui.runtime().speed,.1);
  assert.equal(ui.runtime().paused,true);
  assert.equal(ui.runtime().observation.active,true);
  assert.equal(ui.el('observeBtn').hidden,false);
  assert.equal(JSON.stringify(s),baseline);
  // World uses 8-hour logical ticks. 0.1x means 1 tick per ~6.67 sec.
  ui.el('pauseBtn').onclick();
  const tick=s.tick;
  for(let n=1;n<=27;n++)ui.frame(n*250);
  assert.equal(s.tick,tick,'a 6.5-second presentation cannot secretly advance a full tick');
  ui.frame(28*250);
  assert.equal(s.tick,tick+1,'the simulation itself advances at 0.1x');
  assert.equal(ui.runtime().observation.active,true);
  ui.el('pauseBtn').onclick();
  assert.equal(ui.runtime().paused,true);
  assert.deepEqual(World.validate(s).errors,[]);
});

test('zoom-out restores prior 16x without resuming the paused world or inventing events',async()=>{
  const ui=await boot(),s=ui.world(),before=JSON.stringify(s);
  ui.speedButton(16).onclick();
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  assert.equal(ui.runtime().speed,.1);
  ui.el('zoomOutBtn').onclick();assert.equal(ui.camera().zoom,2);
  assert.equal(ui.runtime().speed,16);
  assert.equal(ui.runtime().observation.active,false);
  assert.equal(ui.runtime().paused,true);
  assert.equal(JSON.stringify(s),before);
  assert.equal(ui.el('observeBtn').hidden,true);
});

test('fast speed and toggle explicitly opt out of viewing, do not secretly cap 4x/16x',async()=>{
  const ui=await boot();
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  ui.speedButton(16).onclick();assert.equal(ui.runtime().speed,16);
  assert.equal(ui.runtime().observation.active,false);
  assert.equal(ui.camera().zoom,4);
  ui.el('observeBtn').onclick();
  assert.equal(ui.runtime().speed,.1);assert.equal(ui.runtime().observation.active,true);
  ui.el('observeBtn').onclick();
  assert.equal(ui.runtime().speed,16);assert.equal(ui.runtime().observation.active,false);
  ui.el('observeBtn').onclick();
  ui.speedButton(1).onclick();
  assert.equal(ui.runtime().speed,1);assert.equal(ui.runtime().observation.active,true);
  ui.el('zoomOutBtn').onclick();
  assert.equal(ui.runtime().speed,1,'explicit 1x wins over the saved fast-forward');
});

test('explicit follow, camera dead zone, wheel zoom and manual drag do not steal each others ownership',async()=>{
  const ui=await boot(),s=ui.world(),p=s.people.find(x=>x.alive);
  p.x=31.5;p.y=31.5;
  ui.el('followPersonBtn').onclick();
  assert.equal(ui.camera().followId,p.id);
  assert.equal(ui.camera().zoom,4);assert.equal(ui.runtime().speed,.1);
  const initial=ui.camera();
  p.x+=2;ui.draw();approx(ui.camera().x,initial.x);
  p.x+=6;ui.draw();
  assert.ok(ui.camera().x>initial.x,'follow must react when person leaves center safe area');
  const followed=ui.camera().followId;
  ui.canvas.listeners.wheel({deltaY:-100,clientX:384,clientY:384,preventDefault(){}});
  assert.equal(ui.camera().followId,followed,'wheel preserves explicit follow');
  assert.ok(ui.camera().zoom>4);
  ui.canvas.listeners.pointerdown({button:0,pointerId:2,clientX:330,clientY:330});
  ui.canvas.listeners.pointermove({clientX:410,clientY:380});
  ui.canvas.listeners.pointerup({});
  assert.equal(ui.camera().followId,null,'manual pan releases follow');
  assert.equal(ui.runtime().observation.active,true,'manual pan does not exit observation mode');
  assert.equal(ui.runtime().speed,.1);
});

test('aiming pauses real time, snaps stale interpolated patients, and only releases its own pause',async()=>{
  const ui=await boot(),s=ui.world(),p=s.people.find(x=>x.alive);
  s.god.dp=s.god.cap;p.health=40;
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  ui.el('pauseBtn').onclick();assert.equal(ui.runtime().paused,false);
  const oldX=p.x>8?p.x-3:p.x+3;
  ui.setMotion(p.id,{from:{x:oldX,y:p.y},to:{x:p.x,y:p.y},
    path:[{x:oldX,y:p.y},{x:p.x,y:p.y}],startedAt:0,duration:1000});
  assert.ok(Math.abs(ui.position(p.id).x-p.x)>2);
  ui.choose('heal');
  assert.equal(ui.runtime().paused,true);
  assert.equal(ui.runtime().aimHold.active,true);
  assert.equal(ui.runtime().aimHold.owned,true);
  approx(ui.position(p.id).x,p.x,'the displayed patient snaps to the authoritative position before clicking');
  assert.equal(ui.el('closeAimStatus').hidden,false);
  const tick=s.tick;for(let i=1;i<=30;i++)ui.frame(i*250);
  assert.equal(s.tick,tick,'while aiming, no world tick or enemy action is silently taken');
  const at=L.toScreen(ui.camera(),p.x+.5,p.y+.5,768,768);
  const before=p.health;
  ui.canvas.listeners.click({clientX:at.x,clientY:at.y});
  assert.ok(p.health>before);
  assert.equal(ui.runtime().aimHold.active,false);
  assert.equal(ui.runtime().paused,false,'only the aim-originated pause is released');
  assert.equal(s.tick,tick);
  assert.deepEqual(World.validate(s).errors,[]);
});

test('manual pause during aim, battle pause and victory pause cannot be auto-resumed',async()=>{
  const ui=await boot(),s=ui.world();
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  ui.el('pauseBtn').onclick();
  s.god.dp=s.god.cap;
  ui.choose('rain');assert.equal(ui.runtime().aimHold.owned,true);
  ui.el('pauseBtn').onclick();assert.equal(ui.runtime().aimHold.owned,false);
  ui.key('Escape');assert.equal(ui.runtime().paused,true);
  ui.choose('rain');assert.equal(ui.runtime().aimHold.owned,false);
  ui.key('Escape');assert.equal(ui.runtime().paused,true);
  assert.deepEqual(World.validate(s).errors,[]);
});

test('a user changing speed while still aiming exits observation deliberately, not by hidden fast-forward',async()=>{
  const ui=await boot(),s=ui.world();
  s.god.dp=s.god.cap;
  ui.el('zoomInBtn').onclick();ui.el('zoomInBtn').onclick();
  ui.el('pauseBtn').onclick();
  ui.choose('rain');assert.equal(ui.runtime().paused,true);
  ui.speedButton(4).onclick();
  assert.equal(ui.runtime().observation.active,false);
  assert.equal(ui.runtime().aimHold.active,false);
  assert.equal(ui.runtime().armedMiracle,null);
  assert.equal(ui.runtime().speed,4);
  assert.equal(ui.camera().zoom,4);
});

test('close-up UI is bundled in a real HTML page; no core sim change needed',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const build=fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8');
  assert.ok(html.indexOf('src/closeup-observation.js')>html.indexOf('src/character-art.js'));
  assert.ok(html.indexOf('src/closeup-observation.js')<html.indexOf('src/app.js'));
  assert.match(html,/id="observeBtn"/);assert.match(html,/id="closeAimStatus"/);
  assert.match(build,/read\('src\/closeup-observation\.js'\)/);
});
