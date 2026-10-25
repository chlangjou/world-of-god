'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../src/living-world.js');
const {boot}=require('./browser-harness.cjs');

const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,a+' !== '+b);
const residents=n=>Array.from({length:n},(_,i)=>({id:'p'+(i+1),name:'Resident '+(i+1),
  x:22.2,y:19.4,alive:true,health:100,activity:'rest',stage:'adult'}));

test('2, 5 and 10 real residents at 1×, 4× and 8× use stable visible placements and a truthful count',()=>{
  for(const n of [2,5,10])for(const zoom of [1,4,8]){
    const people=residents(n),before=JSON.stringify(people),slots=new Map();
    const poses=new Map(people.map(p=>[p.id,{x:p.x,y:p.y}]));
    const layout=L.arrangeCrowds(people,poses,zoom,slots);
    const visible=[...layout.sprites.values()].filter(v=>v.visible);
    const capacity=zoom===1?1:zoom===4?5:8;
    assert.equal(visible.length,Math.min(n,capacity));
    assert.equal(layout.groups.length,1);
    assert.equal(layout.groups[0].count,n);
    assert.equal(layout.groups[0].ids.length,n,'no real citizen may disappear from roster');
    const cam=L.createCamera(64,64);
    cam.zoom=zoom;L.focus(cam,22.5,19.5);
    const badge=L.crowdBadge(cam,layout.groups[0],768,768);
    assert.equal(L.hitCrowd(layout.groups,cam,badge.x,badge.y,768,768)?.count,n);
    const coords=visible.map(p=>L.toScreen(cam,p.x+.5,p.y+.5,768,768));
    if(zoom>1)for(let a=0;a<coords.length;a++)for(let b=a+1;b<coords.length;b++)
      assert.ok(Math.hypot(coords[a].x-coords[b].x,coords[a].y-coords[b].y)>11,
        'rendered residents must not collapse into the same hit area');
    for(let i=0;i<visible.length;i++){
      const hit=L.hitCharacter(layout.sprites,cam,coords[i].x,coords[i].y,768,768);
      assert.equal(hit?.id,visible[i].id,'each shown human must have their own hit target');
      if(zoom>1)assert.ok(visible[i].scale<1,'crowded sprites should shrink at close zoom');
    }
    const repeat=L.arrangeCrowds([...people].reverse(),poses,zoom,slots);
    for(const person of visible){
      const same=repeat.sprites.get(person.id);
      near(same.x,person.x);near(same.y,person.y);
    }
    assert.equal(JSON.stringify(people),before,'layout and hits cannot mutate the sim');
  }
});

test('a hidden resident becomes visible and retains a distinct slot when selected',()=>{
  const people=residents(10),slots=new Map(),poses=new Map();
  for(const p of people)poses.set(p.id,p);
  const baseline=L.arrangeCrowds(people,poses,8,slots);
  assert.equal(baseline.sprites.get('p10').visible,false);
  const selected=L.arrangeCrowds(people,poses,8,slots,'p10');
  assert.equal(selected.sprites.get('p10').visible,true);
  const shown=[...selected.sprites.values()].filter(p=>p.visible);
  assert.equal(shown.length,8);
  const seen=new Set(shown.map(p=>p.slot));
  assert.equal(seen.size,8,'every visible resident needs a distinct slot');
});

test('new arrivals do not reorder existing avatar positions across ticks',()=>{
  const slots=new Map(),first=residents(5),pose=new Map(first.map(p=>[p.id,p]));
  const initial=L.arrangeCrowds(first,pose,4,slots);
  const sixth={...first[0],id:'p6'},later=[...first,sixth];
  pose.set(sixth.id,sixth);
  const after=L.arrangeCrowds(later,pose,4,slots);
  for(const id of ['p1','p2','p3','p4','p5']){
    near(after.sprites.get(id).x,initial.sprites.get(id).x);
    near(after.sprites.get(id).y,initial.sprites.get(id).y);
  }
  const movedPose=new Map(pose);
  movedPose.set('p1',{x:first[0].x+2,y:first[0].y+1,moving:true});
  const motion=L.arrangeCrowds(first,movedPose,4,slots).sprites.get('p1');
  near(motion.x-initial.sprites.get('p1').x,2);
  near(motion.y-initial.sprites.get('p1').y,1);
});

function quietTile(state,ids){
  for(let y=9;y<state.height-9;y++)for(let x=9;x<state.width-9;x++){
    const other=state.people.filter(p=>p.alive&&!ids.has(p.id));
    if(other.some(p=>Math.hypot(x-p.x,y-p.y)<4))continue;
    if(state.settlements.some(p=>Math.hypot(x-p.x,y-p.y)<5))continue;
    return {x,y};
  }
  throw Error('normal world has no available tile to isolate the visible presentation fixture');
}
async function worldCrowd(n){
  const ui=await boot(),s=ui.world(),group=s.people.filter(p=>p.alive).slice(0,n);
  assert.equal(group.length,n);
  const tile=quietTile(s,new Set(group.map(p=>p.id)));
  for(const p of group){p.x=tile.x+.2;p.y=tile.y+.2;}
  ui.render();
  return {ui,s,group,tile};
}
function pointFor(ui,entry){
  return L.toScreen(ui.camera(),entry.x+.5,entry.y+.5,768,768);
}
function click(ui,p){ui.canvas.listeners.click({clientX:p.x,clientY:p.y});}
function groupBadge(ui){
  const g=ui.crowds().groups.find(x=>x.ids.includes('p1'));
  assert.ok(g);
  return L.crowdBadge(ui.camera(),g,768,768);
}
function zoomToGroup(ui,id){
  ui.el('residentSelect').onchange({target:{value:id}});
  ui.el('followPersonBtn').onclick();
  ui.el('followPersonBtn').onclick();
  assert.equal(ui.camera().zoom,4);
}
test('1× overview count opens bounded roster; every member can be selected through paging',async()=>{
  const {ui,s,group}=await worldCrowd(10),before=JSON.stringify(s);
  click(ui,groupBadge(ui));
  assert.equal(ui.el('crowdPanel').hidden,false);
  assert.match(ui.el('crowdPanel').innerHTML,/此處 10 位居民/);
  assert.equal(ui.el('crowdPanel').querySelectorAll('[data-crowd-person]').length,5);
  ui.el('crowdPanel').querySelectorAll('[data-crowd-page]')
    .find(b=>b.dataset.crowdPage==='1').onclick();
  const buttons=ui.el('crowdPanel').querySelectorAll('[data-crowd-person]');
  assert.equal(buttons.length,5);
  const last=buttons.find(b=>b.dataset.crowdPerson===group[9].id);
  assert.ok(last,'tenth citizen is still reachable');
  last.onclick();
  assert.equal(ui.chosen(),group[9].id);
  assert.equal(ui.el('crowdPanel').hidden,true);
  assert.equal(JSON.stringify(s),before,'roster selection does not mutate real person positions');
});

test('4× and 8× miniatures can be selected separately with the actual rendered hit area',async()=>{
  const {ui,s,group}=await worldCrowd(5);
  const before=JSON.stringify(s);
  zoomToGroup(ui,group[0].id);
  for(const zoom of [4,8]){
    if(zoom===8)ui.el('zoomInBtn').onclick();
    for(const p of group){
      const sprite=ui.crowds().sprites.get(p.id);
      assert.ok(sprite.visible);
      click(ui,pointFor(ui,sprite));
      assert.equal(ui.chosen(),p.id,'clicking avatar must select '+p.id+' at '+zoom+'x');
    }
  }
  assert.equal(JSON.stringify(s),before);
});

test('10-person close-up preserves the selected hidden citizen and lets the roster follow them',async()=>{
  const {ui,s,group}=await worldCrowd(10);
  const before=JSON.stringify(s);
  zoomToGroup(ui,group[0].id);
  ui.el('zoomInBtn').onclick();
  const visible=[...ui.crowds().sprites.values()].filter(p=>p.key===ui.crowds().sprites.get(group[0].id).key&&p.visible);
  assert.equal(visible.length,8);
  click(ui,groupBadge(ui));
  assert.equal(ui.el('crowdPanel').hidden,false);
  ui.el('crowdPanel').querySelectorAll('[data-crowd-page]')
    .find(b=>b.dataset.crowdPage==='1').onclick();
  ui.el('crowdPanel').querySelectorAll('[data-crowd-follow]')
    .find(b=>b.dataset.crowdFollow===group[9].id).onclick();
  assert.equal(ui.chosen(),group[9].id);
  assert.equal(ui.camera().followId,group[9].id);
  assert.ok(ui.crowds().sprites.get(group[9].id).visible);
  assert.equal(JSON.stringify(s),before);
});

test('4× Heal selection tracks the separated avatar but casts at real simulation location',async()=>{
  const {ui,s,group}=await worldCrowd(5);
  zoomToGroup(ui,group[0].id);
  const injured=group[4];injured.health=45;
  s.god.dp=s.god.cap;ui.render();
  const visual=ui.crowds().sprites.get(injured.id),target=pointFor(ui,visual);
  assert.ok(Math.hypot(visual.x-injured.x,visual.y-injured.y)>.2,'visual and true coordinates differ');
  ui.choose('heal');
  const hour=s.hour,health=injured.health;
  click(ui,target);
  assert.ok(injured.health>health,'real injured citizen is healed');
  assert.equal(s.hour,hour);
  assert.equal(s.lastCrowdState,undefined,'no visual layout enters the save');
});

test('adult scale does not jump when people enter or leave the same cell',()=>{
  const all=residents(10),positions=new Map(all.map(p=>[p.id,p]));
  for(const zoom of [1,2,4,8]){
    const observed=[];
    for(const n of [1,2,3,5,6,8,10,2,1]){
      const layout=L.arrangeCrowds(all.slice(0,n),positions,zoom,new Map());
      const person=layout.sprites.get('p1');
      assert.ok(person.visible);
      observed.push(person.scale);
    }
    for(const v of observed)near(v,observed[0]);
    near(observed[0],L.characterScale(all[0],zoom));
    assert.ok(observed[0]>0);
  }
});

test('a nine-year-old is consistently smaller than an adult regardless of same-cell crowd count',()=>{
  const adult={id:'p1',x:22.2,y:19.4,age:35,stage:'adult',alive:true};
  const child={id:'p2',x:22.2,y:19.4,age:9,stage:'child',alive:true};
  const extras=residents(8).map((p,i)=>({...p,id:'p'+(i+3)}));
  const all=[adult,child,...extras],positions=new Map(all.map(p=>[p.id,p]));
  for(const zoom of [1,4,8]){
    const solo=L.arrangeCrowds([child],positions,zoom).sprites.get(child.id);
    let scale=null;
    for(const n of [2,3,5,10]){
      const current=L.arrangeCrowds(all.slice(0,n),positions,zoom,new Map());
      const value=current.sprites.get(child.id).scale;
      if(scale===null)scale=value;
      near(value,solo.scale);
      assert.ok(value<current.sprites.get(adult.id).scale);
    }
    const olderChild={...child,age:17},older=L.characterScale(olderChild,zoom);
    assert.ok(older>solo.scale&&older<L.characterScale(adult,zoom),
      'character growth should be gradual, with near-adult size at 17');
  }
});

test('individual hits still match the visual scale and position after group size changes',()=>{
  const all=residents(10),c=L.createCamera(64,64);
  c.zoom=8;L.focus(c,22.5,19.5);
  const slots=new Map(),poses=new Map(all.map(p=>[p.id,p]));
  for(const n of [2,5,10,2,1]){
    const layout=L.arrangeCrowds(all.slice(0,n),poses,c.zoom,slots);
    const visible=[...layout.sprites.values()].filter(p=>p.visible);
    for(const item of visible){
      const center=L.toScreen(c,item.x+.5,item.y+.5,768,768);
      assert.equal(L.hitCharacter(layout.sprites,c,center.x,center.y,768,768)?.id,item.id);
    }
  }
});
