'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../src/sim.js');
const Politics=require('../config/polity-command-v0.1.json');
const {boot}=require('./browser-harness.cjs');
const root=path.resolve(__dirname,'..');
const layerIds=['Diplomacy','Settlements','Quarries','Military','Religion','Effects','FocusTown'];
const setup=async()=>{
  const ui=await boot({politicsProfile:{...Politics,enabled:true,diplomacy:{enabled:true}}});
  const world=ui.world();
  W.advanceTicks(world,3);ui.render();
  assert.ok(world.politics?.polities.length>=2,'two real, formed polities');
  const [a,b]=world.politics.polities;
  world.politics.diplomacy.relations=[{
    aId:a.id,bId:b.id,status:'alliance',trust:50,grievance:0,delivered:3,
    contactDays:8,allianceAtHour:world.hour,reason:'controlled map visualization fixture'
  }];
  return {ui,world,a,b};
};
const drawn=(ui,kind,matcher)=>ui.draw().filter(v=>v.kind===kind&&matcher(v));

test('UI overlay is a compact map-only layer chooser with native accessible controls',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8');
  for(const id of ['mapLayersButton','mapLayersPanel','mapPresetWorld','mapPresetPolitical',
    'mapPresetMilitary',...layerIds.map(x=>'mapLayer'+x)])
    assert.ok(html.includes('id="'+id+'"'),'missing map layer control '+id);
  assert.match(html,/aria-controls="mapLayersPanel"/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(css,/\.map-layers-panel/);
  assert.match(css,/\.map-layer-switches/);
  assert.match(css,/html,body\{height:100%;max-height:100%;overflow:hidden\}/);
});

test('default world hides crowded diplomacy links; presets and independent switches alter drawing only',async()=>{
  const {ui,world,a}=await setup();
  const links=()=>drawn(ui,'stroke',v=>v.stroke==='#eed383').length;
  const snapshot=JSON.stringify(world),now=ui.runtime();
  assert.equal(ui.el('mapLayersPanel').hidden,true,'layer panel starts collapsed');
  assert.equal(ui.el('mapLayersButton').textContent,'圖層 · 一般');
  assert.equal(ui.el('mapLayerDiplomacy').checked,false);
  assert.equal(ui.el('mapLayerSettlements').checked,false);
  assert.equal(ui.el('mapLayerQuarries').checked,true);
  assert.equal(ui.el('mapLayerMilitary').checked,true);
  assert.equal(links(),0,'normal map must not paint all alliance lines');

  ui.el('mapLayersButton').onclick();
  assert.equal(ui.el('mapLayersPanel').hidden,false);
  ui.el('mapPresetPolitical').onclick();
  assert.equal(ui.el('mapLayersButton').textContent,'圖層 · 外交');
  assert.equal(ui.el('mapLayerDiplomacy').checked,true);
  assert.equal(ui.el('mapLayerSettlements').checked,true);
  assert.equal(ui.el('mapLayerFocusTown').checked,true);
  ui.el('settlementSelect').onchange({target:{value:a.townId}});
  assert.ok(links()>0,'political view shows an actual alliance line');

  ui.el('mapLayerDiplomacy').checked=false;
  ui.el('mapLayerDiplomacy').onchange();
  assert.equal(ui.el('mapLayersButton').textContent,'圖層 · 自訂');
  assert.equal(links(),0,'one checkbox removes links without changing mode');
  ui.el('mapLayerDiplomacy').checked=true;
  ui.el('mapLayerDiplomacy').onchange();
  assert.ok(links()>0,'links can be restored independently');
  ui.el('mapPresetMilitary').onclick();
  assert.equal(ui.el('mapLayersButton').textContent,'圖層 · 軍事');
  assert.equal(ui.el('mapLayerDiplomacy').checked,false);
  assert.equal(links(),0);

  assert.equal(JSON.stringify(world),snapshot,'map switches must never edit simulation/save state');
  assert.deepEqual(ui.runtime(),now,'map switches must never change pause, tick speed or time');
  assert.equal(ui.key('Escape'),true);
  assert.equal(ui.el('mapLayersPanel').hidden,true,'Escape dismisses only the overlay');
});

test('mines, administrative regions, armies and ongoing miracles respect their independent layers',async()=>{
  const {ui,world,a,b}=await setup();
  const countText=(value)=>drawn(ui,'fillText',v=>v.args[0]===value).length;
  const rings=()=>drawn(ui,'stroke',v=>['#98cbb7','#bed9b4','#f4d69f'].includes(v.stroke)).length;
  const ore=()=>countText('石');
  assert.ok(ore()>0,'finite/special stone sites should have readable markers');
  assert.equal(rings(),0,'default hides district rings but still shows town names');

  ui.el('mapLayerQuarries').checked=false;ui.el('mapLayerQuarries').onchange();
  assert.equal(ore(),0);
  ui.el('mapLayerQuarries').checked=true;ui.el('mapLayerQuarries').onchange();
  assert.ok(ore()>0);
  ui.el('mapLayerSettlements').checked=true;ui.el('mapLayerSettlements').onchange();
  assert.ok(rings()>0);

  world.politics.disputes.push({id:'map-visibility-fixture',aId:a.id,bId:b.id,
    site:{x:world.settlements[0].x,y:world.settlements[0].y,kind:'stone'},
    status:'marching',resolvedAtHour:null});
  ui.render(); // battle focus is an always-available safety control.
  assert.ok(countText('軍隊接近中')>0);
  ui.el('mapLayerMilitary').checked=false;ui.el('mapLayerMilitary').onchange();
  assert.equal(countText('軍隊接近中'),0,'hide only the graphical marker');
  assert.equal(ui.el('battleFocusBtn').hidden,false,'actual battle status stays accessible');

  const fx={type:'rain',x:13,y:15,radius:3,endsAtHour:world.hour+24,godId:world.god.id};
  world.effects.push(fx);
  const activeRain=()=>drawn(ui,'stroke',v=>v.stroke==='#bfeaff').length;
  assert.ok(activeRain()>0);
  ui.el('mapLayerEffects').checked=false;ui.el('mapLayerEffects').onchange();
  assert.equal(activeRain(),0);
  assert.ok(world.effects.includes(fx),'hiding Miracle visuals does not cancel the effect');
});

test('religion symbols are optional but character identities, world time and Miracle controls persist',async()=>{
  const {ui,world}=await setup();
  const person=world.people.find(v=>v.alive);
  assert.ok(person);
  const baseline=JSON.stringify(world);
  const heads=()=>drawn(ui,'fill',v=>v.arc&&
    Math.abs(v.arc[0]-(person.x+.5)*ui.canvas.width/world.width)<1e-8).length;
  const before=heads();
  assert.ok(before>0);
  ui.el('mapLayerReligion').checked=false;ui.el('mapLayerReligion').onchange();
  assert.ok(heads()>0,'resident circles never disappear with religious annotations');
  assert.equal(JSON.stringify(world),baseline);
  assert.equal(ui.el('mapLayerReligion').checked,false);
});
