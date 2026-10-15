'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../src/sim.js');
const Playtest=require('../src/playtest.js');
const Agriculture=require('../config/balance-agriculture-v0.1.json');
const Religion=require('../config/religion-propagation-v0.1.json');
const Divine=require('../config/divine-powers-v0.1.json');
const Opponent=require('../config/opponent-v0.2.json');
const Strategy=require('../config/oracle-specialization-v0.1.json');
const Configuration=require('../config/playable-evidence-v0.1.json');
const root=path.join(__dirname,'..');
const opts=(mode)=>({mode,seed:Configuration[mode].seed,
  playtestProfile:Configuration,oracleStrategyProfile:Strategy,
  opponentProfile:Opponent,balanceProfile:Agriculture,
  religionProfile:Religion,divineProfile:Divine,
  difficulty:'standard',opponentMode:'ai'});

test('duel opens immediately at Day 10 with actual two communities and no player script',()=>{
  const s=Playtest.createWorld(W,opts('duel'));
  const st=W.stats(s),score=Playtest.score(s);
  assert.equal(W.days(s),10);
  assert.equal(st.people,30);
  assert.equal(st.followers,15);
  assert.equal(st.opponentFollowers,15);
  assert.equal(s.households.length,10);
  assert.equal(s.settlements.length,2);
  assert.ok(s.people.every(p=>p.alive&&p.devotion===60));
  assert.equal(s.religion.oracles.length,0);
  assert.equal(s.opponentReligion.oracles.length,1);
  assert.equal(s.opponentReligion.oracles[0].intentType,'food.produce');
  assert.equal(s.opponentReligion.oracles[0].status,'active');
  assert.ok(s.religion.saints.length>0&&s.religion.priests.length>0);
  assert.ok(s.opponentReligion.saints.length>0&&s.opponentReligion.priests.length>0);
  assert.equal(score.net,0);
  assert.equal(score.goal,3);
  assert.equal(score.days,0);
  assert.deepEqual(s.playtest.originalPlayerIds.length,15);
  assert.deepEqual(s.playtest.originalRivalIds.length,15);
  assert.ok(W.validate(s).ok);
});

test('genuine player-selected Nurture creates earned conversions from the same 15 AI starters',()=>{
  const s=Playtest.createWorld(W,opts('duel'));
  const oldIds=new Set(s.playtest.originalRivalIds);
  const original=new Map(s.people.map(p=>[p.id,p.religionId]));
  const issued=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'family.nurture'});
  assert.equal(issued.ok,true);
  assert.equal(Playtest.score(s).net,0);
  for(let d=1;d<=100;d++)W.advanceTicks(s,3);
  const score=Playtest.score(s);
  assert.equal(score.days,100);
  assert.ok(score.won,'correct Oracle should be playable, not an endless wait');
  assert.equal(score.gained,3);
  assert.equal(score.lost,0);
  assert.equal(score.net,3);
  assert.ok(s.people.some(p=>oldIds.has(p.id)&&p.lastStrategicConversion?.fromDevotion>=40));
  assert.ok(s.events.some(e=>e.kind==='faith'&&e.text.includes('自主選擇改宗')));
  assert.ok(s.people.every(p=>original.has(p.id)));
  assert.ok(W.validate(s).ok);
});

test('natural world retains real Genesis and normal AI action timing',()=>{
  const s=Playtest.createWorld(W,opts('native'));
  const st=W.stats(s);
  assert.equal(W.days(s),0);
  assert.equal(st.people,51);
  assert.equal(s.settlements.length,3);
  assert.equal(Playtest.score(s),null);
  assert.equal(s.playtest.mode,'native');
  assert.equal(s.oracleStrategy.counterAttractionEnabled,true);
  assert.equal(s.oracleStrategy.counterPairedRandom,undefined);
  assert.equal(s.oracleStrategy.counterAttractionGain,6);
  assert.equal(s.opponent.startDay,Opponent.startDay);
  assert.equal(s.opponentReligion.oracles.length,0);
  assert.ok(W.validate(s).ok);
});
test('legacy saved worlds are never reclassified as a scripted duel',()=>{
  const legacy=W.create({seed:'dry-stress'});
  assert.equal(Playtest.score(legacy),null);
  assert.equal(Playtest.score(W.restore(JSON.stringify(legacy))),null);
  const duel=Playtest.createWorld(W,opts('duel'));
  const restored=W.restore(JSON.stringify(duel));
  assert.deepEqual(Playtest.score(restored),Playtest.score(duel));
  assert.equal(restored.opponentReligion.oracles[0].intentType,'food.produce');
  assert.equal(restored.oracleStrategy.counterAttractionEnabled,true);
  assert.ok(W.validate(restored).ok);
});
test('playtest is wired into single-file export without requiring external profiles',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  const bundler=fs.readFileSync(path.join(root,'tools/build-single.cjs'),'utf8');
  assert.ok(html.includes('id="playtestScenario"'));
  assert.ok(html.includes('src/playtest.js'));
  assert.ok(app.includes('Playtest.createWorld('));
  assert.ok(app.includes('strategyAttraction'));
  assert.ok(app.includes("loadPlaytest()"));
  assert.ok(bundler.includes('WOG_PLAYTEST_PROFILE'));
  assert.ok(bundler.includes('src/playtest.js'));
  assert.equal(Configuration.defaultScenario,'duel');
});
