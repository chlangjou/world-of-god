'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const W=require('../src/sim.js');
const ag=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.1.json');
const fresh=(withOpponent=true)=>W.create({
  seed:'opponent-competition-replay',balanceProfile:ag,religionProfile:religion,
  divineProfile:divine,...(withOpponent?{opponentProfile:opponent}:{})
});
const after=(s,days)=>{W.advanceTicks(s,days*3);return s};
const good=s=>assert.deepEqual(W.validate(s).errors,[]);

test('opponent begins with existing households, not extra people, resources, or map',()=>{
  const solo=fresh(false), versus=fresh(true);
  assert.equal(versus.opponentReligion.id,'r2');
  assert.equal(versus.opponentGod.id,'g2');
  assert.deepEqual(versus.tiles,solo.tiles);
  assert.deepEqual(versus.households,solo.households);
  assert.deepEqual(versus.people.map(p=>p.id),solo.people.map(p=>p.id));
  assert.equal(versus.people.filter(p=>p.religionId==='r2').length,6);
  assert.ok(versus.people.some(p=>p.religionId==='r1'&&p.devotion>=40));
  assert.deepEqual(W.stats(solo).opponentEnabled,false);
  good(solo);good(versus);
});

test('gods pay their own Divine Power, gain their own Mastery and have separate cooldowns',()=>{
  const s=fresh();
  const candidate=s.people.find(p=>p.religionId==='r2');
  const original={own:s.god.dp,rival:s.opponentGod.dp};
  const at={x:candidate.x,y:candidate.y,radius:5,intensity:.8,durationDays:6};
  const simulated=W.evaluateMiracle(s,'rain',{...at,godId:'g2'});
  assert.equal(simulated.ok,true);
  const cast=W.castMiracle(s,'rain',{...at,godId:'g2'});
  assert.equal(cast.ok,true);
  assert.equal(s.god.dp,original.own,'AI must not spend human God power');
  assert.equal(s.opponentGod.dp,original.rival-cast.cost);
  assert.ok(s.opponentGod.skills.rain.readyAtHour>s.hour);
  assert.equal(s.god.skills.rain.readyAtHour,0);
  assert.equal(s.effects.at(-1).godId,'g2');
  const human=W.castMiracle(s,'rain',{x:s.camp.x,y:s.camp.y,radius:5,intensity:.8,durationDays:6});
  assert.equal(human.ok,true);
  assert.ok(s.god.skills.rain.readyAtHour>s.hour);
  const opponentAgain=W.evaluateMiracle(s,'rain',{...at,godId:'g2'});
  const playerAgain=W.evaluateMiracle(s,'rain',{...at});
  assert.equal(opponentAgain.costMultiplier,2);
  assert.equal(playerAgain.costMultiplier,2);
  assert.equal(opponentAgain.ok,false,'AI is subject to the same unaffordable 2x price');
  assert.equal(playerAgain.ok,false,'player also needs enough DP to force a repeat');
  good(s);
});

test('independent Priests/Saints arise; AI issues real Oracle and casts real Miracles',()=>{
  const s=fresh();
  after(s,112);
  assert.ok(s.opponentReligion.saints.length,'AI Saint should emerge from a real believer');
  assert.ok(s.opponentReligion.priests.length,'AI Priest should emerge in a real settlement');
  assert.ok(s.opponent.oracleIssues>=1,'AI uses Saint transmission, not instant population edits');
  assert.ok(s.opponent.casts>=1,'AI must cast through public Miracle API');
  assert.ok(s.opponentGod.skills.ripening.xp>0||s.opponentGod.skills.rain.xp>0||
    s.opponentGod.skills.efficiency.xp>0,'AI casts advance its own skill');
  assert.ok(s.opponentReligion.oracles.every(o=>o.godId==='g2'));
  assert.ok(s.effects.every(e=>!e.godId||['g1','g2'].includes(e.godId)));
  assert.ok(s.events.some(e=>e.kind==='miracle'&&e.text.includes(s.opponentReligion.name)));
  good(s);
});

test('40+ commitments resist ordinary rival sermons while affiliation remains personal',()=>{
  const s=fresh(),p=s.people.find(v=>v.id==='p1');
  p.devotion=61;p.religionId='r1';
  // Isolate ordinary rivalry: an attributed rival Miracle is now permitted
  // to challenge 40+ commitment, but a Priest sermon still cannot.
  s.opponent.startDay=360;
  after(s,180);
  assert.equal(p.religionId,'r1');
  assert.ok(p.devotion>=61,'high devotion must not decay from sermons alone');
  good(s);
});

test('full opponent state serializes and replays deterministically at equal future ticks',()=>{
  const a=fresh();
  after(a,165);
  const b=W.restore(JSON.stringify(a));
  assert.deepEqual(b,a,'restore must preserve AI state, decisions, and separate RNG');
  after(a,100);after(b,100);
  assert.deepEqual(b,a,'both worlds must make the same AI decisions');
  good(a);
});

test('old single-God save restores without enabling an unrequested enemy',()=>{
  const solo=fresh(false);
  after(solo,45);
  delete solo.opponent;
  delete solo.opponentReligion;
  delete solo.opponentGod;
  delete solo.opponentRng;
  const oldPeople=JSON.stringify(solo.people);
  const restored=W.restore(JSON.stringify(solo));
  assert.notEqual(restored.opponent?.enabled,true);
  assert.equal(W.stats(restored).opponentEnabled,false);
  assert.equal(JSON.stringify(restored.people),oldPeople);
  after(restored,40);
  good(restored);
});

test('a former believer cannot remain a Priest after falling below the faith threshold',()=>{
  const state=fresh();
  after(state,60);
  const oldPriest=state.opponentReligion.priests[0];
  assert.ok(oldPriest);
  const person=state.people.find(p=>p.id===oldPriest);
  person.devotion=19;
  after(state,1);
  assert.ok(!state.opponentReligion.priests.includes(oldPriest),
    'abandoned offices must not block appointment of a legitimate Priest');
  good(state);
});

test('casting Miracle does not bypass existing faith evidence or auto-convert residents',()=>{
  const state=fresh(),target=state.people.find(p=>p.religionId==='r2');
  const before=state.people.map(p=>[p.religionId,p.devotion]);
  const cast=W.castMiracle(state,'rain',{godId:'g2',
    x:target.x,y:target.y,radius:5,intensity:.8,durationDays:6});
  assert.equal(cast.ok,true);
  assert.deepEqual(state.people.map(p=>[p.religionId,p.devotion]),before,
    'Miracle casting by itself must not modify belief without observed consequence');
  good(state);
});
