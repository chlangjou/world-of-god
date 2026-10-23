/* Playtest-only scenario orchestration. No DOM and no global rule changes. */
(function(root){
'use strict';
const PLAYER_HOMES=['h1','h2','h3','h4','h9'];
const RIVAL_HOMES=['h5','h6','h7','h8','h12'];
const OFFSETS=[[3,0],[-3,0],[0,3],[0,-3],[4,3]];
function buildStrategy(original,playtest,mode){
  if(original?.profileId!=='oracle-specialization-v0.1'||
     playtest?.profileId!=='playable-evidence-v0.1')
    throw Error('未載入有效的宗教策略和試玩 Profile');
  return {...original,...playtest.faith.shared,...playtest.faith[mode],
    faithDefenseMatrix:JSON.parse(JSON.stringify(original.faithDefenseMatrix))};
}
// Populate curated playable worlds with ordinary unpartnered adult children.
// Initial families remain real households; no people, homes, Faith or food are created.
function seedYoungAdults(s){
  const F=s.agriculture?.familyExpansion;
  if(!F?.enabled)return {youngAdults:0,communities:0};
  const grouped=s.settlements.map(t=>t.householdIds.map(id=>
    s.households.find(h=>h.id===id)).filter(Boolean));
  const assigned=new Set(s.settlements.flatMap(t=>t.householdIds));
  const original=s.households.filter(h=>!assigned.has(h.id));
  const opponentHomes=new Set((s.opponent?.initialHouseholdIndexes||[]).map(i=>'h'+(i+1)));
  const local=original.filter(h=>!opponentHomes.has(h.id));
  const rival=original.filter(h=>opponentHomes.has(h.id));
  if(local.length)grouped.push(local);
  if(rival.length)grouped.push(rival);
  const createYoungAdults=s.playtest?.mode!=='duel'; // preserve 30-person Nurture evidence lesson
  let youngAdults=0;
  for(const [groupIndex,homes] of grouped.entries()){
    const sorted=[...homes].sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
    for(const [i,h] of sorted.entries()){
      const child=s.people.find(p=>p.alive&&p.householdId===h.id&&p.stage==='child');
      if(!child)continue;
      child.genderRole=(i<2?i:i+groupIndex)%2===0?'gestate':'fertilize';
      if(!createYoungAdults||i>=Math.min(sorted.length,Math.max(0,F.starterYouthsPerCommunity||0)))continue;
      child.stage='adult';
      const min=Math.max(18,F.starterYoungAdultMinAge||19);
      const max=Math.max(min,F.starterYoungAdultMaxAge||22);
      child.age=min+(i%(max-min+1));
      child.occupation=child.proficiency.food>=child.proficiency.gather?'food_producer':'gatherer';
      child.partnerId=null;
      youngAdults++;
    }
  }
  return {youngAdults,communities:grouped.length};
}
function establishDuel(s,S,profile){
  if(!s.opponent?.enabled||!s.opponentReligion||!s.opponentCamp)
    throw Error('宗教對決必須有獨立的 AI 起始位置');
  const kept=new Set([...PLAYER_HOMES,...RIVAL_HOMES]);
  s.households=s.households.filter(h=>kept.has(h.id));
  s.people=s.people.filter(p=>kept.has(p.householdId));
  const reference=s.settlements[0];
  if(!reference||s.people.length!==30||s.households.length!==10)
    throw Error('對決開場與已驗證的 30 人生成模型不一致');
  const town=(id,center,homes,label)=>({...JSON.parse(JSON.stringify(reference)),
    id,name:label,native:false,x:center.x,y:center.y,foundedAtHour:0,
    householdIds:homes.slice(),storage:{food:45,wood:0,stone:0,fiber:0},
    granary:null,workDemand:{foodPressure:0,housingPressure:0},
    foodShortageDays:0,famineDays:0,famineReliefDays:0,
    famineActive:false,lastDailyUnmetFood:0});
  s.settlements=[
    town('s1',s.camp,PLAYER_HOMES,'晨曦 · 育兒聚落'),
    town('s2',s.opponentCamp,RIVAL_HOMES,'暮影 · 存糧聚落')
  ];
  for(const [faith,households,center,settlementId] of [
    ['r1',PLAYER_HOMES,s.camp,'s1'],
    ['r2',RIVAL_HOMES,s.opponentCamp,'s2']]){
    for(const [idx,id] of households.entries()){
      const home=s.households.find(h=>h.id===id);
      home.x=center.x+OFFSETS[idx][0];
      home.y=center.y+OFFSETS[idx][1];
      home.home=true;
      home.buildProgress=s.rules.hutWork;
      home.buildMaterialsPaid=true;
      home.inventory={food:12,wood:0,stone:0,fiber:0};
      for(const p of s.people.filter(p=>p.householdId===id)){
        p.x=home.x;p.y=home.y;p.settlementId=settlementId;
        p.religionId=faith;p.devotion=profile.duel.initialDevotion;
      }
    }
  }
  if(!S.validate(s).ok)throw Error('對決開場初始化失敗');
  for(let i=0;i<profile.duel.startDay;i++)S.advanceTicks(s,3);
  const current=S.stats(s);
  if(s.people.length!==30||current.followers!==15||current.opponentFollowers!==15||
     s.people.some(p=>!p.alive||p.devotion!==profile.duel.initialDevotion)||
     !s.religion.saints.length||!s.opponentReligion.saints.length||
     !s.religion.priests.length||!s.opponentReligion.priests.length)
    throw Error('對決世界尚未形成完整 15:15 Saint/Priest 開局');
  const issue=S.issueOracle(s,{godId:s.opponentGod.id,
    saintId:s.opponentReligion.saints[0],
    intentType:profile.duel.opponentStrategy});
  if(!issue.ok)throw Error('AI 存糧神諭無法正常發佈');
  s.playtest={
    profileId:profile.profileId,mode:'duel',
    originalPlayerIds:s.people.filter(p=>p.religionId==='r1').map(p=>p.id),
    originalRivalIds:s.people.filter(p=>p.religionId==='r2').map(p=>p.id),
    startedAtHour:s.hour,goalNetOriginalConversions:profile.duel.goalNetOriginalConversions,
    opponentOracleId:issue.oracleId,
    initialDevotion:profile.duel.initialDevotion
  };
  if(!S.validate(s).ok)throw Error('對決創世驗證未通過');
  return s;
}
function createWorld(S,options){
  const {mode,seed,playtestProfile,oracleStrategyProfile,opponentProfile,
    balanceProfile,religionProfile,mobilityProfile,divineProfile,shrineProfile,politicsProfile,difficulty,opponentMode,victoryProfile,godCount=2}=options;
  if(!['duel','native'].includes(mode))throw Error('未知試玩情境');
  const deityCount=mode==='duel'?2:Math.max(1,Math.min(4,Math.round(godCount)));
  if(deityCount>2&&opponentMode==='off')throw Error('三神／四神情境需要 AI 神明');
  const oracleStrategy=buildStrategy(oracleStrategyProfile,playtestProfile,mode);
  const chosenSeed=mode==='duel'?playtestProfile.duel.seed:
    (seed||playtestProfile.native.seed);
  if(mode==='duel'&&opponentMode==='off')
    throw Error('30人宗教對決需要 AI 神；請改選自然河谷');
  const opponent=opponentMode==='off'?null:{
    ...opponentProfile,difficulty:difficulty||'standard',
    ...(mode==='duel'?{startDay:playtestProfile.duel.startAIDecisionsOnDay}:{})
  };
  const s=S.create({seed:chosenSeed,
    ...(balanceProfile?{balanceProfile}:{}),
    religionProfile,mobilityProfile,divineProfile,shrineProfile,politicsProfile,oracleStrategyProfile:oracleStrategy,
    worldGenesisMode:'native',opponentProfile:opponent,victoryProfile,
    additionalAiGods:deityCount>2?deityCount-2:0,
    fourGodGenesis:deityCount===4?playtestProfile.native.fourGodGenesis:null});
  if(mode==='duel'){
    const ready=establishDuel(s,S,playtestProfile);
    ready.playtest.starterPopulation=seedYoungAdults(ready);
    S.resetVictory(ready,victoryProfile); // The playable opening starts at Day 10, not Genesis.
    return ready;
  }
  s.playtest={profileId:playtestProfile.profileId,mode:'native',
    startedAtHour:s.hour,godCount:deityCount,starterPopulation:seedYoungAdults(s)};
  S.resetVictory(s,victoryProfile);
  return s;
}
function score(s){
  const p=s?.playtest;
  if(p?.mode!=='duel'||!Array.isArray(p.originalRivalIds)||
     !Array.isArray(p.originalPlayerIds))return null;
  const people=new Map(s.people.map(person=>[person.id,person]));
  const gained=p.originalRivalIds.filter(id=>{
    const person=people.get(id);
    return person?.alive&&person.religionId===s.religion.id;
  }).length;
  const lost=p.originalPlayerIds.filter(id=>{
    const person=people.get(id);
    return person?.alive&&person.religionId===s.opponentReligion?.id;
  }).length;
  const days=Math.floor((s.hour-p.startedAtHour)/24);
  return {gained,lost,net:gained-lost,days,
    targetDays:100,goal:p.goalNetOriginalConversions||3,
    won:gained-lost>=(p.goalNetOriginalConversions||3),
    oldAICoreStill:s.people.filter(x=>p.originalRivalIds.includes(x.id)&&
      x.alive&&x.religionId===s.opponentReligion.id&&x.devotion>=40).length};
}
const API={buildStrategy,createWorld,score};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_PLAYTEST=API;
})(typeof window!=='undefined'?window:null);
