/* World of God — Web-first MVP-0. Standalone deterministic simulation, no DOM or wall clock. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WoG2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'mvp0-web-2';
  const DEFAULT_RULES = Object.freeze({
    width: 64, height: 64, initialHouseholds: 8, tickHours: 8, daysPerMonth: 30,
    foodNeedAdult: 0.38, foodNeedChild: 0.25, farmYieldMultiplier: 1.18, naturalDpPerDay: 0.16,
    devotionDpPerWeightDay: 0.075, maxDp: 100, initialDp: 42,
    householdShare: 0.20, hutWood: 4, hutFiber: 2, hutWork: 3,
    settlementMinHuts: 4, settlementClusterDistance: 13,
    rainMaxDays: 30, rainBaseCooldownDays: 30,
    rainSupportMaxIntensity: 1.2, rainRadiusMax: 14,
    oracleQuota: 4, oracleRefillDays: 90, oracleDurationDays: 180,
    oracleCommunicationRadius: 13, faithThreshold: 40,
    defaultRainRadius: 7, defaultRainIntensity: 0.85, defaultRainDays: 10,
    eventLimit: 200, prayerLimit: 18, daysPerYear: 360,
    conceptionChancePerMonth: 0.12, conceptionMinFoodDays: 6, postpartumRecoveryDays: 60,
    familyReturnFoodDays: 2, famineAlertDays: 21, famineReliefDays: 7, isolatedFamineDays: 45
  });


  // Independent, data-configurable first-batch Miracle skills. Rain retains its v2
  // public API and original cost; cooldowns now scale with each cast's workload.
  const POWER_DEFAULTS=Object.freeze({
    ripening:{label:'促熟 Ripening',baseCost:8,cooldownDays:12,defaultRadius:7,defaultIntensity:1,defaultDurationDays:12,maxDays:30,maxIntensity:2.5,instant:false},
    harvest:{label:'豐收 Harvest',baseCost:10,cooldownDays:13,defaultRadius:7,defaultIntensity:1,defaultDurationDays:0,maxDays:0,maxIntensity:2,instant:true},
    heal:{label:'治療 Heal',baseCost:7,cooldownDays:9,defaultRadius:6,defaultIntensity:1,defaultDurationDays:0,maxDays:0,maxIntensity:2,instant:true},
    efficiency:{label:'效率祝福 Efficiency',baseCost:10,cooldownDays:16,defaultRadius:7,defaultIntensity:1,defaultDurationDays:14,maxDays:30,maxIntensity:2,instant:false},
    drought:{label:'乾旱 Drought',baseCost:16,cooldownDays:30,defaultRadius:7,defaultIntensity:1,defaultDurationDays:12,maxDays:30,maxIntensity:2,instant:false,offensive:true},
    lightning:{label:'雷擊 Lightning',baseCost:14,cooldownDays:18,defaultRadius:3,defaultIntensity:1,defaultDurationDays:0,maxDays:0,maxIntensity:2,instant:true,offensive:true},
    confusion:{label:'混亂 Confusion',baseCost:11,cooldownDays:19,defaultRadius:7,defaultIntensity:1,defaultDurationDays:12,maxDays:30,maxIntensity:2,instant:false,offensive:true},
    blindness:{label:'致盲 Blindness',baseCost:11,cooldownDays:19,defaultRadius:7,defaultIntensity:1,defaultDurationDays:12,maxDays:30,maxIntensity:2,instant:false,offensive:true}
  });
  const POWER_PROFILE_ID='divine-powers-v0.1';
  function divinePowerRules(profile){
    const source=profile?.profileId===POWER_PROFILE_ID?profile:{};
    const powers={};
    for(const [type,base] of Object.entries(POWER_DEFAULTS)){
      const configured=source.powers?.[type]||{};
      powers[type]={...base};
      for(const key of ['baseCost','cooldownDays','defaultRadius','defaultIntensity','defaultDurationDays','maxDays','maxIntensity']){
        if(Number.isFinite(configured[key]))powers[type][key]=clamp(configured[key],0,key==='cooldownDays'?120:100);
      }
    }
    return {profileId:POWER_PROFILE_ID,powers,
      // A short cast still has a modest nonzero cooldown; the rest scales with
      // requested duration so wide 5-day weather never inherits 30-day cooldown.
      cooldownDurationFloorFraction:clamp(num(source.cooldownDurationFloorFraction,.18),.05,.45),
      destructiveMinWeighted:clamp(num(source.destructiveMinWeighted,4),0,100),
      ripeningGrowthPerIntensity:clamp(num(source.ripeningGrowthPerIntensity,2.3),.1,6),
      harvestExtraPerIntensity:clamp(num(source.harvestExtraPerIntensity,.9),.1,2.5),
      harvestMaxExtraCapRatio:clamp(num(source.harvestMaxExtraCapRatio,1.5),.2,3),
      efficiencyWorkBonus:clamp(num(source.efficiencyWorkBonus,.55),.05,2),
      confusionScoreNoise:clamp(num(source.confusionScoreNoise,5),.1,12),
      blindnessReachReduction:clamp(num(source.blindnessReachReduction,.7),.1,.9),
      spreadSermonBonus:clamp(num(source.spreadSermonBonus,.24),.05,1)};
  }

  // Religion Propagation v0.1: tunable, seed-stable social pulses (separate from economic RNG).
  const RELIGION_DEFAULTS=Object.freeze({
    profileId:'religion-propagation-v0.1',pulseDays:7,minimumChildAge:4,
    priesthoodEnabled:true,priestTeachingMultiplier:1.8,
    contactRadius:11,interSettlementReach:30,
    householdJoinChance:.13,socialJoinChance:.055,priestJoinChance:.24,
    priestRivalDoubtChance:.58,priestRivalConversionChance:.30,priestRivalDoubtStep:3,
    settlementVisitChance:.012,weakLearningChance:.26,ordinaryConsolidationCap:60,
    childStrongLearningChance:.32,childOrdinaryLearningChance:.14,
    regionalSaintChancePerMonth:.12,oracleRelayChance:.55,
    // Religion Competition v0.3: real, attributable results rather than button
    // presses raise Devotion. Ordinary 40+ sermon protection is unchanged.
    miracleWitnessRadius:7,miracleAttributionRadius:11,
    miracleEvidenceRepeatDays:28,miracleInterestDays:90,
    miracleInterestThreshold:10,miracleInterestJoinChance:.27,
    miracleRivalDoubtFactor:.65,miracleWitnessRepeatFactor:.25,
    healMinRecovery:7,healDirectDevotion:19,healWitnessDevotion:3,
    efficiencyDirectDevotion:14,efficiencyWitnessDevotion:2,
    harvestWitnessDevotion:2,ripeningWitnessDevotion:2,
    ripeningEvidenceMinimumCrop:2.5,rainWitnessDevotion:3,
    spreadOracleJoinBonus:.11
  });
  function religionRules(profile){
    const r={...RELIGION_DEFAULTS};
    if(profile?.profileId===r.profileId)for(const [k,v] of Object.entries(r))
      if(typeof v==='number'&&Number.isFinite(profile[k]))r[k]=profile[k];
    if(profile?.profileId===r.profileId && typeof profile.priesthoodEnabled==='boolean')
      r.priesthoodEnabled=profile.priesthoodEnabled;
    r.pulseDays=Math.round(clamp(r.pulseDays,1,90));
    r.minimumChildAge=Math.round(clamp(r.minimumChildAge,0,17));
    r.contactRadius=clamp(r.contactRadius,1,25);
    r.interSettlementReach=clamp(r.interSettlementReach,0,64);
    for(const k of Object.keys(r))if(k.endsWith('Chance')||k.endsWith('ChancePerMonth'))r[k]=clamp(r[k],0,1);
    r.ordinaryConsolidationCap=Math.round(clamp(r.ordinaryConsolidationCap,40,79));
    r.priestTeachingMultiplier=clamp(r.priestTeachingMultiplier,1,3);
    r.priestRivalDoubtStep=Math.round(clamp(r.priestRivalDoubtStep,1,8));
    r.weakLearningChance=clamp(r.weakLearningChance,0,1);
    r.childStrongLearningChance=clamp(r.childStrongLearningChance,0,1);
    r.childOrdinaryLearningChance=clamp(r.childOrdinaryLearningChance,0,1);
    for(const k of ['miracleWitnessRadius','miracleAttributionRadius'])
      r[k]=clamp(r[k],2,25);
    r.miracleEvidenceRepeatDays=clamp(r.miracleEvidenceRepeatDays,1,180);
    r.miracleInterestDays=clamp(r.miracleInterestDays,7,365);
    r.miracleInterestThreshold=clamp(r.miracleInterestThreshold,4,40);
    r.miracleInterestJoinChance=clamp(r.miracleInterestJoinChance,0,1);
    r.miracleRivalDoubtFactor=clamp(r.miracleRivalDoubtFactor,0,1);
    r.miracleWitnessRepeatFactor=clamp(r.miracleWitnessRepeatFactor,0,1);
    r.healMinRecovery=clamp(r.healMinRecovery,1,50);
    for(const k of ['healDirectDevotion','healWitnessDevotion',
      'efficiencyDirectDevotion','efficiencyWitnessDevotion',
      'harvestWitnessDevotion','ripeningWitnessDevotion','rainWitnessDevotion'])
      r[k]=clamp(r[k],0,35);
    r.ripeningEvidenceMinimumCrop=clamp(r.ripeningEvidenceMinimumCrop,.1,50);
    r.spreadOracleJoinBonus=clamp(r.spreadOracleJoinBonus,0,.5);
    return r;
  }
  const OPPONENT_DEFAULTS=Object.freeze({profileId:'opponent-v0.2',enabled:true,
    name:'暮影信仰',originMode:'separated-native',initialHouseholdIndexes:[4,5,6,7],
    nativeVillages:3,nativeHouseholdsPerVillage:3,minimumOriginDistance:29,
    championDevotion:53,familyDevotion:29,initialDp:42,startDay:14,
    decisionIntervalDays:12,spreadOracleDurationDays:150,offensiveEveryTurns:4});
  const OPPONENT_LEGACY_DEFAULTS=Object.freeze({...OPPONENT_DEFAULTS,
    profileId:'opponent-v0.1',originMode:'mixed',initialHouseholdIndexes:[5,6],
    nativeVillages:0});
  function opponentRules(profile){
    if(![OPPONENT_DEFAULTS.profileId,OPPONENT_LEGACY_DEFAULTS.profileId].includes(profile?.profileId)||
      profile.enabled===false)return null;
    const base=profile.profileId===OPPONENT_LEGACY_DEFAULTS.profileId?
      OPPONENT_LEGACY_DEFAULTS:OPPONENT_DEFAULTS;
    const r={...base};
    for(const k of ['championDevotion','familyDevotion','initialDp','startDay',
      'decisionIntervalDays','spreadOracleDurationDays','offensiveEveryTurns',
      'nativeVillages','nativeHouseholdsPerVillage','minimumOriginDistance'])
      if(Number.isFinite(profile[k]))r[k]=profile[k];
    r.championDevotion=Math.round(clamp(r.championDevotion,40,79));
    r.familyDevotion=Math.round(clamp(r.familyDevotion,20,39));
    r.initialDp=clamp(r.initialDp,0,100);
    r.startDay=Math.round(clamp(r.startDay,1,360));
    r.decisionIntervalDays=Math.round(clamp(r.decisionIntervalDays,3,90));
    r.spreadOracleDurationDays=Math.round(clamp(r.spreadOracleDurationDays,30,720));
    r.offensiveEveryTurns=Math.round(clamp(r.offensiveEveryTurns,2,30));
    r.nativeVillages=Math.round(clamp(r.nativeVillages,0,4));
    r.nativeHouseholdsPerVillage=Math.round(clamp(r.nativeHouseholdsPerVillage,3,4));
    r.minimumOriginDistance=clamp(r.minimumOriginDistance,26,45);
    r.originMode=base.originMode==='mixed'?'mixed':'separated-native';
    r.initialHouseholdIndexes=Array.isArray(profile.initialHouseholdIndexes)?
      [...new Set(profile.initialHouseholdIndexes.filter(n=>Number.isInteger(n)&&n>=3&&n<10))]
        .slice(0,r.originMode==='mixed'?3:5):base.initialHouseholdIndexes.slice();
    r.name=typeof profile.name==='string'?profile.name.slice(0,30):base.name;
    return r;
  }
  function allFaiths(s){return s.opponent?.enabled?[s.religion,s.opponentReligion]:[s.religion];}
  function faithOf(s,id){return allFaiths(s).find(f=>f.id===id)||null;}
  function actorFor(s,godId){
    if(s.opponent?.enabled&&godId===s.opponentGod.id)
      return {faith:s.opponentReligion,god:s.opponentGod,enemy:true};
    return {faith:s.religion,god:s.god,enemy:false};
  }
  function faithDpRate(s,faith){
    const weight=living(s).filter(p=>p.religionId===faith.id)
      .reduce((n,p)=>n+faithfulWeight(p.devotion),0);
    return s.rules.naturalDpPerDay+weight*s.rules.devotionDpPerWeightDay;
  }
  function religionRand(s,faith=s.religion){
    const key=faith?.id===s.opponentReligion?.id?'opponentRng':'religionRng';
    let x=s[key]>>>0;
    x^=x<<13;x^=x>>>17;x^=x<<5;
    s[key]=x>>>0;
    return s[key]/4294967296;
  }
  const HUMAN_NAMES = ['青禾','木川','雨生','阿岑','松遠','小滿','雲舒','柏石','穗寧','如月','望山','松原','溪明','海棠','春野','南星','芷晴','阿黎','長空','岑音','林羽','安年','初光','碧落','稻安','嵐風','稻香','晨露','南風','青木','田川','百合'];
  const FAMILY_NAMES = ['青禾家','溪畔家','松原家','山影家','白石家','風林家','雲野家','河望家','田北家','林北家'];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const num = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const days = (s) => Math.floor(s.hour / 24);
  const monthHours = (s) => s.rules.daysPerMonth * 24;
  const tile = (s, x, y) => s.tiles[y * s.width + x];
  const living = s => s.people.filter(p => p.alive);
  const householdOf = (s, p) => s.households.find(h => h.id === p.householdId);
  const hasSettlement = s => s.settlements.length > 0;

  function hash(str) {
    let h = 2166136261;
    for (const char of String(str)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0 || 123456789;
  }
  function rand(s) {
    let x = s.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
  }
  function rulesFrom(input) {
    const result = { ...DEFAULT_RULES };
    const adjustable = input && input.rules && typeof input.rules === 'object' ? input.rules : {};
    for (const [key, original] of Object.entries(DEFAULT_RULES)) {
      if (typeof original === 'number' && Number.isFinite(adjustable[key]) && adjustable[key] >= 0)
        result[key] = adjustable[key];
    }
    // These invariants keep user-supplied config from creating invalid dimensions/cadences.
    result.width = Math.round(clamp(result.width, 32, 128));
    result.height = Math.round(clamp(result.height, 32, 128));
    result.initialHouseholds = Math.round(clamp(result.initialHouseholds, 4, 10));
    result.tickHours = 8; // canonical activity/work/rest cycle for this ruleset
    result.daysPerMonth = Math.max(1, Math.round(result.daysPerMonth));
    result.rainMaxDays = Math.max(1, Math.round(result.rainMaxDays));
    result.rainBaseCooldownDays = Math.max(1, result.rainBaseCooldownDays);
    result.oracleQuota = Math.max(1, Math.round(result.oracleQuota));
    result.oracleRefillDays = Math.max(1, Math.round(result.oracleRefillDays));
    result.oracleDurationDays = Math.max(1, Math.round(result.oracleDurationDays));
    result.eventLimit = Math.max(20, Math.round(result.eventLimit));
    result.prayerLimit = Math.max(5, Math.round(result.prayerLimit));
    result.householdShare = clamp(result.householdShare, 0, 1);
    return result;
  }
  function log(s, kind, text, reasons = [], entities = []) {
    const evt = { id: ++s.eventSeq, hour: s.hour, kind, text, reasons, entities };
    s.events.push(evt);
    if (s.events.length > s.rules.eventLimit) s.events.shift();
    return evt.id;
  }
  // UI notices are factual simulation events, not an animation-clock heuristic.
  // Only recent notices are retained; they never change world decisions or RNG.
  function alertPlayer(s,level,type,text,center,extra={}){
    s.attention ||= {seq:0,items:[],lastPreachingHour:-Infinity};
    const valid=center&&Number.isFinite(center.x)&&Number.isFinite(center.y);
    const note={seq:++s.attention.seq,hour:s.hour,level,type,text,
      center:valid?{x:center.x,y:center.y}:null,...extra};
    s.attention.items.push(note);
    if(s.attention.items.length>32)s.attention.items.shift();
    return note;
  }
  function riverX(s, y) {
    return s.width * .46 + Math.sin(y * .17) * 4 + Math.sin(y * .052) * 5;
  }
  function makeMap(s, moisture) {
    const out = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
      const d = Math.abs(x - riverX(s, y));
      const r = rand(s);
      let terrain = d < 1.6 ? 'river' : r < .16 ? 'forest' : r > .93 && d > 6 ? 'rock' : 'meadow';
      const nearRiver = clamp(1 - d / 12);
      const fert = clamp(.39 + rand(s) * .40 + nearRiver * .18, .2, 1);
      const wet = clamp(moisture + nearRiver * .16 + (rand(s) - .5) * .13, .06, .96);
      out.push({ x, y, terrain, moisture: terrain === 'river' ? 1 : wet,
        fertility: fert, crop: 0, forage: terrain === 'river' ? 0 : .3 + rand(s) * .6,
        wood: terrain === 'forest' ? 8 + rand(s) * 8 : .3 + rand(s) * 2,
        fiber: terrain === 'meadow' ? 6 + rand(s) * 3 : rand(s) * 2,
        stone: terrain === 'rock' ? 11 + rand(s) * 7 : rand(s) * 2 });
    }
    return out;
  }
  function nearestLand(s, x, y) {
    const cx = Math.round(clamp(x, 0, s.width - 1)), cy = Math.round(clamp(y, 0, s.height - 1));
    if (tile(s, cx, cy).terrain !== 'river') return { x: cx, y: cy };
    for (let r = 1; r <= 12; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      const nx = cx + ox, ny = cy + oy;
      if (nx >= 0 && nx < s.width && ny >= 0 && ny < s.height && tile(s, nx, ny).terrain !== 'river') return { x: nx, y: ny };
    }
    return { x: cx, y: cy };
  }
  function generate(s, startMoisture) {
    s.tiles = makeMap(s, startMoisture);
    const river = riverX(s, Math.floor(s.height / 2));
    s.camp = nearestLand(s, river + 7, Math.floor(s.height / 2));
    const count = s.rules.initialHouseholds;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const hx = s.camp.x + Math.cos(angle) * (3 + (i % 3));
      const hy = s.camp.y + Math.sin(angle) * (3 + (i % 2));
      const loc = nearestLand(s, hx, hy);
      const h = { id: 'h' + (i + 1), name: FAMILY_NAMES[i], x: loc.x, y: loc.y,
        members: [], inventory: { food: 9 + (i % 3) * 2, wood: 0, stone: 0, fiber: 0 },
        home: false, buildProgress: 0, buildMaterialsPaid: false, needs: {}, migrated: 0, foodShortageDays: 0 };
      s.households.push(h);
      for (let j = 0; j < 3; j++) {
        const idx = i * 3 + j;
        const isChild = j === 2;
        const age = isChild ? 5 + i % 7 : 21 + (i * 3 + j * 5) % 24;
        const belief = i === 0 && j === 0 ? 70 : i < 3 && j === 0 ? 46 : i % 2 === 0 ? 29 + j * 2 : 20 + i % 5;
        const p = { id: 'p' + (idx + 1), name: HUMAN_NAMES[idx % HUMAN_NAMES.length],
          x: loc.x + (j - 1) * .35, y: loc.y + (j - 1) * .2, householdId: h.id, settlementId: null,
          age, stage: isChild ? 'child' : 'adult', health: 100, hunger: 0, alive: true,
          genderRole: j === 1 ? 'gestate' : 'fertilize', partnerId: isChild ? null : 'p' + (i * 3 + (j === 0 ? 2 : 1)),
          pregnancyDueHour: null, recoveryUntilHour: 0, occupation: j === 0 ? 'food_producer' : j === 1 ? 'gatherer' : 'dependent',
          ...(s.agriculture?.familyExpansion?.enabled?{parentIds:isChild?['p'+(i*3+1),'p'+(i*3+2)]:[],originHouseholdId:h.id}:{}),
          proficiency: { food: s.agriculture ? s.agriculture.worker.startingSkillRange[0] + rand(s) * (s.agriculture.worker.startingSkillRange[1]-s.agriculture.worker.startingSkillRange[0]) : .35 + rand(s) * .45, gather: .25 + rand(s) * .5, build: .18 + rand(s) * .45 },
          activity: 'rest', devotion: belief, religionId: belief >= 20 ? 'r1' : null,
          receptivity: i === 0 && j === 0 ? .98 : rand(s), lastDecision: null, lastFaithEvidence: null,
          lastWorkHour: -1, lastOracleWorkHour: -1, activityReason: '剛進入世界，尚未開始日常活動' };
        s.people.push(p); h.members.push(p.id);
      }
    }
    // Farmable patches arise from terrain suitability, not free food stocks.
    let patches = 0;
    for (let y = s.camp.y - 10; y <= s.camp.y + 10; y++) for (let x = s.camp.x - 11; x <= s.camp.x + 11; x++) {
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
      const t = tile(s, x, y), dd = Math.hypot(x - s.camp.x, y - s.camp.y);
      if (t.terrain === 'meadow' && dd > 2 && dd < 11 && t.fertility > .52 && rand(s) > .37) {
        t.terrain = 'field'; t.crop = .25 + rand(s) * .43; patches++;
      }
    }
    if (patches < 8) for (let y = s.camp.y - 8; y <= s.camp.y + 8; y++) for (let x = s.camp.x - 8; x <= s.camp.x + 8; x++) {
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
      const t = tile(s, x, y);
      if (t.terrain === 'meadow' && rand(s) > .6) { t.terrain = 'field'; t.crop = .35; }
    }
  }
  // World-first genesis. A God does not own the land simply because it spawns
  // nearby: native settlements already exist, with real homes and unaligned people.
  function genesisFieldPatches(s,center){
    let patches=0;
    for(let y=Math.max(0,Math.floor(center.y-10));y<=Math.min(s.height-1,Math.ceil(center.y+10));y++)
      for(let x=Math.max(0,Math.floor(center.x-10));x<=Math.min(s.width-1,Math.ceil(center.x+10));x++){
        const t=tile(s,x,y),d=dist(t,center);
        if(t.terrain!=='meadow'||d<=2||d>=10||t.fertility<.52)continue;
        if(rand(s)<.37)continue;
        t.terrain='field';t.crop=.25+rand(s)*.43;patches++;
      }
    if(patches<8)for(let y=Math.max(0,Math.floor(center.y-8));y<=Math.min(s.height-1,Math.ceil(center.y+8));y++)
      for(let x=Math.max(0,Math.floor(center.x-8));x<=Math.min(s.width-1,Math.ceil(center.x+8));x++){
        const t=tile(s,x,y);
        if(t.terrain==='meadow'&&dist(t,center)<8&&rand(s)>.55){
          t.terrain='field';t.crop=.35;patches++;
        }
      }
    return patches;
  }
  function locateOpponentOrigin(s,minimumDistance){
    const river=y=>riverX(s,y);
    let best=null,score=-Infinity;
    // Search the opposite river bank and north-west side of this compact PoC
    // map. No random choice or hard-coded occupied tile; both have resources.
    for(let y=9;y<Math.floor(s.height*.5)-4;y++)
      for(let x=7;x<Math.floor(s.width*.43);x++){
        const t=tile(s,x,y),d=dist(t,s.camp),fromRiver=river(y)-x;
        if(t.terrain!=='meadow'||d<minimumDistance||fromRiver<6||fromRiver>22)continue;
        let availability=0;
        for(let yy=Math.max(1,y-7);yy<=Math.min(s.height-2,y+7);yy+=2)
          for(let xx=Math.max(1,x-7);xx<=Math.min(s.width-2,x+7);xx+=2){
            const item=tile(s,xx,yy);
            availability+=item.terrain==='meadow'?.08:item.terrain==='forest'?.07:
              item.terrain==='river'?-0.08:0;
          }
        const quality=availability+t.fertility*.5+t.moisture*.5-
          Math.abs(fromRiver-12)*.03-Math.abs(y-14)*.006;
        if(quality>score){best={x,y};score=quality;}
      }
    // The relaxed fallback is used only when a very small/crowded custom map
    // lacks a candidate. It is still opposite the player with no extra people.
    return best||nearestLand(s,Math.round(s.width*.24),Math.round(s.height*.18));
  }
  function placeGenesisHouse(s,h,center,index,count){
    const angle=Math.PI*2*index/count,extent=2.3+(index%2)*.7;
    const pos=nearestLand(s,center.x+Math.cos(angle)*extent,
      center.y+Math.sin(angle)*extent);
    h.x=pos.x;h.y=pos.y;
    for(let j=0;j<h.members.length;j++){
      const p=s.people.find(q=>q.id===h.members[j]);if(!p)continue;
      p.x=pos.x+(j-1)*.35;p.y=pos.y+(j-1)*.2;p.settlementId=null;
    }
  }
  function villageWaterRisk(s,point){
    if(!s.agriculture||!s.nativeWorld)return {risk:0,bank:0};
    const p=s.agriculture.nativeResilience||{};
    const half=s.agriculture.river?.riverHalfWidthCells??1.6;
    const bank=Math.max(0,Math.abs(point.x-riverX(s,point.y))-half);
    const start=num(p.dryRiskStartsAtRiverBankCells,3);
    const end=Math.max(start+1,num(p.dryRiskFullAtRiverBankCells,16));
    return {risk:p.enabled===false?0:clamp((bank-start)/(end-start)),bank};
  }
  function localReservePolicy(s,town){
    const W=s.agriculture?.workDemand||{},p=s.agriculture?.nativeResilience||{};
    const {risk,bank}=villageWaterRisk(s,town);
    const resilience=s.nativeWorld&&s.agriculture&&p.enabled!==false;
    return {risk,bank,
      target:Math.round(num(W.reserveTargetDays,8)+(resilience?
        risk*num(p.activeReserveExtraDaysFarRiver,20):0)),
      relax:Math.round(num(W.reserveRelaxDays,7)+(resilience?
        risk*num(p.relaxReserveExtraDaysFarRiver,18):0)),
      comfort:Math.round(num(W.reserveComfortDays,11)+(resilience?
        risk*num(p.comfortableReserveExtraDaysFarRiver,20):0))};
  }
  function addNativeVillage(s,index,center,number){
    const names=['河岸原生村','北林原生村','谷地原生村','南野原生村'];
    const villageId='n'+(index+1),memberHomes=[];
    for(let i=0;i<number;i++){
      const id='h'+(s.households.length+1);
      const angle=i*2*Math.PI/number;
      const loc=nearestLand(s,center.x+Math.cos(angle)*2.5,center.y+Math.sin(angle)*2.5);
      const source=s.households[i%s.rules.initialHouseholds];
      const h={id,name:names[index]+'第'+(i+1)+'家',x:loc.x,y:loc.y,nativeOrigin:villageId,
        members:[],inventory:{food:source.inventory.food,wood:0,stone:0,fiber:0},
        home:true,buildProgress:s.rules.hutWork,buildMaterialsPaid:true,
        needs:{},migrated:0,foodShortageDays:0};
      const ids=Array.from({length:3},(_,j)=>'p'+(s.people.length+1+j));
      for(let j=0;j<3;j++){
        const original=s.people[j],isChild=j===2;
        const person={...original,id:ids[j],
          name:HUMAN_NAMES[(s.people.length+index*5)%HUMAN_NAMES.length],
          x:loc.x+(j-1)*.35,y:loc.y+(j-1)*.2,householdId:id,settlementId:villageId,
          nativeOrigin:villageId,
          age:isChild?6+((index+i)%8):22+((index*7+i*3+j*4)%23),
          stage:isChild?'child':'adult',health:100,hunger:0,alive:true,
          partnerId:isChild?null:ids[1-j],
          pregnancyDueHour:null,recoveryUntilHour:0,
          parentIds:isChild?[ids[0],ids[1]]:[],originHouseholdId:id,
          occupation:j===0?'food_producer':j===1?'gatherer':'dependent',
          proficiency:{...original.proficiency},
          activity:'rest',devotion:10,religionId:null,
          receptivity:rand(s),lastDecision:null,lastFaithEvidence:null,
          lastWorkHour:-1,lastOracleWorkHour:-1,
          activityReason:'原生聚落居民，原本已在此地自主生活'};
        s.people.push(person);h.members.push(person.id);
      }
      s.households.push(h);memberHomes.push(h.id);
    }
    const t={id:villageId,name:names[index],x:center.x,y:center.y,
      foundedAtHour:0,householdIds:memberHomes,
      storage:{food:0,wood:0,stone:0,fiber:0},granary:null,
      workDemand:{foodPressure:0,housingPressure:0},
      foodShortageDays:0,famineDays:0,famineReliefDays:0,
      famineActive:false,lastDailyUnmetFood:0,native:true};
    // These people existed before either God appeared; their store is a
    // plausible historical harvest snapshot, not divine or UI-created Food.
    // Remote settlements already learned to save more for recurrent dry spells.
    const resilience=s.agriculture?.nativeResilience||{};
    const {risk,bank}=villageWaterRisk(s,t);
    const nearDays=num(resilience.initialReserveDaysNearRiver,15);
    const extraDays=num(resilience.initialReserveExtraDaysFarRiver,19);
    const initialDays=clamp(nearDays+risk*extraDays,12,45);
    const familyNeed=memberHomes.reduce((n,id)=>
      n+dailyFoodNeed(s,s.households.find(h=>h.id===id)),0);
    const privateFood=memberHomes.reduce((n,id)=>
      n+s.households.find(h=>h.id===id).inventory.food,0);
    t.storage.food=Math.max(0,initialDays*familyNeed-privateFood);
    t.preexistingReserveDays=initialDays;
    t.riverBankDistance=bank;
    s.settlements.push(t);
    genesisFieldPatches(s,center);
  }
  function nativeGenesisSites(s,otherCamp){
    // Three native villages: one near each God and one genuinely balanced
    // frontier. Choose traversable, fertile locations near river-bank water.
    // This is terrain-aware genesis, not an ownership or conversion assignment.
    const midpoint={x:(s.camp.x+otherCamp.x)/2,y:(s.camp.y+otherCamp.y)/2};
    const candidates=[];
    const sample=(x,y)=>{
      let resources=0;
      for(let oy=-6;oy<=6;oy+=3)for(let ox=-6;ox<=6;ox+=3){
        const t=tile(s,x+ox,y+oy);
        if(t.terrain==='meadow'||t.terrain==='forest')resources+=.055;
      }
      return resources;
    };
    for(let y=7;y<s.height-7;y++)for(let x=7;x<s.width-7;x++){
      const t=tile(s,x,y);
      if(t.terrain!=='meadow')continue;
      const center={x,y},dp=dist(center,s.camp),da=dist(center,otherCamp);
      const bank=Math.max(0,Math.abs(x-riverX(s,y))-1.6);
      if(bank>10)continue;
      const quality=sample(x,y)+t.fertility*.4+t.moisture*.22-
        Math.max(0,bank-5)*.25;
      candidates.push({x,y,dp,da,bank,quality,fromMid:dist(center,midpoint)});
    }
    const pick=(role,others,relaxed=false)=>{
      let winner=null,best=-Infinity;
      for(const p of candidates){
        if(others.some(o=>dist(p,o)<(relaxed?8:11.5)))continue;
        const own=role==='player'?p.dp:p.da;
        const opposite=role==='player'?p.da:p.dp;
        const valid=role==='center'?
          Math.abs(p.dp-p.da)<=(relaxed?5:3)&&
            p.dp>=12&&p.da>=12:
          own>=(relaxed?9:13)&&own<=23&&
            opposite-own>=(relaxed?3:7);
        if(!valid)continue;
        // Match not only near-side travel distance, but also the
        // distance *advantage* over the rival. Otherwise the human side
        // gets an exclusive village while the AI gets a contested one.
        const sideMatch=role==='player'&&others[1]?
          Math.abs((p.da-p.dp)-(others[1].dp-others[1].da))*.6+
          Math.abs(p.dp-others[1].da)*.13:0;
        const score=p.quality-(role==='center'?
          p.fromMid*.12+Math.abs(p.dp-p.da)*.32:
          Math.abs(own-16)*.1+sideMatch);
        if(score>best){best=score;winner=p;}
      }
      return winner;
    };
    const center=pick('center',[]);
    const enemy=pick('enemy',[center].filter(Boolean));
    const player=pick('player',[center,enemy].filter(Boolean));
    const chosen=[player,enemy,center];
    const fallbacks=[
      {x:Math.min(s.width-7,s.camp.x+15),y:Math.min(s.height-8,s.camp.y+7)},
      {x:Math.max(6,otherCamp.x-8),y:Math.max(6,otherCamp.y+9)},
      midpoint
    ];
    for(let i=0;i<3;i++)if(!chosen[i]){
      chosen[i]=pick(['player','enemy','center'][i],chosen.filter(Boolean),true)||
        nearestLand(s,fallbacks[i].x,fallbacks[i].y);
    }
    return [...chosen.map(p=>({x:p.x,y:p.y})),
      {x:Math.round(s.width*.5),y:Math.round(s.height*.85)}];
  }
  function populateNativeVillages(s,sites,villages=3,homes=3){
    for(let i=0;i<villages;i++){
      const site=nearestLand(s,sites[i].x,sites[i].y);
      addNativeVillage(s,i,site,homes);
    }
  }
  function generateSoloNativeWorld(s){
    // A single God still enters an already populated world, not a vacant map.
    // Neutral villages do not depend on an opposing deity.
    const distant=locateOpponentOrigin(s,29);
    populateNativeVillages(s,nativeGenesisSites(s,distant));
  }
  function generateSeparatedOrigins(s,opponent){
    s.opponentCamp=locateOpponentOrigin(s,opponent.minimumOriginDistance);
    const ids=opponent.initialHouseholdIndexes;
    for(let i=0;i<ids.length;i++){
      const h=s.households[ids[i]];if(!h)continue;
      placeGenesisHouse(s,h,s.opponentCamp,i,ids.length);
      let championChosen=false;
      for(const personId of h.members){
        const p=s.people.find(v=>v.id===personId);
        if(!p)continue;
        p.religionId=s.opponentReligion.id;
        if(p.stage==='adult'&&!championChosen){
          p.devotion=opponent.championDevotion;championChosen=true;
        }else p.devotion=opponent.familyDevotion;
      }
    }
    genesisFieldPatches(s,s.opponentCamp);
    populateNativeVillages(s,nativeGenesisSites(s,s.opponentCamp),
      opponent.nativeVillages,opponent.nativeHouseholdsPerVillage);
  }
  function create(config = {}) {
    const rules = rulesFrom(config);
    const agriculture = config.balanceProfile?.profileId === 'agriculture-balance-v0.1'
      ? JSON.parse(JSON.stringify(config.balanceProfile)) : null;
    const seed = String(config.seed || 'valley-spring-01').slice(0, 100);
    const religionPropagation=religionRules(config.religionProfile);
    const divinePowers=divinePowerRules(config.divineProfile);
    const opponent=opponentRules(config.opponentProfile);
    const initialMoisture = clamp(num(config.moisture, .52), .2, .9);
    const nativeWorld=config.worldGenesisMode==='native'||
      opponent?.originMode==='separated-native';
    const s = { version: VERSION, seed, rules, rng: hash(seed), religionRng:hash(seed+'|religion-v0.1'), hour: 0, tick: 0,
      width: rules.width, height: rules.height, tiles: [], people: [], households: [], settlements: [],
      camp: null, nativeWorld, religionPropagation, divinePowers,
      attention:{seq:0,items:[],lastPreachingHour:-999999},
      opponent:opponent?{...opponent,lastActionDay:-1,turns:0,casts:0,oracleIssues:0}:null,
      opponentRng:opponent?hash(seed+'|opponent-v0.1'):null,
      opponentReligion:opponent?{id:'r2',godId:'g2',name:opponent.name,
        saints:[],priests:[],saintQuota:{},oracles:[],prayers:[],
        lastPrayerHour:-1,regionalPrayerAt:{},reachedSettlements:{}}:null,
      opponentGod:opponent?{id:'g2',dp:opponent.initialDp,cap:rules.maxDp,
        skills:{rain:{level:1,xp:0,readyAtHour:0},
          ...Object.fromEntries(Object.keys(POWER_DEFAULTS).map(id=>[id,{level:1,xp:0,readyAtHour:0}]))}}:null,
      religion: { id: 'r1', godId: 'g1', name: '初光信仰', saints: [], priests: [],
        oracles: [], prayers: [], lastPrayerHour: -1, regionalPrayerAt:{}, reachedSettlements:{} },
      god: { id: 'g1', dp: rules.initialDp, cap: rules.maxDp,
        skills: { rain: { level: 1, xp: 0, readyAtHour: 0 },
           ...Object.fromEntries(Object.keys(POWER_DEFAULTS).map(id=>[id,{level:1,xp:0,readyAtHour:0}])) } },
      effects: [], nextId: 1, eventSeq: 0, events: [],
      counts: { births: 0, deaths: 0, relocations: 0, rainCasts: 0, foodFromLabor: 0,
        newBelievers:0, householdAdoptions:0, socialAdoptions:0, interSettlementAdoptions:0,
        priestAdoptions:0,rivalConversions:0,rivalDoubts:0 },
      environment: { phase: 'mild', totalRain: 0 }, lastFoodOutput: 0,
      balanceProfileId: agriculture?.profileId || 'original', agriculture,
      history: { settlementFoundedHour: null, firstSaintHour: null },
      metrics: { workChoices: 0, oracleInfluencedChoices: 0,
        foodProductionByTown:{} } };
    generate(s, initialMoisture);
    if(opponent?.originMode==='separated-native')generateSeparatedOrigins(s,opponent);
    else if(!opponent&&nativeWorld)generateSoloNativeWorld(s);
    else if(opponent){
      // Preserve previous v0.1 mixed-religion genesis for existing experiments.
      for(const i of opponent.initialHouseholdIndexes){
        const h=s.households[i];if(!h)continue;
        let championChosen=false;
        for(const personId of h.members){
          const p=s.people.find(v=>v.id===personId);
          if(!p)continue;
          p.religionId=s.opponentReligion.id;
          if(p.stage==='adult'&&!championChosen){
            p.devotion=opponent.championDevotion;championChosen=true;
          }else p.devotion=opponent.familyDevotion;
        }
      }
    }
    if (agriculture) {s.counts.newFields=0;s.counts.newFamilies=0;s.counts.newSettlements=0;}
    if (agriculture) for (const t of s.tiles) if (t.terrain === 'field') {
      const L=agriculture.land, cap=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
        Math.pow(1/L.referenceMoisture,L.moistureExponent)*L.cropStockCapacityDays;
      t.cropStock=t.crop*cap;
    }
    s.nextId = s.people.length + 1; // prevent later born Person IDs from colliding with Genesis people
    return s;
  }
  function faithfulWeight(devotion) {
    if (devotion < 20) return 0;
    if (devotion < 40) return 1;
    if (devotion < 80) return 2;
    if (devotion < 90) return 4;
    return 8;
  }
  function stats(s) {
    const pop = living(s), religious = pop.filter(p => p.religionId === s.religion.id);
    const followers = religious.filter(p => p.devotion >= s.rules.faithThreshold);
    const believers = religious.filter(p=>p.devotion>=20);
    const unaffiliated=pop.filter(p=>p.religionId===null).length;
    const nativePeople=pop.filter(p=>p.nativeOrigin).length;
    const rivals=s.opponent?.enabled?pop.filter(p=>p.religionId===s.opponentReligion.id):[];
    const devWeight = religious.reduce((sum, p) => sum + faithfulWeight(p.devotion), 0);
    const foodPrivate = s.households.reduce((sum, h) => sum + h.inventory.food, 0);
    const common = s.settlements.reduce((sum, t) => sum + t.storage.food, 0);
    const fields = s.tiles.filter(t => t.terrain === 'field' && dist(t, s.camp) < 14);
    const wet = fields.reduce((sum, t) => sum + t.moisture, 0) / Math.max(1, fields.length);
    const crop = fields.reduce((sum, t) => sum + t.crop, 0) / Math.max(1, fields.length);
    const activeOracle = s.religion.oracles.find(o => o.status === 'active');
    return { day: days(s) + 1, people: pop.length, households: s.households.length, houses: s.households.filter(h => h.home).length,
      settlements: s.settlements.length, followers: followers.length, believers: believers.length,
      unaffiliated,nativePeople,nativeVillages:s.settlements.filter(t=>t.native).length,
      newBelievers:s.counts.newBelievers||0,priestAdoptions:s.counts.priestAdoptions||0,
      rivalConversions:s.counts.rivalConversions||0,
      saints:s.religion.saints.length,priests:s.religion.priests.length,
      opponentEnabled:!!s.opponent?.enabled,
      opponentFollowers:rivals.filter(p=>p.devotion>=s.rules.faithThreshold).length,
      opponentBelievers:rivals.filter(p=>p.devotion>=20).length,
      opponentSaints:s.opponentReligion?.saints.length||0,
      opponentPriests:s.opponentReligion?.priests.length||0,
      opponentDp:s.opponentGod?.dp||0,
      opponentDpRateDay:s.opponentReligion?faithDpRate(s,s.opponentReligion):0,
      avgDevotion: religious.reduce((z,p)=>z+p.devotion,0)/Math.max(1,religious.length),
      devotionWeight: devWeight, dpRateDay: s.rules.naturalDpPerDay + devWeight * s.rules.devotionDpPerWeightDay,
      food: foodPrivate + common, commonFood: common, privateFood: foodPrivate, avgMoisture: wet, avgCrop: crop,
      farmFields:s.tiles.reduce((n,t)=>n+(t.terrain==='field'),0), newFields:s.counts.newFields||0,
      newFamilies:s.counts.newFamilies||0, newSettlements:s.counts.newSettlements||0,
      saintId: s.religion.saints[0] || null, activeOracle: activeOracle || null,
      rainReady: s.hour >= s.god.skills.rain.readyAtHour, rainReadyHour: s.god.skills.rain.readyAtHour,
      phase: s.environment.phase, births: s.counts.births, deaths: s.counts.deaths,
      rainActive: s.effects.filter(e=>(e.type||'rain')==='rain').length, householdsUnhoused: s.households.filter(h => !h.home).length,
      workChoices: s.metrics.workChoices, oracleInfluenced: s.metrics.oracleInfluencedChoices };
  }
  function rayCells(s, center, radius) {
    const out = [];
    const xa = Math.max(0, Math.floor(center.x - radius)), xb = Math.min(s.width - 1, Math.ceil(center.x + radius));
    const ya = Math.max(0, Math.floor(center.y - radius)), yb = Math.min(s.height - 1, Math.ceil(center.y + radius));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      if (Math.hypot(x - center.x, y - center.y) <= radius) out.push(tile(s, x, y));
    }
    return out;
  }
  function presenceAt(s,center,religionId=s.religion.id){
    let weighted=0,total=0;
    for(const p of s.people)if(p.alive&&faithOf(s,p.religionId)){
      const d=dist(p,center);
      if(d>=13)continue;
      const value=faithfulWeight(p.devotion)*(1-d/13);
      total+=value;
      if(p.religionId===religionId)weighted+=value;
    }
    return {density:weighted/(Math.PI*13*13),share:total?weighted/total:0,weighted,total};
  }
  // A person's religion remains one affiliation + Devotion. Interest in an
  // alternative God is a short, bounded, explicitly attributed impression, not
  // immediate conversion and not a sermon/event history.
  function divineInterest(s,p,faith){
    const item=p.miracleInterest?.[faith.godId];
    return item&&item.expiresAtHour>s.hour?item.score:0;
  }
  function faithContext(s,faith,person){
    if(person.religionId===faith.id)return 1;
    const radius=s.religionPropagation.miracleAttributionRadius;
    const sources=living(s).filter(q=>q.religionId===faith.id&&q.devotion>=20&&
      dist(q,person)<=radius);
    if(!sources.length)return 0; // No one can identify which God intervened.
    if(sources.some(q=>faith.priests.includes(q.id)||faith.saints.includes(q.id)))
      return 1;
    return .72;
  }
  function recordDivineInterest(s,p,faith,value){
    if(!(value>0))return;
    p.miracleInterest ||= {};
    const previous=p.miracleInterest[faith.godId];
    const old=previous&&previous.expiresAtHour>s.hour?previous.score:0;
    p.miracleInterest[faith.godId]={
      score:clamp(old+value,0,60),
      expiresAtHour:s.hour+s.religionPropagation.miracleInterestDays*24};
  }
  function applyMiracleFaith(s,faith,p,amount,type,role){
    if(!p.alive||amount<=0)return false;
    const credible=faithContext(s,faith,p);
    if(!credible)return false;
    const key=faith.godId+':'+type+':'+role;
    p.lastMiracleFaith ||= {};
    const previous=p.lastMiracleFaith[key];
    const repeated=Number.isFinite(previous)&&
      s.hour-previous<s.religionPropagation.miracleEvidenceRepeatDays*24;
    // Repeated sights do not build infinite faith from one worker/field.
    const factor=repeated?(role==='witness'?
      s.religionPropagation.miracleWitnessRepeatFactor:.5):1;
    const magnitude=Math.max(0,Math.round(amount*credible*factor));
    if(!magnitude)return false;
    p.lastMiracleFaith[key]=s.hour;
    if(p.religionId===faith.id){
      const delta=Math.min(magnitude,100-p.devotion);
      p.devotion+=delta;
      if(delta)p.lastFaithEvidence={hour:s.hour,cause:type+' 可信神蹟證據',change:delta,godId:faith.godId};
      return delta>0;
    }
    if(p.religionId===null){
      recordDivineInterest(s,p,faith,magnitude);
      p.lastFaithEvidence={hour:s.hour,cause:type+' 見證神蹟',change:0,godId:faith.godId,
        interest:divineInterest(s,p,faith)};
      return true;
    }
    // Credible opposing miracles may challenge even 40+ commitment. Ordinary
    // preaching still cannot. Actual conversion requires personal later choice.
    const doubt=Math.max(1,Math.round(magnitude*s.religionPropagation.miracleRivalDoubtFactor));
    const delta=Math.min(doubt,Math.max(0,p.devotion-1));
    p.devotion-=delta;
    recordDivineInterest(s,p,faith,magnitude);
    if(delta){
      p.lastFaithEvidence={hour:s.hour,cause:type+' 異教神蹟證據',
        change:-delta,godId:faith.godId};
      if(faith===s.opponentReligion&&p.religionId===s.religion.id){
        const last=s.attention?.lastPreachingHour??-Infinity;
        if(role==='direct'||s.hour-last>=14*24){
          alertPlayer(s,'pause','divine-persuasion',
            faith.name+'的'+(POWER_DEFAULTS[type]?.label||type)+
            '成果使 '+p.name+' 的原有信仰動搖',p,
            {personId:p.id,actorGodId:faith.godId});
          s.attention.lastPreachingHour=s.hour;
        }
      }
    }
    return delta>0;
  }
  function miracleWitnesses(s,faith,type,centers,exclude,amount){
    if(!centers.length||amount<=0)return 0;
    let changed=0;
    for(const p of living(s)){
      if(exclude.has(p.id))continue;
      if(!centers.some(c=>dist(c,p)<=s.religionPropagation.miracleWitnessRadius))continue;
      if(applyMiracleFaith(s,faith,p,amount,type,'witness'))changed++;
    }
    return changed;
  }
  function miraclePersonalEvidence(s,faith,type,beneficiaries,witnessAmount){
    if(!beneficiaries.length)return {recipients:0,witnesses:0};
    const centers=beneficiaries.map(v=>v.person);
    const excluded=new Set(centers.map(p=>p.id));
    let recipients=0;
    for(const {person,amount} of beneficiaries)
      if(applyMiracleFaith(s,faith,person,amount,type,'direct'))recipients++;
    const witnesses=miracleWitnesses(s,faith,type,centers,excluded,witnessAmount);
    if(recipients||witnesses)
      log(s,'faith',faith.name+'的'+(POWER_DEFAULTS[type]?.label||type)+
        '成果獲得見證：'+recipients+
        ' 位直接受益者、'+witnesses+' 位附近居民受到信仰影響。',
        ['只有具體改善或自主工作成果才能構成證據',
         '觀察者需有可信的本宗教來源；不會在施法時強制改宗']);
    return {recipients,witnesses};
  }
  function miracleAgriculturalEvidence(s,faith,type,center,amount){
    const witness=miracleWitnesses(s,faith,type,[center],new Set(),amount);
    if(witness)
      log(s,'faith',faith.name+'的'+(POWER_DEFAULTS[type]?.label||type)+
        '成果在農地被見證；'+
        witness+' 位附近居民受到小幅度信仰影響。',
        ['只根據實際存在的作物改善；沒有直接的人體神蹟受益者']);
    return witness;
  }
  // The same cooldown policy is used for Rain and all newly added Miracles:
  // - duration is an independent, monotonic dimension for timed effects,
  //   even when a wide/strong short cast has high area workload;
  // - larger area and stronger intensity change cooldown moderately;
  // - each skill has its own configurable base, its own Mastery and clock.
  // Return the actual whole-simulation-tick cooldown displayed to the player.
  function castCooldownDays(s,{baseDays,radius,intensity,referenceRadius,
    referenceIntensity,durationDays,maxDays,instant,level}){
    const floor=s.divinePowers?.cooldownDurationFloorFraction??.18;
    const durationFactor=instant?1:floor+(1-floor)*clamp(durationDays/Math.max(1,maxDays),0,1);
    const reference=Math.max(1e-8,referenceRadius*referenceRadius*referenceIntensity);
    const scopeFactor=clamp(Math.pow(radius*radius*intensity/reference,.25),.65,1.5);
    const masteryFactor=1+(level-1)*.12;
    const rawDays=Math.max(1,baseDays*durationFactor*scopeFactor/masteryFactor);
    const ticks=Math.max(1,Math.ceil(rawDays*24/s.rules.tickHours-1e-9));
    return ticks*s.rules.tickHours/24;
  }
  function evalRain(s, input = {}) {
    const {god,faith,enemy}=actorFor(s,input.godId);
    const x = num(input.x, NaN), y = num(input.y, NaN);
    const radius = num(input.radius, s.rules.defaultRainRadius);
    const intensity = num(input.intensity, s.rules.defaultRainIntensity);
    const durationDays = num(input.durationDays, s.rules.defaultRainDays);
    const cost = Math.ceil((7 + .09 * radius * radius + 6 * intensity + .4 * durationDays) / (1 + (god.skills.rain.level - 1) * .14));
    const cooldownDays=castCooldownDays(s,{baseDays:s.rules.rainBaseCooldownDays,
      radius,intensity,referenceRadius:s.rules.defaultRainRadius,
      referenceIntensity:s.rules.defaultRainIntensity,durationDays,
      maxDays:s.rules.rainMaxDays,instant:false,level:god.skills.rain.level});
    let reason = null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= s.width || y >= s.height) reason = '降雨中心不在地圖內';
    else if (!(radius >= 2 && radius <= s.rules.rainRadiusMax)) reason = '範圍不在可施展界線內';
    else if (!(intensity > 0 && intensity <= s.rules.rainSupportMaxIntensity)) reason = '目前僅開放一般支援型降雨強度';
    else if (!(durationDays >= 1 && durationDays <= s.rules.rainMaxDays)) reason = '單次降雨不可超過一個模擬月';
    else if (s.hour < god.skills.rain.readyAtHour) reason = '喚雨仍在冷卻';
    else if (god.dp + 1e-8 < cost) reason = '神力不足';
    return { ok: !reason, reason, cost, cooldownDays, radius, intensity, durationDays,
      center: { x, y }, presence: Number.isFinite(x) ? presenceAt(s, { x, y },faith.id) : null };
  }
  function castRain(s, input) {
    const test = evalRain(s, input);
    const {god,faith,enemy}=actorFor(s,input?.godId);
    if (!test.ok) return test;
    god.dp = Math.max(0, god.dp - test.cost);
    const effect = { id: 'rain-' + s.nextId++, type:'rain', x: test.center.x, y: test.center.y,
      radius: test.radius, intensity: test.intensity, startsAtHour: s.hour,
      endsAtHour: s.hour + test.durationDays * 24, godId:god.id };
    s.effects.push(effect);
    god.skills.rain.readyAtHour = s.hour + Math.round(test.cooldownDays * 24/8)*8;
    god.skills.rain.xp += Math.max(1, Math.round(test.radius * test.intensity * test.durationDays / 8));
    const skill = god.skills.rain;
    while (skill.level < 5 && skill.xp >= skill.level * skill.level * 30) skill.level++;
    s.counts.rainCasts++;
    log(s, 'miracle', `${enemy?faith.name+'的神明':'你'}向河谷施展降雨，雨雲將停留約 ${test.durationDays} 日。`,
      [`直接效果：選定範圍增加降雨；不保證豐收`, `神力 -${test.cost}，喚雨冷卻 ${Math.round(test.cooldownDays)} 日`]);
    return { ...test, effectId: effect.id };
  }


  function skillState(s,type,god=s.god){
    return god.skills[type] ||= {level:1,xp:0,readyAtHour:0};
  }
  function cropStockCap(s,t){
    if(!s.agriculture || t.terrain!=='field')return 1;
    const L=s.agriculture.land;
    return L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
      Math.pow(1/L.referenceMoisture,L.moistureExponent)*L.cropStockCapacityDays;
  }
  function activeStatus(s,p,type){
    const v=p.divineStatuses?.[type];
    if(!v||v.endsAtHour<=s.hour||!p.alive)return 0;
    if(type==='efficiency'&&(p.devotion<s.rules.faithThreshold||
      (v.godId||s.god.id)!==faithOf(s,p.religionId)?.godId))return 0;
    return v.strength;
  }
  function expireStatuses(s){
    for(const p of s.people){
      if(!p.divineStatuses)continue;
      for(const [key,v] of Object.entries(p.divineStatuses)){
        if(v.endsAtHour<=s.hour)delete p.divineStatuses[key];
      }
      if(!Object.keys(p.divineStatuses).length)delete p.divineStatuses;
    }
  }
  function perceivedReach(s,p,reach){
    const blind=activeStatus(s,p,'blindness');
    return blind?Math.max(1,Math.floor(reach*(1-s.divinePowers.blindnessReachReduction*Math.min(1,blind)))):reach;
  }
  function evaluateMiracle(s,type,input={}){
    if(type==='rain')return evalRain(s,input);
    const {god,faith,enemy}=actorFor(s,input.godId);
    const def=s.divinePowers.powers[type];
    if(!def)return {ok:false,reason:'未登錄的神蹟'};
    const x=num(input.x,NaN),y=num(input.y,NaN);
    const radius=num(input.radius,def.defaultRadius);
    const intensity=num(input.intensity,def.defaultIntensity);
    const durationDays=def.instant?0:num(input.durationDays,def.defaultDurationDays);
    const center={x,y},skill=skillState(s,type,god);
    const cost=Math.max(1,Math.ceil((def.baseCost+.045*radius*radius+3*intensity+
      (def.instant?0:.17*durationDays))/(1+(skill.level-1)*.14)));
    const cooldownDays=castCooldownDays(s,{baseDays:def.cooldownDays,
      radius,intensity,referenceRadius:def.defaultRadius,
      referenceIntensity:def.defaultIntensity,durationDays,maxDays:def.maxDays,
      instant:!!def.instant,level:skill.level});
    const validCenter=Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<s.width&&y<s.height;
    const inArea=p=>validCenter&&p.alive&&dist(p,center)<=radius;
    const fields=validCenter&&['ripening','harvest'].includes(type)?rayCells(s,center,radius).filter(t=>
      t.terrain==='field'&&(type!=='harvest'||(s.agriculture?t.cropStock>1e-8:t.crop>.02))):[];
    const people=['heal','efficiency','confusion','blindness'].includes(type)?
      s.people.filter(p=>inArea(p)&&(type!=='heal'||p.health<100)&&
       (type!=='efficiency'||(p.religionId===faith.id&&p.devotion>=s.rules.faithThreshold))):[];
    const presence=validCenter?presenceAt(s,center,faith.id):null;
    let reason=null;
    if(!validCenter)reason='施展中心不在地圖內';
    else if(!(radius>=1&&radius<=14))reason='施展範圍必須在 1 至 14 格內';
    else if(!(intensity>.0&&intensity<=def.maxIntensity))reason='神蹟強度超出限制';
    else if(!def.instant&&!(durationDays>=1&&durationDays<=def.maxDays))reason='持續時間超出限制';
    else if(def.offensive&&(!presence||presence.weighted<s.divinePowers.destructiveMinWeighted||
      presence.share<=.5))reason='當地神性臨在不足，無法發動破壞／干擾神蹟';
    else if(['ripening','harvest'].includes(type)&&!fields.length)reason='範圍內沒有可作用的現有農作物';
    else if(['heal','efficiency','confusion','blindness'].includes(type)&&!people.length)
      reason=type==='heal'?'範圍內沒有需要治療的在世居民':
        type==='efficiency'?'範圍內沒有可祝福的己方信徒':'範圍內沒有可干擾的在世居民';
    else if(s.hour<skill.readyAtHour)reason='此神蹟仍在冷卻';
    else if(god.dp+1e-8<cost)reason='神力不足';
    return {ok:!reason,reason,cost,cooldownDays,center,radius,intensity,durationDays,
      presence,applicableFields:fields.length,applicablePeople:people.length,instant:!!def.instant,type};
  }
  function castMiracle(s,type,input={}){
    if(type==='rain')return castRain(s,input);
    const check=evaluateMiracle(s,type,input);
    const {god,faith,enemy}=actorFor(s,input.godId);
    if(!check.ok)return check;
    const {center,radius,intensity,durationDays}=check;
    const people=s.people.filter(p=>p.alive&&dist(p,center)<=radius);
    const cells=['harvest','lightning'].includes(type)?rayCells(s,center,radius):[];
    const tuning=s.divinePowers;
    let applied=0,actual=0;
    const healedPeople=[];
    const threatened=enemy&&['drought','lightning','confusion','blindness'].includes(type)?
      people.filter(p=>p.religionId===s.religion.id&&p.devotion>=20):[];
    if(type==='heal'){
      for(const p of people)if(p.health<100){
        const healed=Math.min(100-p.health,30*intensity*Math.max(.45,1-dist(p,center)/Math.max(1,radius)*.5));
        p.health+=healed;actual+=healed;applied++;
        if(healed>=s.religionPropagation.healMinRecovery)
          healedPeople.push({person:p,amount:Math.round(
            s.religionPropagation.healDirectDevotion*Math.min(1.3,.6+healed/25))});
      }
    }else if(type==='harvest'){
      for(const t of cells)if(t.terrain==='field'){
        if(s.agriculture){
          const original=Math.max(0,t.cropStock),cap=cropStockCap(s,t);
          if(original<=0)continue;
          const extra=Math.min(original*tuning.harvestExtraPerIntensity*intensity,
            Math.max(0,cap*(1+tuning.harvestMaxExtraCapRatio)-original));
          if(extra<=0)continue;
          t.cropStock=original+extra;
          t.crop=clamp(t.cropStock/Math.max(cap,1e-9));actual+=extra;applied++;
        }else if(t.crop>.02){
          const extra=Math.min(.98-t.crop,t.crop*.45*intensity);
          if(extra<=0)continue;
          t.crop+=extra;actual+=extra;applied++;
        }
      }
    }else if(type==='lightning'){
      for(const p of people){
        const amount=(16+29*intensity)*Math.max(.3,1-dist(p,center)/Math.max(1,radius)*.7);
        p.health=Math.max(0,p.health-amount);
        actual+=amount;applied++;
        if(p.health<=0)die(s,p.id,'遭雷擊受傷致死');
      }
      for(const t of cells)if(t.terrain==='field'){
        const fraction=clamp(.25*intensity*Math.max(.2,1-dist(t,center)/Math.max(1,radius)),0,.8);
        if(s.agriculture)t.cropStock=Math.max(0,t.cropStock*(1-fraction));
        else t.crop=Math.max(.02,t.crop*(1-fraction));
      }
    }else if(['efficiency','confusion','blindness'].includes(type)){
      for(const p of people){
        if(type==='efficiency'&&(p.religionId!==faith.id||p.devotion<s.rules.faithThreshold))continue;
        const endsAtHour=s.hour+durationDays*24;
        p.divineStatuses ||= {};
        const old=p.divineStatuses[type],previous=old&&old.endsAtHour>s.hour?old:null;
        p.divineStatuses[type]={strength:Math.max(intensity,previous?.strength||0),
          endsAtHour:Math.max(endsAtHour,previous?.endsAtHour||0),godId:god.id};
        applied++;
      }
    }else if(type==='ripening'||type==='drought'){
      const effect={id:type+'-'+s.nextId++,type,x:center.x,y:center.y,
        radius,intensity,startsAtHour:s.hour,endsAtHour:s.hour+durationDays*24,godId:god.id};
      s.effects.push(effect);applied=rayCells(s,center,radius).filter(t=>t.terrain!=='river').length;
    }
    god.dp=Math.max(0,god.dp-check.cost);
    const skill=skillState(s,type,god);
    skill.readyAtHour=s.hour+Math.max(8,Math.round(check.cooldownDays*24/8)*8);
    skill.xp+=Math.max(1,Math.round(radius*intensity*(durationDays||1)/8));
    while(skill.level<5&&skill.xp>=skill.level*skill.level*30)skill.level++;
    s.counts.miracleCasts ||= {};
    s.counts.miracleCasts[type]=(s.counts.miracleCasts[type]||0)+1;
    if(type==='heal'&&healedPeople.length)
      miraclePersonalEvidence(s,faith,'heal',healedPeople,
        s.religionPropagation.healWitnessDevotion);
    if(type==='harvest'&&actual>.75)
      miracleAgriculturalEvidence(s,faith,'harvest',center,
        s.religionPropagation.harvestWitnessDevotion);
    if(threatened.length){
      const subject=threatened[0];
      alertPlayer(s,'pause','attack',
        faith.name+'施展'+tuning.powers[type].label+'，波及 '+threatened.length+' 位你的信眾',
        center,{personId:subject.id,actorGodId:god.id,targetCount:threatened.length});
    }
    log(s,'miracle',(enemy?faith.name+'的神明':'你')+'施展 '+tuning.powers[type].label+'，作用於 '+applied+' 個目標。',
      ['直接作用於世界或居民；實際後續結果仍由模擬決定',
       '神力 -'+check.cost+'，冷卻約 '+Math.round(check.cooldownDays)+' 日']);
    return {...check,applied,actual};
  }

  function personSettlement(s,p){
    const town=s.settlements.find(t=>t.id===p.settlementId);
    return town && town.householdIds.includes(p.householdId) &&
      dist(town,p)<=s.rules.settlementClusterDistance ? town : null;
  }
  function settlementReligionStats(s,townId){
    const town=s.settlements.find(t=>t.id===townId);
    if(!town)return null;
    const people=living(s).filter(p=>personSettlement(s,p)?.id===townId);
    const believers=people.filter(p=>p.religionId===s.religion.id&&p.devotion>=20);
    const memberIds=new Set(people.map(p=>p.id));
    return {population:people.length,believers:believers.length,
      unaffiliated:people.filter(p=>p.religionId===null).length,
      followers:believers.filter(p=>p.devotion>=40).length,
      priests:s.religion.priests.filter(id=>memberIds.has(id)).length,
      saints:s.religion.saints.filter(id=>memberIds.has(id)).length,
      opponentBelievers:people.filter(p=>p.religionId===s.opponentReligion?.id&&p.devotion>=20).length,
      opponentFollowers:people.filter(p=>p.religionId===s.opponentReligion?.id&&p.devotion>=40).length,
      opponentPriests:(s.opponentReligion?.priests||[]).filter(id=>memberIds.has(id)).length,
      opponentSaints:(s.opponentReligion?.saints||[]).filter(id=>memberIds.has(id)).length,
      activeOracles:s.religion.oracles.filter(o=>o.status==='active'&&o.propagatedAtHour!==null&&
        (o.reachedSettlements?.[townId]||people.some(p=>oracleContact(s,p,o)>0))).length};
  }
  function appointSaint(s,p,faith=s.religion){
    const first=faith.saints.length===0;
    faith.saints.push(p.id);
    faith.saintQuota ||= {};
    faith.saintQuota[p.id]={quota:s.rules.oracleQuota,nextRefillHour:s.hour+s.rules.oracleRefillDays*24};
    if(faith===s.religion&&s.history.firstSaintHour===null)s.history.firstSaintHour=s.hour;
    log(s,'religion',`${faith.name}：${p.name} 在信仰生活中成為${first?'第一位':'另一位'}聆聽者。`,
      ['自主形成的 Saint 資格不等於 Priest 職位，也不是神直接指定']);
  }
  function ensureSaint(s,faith=s.religion){
    if(days(s)<2)return;
    const candidates=living(s).filter(p=>p.religionId===faith.id&&p.devotion>=40&&p.stage==='adult');
    const rank=(a,b)=>(b.devotion*.5+b.receptivity*45)-(a.devotion*.5+a.receptivity*45)||a.id.localeCompare(b.id);
    if(!faith.saints.length){if(candidates.length)appointSaint(s,candidates.sort(rank)[0],faith);return;}
    // More settlements create opportunities, not one Saint per settlement or per follower count.
    const limit=1+Math.floor(Math.sqrt(Math.max(0,s.settlements.length-1)));
    if(faith.saints.length>=limit||days(s)%s.rules.daysPerMonth!==0)return;
    for(const town of s.settlements){
      if(faith.saints.some(id=>candidates.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id)))continue;
      const locals=candidates.filter(p=>personSettlement(s,p)?.id===town.id);
      if(locals.length<2||!faith.priests.some(id=>locals.some(p=>p.id===id)))continue;
      const eligible=locals.filter(p=>p.receptivity>=.65&&!faith.saints.includes(p.id)).sort(rank);
      if(eligible.length&&religionRand(s,faith)<s.religionPropagation.regionalSaintChancePerMonth){
        appointSaint(s,eligible[0],faith);break;
      }
    }
  }
  function ensurePriest(s,faith=s.religion){
    if(!s.religionPropagation.priesthoodEnabled || days(s)<10)return;
    const people=living(s);
    for(const town of s.settlements){
      if(faith.priests.some(id=>people.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id)))continue;
      const local=people.filter(p=>personSettlement(s,p)?.id===town.id&&
        p.religionId===faith.id&&p.devotion>=20);
      if(local.length<3)continue;
      const eligible=local.filter(p=>p.stage==='adult'&&p.devotion>=25&&
        s.households.find(h=>h.id===p.householdId)?.home);
      if(!eligible.length)continue;
      const nonSaints=eligible.filter(p=>!faith.saints.includes(p.id));
      const candidate=(nonSaints.length?nonSaints:eligible).sort((a,b)=>
        (b.receptivity*2+b.proficiency.gather+b.devotion/100)-
        (a.receptivity*2+a.proficiency.gather+a.devotion/100)||a.id.localeCompare(b.id))[0];
      if(faith.priests.includes(candidate.id))continue;
      faith.priests.push(candidate.id);
      log(s,'religion',`${faith.name}：${candidate.name} 在${town.name}得到支持，兼任祭司與傳道者。`,
        ['當地信眾需求、個人適任性及實際居所促成宗教角色']);
    }
  }
  function checkOracle(s, saintId, intentType,faith=s.religion) {
    if (!['food.produce','religion.spread'].includes(intentType)) return { ok: false, reason: '這類神諭尚未實作' };
    const saint = s.people.find(p => p.id === saintId && p.alive);
    if (!saint || !faith.saints.includes(saintId)) return { ok: false, reason: '接收者必須是本宗教仍在世的 Saint' };
    const record = faith.saintQuota && faith.saintQuota[saintId];
    if (!record || record.quota < 1) return { ok: false, reason: 'Saint 的神諭接收額度不足' };
    if (faith.oracles.some(o => o.saintId === saintId && o.intentType === intentType && o.status === 'active'))
      return { ok: false, reason: '這位 Saint 已經持有相同類型的有效神諭' };
    return { ok: true, saint };
  }
  function issueOracle(s, input = {}) {
    const {faith,god,enemy}=actorFor(s,input.godId);
    const saintId = input.saintId || faith.saints[0];
    const intentType=input.intentType||'food.produce';
    const test = checkOracle(s, saintId, intentType,faith);
    if (!test.ok) return test;
    const durationDays = clamp(num(input.durationDays, s.rules.oracleDurationDays), 1, 720);
    faith.saintQuota[saintId].quota--;
    const o = { id: 'o' + s.nextId++, godId: god.id, saintId,
      intentType, audience: 'local-community', issuedAtHour: s.hour,
      expiresAtHour: s.hour + durationDays * 24, status: 'active', propagatedAtHour: null,
      reachRadius: s.rules.oracleCommunicationRadius, influenceWorkCount: 0,
      influenceSermonCount:0,heardCount: 0,
      reachedSettlements:{}, fulfillmentCredited: false, progressFoodAtStart: stats(s).food };
    faith.oracles.push(o);
    if(enemy)s.opponent.oracleIssues++;
    log(s, 'oracle', `${enemy?faith.name+'的神諭':'神諭'}交給 ${test.saint.name}：${intentType==='religion.spread'?'鼓勵信眾更積極地傳播信仰':'請讓族人重視糧食生產'}。`,
      ['Saint 接收並理解核心意圖；居民是否採取行動由其需求與能力決定']);
    return { ok: true, oracleId: o.id, saintId, quotaLeft: faith.saintQuota[saintId].quota };
  }
  function concludeOracle(s, oracleId) {
    const faith=s.religion;
    const o = faith.oracles.find(v => v.id === oracleId && v.status === 'active');
    if (!o) return { ok: false, reason: '沒有可宣告完成的神諭' };
    const q = faith.saintQuota[o.saintId];
    if (!q || q.quota <= -1) return { ok: false, reason: 'Saint 的額度已達 -1 下限' };
    q.quota--; o.status = 'concluded';
    log(s, 'oracle', '神宣告這道神諭的使命已經結束。', ['結束此 Saint 的單一指派；既有生活成果仍保留']);
    return { ok: true, quotaLeft: q.quota };
  }

  // A sermon is a real non-work leisure activity; contacts are evaluated on weekly pulses.
  function recentPreacher(s,p,faith=s.religion){
    return p.alive&&p.religionId===faith.id&&p.devotion>=20&&
      p.stage==='adult'&&Number.isFinite(p.lastPreachHour)&&
      s.hour-p.lastPreachHour<=s.religionPropagation.pulseDays*24;
  }
  function socialReligionPulse(s,faith=s.religion){
    const r=s.religionPropagation,id=faith.id,people=living(s);
    const homes=new Map(),towns=new Map(),preachers=new Map();
    const scale=r.contactRadius,cell=(x,y)=>x+','+y;
    for(const p of people){
      if(!homes.has(p.householdId))homes.set(p.householdId,[]);
      homes.get(p.householdId).push(p);
      const town=personSettlement(s,p);
      if(town){
        if(!towns.has(town.id))towns.set(town.id,[]);
        towns.get(town.id).push(p);
      }
      if(!recentPreacher(s,p,faith))continue;
      const k=cell(Math.floor(p.x/scale),Math.floor(p.y/scale));
      if(!preachers.has(k))preachers.set(k,[]);
      preachers.get(k).push(p);
    }
    const byId=new Map(people.map(p=>[p.id,p]));
    const pressuredPlayer=[];
    const priestSources=faith.priests.map(id=>byId.get(id)).filter(p=>p&&recentPreacher(s,p,faith));
    const remoteSources=new Map();
    for(const town of s.settlements){
      const sources=(towns.get(town.id)||[]).filter(p=>recentPreacher(s,p,faith));
      if(sources.length)remoteSources.set(town.id,sources);
    }
    const adopt=(p,cause)=>{
      if(faith===s.opponentReligion&&p.religionId===s.religion.id)
        pressuredPlayer.push({person:p,converted:true});
      p.religionId=id;p.devotion=20+Math.floor(clamp(p.receptivity,0,1)*4);
      if(p.miracleInterest)delete p.miracleInterest[faith.godId];
      if(faith===s.religion){
        s.counts.newBelievers=(s.counts.newBelievers||0)+1;
        const field=cause==='family'?'householdAdoptions':cause==='exchange'?'interSettlementAdoptions':
          cause==='priest'||cause==='rival'?'priestAdoptions':'socialAdoptions';
        s.counts[field]=(s.counts[field]||0)+1;
        if(cause==='rival')s.counts.rivalConversions=(s.counts.rivalConversions||0)+1;
        if(cause==='miracle')s.counts.miracleAdoptions=(s.counts.miracleAdoptions||0)+1;
      }else{
        s.counts.opponentNewBelievers=(s.counts.opponentNewBelievers||0)+1;
        if(cause==='rival')s.counts.opponentConversions=(s.counts.opponentConversions||0)+1;
        if(cause==='miracle')s.counts.opponentMiracleAdoptions=(s.counts.opponentMiracleAdoptions||0)+1;
      }
    };
    for(const p of people){
      const rival=p.religionId!==null&&p.religionId!==id;
      const impressed=divineInterest(s,p,faith);
      const convincing=impressed>=r.miracleInterestThreshold;
      if(rival&&p.devotion>=s.rules.faithThreshold)continue;
      if(p.stage==='child'&&p.age<r.minimumChildAge)continue;
      const house=homes.get(p.householdId)||[];
      const guardians=p.stage==='child'?(p.parentIds?.length
        ? p.parentIds.map(id=>byId.get(id)).filter(q=>q&&q.householdId===p.householdId)
        : house.filter(q=>q.id!==p.id&&q.stage!=='child')):[];
      const family=house.some(q=>q.id!==p.id&&q.religionId===id&&q.devotion>=20);
      // Formative child teaching is distinct from short sermons: sustained lived examples
      // may reach modest committed faith, but never yield Devout/Zealot bands by heredity.
      if(p.stage==='child'&&guardians.length&&!rival){
        const devout=guardians.filter(q=>q.religionId===id&&q.devotion>=80).length;
        const committed=guardians.filter(q=>q.religionId===id&&q.devotion>=40).length;
        const religious=guardians.filter(q=>q.religionId===id&&q.devotion>=20).length;
        const cap=devout>=2?55:devout===1&&committed>=2?50:devout===1?45:
          committed>=2?44:committed>=1&&religious>=2?42:39;
        const chance=devout>=2?r.childStrongLearningChance:devout===1?
          r.childStrongLearningChance*.7:committed>=2?r.childOrdinaryLearningChance:
          committed>=1?r.childOrdinaryLearningChance*.7:r.weakLearningChance*.65;
        if(religious){
          if(p.religionId===null){
            if(religionRand(s,faith)<clamp((.22+.15*committed+.08*devout)*(.6+.6*p.receptivity),0,.95))
              adopt(p,'family');
          }else if(p.religionId===id&&p.devotion<cap&&
            religionRand(s,faith)<chance*(.65+.7*p.receptivity)){
            p.devotion=Math.min(cap,p.devotion+1);
          }
          continue;
        }
      }
      if(p.religionId===id&&p.devotion>=r.ordinaryConsolidationCap)continue;
      const bx=Math.floor(p.x/scale),by=Math.floor(p.y/scale);
      let social=false, nearbySpread=0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        for(const q of preachers.get(cell(bx+dx,by+dy))||[]){
          if(q.id===p.id||dist(q,p)>r.contactRadius)continue;
          social=true;nearbySpread=Math.max(nearbySpread,Math.min(3,q.spreadSermonsSincePulse||0));
        }
      }
      const nearbyPriests=priestSources.filter(q=>dist(q,p)<=r.contactRadius);
      const priest=nearbyPriests.length>0;
      const priestSpread=Math.max(0,...nearbyPriests.map(q=>Math.min(3,q.spreadSermonsSincePulse||0)));
      const sermonAmplification=1+s.divinePowers.spreadSermonBonus*priestSpread;
      const town=personSettlement(s,p);
      let exchange=false;
      if(town)for(const other of s.settlements){
        if(other.id!==town.id&&remoteSources.has(other.id)&&
          dist(town,other)<=r.interSettlementReach){exchange=true;break;}
      }
      if(!family&&!social&&!priest&&!exchange&&!convincing)continue;
      const sensitivity=.6+.8*p.receptivity;
      if(rival){
        // Only a locally preaching Priest can challenge another affiliation in
        // this single-God PoC. 40+ rival devotion is protected above. Lower bands
        // first weaken over repeated credible encounters, then may freely convert.
        if(!priest&&!convincing)continue;
        if(p.devotion>=20){
          const clear=nearbyPriests.some(q=>!activeStatus(s,q,'confusion'))?1:.5;
          const doubt=priest?clamp(r.priestRivalDoubtChance*sensitivity*
            sermonAmplification*clear*(1+(convincing?.25:0)),0,.9):0;
          if(religionRand(s,faith)<doubt){
            p.devotion=Math.max(19,p.devotion-r.priestRivalDoubtStep);
            if(faith===s.opponentReligion&&p.religionId===s.religion.id)
              pressuredPlayer.push({person:p,converted:false});
            const counter=faith===s.religion?'rivalDoubts':'opponentDoubts';
            s.counts[counter]=(s.counts[counter]||0)+1;
          }
        }else if(religionRand(s,faith)<clamp(
          (priest?r.priestRivalConversionChance*sermonAmplification:0)+
          (convincing?r.miracleInterestJoinChance*Math.min(2.2,impressed/r.miracleInterestThreshold):0),
          0,.8)*sensitivity){
          adopt(p,convincing&&!priest?'miracle':'rival');
        }
        continue;
      }
      if(p.religionId===id){
        // Repeated credible teaching can cross 40; routine consolidation slows above 40.
        // Exceptional Devout/Zealot bands still depend on stronger, attributable evidence.
        const committedSlowdown=p.devotion>=40?.55:1;
        const clarity=nearbyPriests.some(q=>!activeStatus(s,q,'confusion'))?1:.6;
        const teaching=priest?r.priestTeachingMultiplier*sermonAmplification*clarity:1;
        if(religionRand(s,faith)<clamp(r.weakLearningChance*sensitivity*(family||priest?1:.6)*committedSlowdown*teaching,0,.95))
          p.devotion=Math.min(r.ordinaryConsolidationCap,p.devotion+1);
      }else{
        // Priests add a *separate* recruitment opportunity. Even when there is
        // already family/social exposure, the clergy bonus is not overwritten by it.
        // Spread Oracle must provide a distinct persuasion opportunity in a
        // real sermon; it never broadcasts faith or issues automatic converts.
        const oracleOpportunity=nearbySpread>0&&social?
          r.spreadOracleJoinBonus*nearbySpread/(nearbySpread+2):0;
        const baseline=clamp(((family?r.householdJoinChance:0)+
          (social?r.socialJoinChance*(1+s.divinePowers.spreadSermonBonus*nearbySpread):0)+
           (exchange?r.settlementVisitChance:0)+oracleOpportunity)*sensitivity,0,.65);
        const confusedPriest=nearbyPriests.length&&nearbyPriests.every(q=>activeStatus(s,q,'confusion')>0);
        const preacherClarity=confusedPriest?.45:1;
        const priestBonus=priest?r.priestJoinChance*sensitivity*sermonAmplification*preacherClarity:0;
        const evidenceBonus=convincing?
          r.miracleInterestJoinChance*Math.min(2.3,impressed/r.miracleInterestThreshold)*sensitivity:0;
        const rolled=religionRand(s,faith);
        if(rolled<clamp(baseline+priestBonus+evidenceBonus,0,.85)){
          const cause=rolled>=baseline+priestBonus?'miracle':
            rolled>=baseline?'priest':family?'family':social?'social':'exchange';
          adopt(p,cause);
        }
      }
    }
    // A meaningful (actual) Devotion loss or conversion, never mere nearby
    // foreign speech, is eligible to interrupt accelerated play.
    if(pressuredPlayer.length){
      const converted=pressuredPlayer.find(v=>v.converted);
      const first=converted||pressuredPlayer[0];
      const last=s.attention?.lastPreachingHour??-Infinity;
      if(converted||s.hour-last>=14*24){
        alertPlayer(s,'pause','preaching',
          converted?first.person.name+'受'+faith.name+'傳教影響而改宗':
            faith.name+'的祭司正在動搖你的信眾（'+pressuredPlayer.length+' 人）',
          first.person,{personId:first.person.id,actorGodId:faith.godId,
            targetCount:pressuredPlayer.length});
        s.attention.lastPreachingHour=s.hour;
      }
    }
    // Each religion must see the same complete sermon window; reset only once
    // after both religion pulses in daily(), not after the first faith.
    // Settlement attribution is derived from real residents (migration included), not a border buff.
    const reached=faith.reachedSettlements ||= {};
    for(const town of s.settlements){
      if(reached[town.id]!==undefined)continue;
      if((towns.get(town.id)||[]).some(p=>p.religionId===id&&p.devotion>=20)){
        reached[town.id]=s.hour;
        if(town.id!==s.settlements[0]?.id)
          log(s,'religion',`${faith.name} 隨實際信眾傳入${town.name}。`,
            ['已歸屬該聚落的居民具有宗教信仰；可能來自家庭、遷移、交流或傳道']);
      }
    }
  }
  function oracleContact(s,p,o,faith=s.religion){
    if(!p.alive||p.religionId!==faith.id||p.devotion<20||
      o.status!=='active'||o.propagatedAtHour===null)return 0;
    const saint=s.people.find(q=>q.id===o.saintId&&q.alive);
    if(!saint)return 0;
    if(dist(saint,p)<=o.reachRadius)return 1;
    const town=personSettlement(s,p);
    return town&&o.reachedSettlements?.[town.id] ? .8 : 0;
  }

  function spreadCalling(s,p,faith=s.religion){
    if(!p.alive||p.stage!=='adult'||p.religionId!==faith.id||p.devotion<20)
      return {score:0,oracle:null};
    let best={score:0,oracle:null};
    for(const o of faith.oracles){
      if(o.intentType!=='religion.spread'||o.status!=='active'||o.propagatedAtHour===null)continue;
      const transmitted=oracleContact(s,p,o,faith);
      if(!transmitted)continue;
      // Sustained rather than permanent maximum attention; individuals still choose.
      const lifetime=(s.hour-o.issuedAtHour)/Math.max(1,o.expiresAtHour-o.issuedAtHour);
      const pressure=transmitted*clamp(1-.55*lifetime,.35,1);
      if(pressure>best.score)best={score:pressure,oracle:o};
    }
    return best;
  }
  function relayOracles(s,faith=s.religion){
    const r=s.religionPropagation,people=living(s);
    for(const o of faith.oracles){
      if(o.status!=='active'||o.propagatedAtHour===null)continue;
      o.reachedSettlements ||= {};
      const saint=people.find(p=>p.id===o.saintId);
      if(!saint)continue;
      const origin=personSettlement(s,saint);
      if(origin&&!o.reachedSettlements[origin.id])
        o.reachedSettlements[origin.id]={hour:s.hour,via:'saint'};
      for(const town of s.settlements){
        if(o.reachedSettlements[town.id])continue;
        if(!people.some(p=>p.religionId===faith.id&&p.devotion>=20&&
          personSettlement(s,p)?.id===town.id))continue;
        const connected=Object.keys(o.reachedSettlements).some(sourceId=>{
          const source=s.settlements.find(t=>t.id===sourceId);
          return source&&dist(source,town)<=r.interSettlementReach;
        });
        if(!connected)continue;
        const priest=faith.priests.some(id=>people.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id));
        if(religionRand(s,faith)>r.oracleRelayChance*(priest?1:.25))continue;
        o.reachedSettlements[town.id]={hour:s.hour,via:priest?'priest':'social'};
        log(s,'oracle',`${town.name} 經由${priest?'祭司':'居民交流'}聽見神諭。`,
          ['訊息沿已建立信仰聯繫的相鄰聚落傳遞，並未直接廣播所有居民']);
      }
      o.heardCount=people.filter(p=>oracleContact(s,p,o,faith)>0).length;
    }
  }
  function nearestResource(s, home, kind,person=null) {
    let best = null, strength = -Infinity;
    const reach=person?perceivedReach(s,person,7):7;
    for (let y = Math.max(0, home.y - reach); y <= Math.min(s.height - 1, home.y + reach); y++)
      for (let x = Math.max(0, home.x - reach); x <= Math.min(s.width - 1, home.x + reach); x++) {
        const t = tile(s, x, y);
        if (t.terrain === 'river') continue;
        const quantity = kind === 'food' ? t.forage : t[kind];
        const score = quantity - .13 * Math.hypot(x - home.x, y - home.y);
        if (score > strength) { strength = score; best = t; }
      }
    return best && (kind === 'food' ? best.forage : best[kind]) > .2 ? best : null;
  }
  function nearestField(s, home, person=null) {
    let best = null, strength = -Infinity;
    const naturalReach=s.agriculture?.land?.workReachCells ?? 9;
    const reach=person?perceivedReach(s,person,naturalReach):naturalReach;
    for (let y = Math.max(0, home.y - reach); y <= Math.min(s.height - 1, home.y + reach); y++)
      for (let x = Math.max(0, home.x - reach); x <= Math.min(s.width - 1, home.x + reach); x++) {
        const t = tile(s, x, y);
        if (t.terrain !== 'field') continue;
        const score = t.crop * 4 + t.moisture * .5 - .09 * Math.hypot(x - home.x, y - home.y);
        if (score > strength) { strength = score; best = t; }
      }
    return best;
  }
  function workCalling(s, p) {
    let strongest = { score: 0, oracle: null };
    const faith=faithOf(s,p.religionId);
    if(!faith||p.devotion<20)return strongest;
    for(const o of faith.oracles){
      if (o.status !== 'active' || o.intentType!=='food.produce' || o.propagatedAtHour === null) continue;
      const saint = s.people.find(v => v.id === o.saintId && v.alive);
      const transmission=oracleContact(s,p,o,faith);
      if(!transmission)continue;
      const ageDays = (s.hour - o.issuedAtHour)/24;
      const half = Math.max(30, (o.expiresAtHour-o.issuedAtHour)/24 * .58);
      const attention = clamp(1 - Math.max(0,ageDays-20) / half, .18, 1);
      const score = (2.6 + p.devotion/18) * attention * transmission;
      if (score > strongest.score) strongest = { score, oracle: o };
    }
    return strongest;
  }
  // Food access has exactly one source of truth: valid social membership AND physical reach.
  // Both communal transfers and requests must use this policy. Moving out does not let
  // a household deposit 80% at a settlement from which it cannot withdraw supplies.
  function accessibleSettlement(s, h) {
    return s.settlements.find(t => t.householdIds.includes(h.id) &&
      dist(t, h) <= s.rules.settlementClusterDistance) || null;
  }
  function householdMembers(s, h) {
    return h.members.map(id => s.people.find(p => p.id === id)).filter(p => p && p.alive);
  }
  function dailyFoodNeed(s, h) {
    return householdMembers(s, h).reduce((total, p) =>
      total + (p.stage === 'child' ? s.rules.foodNeedChild : s.rules.foodNeedAdult), 0);
  }
  function foodSecurity(s, h) {
    const town = accessibleSettlement(s, h);
    const need = dailyFoodNeed(s, h);
    if (!(need > 0)) return { town, need: 0, personal: h.inventory.food, communal: 0, days: Infinity };
    // Forecast a fair share for reproductive planning and work pressure.
    // It is not a promise of an individual entitlement or reserved inventory.
    const totalNeeds = town ? s.households.reduce((total, other) =>
      total + (accessibleSettlement(s, other)?.id === town.id ? dailyFoodNeed(s, other) : 0), 0) : 0;
    const communal = town && totalNeeds > 0 ? town.storage.food * need / totalNeeds : 0;
    return { town, need, personal: h.inventory.food, communal,
      days: (h.inventory.food + communal) / need };
  }
  function distribute(s, h, kind, amount) {
    if (!(amount > 0)) return;
    const settlement = accessibleSettlement(s, h);
    if (settlement) {
      const privatePart = amount * s.rules.householdShare;
      h.inventory[kind] += privatePart;
      settlement.storage[kind] += amount - privatePart;
    } else h.inventory[kind] += amount;
    if(kind==='food'){
      s.counts.foodFromLabor+=amount;s.lastFoodOutput+=amount;
      const local=s.metrics.foodProductionByTown ||= {};
      if(settlement)local[settlement.id]=(local[settlement.id]||0)+amount;
      // Older founding-area prayer exists before a named settlement.
      if(dist(h,s.camp)<13)local._founding=(local._founding||0)+amount;
    }
  }
  function localFoodProduction(s,settlementId){
    return s.metrics.foodProductionByTown?.[settlementId||'_founding']||0;
  }
  // Potential is measured for stable mild weather; this is not an instant harvest.
  function agricultureMildFieldYield(s,t) {
    const A=s.agriculture,L=A.land,R=A.river,C=A.seasons.mild;
    const d=Math.max(0,Math.abs(t.x-riverX(s,t.y))-R.riverHalfWidthCells);
    const influence=d<=R.fullEffectThroughCells?R.nearBankInfluence:
      d>=R.zeroEffectAtCells?0:R.nearBankInfluence*(R.zeroEffectAtCells-d)/(R.zeroEffectAtCells-R.fullEffectThroughCells);
    const moisture=clamp(C.backgroundMoisture+(1-C.backgroundMoisture)*influence*C.riverWaterAvailability);
    return L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
      Math.pow(moisture/L.referenceMoisture,L.moistureExponent);
  }
  function agricultureMildCapacity(s) {
    if(s.environment.landCapacityEvalDay!==days(s)) {
      const reach=s.agriculture.land.workReachCells;
      const alive=new Set(living(s).map(p=>p.id));
      const homes=s.households.filter(h=>h.members.some(id=>alive.has(id)));
      let capacity=0;
      for(const t of s.tiles)if(t.terrain==='field'&&
        homes.some(h=>Math.abs(t.x-h.x)<=reach&&Math.abs(t.y-h.y)<=reach))
          capacity+=agricultureMildFieldYield(s,t);
      s.environment.landCapacityMild=capacity;
      s.environment.landCapacityEvalDay=days(s);
    }
    return s.environment.landCapacityMild;
  }
  function agricultureCultivate(s,p,h) {
    const L=s.agriculture.land;
    if(!L.autonomousExpansionEnabled)return false;
    const town=accessibleSettlement(s,h);
    const homes=town?s.households.filter(v=>accessibleSettlement(s,v)?.id===town.id&&householdMembers(s,v).length):[h];
    const demand=homes.reduce((n,v)=>n+dailyFoodNeed(s,v),0);
    const reach=perceivedReach(s,p,L.workReachCells);
    let localCapacity=0;
    for(const t of s.tiles)if(t.terrain==='field'&&homes.some(v=>
      Math.abs(t.x-v.x)<=reach&&Math.abs(t.y-v.y)<=reach))localCapacity+=agricultureMildFieldYield(s,t);
    if(localCapacity>=demand*L.normalSeasonLandCapacityTargetRatio)return false;
    let chosen=null,best=-Infinity;
    for(let y=Math.max(0,h.y-reach);y<=Math.min(s.height-1,h.y+reach);y++)
      for(let x=Math.max(0,h.x-reach);x<=Math.min(s.width-1,h.x+reach);x++){
        const t=tile(s,x,y);
        if(t.terrain!=='meadow'||t.fertility<L.minimumCultivationFertility)continue;
        const score=agricultureMildFieldYield(s,t)-.002*Math.hypot(t.x-h.x,t.y-h.y);
        if(score>best){chosen=t;best=score;}
      }
    if(!chosen)return false; // No reachable suitable land: a genuine local limit.
    // This real work shift opens a plot with zero crops and yields no Food.
    chosen.terrain='field';chosen.cropStock=0;chosen.crop=0;
    s.environment.landCapacityMild+=agricultureMildFieldYield(s,chosen);
    s.counts.newFields=(s.counts.newFields||0)+1;
    p.proficiency.food=1-(1-p.proficiency.food)*
      Math.exp(-1/s.agriculture.worker.learningTimeConstantActualFoodWorkdays);
    p.activityReason+='；本次耕作開墾農地，作物仍須自然生長';
    if(p.lastDecision)p.lastDecision.reason=p.activityReason;
    return true;
  }
  function agricultureHarvest(s,p,h) {
    if(agricultureCultivate(s,p,h))return 0;
    const A=s.agriculture,L=A.land,W=A.worker;
    const reach=perceivedReach(s,p,A.land.workReachCells??9);
    const plots=s.tiles.filter(t=>t.terrain==='field'&&Math.abs(t.x-h.x)<=reach&&Math.abs(t.y-h.y)<=reach);
    if(!plots.length)return 0;
    let fertility=0,weighted=0;
    for(const t of plots){fertility+=t.fertility;weighted+=t.fertility*Math.pow(t.moisture/L.referenceMoisture,W.environmentMoistureExponent);}
    const skill=p.proficiency.food;
    let capacity=W.foodUnitsPerFullWorkdayAt50PctSkillAndNeutralEnvironment*
      (W.skillOutputIntercept+W.skillOutputSlope*skill)*weighted/Math.max(fertility,1e-9);
    capacity*=1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency');
    let harvested=0;
    plots.sort((a,b)=>b.cropStock-a.cropStock||a.y-b.y||a.x-b.x);
    for(const t of plots){const n=Math.min(Math.max(0,t.cropStock),capacity);t.cropStock-=n;capacity-=n;harvested+=n;if(capacity<=1e-9)break;}
    if(harvested>0)distribute(s,h,'food',harvested);
    p.proficiency.food=1-(1-skill)*Math.exp(-1/W.learningTimeConstantActualFoodWorkdays);
    return harvested;
  }
  function performWork(s, p) {
    const h = householdOf(s, p);
    if (!h) return;
    const blessed=p.divineStatuses?.efficiency;
    const statusActive=blessed&&activeStatus(s,p,'efficiency')>0&&!blessed.faithCredited;
    const priorFood=statusActive?s.counts.foodFromLabor:0;
    const priorMaterials=statusActive?['wood','stone','fiber'].reduce((n,k)=>
      n+h.inventory[k]+(accessibleSettlement(s,h)?.storage[k]||0),0):0;
    const priorBuild=statusActive?h.buildProgress:0;
    const priorGranary=statusActive?(accessibleSettlement(s,h)?.granary?.progress||0):0;
    const security = foodSecurity(s, h);
    const basic = security.town ? security.town.workDemand : null;
    const scarce = security.days < 4 || p.hunger > .35 || (basic && basic.foodPressure > .65);
    const field = nearestField(s, h,p);
    // Pioneers without existing fields can choose cultivation as a real food
    // activity. The work shift opens meadow; harvested Food still starts at zero.
    const L=s.agriculture?.land;
    let canCultivate=false;
    if(L?.autonomousExpansionEnabled&&!field){
      const reach=perceivedReach(s,p,L.workReachCells);
      for(let y=Math.max(0,h.y-reach);y<=Math.min(s.height-1,h.y+reach)&&!canCultivate;y++)
        for(let x=Math.max(0,h.x-reach);x<=Math.min(s.width-1,h.x+reach);x++){
          const t=tile(s,x,y);
          if(t.terrain==='meadow'&&t.fertility>=L.minimumCultivationFertility){canCultivate=true;break;}
        }
    }
    const wood = nearestResource(s, h, 'wood',p);
    const fiber = nearestResource(s, h, 'fiber',p);
    const forage = nearestResource(s, h, 'food',p);
    const stone = nearestResource(s, h, 'stone',p);
    const publicMaterials = security.town && security.town.storage.wood < 20;
    const publicStone = security.town && security.town.storage.stone < 14;
    const town=security.town, granary=town?ensureGranary(s,town):null, G=granaryRules(s);
    const granaryNeeded=granary&&!granary.built;
    const granaryWoodNeeded=granaryNeeded&&!granary.materialsPaid&&town.storage.wood+1e-9<G.woodRequired;
    const granaryStoneNeeded=granaryNeeded&&!granary.materialsPaid&&town.storage.stone+1e-9<G.stoneRequired;
    const granaryReady=granaryNeeded&&(granary.materialsPaid||
      (town.storage.wood+1e-9>=G.woodRequired&&town.storage.stone+1e-9>=G.stoneRequired));
    const canBuildGranary=granaryReady&&security.days>=G.minimumFoodDays&&
      p.hunger<.55&&!(town?.famineActive);
    const canBuild = !h.home && h.inventory.wood >= s.rules.hutWood && h.inventory.fiber >= s.rules.hutFiber;
    const call = workCalling(s, p);
    const foodBias = call.score;
    // Unmet shelter material needs still matter when food reserves make family care attractive.
    // This is decision pressure only: gathering and construction still require real work.
    const shelterMaterialBonus = !h.home && security.days >= 4
      ? clamp(num(s.agriculture?.workDemand?.unhousedMaterialPriorityBonus, 2), 0, 4) : 0;
    const candidates = [];
    if (forage) candidates.push({ name: 'forage', score: 4.8 + (scarce ? 3.5 : 0) + p.proficiency.gather + foodBias, valid: true });
    if (field||canCultivate) candidates.push({ name: 'farm',
      score:4.4+(field?.crop||0)*2.5+(scarce?2.2:0)+p.proficiency.food+foodBias+
        (canCultivate?(L.pioneerCultivationBonus??4.5):0),valid:true });
    if (wood && (!h.home || publicMaterials || (basic && basic.housingPressure > .2))) candidates.push({ name: 'wood', score: (granaryWoodNeeded?G.materialWorkPriority:!h.home && h.inventory.wood < s.rules.hutWood ? 8.0 + shelterMaterialBonus : publicMaterials ? 6.5 : 2.6) + p.proficiency.gather, valid: true });
    if (stone && (publicStone||granaryStoneNeeded)) candidates.push({ name: 'stone', score: (granaryStoneNeeded?G.materialWorkPriority:6.0) + p.proficiency.gather, valid: true });
    if (fiber && !h.home) candidates.push({ name: 'fiber', score: h.inventory.fiber < s.rules.hutFiber ? 7.5 + shelterMaterialBonus + p.proficiency.gather : 1, valid: true });
    if (!h.home && canBuild) candidates.push({ name: 'build', score: 9.3 + p.proficiency.build, valid: true });
    if(canBuildGranary)candidates.push({name:'build_granary',score:G.constructionPriority+p.proficiency.build,valid:true});
    // Not every work period should be production. When accessible reserves are
    // strong, adults can spend the work block supporting dependents and the home.
    // Oracle pressure can redirect willing people to feasible food activities.
    candidates.push({ name: 'care', score: 3.5 + (security.days >= (basic?.reserveComfortDays ?? s.agriculture?.workDemand?.reserveComfortDays ?? 11) ? (h.home ? (s.agriculture?.workDemand?.comfortableCareBonus ?? 5.0) : 5.0) : security.days >= (basic?.reserveRelaxDays ?? s.agriculture?.workDemand?.reserveRelaxDays ?? 7) ? 2.7 : 0) +
      (householdMembers(s,h).some(v=>v.stage==='child') ? .7 : 0), valid: true });
    if (!candidates.length) { p.activity = 'rest'; p.activityReason = '附近缺少可用資源，這次無法工作';
      p.lastDecision = { work: 'rest', hour: s.hour, reason: p.activityReason, foodDays: security.days, oracleInfluence: 0 }; return; }
    // Reasoned autonomous utility; no Oracle writes occupation, action or inventory directly.
    const specialization = n => (p.occupation === 'food_producer' && (n === 'farm' || n === 'forage') ? 1.35 : 0) +
      (p.occupation === 'gatherer' && (n === 'wood' || n === 'fiber' || n === 'stone') ? 1.1 : 0);
    const confusion=activeStatus(s,p,'confusion');
    if(confusion)for(const choice of candidates){
      // Deterministic bounded *mistake among feasible options*, never forced work.
      const roll=hash(s.seed+'|confusion|'+s.hour+'|'+p.id+'|'+choice.name)/4294967296;
      choice.score+=(roll-.5)*2*s.divinePowers.confusionScoreNoise*confusion;
    }
    candidates.sort((a,b)=> (b.score + specialization(b.name)) - (a.score + specialization(a.name)) || a.name.localeCompare(b.name));
    const choice = candidates[0];
    const normalScores = candidates.map(x=>({name:x.name,score:x.score - ((x.name==='farm'||x.name==='forage')?foodBias:0) + specialization(x.name)}));
    normalScores.sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
    const shifted = !!(call.oracle && (choice.name === 'farm' || choice.name === 'forage') && normalScores[0].name !== choice.name);
    const foodDays = Number.isFinite(security.days) ? security.days.toFixed(1) : '充足';
    const workReasons = {
      forage: `附近仍有可採集的野生食物；家戶可及存糧約 ${foodDays} 天`,
      farm: field?`附近農田作物成熟度 ${Math.round(field.crop*100)}%，農業熟練度 ${Math.round(p.proficiency.food*100)}%；家戶可及存糧約 ${foodDays} 天`:`附近適合開墾的草地可供農業發展；家戶可及存糧約 ${foodDays} 天`,
      wood: `住屋或聚落需要木材；家戶木材 ${h.inventory.wood.toFixed(1)}，附近可伐木`,
      fiber: `尚須纖維建屋；家戶纖維 ${h.inventory.fiber.toFixed(1)}`,
      stone: `附近可採石，公共建材需求尚未滿足`,
      build: `家戶已備齊 ${s.rules.hutWood} 木材與 ${s.rules.hutFiber} 纖維，正在投入建屋勞力`,
      build_granary: `${town?.name||'聚落'}具備建材及存糧，正在投入公共糧倉建設`,
      care: `可及糧食可供約 ${foodDays} 天，選擇維持家戶生活與照顧依賴成員`
    };
    const modifiers = [];
    if (scarce && (choice.name === 'farm' || choice.name === 'forage')) modifiers.push('目前糧食安全壓力提高了此工作的優先度');
    if (specialization(choice.name)>0) modifiers.push('現有職業與技能提高了工作傾向');
    if(confusion)modifiers.push('混亂正在干擾對可行工作的評估');
    if(activeStatus(s,p,'blindness'))modifiers.push('致盲縮短可發現的資源與農田範圍');
    if(activeStatus(s,p,'efficiency'))modifiers.push('效率祝福提高此人實際工作時的可行產出');
    if (shifted) modifiers.push('神諭使這次選擇有別於未收到神諭時的最高優先項目');
    else if (foodBias>0 && (choice.name==='farm'||choice.name==='forage')) modifiers.push('神諭強化原本可行的糧食工作');
    const reason = [workReasons[choice.name], ...modifiers].join('；');
    p.lastDecision = { work: choice.name, hour: s.hour, normalBest: normalScores[0].name,
      foodDays: security.days, sharedFoodAccess: !!security.town,
      oracleInfluence: (choice.name==='farm'||choice.name==='forage')?foodBias:0,
      changedByOracle: shifted, reason };
    p.activity = choice.name;
    p.activityReason = reason;
    p.lastWorkHour = s.hour;
    s.metrics.workChoices++;
    if (shifted) { s.metrics.oracleInfluencedChoices++; call.oracle.influenceWorkCount++; p.lastOracleWorkHour = s.hour; }
    if (choice.name === 'forage' && forage) {
      const amount = Math.min(forage.forage, (.6 + p.proficiency.gather * .45)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency')));
      forage.forage -= amount; distribute(s, h, 'food', amount);
    } else if (choice.name === 'farm' && (field||canCultivate)) {
      if (s.agriculture) agricultureHarvest(s,p,h);
      else if (field.crop >= .47) {
        // Historical Original crop is a fraction rather than a physical cropStock.
        // Preserve old baseline, but let enhanced output consume proportionately
        // more of the *existing* crop, capped by remaining crop fraction.
        const requested=1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency');
        const feasible=requested>1?
          Math.min(requested,Math.max(1,(field.crop-.04)/.52)):1;
        const amount=(1.5+p.proficiency.food*.8)*field.crop*field.fertility*
          s.rules.farmYieldMultiplier*feasible;
        field.crop=Math.max(.04,field.crop-.52*feasible);
        distribute(s,h,'food',amount);
      } else field.crop = clamp(field.crop + .035 + .04 * p.proficiency.food, 0, 1);
    } else if (choice.name === 'wood' && wood) {
      const amt = Math.min(wood.wood,(1.7 + p.proficiency.gather * .8)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency')));
      wood.wood -= amt; distribute(s, h, 'wood', amt);
    } else if (choice.name === 'stone' && stone) {
      const amt = Math.min(stone.stone,(1.2 + p.proficiency.gather * .6)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency')));
      stone.stone -= amt; distribute(s, h, 'stone', amt);
    } else if (choice.name === 'fiber' && fiber) {
      const amt = Math.min(fiber.fiber,(1.4 + p.proficiency.gather * .7)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency')));
      fiber.fiber -= amt; distribute(s, h, 'fiber', amt);
    } else if(choice.name==='build_granary'&&town&&granary&&!granary.built) {
      if(!granary.materialsPaid) {
        if(town.storage.wood+1e-9<G.woodRequired||town.storage.stone+1e-9<G.stoneRequired)
          throw Error('糧倉建造前的公共建材不足');
        town.storage.wood=Math.max(0,town.storage.wood-G.woodRequired);
        town.storage.stone=Math.max(0,town.storage.stone-G.stoneRequired);
        granary.materialsPaid=true;
      }
      granary.progress+=(1+p.proficiency.build*.55)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency'));
      if(granary.progress>=G.workRequired) {
        granary.built=true;
        log(s,'settlement',`${town.name} 的公共糧倉完工，居民可更有組織地儲存共同物資。`,
          [`使用本聚落公共木材 ${G.woodRequired}、石材 ${G.stoneRequired}`,
           `居民自主投入 ${granary.progress.toFixed(1)} 單位建造勞力`,
           '糧倉不會額外生成糧食，原有共享儲備保留']);
      }
    } else if(choice.name==='build') {
      if (!h.buildMaterialsPaid) {
        h.inventory.wood -= s.rules.hutWood; h.inventory.fiber -= s.rules.hutFiber;
        h.buildMaterialsPaid = true;
      }
      h.buildProgress += (1 + p.proficiency.build * .55)*
        (1+s.divinePowers.efficiencyWorkBonus*activeStatus(s,p,'efficiency'));
      if (h.buildProgress >= s.rules.hutWork) {
        h.home = true;
      }
    }
    p.x = h.x + (choice.name === 'farm' && field ? clamp(field.x - h.x,-2,2) * .28 : 0);
    p.y = h.y + (choice.name === 'farm' && field ? clamp(field.y - h.y,-2,2) * .28 : 0);
    if(statusActive){
      const currentTown=accessibleSettlement(s,h);
      const currentMaterials=['wood','stone','fiber'].reduce((n,k)=>
        n+h.inventory[k]+(currentTown?.storage[k]||0),0);
      const productive=(s.counts.foodFromLabor-priorFood)+
        Math.max(0,currentMaterials-priorMaterials)+
        Math.max(0,h.buildProgress-priorBuild)+
        Math.max(0,(currentTown?.granary?.progress||0)-priorGranary);
      if(productive>.15){
        blessed.faithCredited=true;
        const faith=allFaiths(s).find(f=>f.godId===blessed.godId);
        if(faith)miraclePersonalEvidence(s,faith,'efficiency',
          [{person:p,amount:s.religionPropagation.efficiencyDirectDevotion}],
          s.religionPropagation.efficiencyWitnessDevotion);
      }
    }
  }
  function updatePeople(s) {
    const phase = s.tick % 3;
    for (const p of s.people) {
      if (!p.alive) continue;
      if (phase === 0) { p.activity = 'rest'; p.activityReason = '每日固定的休息與恢復時段'; }
      else if (phase === 2) {
        const faith=faithOf(s,p.religionId);
        const priest=!!faith?.priests.includes(p.id);
        const believer=!!faith&&p.devotion>=20;
        const pray=believer&&(days(s)+hash(p.id))%5===0;
        const spread=believer?spreadCalling(s,p,faith):{score:0,oracle:null};
        const cadence=spread.score>=.25?(priest?2:4):(priest?3:7);
        const preach=believer&&p.stage==='adult'&&!pray&&
          (days(s)+hash(p.id))%cadence===0;
        p.activity=p.stage==='child'?'family':pray?'pray':preach?'preach':'family';
        if(preach){
          p.lastPreachHour=s.hour;
          if(spread.oracle){
            p.spreadSermonsSincePulse=(p.spreadSermonsSincePulse||0)+1;
            spread.oracle.influenceSermonCount=(spread.oracle.influenceSermonCount||0)+1;
            s.metrics.spreadInfluencedSermons=(s.metrics.spreadInfluencedSermons||0)+1;
          }
        }
        p.activityReason=p.activity==='preach'?
          (priest?'祭司利用閒暇時間向居民佈道':'利用閒暇時間與親友分享信仰'):
          p.activity==='pray'?'利用非工作時段祈禱':
          p.stage==='child'?'兒童由家人照顧，也可能接受宗教教育':'非工作時段，用於家戶生活及照料';
      }
      else if (p.stage === 'adult' && p.health >= 20) performWork(s,p);
      else { p.activity = 'family'; p.activityReason = '目前生命階段或健康狀況不適合一般工作'; }
    }
  }
  function updateWorld(s) {
    const day = days(s);
    // Coarse, bounded weather stress; default drought is temporary, not a forced multi-year catastrophe.
    const climate=s.agriculture?.seasons;
    const seasonal = day % (climate?.cycleDays || 160);
    const inWindows = (windows) => windows.some(([lo,hi])=>seasonal>=lo&&seasonal<=hi);
    const drought = climate ? inWindows(climate.dryWindows) : seasonal >= 14 && seasonal <= 29;
    const rainy = climate ? inWindows(climate.rainWindows) : seasonal < 6 || (seasonal >= 32 && seasonal < 40) || (seasonal >= 68 && seasonal < 75);
    s.environment.phase = drought ? 'dry' : rainy ? 'rainy' : 'mild';
    const naturalRain = drought ? 0 : rainy ? .015 : .005;
    const A=s.agriculture, season=drought?'dry':rainy?'rain':'mild';
    let effectSummary = 0;
    for (const t of s.tiles) {
      if (t.terrain === 'river') continue;
      const nearRiver = clamp(1-Math.abs(t.x-riverX(s,t.y))/10);
      let boost = 0, droughtPressure=0, ripeningFactor=1, ripeningSource=null;
      for (const e of s.effects) {
        if(s.hour>=e.endsAtHour||Math.hypot(t.x-e.x,t.y-e.y)>e.radius)continue;
        const kind=e.type||'rain';
        if(kind==='rain')boost+=.028*e.intensity;
        else if(kind==='drought')droughtPressure=Math.max(droughtPressure,e.intensity);
        else if(kind==='ripening'){
          const factor=1+e.intensity*s.divinePowers.ripeningGrowthPerIntensity;
          if(factor>ripeningFactor){ripeningFactor=factor;ripeningSource=e;}
        }
      }
      effectSummary+=boost;
      if(A) {
        const R=A.river,C=A.seasons[season],L=A.land;
        const d=Math.max(0,Math.abs(t.x-riverX(s,t.y))-R.riverHalfWidthCells);
        const influence=d<=R.fullEffectThroughCells?R.nearBankInfluence:
          d>=R.zeroEffectAtCells?0:R.nearBankInfluence*(R.zeroEffectAtCells-d)/(R.zeroEffectAtCells-R.fullEffectThroughCells);
        const target=clamp(C.backgroundMoisture+(1-C.backgroundMoisture)*influence*C.riverWaterAvailability-.16*droughtPressure);
        const tau=A.soilDynamics.referenceResponseTimeDays;
        t.moisture=clamp(t.moisture+(target-t.moisture)*(1-Math.exp(-s.rules.tickHours/24/tau))+boost-.009*droughtPressure,0,1);
        if(t.terrain==='field'){
          const daily=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
            Math.pow(t.moisture/L.referenceMoisture,L.moistureExponent);
          const cap=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
            Math.pow(1/L.referenceMoisture,L.moistureExponent)*L.cropStockCapacityDays;
          // A prior Harvest blessing may have created existing standing biomass above
          // the normal renewal cap. Keep that real stock until harvested; do not refill above it.
          const before=Math.max(0,t.cropStock);
          t.cropStock=Math.min(Math.max(cap,before),before+daily*ripeningFactor*s.rules.tickHours/24);
          if(ripeningSource&&!ripeningSource.faithCredited){
            const natural=Math.min(Math.max(cap,before),
              before+daily*s.rules.tickHours/24);
            const extra=Math.max(0,t.cropStock-natural);
            ripeningSource.evidenceCropGain=(ripeningSource.evidenceCropGain||0)+extra;
          }
          t.crop=cap>0?clamp(t.cropStock/cap):0;
        }
      } else {
      t.moisture = clamp(t.moisture - (drought ? .014 : .007) + naturalRain + nearRiver*.003 + boost-.018*droughtPressure, .03, .98);
      if (t.terrain === 'field') {
        const base=t.moisture > .23 ? (.006 + .029*t.moisture)*t.fertility : -.006;
        const growth=base>0?base*ripeningFactor:base;
        const before=t.crop;
        t.crop = clamp(t.crop + growth, .02, 1);
        if(ripeningSource&&!ripeningSource.faithCredited)
          ripeningSource.evidenceCropGain=(ripeningSource.evidenceCropGain||0)+
            Math.max(0,t.crop-clamp(before+base,.02,1));
      }
      }
      t.forage = clamp(t.forage + .004 * t.moisture * t.fertility, 0, 1.3);
      if (t.terrain === 'forest') t.wood = Math.min(16, t.wood + .005 * t.moisture);
      if (t.terrain === 'meadow') t.fiber = Math.min(8, t.fiber + .012 * t.moisture);
    }
    s.environment.totalRain += effectSummary;
    for(const effect of s.effects){
      if(effect.type!=='ripening'||effect.faithCredited||
        (effect.evidenceCropGain||0)<s.religionPropagation.ripeningEvidenceMinimumCrop)continue;
      effect.faithCredited=true;
      const faith=allFaiths(s).find(f=>f.godId===effect.godId);
      if(faith)miracleAgriculturalEvidence(s,faith,'ripening',effect,
        s.religionPropagation.ripeningWitnessDevotion);
    }
    const expired = s.effects.filter(e => s.hour >= e.endsAtHour);
    if (expired.length) {
      s.effects = s.effects.filter(e => s.hour < e.endsAtHour);
      for (const e of expired) log(s,'miracle', (e.type==='ripening'?'促熟':e.type==='drought'?'乾旱':'降雨')+'神蹟已結束；土地保留已產生的實際變化。', ['持續輸入到期，自然過程繼續，不回溯結果']);
    }
  }

  // A planned Granary is physical infrastructure; shared food remains accessible
  // as temporary communal stock before it is built. Construction never mints food.
  function granaryRules(s) {
    const p=s.agriculture?.granary || {};
    return {woodRequired:clamp(num(p.woodRequired,6),1,50),
      stoneRequired:clamp(num(p.stoneRequired,4),1,50),
      workRequired:clamp(num(p.workRequired,6),1,50),
      materialWorkPriority:clamp(num(p.materialWorkPriority,13),9,20),
      constructionPriority:clamp(num(p.constructionPriority,14),9,20),
      minimumFoodDays:clamp(num(p.minimumFoodDays,4),0,90)};
  }
  function ensureGranary(s,town) {
    if(!town.granary) {
      // Choose a nearby unoccupied meadow for this physical building.
      let pos=null, score=-Infinity;
      for(let y=Math.max(1,Math.round(town.y)-5);y<=Math.min(s.height-2,Math.round(town.y)+5);y++)
        for(let x=Math.max(1,Math.round(town.x)-5);x<=Math.min(s.width-2,Math.round(town.x)+5);x++){
          if(tile(s,x,y).terrain!=='meadow')continue;
          if(s.households.some(h=>householdMembers(s,h).length&&Math.hypot(x-h.x,y-h.y)<1.6))continue;
          if(s.settlements.some(v=>v.granary&&Math.hypot(x-v.granary.x,y-v.granary.y)<1.6))continue;
          const rating=-Math.hypot(x-town.x,y-town.y);
          if(rating>score){pos={x,y};score=rating;}
        }
      const loc=pos||nearestLand(s,town.x+2,town.y+1);
      town.granary={x:loc.x,y:loc.y,built:false,progress:0,materialsPaid:false};
    }
    return town.granary;
  }
  function establishOutpost(s){
    const F=s.agriculture?.familyExpansion;
    if(!F?.enabled||!s.settlements.length)return;
    // New settlement is derived from real already-built homes, never placed by God.
    const free=s.households.filter(h=>householdMembers(s,h).length&&!s.settlements.some(t=>t.householdIds.includes(h.id)));
    for(const anchor of free.filter(h=>h.home)){
      // Player's Genesis families are reserved for the authentic first settlement,
      // not prematurely relabelled as the rival's outpost s2.
      if(s.nativeWorld&&dist(anchor,s.camp)<=s.rules.settlementClusterDistance)continue;
      const group=free.filter(h=>Math.hypot(h.x-anchor.x,h.y-anchor.y)<=F.outpostClusterRadius);
      const finished=group.filter(h=>h.home);
      if(group.length<F.outpostMinHouseholds||finished.length<F.outpostMinHuts)continue;
      const center={x:Math.round(finished.reduce((n,h)=>n+h.x,0)/finished.length),
                    y:Math.round(finished.reduce((n,h)=>n+h.y,0)/finished.length)};
      if(s.settlements.some(t=>dist(t,center)<=s.rules.settlementClusterDistance))continue;
      const id='s'+Math.max(s.nativeWorld?2:1,
        s.settlements.reduce((n,t)=>Math.max(n,/^s\d+$/.test(t.id)?Number(t.id.slice(1)):0),0)+1);
      const town={id,name:'新拓聚落 '+id.slice(1),x:center.x,y:center.y,foundedAtHour:s.hour,
        householdIds:group.map(h=>h.id),storage:{food:0,wood:0,stone:0,fiber:0},granary:null,
        workDemand:{foodPressure:0,housingPressure:0},foodShortageDays:0,
        famineDays:0,famineReliefDays:0,famineActive:false,lastDailyUnmetFood:0};
      ensureGranary(s,town);
      s.settlements.push(town);
      for(const h of group)for(const person of householdMembers(s,h))person.settlementId=id;
      s.counts.newSettlements=(s.counts.newSettlements||0)+1;
      log(s,'settlement',town.name+'由 '+finished.length+' 戶已建屋的居民形成。',
        ['家戶自願向外定居','附近至少 '+F.outpostMinHuts+' 戶完成真實住屋',
         '獨立共享儲備從零開始；糧倉須由居民另外實際建造']);
      return;
    }
  }
  function updateSettlement(s) {
    const separated=!!s.nativeWorld;
    if (!hasSettlement(s)||(separated&&!s.settlements.some(t=>t.id==='s1'))) {
      const near = s.households.filter(h => dist(h, s.camp) <= s.rules.settlementClusterDistance&&
        // A native settlement cannot simultaneously belong to a new faith's
        // settlement merely because its residents live next door.
        !s.settlements.some(t=>t.householdIds.includes(h.id)));
      const huts = near.filter(h => h.home);
      if (huts.length >= s.rules.settlementMinHuts && near.length >= 4) {
        const town = { id: 's1', name: '初穗聚落', x:s.camp.x, y:s.camp.y,
          foundedAtHour:s.hour, householdIds:near.map(h=>h.id), storage:{food:0,wood:0,stone:0,fiber:0},granary:null,
          workDemand:{foodPressure:0,housingPressure:0}, foodShortageDays:0,
          famineDays:0, famineReliefDays:0, famineActive:false, lastDailyUnmetFood:0 };
        ensureGranary(s,town);
        if(separated)s.settlements.unshift(town);
        else s.settlements.push(town);
        for (const p of s.people) if (town.householdIds.includes(p.householdId)) p.settlementId = town.id;
        s.history.settlementFoundedHour = s.hour;
        log(s,'settlement',`${town.name} 由 ${huts.length} 戶已建屋的家庭形成。`,
          ['群居、土地與水源適宜；多戶實際收集建材並完成住所']);
      }
      // Existing native settlements are productive from Genesis even before
      // either religion independently builds the first new settlement.
      if(!separated||!hasSettlement(s))return;
    }
    establishOutpost(s);
    for (const town of s.settlements) {
      ensureGranary(s,town);
      const activeHomes = s.households.filter(h => accessibleSettlement(s,h)?.id === town.id && householdMembers(s,h).length);
      const totalNeed = activeHomes.reduce((n,h)=>n+dailyFoodNeed(s,h),0);
      const foodStock = town.storage.food + activeHomes.reduce((z,h)=>z+h.inventory.food,0);
      const reserve=localReservePolicy(s,town);
      const required=totalNeed*reserve.target; // local forecast, not imposed work quotas
      const foodPressure = totalNeed ? clamp(1 - foodStock/Math.max(1,required)) : 0;
      const housingPressure = activeHomes.filter(h=>!h.home).length / Math.max(1,activeHomes.length);
      town.workDemand=s.nativeWorld?
        {foodPressure,housingPressure,reserveTargetDays:reserve.target,
          reserveRelaxDays:reserve.relax,reserveComfortDays:reserve.comfort,
          riverBankDistance:reserve.bank,waterRisk:reserve.risk}:
        {foodPressure,housingPressure};
      if (foodPressure > .9) town.foodShortageDays++;
      else town.foodShortageDays = Math.max(0,town.foodShortageDays-1);
      // Famine is a meaningful transition backed by actual missed meals, not a daily stock summary.
      town.famineDays = town.lastDailyUnmetFood > .1 ? town.famineDays + 1 : 0;
      town.famineReliefDays = town.lastDailyUnmetFood > .1 ? 0 : (town.famineReliefDays||0) + 1;
      if (!town.famineActive && town.famineDays >= s.rules.famineAlertDays) {
        town.famineActive = true;
        log(s,'famine',`${town.name} 陷入飢荒，公共與私人存糧無法滿足日常飲食。`,
          ['多日真實缺糧與配給不足',`今日缺糧 ${town.lastDailyUnmetFood.toFixed(1)} 單位`]);
      } else if (town.famineActive && town.famineReliefDays >= s.rules.famineReliefDays) {
        town.famineActive = false;
        log(s,'famine',`${town.name} 的飢荒得到緩解。`,['家戶重新獲得足夠食物，不再需要限制配給']);
      }
    }
  }
  function restoreSettlementAccess(s) {
    if(s.agriculture?.familyExpansion?.enabled){
      // Membership follows distance and a single community's ownership; no
      // free food access across separated settlements.
      for(const h of s.households){
        if(!householdMembers(s,h).length||s.settlements.some(t=>t.householdIds.includes(h.id)))continue;
        const originIndex=Number(h.id.slice(1))-1;
        const foundingFamily=s.nativeWorld&&originIndex>=0&&
          originIndex<s.rules.initialHouseholds&&h.migrated===0;
        const homeCamp=foundingFamily&&s.opponent?.originMode==='separated-native'&&
          s.opponent.initialHouseholdIndexes.includes(originIndex)?
          s.opponentCamp:s.camp;
        const town=s.settlements.filter(t=>dist(t,h)<=s.rules.settlementClusterDistance&&
          (!foundingFamily||(!t.native&&dist(t,homeCamp)<=s.rules.settlementClusterDistance)))
          .sort((a,b)=>dist(a,h)-dist(b,h)||a.id.localeCompare(b.id))[0];
        if(town){
          town.householdIds.push(h.id);
          for(const p of householdMembers(s,h))p.settlementId=town.id;
          continue;
        }
        if(h.foodShortageDays<3)continue;
        const refuges=s.settlements.filter(t=>{
          const need=s.households.reduce((n,v)=>n+(accessibleSettlement(s,v)?.id===t.id?dailyFoodNeed(s,v):0),0);
          return t.storage.food>=need*s.rules.familyReturnFoodDays;
        }).sort((a,b)=>dist(a,h)-dist(b,h)||a.id.localeCompare(b.id));
        const refuge=refuges[0];if(!refuge)continue;
        const loc=nearestLand(s,refuge.x+3+(Number(h.id.slice(1))%3),refuge.y+(Number(h.id.slice(1))%5)-2);
        h.x=loc.x;h.y=loc.y;h.home=false;h.buildProgress=0;h.buildMaterialsPaid=false;
        refuge.householdIds.push(h.id);h.migrated++;s.counts.relocations++;
        for(const person of householdMembers(s,h)){person.x=h.x;person.y=h.y;person.settlementId=refuge.id;}
        log(s,'migration',h.name+'因無法維持外地生活，回到可供應的聚落。',
          ['實際缺糧持續','可及聚落的共同存糧足以提供救濟']);
      }
      return;
    }
    // A prior migration may have placed a household at the town edge. Membership
    // must follow actual reachable community affiliation, not an outdated ID list.
    const town = s.settlements[0];
    if (!town) return;
    for (const h of s.households) {
      if (!householdMembers(s,h).length || town.householdIds.includes(h.id)) continue;
      if (dist(town,h) <= s.rules.settlementClusterDistance) {
        town.householdIds.push(h.id);
        for (const p of householdMembers(s,h)) p.settlementId = town.id;
        log(s,'migration',`${h.name} 重新加入聚落的供應網。`,['住所仍在步行可達的聚落生活圈內']);
      } else {
        const dailyTownNeed = s.households.reduce((sum,other) => sum +
          (accessibleSettlement(s,other)?.id === town.id ? dailyFoodNeed(s,other) : 0),0);
        const safeReturn = town.storage.food >= dailyTownNeed * s.rules.familyReturnFoodDays;
        if (safeReturn && h.foodShortageDays >= 3) {
          const loc = nearestLand(s, town.x + 3 + (Number(h.id.slice(1)) % 3), town.y + (Number(h.id.slice(1)) % 5) - 2);
          h.x = loc.x; h.y = loc.y; h.home = false; h.buildProgress = 0; h.buildMaterialsPaid = false;
          town.householdIds.push(h.id);
          for (const p of householdMembers(s,h)) { p.x=loc.x;p.y=loc.y;p.settlementId=town.id; }
          s.counts.relocations++;
          log(s,'migration',`${h.name} 因外地缺糧，搬回聚落附近尋求共同照顧。`,
            ['家戶在外多日無法取得食物','聚落的可用存糧已足以提供基本支援']);
        }
      }
    }
  }
  function consumeFood(s) {
    // Compute every household's real need and private meal first; distribute
    // insufficient common stock proportionally to actual deficits (not first-come-first-served).
    const entries = s.households.map(h => {
      const persons = householdMembers(s,h);
      const total = dailyFoodNeed(s,h);
      const own = Math.min(total, h.inventory.food);
      h.inventory.food = Math.max(0, h.inventory.food - own);
      return {h, persons, total, own, deficit:total-own, town:accessibleSettlement(s,h), fromCommon:0};
    });
    for(const town of s.settlements) {
      const residents = entries.filter(e=>e.town?.id===town.id);
      const deficit = residents.reduce((z,e)=>z+e.deficit,0);
      const ratio = deficit > 0 ? Math.min(1,town.storage.food/deficit) : 0;
      for(const e of residents) {
        e.fromCommon = e.deficit * ratio;
        town.storage.food = Math.max(0,town.storage.food-e.fromCommon);
      }
      town.lastDailyUnmetFood = residents.reduce((z,e)=>z+e.deficit-e.fromCommon,0);
    }
    for(const e of entries) {
      if(!e.persons.length) continue;
      const {h,total} = e;
      let meal = e.own+e.fromCommon;
      // Prefer dependents in actual household meal allocation, not imaginary food.
      const priority = p => p.stage==='child'?0:p.stage==='elder'?1:2;
      const members = e.persons.slice().sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id));
      for (const p of members) {
        const need = p.stage==='child' ? s.rules.foodNeedChild : s.rules.foodNeedAdult;
        const received = Math.min(need,meal); meal -= received;
        const deficitRatio = need > 0 ? 1-received/need : 0;
        p.hunger = clamp(p.hunger + .09*deficitRatio - .07*(1-deficitRatio),0,1);
        if (p.hunger > .7) p.health = Math.max(0,p.health-.35);
        else p.health = Math.min(100,p.health+.08);
      }
      const missing = Math.max(0, total - (e.own+e.fromCommon));
      h.foodShortageDays = missing > .1 ? h.foodShortageDays+1 : 0;
      if(!h.famineActive && h.foodShortageDays >= s.rules.isolatedFamineDays && !e.town &&
        e.persons.some(p=>p.hunger>.55)) {
        h.famineActive=true;
        log(s,'famine',`${h.name} 與聚落糧倉失去供應連結，連續多日食物不足。`,
          ['家戶實際缺糧','所在位置或社群歸屬使公共庫存無法直接取得']);
      } else if(h.famineActive && h.foodShortageDays===0) {
        h.famineActive=false;
        log(s,'famine',`${h.name} 的糧食危機解除。`,['家戶重新獲得可食用存糧']);
      }
    }
  }
  // A direct prayer exists independently of clergy. Priests collect and summarize
  // actual local open petitions; no extra believer wishes are conjured by appointment.
  const PETITION_TYPES=Object.freeze({
    'food-water':{title:'缺雨與作物',summary:'希望改善當地水分與農作物生長'},
    'food-shortage':{title:'糧食不足',summary:'希望聚落得到充足的食物供應'},
    'healing':{title:'傷病與治療',summary:'希望病傷的親友恢復健康'},
    'shelter':{title:'住所與安居',summary:'希望家戶能取得建材及安全住所'}
  });
  function prayerSettlement(s,prayer){
    const direct=s.settlements.find(t=>t.id===prayer.settlementId);
    if(direct)return direct;
    const first=(prayer.by||[]).map(id=>s.people.find(p=>p.id===id&&p.alive)).find(Boolean);
    return first?personSettlement(s,first):null;
  }
  // A prayer's location is a source/measurement center, NOT a promise that
  // every cell in the circle needs intervention. Founding-area petitions in
  // older saves had no explicit center; their evaluation was based on s.camp.
  function prayerLocation(s,prayerId){
    const prayer=typeof prayerId==='string'?
      s.religion.prayers.find(p=>p.id===prayerId):prayerId;
    if(!prayer)return null;
    const recorded=prayer.center;
    const settlement=prayerSettlement(s,prayer);
    const valid=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&
      point.x>=0&&point.y>=0&&point.x<s.width&&point.y<s.height;
    let center=recorded,source='recorded';
    if(!valid(center)){
      if(prayer.settlementId&&settlement){
        center=settlement;source='settlement-fallback';
      }else if(prayer.type==='food-water'&&!prayer.settlementId){
        center=s.camp;source='founding-fallback';
      }else return null;
    }
    if(!valid(center))return null;
    const regional=!!prayer.settlementId;
    return {id:prayer.id,type:prayer.type,center:{x:center.x,y:center.y},
      // The water petition samples real fields within 11 world cells.
      radius:prayer.type==='food-water'?11:0,
      settlementId:settlement?.id||prayer.settlementId||null,
      locationName:settlement?.name||(regional?'原聚落':'創始河谷'),
      source,locationMeaning:prayer.type==='food-water'?'農田需求評估中心':
        regional?'聚落需求評估中心':'祈求來源位置'};
  }
  function priestPetitions(s,priestId){
    const priest=s.people.find(p=>p.id===priestId&&p.alive);
    if(!priest||!s.religion.priests.includes(priestId))return [];
    return s.religion.prayers.filter(p=>p.status==='open'&&p.collectedBy===priestId)
      .map(prayer=>{
        const region=prayerSettlement(s,prayer);
        const meta=PETITION_TYPES[prayer.type]||{title:'信徒祈禱',summary:'信徒提出的當地需要'};
        return {id:prayer.id,type:prayer.type,title:meta.title,
          summary:prayer.needSummary||meta.summary,settlementId:region?.id||null,
          settlementName:region?.name||'尚未形成聚落',
          createdAtHour:prayer.createdAtHour,
          receivedAtHour:prayer.collectedAtHour,
          supporterCount:new Set(prayer.by||[]).size,
          location:prayerLocation(s,prayer)};
      }).sort((a,b)=>b.createdAtHour-a.createdAtHour||a.id.localeCompare(b.id));
  }
  function collectPrayers(s){
    for(const faith of allFaiths(s)){
      const priests=faith.priests.map(id=>s.people.find(p=>p.id===id&&p.alive)).filter(Boolean);
      for(const prayer of faith.prayers||[]){
        if(prayer.status!=='open'){prayer.collectedBy=null;continue;}
        const location=prayerSettlement(s,prayer);
        const chosen=location?priests.filter(p=>personSettlement(s,p)?.id===location.id)
          .sort((a,b)=>a.id.localeCompare(b.id))[0]:null;
        if(!chosen){prayer.collectedBy=null;continue;}
        if(prayer.collectedBy!==chosen.id)prayer.collectedAtHour=s.hour;
        prayer.collectedBy=chosen.id;
      }
    }
  }
  function updateRegionalPrayers(s){
    const live=living(s);
    for(const faith of allFaiths(s)){
      faith.prayers ||= [];
      const last=faith.regionalPrayerAt ||= {};
      for(const town of s.settlements){
        const families=s.households.filter(h=>town.householdIds.includes(h.id)&&
          dist(town,h)<=s.rules.settlementClusterDistance);
        const believers=live.filter(p=>p.religionId===faith.id&&p.devotion>=20&&
          personSettlement(s,p)?.id===town.id);
        if(!believers.length)continue;
        const shortageDays=(town.storage.food+families.reduce((n,h)=>n+h.inventory.food,0))/
          Math.max(.01,families.reduce((n,h)=>n+dailyFoodNeed(s,h),0));
        const ill=believers.filter(p=>p.health<70);
        const homeless=families.filter(h=>!h.home&&householdMembers(s,h).length);
        const fields=s.tiles.filter(t=>t.terrain==='field'&&dist(t,town)<11);
        const wet=fields.reduce((n,t)=>n+t.moisture,0)/Math.max(fields.length,1);
        const crops=fields.reduce((n,t)=>n+t.crop,0)/Math.max(fields.length,1);
        // Player founding prayer has a dedicated original-area path. All other
        // settlements, including the AI's true s2, petition locally.
        const wantsWater=(faith!==s.religion||town.id!==s.settlements[0]?.id)&&
          fields.length>0&&wet<.48&&(crops<.4||shortageDays<10);
        const wantsFood=shortageDays<6;
        const wantsHealing=ill.length>0;
        const wantsShelter=homeless.length>=2&&days(s)-Math.floor(town.foundedAtHour/24)>=10;
        const conditions={'food-water':wantsWater,'food-shortage':wantsFood,
          'healing':wantsHealing,'shelter':wantsShelter};
        for(const p of faith.prayers)if(p.settlementId===town.id&&
          p.status==='open'&&p.type!=='food-water'&&!conditions[p.type])
            p.status='resolved';
        const candidate=['food-water','food-shortage','healing','shelter'].find(type=>
          conditions[type]&&!faith.prayers.some(p=>p.status==='open'&&
            p.settlementId===town.id&&p.type===type));
        if(!candidate||s.hour-(last[town.id]??-Infinity)<6*24)continue;
        const reasons={
          'food-water':`當地農田含水約 ${Math.round(wet*100)}%，農作物生長受影響`,
          'food-shortage':`本地可及存糧約 ${shortageDays.toFixed(1)} 日`,
          'healing':`${ill.length} 位信徒身體欠佳，希望獲得治療`,
          'shelter':`${homeless.length} 個家戶尚無住所`
        };
        const actual=candidate==='healing'?ill:believers;
        const prayer={id:'need-'+s.nextId++,type:candidate,
          settlementId:town.id,center:{x:town.x,y:town.y},
          createdAtHour:s.hour,status:'open',
          by:actual.slice(0,12).map(p=>p.id),needSummary:reasons[candidate],
          beforeMoisture:wet,foodAtRequest:town.storage.food,
          foodProductionAtRequest:s.counts.foodFromLabor,
          localFoodProductionAtRequest:localFoodProduction(s,town.id),
          castSeen:false,castId:null};
        faith.prayers.push(prayer);
        if(faith===s.religion)
          alertPlayer(s,'slow','prayer',town.name+'：'+reasons[candidate],
            prayer.center,{prayerId:prayer.id});
        last[town.id]=s.hour;
      }
      faith.prayers=faith.prayers.filter(p=>s.hour-p.createdAtHour<=120*24)
        .slice(-s.rules.prayerLimit);
    }
  }
  function updatePrayers(s) {
    // Direct believer Prayer: short-lived evidence context, not perpetual exposure logs.
    const fields = s.tiles.filter(t=>t.terrain==='field' && dist(t,s.camp)<11);
    const wet = fields.reduce((z,t)=>z+t.moisture,0)/Math.max(fields.length,1);
    const poorFood = stats(s).food < living(s).length * 8 || fields.reduce((z,t)=>z+t.crop,0)/Math.max(fields.length,1) < .40;
    const needRain = wet < .48;
    const existing=s.religion.prayers.find(p=>p.status==='open' && p.type==='food-water');
    if (needRain && poorFood && !existing && (s.hour-s.religion.lastPrayerHour)>=6*24) {
      const supporters=living(s).filter(p=>p.religionId===s.religion.id && p.devotion>=20 && dist(p,s.camp)<13);
      if (supporters.length) {
        const prayer={ id:'need-'+s.nextId++, type:'food-water', createdAtHour:s.hour, status:'open',
          by:supporters.slice(0,12).map(p=>p.id),
          center:{x:s.camp.x,y:s.camp.y},beforeMoisture:wet,foodAtRequest:stats(s).food,
          foodProductionAtRequest:s.counts.foodFromLabor,
          localFoodProductionAtRequest:localFoodProduction(s,null),
          castSeen:false, castId:null };
        s.religion.prayers.push(prayer);
        alertPlayer(s,'slow','prayer','創始河谷：信徒祈求降雨以改善農田',prayer.center,
          {prayerId:prayer.id});
        s.religion.lastPrayerHour=s.hour;
        // Prayer is live need/petition information, not an endlessly repeated historical headline.
      }
    }
    s.religion.prayers = s.religion.prayers.filter(p=>s.hour-p.createdAtHour<=120*24).slice(-s.rules.prayerLimit);
  }
  function individualApplyFaithEvidence(s, faith, ids, amount, cause) {
    // Individual ownership: religion reports credible evidence; only the person-state transition changes Devotion.
    let changed=0;
    for(const id of ids) {
      const p=s.people.find(v=>v.id===id && v.alive);
      if(!p||p.religionId!==faith.id) continue;
      const prev=p.devotion;
      p.devotion=clamp(p.devotion+amount,0,100);
      p.lastFaithEvidence={hour:s.hour,cause,change:p.devotion-prev,godId:faith.godId};
      if(p.devotion>prev) changed++;
    }
    return changed;
  }
  function checkFulfillment(s) {
    const st=stats(s);
    for(const faith of allFaiths(s)){
      for(const prayer of faith.prayers||[]){
        if(prayer.status!=='open'||prayer.type!=='food-water')continue;
        // A targeted Rain fulfills its OWN faith's real regional petition only
        // after a measurable moisture improvement and LOCAL food production.
        const center=prayer.center||s.camp;
        const rain=s.effects.find(e=>(e.type||'rain')==='rain'&&
          (e.godId===faith.godId||(!e.godId&&faith===s.religion))&&
          dist(e,center)<=e.radius+6&&e.startsAtHour>=prayer.createdAtHour);
        if(rain){prayer.castSeen=true;prayer.castId=rain.id;}
        const fields=prayer.center?
          s.tiles.filter(t=>t.terrain==='field'&&dist(t,center)<11):null;
        const wet=fields?fields.reduce((n,t)=>n+t.moisture,0)/Math.max(fields.length,1):
          st.avgMoisture;
        const improved=wet-prayer.beforeMoisture>.08;
        const foodGain=Number.isFinite(prayer.localFoodProductionAtRequest)?
          localFoodProduction(s,prayer.settlementId)-prayer.localFoodProductionAtRequest:
          s.counts.foodFromLabor-prayer.foodProductionAtRequest;
        const harvested=foodGain>=8;
        const recent=s.hour-prayer.createdAtHour<60*24;
        if(prayer.castSeen&&improved&&harvested&&recent){
          prayer.status='answered';prayer.answeredAtHour=s.hour;
          const witnesses=prayer.by.map(id=>s.people.find(p=>p.id===id&&p.alive))
            .filter(Boolean);
          const main=new Set(witnesses.map(p=>p.id));
          const changed=individualApplyFaithEvidence(s,faith,prayer.by,12,
            '降雨改善農田與實際食物供應，回應當地祈求');
          const secondary=miracleWitnesses(s,faith,'rain',[center],main,
            s.religionPropagation.rainWitnessDevotion);
          log(s,'faith',faith.name+'回應了當地缺雨祈求：'+changed+
            ' 位祈禱者加深信仰，'+secondary+' 位居民受到小幅影響。',
            ['來源相符的神明降雨改善當地農田水分',
             '當地居民確實收成糧食；每筆需求只給一次信仰回饋']);
        }else if(!recent)prayer.status='lapsed';
      }
      for(const o of faith.oracles){
        if(o.status!=='active'||o.intentType!=='food.produce'||
          o.fulfillmentCredited||o.influenceWorkCount<3)continue;
        const foodGain=st.food-o.progressFoodAtStart;
        if(foodGain>5&&s.hour>o.issuedAtHour+24){
          o.fulfillmentCredited=true;
          const ids=living(s).filter(p=>oracleContact(s,p,o,faith)>0).map(p=>p.id);
          const changed=individualApplyFaithEvidence(s,faith,ids,6,
            '神諭推動真實食物勞動並改善存糧');
          log(s,'faith',faith.name+'的糧食神諭成果逐漸被看見；'+changed+
            ' 位居民加深信仰。',
            ['部分居民自主提高糧食工作優先度','實際總食物有所改善',
             '有效的 Saint 神諭提供可追溯的宗教歸因']);
        }
      }
    }
  }
  // Religious offices must not remain attached to somebody who no longer
  // follows this God. This matters once bilateral Priest conversions are real.
  function reconcileFaithOffices(s,faith){
    const members=new Map(living(s).map(p=>[p.id,p]));
    const belongs=(id,min)=>members.get(id)?.religionId===faith.id&&members.get(id).devotion>=min;
    faith.priests=faith.priests.filter(id=>belongs(id,20));
    faith.saints=faith.saints.filter(id=>belongs(id,40));
    for(const o of faith.oracles)if(o.status==='active'&&!faith.saints.includes(o.saintId)){
      o.status='saint_departed';
      log(s,'oracle',`${faith.name}：聆聽者已不再具備所屬宗教的 Saint 資格，神諭停止傳播。`,
        ['角色依照真實居民當前信仰與虔誠度維持，無法繼續代表原神明傳播']);
    }
  }
  function opponentTurn(s){
    const ai=s.opponent;
    if(!ai?.enabled)return;
    const day=days(s);
    if(day<ai.startDay||day%ai.decisionIntervalDays!==0||ai.lastActionDay===day)return;
    ai.lastActionDay=day;ai.turns++;
    const faith=s.opponentReligion,adherents=living(s).filter(p=>
      p.religionId===faith.id&&p.devotion>=20);
    if(!adherents.length)return;
    const saint=faith.saints.map(id=>adherents.find(p=>p.id===id)).find(Boolean);
    if(saint&&!faith.oracles.some(o=>o.status==='active'&&o.intentType==='religion.spread'))
      issueOracle(s,{godId:s.opponentGod.id,saintId:saint.id,
        intentType:'religion.spread',durationDays:ai.spreadOracleDurationDays});
    // Real followers, physical farmland and local faith determine every target.
    const priests=faith.priests.map(id=>adherents.find(p=>p.id===id)).filter(Boolean);
    const candidate=priests[0]||saint||adherents.sort((a,b)=>b.devotion-a.devotion||a.id.localeCompare(b.id))[0];
    const center={x:candidate.x,y:candidate.y};
    const localFields=rayCells(s,center,7).filter(t=>t.terrain==='field');
    const wet=localFields.reduce((sum,t)=>sum+t.moisture,0)/Math.max(1,localFields.length);
    const weak=adherents.filter(p=>dist(p,center)<=6&&p.health<85);
    const choices=[];
    if(ai.turns%ai.offensiveEveryTurns===0){
      const enemyPriest=s.religion.priests.map(id=>living(s).find(p=>p.id===id))
        .filter(Boolean).sort((a,b)=>dist(a,center)-dist(b,center))[0];
      if(enemyPriest&&dist(enemyPriest,center)<12)
        choices.push(['confusion',{x:enemyPriest.x,y:enemyPriest.y,radius:5,
          intensity:.7,durationDays:7}]);
    }
    if(localFields.length&&wet<.45)
      choices.push(['rain',{...center,radius:7,intensity:.8,durationDays:7}]);
    // Real injured followers must not be ignored just because some field
    // happens to be eligible for yet another Ripening spell.
    if(weak.length)choices.push(['heal',{...center,radius:6,intensity:1}]);
    const productiveCore=adherents.some(p=>dist(p,center)<=7&&p.devotion>=40);
    if(productiveCore&&ai.turns%3===0)
      choices.push(['efficiency',{...center,radius:7,intensity:.85,durationDays:10}]);
    if(localFields.length)choices.push(['ripening',{...center,radius:7,intensity:1,durationDays:9}]);
    if(productiveCore)
      choices.push(['efficiency',{...center,radius:7,intensity:.85,durationDays:10}]);
    for(const [type,args] of choices){
      const input={...args,godId:s.opponentGod.id};
      if(!evaluateMiracle(s,type,input).ok)continue;
      const cast=castMiracle(s,type,input);
      if(cast.ok){ai.casts++;break;}
    }
  }
  function daily(s) {
    restoreSettlementAccess(s);
    consumeFood(s);
    updateSettlement(s);
    updatePrayers(s);
    updateRegionalPrayers(s);
    checkFulfillment(s);
    const rate=stats(s).dpRateDay;
    s.god.dp=Math.min(s.god.cap,s.god.dp+rate);
    if(s.opponent?.enabled)s.opponentGod.dp=Math.min(s.opponentGod.cap,
      s.opponentGod.dp+faithDpRate(s,s.opponentReligion));
    for(const faith of allFaiths(s)){reconcileFaithOffices(s,faith);ensureSaint(s,faith);ensurePriest(s,faith);}
    collectPrayers(s);
    if(days(s)>0&&days(s)%s.religionPropagation.pulseDays===0){
      const faiths=allFaiths(s);
      if(s.opponent?.enabled&&Math.floor(days(s)/s.religionPropagation.pulseDays)%2===1)
        faiths.reverse();
      for(const faith of faiths)socialReligionPulse(s,faith);
      for(const p of living(s))p.spreadSermonsSincePulse=0;
      for(const faith of allFaiths(s))relayOracles(s,faith);
    }
    opponentTurn(s);
    s.lastFoodOutput=0;
  }
  function processOracles(s) {
    for(const faith of allFaiths(s)){
    for(const o of faith.oracles) {
      if (o.status!=='active') continue;
      const owner=s.people.find(p=>p.id===o.saintId && p.alive);
      if(!owner) {
        o.status='saint_dead';
        log(s,'oracle','聆聽者離世，屬於他的神諭停止傳播。',['不自動轉移給下一位 Saint；既有生活成果繼續存在']);
      } else if(s.hour>=o.expiresAtHour) {
        o.status='expired';
        log(s,'oracle',(o.intentType==='religion.spread'?'傳教':'糧食')+'神諭的效期自然結束。',['到期免費，已完成的生活成果不回溯']);
      } else if (o.propagatedAtHour===null && s.hour>=o.issuedAtHour+24) {
        o.propagatedAtHour=s.hour;
        const town=personSettlement(s,owner);
        if(town)(o.reachedSettlements ||= {})[town.id]={hour:s.hour,via:'saint'};
        o.heardCount=living(s).filter(p=>oracleContact(s,p,o,faith)>0).length;
        log(s,'oracle',`${owner.name} 開始向附近居民講述${o.intentType==='religion.spread'?'傳教':'糧食'}神諭；${o.heardCount} 人有機會聽見。`,
          ['Saint 接收內容可靠','傳播受個人距離與社群影響，不是向全地圖強制廣播']);
      }
    }
    // Independent quota refill from simulation time, including overdraft debt.
    for(const record of Object.values(faith.saintQuota||{})) {
      while(s.hour>=record.nextRefillHour) {
        record.quota=Math.min(s.rules.oracleQuota,record.quota+1);
        record.nextRefillHour+=s.rules.oracleRefillDays*24;
      }
    }
    }
  }
  function processScheduledBirths(s) {
    // Births are due-time events, not delayed until the next monthly conception check.
    for(const p of s.people.slice()) {
      if(!p.alive) continue;
      if(p.pregnancyDueHour!==null && s.hour>=p.pregnancyDueHour) {
        p.pregnancyDueHour=null;
        p.recoveryUntilHour=s.hour+s.rules.postpartumRecoveryDays*24;
        const h=householdOf(s,p); if (!h) continue;
        const baby={...p,id:'p'+s.nextId++,name:'新生・'+HUMAN_NAMES[Math.floor(rand(s)*HUMAN_NAMES.length)],
          x:h.x,y:h.y,age:0,stage:'child',genderRole:rand(s)<.5?'gestate':'fertilize',partnerId:null,
          ...(s.agriculture?.familyExpansion?.enabled?{parentIds:[p.id,p.partnerId].filter(Boolean),originHouseholdId:h.id}:{}),
          occupation:'dependent',pregnancyDueHour:null,recoveryUntilHour:0,health:100,hunger:0,devotion:10,religionId:null,
          receptivity:rand(s),
          proficiency:{food:p.proficiency.food*.3,gather:p.proficiency.gather*.3,build:p.proficiency.build*.3},
          activity:'family',activityReason:'新生兒需要家戶照護',lastDecision:null,lastFaithEvidence:null,lastWorkHour:-1,lastOracleWorkHour:-1};
        s.people.push(baby);h.members.push(baby.id);s.counts.births++;
        log(s,'birth',`${h.name} 迎來一名新生兒。`,['孕期到達，依家庭關係新增真正的 Individual']);
      }
    }
  }
  function relocationSite(s, home, town) {
    let best=null, bestScore=-Infinity;
    const minDistance = s.rules.settlementClusterDistance + 3;
    // Limited candidate sampling at demographic cadence, not per frame or full-map pathfinding.
    for(let ring=0;ring<2;ring++) for(let i=0;i<24;i++) {
      const a=(i+Number(home.id.slice(1))*.37)*Math.PI/12;
      const radius=minDistance+ring*5;
      const loc=nearestLand(s,town.x+Math.cos(a)*radius,town.y+Math.sin(a)*radius);
      if(dist(loc,town)<=s.rules.settlementClusterDistance+1) continue;
      if(s.households.some(h=>h.id!==home.id&&householdMembers(s,h).length&&dist(loc,h)<3)) continue;
      const field=nearestField(s,loc), forage=nearestResource(s,loc,'food');
      const opportunity=(field?.crop||0)*2 + (forage?.forage||0)*1.2;
      const moisture=tile(s,loc.x,loc.y).moisture;
      const score=opportunity+moisture*.25;
      if(score>bestScore){bestScore=score;best=loc;}
    }
    return bestScore>.8?best:null;
  }
  function moveHousehold(s,h,next,town,leaving) {
    h.x=next.x; h.y=next.y;
    // Leaving a physical dwelling behind is not the same as carrying a house to a new site.
    h.home=false; h.buildProgress=0; h.buildMaterialsPaid=false;
    for(const p of householdMembers(s,h)){p.x=next.x;p.y=next.y;p.settlementId=leaving?null:town.id;}
    if(leaving) town.householdIds=town.householdIds.filter(id=>id!==h.id);
    else if(!town.householdIds.includes(h.id))town.householdIds.push(h.id);
    h.migrated++;
    s.counts.relocations++;
  }

  // Low-rate opportunities, not orders: real people, kinship, resources and available land.
  function compatiblePartners(s,a,b,F) {
    if(!a.alive||!b.alive||a.stage!=='adult'||b.stage!=='adult'||a.partnerId||b.partnerId||
       a.genderRole===b.genderRole)return false;
    if(a.age<F.minPairAge||b.age<F.minPairAge||a.age>F.maxPairAge||b.age>F.maxPairAge||
       Math.abs(a.age-b.age)>F.maxAgeGap||a.health<F.minHealth||b.health<F.minHealth||
       a.hunger>.55||b.hunger>.55)return false;
    const ah=householdOf(s,a),bh=householdOf(s,b);
    if(!ah||!bh||ah.id===bh.id||dist(ah,bh)>F.pairRange)return false;
    if((a.originHouseholdId||ah.id)===(b.originHouseholdId||bh.id))return false;
    const parents=new Set(a.parentIds||[]);
    if(parents.has(b.id)||(b.parentIds||[]).includes(a.id)||
       (b.parentIds||[]).some(id=>parents.has(id)))return false;
    if((accessibleSettlement(s,ah)?.id||null)!==(accessibleSettlement(s,bh)?.id||null))return false;
    return foodSecurity(s,ah).days>=F.requiredFoodDays&&foodSecurity(s,bh).days>=F.requiredFoodDays;
  }
  function familyHomeSite(s,origin,F) {
    const town=accessibleSettlement(s,origin);
    const count=town?s.households.filter(h=>accessibleSettlement(s,h)?.id===town.id&&householdMembers(s,h).length).length:0;
    const pioneer=town&&count>=F.pioneerAfterHouseholds&&rand(s)<F.pioneerChance;
    function choose(center,inner,outer,remote) {
      let best=null,score=-Infinity;
      for(let y=Math.max(1,Math.floor(center.y-outer));y<Math.min(s.height-1,Math.ceil(center.y+outer));y++)
        for(let x=Math.max(1,Math.floor(center.x-outer));x<Math.min(s.width-1,Math.ceil(center.x+outer));x++){
          const t=tile(s,x,y),d=Math.hypot(x-center.x,y-center.y);
          if(t.terrain!=='meadow'||d<inner||d>outer)continue;
          if(s.households.some(h=>householdMembers(s,h).length&&Math.hypot(x-h.x,y-h.y)<F.homeSpacing))continue;
          if(remote&&s.settlements.some(v=>Math.hypot(x-v.x,y-v.y)<=s.rules.settlementClusterDistance+1))continue;
          const nearby=remote?s.households.filter(h=>h.home&&householdMembers(s,h).length&&!accessibleSettlement(s,h)&&Math.hypot(x-h.x,y-h.y)<=F.outpostNeighborRadius).length:0;
          const rank=t.fertility+.4*t.moisture+nearby*3-.008*Math.abs(x-riverX(s,y))-.001*Math.hypot(x-origin.x,y-origin.y);
          if(rank>score){score=rank;best={x,y};}
        }
      return best;
    }
    if(pioneer){
      const anchors=s.households.filter(h=>h.home&&householdMembers(s,h).length&&!accessibleSettlement(s,h));
      for(const home of anchors){const pos=choose(home,F.homeSpacing,F.outpostNeighborRadius,true);if(pos)return pos;}
      const remote=choose(town,F.pioneerMinRadius,F.pioneerMaxRadius,true);
      if(remote)return remote;
    }
    return choose(town||origin,F.homeSpacing,F.homeRadius,false);
  }
  function transferStartupFood(s,ah,bh,amount,F){
    const town=accessibleSettlement(s,ah);
    const common=town&&accessibleSettlement(s,bh)?.id===town.id;
    const available=ah.inventory.food+bh.inventory.food+(common?town.storage.food:0);
    if(available+1e-8<amount)return false;
    if(common){
      const need=s.households.reduce((n,h)=>n+(accessibleSettlement(s,h)?.id===town.id?dailyFoodNeed(s,h):0),0);
      if(available<amount+need*F.communalSafetyDays)return false;
    }
    let remaining=amount;
    for(const home of [ah,bh]){const n=Math.min(home.inventory.food,remaining,amount/2);home.inventory.food-=n;remaining-=n;}
    if(common){const n=Math.min(town.storage.food,remaining);town.storage.food-=n;remaining-=n;}
    for(const home of [ah,bh]){const n=Math.min(home.inventory.food,remaining);home.inventory.food-=n;remaining-=n;}
    if(remaining>1e-8)throw Error('新家庭糧食轉移不守恆');
    return true;
  }
  function formNewHouseholds(s){
    const F=s.agriculture?.familyExpansion;
    if(!F?.enabled||!s.settlements.length)return;
    let formed=0;
    const women=living(s).filter(p=>p.stage==='adult'&&p.genderRole==='gestate'&&!p.partnerId);
    for(const a of women){
      if(formed>=F.maxCouplesPerMonth)break;
      const others=living(s).filter(b=>b.genderRole==='fertilize'&&compatiblePartners(s,a,b,F))
        .sort((x,y)=>dist(householdOf(s,a),householdOf(s,x))-dist(householdOf(s,a),householdOf(s,y))||x.id.localeCompare(y.id));
      if(!others.length||rand(s)>F.pairChancePerMonth)continue;
      const partner=others[0],ah=householdOf(s,a),bh=householdOf(s,partner),site=familyHomeSite(s,ah,F);
      if(!site)continue;
      const food=F.startupFoodDays*2*s.rules.foodNeedAdult;
      if(!transferStartupFood(s,ah,bh,food,F))continue;
      const number=s.households.reduce((n,h)=>Math.max(n,Number(h.id.slice(1))||0),0)+1;
      const h={id:'h'+number,name:a.name+'與'+partner.name+'家',x:site.x,y:site.y,members:[a.id,partner.id],
        inventory:{food,wood:0,stone:0,fiber:0},home:false,buildProgress:0,buildMaterialsPaid:false,
        needs:{},migrated:0,foodShortageDays:0};
      ah.members=ah.members.filter(id=>id!==a.id);bh.members=bh.members.filter(id=>id!==partner.id);
      s.households.push(h);a.partnerId=partner.id;partner.partnerId=a.id;
      const sourceTown=accessibleSettlement(s,ah);
      const town=sourceTown&&dist(sourceTown,h)<=s.rules.settlementClusterDistance?sourceTown:
        s.settlements.filter(t=>dist(t,h)<=s.rules.settlementClusterDistance)
        .sort((x,y)=>dist(x,h)-dist(y,h)||x.id.localeCompare(y.id))[0]||null;
      if(town)town.householdIds.push(h.id);
      for(const p of [a,partner]){
        p.householdId=h.id;p.settlementId=town?.id||null;p.x=site.x;p.y=site.y;
        if(p.occupation==='dependent')p.occupation=p.proficiency.food>=p.proficiency.gather?'food_producer':'gatherer';
      }
      formed++;s.counts.newFamilies=(s.counts.newFamilies||0)+1;
      log(s,'family',a.name+'與'+partner.name+'建立新家戶。',
        ['成年居民在附近自主配對且非近親','從舊家戶／可及公共糧倉實際轉出 '+food.toFixed(1)+' 糧食；需自行建造住所',
         town?'加入 '+town.name:'離開原聚落，向外定居']);
    }
  }
  function demographic(s) {
    const now=days(s);
    for(const p of s.people.slice()) {
      if(!p.alive) continue;
      if(now>0 && now%s.rules.daysPerYear===0) {
        p.age++;
        if(p.age>=18 && p.stage==='child'){
          p.stage='adult';
          if(s.agriculture?.familyExpansion?.enabled&&p.occupation==='dependent')
            p.occupation=p.proficiency.food>=p.proficiency.gather?'food_producer':'gatherer';
        }
        if(p.age>=66) p.stage='elder';
        if(p.age>78 && rand(s)<clamp((p.age-76)*.025,0,.65)) die(s,p.id,'自然老化');
      }
      if(p.alive && p.health<=0 && p.hunger>.9) die(s,p.id,'長期嚴重飢餓與健康惡化');
      if(p.alive && p.stage==='adult' && p.genderRole==='gestate' &&
        p.pregnancyDueHour===null && s.hour>=(p.recoveryUntilHour||0) &&
        p.age>18 && p.age<43 && p.health>=35 && p.hunger<.55) {
        const h=householdOf(s,p), partner=s.people.find(v=>v.id===p.partnerId && v.alive && v.stage==='adult');
        if(!h||!partner||!h.home||partner.health<35)continue;
        // Long-term food security includes physically accessible community stores.
        // Shared reserves contribute a proportional planning signal, not a guaranteed
        // allocation or double-counted private inventory.
        const security=foodSecurity(s,h);
        if(security.days<s.rules.conceptionMinFoodDays)continue;
        const dependentCount=householdMembers(s,h).filter(v=>v.stage==='child').length;
        const spaceFactor=clamp(1-(dependentCount-1)*.14,.4,1);
        if(rand(s)<s.rules.conceptionChancePerMonth*spaceFactor) {
          p.pregnancyDueHour=s.hour+9*monthHours(s);
          // Pregnancy is current private state; an ordinary conception is not a major history entry.
        }
      }
    }
    formNewHouseholds(s);
    // Household movement requires actual pressure AND a promising destination;
    // moving all hungry people to the same exhausted tile is not a survival strategy.
    const migrationTowns=s.agriculture?.familyExpansion?.enabled?s.settlements:s.settlements.slice(0,1);
    for(const town of migrationTowns) {
      if(!(town.workDemand.foodPressure>.9 && town.foodShortageDays>=30))continue;
      const vulnerable=s.households.find(h=>h.migrated===0 && accessibleSettlement(s,h)?.id===town.id &&
        householdMembers(s,h).length && foodSecurity(s,h).days<2);
      if(!vulnerable)continue;
      const next=relocationSite(s,vulnerable,town);
      if(!next)continue;
      const from={x:vulnerable.x,y:vulnerable.y};
      moveHousehold(s,vulnerable,next,town,true);
      log(s,'migration',`${vulnerable.name} 因持續缺糧，自主搬往新的採集區。`,
        ['舊聚落供給不足，且附近有可採集的環境資源',`原位置 ${from.x},${from.y}，新位置 ${next.x},${next.y}`]);
    }
  }
  function die(s, personId, reason) {
    const p=s.people.find(v=>v.id===personId && v.alive);
    if(!p) return {ok:false,reason:'居民不存在或已死亡'};
    p.alive=false;p.activity='dead';s.counts.deaths++;
    for(const faith of allFaiths(s))for(const o of faith.oracles) if(o.status==='active' && o.saintId===personId) {
      o.status='saint_dead';
      log(s,'oracle',`聆聽者 ${p.name} 離世，這道神諭不再傳播。`,['神諭歸屬於 Saint，不會繼承']);
    }
    for(const faith of allFaiths(s)){
      faith.saints=faith.saints.filter(id=>id!==personId);
      faith.priests=faith.priests.filter(id=>id!==personId);
    }
    log(s,'death',`${p.name} 離世。`,[reason]);
    return {ok:true};
  }
  function advanceTicks(s, ticks = 1) {
    if(!Number.isSafeInteger(ticks) || ticks<0 || ticks>50000) throw new RangeError('ticks must be integer 0..50000');
    for(let k=0;k<ticks;k++) {
      s.hour+=s.rules.tickHours;s.tick++;
      expireStatuses(s);processOracles(s);processScheduledBirths(s);updateWorld(s);updatePeople(s);
      if(s.tick%3===0) daily(s);
      if(s.hour>0 && s.hour%(s.rules.daysPerMonth*24)===0) demographic(s);
    }
    return s;
  }
  function validate(s) {
    const errors=[];
    if(s?.balanceProfileId==='agriculture-balance-v0.1'&&!s.agriculture)errors.push('Agriculture Profile 遺失');
    if(s?.agriculture)for(const t of s.tiles||[])if(t.terrain==='field'&&(!Number.isFinite(t.cropStock)||t.cropStock< -1e-8))errors.push('農田作物庫存無效');
    if(!s || s.version!==VERSION) return {ok:false,errors:['版本不相容']};
    if(!Number.isSafeInteger(s.hour)||s.hour<0 || !Number.isSafeInteger(s.tick)) errors.push('時間不正確');
    if(!Array.isArray(s.tiles)||s.tiles.length!==s.width*s.height) errors.push('地圖資料不完整');
    if(!Array.isArray(s.people)||!Array.isArray(s.households)||!Array.isArray(s.settlements)) errors.push('人口資料不完整');
    if(!s.god || !Number.isFinite(s.god.dp)||s.god.dp<0||s.god.dp>s.rules.maxDp+.001) errors.push('神力不正確');
    if(s.opponent?.enabled){
      if(!s.opponentGod||!s.opponentReligion||s.opponentReligion.id===s.religion.id||
        !Number.isFinite(s.opponentGod.dp)||s.opponentGod.dp<0||
        s.opponentGod.dp>s.opponentGod.cap+.001)errors.push('對手神力或宗教狀態不正確');
      if(!Number.isSafeInteger(s.opponentRng))errors.push('對手亂數狀態不正確');
    }
    for(const h of s.households||[]) for(const value of Object.values(h.inventory||{}))
      if(!Number.isFinite(value)||value<-.00001) errors.push(`家戶 ${h.id} 庫存無效`);
    for(const t of s.settlements||[]) {
      for(const value of Object.values(t.storage||{}))
        if(!Number.isFinite(value)||value<-.00001) errors.push(`聚落 ${t.id} 庫存無效`);
      if(t.granary) {
        if(!Number.isFinite(t.granary.progress)||t.granary.progress<0)errors.push(`聚落 ${t.id} 糧倉工期無效`);
        if(!Number.isFinite(t.granary.x)||!Number.isFinite(t.granary.y)||
          t.granary.x<0||t.granary.y<0||t.granary.x>=s.width||t.granary.y>=s.height)
          errors.push(`聚落 ${t.id} 糧倉位置無效`);
        if(t.granary.built&&!t.granary.materialsPaid)errors.push(`聚落 ${t.id} 糧倉未投入建材`);
      }
    }
    for(const p of s.people||[]) if(!s.households.some(h=>h.id===p.householdId && h.members.includes(p.id))) errors.push(`居民 ${p.id} 家戶不一致`);
    if(s.nativeWorld){
      const assigned=new Set();
      for(const town of s.settlements||[])for(const h of town.householdIds){
        if(assigned.has(h))errors.push('家戶同時隸屬不同聚落：'+h);
        assigned.add(h);
      }
    }
    const ids=new Set((s.people||[]).map(p=>p.id));
    if(ids.size!==(s.people||[]).length) errors.push('居民 ID 重複');
    return {ok:errors.length===0, errors};
  }
  function inspectHousehold(s, id) {
    const h=s.households.find(x=>x.id===id);
    if(!h)return null;
    const access=foodSecurity(s,h);
    return {id:h.id, settlementId:access.town?.id||null, privateFood:access.personal,
      forecastCommonShare:access.communal, dailyFoodNeed:access.need, foodCoverageDays:access.days,
      activeMembers:householdMembers(s,h).length, foodShortageDays:h.foodShortageDays};
  }
  // Explicit action permits a running PoC to adopt improved balance, preserving
  // physical crop stock and all people/history; no Food is created by this update.
  function applyAgricultureProfile(s,profile) {
    if(!s.agriculture)return {ok:false,reason:'Original 世界不支援原地切換農業模型'};
    if(profile?.profileId!=='agriculture-balance-v0.1')return {ok:false,reason:'無效的 Agriculture Profile'};
    s.agriculture=JSON.parse(JSON.stringify(profile));
    s.balanceProfileId=profile.profileId;
    s.environment.landCapacityEvalDay=-1;
    return {ok:true};
  }
  function restore(json) {
    const candidate=typeof json==='string'?JSON.parse(json):JSON.parse(JSON.stringify(json));
    if(candidate?.version==='mvp0-web-1') {
      // Narrow, explicit upgrade path for users who already played the first MVP.
      // Keep all real people/deaths/history; never resurrect or overwrite outcomes.
      candidate.version=VERSION;
      // Preserve custom tuning while upgrading recognizable old default meal rates.
      if(candidate.rules?.foodNeedAdult===.50) candidate.rules.foodNeedAdult=DEFAULT_RULES.foodNeedAdult;
      if(candidate.rules?.foodNeedChild===.31) candidate.rules.foodNeedChild=DEFAULT_RULES.foodNeedChild;
      candidate.rules=rulesFrom({rules:candidate.rules});
      for(const h of candidate.households||[]) {
        h.foodShortageDays=h.foodShortageDays||0;
        h.famineActive=!!h.famineActive;
      }
      for(const p of candidate.people||[]) {
        p.recoveryUntilHour=p.recoveryUntilHour||0;
        p.activityReason=p.activityReason||'舊版存檔的日常活動，下一次更新後顯示新的決策原因';
      }
      for(const t of candidate.settlements||[]) {
        t.famineDays=t.famineDays||0;
        t.famineReliefDays=0;
        t.famineActive=!!t.famineActive;
        t.lastDailyUnmetFood=0;
      }
      candidate.events=(candidate.events||[]).filter(e=>
        !['world','housing','weather','prayer'].includes(e.kind));
    }
    // Recognized old v0.1 profile default: adopt the improved Priest baseline on
    // existing saves too, without overriding independently customized numeric rates.
    const formerReligion=candidate.religionPropagation;
    if(formerReligion?.profileId===RELIGION_DEFAULTS.profileId &&
      formerReligion.priestJoinChance===.075 &&
      !Number.isFinite(formerReligion.priestRivalDoubtChance))
      formerReligion.priestJoinChance=RELIGION_DEFAULTS.priestJoinChance;
    candidate.religionPropagation=religionRules(formerReligion);
    candidate.divinePowers=divinePowerRules(candidate.divinePowers);
    candidate.attention ||= {seq:0,items:[],lastPreachingHour:-999999};
    candidate.attention.items ||= [];
    candidate.attention.seq=Number.isSafeInteger(candidate.attention.seq)?
      candidate.attention.seq:0;
    if(!Number.isFinite(candidate.attention.lastPreachingHour))
      candidate.attention.lastPreachingHour=-999999;
    if(candidate.opponent?.enabled){
      const previous=candidate.opponent;
      candidate.opponent={...opponentRules(previous),
        lastActionDay:Number.isFinite(previous.lastActionDay)?previous.lastActionDay:-1,
        turns:Number.isFinite(previous.turns)?previous.turns:0,
        casts:Number.isFinite(previous.casts)?previous.casts:0,
        oracleIssues:Number.isFinite(previous.oracleIssues)?previous.oracleIssues:0};
      candidate.opponentRng=Number.isSafeInteger(candidate.opponentRng)?
        candidate.opponentRng:hash(candidate.seed+'|opponent-v0.1');
      candidate.opponentReligion ||= {id:'r2',godId:'g2',name:candidate.opponent.name,
        saints:[],priests:[],saintQuota:{},oracles:[],prayers:[],regionalPrayerAt:{},
        lastPrayerHour:-1,reachedSettlements:{}};
      candidate.opponentReligion.saintQuota ||= {};
      candidate.opponentReligion.reachedSettlements ||= {};
      candidate.opponentReligion.oracles ||= [];
      candidate.opponentReligion.prayers ||= [];
      candidate.opponentReligion.regionalPrayerAt ||= {};
      candidate.opponentGod ||= {id:'g2',dp:0,cap:candidate.rules.maxDp,skills:{}};
      candidate.opponentGod.skills ||= {};
      for(const type of ['rain',...Object.keys(POWER_DEFAULTS)])
        candidate.opponentGod.skills[type] ||= {level:1,xp:0,readyAtHour:0};
      for(const o of candidate.opponentReligion.oracles)o.reachedSettlements ||= {};
    }
    candidate.god.skills ||= {};
    for(const type of ['rain',...Object.keys(POWER_DEFAULTS)])
      candidate.god.skills[type] ||= {level:1,xp:0,readyAtHour:0};
    for(const e of candidate.effects||[])e.type ||= 'rain';
    if(!Number.isSafeInteger(candidate.religionRng))candidate.religionRng=hash(candidate.seed+'|religion-v0.1');
    candidate.religion.reachedSettlements ||= {};
    candidate.religion.regionalPrayerAt ||= {};
    candidate.metrics ||= {workChoices:0,oracleInfluencedChoices:0};
    candidate.metrics.foodProductionByTown ||= {};
    candidate.counts.newBelievers ||= 0;
    candidate.counts.householdAdoptions ||= 0;
    candidate.counts.socialAdoptions ||= 0;
    candidate.counts.interSettlementAdoptions ||= 0;
    candidate.counts.priestAdoptions ||= 0;
    candidate.counts.rivalConversions ||= 0;
    candidate.counts.rivalDoubts ||= 0;
    for(const o of candidate.religion.oracles||[])o.reachedSettlements ||= {};
    for(const town of candidate.settlements||[])ensureGranary(candidate,town);
    // Legacy v2 saves carried the former 130-event default. Expand it without
    // discarding their existing event IDs, history or world state. Other tuned
    // event limits are intentionally left alone.
    if(candidate.rules?.eventLimit===130)candidate.rules.eventLimit=DEFAULT_RULES.eventLimit;
    const verdict=validate(candidate);
    if(!verdict.ok) throw new Error('無法讀取世界：'+verdict.errors.join('；'));
    return candidate;
  }
  return {VERSION,DEFAULT_RULES,POWER_DEFAULTS,create,advanceTicks,stats,faithfulWeight,presenceAt,evalRain,castRain,
    evaluateMiracle,castMiracle,activeStatus,
    issueOracle,concludeOracle,checkOracle,die,validate,restore,days,inspectHousehold,applyAgricultureProfile,
    settlementReligionStats,priestPetitions,prayerLocation,OPPONENT_DEFAULTS};
});
