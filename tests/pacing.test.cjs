'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), C=require('../core.js');
function ui(preset='valley',difficulty='relaxed',seed='river-dawn-01') {
 return C.create({preset,difficulty,seed,belief:.28,moisture:preset==='dry'?.28:preset==='islands'?.7:.65,food:preset==='dry'?45:80});
}
function waitFor(s,cost){let ticks=0;while(s.power+1e-9<cost && ticks<2000){C.step(s);ticks++}assert.ok(ticks<2000);return ticks/2;}
test('actual UI presets recover after two quick miracles within easy pacing budget',()=>{
 for(const preset of Object.keys(C.presets))for(const second of ['rain','bless']){
  const s=ui(preset);C.act(s,'rain','town-1');C.act(s,second,'town-2');
  assert.equal(s.power,second==='rain'?2:6);
  const sec=waitFor(s,18);assert.ok(sec>=5&&sec<=15,`${preset}/${second}: ${sec}s`);
 }
});
test('normal and hard deliberately extend refill without changing autonomous people',()=>{
 for(const preset of Object.keys(C.presets)){
  const seconds=['relaxed','standard','scarce'].map(d=>{const s=ui(preset,d);C.act(s,'rain','town-1');C.act(s,'rain','town-2');return waitFor(s,18)});
  assert.ok(seconds[0]<seconds[1]&&seconds[1]<seconds[2]);assert.ok(seconds[1]>=18&&seconds[1]<=30);assert.ok(seconds[2]>=35&&seconds[2]<=55);
 }
});
test('zero-faith easy has a 24-second rain safety net, costs and cap still bind',()=>{
 const s=ui();s.people.forEach(p=>p.faith=0);s.power=0;
 assert.equal(waitFor(s,18),24);assert.equal(C.act(s,'rain','town-1').ok,true);
 assert.equal(C.act(s,'rain','town-1').ok,false);C.step(s,500);assert.equal(s.power,100);
 let casts=0;while(C.act(s,'rain','town-1').ok)casts++;assert.equal(casts,5);
});
test('30-minute unattended worlds retain faith, food and autonomy across all difficulties',()=>{
 for(const preset of Object.keys(C.presets))for(const difficulty of ['relaxed','standard','scarce'])for(const seed of ['river-dawn-01','test-seed','quiet-morning']){
  const s=ui(preset,difficulty,seed),initial=C.stats(s).averageFaith;let minimum=initial,peakHunger=0;
  for(let i=0;i<3600;i++){C.step(s);if(i%12===0){const st=C.stats(s);minimum=Math.min(minimum,st.averageFaith);peakHunger=Math.max(peakHunger,st.averageHunger)}}
  const st=C.stats(s);assert.ok(minimum>=initial-.060001);assert.ok(st.averageFaith>=initial-.02);assert.ok(st.food>0);assert.ok(st.averageHunger<.3);assert.ok(s.towns.every(t=>t.harvested>0&&t.foraged>0));assert.ok(C.validateSave(s).ok);
  if(preset==='dry')assert.ok(peakHunger>.2,'drought still creates pressure');
 }
});
test('10-minute playful intervention loop remains funded without high-frequency clicking',()=>{
 for(const preset of Object.keys(C.presets)){
  const s=ui(preset);let casts=0;
  for(let tick=0;tick<1200;tick++){
   if(tick%40===0){assert.equal(C.act(s,casts%2?'bless':'rain',casts%4<2?'town-1':'town-2').ok,true);casts++}
   C.step(s);
  }
  assert.equal(casts,30);assert.ok(C.stats(s).averageFaith>.28);assert.ok(C.validateSave(s).ok);
 }
});
test('hardship doubt is bounded, reversible, and does not create faith from zero',()=>{
 const s=ui();s.people.forEach(p=>{p.faith=0;p.hardshipDoubt=0;p.hunger=1});s.towns.forEach(t=>t.food=0);
 C.step(s,2);assert.ok(s.people.every(p=>p.faith===0&&p.hardshipDoubt===0));
 s.people.forEach(p=>{p.faith=.4;p.hardshipDoubt=.06;p.hunger=.1});s.towns.forEach(t=>t.food=1000);
 C.step(s,100);assert.ok(s.people.every(p=>p.hardshipDoubt<1e-9&&p.faith>=.459999));
 s.people[0].hardshipDoubt=.07;assert.equal(C.validateSave(s).ok,false);
});
test('legacy version-1 saves keep state and adopt current rates without resetting faith',()=>{
 const old=ui('dry');old.ruleset='wog-1';old.power=2;old.people.forEach(p=>delete p.hardshipDoubt);
 const roundTrip=JSON.parse(JSON.stringify(old));assert.ok(C.validateSave(roundTrip).ok);
 assert.ok(C.stats(roundTrip).powerRate>.5);const before=roundTrip.people.map(p=>p.faith);
 C.step(old);C.step(roundTrip);assert.deepEqual(old,roundTrip);assert.equal(roundTrip.ruleset,'wog-1-pacing');
 assert.ok(roundTrip.people.every((p,i)=>p.faith>=before[i]-.001));assert.ok(C.validateSave(roundTrip).ok);
});
test('remote rain has no faith effect; repeated signs never grant free infinite faith',()=>{
 const a=ui(),b=ui();C.act(a,'rain',{x:0,y:0});C.step(a,25);C.step(b,25);assert.deepEqual(a.people,b.people);
 const s=ui();C.act(s,'rain','town-1');C.act(s,'rain','town-1');const before=s.people.map(p=>p.faith);
 for(let i=0;i<100;i++)assert.equal(C.act(s,'rain','town-1').ok,false);
 C.step(s,25);s.people.forEach((p,i)=>assert.ok(p.faith-before[i]<=.05+25*.0006+1e-9));
});
test('lasting oracle evidence reaches conviction beneath doubt; positive gains respect cap',()=>{
 const s=ui(),p=s.people[0],t=s.towns[0];
 // Obtain a valid failed-oracle history, then isolate a resident's evaluation.
 s.power=100;C.act(s,'oracle',t.id);C.step(s,150);
 t.oracle.outcome='failed';t.oracle.stage='consequences';
 p.faith=.001;p.hardshipDoubt=.06;p.hunger=.45;p.task='resting';p.nextDecision=s.tick+1000;p.traits.independence=0;p.lastOracle=null;
 C.step(s);assert.ok(Math.abs(p.faith+p.hardshipDoubt-.029)<1e-9);
 p.hunger=.1;t.food=1000;C.step(s,100);assert.ok(Math.abs(p.faith-.029)<1e-9);assert.ok(p.hardshipDoubt<1e-9);
 p.faith=.94;p.hardshipDoubt=.06;p.hunger=.45;p.task='praying';p.nextDecision=s.tick+1000;
 C.step(s);assert.ok(p.faith+p.hardshipDoubt<=1+1e-9);
 p.hunger=.1;p.task='resting';t.food=1000;C.step(s,100);assert.ok(p.hardshipDoubt<1e-9);assert.ok(Math.abs(p.faith-1)<1e-9);
});
