'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Art=require('../src/character-art.js');
const {boot}=require('./browser-harness.cjs');
const root=path.resolve(__dirname,'..');
const person=(id,stage='adult',age=28,activity='rest',health=100)=>
  ({id,stage,age,activity,health,hunger:0,alive:true});
function ctx(){
  const log={fills:[],paths:0,ellipses:0,scales:[],translates:[]};
  const record={};
  const context=new Proxy(record,{
    set(obj,key,value){obj[key]=value;if(key==='fillStyle')log.fills.push(value);return true;},
    get(obj,key){
      if(key==='scale')return (...args)=>log.scales.push(args);
      if(key==='translate')return (...args)=>log.translates.push(args);
      if(key==='fill'||key==='stroke')return ()=>{log.paths++;};
      if(key==='ellipse')return (...args)=>{log.ellipses++;};
      return key in obj?obj[key]:()=>{};
    }
  });
  return {context,log};
}
test('six distinct archetype silhouettes use existing stage/role truth, never invent a new mood or person',()=>{
  const cases=[
    [person('child','child',9),'child',{}],
    [person('older','elder',72),'elder',{}],
    [person('clergy'),'priest',{priest:true}],
    [person('militia'),'soldier',{soldier:true}],
  ];
  for(const [p,expected,roles] of cases)
    assert.equal(Art.archetype(p,roles),expected);
  let a,b;
  for(let i=0;i<150;i++){
    const p=person('adult-'+i);
    const type=Art.archetype(p,{});
    if(type==='adult-a'&&!a)a=p;
    if(type==='adult-b'&&!b)b=p;
  }
  assert.ok(a&&b);
  assert.equal(Art.archetype(a),'adult-a');
  assert.equal(Art.archetype(b),'adult-b');
  const types=new Set([...cases.map(x=>Art.archetype(x[0],x[2])),Art.archetype(a),Art.archetype(b)]);
  assert.equal(types.size,6);
});
test('hair, clothing and palette identity persist across actions/roles and save replays',()=>{
  const p=person('p108','adult',32),baseline=JSON.stringify(p);
  const original=Art.identity(p);
  for(const activity of ['rest','travel','pray','farm']){
    p.activity=activity;
    for(const roles of [{priest:true},{soldier:true},{saint:true},{}]){
      const chosen=Art.appearance(p,roles);
      for(const key of ['id','hair','skin','fabric','hairStyle','clothing','accentStyle','hash'])
        assert.equal(chosen[key],original[key]);
      assert.equal(Art.appearance(JSON.parse(JSON.stringify(p)),roles).hair,original.hair);
    }
  }
  p.activity='rest';
  assert.equal(JSON.stringify(p),baseline);
  assert.ok(original.hairStyle>=0&&original.hairStyle<4);
});
test('faith, age, action, wound and true Heal success change drawing states without changing simulator person',()=>{
  const samples=[
    [person('p1'),{},'adult'],
    [person('p2','child',9),{},'child'],
    [person('p3','elder',72),{},'elder'],
    [person('p4'),{priest:true,faithColor:'#ab6d6a'},'priest'],
    [person('p5'),{soldier:true},'soldier'],
    [person('p6','adult',21,'pray'),{saint:true},'adult'],
    [person('p7','adult',21,'travel'),{moving:true},'adult'],
    [person('p8','adult',21,'farm'),{},'adult'],
    [person('p9','adult',21,'rest',35),{healed:true},'adult'],
    [person('p10','adult',21,'rest',99),{healed:true},'adult']
  ];
  const signatures=[];
  for(const [p,opts,typePrefix] of samples){
    const saved=JSON.stringify(p);
    const {context,log}=ctx();
    const shown=Art.draw(context,p,100,100,64,1.5,opts);
    assert.ok(shown.type.startsWith(typePrefix),'wrong type '+shown.type);
    assert.ok(log.fills.length>=12,'visual must contain multiple shapes and colors');
    assert.ok(log.ellipses>=3,'sprite should have a head, facial features and footprint');
    assert.ok(log.paths>6,'sprite needs layered outlines/accessories');
    assert.equal(JSON.stringify(p),saved,'drawing may not alter a person or the world');
    signatures.push(shown);
  }
  assert.equal(signatures[8].wounded,true);
  assert.equal(signatures[8].healed,false,'a wounded person cannot fake recovery');
  assert.equal(signatures[9].healed,true);
  assert.ok(signatures[6].walking);
  assert.ok(signatures[7].working);
  assert.ok(signatures[5].praying);
  assert.ok(signatures[3].priest);
  assert.ok(signatures[4].soldier);
});
test('pure painting does not call the simulation RNG or add any mood state',()=>{
  const p=person('persistent-id','adult',38,'travel',91);
  p.devotion=47;p.religionId='r1';p.health=91;p.hunger=.2;
  const snapshot=JSON.stringify(p);
  for(let f=0;f<15;f++){
    const {context}=ctx();
    const shown=Art.draw(context,p,34,75,96,f/30,{faithColor:'#93c0c9',moving:true});
    assert.ok(!('mood' in shown)&&!('mood' in p));
  }
  assert.equal(JSON.stringify(p),snapshot);
});
test('the actual web view uses character art only at close zoom, preserving distant strategy icons',async()=>{
  const ui=await boot(),world=ui.world(),before=JSON.stringify(world);
  const old=Art.draw;
  let calls=0;
  try{
    Art.draw=function(...args){calls++;return old(...args);};
    ui.draw();
    assert.equal(calls,0,'overview must remain light-weight icon map');
    ui.el('followPersonBtn').onclick();
    assert.ok(ui.camera().zoom>=4);
    assert.ok(calls>0,'close view must use new sprite renderer for real residents');
    const near=calls;
    ui.el('zoomResetBtn').onclick();
    ui.draw();
    assert.equal(calls,near,'reset to overview must stop using close-up sprite renderer');
    assert.equal(JSON.stringify(world),before,'art and camera are purely visual');
  }finally{Art.draw=old;}
});
test('the gallery previews the exact runtime sprite module and the offline game bundles it',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const gallery=fs.readFileSync(path.join(root,'character-gallery.html'),'utf8');
  const build=fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8');
  assert.ok(html.indexOf('src/character-art.js')<html.indexOf('src/app.js')&&
    html.indexOf('src/character-art.js')>=0);
  assert.match(gallery,/src\/character-art\.js/);
  assert.match(gallery,/Art\.draw\(ctx,who/);
  assert.match(build,/read\('src\/character-art\.js'\)/);
  assert.match(html,/src\/living-world\.js/);
});
