'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),W=require('../src/sim.js');
const root=path.resolve(__dirname,'..');
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

test('granary construction is visible in the existing fixed viewport without new scrolling',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const styles=fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8');
 const agriculture=require('../config/balance-agriculture-v0.1.json');
 assert.ok(html.includes('sw granary'),'a warehouse legend entry should be visible');
 assert.ok(app.includes('granaryStatus'),'inspector should show the selected settlement construction state');
 assert.ok(app.includes("if(g.built)"),'render physical granary separately from unfinished project');
 assert.ok(styles.includes('.sw.granary'));
 assert.ok(styles.includes('overflow:hidden'),'fixed viewport remains in use');
 assert.equal(agriculture.granary.woodRequired,6);
 assert.equal(agriculture.granary.stoneRequired,4);
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

test('Priest and Saint are distinct map roles; only collected petitions display clickable bubbles',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const viewport=fs.readFileSync(path.join(root,'assets/viewport.css'),'utf8');
 assert.ok(html.includes('sw saint')&&html.includes('sw priest'),
   'special roles must be visible in the map legend');
 assert.ok(app.includes("saint?'#80e4eb':priest?'#c4a2fa'"),'separate role colors');
 assert.ok(app.includes('priestBubblePosition')&&app.includes('S.priestPetitions(state,id)'),
   'real collected petitions must gate the bubble');
 assert.ok(app.includes("activePriestId=marked.id;showInspector('needs')"),
   'a bubble click opens its Priest prayer information');
 assert.ok(app.includes('priestPetitionIndex')&&app.includes('data-priest-nav'),
   'all collected petition types must remain navigable without scrolling');
 assert.ok(viewport.includes('.priest-prayer-nav')&&viewport.includes('.sw.priest'));
 assert.ok(viewport.includes('html,body{height:100%;max-height:100%;overflow:hidden}'));
});

test('the selected Divine Power is routed through typed Miracle and Oracle actions',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  const profile=require('../config/divine-powers-v0.1.json');
  assert.equal(profile.profileId,'divine-powers-v0.1');
  assert.equal(Object.keys(profile.powers).length,8);
  for(const id of ['miracleName','miracleHint','oracleName','oracleHint','durationLabel'])
    assert.ok(html.includes('id="'+id+'"'),'missing live power UI '+id);
  for(const type of ['ripening','harvest','heal','efficiency','drought','lightning','confusion','blindness','religion.spread'])
    assert.ok(app.includes(type),'power option is missing '+type);
  assert.ok(app.includes("S.castMiracle(state,id,{x,y,...opts()})"),'map cast must use selected type');
  assert.ok(app.includes("S.issueOracle(state,{saintId:selectedSaintId,intentType:selectedPower()})"),
    'Oracle issuer must use the selected intent');
  assert.ok(app.includes("S.evaluateMiracle(state,id"),'preview must match selected Miracle');
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
  assert.ok(app.includes('selectedNeedId')&&app.includes('currentNeed()'));
  assert.ok(app.includes("loc.radius*size"),'the requested field radius must be drawn');
  assert.ok(app.includes('cursor||currentNeed()?.location?.center||state.camp'),
    'a located request becomes the preview anchor until the pointer moves');
  assert.ok(sim.includes('function prayerLocation('));
  assert.ok(css.includes('.need-locate-card')&&css.includes('.need-pager'));
  assert.ok(css.includes('html,body{height:100%;max-height:100%;overflow:hidden}'),
    'global page must remain non-scrolling');
});
