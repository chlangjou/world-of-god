'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../src/sim.js');
const ag=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');
const strategy=require('../config/oracle-specialization-v0.1.json');
const playtest=require('../src/playtest.js');
const playtestConfig=require('../config/playable-evidence-v0.1.json');

class Element {
  constructor(id){
    this.id=id;this.hidden=false;this.disabled=false;this.dataset={};this.style={};
    const slider={radius:{min:'2',max:'14',value:'7'},
      intensity:{min:'30',max:'120',value:'85'},
      duration:{min:'1',max:'30',value:'10'}}[id];
    this.min=slider?.min||'1';this.max=slider?.max||'30';this.value=slider?.value||'';
    this._html='';this._buttons=[];this.title='';this.textContent='';this.scrollTop=0;this.children=[];
    this.listeners={};this.classList={toggle(){},add(){},remove(){}};
  }
  get innerHTML(){return this._html;}
  set innerHTML(value){
    this._html=value;
    this._buttons=[];
    if(this.id==='crowdPanel'){
      for(const found of value.matchAll(/<button\b([^>]*)>/g)){
        const data={};
        for(const attr of found[1].matchAll(/data-([a-z-]+)="([^"]*)"/g)){
          const name=attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
          data[name]=attr[2];
        }
        this._buttons.push({dataset:data,disabled:/\sdisabled\b/.test(found[1]),onclick:null});
      }
    }
    if(['divinePowerSelect','saintSelect','residentSelect','settlementSelect'].includes(this.id))
      this.value=/<option value="([^"]+)"/.exec(value)?.[1]||'';
  }
  get firstElementChild(){return this.children[0]||null;}
  insertAdjacentHTML(position,html){this._html+=html;}
  setAttribute(){}
  addEventListener(kind,fn){this.listeners[kind]=fn;}
  getBoundingClientRect(){return {left:0,top:0,width:768,height:768};}
  querySelectorAll(selector){
    const attribute=/^\[data-([a-z-]+)\]$/.exec(selector)?.[1];
    const key=attribute?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    return key?this._buttons.filter(b=>Object.hasOwn(b.dataset,key)):[];
  }
}

async function boot({sim=W,politicsProfile={...require('../config/polity-command-v0.1.json'),enabled:false}}={}){
  const elements=new Map(),get=id=>{
    if(!elements.has(id))elements.set(id,new Element(id));
    return elements.get(id);
  };
  const canvas=get('world');canvas.width=768;canvas.height=768;
  const drawing=[];let lastArc=null;
  const ctx=new Proxy({},{
    set(object,key,value){object[key]=value;return true;},
    get(object,key){return key in object?object[key]:(...args)=>{if(key==='arc')lastArc=args;if(['fill','stroke','fillText'].includes(key))drawing.push({kind:key,args,arc:lastArc,fill:object.fillStyle,stroke:object.strokeStyle});};}
  });
  canvas.getContext=()=>ctx;
  const documentListeners={};
  const speedButtons=[0.1,1,4,16].map(rate=>{
    const classes=new Set();
    return {dataset:{speed:String(rate)},onclick:null,
      classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
        contains:name=>classes.has(name)}};
  });
  const doc={getElementById:get,querySelectorAll:selector=>selector==='[data-speed]'?speedButtons:[],
    addEventListener(name,handler){documentListeners[name]=handler;},
    activeElement:{tagName:'BODY'}};
  // Existing UI interaction regressions exercise the original open-ended
  // native mode, not the opt-in 30-person scripted duel. Supply the real new
  // runtime dependencies rather than silently using the unconfigured world.
  const win={WoG2:sim,WOG_AGRICULTURE_PROFILE:ag,
    WOG_RELIGION_PROFILE:religion,WOG_DIVINE_PROFILE:divine,
    WOG_OPPONENT_PROFILE:opponent,WOG_ORACLE_STRATEGY_PROFILE:strategy,
    WOG_PLAYTEST:playtest,WOG_LIVING_WORLD:require('../src/living-world.js'),
    WOG_CHARACTER_ART:require('../src/character-art.js'),
    WOG_CLOSEUP:require('../src/closeup-observation.js'),
    WOG_PLAYTEST_PROFILE:{...playtestConfig,defaultScenario:'native'},
    WOG_MOBILITY_PROFILE:require('../config/mobility-contact-v0.1.json'),WOG_VICTORY_PROFILE:require('../config/victory-dominance-v0.1.json'),WOG_SHRINE_PROFILE:require('../config/shrine-temple-v0.1.json'),WOG_POLITY_PROFILE:politicsProfile};
  const memory=new Map(),storage={
    setItem(key,value){memory.set(key,value);},
    getItem(key){return memory.get(key)||null;}
  };
  const original=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
  const source=original.replace(/\}\)\(\);\s*$/,'window.__getWorld=()=>state;window.__render=render;window.__draw=draw;'+
    'window.__frame=animate;window.__setSpeed=x=>{speed=x};window.__camera=()=>({...camera});'+
    'window.__position=id=>{const p=state.people.find(x=>x.id===id);return p&&L.position(motions.get(id),p,animationClock)};'+
    'window.__crowds=()=>crowdLayout;window.__chosen=()=>chosen;'+
    'window.__setVisualMotion=(id,r)=>motions.set(id,r);'+
    'window.__runtime=()=>({paused,speed,lastAttentionSeq,observation:{...observation},'+
    'aimHold:{...aimHold},armedMiracle,animationClock});})();');
  assert.notEqual(original,source,'test instrumentation must attach to actual browser code');
  new Function('window','document','performance','requestAnimationFrame','setTimeout',
    'clearTimeout','confirm','localStorage','URL','Blob','fetch',source)(
    win,doc,{now:()=>0},()=>1,()=>1,()=>{},()=>true,storage,
    {createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
    class FakeBlob{},()=>Promise.reject(new Error('unexpected profile fetch')));
  await new Promise(resolve=>setImmediate(resolve));
  return {
    el:get,canvas,render:()=>win.__render(),draw:()=>{drawing.length=0;win.__draw();return drawing;},world:()=>win.__getWorld(),
    frame:t=>win.__frame(t),runtime:()=>win.__runtime(),camera:()=>win.__camera(),
    position:id=>win.__position(id),crowds:()=>win.__crowds(),chosen:()=>win.__chosen(),
    setMotion:(id,r)=>win.__setVisualMotion(id,r),
    setSpeed:x=>win.__setSpeed(x),
    speedButton:x=>speedButtons.find(b=>Number(b.dataset.speed)===x),
    choose:id=>{get('divinePowerSelect').value=id;get('divinePowerSelect').onchange();},
    set:(id,value)=>{get(id).value=String(value);get(id).listeners.input();},
    key:(key,options={})=>{
      let prevented=false;
      doc.activeElement={tagName:options.focus||'BODY',
        isContentEditable:!!options.isContentEditable};
      documentListeners.keydown({key,code:key===' '?'Space':'Digit'+key,
        ctrlKey:false,altKey:false,metaKey:false,repeat:false,
        ...options,preventDefault(){prevented=true;}});
      doc.activeElement={tagName:'BODY'};
      return prevented;
    },
    clickMap:(x,y)=>{
      const size=768/win.__getWorld().width;
      canvas.listeners.click({clientX:(x+.25)*size,clientY:(y+.25)*size});
    },
    values:()=>({radius:+get('radius').value,intensity:+get('intensity').value,
      duration:+get('duration').value})
  };
}


module.exports={boot};
