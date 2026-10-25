'use strict';
// Optional standalone export. Do not edit or commit generated dist/ artifacts.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const mode=process.argv.slice(2);
if(mode.some(arg=>!['--release','--check'].includes(arg))||mode.length>1)
 throw Error('Usage: node tools/build-single.cjs [--release|--check]');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
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
const victory=JSON.stringify(JSON.parse(read('config/victory-dominance-v0.1.json'))).replace(/</g,'\\u003c');
const polity=JSON.stringify(JSON.parse(read('config/polity-command-v0.1.json'))).replace(/</g,'\\u003c');
const minerals=JSON.stringify(JSON.parse(read('config/mineral-rights-experiment-v0.1.json'))).replace(/</g,'\\u003c');
const mineralP15=JSON.stringify(JSON.parse(read('config/mineral-rights-p1-5-v0.1.json'))).replace(/</g,'\\u003c');
const mineralP2=JSON.stringify(JSON.parse(read('config/mineral-rights-p2-v0.1.json'))).replace(/</g,'\\u003c');
const scripts='<script>window.WOG_RELIGION_PROFILE='+religion+';</'+'script>'+ 
  '<script>window.WOG_AGRICULTURE_PROFILE='+profile+';</'+'script>'+
  '<script>window.WOG_MOBILITY_PROFILE='+mobility+';</'+'script>'+
  '<script>window.WOG_DIVINE_PROFILE='+divine+';</'+'script>'+
  '<script>window.WOG_OPPONENT_PROFILE='+opponent+';</'+'script>'+
  '<script>window.WOG_ORACLE_STRATEGY_PROFILE='+oracleStrategy+';</'+'script>'+
  '<script>window.WOG_PLAYTEST_PROFILE='+playtest+';</'+'script>'+ 
  '<script>window.WOG_SHRINE_PROFILE='+shrine+';</'+'script>'+ 
  '<script>window.WOG_VICTORY_PROFILE='+victory+';</'+'script>'+ 
  '<script>window.WOG_POLITY_PROFILE='+polity+';</'+'script>'+
  '<script>window.WOG_MINERAL_RIGHTS_PROFILE='+minerals+';</'+'script>'+
  '<script>window.WOG_MINERAL_P1_5_PROFILE='+mineralP15+';</'+'script>'+
  '<script>window.WOG_MINERAL_P2_PROFILE='+mineralP2+';</'+'script>'+
  '<script>\n'+read('src/mobility.js')+'\n</'+'script>'+ 
  '<script>\n'+read('src/shrine-temple.js')+'\n</'+'script>'+ 
  '<script>\n'+read('src/victory.js')+'\n</'+'script>'+ 
  '<script>\n'+read('src/politics.js')+'\n</'+'script>'+
  '<script>\n'+read('src/sim.js')+'\n</'+'script>'+
  '<script>\n'+read('src/playtest.js')+'\n</'+'script>'+
  '<script>\n'+read('src/living-world.js')+'\n</'+'script>'+
  '<script>\n'+read('src/app.js')+'\n</'+'script>';
const marker='<script src="src/mobility.js"></script><script src="src/shrine-temple.js"></script><script src="src/victory.js"></script><script src="src/politics.js"></script><script src="src/sim.js"></script><script src="src/playtest.js"></script><script src="src/living-world.js"></script><script src="src/app.js"></script>';
if(!html.includes(marker))throw Error('Missing JS entrypoints');
html=html.replace(marker,scripts);
const release=path.join(root,'World-of-God-Playable.html');
if(mode.includes('--check')){
 if(!fs.existsSync(release)||read('World-of-God-Playable.html')!==html){
  console.error('Offline playable HTML is stale. Run npm run build:playable and include World-of-God-Playable.html with the source changes.');
  process.exitCode=1;
 }else console.log('Offline playable matches current sources and profiles.');
 return;
}
if(mode.includes('--release')){
 fs.writeFileSync(release,html,'utf8');
 console.log('Offline playable released: '+release);
 return;
}
const folder=path.join(root,'dist');
fs.mkdirSync(folder,{recursive:true});
const output=path.join(folder,'World-of-God-PoC-v2.html');
fs.writeFileSync(output,html,'utf8');
console.log('Optional offline bundle: '+output);
