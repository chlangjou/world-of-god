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
