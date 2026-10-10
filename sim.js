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
    eventLimit: 130, prayerLimit: 18, daysPerYear: 360,
    conceptionChancePerMonth: 0.12, conceptionMinFoodDays: 6, postpartumRecoveryDays: 60,
    familyReturnFoodDays: 2, famineAlertDays: 21, famineReliefDays: 7, isolatedFamineDays: 45
  });
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
          proficiency: { food: .35 + rand(s) * .45, gather: .25 + rand(s) * .5, build: .18 + rand(s) * .45 },
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
    const initialMoisture = clamp(num(config.moisture, .52), .2, .9);
    const s = { version: VERSION, seed, rules, rng: hash(seed), hour: 0, tick: 0,
      width: rules.width, height: rules.height, tiles: [], people: [], households: [], settlements: [],
      camp: null, religion: { id: 'r1', godId: 'g1', name: '初光信仰', saints: [], priests: [],
        oracles: [], prayers: [], lastPrayerHour: -1 },
      god: { id: 'g1', dp: rules.initialDp, cap: rules.maxDp,
        skills: { rain: { level: 1, xp: 0, readyAtHour: 0 } } },
      effects: [], nextId: 1, eventSeq: 0, events: [],
      counts: { births: 0, deaths: 0, relocations: 0, rainCasts: 0, foodFromLabor: 0 },
      environment: { phase: 'mild', totalRain: 0 }, lastFoodOutput: 0,
      balanceProfileId: agriculture?.profileId || 'original', agriculture,
      history: { settlementFoundedHour: null, firstSaintHour: null },
      metrics: { workChoices: 0, oracleInfluencedChoices: 0 } };
    generate(s, initialMoisture);
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
    const devWeight = religious.reduce((sum, p) => sum + faithfulWeight(p.devotion), 0);
    const foodPrivate = s.households.reduce((sum, h) => sum + h.inventory.food, 0);
    const common = s.settlements.reduce((sum, t) => sum + t.storage.food, 0);
    const fields = s.tiles.filter(t => t.terrain === 'field' && dist(t, s.camp) < 14);
    const wet = fields.reduce((sum, t) => sum + t.moisture, 0) / Math.max(1, fields.length);
    const crop = fields.reduce((sum, t) => sum + t.crop, 0) / Math.max(1, fields.length);
    const activeOracle = s.religion.oracles.find(o => o.status === 'active');
    return { day: days(s) + 1, people: pop.length, households: s.households.length, houses: s.households.filter(h => h.home).length,
      settlements: s.settlements.length, followers: followers.length, avgDevotion: religious.reduce((z,p)=>z+p.devotion,0)/Math.max(1,religious.length),
      devotionWeight: devWeight, dpRateDay: s.rules.naturalDpPerDay + devWeight * s.rules.devotionDpPerWeightDay,
      food: foodPrivate + common, commonFood: common, privateFood: foodPrivate, avgMoisture: wet, avgCrop: crop,
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
  function ensureSaint(s) {
    const active = s.religion.saints.find(id => s.people.some(p => p.id === id && p.alive));
    if (active) return;
    // Autonomous qualification: devotion/receptivity and viability; no player nomination.
    const candidates = living(s).filter(p => p.religionId === s.religion.id && p.devotion >= 40 && p.stage === 'adult');
    if (!candidates.length) return;
    const chosen = candidates.slice().sort((a,b) => (b.devotion * .5 + b.receptivity * 45) - (a.devotion * .5 + a.receptivity * 45) || a.id.localeCompare(b.id))[0];
    if (days(s) < 2) return;
    s.religion.saints = [chosen.id];
    if (!s.religion.saintQuota) s.religion.saintQuota = {};
    if (!s.religion.saintQuota[chosen.id]) s.religion.saintQuota[chosen.id] = { quota: s.rules.oracleQuota, nextRefillHour: s.hour + s.rules.oracleRefillDays * 24 };
    // Saint is NOT automatically promoted to Priest: reception and preaching roles differ.
    if (s.history.firstSaintHour === null) s.history.firstSaintHour = s.hour;
    log(s, 'religion', `${chosen.name} 在祈禱與觀察中成為第一位聆聽者。`, ['Saint 由實際信徒條件與宗教需求產生；不是玩家指派']);
  }
  function ensurePriest(s) {
    // A community chooses an organizer independently from Saint reception.
    // A Saint may also serve as Priest later, but sainthood never directly grants this office.
    const active=s.religion.priests.some(id=>s.people.some(p=>p.id===id&&p.alive));
    if(active || days(s)<10 || !hasSettlement(s)) return;
    const followers=living(s).filter(p=>p.religionId===s.religion.id&&p.devotion>=40&&p.stage==='adult');
    if(followers.length<2) return;
    const eligible=followers.filter(p=>s.households.find(h=>h.id===p.householdId)?.home);
    if(!eligible.length)return;
    const candidates=eligible.filter(p=>!s.religion.saints.includes(p.id));
    const chosen=(candidates.length?candidates:eligible).slice().sort((a,b)=>
      (b.receptivity*2+b.proficiency.gather+b.devotion/100)-(a.receptivity*2+a.proficiency.gather+a.devotion/100)||a.id.localeCompare(b.id))[0];
    s.religion.priests.push(chosen.id);
    log(s,'religion',`${chosen.name} 獲社群支持，開始組織祈禱與傳揚消息。`,
      ['Priest 源於信徒需求、個人適任性與已存在的聚落支持；沒有天生神諭接收權']);
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
      fulfillmentCredited: false, progressFoodAtStart: stats(s).food };
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
    for (let y = Math.max(0, home.y - 9); y <= Math.min(s.height - 1, home.y + 9); y++)
      for (let x = Math.max(0, home.x - 9); x <= Math.min(s.width - 1, home.x + 9); x++) {
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
      if (!saint || dist(saint, p) > o.reachRadius) continue;
      const ageDays = (s.hour - o.issuedAtHour)/24;
      const half = Math.max(30, (o.expiresAtHour-o.issuedAtHour)/24 * .58);
      const attention = clamp(1 - Math.max(0,ageDays-20) / half, .18, 1);
      const score = (2.6 + p.devotion/18) * attention;
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
  function agricultureHarvest(s,p,h) {
    const A=s.agriculture,L=A.land,W=A.worker;
    const plots=s.tiles.filter(t=>t.terrain==='field'&&Math.abs(t.x-h.x)<=9&&Math.abs(t.y-h.y)<=9);
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
    const wood = nearestResource(s, h, 'wood');
    const fiber = nearestResource(s, h, 'fiber');
    const forage = nearestResource(s, h, 'food');
    const stone = nearestResource(s, h, 'stone');
    const publicMaterials = security.town && security.town.storage.wood < 20;
    const publicStone = security.town && security.town.storage.stone < 14;
    const canBuild = !h.home && h.inventory.wood >= s.rules.hutWood && h.inventory.fiber >= s.rules.hutFiber;
    const call = workCalling(s, p);
    const foodBias = call.score;
    const candidates = [];
    if (forage) candidates.push({ name: 'forage', score: 4.8 + (scarce ? 3.5 : 0) + p.proficiency.gather + foodBias, valid: true });
    if (field) candidates.push({ name: 'farm', score: 4.4 + field.crop * 2.5 + (scarce ? 2.2 : 0) + p.proficiency.food + foodBias, valid: true });
    if (wood && (!h.home || publicMaterials || (basic && basic.housingPressure > .2))) candidates.push({ name: 'wood', score: (!h.home && h.inventory.wood < s.rules.hutWood ? 8.0 : publicMaterials ? 6.5 : 2.6) + p.proficiency.gather, valid: true });
    if (stone && publicStone) candidates.push({ name: 'stone', score: 6.0 + p.proficiency.gather, valid: true });
    if (fiber && !h.home) candidates.push({ name: 'fiber', score: h.inventory.fiber < s.rules.hutFiber ? 7.5 + p.proficiency.gather : 1, valid: true });
    if (!h.home && canBuild) candidates.push({ name: 'build', score: 9.3 + p.proficiency.build, valid: true });
    // Not every work period should be production. When accessible reserves are
    // strong, adults can spend the work block supporting dependents and the home.
    // Oracle pressure can redirect willing people to feasible food activities.
    candidates.push({ name: 'care', score: 3.5 + (security.days >= 11 ? 5.0 : security.days >= 7 ? 2.7 : 0) +
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
      farm: `附近農田作物成熟度 ${Math.round((field?.crop || 0)*100)}%，農業熟練度 ${Math.round(p.proficiency.food*100)}%；家戶可及存糧約 ${foodDays} 天`,
      wood: `住屋或聚落需要木材；家戶木材 ${h.inventory.wood.toFixed(1)}，附近可伐木`,
      fiber: `尚須纖維建屋；家戶纖維 ${h.inventory.fiber.toFixed(1)}`,
      stone: `附近可採石，公共建材需求尚未滿足`,
      build: `家戶已備齊 ${s.rules.hutWood} 木材與 ${s.rules.hutFiber} 纖維，正在投入建屋勞力`,
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
    } else if (choice.name === 'farm' && field) {
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
    } else if (choice.name === 'build') {
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
        p.activity = p.stage === 'child' ? 'family' : p.devotion >= 20 && (s.tick + Number(p.id.slice(1))) % 5 === 0 ? 'pray' : 'family';
        p.activityReason = p.activity === 'pray' ? '利用非工作時段祈禱' :
          p.stage === 'child' ? '兒童需要照顧，目前不承擔完整成人工作量' : '非工作時段，用於家戶生活及照料';
      }
      else if (p.stage === 'adult' && p.health >= 20) performWork(s,p);
      else { p.activity = 'family'; p.activityReason = '目前生命階段或健康狀況不適合一般工作'; }
    }
  }
  function updateWorld(s) {
    const day = days(s);
    // Coarse, bounded weather stress; default drought is temporary, not a forced multi-year catastrophe.
    const seasonal = day % 160;
    const drought = seasonal >= 14 && seasonal <= 29;
    const rainy = seasonal < 6 || (seasonal >= 32 && seasonal < 40) || (seasonal >= 68 && seasonal < 75);
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
  function updateSettlement(s) {
    if (!hasSettlement(s)) {
      const near = s.households.filter(h => dist(h, s.camp) <= s.rules.settlementClusterDistance);
      const huts = near.filter(h => h.home);
      if (huts.length >= s.rules.settlementMinHuts && near.length >= 4) {
        const town = { id: 's1', name: '初穗聚落', x:s.camp.x, y:s.camp.y,
          foundedAtHour:s.hour, householdIds:near.map(h=>h.id), storage:{food:0,wood:0,stone:0,fiber:0},
          workDemand:{foodPressure:0,housingPressure:0}, foodShortageDays:0,
          famineDays:0, famineReliefDays:0, famineActive:false, lastDailyUnmetFood:0 };
        s.settlements.push(town);
        for (const p of s.people) if (town.householdIds.includes(p.householdId)) p.settlementId = town.id;
        s.history.settlementFoundedHour = s.hour;
        log(s,'settlement',`${town.name} 由 ${huts.length} 戶已建屋的家庭形成。`,
          ['群居、土地與水源適宜；多戶實際收集建材並完成住所']);
      }
      return;
    }
    for (const town of s.settlements) {
      const activeHomes = s.households.filter(h => accessibleSettlement(s,h)?.id === town.id && householdMembers(s,h).length);
      const totalNeed = activeHomes.reduce((n,h)=>n+dailyFoodNeed(s,h),0);
      const foodStock = town.storage.food + activeHomes.reduce((z,h)=>z+h.inventory.food,0);
      const required = totalNeed * 8; // desired buffer, not a hard rationing or mortality threshold
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
        const ids=living(s).filter(p=>p.religionId===s.religion.id && saint && dist(p,saint)<=o.reachRadius).map(p=>p.id);
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
    // Slowly varying devotion; strongest lasting shifts require attributable outcomes.
    if (days(s)%12===0) {
      for(const p of s.people) {
        if(!p.alive || p.religionId!==s.religion.id || p.devotion>=40) continue;
        if (p.devotion>=20 && s.religion.priests.length && rand(s)<.3)
          p.devotion=Math.min(39,p.devotion+1); // ordinary preaching never manufactures devout status
      }
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
        o.heardCount=living(s).filter(p=>p.religionId===s.religion.id && dist(p,owner)<=o.reachRadius).length;
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
  function demographic(s) {
    const now=days(s);
    for(const p of s.people.slice()) {
      if(!p.alive) continue;
      if(now>0 && now%s.rules.daysPerYear===0) {
        p.age++;
        if(p.age>=18 && p.stage==='child') p.stage='adult';
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
    // Household movement requires actual pressure AND a promising destination;
    // moving all hungry people to the same exhausted tile is not a survival strategy.
    const town=s.settlements[0];
    if(town && town.workDemand.foodPressure>.9 && town.foodShortageDays>=30) {
      const vulnerable=s.households.find(h=>h.migrated===0 && accessibleSettlement(s,h)?.id===town.id &&
        householdMembers(s,h).length && foodSecurity(s,h).days<2);
      if(vulnerable) {
        const next=relocationSite(s,vulnerable,town);
        if(next){
          const from={x:vulnerable.x,y:vulnerable.y};
          moveHousehold(s,vulnerable,next,town,true);
          log(s,'migration',`${vulnerable.name} 因持續缺糧，自主搬往新的採集區。`,
            ['舊聚落供給不足，且附近有可採集的環境資源',`原位置 ${from.x},${from.y}，新位置 ${next.x},${next.y}`]);
        }
      }
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
    for(const t of s.settlements||[]) for(const value of Object.values(t.storage||{}))
      if(!Number.isFinite(value)||value<-.00001) errors.push(`聚落 ${t.id} 庫存無效`);
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
    const verdict=validate(candidate);
    if(!verdict.ok) throw new Error('無法讀取世界：'+verdict.errors.join('；'));
    return candidate;
  }
  return {VERSION,DEFAULT_RULES,create,advanceTicks,stats,faithfulWeight,presenceAt,evalRain,castRain,
    issueOracle,concludeOracle,checkOracle,die,validate,restore,days,inspectHousehold};
});
