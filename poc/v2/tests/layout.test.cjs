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
});
test('Original defaults are preserved without applying experimental numbers',()=>{
 const original=require('../config/balance-default.json');
 assert.deepEqual(W.DEFAULT_RULES,original.rules);
});
