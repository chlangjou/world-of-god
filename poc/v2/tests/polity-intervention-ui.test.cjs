'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const config=require('../config/polity-command-v0.1.json');
const {boot}=require('./browser-harness.cjs');

// Exercise the actual application animation loop, not only the headless engine.
async function live(speed){
  const ui=await boot({politicsProfile:{...config,enabled:true}}),s=ui.world();
  assert.ok(s.politics?.enabled,'browser must load the opt-in political model');
  // Keep native geography and real residents but remove unrelated optional trips.
  s.mobility.tripChancePerDay=0;
  s.mobility.missionBaseChancePerDay=0;
  s.mobility.missionSpreadChancePerDay=0;
  s.politics.disputeEveryDays=7;
  s.politics.resourceNeedStone=100;
  s.politics.maxClaimDistance=100;
  s.politics.maxMarchDays=60;
  ui.setSpeed(speed);
  ui.el('pauseBtn').onclick();
  assert.equal(ui.runtime().paused,false);
  return {ui,s,time:0};
}
function advanceUntil(session,predicate,limit=450){
  for(let i=0;i<limit;i++){
    session.time+=250;
    session.ui.frame(session.time);
    if(predicate())return;
  }
  throw Error('timed out waiting for conflict transition');
}
function engaged(s){return s.politics.disputes.find(c=>c.status==='clashing');}
for(const speed of [1,16]){
  test(speed+'× first contact auto-pauses before any hidden damage',async()=>{
    const session=await live(speed),{ui,s}=session;
    advanceUntil(session,()=>ui.runtime().paused&&!!engaged(s));
    const c=engaged(s);
    assert.equal(ui.runtime().paused,true);
    assert.equal(ui.runtime().speed,0.1,'combat resumes at 0.1x for deliberate intervention');
    assert.equal(c.roundsCompleted,0,'the first contact may not deal hidden damage');
    assert.equal(ui.el('battleFocusBtn').hidden,false,'battle must be visible');
    assert.match(ui.el('battleFocusBtn').innerHTML,/交戰/);
    const hour=s.hour;
    for(let i=0;i<8;i++){session.time+=250;ui.frame(session.time);}
    assert.equal(s.hour,hour,'world clock must not advance while the God examines the fight');
    assert.match(ui.el('toast').textContent,/已自動暫停/);
    assert.deepEqual(W.validate(s).errors,[]);
  });
}
test('first combat wounds pause time again; God can Heal militia without advancing the clock',async()=>{
  const session=await live(16),{ui,s}=session;
  advanceUntil(session,()=>ui.runtime().paused&&!!engaged(s));
  const first=engaged(s);
  assert.equal(first.roundsCompleted,0);
  ui.el('pauseBtn').onclick();
  advanceUntil(session,()=>ui.runtime().paused&&engaged(s)?.roundsCompleted===1,120);
  const injured=s.politics.polities.filter(p=>p.id===first.aId||p.id===first.bId)
    .flatMap(p=>p.militia.memberIds)
    .map(id=>s.people.find(person=>person.id===id&&person.alive))
    .find(p=>p&&p.health<100);
  assert.ok(injured,'first combat exchange should cause real wounds');
  const health=injured.health,clock=s.hour;
  s.god.dp=s.god.cap;
  ui.choose('heal');
  ui.clickMap(injured.x,injured.y);
  assert.ok(injured.health>health,'the player should be able to Heal a combatant');
  assert.equal(s.hour,clock,'casting during pause does not advance simulation time');
  assert.equal(ui.runtime().paused,true,'Miracle casting may not unpause the game');
  assert.deepEqual(W.validate(s).errors,[]);
});


test('0.1× is a real selectable speed: one 8-hour tick takes about 6.67 real seconds',async()=>{
  const ui=await boot({politicsProfile:{...config,enabled:false}}),s=ui.world();
  const slow=ui.speedButton(0.1);
  assert.ok(slow&&typeof slow.onclick==='function','0.1× must be in the clickable speed toolbar');
  slow.onclick();
  assert.equal(ui.runtime().speed,0.1);
  assert.ok(slow.classList.contains('active'),'slow motion should be visibly selected');
  assert.match(ui.el('simRate').textContent,/0\.1×.*20\.00 秒/);
  ui.el('pauseBtn').onclick();
  const tick=s.tick;
  for(let i=1;i<=25;i++)ui.frame(i*250);
  assert.equal(s.tick,tick,'world must not run one 8-hour tick in only six seconds');
  for(let i=26;i<=32;i++)ui.frame(i*250);
  assert.equal(s.tick,tick+1,'world must run an 8-hour tick after roughly 6.67 seconds');
  assert.deepEqual(W.validate(s).errors,[]);
});
