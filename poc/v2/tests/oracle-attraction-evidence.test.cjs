'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const S=require('../config/oracle-specialization-v0.1.json');
const T=require('../config/oracle-attraction-evidence-study-v0.1.json');
const Prior=require('../tools/oracle-30-core-ratio-sweep.cjs');
const Study=require('../tools/oracle-attraction-evidence-study.cjs');

test('scaled losses are fractional only with explicit opt-in; v0.1 saves unchanged',()=>{
  const basic=W.create({oracleStrategyProfile:{...S,counterDoubtStep:2.5}});
  assert.equal(basic.oracleStrategy.counterDoubtStep,3);
  assert.equal(basic.oracleStrategy.counterAttractionEnabled,undefined);
  assert.equal(basic.oracleStrategy.counterPairedRandom,undefined);
  const opt=W.create({oracleStrategyProfile:{...S,
    counterDoubtStep:2.5,counterFractionalLoss:true,counterAttractionEnabled:true,
    counterPairedRandom:true,counterAttractionGain:8}});
  assert.equal(opt.oracleStrategy.counterDoubtStep,2.5);
  assert.equal(opt.oracleStrategy.counterAttractionGain,8);
  const restored=W.restore(JSON.stringify(opt));
  assert.equal(restored.oracleStrategy.counterDoubtStep,2.5);
  assert.equal(restored.oracleStrategy.counterPairedRandom,true);
  assert.equal(restored.oracleStrategy.counterAttractionEnabled,true);
});
test('the historical 5-point/14-day rate is preserved numerically by 2.5/7',()=>{
  assert.equal(T.original.lossPoints/T.original.repeatDays,
    T.scaled.lossPoints/T.scaled.repeatDays);
  assert.deepEqual(T.seeds,['dry-stress','opponent-competition-replay','valley-spring-01']);
  assert.equal(T.mainWindowDays,undefined);
  assert.equal(T.studyDays,100);
  assert.equal(T.retentionDays,30);
});
test('Oracle issuance alone creates no attractive evidence or opponent followers',()=>{
  const s=Study.fixedSimulation('dry-stress');
  const before=s.people.map(p=>[p.id,p.religionId,p.devotion]);
  const p=W.issueOracle(s,{saintId:s.religion.saints[0],intentType:'family.nurture'});
  const ai=W.issueOracle(s,{godId:s.opponentGod.id,saintId:s.opponentReligion.saints[0],
    intentType:'food.produce'});
  assert.ok(p.ok&&ai.ok);
  assert.deepEqual(s.people.map(p=>[p.id,p.religionId,p.devotion]),before);
  assert.ok(s.people.every(p=>!p.strategyAttraction));
  assert.equal(s.counts.strategyAttractionConversions||0,0);
});
test('without verified work or cross-town contact, attraction cannot recruit',()=>{
  const s=Study.fixedSimulation('dry-stress');
  const r=s.oracleStrategy;
  Object.assign(r,{
    counterFractionalLoss:true,counterDoubtStep:2.5,counterRepeatDays:7,
    counterRepeatIncludesFollowup:true,counterPairedRandom:true,
    counterAttractionEnabled:true,counterAttractionGain:8,
    counterAttractionMinEvidence:5,counterAttractionMargin:0,
    counterAttractionConversionChance:.3,counterAttractionMaxChance:.55,
    counterAttractionRecencyDays:21,counterEvidenceWorkMin:100000
  });
  assert.ok(W.issueOracle(s,{saintId:s.religion.saints[0],
    intentType:'family.nurture'}).ok);
  assert.ok(W.issueOracle(s,{godId:s.opponentGod.id,
    saintId:s.opponentReligion.saints[0],intentType:'food.produce'}).ok);
  for(let day=0;day<100;day++)W.advanceTicks(s,3);
  assert.equal(s.counts.strategyAttractionEvidence||0,0);
  assert.equal(s.counts.strategyAttractionConversions||0,0);
  assert.ok(s.people.every(p=>p.religionId===(p.householdId==='h5'||p.householdId==='h6'||
    p.householdId==='h7'||p.householdId==='h8'||p.householdId==='h12'?'r2':'r1')));
  assert.ok(W.validate(s).ok);
});
test('paid credibility (not bare doctrine) is required for advantaged conversion',()=>{
  const cases=Study.run({seed:'dry-stress',only:[
    'devotion-only/advantage','earned-attraction/neutral',
    'earned-attraction/advantage','earned-attraction/reverse'],budgetMs:20000});
  const by=Object.fromEntries(cases.cases.map(c=>[c.channel+'/'+c.ratio,c]));
  const none=by['devotion-only/advantage'],neutral=by['earned-attraction/neutral'],
    favored=by['earned-attraction/advantage'],reverse=by['earned-attraction/reverse'];
  assert.equal(none.score.originalAIConverted,0);
  assert.ok(favored.score.advantagedNetOriginalConversions>
    neutral.score.advantagedNetOriginalConversions);
  assert.ok(favored.score.advantagedNetOriginalConversions>
    reverse.score.advantagedNetOriginalConversions);
  assert.equal(favored.score.originalAIStayedNewFaith30d,
    favored.score.originalAIConverted);
  assert.equal(favored.score.originalPlayerConverted,0);
  assert.ok(favored.converted.length>0);
  // Confirmed design exception: multiple authentic outcomes may support a
  // voluntary faith switch while ORIGINAL Devotion is still 40+.
  const previouslyCommitted=favored.converted.filter(p=>
    p.firstConversionDay<=100&&p.fromDevotion>=40);
  assert.ok(previouslyCommitted.length>0,
    'evidence-led switching of a committed believer is not restricted by the ordinary <20 gate');
  for(const changed of favored.converted){
    assert.equal(changed.originalFaith,'r2');
    assert.ok(changed.observations>=T.attraction.minEvidenceObservations);
    assert.ok(changed.oracleId&&changed.sourceTownId);
    assert.ok(changed.earnedAttraction>=changed.fromDevotion);
    assert.ok(changed.firstConversionDay>0);
  }
  assert.ok(cases.cases.every(c=>c.checkpoints.every(x=>x.valid)));
  assert.ok(cases.cases.every(c=>c.checkpoints[0].sourceEvidence.attributionConversions===0));
});
