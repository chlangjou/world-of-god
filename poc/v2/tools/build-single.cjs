'use strict';
// Optional standalone export. Do not edit or commit generated dist/ artifacts.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let html=read('index.html');
for(const p of ['assets/style-base.css','assets/viewport.css','assets/file-menu.css']){
 const marker='<link rel="stylesheet" href="'+p+'">';
 if(!html.includes(marker))throw Error('Missing '+marker);
 html=html.replace(marker,'<style>\n'+read(p)+'\n</style>');
}
const profile=JSON.stringify(JSON.parse(read('config/balance-agriculture-v0.1.json'))).replace(/</g,'\\u003c');
const religion=JSON.stringify(JSON.parse(read('config/religion-propagation-v0.1.json'))).replace(/</g,'\\u003c');
const mobility=JSON.stringify(JSON.parse(read('config/mobility-contact-v0.1.json'))).replace(/</g,'\\u003c');
const divine=JSON.stringify(JSON.parse(read('config/divine-powers-v0.1.json'))).replace(/</g,'\\u003c');
const opponent=JSON.stringify(JSON.parse(read('config/opponent-v0.2.json'))).replace(/</g,'\\u003c');
const oracleStrategy=JSON.stringify(JSON.parse(read('config/oracle-specialization-v0.1.json'))).replace(/</g,'\\u003c');
const playtest=JSON.stringify(JSON.parse(read('config/playable-evidence-v0.1.json'))).replace(/</g,'\\u003c');
const shrine=JSON.stringify(JSON.parse(read('config/shrine-temple-v0.1.json'))).replace(/</g,'\\u003c');
const scripts='<script>window.WOG_RELIGION_PROFILE='+religion+';</'+'script>'+ 
  '<script>window.WOG_AGRICULTURE_PROFILE='+profile+';</'+'script>'+
  '<script>window.WOG_MOBILITY_PROFILE='+mobility+';</'+'script>'+
  '<script>window.WOG_DIVINE_PROFILE='+divine+';</'+'script>'+
  '<script>window.WOG_OPPONENT_PROFILE='+opponent+';</'+'script>'+
  '<script>window.WOG_ORACLE_STRATEGY_PROFILE='+oracleStrategy+';</'+'script>'+
  '<script>window.WOG_PLAYTEST_PROFILE='+playtest+';</'+'script>'+ 
  '<script>window.WOG_SHRINE_PROFILE='+shrine+';</'+'script>'+ 
  '<script>\n'+read('src/mobility.js')+'\n</'+'script>'+ 
  '<script>\n'+read('src/shrine-temple.js')+'\n</'+'script>'+ 
  '<script>\n'+read('src/sim.js')+'\n</'+'script>'+
  '<script>\n'+read('src/playtest.js')+'\n</'+'script>'+
  '<script>\n'+read('src/app.js')+'\n</'+'script>';
const marker='<script src="src/mobility.js"></script><script src="src/shrine-temple.js"></script><script src="src/sim.js"></script><script src="src/playtest.js"></script><script src="src/app.js"></script>';
if(!html.includes(marker))throw Error('Missing JS entrypoints');
html=html.replace(marker,scripts);
const folder=path.join(root,'dist');
fs.mkdirSync(folder,{recursive:true});
const output=path.join(folder,'World-of-God-PoC-v2.html');
fs.writeFileSync(output,html,'utf8');
console.log('Optional offline bundle: '+output);
