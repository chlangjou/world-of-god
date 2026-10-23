'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),W=require('../src/sim.js');
const root=path.resolve(__dirname,'..');
const {boot}=require('./browser-harness.cjs');
test('v2 browser loads separate JS, styles and editable balance JSON',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const p of ['src/sim.js','src/app.js','assets/style-base.css','assets/viewport.css','assets/file-menu.css']){
   assert.ok(html.includes(p),'HTML entrypoint must reference '+p);
   assert.ok(fs.statSync(path.join(root,p)).isFile(),p+' must exist');
 }
 assert.ok(!html.includes('window.WOG_AGRICULTURE_PROFILE='));
 const profile=require('../config/balance-agriculture-v0.1.json');
 assert.equal(profile.familyExpansion.enabled,true);
 const religion=require('../config/religion-propagation-v0.1.json');
 assert.equal(religion.profileId,'religion-propagation-v0.1');
 assert.ok(fs.readFileSync(path.join(root,'src/app.js'),'utf8').includes('loadReligion()'));
 assert.ok(html.includes('id="saintSelect"'));
 assert.ok(fs.statSync(path.join(root,'config/religion-propagation-v0.1.json')).isFile());
});
test('Original defaults are preserved without applying experimental numbers',()=>{
 const original=require('../config/balance-default.json');
 assert.deepEqual(W.DEFAULT_RULES,original.rules);
});

test('granary construction shows real materials, work and completion in the fixed inspector',async()=>{
 const ui=await boot(),s=ui.world(),town=s.settlements[0];
 town.granary={x:town.x,y:town.y,progress:1.5,built:false,materialsPaid:false};
 town.storage.wood=2;town.storage.stone=1;
 ui.el('settlementSelect').onchange({target:{value:town.id}});
 assert.match(ui.el('townPanel').innerHTML,/公共糧倉：建造 1\.5 \/ 6 · 木材 2 \/ 6 · 石材 1 \/ 4/);
 town.granary.materialsPaid=true;ui.render();
 assert.match(ui.el('townPanel').innerHTML,/建材已投入/);
 town.granary.built=true;ui.render();
 assert.match(ui.el('townPanel').innerHTML,/公共糧倉：已完工/);
 assert.ok(fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8').includes('overflow:hidden'));
});

test('History only uses a fixed-height scrollbar with newest events first',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const styles=fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8');
 assert.ok(html.includes('id="historyCount"'));
 assert.ok(html.includes('id="events"') && html.includes('tabindex="0"'));
 assert.ok(!html.includes('id="historyPrev"')&&!html.includes('id="historyNext"'),
   'history pager controls must be removed');
 assert.ok(!app.includes('historyPage') && !app.includes('historyPrev'));
 assert.ok(app.includes('state.events.slice().reverse()'),'event order should be newest first');
 assert.ok(app.includes('oldNewestId'),'keep reading position as new events appear');
 assert.ok(styles.includes('[data-inspect-panel="history"] #events'));
 assert.ok(styles.includes('overflow-y:auto'));
 assert.ok(styles.includes('html,body{height:100%;max-height:100%;overflow:hidden}'),
   'only History scrolls; the overall page stays fixed');
 assert.equal(W.DEFAULT_RULES.eventLimit,200);
});

test('Priest and Saint are visually distinct; actual collected petitions gate clickable bubbles',async()=>{
 const ui=await boot(),s=ui.world();W.advanceTicks(s,3*21);ui.render();
 const saint=s.people.find(p=>p.id===s.religion.saints[0]);
 const priest=s.people.find(p=>p.id===s.religion.priests[0]);
 assert.ok(saint&&priest);assert.notEqual(saint.id,priest.id);
 const drawing=ui.draw(),size=ui.canvas.width/s.width;
 const fillAt=p=>drawing.find(c=>c.kind==='fill'&&c.arc&&Math.abs(c.arc[0]-(p.x+.5)*size)<1e-8&&Math.abs(c.arc[1]-(p.y+.5)*size)<1e-8);
 assert.notEqual(fillAt(saint).fill,fillAt(priest).fill,'role colors must be visibly distinct');
 for(const faith of [s.religion,s.opponentReligion,...(s.additionalReligions||[])])faith.prayers=[];
 assert.equal(ui.draw().filter(c=>c.kind==='fillText'&&c.fill==='#4b3863').length,0);
 const patient=s.people.find(p=>p.alive&&p.religionId===s.religion.id&&p.id!==priest.id);
 patient.health=55;W.advanceTicks(s,3);ui.render();
 const petition=W.priestPetitions(s,priest.id)[0];assert.ok(petition,'real injury should be collected by a Priest');
 const bubbles=ui.draw().filter(c=>c.kind==='fillText'&&c.fill==='#4b3863');assert.ok(bubbles.length>0);
 const bubble=bubbles[0];
 ui.canvas.listeners.click({clientX:bubble.args[1],clientY:bubble.args[2]});
 assert.ok(ui.el('needsPanel').innerHTML.includes(petition.id));
 assert.equal(ui.el('needsPanel').innerHTML.includes('undefined'),false);
});

test('the selected Divine Power is routed through typed Miracle and Oracle actions',async()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  const profile=require('../config/divine-powers-v0.1.json');
  assert.equal(profile.profileId,'divine-powers-v0.1');
  assert.equal(Object.keys(profile.powers).length,8);
  for(const id of ['miracleName','miracleHint','oracleName','oracleHint','durationLabel'])
    assert.ok(html.includes('id="'+id+'"'),'missing live power UI '+id);
  for(const type of ['ripening','harvest','heal','efficiency','drought','lightning','confusion','blindness','religion.spread'])
    assert.ok(app.includes(type),'power option is missing '+type);
  const calls=[];const sim={...W,
    castMiracle:(s,id,input)=>{const result=W.castMiracle(s,id,input);calls.push({kind:'miracle',id,input,result});return result;},
    issueOracle:(s,input)=>{const result=W.issueOracle(s,input);calls.push({kind:'oracle',input,result});return result;}};
  const ui=await boot({sim}),s=ui.world();W.advanceTicks(s,3*21);ui.render();
  s.god.dp=s.god.cap;ui.choose('ripening');ui.clickMap(s.camp.x,s.camp.y);
  const cast=calls.find(c=>c.kind==='miracle');assert.ok(cast&&cast.result.ok);
  assert.equal(cast.id,'ripening');assert.ok(Math.abs(cast.input.x-s.camp.x)<1);
  ui.el('oracleTab').onclick();ui.choose('family.nurture');ui.el('oracleBtn').onclick();
  const oracle=calls.find(c=>c.kind==='oracle');assert.ok(oracle&&oracle.result.ok);
  assert.equal(oracle.input.intentType,'family.nurture');assert.ok(s.religion.saints.includes(oracle.input.saintId));
  assert.ok(app.includes("loadDivine()"),'runtime must load separate Divine Profile');
  assert.ok(fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8').includes('WOG_DIVINE_PROFILE'),
    'standalone export must bundle tunable power parameters');
});

test('need-location controls keep three readable entries, exact map centers, and fixed viewport',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8');
  const sim=fs.readFileSync(path.join(root,'src/sim.js'),'utf8');
  assert.ok(html.includes('需求定位')&&html.includes('評估範圍'));
  assert.ok(app.includes('prayers.slice(needPage*3,(needPage+1)*3)'),
    'all needs must stay navigable, not just the newest two');
  assert.ok(app.includes('data-need-locate')&&app.includes('data-needs-page'));
  assert.ok(app.includes('needsMarkup!==lastNeedsMarkup'),
    'a frequent render must not replace a need button while the player is clicking or focusing it');
  assert.ok(app.includes('selectedNeedId')&&app.includes('currentNeed()'));
  assert.ok(app.includes("loc.radius*size"),'the requested field radius must be drawn');
  assert.ok(app.includes('cursor||currentNeed()?.location?.center||state.camp'),
    'a located request becomes the preview anchor until the pointer moves');
  assert.ok(sim.includes('function prayerLocation('));
  assert.ok(css.includes('.need-locate-card')&&css.includes('.need-pager'));
  assert.ok(css.includes('html,body{height:100%;max-height:100%;overflow:hidden}'),
    'global page must remain non-scrolling');
});
