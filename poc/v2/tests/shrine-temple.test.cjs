'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../src/shrine-temple.js');
const W=require('../src/sim.js');

function fixture(){
 const p1={id:'p1',householdId:'h1',settlementId:'s1',religionId:'r1',
  devotion:80,alive:true,stage:'adult',health:100,hunger:0,
  activity:'pray',proficiency:{build:.5},x:7,y:8};
 const p2={...p1,id:'p2',householdId:'h2',x:9,y:8};
 const h1={id:'h1',x:7,y:8,home:true,members:['p1'],
  inventory:{food:30,wood:4,stone:2,fiber:0}};
 const h2={id:'h2',x:9,y:8,home:true,members:['p2'],
  inventory:{food:30,wood:4,stone:2,fiber:0}};
 const s={seed:'temple-test',width:22,height:22,tiles:Array.from({length:22*22},
    ()=>({terrain:'meadow'})),hour:24,tick:3,people:[p1,p2],
   households:[h1,h2],settlements:[{id:'s1',x:8,y:8,
     householdIds:['h1','h2'],storage:{wood:20,stone:10,food:100,fiber:10}}],
   religion:{id:'r1',godId:'g1',priests:['p2'],oracles:[]},opponentReligion:null,
   god:{id:'g1',dp:35},counts:{},contactLog:[],
   mobility:{enabled:true,fordSpacing:16,stepsPerTick:7},
   religiousSites:[],shrineTemple:T.normalize({...T.BASE,enabled:true,
     attendanceInformal:.8,attendanceShrine:.8,attendanceTemple:.8,
     shrineVisits:6,templeVisits:18,templeMinDistinct:2,shrineWork:1,templeWork:2})};
 return s;
}
test('site emerges from actual local prayer, then attendance creates an affordable Shrine',()=>{
 const s=fixture(),logs=[];
 T.daily(s,(state,kind,text)=>logs.push({kind,text}));
 assert.equal(s.religiousSites.length,1);
 const site=s.religiousSites[0];
 assert.equal(site.stage,'gathering');
 assert.equal(site.proposed,null);
 assert.equal(s.god.dp,35);
 for(let day=2;day<=8;day++){
   s.hour=day*24+16;
   assert.equal(T.attend(s,s.people[0]),true);
   assert.equal(T.attend(s,s.people[1]),true);
   assert.equal(s.people[0].religiousVisit.siteId,site.id);
   assert.ok(s.people[0].mobilityTrace.length>=2);
   s.hour=(day+1)*24;
   T.daily(s,()=>{});
 }
 assert.equal(site.proposed,'shrine');
 const woodBefore=s.settlements[0].storage.wood;
 assert.equal(T.candidates(s,s.people[0],s.settlements[0],10)?.id,site.id);
 assert.equal(T.build(s,s.people[0],s.households[0],s.settlements[0],
   site,1,()=>{}),true);
 assert.equal(site.stage,'shrine');
 assert.equal(s.settlements[0].storage.wood,woodBefore-s.shrineTemple.shrineWood);
 assert.equal(s.god.dp,35);
 assert.deepEqual(s.people.map(p=>p.devotion),[80,80]);
 assert.ok(logs.some(x=>x.text.includes('祈禱')));
});
test('Temple upgrade requires sustained attendance and real paid labor; no free power',()=>{
 const s=fixture();T.daily(s,()=>{});
 const site=s.religiousSites[0],town=s.settlements[0];
 for(let day=2;day<=17;day++){
   s.hour=day*24+16;
   for(const p of s.people)T.attend(s,p);
   s.hour=(day+1)*24;T.daily(s,()=>{});
   if(site.proposed==='shrine'&&site.stage!=='shrine')
     T.build(s,s.people[0],s.households[0],town,site,2,()=>{});
 }
 assert.equal(site.stage,'shrine');
 assert.equal(site.proposed,'temple');
 const stoneBefore=town.storage.stone,dp=s.god.dp;
 for(let i=0;i<2&&site.stage!=='temple';i++)
   assert.equal(T.build(s,s.people[0],s.households[0],town,site,2,()=>{}),true);
 assert.equal(site.stage,'temple');
 assert.equal(town.storage.stone,stoneBefore-s.shrineTemple.templeStone);
 assert.equal(s.god.dp,dp);
 assert.deepEqual(T.validate(s),[]);
});
test('outsider visits need prior attributable evidence, not a building radius buff',()=>{
 const s=fixture();T.daily(s,()=>{});
 const stranger={...s.people[0],id:'p3',religionId:'r2',devotion:60,householdId:'h3',
   activity:'family',x:10,y:8};
 s.people.push(stranger);s.households.push({id:'h3',x:10,y:8,home:true,members:['p3'],
   inventory:{food:20,wood:0,stone:0,fiber:0}});
 s.settlements[0].householdIds.push('h3');
 s.opponentReligion={id:'r2',godId:'g2',priests:[],oracles:[]};
 assert.equal(T.attend(s,stranger),false);
 stranger.lastStrategyEncounter={challengerReligionId:'r1',hour:s.hour};
 let visits=0;
 for(let day=1;day<=60;day++){
   s.hour=day*24+16;
   if(T.attend(s,stranger))visits++;
 }
 assert.ok(visits>0,'credible prior encounter permits voluntary physical follow-up');
 assert.equal(stranger.religionId,'r2','Temple attendance cannot convert directly');
});
test('Temple cores cannot overlap, but distinct religious activities can coexist',()=>{
 const s=fixture();T.daily(s,()=>{});
 const first=s.religiousSites[0];first.stage='temple';
 s.religiousSites.push({...first,id:'rs2',religionId:'r2',x:first.x+1,visits:[]});
 s.opponentReligion={id:'r2',godId:'g2',priests:[],oracles:[]};
 assert.ok(T.validate(s).includes('Temple Core 重疊'));
 s.religiousSites[1].stage='shrine';
 assert.ok(!T.validate(s).includes('Temple Core 重疊'));
});
test('precision Lightning destroys a Temple at the struck core without an abstract faith penalty',()=>{
 const s=fixture();T.daily(s,()=>{});
 const site=s.religiousSites[0];
 site.stage='temple';
 s.shrineTemple.precisionLightningEnabled=true;
 const priorDevotion=s.people.map(p=>p.devotion);
 const priorDp=s.god.dp;
 assert.equal(T.strike(s,{x:site.x+3,y:site.y},1,()=>{}),0);
 assert.equal(site.stage,'temple');
 assert.equal(T.strike(s,{x:site.x,y:site.y},1,()=>{}),1);
 assert.equal(site.stage,'ruin');
 assert.equal(site.condition,0);
 assert.deepEqual(s.people.map(p=>p.devotion),priorDevotion);
 assert.equal(s.god.dp,priorDp,'World module never bypasses Miracle DP cost');
 assert.deepEqual(T.validate(s),[]);
});
test('actual W.castMiracle applies one-cell lightning, pays DP and respects Presence',()=>{
 const s=W.create({seed:'temple-precision-integration',
   shrineProfile:{...T.BASE,enabled:true,precisionLightningEnabled:true}});
 const p=s.people.find(p=>p.religionId===s.religion.id);
 const site={id:'rs-test',townId:'s1',religionId:s.religion.id,x:Math.round(p.x),
   y:Math.round(p.y),stage:'temple',condition:100,visits:[],proposed:null};
 s.religiousSites.push(site);s.god.dp=s.god.cap;
 const pos={x:site.x,y:site.y,intensity:1,radius:12};
 const check=W.evaluateMiracle(s,'lightning',pos);
 assert.equal(check.radius,1,'new world locks direct strike radius even if caller requests 12');
 assert.equal(check.ok,true,check.reason);
 const initial=s.god.dp;
 const result=W.castMiracle(s,'lightning',pos);
 assert.equal(result.ok,true);
 assert.equal(site.stage,'ruin');
 assert.ok(s.god.dp<initial,'a real miracle must spend power');
 const unsupported=W.evaluateMiracle(s,'lightning',{x:0,y:0,intensity:1,radius:1});
 assert.equal(unsupported.ok,false,'high dominance alone without density is insufficient');
});
test('simulation events identify the caster independently from their kind',()=>{
 const opponent=require('../config/opponent-v0.2.json');
 const s=W.create({seed:'event-source-world',opponentProfile:opponent});
 s.god.dp=s.god.cap;s.opponentGod.dp=s.opponentGod.cap;
 const at={x:s.camp.x,y:s.camp.y,radius:3,intensity:.7,durationDays:2};
 assert.equal(W.castRain(s,at).ok,true);
 const player=s.events.at(-1);
 assert.equal(player.kind,'miracle');
 assert.equal(player.godId,s.god.id);
 assert.equal(W.castRain(s,{...at,godId:s.opponentGod.id}).ok,true);
 const enemy=s.events.at(-1);
 assert.equal(enemy.kind,'miracle');
 assert.equal(enemy.godId,s.opponentGod.id);
});
test('temple attack event belongs to the attacking God, not the destroyed faith',()=>{
 const s=fixture();T.daily(s,()=>{});
 const site=s.religiousSites[0];site.stage='temple';
 s.shrineTemple.precisionLightningEnabled=true;
 const events=[];
 T.strike(s,{x:site.x,y:site.y},1,(state,kind,text,reasons,entities,godId)=>
   events.push({kind,godId}),'g2');
 assert.equal(site.stage,'ruin');
 assert.equal(events[0].kind,'religion');
 assert.equal(events[0].godId,'g2');
});
test('opt-in is isolated, saves keep lifecycle and old saves stay disabled',()=>{
 const world=W.create({seed:'shrine-integration',shrineProfile:{...T.BASE,enabled:true}});
 assert.equal(world.shrineTemple.enabled,true);
 assert.equal(W.validate(world).ok,true);
 W.advanceTicks(world,9);
 assert.equal(W.validate(world).ok,true);
 const restored=W.restore(JSON.stringify(world));
 assert.equal(restored.shrineTemple.enabled,true);
 assert.deepEqual(restored.religiousSites,world.religiousSites);
 const legacy=W.create({seed:'legacy-shrine'});
 assert.equal(legacy.shrineTemple.enabled,false);
 assert.equal(W.restore(JSON.stringify(legacy)).shrineTemple.enabled,false);
});
test('browser and standalone build include Shrine runtime and editable profile',()=>{
 const root=path.resolve(__dirname,'..');
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.ok(read('index.html').includes('src/shrine-temple.js'));
 assert.ok(read('src/app.js').includes('loadShrine()'));
 assert.ok(read('src/app.js').includes('state.religiousSites'));
 assert.ok(read('tools/build-single.cjs').includes('WOG_SHRINE_PROFILE'));
 assert.equal(JSON.parse(read('config/shrine-temple-v0.1.json')).enabled,true);
});
