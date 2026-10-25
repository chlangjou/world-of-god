'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function camelCase(key){return key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function parseButtons(markup){
  const result=[],regex=/<button\b([^>]*)>/g;
  let hit;
  while((hit=regex.exec(markup))){
    const attrs=hit[1],dataset={};
    for(const entry of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))
      dataset[camelCase(entry[1])]=entry[2];
    result.push({dataset,disabled:/\sdisabled\b/.test(attrs),onclick:null});
  }
  return result;
}
class StubElement {
  constructor(id){
    this.id=id;this.hidden=false;this.disabled=false;this.dataset={};this.style={};
    this._innerHTML='';this._buttons=[];this.value=({divinePowerSelect:'rain',radius:'7',intensity:'85',duration:'10'})[id]||'';
    this.textContent='';this.children=[];this.scrollTop=0;this.classList={toggle(){},add(){},remove(){}};
    this.listeners={};this.max='30';this.min='1';this.title='';
  }
  get innerHTML(){return this._innerHTML;}
  set innerHTML(v){
    this._innerHTML=v;this._buttons=parseButtons(v);
    if(['divinePowerSelect','saintSelect','residentSelect','settlementSelect'].includes(this.id))
      this.value=/<option value="([^"]+)"/.exec(v)?.[1]||'';
  }
  insertAdjacentHTML(position,html){
    this._innerHTML+=html;this._buttons.push(...parseButtons(html));
  }
  get firstElementChild(){return this.children[0]||null;}
  setAttribute(){}
  addEventListener(event,fn){this.listeners[event]=fn;}
  getBoundingClientRect(){return {left:0,top:0,width:768,height:768};}
  querySelectorAll(selector){
    const attribute=/^\[data-([a-z-]+)\]$/.exec(selector)?.[1];
    return attribute?this._buttons.filter(b=>Object.hasOwn(b.dataset,camelCase(attribute))):[];
  }
}
async function boot(){
  const elements=new Map(),element=id=>{
    if(!elements.has(id))elements.set(id,new StubElement(id));
    return elements.get(id);
  };
  const canvas=element('world'),calls=[];
  canvas.width=768;canvas.height=768;
  const context=new Proxy({},{
    set(object,key,value){object[key]=value;return true;},
    get(object,key){
      if(key==='arc'||key==='fillText')return (...args)=>{calls.push({kind:key,args});};
      return key in object?object[key]:()=>{};
    }
  });
  canvas.getContext=()=>context;
  const document={getElementById:element,querySelectorAll:()=>[],addEventListener(){},
    activeElement:{tagName:'BODY'}};
  // Mirror actual native-playable dependencies instead of booting an intentionally
  // broken browser. UI contracts should exercise a loaded, ordinary world.
  const window={WoG2:W,WOG_AGRICULTURE_PROFILE:agriculture,
    WOG_RELIGION_PROFILE:religion,WOG_DIVINE_PROFILE:divine,
    WOG_OPPONENT_PROFILE:require('../config/opponent-v0.2.json'),
    WOG_ORACLE_STRATEGY_PROFILE:require('../config/oracle-specialization-v0.1.json'),
    WOG_PLAYTEST:require('../src/playtest.js'),
    WOG_PLAYTEST_PROFILE:{...require('../config/playable-evidence-v0.1.json'),defaultScenario:'native'},
    WOG_SHRINE_PROFILE:require('../config/shrine-temple-v0.1.json'),
    WOG_MOBILITY_PROFILE:require('../config/mobility-contact-v0.1.json'),
    WOG_VICTORY_PROFILE:require('../config/victory-dominance-v0.1.json'),
    WOG_POLITY_PROFILE:{...require('../config/polity-command-v0.1.json'),enabled:false},
    WOG_LIVING_WORLD:require('../src/living-world.js')};
  const source=read('src/app.js').replace(/\}\)\(\);\s*$/,
    'window.__needTest={state:()=>state,render,currentNeed,locateNeed,intervention:()=>lastIntervention};})();');
  assert.ok(source.includes('window.__needTest'),'test harness must attach to the actual browser source');
  new Function('window','document','performance','requestAnimationFrame','setTimeout',
    'clearTimeout','confirm','localStorage','URL','Blob','fetch',source)(
    window,document,{now:()=>0},()=>1,()=>1,()=>{},()=>true,
    {setItem(){},getItem(){return null;}},
    {createObjectURL(){return 'blob:'},revokeObjectURL(){}},
    class StubBlob{},()=>Promise.reject(new Error('unexpected profile fetch'))
  );
  await new Promise(resolve=>setImmediate(resolve));
  return {app:window.__needTest,element,calls,canvas};
}
function threeNeeds(state){
  const centers=[{x:13,y:14},{x:29,y:31},{x:48,y:44}];
  state.religion.prayers=centers.map((center,index)=>({
    id:'need-location-'+index,type:'food-water',center,status:'open',
    createdAtHour:index*8,by:['p1'],needSummary:'地區 '+index+' 的作物確實缺雨',
    collectedBy:null
  }));
  return centers;
}
test('three separate dry-field needs are visible and clicking one highlights its actual center, without casting',async()=>{
  const {app,element,calls}=await boot(),state=app.state(),centers=threeNeeds(state);
  app.render();
  const list=element('needsPanel').querySelectorAll('[data-need-locate]');
  assert.equal(list.length,3,'do not silently truncate to the two latest requests');
  assert.ok(element('needsPanel').innerHTML.includes('(48, 44)'));
  assert.ok(element('needsPanel').innerHTML.includes('(13, 14)'));
  const initialDp=state.god.dp,effects=state.effects.length;
  calls.length=0;list[1].onclick();
  assert.equal(app.currentNeed()?.prayer.id,'need-location-1');
  assert.deepEqual(app.currentNeed().location.center,centers[1]);
  assert.ok(element('mapStatus').textContent.includes('(29, 31)'));
  const unit=768/state.width;
  assert.ok(calls.some(draw=>draw.kind==='arc'&&
    Math.abs(draw.args[0]-(centers[1].x+.5)*unit)<.01&&
    Math.abs(draw.args[1]-(centers[1].y+.5)*unit)<.01&&
    Math.abs(draw.args[2]-11*unit)<.01),'show actual water evaluation radius');
  assert.equal(state.god.dp,initialDp);
  assert.equal(state.effects.length,effects);
  const newCards=element('needsPanel').querySelectorAll('[data-need-locate]');
  newCards[0].onclick();
  assert.equal(app.currentNeed()?.prayer.id,'need-location-2','card switches center');
  state.religion.prayers[2].status='resolved';
  app.render();
  assert.equal(app.currentNeed(),null,'resolved requests may not leave stale map pins');
});
test('the fourth request remains accessible via paging, without making the full page scroll',async()=>{
  const {app,element}=await boot(),state=app.state();
  threeNeeds(state);
  state.religion.prayers.push({
    id:'need-location-4',type:'food-water',center:{x:56,y:50},status:'open',
    createdAtHour:32,by:['p1'],needSummary:'第四處缺雨'
  });
  app.render();
  assert.equal(element('needsPanel').querySelectorAll('[data-need-locate]').length,3);
  const next=element('needsPanel').querySelectorAll('[data-needs-page]')
    .find(b=>b.dataset.needsPage==='1');
  assert.ok(next,'pagination must exist when there are more than three');
  next.onclick();
  const cards=element('needsPanel').querySelectorAll('[data-need-locate]');
  assert.equal(cards.length,1);
  cards[0].onclick();
  assert.equal(app.currentNeed()?.prayer.id,'need-location-0');
});
test('clicking the Priest prayer bubble selects its source; paging chooses a different source',async()=>{
  const {app,element,canvas}=await boot(),state=app.state();
  threeNeeds(state);
  state.religion.priests=['p1'];
  for(const p of state.religion.prayers)p.collectedBy='p1';
  app.render();
  const priest=state.people.find(p=>p.id==='p1'),size=canvas.width/state.width;
  const centerX=(priest.x+.5)*size+Math.max(size*.82,10*.72);
  const centerY=(priest.y+.5)*size-Math.max(size*1.10,10*1.7);
  canvas.listeners.click({clientX:centerX,clientY:centerY});
  assert.ok(element('needsPanel').innerHTML.includes('Priest'));
  assert.ok(app.currentNeed());
  const original=app.currentNeed().prayer.id;
  const next=element('needsPanel').querySelectorAll('[data-priest-nav]')
    .find(b=>b.dataset.priestNav==='1');
  assert.ok(next);
  next.onclick();
  assert.notEqual(app.currentNeed()?.prayer.id,original,
    'Priest navigator must update the map target too');
  assert.ok(element('needsPanel').querySelectorAll('[data-need-locate]').length);
});

test('a real petition offers optional Miracle targeting without changing DP, events or simulation time',async()=>{
  const {app,element}=await boot(),state=app.state();
  threeNeeds(state);app.render();
  assert.match(element('needsPanel').innerHTML,/已等待/);
  const actions=element('needsPanel').querySelectorAll('[data-need-plan]');
  assert.equal(actions.length,3);
  const beforeDP=state.god.dp,beforeEffects=state.effects.length,beforeHour=state.hour;
  actions[0].onclick();
  assert.equal(app.currentNeed()?.prayer.id,'need-location-2');
  assert.equal(element('divinePowerSelect').value,'rain');
  assert.equal(state.god.dp,beforeDP);
  assert.equal(state.effects.length,beforeEffects);
  assert.equal(state.hour,beforeHour);
  assert.equal(app.intervention(),null);
});

test('Rain report distinguishes successful casting, unverified benefits and a correctly linked answered prayer',async()=>{
  const {app,element,canvas}=await boot(),state=app.state();
  threeNeeds(state);app.render();
  element('needsPanel').querySelectorAll('[data-need-plan]')[0].onclick();
  const center=app.currentNeed().location.center;
  const beforeDP=state.god.dp;
  const unit=canvas.width/state.width;
  canvas.listeners.click({clientX:(center.x+.5)*unit,clientY:(center.y+.5)*unit});
  const result=app.intervention();
  assert.ok(result,'cast feedback remains after toast expires');
  assert.equal(result.type,'rain');
  assert.equal(result.prayerId,'need-location-2');
  assert.ok(result.effectId);
  assert.ok(state.god.dp<beforeDP);
  assert.equal(element('interventionPanel').hidden,false);
  assert.match(element('interventionPanel').innerHTML,/祈求尚待水分改善與實際產糧/);
  assert.equal(element('needsPanel').querySelectorAll('[data-need-locate]').length,2,
    'outcome occupies room without overflowing the fixed inspector');
  const next=element('needsPanel').querySelectorAll('[data-needs-page]')
    .find(b=>b.dataset.needsPage==='1');
  assert.ok(next,'third petition remains accessible via paging');
  next.onclick();
  assert.equal(element('needsPanel').querySelectorAll('[data-need-locate]').length,1);
  const prayer=state.religion.prayers.find(p=>p.id===result.prayerId);
  prayer.status='answered';prayer.castId='other-rain-effect';app.render();
  assert.doesNotMatch(element('interventionPanel').innerHTML,/已核實：本次雨雲/);
  prayer.castId=result.effectId;app.render();
  assert.match(element('interventionPanel').innerHTML,/已核實：本次雨雲/);
  assert.equal(state.lastIntervention,undefined,'UI observation stays outside deterministic save');
});
