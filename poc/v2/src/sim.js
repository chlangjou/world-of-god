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

  // Religion Propagation v0.1: tunable, seed-stable social pulses (separate from economic RNG).
  const RELIGION_DEFAULTS=Object.freeze({
    profileId:'religion-propagation-v0.1',pulseDays:7,minimumChildAge:4,
    contactRadius:11,interSettlementReach:30,
    householdJoinChance:.13,socialJoinChance:.055,priestJoinChance:.075,
    settlementVisitChance:.012,weakLearningChance:.26,ordinaryConsolidationCap:60,
    childStrongLearningChance:.32,childOrdinaryLearningChance:.14,
    regionalSaintChancePerMonth:.12,oracleRelayChance:.55
  });
  function religionRules(profile){
    const r={...RELIGION_DEFAULTS};
    if(profile?.profileId===r.profileId)for(const [k,v] of Object.entries(r))
      if(typeof v==='number'&&Number.isFinite(profile[k]))r[k]=profile[k];
    r.pulseDays=Math.round(clamp(r.pulseDays,1,90));
    r.minimumChildAge=Math.round(clamp(r.minimumChildAge,0,17));
    r.contactRadius=clamp(r.contactRadius,1,25);
    r.interSettlementReach=clamp(r.interSettlementReach,0,64);
    for(const k of Object.keys(r))if(k.endsWith('Chance')||k.endsWith('ChancePerMonth'))r[k]=clamp(r[k],0,1);
    r.ordinaryConsolidationCap=Math.round(clamp(r.ordinaryConsolidationCap,40,79));
    r.weakLearningChance=clamp(r.weakLearningChance,0,1);
    r.childStrongLearningChance=clamp(r.childStrongLearningChance,0,1);
    r.childOrdinaryLearningChance=clamp(r.childOrdinaryLearningChance,0,1);
    return r;
  }
  function religionRand(s){
    let x=s.religionRng>>>0;
    x^=x<<13;x^=x>>>17;x^=x<<5;
    s.religionRng=x>>>0;
    return s.religionRng/4294967296;
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
  function create(config = {}) {
    const rules = rulesFrom(config);
    const agriculture = config.balanceProfile?.profileId === 'agriculture-balance-v0.1'
      ? JSON.parse(JSON.stringify(config.balanceProfile)) : null;
    const seed = String(config.seed || 'valley-spring-01').slice(0, 100);
    const religionPropagation=religionRules(config.religionProfile);
    const initialMoisture = clamp(num(config.moisture, .52), .2, .9);
    const s = { version: VERSION, seed, rules, rng: hash(seed), religionRng:hash(seed+'|religion-v0.1'), hour: 0, tick: 0,
      width: rules.width, height: rules.height, tiles: [], people: [], households: [], settlements: [],
      camp: null, religionPropagation, religion: { id: 'r1', godId: 'g1', name: '初光信仰', saints: [], priests: [],
        oracles: [], prayers: [], lastPrayerHour: -1, reachedSettlements:{} },
      god: { id: 'g1', dp: rules.initialDp, cap: rules.maxDp,
        skills: { rain: { level: 1, xp: 0, readyAtHour: 0 } } },
      effects: [], nextId: 1, eventSeq: 0, events: [],
      counts: { births: 0, deaths: 0, relocations: 0, rainCasts: 0, foodFromLabor: 0,
        newBelievers:0, householdAdoptions:0, socialAdoptions:0, interSettlementAdoptions:0 },
      environment: { phase: 'mild', totalRain: 0 }, lastFoodOutput: 0,
      balanceProfileId: agriculture?.profileId || 'original', agriculture,
      history: { settlementFoundedHour: null, firstSaintHour: null },
      metrics: { workChoices: 0, oracleInfluencedChoices: 0 } };
    generate(s, initialMoisture);
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
    const devWeight = religious.reduce((sum, p) => sum + faithfulWeight(p.devotion), 0);
    const foodPrivate = s.households.reduce((sum, h) => sum + h.inventory.food, 0);
    const common = s.settlements.reduce((sum, t) => sum + t.storage.food, 0);
    const fields = s.tiles.filter(t => t.terrain === 'field' && dist(t, s.camp) < 14);
    const wet = fields.reduce((sum, t) => sum + t.moisture, 0) / Math.max(1, fields.length);
    const crop = fields.reduce((sum, t) => sum + t.crop, 0) / Math.max(1, fields.length);
    const activeOracle = s.religion.oracles.find(o => o.status === 'active');
    return { day: days(s) + 1, people: pop.length, households: s.households.length, houses: s.households.filter(h => h.home).length,
      settlements: s.settlements.length, followers: followers.length, believers: believers.length,
      newBelievers:s.counts.newBelievers||0, saints:s.religion.saints.length,priests:s.religion.priests.length,
      avgDevotion: religious.reduce((z,p)=>z+p.devotion,0)/Math.max(1,religious.length),
      devotionWeight: devWeight, dpRateDay: s.rules.naturalDpPerDay + devWeight * s.rules.devotionDpPerWeightDay,
      food: foodPrivate + common, commonFood: common, privateFood: foodPrivate, avgMoisture: wet, avgCrop: crop,
      farmFields:s.tiles.reduce((n,t)=>n+(t.terrain==='field'),0), newFields:s.counts.newFields||0,
      newFamilies:s.counts.newFamilies||0, newSettlements:s.counts.newSettlements||0,
      saintId: s.religion.saints[0] || null, activeOracle: activeOracle || null,
      rainReady: s.hour >= s.god.skills.rain.readyAtHour, rainReadyHour: s.god.skills.rain.readyAtHour,
      phase: s.environment.phase, births: s.counts.births, deaths: s.counts.deaths,
      rainActive: s.effects.length, householdsUnhoused: s.households.filter(h => !h.home).length,
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
  function presenceAt(s, center) {
    // Derived weighted spatial contribution; MVP supports a single actual religion.
    let weighted = 0;
    for (const p of s.people) if (p.alive && p.religionId === s.religion.id) {
      const d = dist(p, center);
      if (d < 13) weighted += faithfulWeight(p.devotion) * (1 - d/13);
    }
    return { density: weighted / (Math.PI * 13 * 13), share: weighted > 0 ? 1 : 0, weighted };
  }
  function evalRain(s, input = {}) {
    const x = num(input.x, NaN), y = num(input.y, NaN);
    const radius = num(input.radius, s.rules.defaultRainRadius);
    const intensity = num(input.intensity, s.rules.defaultRainIntensity);
    const durationDays = num(input.durationDays, s.rules.defaultRainDays);
    const cost = Math.ceil((7 + .09 * radius * radius + 6 * intensity + .4 * durationDays) / (1 + (s.god.skills.rain.level - 1) * .14));
    const workload = radius * radius * intensity * durationDays;
    const cooldownDays = s.rules.rainBaseCooldownDays * Math.max(.5, Math.min(1, workload / (7*7*.85*10))) / (1 + (s.god.skills.rain.level - 1) * .12);
    let reason = null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= s.width || y >= s.height) reason = '降雨中心不在地圖內';
    else if (!(radius >= 2 && radius <= s.rules.rainRadiusMax)) reason = '範圍不在可施展界線內';
    else if (!(intensity > 0 && intensity <= s.rules.rainSupportMaxIntensity)) reason = '目前僅開放一般支援型降雨強度';
    else if (!(durationDays >= 1 && durationDays <= s.rules.rainMaxDays)) reason = '單次降雨不可超過一個模擬月';
    else if (s.hour < s.god.skills.rain.readyAtHour) reason = '喚雨仍在冷卻';
    else if (s.god.dp + 1e-8 < cost) reason = '神力不足';
    return { ok: !reason, reason, cost, cooldownDays, radius, intensity, durationDays,
      center: { x, y }, presence: Number.isFinite(x) ? presenceAt(s, { x, y }) : null };
  }
  function castRain(s, input) {
    const test = evalRain(s, input);
    if (!test.ok) return test;
    s.god.dp = Math.max(0, s.god.dp - test.cost);
    const effect = { id: 'rain-' + s.nextId++, x: test.center.x, y: test.center.y,
      radius: test.radius, intensity: test.intensity, startsAtHour: s.hour,
      endsAtHour: s.hour + test.durationDays * 24 };
    s.effects.push(effect);
    s.god.skills.rain.readyAtHour = s.hour + Math.round(test.cooldownDays * 24/8)*8;
    s.god.skills.rain.xp += Math.max(1, Math.round(test.radius * test.intensity * test.durationDays / 8));
    const skill = s.god.skills.rain;
    while (skill.level < 5 && skill.xp >= skill.level * skill.level * 30) skill.level++;
    s.counts.rainCasts++;
    log(s, 'miracle', `你向河谷施展降雨，雨雲將停留約 ${test.durationDays} 日。`,
      [`直接效果：選定範圍增加降雨；不保證豐收`, `神力 -${test.cost}，喚雨冷卻 ${Math.round(test.cooldownDays)} 日`]);
    return { ...test, effectId: effect.id };
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
      followers:believers.filter(p=>p.devotion>=40).length,
      priests:s.religion.priests.filter(id=>memberIds.has(id)).length,
      saints:s.religion.saints.filter(id=>memberIds.has(id)).length,
      activeOracles:s.religion.oracles.filter(o=>o.status==='active'&&o.propagatedAtHour!==null&&
        (o.reachedSettlements?.[townId]||people.some(p=>oracleContact(s,p,o)>0))).length};
  }
  function appointSaint(s,p){
    const first=s.religion.saints.length===0;
    s.religion.saints.push(p.id);
    s.religion.saintQuota ||= {};
    s.religion.saintQuota[p.id]={quota:s.rules.oracleQuota,nextRefillHour:s.hour+s.rules.oracleRefillDays*24};
    if(s.history.firstSaintHour===null)s.history.firstSaintHour=s.hour;
    log(s,'religion',`${p.name} 在信仰生活中成為${first?'第一位':'另一位'}聆聽者。`,
      ['自主形成的 Saint 資格不等於 Priest 職位，也不是神直接指定']);
  }
  function ensureSaint(s){
    if(days(s)<2)return;
    const candidates=living(s).filter(p=>p.religionId===s.religion.id&&p.devotion>=40&&p.stage==='adult');
    const rank=(a,b)=>(b.devotion*.5+b.receptivity*45)-(a.devotion*.5+a.receptivity*45)||a.id.localeCompare(b.id);
    if(!s.religion.saints.length){if(candidates.length)appointSaint(s,candidates.sort(rank)[0]);return;}
    // More settlements create opportunities, not one Saint per settlement or per follower count.
    const limit=1+Math.floor(Math.sqrt(Math.max(0,s.settlements.length-1)));
    if(s.religion.saints.length>=limit||days(s)%s.rules.daysPerMonth!==0)return;
    for(const town of s.settlements){
      if(s.religion.saints.some(id=>candidates.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id)))continue;
      const locals=candidates.filter(p=>personSettlement(s,p)?.id===town.id);
      if(locals.length<2||!s.religion.priests.some(id=>locals.some(p=>p.id===id)))continue;
      const eligible=locals.filter(p=>p.receptivity>=.65&&!s.religion.saints.includes(p.id)).sort(rank);
      if(eligible.length&&religionRand(s)<s.religionPropagation.regionalSaintChancePerMonth){
        appointSaint(s,eligible[0]);break;
      }
    }
  }
  function ensurePriest(s){
    if(days(s)<10)return;
    const people=living(s);
    for(const town of s.settlements){
      if(s.religion.priests.some(id=>people.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id)))continue;
      const local=people.filter(p=>personSettlement(s,p)?.id===town.id&&
        p.religionId===s.religion.id&&p.devotion>=20);
      if(local.length<3)continue;
      const eligible=local.filter(p=>p.stage==='adult'&&p.devotion>=25&&
        s.households.find(h=>h.id===p.householdId)?.home);
      if(!eligible.length)continue;
      const nonSaints=eligible.filter(p=>!s.religion.saints.includes(p.id));
      const candidate=(nonSaints.length?nonSaints:eligible).sort((a,b)=>
        (b.receptivity*2+b.proficiency.gather+b.devotion/100)-
        (a.receptivity*2+a.proficiency.gather+a.devotion/100)||a.id.localeCompare(b.id))[0];
      if(s.religion.priests.includes(candidate.id))continue;
      s.religion.priests.push(candidate.id);
      log(s,'religion',`${candidate.name} 在${town.name}得到支持，兼任祭司與傳道者。`,
        ['當地信眾需求、個人適任性及實際居所促成宗教角色']);
    }
  }
  function checkOracle(s, saintId, intentType) {
    if (intentType !== 'food.produce') return { ok: false, reason: '此試玩版僅實作糧食生產神諭' };
    const saint = s.people.find(p => p.id === saintId && p.alive);
    if (!saint || !s.religion.saints.includes(saintId)) return { ok: false, reason: '接收者必須是本宗教仍在世的 Saint' };
    const record = s.religion.saintQuota && s.religion.saintQuota[saintId];
    if (!record || record.quota < 1) return { ok: false, reason: 'Saint 的神諭接收額度不足' };
    if (s.religion.oracles.some(o => o.saintId === saintId && o.intentType === intentType && o.status === 'active'))
      return { ok: false, reason: '這位 Saint 已經持有相同類型的有效神諭' };
    return { ok: true, saint };
  }
  function issueOracle(s, input = {}) {
    const saintId = input.saintId || s.religion.saints[0];
    const test = checkOracle(s, saintId, input.intentType || 'food.produce');
    if (!test.ok) return test;
    const durationDays = clamp(num(input.durationDays, s.rules.oracleDurationDays), 1, 720);
    s.religion.saintQuota[saintId].quota--;
    const o = { id: 'o' + s.nextId++, godId: s.god.id, saintId,
      intentType: 'food.produce', audience: 'local-community', issuedAtHour: s.hour,
      expiresAtHour: s.hour + durationDays * 24, status: 'active', propagatedAtHour: null,
      reachRadius: s.rules.oracleCommunicationRadius, influenceWorkCount: 0, heardCount: 0,
      reachedSettlements:{}, fulfillmentCredited: false, progressFoodAtStart: stats(s).food };
    s.religion.oracles.push(o);
    log(s, 'oracle', `神諭交給 ${test.saint.name}：請讓族人重視糧食生產。`,
      ['Saint 接收並理解核心意圖；居民是否採取行動由其需求與能力決定']);
    return { ok: true, oracleId: o.id, saintId, quotaLeft: s.religion.saintQuota[saintId].quota };
  }
  function concludeOracle(s, oracleId) {
    const o = s.religion.oracles.find(v => v.id === oracleId && v.status === 'active');
    if (!o) return { ok: false, reason: '沒有可宣告完成的神諭' };
    const q = s.religion.saintQuota[o.saintId];
    if (!q || q.quota <= -1) return { ok: false, reason: 'Saint 的額度已達 -1 下限' };
    q.quota--; o.status = 'concluded';
    log(s, 'oracle', '神宣告這道神諭的使命已經結束。', ['結束此 Saint 的單一指派；既有生活成果仍保留']);
    return { ok: true, quotaLeft: q.quota };
  }

  // A sermon is a real non-work leisure activity; contacts are evaluated on weekly pulses.
  function recentPreacher(s,p){
    return p.alive&&p.religionId===s.religion.id&&p.devotion>=20&&
      p.stage==='adult'&&Number.isFinite(p.lastPreachHour)&&
      s.hour-p.lastPreachHour<=s.religionPropagation.pulseDays*24;
  }
  function socialReligionPulse(s){
    const r=s.religionPropagation,id=s.religion.id,people=living(s);
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
      if(!recentPreacher(s,p))continue;
      const k=cell(Math.floor(p.x/scale),Math.floor(p.y/scale));
      if(!preachers.has(k))preachers.set(k,[]);
      preachers.get(k).push(p);
    }
    const byId=new Map(people.map(p=>[p.id,p]));
    const priestSources=s.religion.priests.map(id=>byId.get(id)).filter(p=>p&&recentPreacher(s,p));
    const remoteSources=new Map();
    for(const town of s.settlements){
      const sources=(towns.get(town.id)||[]).filter(p=>recentPreacher(s,p));
      if(sources.length)remoteSources.set(town.id,sources);
    }
    const adopt=(p,cause)=>{
      p.religionId=id;p.devotion=20+Math.floor(clamp(p.receptivity,0,1)*4);
      s.counts.newBelievers=(s.counts.newBelievers||0)+1;
      const field=cause==='family'?'householdAdoptions':cause==='exchange'?'interSettlementAdoptions':'socialAdoptions';
      s.counts[field]=(s.counts[field]||0)+1;
    };
    for(const p of people){
      if(p.religionId!==null&&p.religionId!==id)continue; // no rival conversions in v0.1
      if(p.stage==='child'&&p.age<r.minimumChildAge)continue;
      const house=homes.get(p.householdId)||[];
      const guardians=p.stage==='child'?(p.parentIds?.length
        ? p.parentIds.map(id=>byId.get(id)).filter(q=>q&&q.householdId===p.householdId)
        : house.filter(q=>q.id!==p.id&&q.stage!=='child')):[];
      const family=house.some(q=>q.id!==p.id&&q.religionId===id&&q.devotion>=20);
      // Formative child teaching is distinct from short sermons: sustained lived examples
      // may reach modest committed faith, but never yield Devout/Zealot bands by heredity.
      if(p.stage==='child'&&guardians.length){
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
            if(religionRand(s)<clamp((.22+.15*committed+.08*devout)*(.6+.6*p.receptivity),0,.95))
              adopt(p,'family');
          }else if(p.religionId===id&&p.devotion<cap&&
            religionRand(s)<chance*(.65+.7*p.receptivity)){
            p.devotion=Math.min(cap,p.devotion+1);
          }
          continue;
        }
      }
      if(p.religionId===id&&p.devotion>=r.ordinaryConsolidationCap)continue;
      const bx=Math.floor(p.x/scale),by=Math.floor(p.y/scale);
      let social=false;
      for(let dx=-1;dx<=1&&!social;dx++)for(let dy=-1;dy<=1&&!social;dy++)
        social=(preachers.get(cell(bx+dx,by+dy))||[]).some(q=>q.id!==p.id&&dist(q,p)<=r.contactRadius);
      const priest=priestSources.some(q=>dist(q,p)<=r.contactRadius);
      const town=personSettlement(s,p);
      let exchange=false;
      if(town)for(const other of s.settlements){
        if(other.id!==town.id&&remoteSources.has(other.id)&&
          dist(town,other)<=r.interSettlementReach){exchange=true;break;}
      }
      if(!family&&!social&&!priest&&!exchange)continue;
      const sensitivity=.6+.8*p.receptivity;
      if(p.religionId===id){
        // Repeated credible teaching can cross 40; routine consolidation slows above 40.
        // Exceptional Devout/Zealot bands still depend on stronger, attributable evidence.
        const committedSlowdown=p.devotion>=40?.55:1;
        if(religionRand(s)<r.weakLearningChance*sensitivity*(family||priest?1:.6)*committedSlowdown)
          p.devotion=Math.min(r.ordinaryConsolidationCap,p.devotion+1);
      }else{
        const chance=clamp(( (family?r.householdJoinChance:0)+
          (social?r.socialJoinChance:0)+(priest?r.priestJoinChance:0)+
          (exchange?r.settlementVisitChance:0))*sensitivity,0,.65);
        if(religionRand(s)<chance)adopt(p,family?'family':social||priest?'social':'exchange');
      }
    }
    // Settlement attribution is derived from real residents (migration included), not a border buff.
    const reached=s.religion.reachedSettlements ||= {};
    for(const town of s.settlements){
      if(reached[town.id]!==undefined)continue;
      if((towns.get(town.id)||[]).some(p=>p.religionId===id&&p.devotion>=20)){
        reached[town.id]=s.hour;
        if(town.id!==s.settlements[0]?.id)
          log(s,'religion',`${s.religion.name} 隨實際信眾傳入${town.name}。`,
            ['已歸屬該聚落的居民具有宗教信仰；可能來自家庭、遷移、交流或傳道']);
      }
    }
  }
  function oracleContact(s,p,o){
    if(!p.alive||p.religionId!==s.religion.id||p.devotion<20||
      o.status!=='active'||o.propagatedAtHour===null)return 0;
    const saint=s.people.find(q=>q.id===o.saintId&&q.alive);
    if(!saint)return 0;
    if(dist(saint,p)<=o.reachRadius)return 1;
    const town=personSettlement(s,p);
    return town&&o.reachedSettlements?.[town.id] ? .8 : 0;
  }
  function relayOracles(s){
    const r=s.religionPropagation,people=living(s);
    for(const o of s.religion.oracles){
      if(o.status!=='active'||o.propagatedAtHour===null)continue;
      o.reachedSettlements ||= {};
      const saint=people.find(p=>p.id===o.saintId);
      if(!saint)continue;
      const origin=personSettlement(s,saint);
      if(origin&&!o.reachedSettlements[origin.id])
        o.reachedSettlements[origin.id]={hour:s.hour,via:'saint'};
      for(const town of s.settlements){
        if(o.reachedSettlements[town.id])continue;
        if(!people.some(p=>p.religionId===s.religion.id&&p.devotion>=20&&
          personSettlement(s,p)?.id===town.id))continue;
        const connected=Object.keys(o.reachedSettlements).some(sourceId=>{
          const source=s.settlements.find(t=>t.id===sourceId);
          return source&&dist(source,town)<=r.interSettlementReach;
        });
        if(!connected)continue;
        const priest=s.religion.priests.some(id=>people.some(p=>p.id===id&&personSettlement(s,p)?.id===town.id));
        if(religionRand(s)>r.oracleRelayChance*(priest?1:.25))continue;
        o.reachedSettlements[town.id]={hour:s.hour,via:priest?'priest':'social'};
        log(s,'oracle',`${town.name} 經由${priest?'祭司':'居民交流'}聽見神諭。`,
          ['訊息沿已建立信仰聯繫的相鄰聚落傳遞，並未直接廣播所有居民']);
      }
      o.heardCount=people.filter(p=>oracleContact(s,p,o)>0).length;
    }
  }
  function nearestResource(s, home, kind) {
    let best = null, strength = -Infinity;
    for (let y = Math.max(0, home.y - 7); y <= Math.min(s.height - 1, home.y + 7); y++)
      for (let x = Math.max(0, home.x - 7); x <= Math.min(s.width - 1, home.x + 7); x++) {
        const t = tile(s, x, y);
        if (t.terrain === 'river') continue;
        const quantity = kind === 'food' ? t.forage : t[kind];
        const score = quantity - .13 * Math.hypot(x - home.x, y - home.y);
        if (score > strength) { strength = score; best = t; }
      }
    return best && (kind === 'food' ? best.forage : best[kind]) > .2 ? best : null;
  }
  function nearestField(s, home) {
    let best = null, strength = -Infinity;
    const reach=s.agriculture?.land?.workReachCells ?? 9;
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
    if (p.religionId !== s.religion.id || p.devotion < 20) return strongest;
    for (const o of s.religion.oracles) {
      if (o.status !== 'active' || o.propagatedAtHour === null) continue;
      const saint = s.people.find(v => v.id === o.saintId && v.alive);
      const transmission=oracleContact(s,p,o);
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
    if (kind === 'food') { s.counts.foodFromLabor += amount; s.lastFoodOutput += amount; }
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
    const reach=L.workReachCells;
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
    const reach=A.land.workReachCells??9;
    const plots=s.tiles.filter(t=>t.terrain==='field'&&Math.abs(t.x-h.x)<=reach&&Math.abs(t.y-h.y)<=reach);
    if(!plots.length)return 0;
    let fertility=0,weighted=0;
    for(const t of plots){fertility+=t.fertility;weighted+=t.fertility*Math.pow(t.moisture/L.referenceMoisture,W.environmentMoistureExponent);}
    const skill=p.proficiency.food;
    let capacity=W.foodUnitsPerFullWorkdayAt50PctSkillAndNeutralEnvironment*
      (W.skillOutputIntercept+W.skillOutputSlope*skill)*weighted/Math.max(fertility,1e-9);
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
    const security = foodSecurity(s, h);
    const basic = security.town ? security.town.workDemand : null;
    const scarce = security.days < 4 || p.hunger > .35 || (basic && basic.foodPressure > .65);
    const field = nearestField(s, h);
    // Pioneers without existing fields can choose cultivation as a real food
    // activity. The work shift opens meadow; harvested Food still starts at zero.
    const L=s.agriculture?.land;
    let canCultivate=false;
    if(L?.autonomousExpansionEnabled&&!field){
      const reach=L.workReachCells;
      for(let y=Math.max(0,h.y-reach);y<=Math.min(s.height-1,h.y+reach)&&!canCultivate;y++)
        for(let x=Math.max(0,h.x-reach);x<=Math.min(s.width-1,h.x+reach);x++){
          const t=tile(s,x,y);
          if(t.terrain==='meadow'&&t.fertility>=L.minimumCultivationFertility){canCultivate=true;break;}
        }
    }
    const wood = nearestResource(s, h, 'wood');
    const fiber = nearestResource(s, h, 'fiber');
    const forage = nearestResource(s, h, 'food');
    const stone = nearestResource(s, h, 'stone');
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
    candidates.push({ name: 'care', score: 3.5 + (security.days >= (s.agriculture?.workDemand?.reserveComfortDays ?? 11) ? (h.home ? (s.agriculture?.workDemand?.comfortableCareBonus ?? 5.0) : 5.0) : security.days >= (s.agriculture?.workDemand?.reserveRelaxDays ?? 7) ? 2.7 : 0) +
      (householdMembers(s,h).some(v=>v.stage==='child') ? .7 : 0), valid: true });
    if (!candidates.length) { p.activity = 'rest'; p.activityReason = '附近缺少可用資源，這次無法工作';
      p.lastDecision = { work: 'rest', hour: s.hour, reason: p.activityReason, foodDays: security.days, oracleInfluence: 0 }; return; }
    // Reasoned autonomous utility; no Oracle writes occupation, action or inventory directly.
    const specialization = n => (p.occupation === 'food_producer' && (n === 'farm' || n === 'forage') ? 1.35 : 0) +
      (p.occupation === 'gatherer' && (n === 'wood' || n === 'fiber' || n === 'stone') ? 1.1 : 0);
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
      const amount = Math.min(forage.forage, .6 + p.proficiency.gather * .45);
      forage.forage -= amount; distribute(s, h, 'food', amount);
    } else if (choice.name === 'farm' && (field||canCultivate)) {
      if (s.agriculture) agricultureHarvest(s,p,h);
      else if (field.crop >= .47) {
        const amount = (1.5 + p.proficiency.food * .8) * field.crop * field.fertility * s.rules.farmYieldMultiplier;
        field.crop = Math.max(.04, field.crop - .52);
        distribute(s, h, 'food', amount);
      } else field.crop = clamp(field.crop + .035 + .04 * p.proficiency.food, 0, 1);
    } else if (choice.name === 'wood' && wood) {
      const amt = Math.min(wood.wood, 1.7 + p.proficiency.gather * .8);
      wood.wood -= amt; distribute(s, h, 'wood', amt);
    } else if (choice.name === 'stone' && stone) {
      const amt = Math.min(stone.stone, 1.2 + p.proficiency.gather * .6);
      stone.stone -= amt; distribute(s, h, 'stone', amt);
    } else if (choice.name === 'fiber' && fiber) {
      const amt = Math.min(fiber.fiber, 1.4 + p.proficiency.gather * .7);
      fiber.fiber -= amt; distribute(s, h, 'fiber', amt);
    } else if(choice.name==='build_granary'&&town&&granary&&!granary.built) {
      if(!granary.materialsPaid) {
        if(town.storage.wood+1e-9<G.woodRequired||town.storage.stone+1e-9<G.stoneRequired)
          throw Error('糧倉建造前的公共建材不足');
        town.storage.wood=Math.max(0,town.storage.wood-G.woodRequired);
        town.storage.stone=Math.max(0,town.storage.stone-G.stoneRequired);
        granary.materialsPaid=true;
      }
      granary.progress+=1+p.proficiency.build*.55;
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
      h.buildProgress += 1 + p.proficiency.build * .55;
      if (h.buildProgress >= s.rules.hutWork) {
        h.home = true;
      }
    }
    p.x = h.x + (choice.name === 'farm' && field ? clamp(field.x - h.x,-2,2) * .28 : 0);
    p.y = h.y + (choice.name === 'farm' && field ? clamp(field.y - h.y,-2,2) * .28 : 0);
  }
  function updatePeople(s) {
    const phase = s.tick % 3;
    for (const p of s.people) {
      if (!p.alive) continue;
      if (phase === 0) { p.activity = 'rest'; p.activityReason = '每日固定的休息與恢復時段'; }
      else if (phase === 2) {
        const priest=s.religion.priests.includes(p.id);
        const believer=p.religionId===s.religion.id&&p.devotion>=20;
        const pray=believer&&(days(s)+hash(p.id))%5===0;
        const preach=believer&&p.stage==='adult'&&!pray&&
          (days(s)+hash(p.id))%(priest?3:7)===0;
        p.activity=p.stage==='child'?'family':pray?'pray':preach?'preach':'family';
        if(preach)p.lastPreachHour=s.hour;
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
      let boost = 0;
      for (const e of s.effects) {
        if (s.hour < e.endsAtHour && Math.hypot(t.x - e.x, t.y - e.y) <= e.radius) boost += .028 * e.intensity;
      }
      effectSummary += boost;
      if(A) {
        const R=A.river,C=A.seasons[season],L=A.land;
        const d=Math.max(0,Math.abs(t.x-riverX(s,t.y))-R.riverHalfWidthCells);
        const influence=d<=R.fullEffectThroughCells?R.nearBankInfluence:
          d>=R.zeroEffectAtCells?0:R.nearBankInfluence*(R.zeroEffectAtCells-d)/(R.zeroEffectAtCells-R.fullEffectThroughCells);
        const target=clamp(C.backgroundMoisture+(1-C.backgroundMoisture)*influence*C.riverWaterAvailability);
        const tau=A.soilDynamics.referenceResponseTimeDays;
        t.moisture=clamp(t.moisture+(target-t.moisture)*(1-Math.exp(-s.rules.tickHours/24/tau))+boost,0,1);
        if(t.terrain==='field'){
          const daily=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
            Math.pow(t.moisture/L.referenceMoisture,L.moistureExponent);
          const cap=L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture*t.fertility*
            Math.pow(1/L.referenceMoisture,L.moistureExponent)*L.cropStockCapacityDays;
          t.cropStock=Math.min(cap,Math.max(0,t.cropStock)+daily*s.rules.tickHours/24);
          t.crop=cap>0?clamp(t.cropStock/cap):0;
        }
      } else {
      t.moisture = clamp(t.moisture - (drought ? .014 : .007) + naturalRain + nearRiver*.003 + boost, .03, .98);
      if (t.terrain === 'field') {
        const growth = t.moisture > .23 ? (.006 + .029 * t.moisture) * t.fertility : -.006;
        t.crop = clamp(t.crop + growth, .02, 1);
      }
      }
      t.forage = clamp(t.forage + .004 * t.moisture * t.fertility, 0, 1.3);
      if (t.terrain === 'forest') t.wood = Math.min(16, t.wood + .005 * t.moisture);
      if (t.terrain === 'meadow') t.fiber = Math.min(8, t.fiber + .012 * t.moisture);
    }
    s.environment.totalRain += effectSummary;
    const expired = s.effects.filter(e => s.hour >= e.endsAtHour);
    if (expired.length) {
      s.effects = s.effects.filter(e => s.hour < e.endsAtHour);
      for (const e of expired) log(s, 'miracle', '神蹟的降雨已結束；土地保留實際濕潤或乾燥狀態。', ['停止持續雨水輸入，沒有回溯物理後果']);
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
      const group=free.filter(h=>Math.hypot(h.x-anchor.x,h.y-anchor.y)<=F.outpostClusterRadius);
      const finished=group.filter(h=>h.home);
      if(group.length<F.outpostMinHouseholds||finished.length<F.outpostMinHuts)continue;
      const center={x:Math.round(finished.reduce((n,h)=>n+h.x,0)/finished.length),
                    y:Math.round(finished.reduce((n,h)=>n+h.y,0)/finished.length)};
      if(s.settlements.some(t=>dist(t,center)<=s.rules.settlementClusterDistance))continue;
      const id='s'+(s.settlements.reduce((n,t)=>Math.max(n,Number(t.id.slice(1))||0),0)+1);
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
    if (!hasSettlement(s)) {
      const near = s.households.filter(h => dist(h, s.camp) <= s.rules.settlementClusterDistance);
      const huts = near.filter(h => h.home);
      if (huts.length >= s.rules.settlementMinHuts && near.length >= 4) {
        const town = { id: 's1', name: '初穗聚落', x:s.camp.x, y:s.camp.y,
          foundedAtHour:s.hour, householdIds:near.map(h=>h.id), storage:{food:0,wood:0,stone:0,fiber:0},granary:null,
          workDemand:{foodPressure:0,housingPressure:0}, foodShortageDays:0,
          famineDays:0, famineReliefDays:0, famineActive:false, lastDailyUnmetFood:0 };
        ensureGranary(s,town);
        s.settlements.push(town);
        for (const p of s.people) if (town.householdIds.includes(p.householdId)) p.settlementId = town.id;
        s.history.settlementFoundedHour = s.hour;
        log(s,'settlement',`${town.name} 由 ${huts.length} 戶已建屋的家庭形成。`,
          ['群居、土地與水源適宜；多戶實際收集建材並完成住所']);
      }
      return;
    }
    establishOutpost(s);
    for (const town of s.settlements) {
      ensureGranary(s,town);
      const activeHomes = s.households.filter(h => accessibleSettlement(s,h)?.id === town.id && householdMembers(s,h).length);
      const totalNeed = activeHomes.reduce((n,h)=>n+dailyFoodNeed(s,h),0);
      const foodStock = town.storage.food + activeHomes.reduce((z,h)=>z+h.inventory.food,0);
      const required = totalNeed * (s.agriculture?.workDemand?.reserveTargetDays ?? 8); // adjustable desired buffer; not forced rationing
      const foodPressure = totalNeed ? clamp(1 - foodStock/Math.max(1,required)) : 0;
      const housingPressure = activeHomes.filter(h=>!h.home).length / Math.max(1,activeHomes.length);
      town.workDemand = {foodPressure,housingPressure};
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
        const town=s.settlements.filter(t=>dist(t,h)<=s.rules.settlementClusterDistance)
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
          by:supporters.slice(0,12).map(p=>p.id), beforeMoisture:wet, foodAtRequest:stats(s).food,
          foodProductionAtRequest:s.counts.foodFromLabor, castSeen:false, castId:null };
        s.religion.prayers.push(prayer);
        s.religion.lastPrayerHour=s.hour;
        // Prayer is live need/petition information, not an endlessly repeated historical headline.
      }
    }
    s.religion.prayers = s.religion.prayers.filter(p=>s.hour-p.createdAtHour<=120*24).slice(-s.rules.prayerLimit);
  }
  function individualApplyFaithEvidence(s, ids, amount, cause) {
    // Individual ownership: religion reports credible evidence; only the person-state transition changes Devotion.
    let changed=0;
    for(const id of ids) {
      const p=s.people.find(v=>v.id===id && v.alive);
      if(!p||p.religionId!==s.religion.id) continue;
      const prev=p.devotion;
      p.devotion=clamp(p.devotion+amount,0,100);
      p.lastFaithEvidence={hour:s.hour,cause,change:p.devotion-prev};
      if(p.devotion>prev) changed++;
    }
    return changed;
  }
  function checkFulfillment(s) {
    const st=stats(s);
    for(const prayer of s.religion.prayers) {
      if (prayer.status!=='open') continue;
      // Attribution needs a physically relevant prior Rain cast, improved field condition,
      // actual subsequent food labor and reduced food shortage. A button press alone never qualifies.
      const rain=s.effects.find(e=>dist(e,s.camp)<=e.radius+6 && e.startsAtHour>=prayer.createdAtHour);
      if (rain) { prayer.castSeen=true; prayer.castId=rain.id; }
      const changedMoisture=st.avgMoisture-prayer.beforeMoisture > .08;
      const extraHarvest=s.counts.foodFromLabor-prayer.foodProductionAtRequest >= 8;
      const recent=s.hour-prayer.createdAtHour < 60*24;
      if (prayer.castSeen && changedMoisture && extraHarvest && recent) {
        prayer.status='answered'; prayer.answeredAtHour=s.hour;
        const changed=individualApplyFaithEvidence(s,prayer.by,12,'降雨改善作物與實際食物供應，回應祈求');
        log(s,'faith',`人們看到雨後的糧食收穫，${changed} 位祈禱者加深信仰。`,
          ['雨水提高土壤濕度','居民實際投入糧食生產','回應了仍存在的祈禱；此需求僅給一次持續性信仰回饋']);
      } else if (!recent) prayer.status='lapsed';
    }
    for(const o of s.religion.oracles) {
      if(o.status!=='active' || o.fulfillmentCredited || o.influenceWorkCount < 3) continue;
      const foodGain=st.food-o.progressFoodAtStart;
      if(foodGain > 5 && s.hour>o.issuedAtHour+24) {
        o.fulfillmentCredited=true;
        const saint=s.people.find(p=>p.id===o.saintId);
        const ids=living(s).filter(p=>oracleContact(s,p,o)>0).map(p=>p.id);
        const changed=individualApplyFaithEvidence(s,ids,6,'神諭推動真實食物勞動並改善存糧');
        log(s,'faith',`糧食神諭的成果逐漸被看見；${changed} 位居民增加信仰。`,
          ['部分居民自主提高糧食工作優先度','實際的總可用食物增加','成果與仍有效的 Saint 神諭具有可追溯關聯']);
      }
    }
  }
  function daily(s) {
    restoreSettlementAccess(s);
    consumeFood(s);
    updateSettlement(s);
    updatePrayers(s);
    checkFulfillment(s);
    const rate=stats(s).dpRateDay;
    s.god.dp=Math.min(s.god.cap,s.god.dp+rate);
    ensureSaint(s);
    ensurePriest(s);
    if(days(s)>0&&days(s)%s.religionPropagation.pulseDays===0){
      socialReligionPulse(s);
      relayOracles(s);
    }
    s.lastFoodOutput=0;
  }
  function processOracles(s) {
    for(const o of s.religion.oracles) {
      if (o.status!=='active') continue;
      const owner=s.people.find(p=>p.id===o.saintId && p.alive);
      if(!owner) {
        o.status='saint_dead';
        log(s,'oracle','聆聽者離世，屬於他的神諭停止傳播。',['不自動轉移給下一位 Saint；既有生活成果繼續存在']);
      } else if(s.hour>=o.expiresAtHour) {
        o.status='expired';
        log(s,'oracle','糧食神諭的效期自然結束。',['到期免費，已完成的生活成果不回溯']);
      } else if (o.propagatedAtHour===null && s.hour>=o.issuedAtHour+24) {
        o.propagatedAtHour=s.hour;
        const town=personSettlement(s,owner);
        if(town)(o.reachedSettlements ||= {})[town.id]={hour:s.hour,via:'saint'};
        o.heardCount=living(s).filter(p=>oracleContact(s,p,o)>0).length;
        log(s,'oracle',`${owner.name} 開始向附近居民講述糧食神諭；${o.heardCount} 人有機會聽見。`,
          ['Saint 接收內容可靠','傳播受個人距離與社群影響，不是向全地圖強制廣播']);
      }
    }
    // Independent quota refill from simulation time, including overdraft debt.
    for(const record of Object.values(s.religion.saintQuota||{})) {
      while(s.hour>=record.nextRefillHour) {
        record.quota=Math.min(s.rules.oracleQuota,record.quota+1);
        record.nextRefillHour+=s.rules.oracleRefillDays*24;
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
    for(const o of s.religion.oracles) if(o.status==='active' && o.saintId===personId) {
      o.status='saint_dead';
      log(s,'oracle',`聆聽者 ${p.name} 離世，這道神諭不再傳播。`,['神諭歸屬於 Saint，不會繼承']);
    }
    s.religion.saints=s.religion.saints.filter(id=>id!==personId);
    s.religion.priests=s.religion.priests.filter(id=>id!==personId);
    log(s,'death',`${p.name} 離世。`,[reason]);
    return {ok:true};
  }
  function advanceTicks(s, ticks = 1) {
    if(!Number.isSafeInteger(ticks) || ticks<0 || ticks>50000) throw new RangeError('ticks must be integer 0..50000');
    for(let k=0;k<ticks;k++) {
      s.hour+=s.rules.tickHours;s.tick++;
      processOracles(s);processScheduledBirths(s);updateWorld(s);updatePeople(s);
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
    candidate.religionPropagation=religionRules(candidate.religionPropagation);
    if(!Number.isSafeInteger(candidate.religionRng))candidate.religionRng=hash(candidate.seed+'|religion-v0.1');
    candidate.religion.reachedSettlements ||= {};
    candidate.counts.newBelievers ||= 0;
    candidate.counts.householdAdoptions ||= 0;
    candidate.counts.socialAdoptions ||= 0;
    candidate.counts.interSettlementAdoptions ||= 0;
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
  return {VERSION,DEFAULT_RULES,create,advanceTicks,stats,faithfulWeight,presenceAt,evalRain,castRain,
    issueOracle,concludeOracle,checkOracle,die,validate,restore,days,inspectHousehold,applyAgricultureProfile,
    settlementReligionStats};
});
