/* World of God, ruleset 1. The simulation has no browser or wall-clock dependency. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WoG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const WIDTH = 40, HEIGHT = 26, TICKS_PER_DAY = 12;
  const MAX_EVENTS = 80, MAX_ACTIONS = 120, MAX_POWER = 100;
  const COSTS = Object.freeze({ rain: 18, bless: 14, oracle: 10 });
  const DIFFICULTY = Object.freeze({ relaxed: 1.65, standard: 1, scarce: 0.55 });
  const presets = Object.freeze({
    valley: Object.freeze({ name: '河谷', title: '豐饒河谷', description: '河流穿過沃野，兩座聚落共享雨季，也一起面對乾旱。', moisture: 0.64, food: 80, belief: 0.48 }),
    dry: Object.freeze({ name: '旱原', title: '乾燥原野', description: '稀疏林地與乾燥土壤，讓每一次降雨都有分量。', moisture: 0.36, food: 64, belief: 0.42 }),
    islands: Object.freeze({ name: '群島', title: '雙生群島', description: '隔水相望的聚落，各自解讀同一個神的意圖。', moisture: 0.7, food: 88, belief: 0.54 })
  });
  const NAMES = ['禾安', '青穗', '木川', '石澄', '阿岑', '雨生', '冬禾', '月琴', '田北', '小滿', '春溪', '柏平', '海棠', '松原', '雲舒', '若谷', '水鹿', '晨星', '穗寧', '山禾', '初陽', '杏白', '林舟', '阿苒'];
  const FAMILY = ['禾家', '石家', '溪家', '柏家', '海家', '松家', '山家', '林家'];
  const TERRAIN = new Set(['water', 'grass', 'forest', 'hill', 'field']);
  const TASKS = new Set(['farming', 'foraging', 'praying', 'resting']);
  const STAGES = new Set(['issued', 'heard', 'interpreted', 'accepted', 'deferred', 'refused', 'attempted', 'completed', 'failed', 'consequences']);
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const finite = (n) => typeof n === 'number' && Number.isFinite(n);
  const number = (n, fallback, a, b) => finite(n) ? clamp(n, a, b) : fallback;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const tileAt = (state, x, y) => state.tiles[y * state.width + x];
  function hash(text) {
    let n = 2166136261;
    for (let i = 0; i < text.length; i++) { n ^= text.charCodeAt(i); n = Math.imul(n, 16777619); }
    return n >>> 0;
  }
  function random(state) {
    state.rng = (state.rng + 0x6D2B79F5) >>> 0;
    let n = state.rng;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  function emit(state, type, text, detail) {
    const seq = ++state.eventSeq;
    const event = Object.assign({ id: 'e' + seq, seq, tick: state.tick, day: state.day, type, text, reason: '', parents: [] }, detail || {});
    state.events.push(event);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    return event;
  }
  function create(input) {
    input = input && typeof input === 'object' ? input : {};
    const preset = Object.hasOwn(presets, input.preset) ? input.preset : 'valley';
    const defaults = presets[preset];
    const config = {
      preset, seed: typeof input.seed === 'string' ? input.seed.slice(0, 120) : '第一縷曙光',
      difficulty: Object.hasOwn(DIFFICULTY, input.difficulty) ? input.difficulty : 'standard',
      moisture: number(input.moisture, defaults.moisture, 0, 1),
      food: number(input.food, defaults.food, 0, 1000),
      belief: number(input.belief, defaults.belief, 0, 1)
    };
    const state = {
      version: VERSION, ruleset: 'wog-1', seed: config.seed, rng: hash(config.seed), config,
      tick: 0, day: 1, time: { tick: 0, day: 1, ticksPerDay: TICKS_PER_DAY },
      width: WIDTH, height: HEIGHT, tiles: [], towns: [], households: [], people: [],
      power: 38, weather: { kind: 'clear', remaining: 72, cycle: 0 },
      rainZones: [], events: [], eventSeq: 0, actions: [], actionSeq: 0
    };
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const r = random(state), ripple = Math.sin(y * 0.42) * 1.6;
      let water = Math.abs(x - (20 + ripple)) < 1.4;
      if (preset === 'dry') water = (x < 4 && y > 17) || (x > 32 && y < 4);
      if (preset === 'islands') {
        const left = ((x - 10) / 9) ** 2 + ((y - 13) / 11) ** 2;
        const right = ((x - 30) / 8) ** 2 + ((y - 12) / 10) ** 2;
        water = Math.min(left, right) > 1;
      }
      const kind = water ? 'water' : r < (preset === 'dry' ? 0.13 : 0.24) ? 'forest' : r > 0.87 ? 'hill' : 'grass';
      const moisture = water ? 1 : clamp(config.moisture + (random(state) - 0.5) * 0.2 + (Math.abs(x - 20) < 5 && preset === 'valley' ? 0.08 : 0));
      state.tiles.push({ x, y, kind, moisture, growth: water ? 0 : 0.2 + random(state) * 0.5 });
    }
    for (let t = 0; t < 2; t++) {
      const town = { id: 'town-' + (t + 1), name: t ? '松岸' : '禾谷', x: t ? 30 : 10, y: t ? 11 : 14,
        food: config.food, blessing: 0, oracle: null, harvested: 0, foraged: 0, consumed: 0,
        signs: [], scarcity: false, lastHarvestEvent: -30 };
      state.towns.push(town);
      // Curated inhabitable village footprints make every generated preset playable.
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) {
        const tile = tileAt(state, town.x + dx, town.y + dy);
        tile.kind = dy >= 1 && Math.abs(dx) >= 1 ? 'field' : (dy <= -2 && Math.abs(dx) >= 2 ? 'forest' : 'grass');
        tile.moisture = clamp(config.moisture + (random(state) - 0.5) * 0.16);
        tile.growth = tile.kind === 'field' ? 0.34 + random(state) * 0.44 : 0.3 + random(state) * 0.45;
        tile.town = town.id;
      }
      for (let h = 0; h < 4; h++) {
        const household = { id: 'house-' + (t * 4 + h + 1), name: FAMILY[t * 4 + h], town: town.id, members: [], x: town.x + (h % 2 ? 2 : -2), y: town.y - (h < 2 ? 1 : 0) };
        state.households.push(household);
        for (let m = 0; m < 3; m++) {
          const index = t * 12 + h * 3 + m;
          const person = { id: 'person-' + (index + 1), name: NAMES[index], town: town.id, household: household.id,
            x: household.x, y: household.y, faith: clamp(config.belief + (random(state) - 0.5) * 0.38), hunger: 0.12 + random(state) * 0.15,
            energy: 0.65 + random(state) * 0.3, health: 1, task: ['farming', 'foraging', 'praying', 'resting'][index % 4],
            traits: { diligence: 0.35 + random(state) * 0.6, independence: random(state) },
            target: null, effort: 0, taskSince: 0, nextDecision: index % 8, lastSign: null, lastOracle: null,
            reason: '依照家戶與身體的需要安排今天。' };
          household.members.push(person.id); state.people.push(person);
        }
      }
    }
    emit(state, 'genesis', '歷史開始：八個家戶，在禾谷與松岸點起炊煙。', { reason: '24 位居民帶著各自的信仰、飢餓與性格，開始自主生活。' });
    emit(state, 'climate', '微風掠過田野；晴朗的日子不會永遠持續。', { reason: '土壤水分會隨天氣變動，作物必須生長並由居民收穫才能成為糧食。' });
    return state;
  }
  function members(state, town) { return state.people.filter(p => p.town === town.id); }
  function fields(state, town) { return state.tiles.filter(t => t.kind === 'field' && t.town === town.id); }
  function townStats(state, town) {
    const people = members(state, town), n = people.length || 1;
    return { faith: people.reduce((v, p) => v + p.faith, 0) / n, hunger: people.reduce((v, p) => v + p.hunger, 0) / n,
      independence: people.reduce((v, p) => v + p.traits.independence, 0) / n,
      moisture: fields(state, town).reduce((v, t) => v + t.moisture, 0) / Math.max(1, fields(state, town).length), population: people.length };
  }
  function stats(state) {
    const n = state.people.length;
    const followers = state.people.filter(p => p.faith >= 0.35).length;
    // Devotion is contribution, not a follower count or a spendable stock.
    const devotion = state.people.reduce((v, p) => v + p.faith * (p.task === 'praying' ? 1.5 : 0.35) * (0.5 + p.health * 0.5), 0);
    const spark = 0.015;
    const powerRate = (spark + devotion * 0.012) * DIFFICULTY[state.config.difficulty];
    const land = state.tiles.filter(t => t.kind !== 'water');
    return { population: n, followers, devotion, power: state.power, maxPower: MAX_POWER, powerRate, spark,
      food: state.towns.reduce((v, t) => v + t.food, 0), averageFaith: n ? state.people.reduce((v, p) => v + p.faith, 0) / n : 0,
      averageHunger: n ? state.people.reduce((v, p) => v + p.hunger, 0) / n : 0,
      moisture: land.reduce((v, t) => v + t.moisture, 0) / Math.max(1, land.length),
      day: state.day, tick: state.tick, weather: state.weather.kind,
      tasks: Object.fromEntries(Array.from(TASKS, task => [task, state.people.filter(p => p.task === task).length])) };
  }
  function resolveTown(state, target) {
    if (typeof target === 'string') return state.towns.find(t => t.id === target);
    if (target && typeof target === 'object') {
      const id = target.town || target.townId || target.id;
      if (typeof id === 'string') return state.towns.find(t => t.id === id);
      if (finite(target.x) && finite(target.y) && target.x >= 0 && target.x < state.width && target.y >= 0 && target.y < state.height)
        return state.towns.reduce((best, t) => !best || distance(t, target) < distance(best, target) ? t : best, null);
    }
    return undefined;
  }
  function act(state, type, target) {
    if (type === 'blessing') type = 'bless';
    if (!Object.hasOwn(COSTS, type)) return { ok: false, message: '這種神蹟尚不存在。', cost: 0 };
    const town = resolveTown(state, target);
    let point = town;
    if (type === 'rain' && target && typeof target === 'object' && finite(target.x) && finite(target.y)) point = target;
    if (!point || point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height)
      return { ok: false, message: '請選擇世界中的位置或聚落。', cost: 0 };
    if (type !== 'rain' && !town) return { ok: false, message: '請先選擇一座聚落。', cost: 0 };
    if (type === 'oracle' && town.oracle && town.oracle.stage !== 'consequences')
      return { ok: false, message: '這座聚落仍在回應上一道神諭。', cost: 0 };
    const cost = COSTS[type];
    if (state.power + 1e-9 < cost) return { ok: false, message: '神力不足；信仰與微弱的神性火種會逐步恢復神力。', cost: 0 };
    state.power = Math.max(0, state.power - cost);
    const action = { id: 'a' + (++state.actionSeq), tick: state.tick, type, target: type === 'rain' ? { x: point.x, y: point.y } : town.id, cost };
    state.actions.push(action);
    if (state.actions.length > MAX_ACTIONS) state.actions.splice(0, state.actions.length - MAX_ACTIONS);
    let event;
    if (type === 'rain') {
      event = emit(state, 'miracle', '雨落下了；土壤開始重新吸收水分。', { reason: '降雨改善水分，之後的收穫仍取決於作物、天候與居民的勞動。', actionId: action.id, x: point.x, y: point.y });
      state.rainZones.push({ id: action.id, x: point.x, y: point.y, radius: 7, remaining: 22, eventId: event.id });
      if (state.rainZones.length > 12) state.rainZones.shift();
      for (const tile of state.tiles) if (tile.kind !== 'water' && distance(tile, point) <= 7) tile.moisture = clamp(tile.moisture + 0.12);
      for (const t of state.towns) if (distance(t, point) <= 9) addSign(t, { id: event.id, type: 'rain', tick: state.tick, until: state.tick + 25 });
    } else if (type === 'bless') {
      town.blessing = 72;
      event = emit(state, 'miracle', town.name + '的田野受到祝福；幼苗的生長潛力提高。', { reason: '祝福加快濕潤田地的生長，不直接增加糧食，也無法取代雨水與收穫。', town: town.id, actionId: action.id });
      addSign(town, { id: event.id, type: 'bless', tick: state.tick, until: state.tick + 72 });
    } else {
      event = emit(state, 'oracle', '一道神諭傳向' + town.name + '：「照料田野，為旱季積糧。」', { reason: '神表達意圖；聚落將根據信仰、食物與自身判斷回應。', town: town.id, actionId: action.id });
      town.oracle = { id: action.id, title: '為旱季積糧', intent: 'prepare-harvest', stage: 'issued', reason: '神諭已發出，等待居民聽見。',
        issuedAt: state.tick, stageAt: state.tick, nextAt: state.tick + 4, history: [{ stage: 'issued', tick: state.tick, reason: '神諭已發出，尚未取代任何人的工作選擇。', eventId: event.id }],
        progress: 0, target: 12, initialHarvest: town.harvested, deferrals: 0, outcome: null, eventId: event.id };
    }
    return { ok: true, message: event.text, cost, eventId: event.id };
  }
  function addSign(town, sign) { town.signs.push(sign); if (town.signs.length > 12) town.signs.shift(); }
  function changeStage(state, town, stage, reason, delay) {
    const oracle = town.oracle;
    const labels = { heard: '被聽見', interpreted: '獲得詮釋', accepted: '被接受', deferred: '被暫緩', refused: '被拒絕', attempted: '開始嘗試', completed: '完成', failed: '未能完成', consequences: '留下後果' };
    const event = emit(state, 'oracle', town.name + '的神諭' + labels[stage] + '。', { reason, town: town.id, oracleId: oracle.id, stage, parents: [oracle.eventId] });
    oracle.stage = stage; oracle.stageAt = state.tick; oracle.reason = reason; oracle.nextAt = state.tick + (delay || 8); oracle.eventId = event.id;
    oracle.history.push({ stage, tick: state.tick, reason, eventId: event.id });
  }
  function updateOracle(state, town) {
    const oracle = town.oracle;
    if (!oracle || oracle.stage === 'consequences') return;
    if (oracle.stage === 'attempted') oracle.progress = Math.max(0, town.harvested - oracle.initialHarvest);
    if (state.tick < oracle.nextAt) return;
    const s = townStats(state, town);
    switch (oracle.stage) {
      case 'issued': changeStage(state, town, 'heard', '居民在夜間談起相同的聲音；訊息進入家戶。', 8); break;
      case 'heard': changeStage(state, town, 'interpreted', town.food < 25 ? '聚落把神諭理解為救荒：先保住眼前的食物。' : '聚落把神諭理解為備荒：願意的人多照料田地。', 10); break;
      case 'interpreted': case 'deferred': {
        const support = s.faith * 0.8 + (1 - s.independence) * 0.2;
        if (s.faith < 0.2 || support < 0.34) {
          oracle.outcome = 'refused';
          changeStage(state, town, 'refused', '信任不足：居民認為眼前的生活經驗比這道聲音可靠。', 12);
        } else if ((town.food < 12 || s.hunger > 0.5) && oracle.deferrals < 2) {
          oracle.deferrals++;
          changeStage(state, town, 'deferred', '糧食或體力吃緊；居民先覓食與休息，稍後重新討論。', 18);
        } else if (s.hunger > 0.7) {
          oracle.outcome = 'refused';
          changeStage(state, town, 'refused', '飢餓壓過了信任；家戶無力承擔額外的備荒工作。', 12);
        } else changeStage(state, town, 'accepted', '信任足以支持嘗試；居民同意提高耕作優先，但仍保留各自的選擇。', 8);
        break;
      }
      case 'accepted':
        oracle.initialHarvest = town.harvested;
        changeStage(state, town, 'attempted', '部分居民開始優先照料田地；成果取決於水分、成熟度與實際收穫。', 56); break;
      case 'attempted':
        if (oracle.progress >= oracle.target) {
          oracle.outcome = 'completed';
          changeStage(state, town, 'completed', '居民在嘗試期間實際收穫了 ' + Math.floor(oracle.progress) + ' 份糧食，達到備荒目標。', 10);
        } else {
          oracle.outcome = 'failed';
          changeStage(state, town, 'failed', s.moisture < 0.25 ? '乾燥土壤拖慢作物；即使有人耕作，也未能及時收足糧食。' : '有限的勞力、成熟作物與家戶需要，使這次積糧未達目標。', 10);
        }
        break;
      case 'completed': case 'failed': case 'refused':
        changeStage(state, town, 'consequences', oracle.outcome === 'completed' ? '收穫成為可見的證據；居民將依自身經驗重新評估信仰。' : oracle.outcome === 'refused' ? '拒絕沒有停止世界；居民繼續生活，神性火種依然存在。' : '落空的期望留下疑問；居民將依自身經驗重新評估信仰。', 0);
        break;
    }
  }
  function weatherStep(state) {
    state.weather.remaining--;
    if (state.weather.remaining > 0) return;
    state.weather.cycle++;
    const phases = [{ kind: 'drought', duration: 96 }, { kind: 'clear', duration: 96 }, { kind: 'rain', duration: 44 }, { kind: 'clear', duration: 120 }];
    const phase = phases[(state.weather.cycle - 1) % phases.length];
    state.weather.kind = phase.kind; state.weather.remaining = phase.duration;
    emit(state, 'weather', phase.kind === 'drought' ? '乾旱來臨：水分加速流失，田野開始承受壓力。' : phase.kind === 'rain' ? '季雨抵達：雨水慢慢滲入乾燥的土地。' : '天色轉晴；聚落繼續調整生活。',
      { reason: phase.kind === 'drought' ? '乾旱增加蒸散；低含水量會抑制作物生長，之後才影響糧倉與居民。' : '天氣先改變土壤，再經由生長、勞動與食物影響生活。' });
  }
  function ecologyStep(state) {
    for (const tile of state.tiles) {
      if (tile.kind === 'water') { tile.moisture = 1; continue; }
      const localRain = state.rainZones.some(z => distance(tile, z) <= z.radius);
      const rain = (state.weather.kind === 'rain' ? 0.026 : 0) + (localRain ? 0.041 : 0);
      const evaporation = state.weather.kind === 'drought' ? 0.0105 : 0.0028;
      tile.moisture = clamp(tile.moisture + rain - evaporation);
      const town = tile.town ? state.towns.find(t => t.id === tile.town) : null;
      const wet = clamp((tile.moisture - 0.13) / 0.55);
      const blessing = town && town.blessing > 0 ? 1.8 : 1;
      let growth = tile.kind === 'field' ? 0.0048 * wet * blessing : tile.kind === 'forest' ? 0.0028 * wet : 0.001 * wet;
      if (tile.moisture < 0.13) growth -= tile.kind === 'field' ? 0.0023 : 0.0005;
      tile.growth = clamp(tile.growth + growth);
    }
    for (const zone of state.rainZones) zone.remaining--;
    state.rainZones = state.rainZones.filter(z => z.remaining > 0);
    for (const town of state.towns) {
      if (town.blessing > 0) town.blessing--;
      town.signs = town.signs.filter(s => s.until >= state.tick);
    }
  }
  function selectTask(state, person, town) {
    const oracle = town.oracle;
    const pressure = clamp(1 - town.food / 65);
    const obey = oracle && ['accepted', 'attempted'].includes(oracle.stage) ? person.faith * (1 - person.traits.independence * 0.6) * 0.48 : 0;
    const phase = (state.tick + Number(person.id.split('-')[1]) * 5) % 48;
    const scores = {
      farming: 0.30 + person.traits.diligence * 0.20 + pressure * 0.22 + obey + (phase < 19 ? 0.2 : 0),
      foraging: 0.21 + person.hunger * 0.65 + pressure * 0.30 + (phase >= 19 && phase < 34 ? 0.22 : 0),
      praying: 0.12 + person.faith * 0.3 + (phase >= 34 ? 0.35 : 0) - person.hunger * 0.4,
      resting: 0.12 + (1 - person.energy) * 0.72 + (person.health < 0.7 ? 0.2 : 0)
    };
    let task = 'resting';
    if (person.energy < 0.13) task = 'resting';
    else task = Object.keys(scores).reduce((a, b) => scores[a] >= scores[b] ? a : b);
    if (task !== person.task) { person.task = task; person.taskSince = state.tick; person.effort = 0; person.target = null; }
    person.reason = task === 'farming' ? (obey > 0 ? '神諭提高了耕作的重要性，但我也需要照料家戶。' : pressure > 0.5 ? '糧倉正在減少，需要照料田地。' : '照料作物，為家戶累積糧食。')
      : task === 'foraging' ? '先從林地尋找能入口的食物。' : task === 'praying' ? '身體暫時安穩，願意把時間交給信仰。' : '體力不足，需要回到家戶休息。';
    person.nextDecision = state.tick + 6 + Math.floor(random(state) * 5);
  }
  function chooseTarget(state, person, town) {
    if (person.task === 'farming') {
      const plots = fields(state, town);
      // Farmers observe nearby fields; their preferences depend on ripeness and distance.
      person.target = plots.reduce((best, tile) => !best || tile.growth - distance(person, tile) * 0.027 > best.growth - distance(person, best) * 0.027 ? tile : best, null);
    } else if (person.task === 'foraging') {
      const plots = state.tiles.filter(t => t.kind === 'forest' && distance(t, town) < 9);
      person.target = plots.reduce((best, tile) => !best || tile.growth - distance(person, tile) * 0.045 > best.growth - distance(person, best) * 0.045 ? tile : best, null);
    } else if (person.task === 'resting') person.target = state.households.find(h => h.id === person.household);
    else person.target = town;
    // Targets are coordinates only: no shared object references or state cycles in save files.
    if (person.target) person.target = { x: person.target.x, y: person.target.y };
  }
  function individualStep(state, person) {
    const town = state.towns.find(t => t.id === person.town);
    if (!town) return;
    person.hunger = clamp(person.hunger + 0.0065);
    if (town.food >= 0.18 && person.hunger > 0.12) {
      town.food -= 0.18; town.consumed += 0.18; person.hunger = clamp(person.hunger - 0.022);
    }
    if (person.hunger > 0.75) person.health = clamp(person.health - 0.0017, 0.18, 1);
    else if (person.hunger < 0.3) person.health = clamp(person.health + 0.0013, 0.18, 1);
    if (state.tick >= person.nextDecision) selectTask(state, person, town);
    if (!person.target || state.tick % 12 === 0) chooseTarget(state, person, town);
    if (person.target) {
      const dx = person.target.x - person.x, dy = person.target.y - person.y, d = Math.hypot(dx, dy);
      const speed = 0.28 * (0.65 + person.health * 0.35);
      if (d > speed) { person.x += dx / d * speed; person.y += dy / d * speed; }
      else { person.x = person.target.x; person.y = person.target.y; }
    }
    const arrived = person.target && distance(person, person.target) < 0.4;
    if (person.task === 'resting') person.energy = clamp(person.energy + 0.03);
    else person.energy = clamp(person.energy - (person.task === 'praying' ? 0.003 : 0.007));
    if (arrived && person.task === 'farming') {
      const tile = tileAt(state, Math.round(person.x), Math.round(person.y));
      if (tile && tile.kind === 'field') {
        const work = 0.0035 * (0.5 + person.traits.diligence) * clamp((tile.moisture - 0.12) / 0.4);
        tile.growth = clamp(tile.growth + work); person.effort++;
        if (tile.growth >= 0.90 && person.effort >= 3) {
          const yieldFood = 4.5 + tile.moisture * 2;
          tile.growth = 0.08; town.food += yieldFood; town.harvested += yieldFood; person.effort = 0; person.target = null;
          if (town.oracle && town.oracle.stage === 'attempted') town.oracle.progress = town.harvested - town.oracle.initialHarvest;
          if (state.tick - town.lastHarvestEvent >= 18) {
            town.lastHarvestEvent = state.tick;
            const sign = town.signs.find(s => s.type === 'bless') || town.signs.find(s => s.type === 'rain');
            emit(state, 'harvest', town.name + '收穫了一批糧食。', { reason: '成熟作物經居民收割，成為糧倉中的食物。' + (sign ? '這片田地曾受到神蹟影響。' : ''), town: town.id, person: person.id, parents: sign ? [sign.id] : [], amount: yieldFood });
          }
          if (town.blessing > 0) person.faith = clamp(person.faith + 0.018);
        }
      }
    } else if (arrived && person.task === 'foraging') {
      const tile = tileAt(state, Math.round(person.x), Math.round(person.y));
      if (tile && tile.kind === 'forest' && tile.growth > 0.045) {
        const amount = Math.min(tile.growth, 0.014); tile.growth -= amount; town.food += amount * 9; town.foraged += amount * 9;
      } else person.target = null;
    }
    // Personal faith is evaluated here from experienced evidence, never set by the divine actor.
    const lastSeenSign = person.lastSign ? Number(person.lastSign.slice(1)) : 0;
    const sign = town.signs.find(s => s.type === 'rain' && Number(s.id.slice(1)) > lastSeenSign);
    if (sign && townStats(state, town).moisture > 0.3) { person.faith = clamp(person.faith + 0.025 * (1 - person.traits.independence * 0.5)); person.lastSign = sign.id; }
    if (person.task === 'praying' && person.hunger < 0.5) person.faith = clamp(person.faith + 0.0006);
    if (person.hunger > 0.55) person.faith = clamp(person.faith - 0.0009 * (0.5 + person.traits.independence));
    if (town.oracle && town.oracle.stage === 'consequences' && person.lastOracle !== town.oracle.id) {
      const change = town.oracle.outcome === 'completed' ? 0.045 : town.oracle.outcome === 'failed' ? -0.032 : -0.005;
      person.faith = clamp(person.faith + change * (1 - person.traits.independence * 0.4)); person.lastOracle = town.oracle.id;
    }
  }
  function step(state, ticks = 1) {
    if (!finite(ticks) || ticks < 0) throw new TypeError('ticks must be a finite nonnegative number');
    ticks = Math.floor(ticks);
    if (ticks > 100000) throw new RangeError('step is limited to 100000 ticks per call');
    for (let i = 0; i < ticks; i++) {
      state.tick++; state.day = 1 + Math.floor(state.tick / TICKS_PER_DAY);
      state.time.tick = state.tick; state.time.day = state.day;
      weatherStep(state); ecologyStep(state);
      // Rotate processing order to avoid permanently privileging a household at an empty granary.
      for (let j = 0; j < state.people.length; j++) individualStep(state, state.people[(j + state.tick) % state.people.length]);
      for (const town of state.towns) {
        updateOracle(state, town);
        const scarce = town.food < 15;
        if (scarce && !town.scarcity) emit(state, 'scarcity', town.name + '的糧倉告急；居民開始把覓食放在更前面。', { reason: '食物消耗超過收穫，改變了家戶的工作選擇；飢餓也可能改變信仰。', town: town.id });
        if (!scarce && town.scarcity) emit(state, 'recovery', town.name + '的糧倉重新有了餘裕。', { reason: '居民實際取得的收穫與野食，暫時減輕了生活壓力。', town: town.id });
        town.scarcity = scarce;
      }
      state.power = clamp(state.power + stats(state).powerRate, 0, MAX_POWER);
    }
    return state;
  }
  function validateSave(input) {
    const errors = [];
    const fail = message => { if (errors.length < 12) errors.push(message); };
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const inRange = (v, a, b) => finite(v) && v >= a && v <= b;
    const string = (v, max = 500) => typeof v === 'string' && v.length <= max;
    const list = (v, max) => Array.isArray(v) && v.length <= max;
    const s = input;
    if (!object(s)) return { ok: false, errors: ['存檔必須是物件。'] };
    if (s.version !== VERSION || s.ruleset !== 'wog-1') fail('不支援的存檔版本。');
    if (s.width !== WIDTH || s.height !== HEIGHT) fail('地圖尺寸不符。');
    if (!Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e12 || s.day !== 1 + Math.floor(s.tick / TICKS_PER_DAY)) fail('世界時間無效。');
    if (!object(s.time) || s.time.tick !== s.tick || s.time.day !== s.day || s.time.ticksPerDay !== TICKS_PER_DAY) fail('時間快照無效。');
    if (!Number.isInteger(s.rng) || s.rng < 0 || s.rng > 0xffffffff || !string(s.seed, 120)) fail('隨機種子無效。');
    if (!object(s.config) || !Object.hasOwn(presets, s.config.preset) || !Object.hasOwn(DIFFICULTY, s.config.difficulty) || !inRange(s.config.moisture, 0, 1) || !inRange(s.config.food, 0, 1000) || !inRange(s.config.belief, 0, 1) || s.config.seed !== s.seed) fail('創世設定無效。');
    if (!inRange(s.power, 0, MAX_POWER)) fail('神力無效。');
    if (!object(s.weather) || !['clear', 'rain', 'drought'].includes(s.weather.kind) || !inRange(s.weather.remaining, 1, 120) || !Number.isSafeInteger(s.weather.cycle) || s.weather.cycle < 0) fail('天候無效。');
    if (!list(s.tiles, WIDTH * HEIGHT) || s.tiles.length !== WIDTH * HEIGHT) fail('地形資料不完整。');
    else s.tiles.forEach((t, i) => { if (!object(t) || t.x !== i % WIDTH || t.y !== Math.floor(i / WIDTH) || !TERRAIN.has(t.kind) || !inRange(t.moisture, 0, 1) || !inRange(t.growth, 0, 1)) fail('地形資料無效。'); });
    if (!list(s.towns, 2) || s.towns.length !== 2 || !list(s.households, 8) || s.households.length !== 8 || !list(s.people, 24) || s.people.length > 24) fail('居民或聚落資料不完整。');
    const towns = list(s.towns, 2) ? s.towns : [], households = list(s.households, 8) ? s.households : [], people = list(s.people, 24) ? s.people : [];
    const townIds = new Set(towns.map(t => t && t.id)), householdIds = new Set(households.map(h => h && h.id)), personIds = new Set(people.map(p => p && p.id));
    if (townIds.size !== towns.length || householdIds.size !== households.length || personIds.size !== people.length) fail('實體 ID 重複。');
    const point = p => object(p) && finite(p.x) && p.x >= 0 && p.x < WIDTH && finite(p.y) && p.y >= 0 && p.y < HEIGHT;
    for (const t of towns) {
      if (!point(t) || !string(t.id, 80) || !string(t.name, 80) || !inRange(t.food, 0, 1e12) || !inRange(t.blessing, 0, 72) || !inRange(t.harvested, 0, 1e12) || !inRange(t.foraged, 0, 1e12) || !inRange(t.consumed, 0, 1e12) || !finite(t.lastHarvestEvent) || typeof t.scarcity !== 'boolean') { fail('聚落資料無效。'); continue; }
      if (!list(t.signs, 12) || t.signs.some(v => !object(v) || !string(v.id, 80) || !['rain', 'bless'].includes(v.type) || !finite(v.tick) || !finite(v.until))) fail('神蹟痕跡無效。');
      if (t.oracle !== null) {
        const o = t.oracle;
        if (!object(o) || !STAGES.has(o.stage) || !string(o.id, 80) || !string(o.title) || !string(o.reason) || !string(o.eventId, 80) || !inRange(o.progress, 0, 1e12) || !inRange(o.target, 1, 100) || !inRange(o.initialHarvest, 0, 1e12) || !inRange(o.deferrals, 0, 2) || !finite(o.nextAt) || !finite(o.issuedAt) || !finite(o.stageAt) || ![null, 'completed', 'failed', 'refused'].includes(o.outcome) || !list(o.history, 16) || o.history.some(h => !object(h) || !STAGES.has(h.stage) || !finite(h.tick) || !string(h.reason) || !string(h.eventId, 80))) fail('神諭歷程無效。');
      }
    }
    for (const h of households) if (!point(h) || !string(h.id, 80) || !string(h.name, 80) || !townIds.has(h.town) || !list(h.members, 3) || h.members.some(id => !personIds.has(id))) fail('家戶資料無效。');
    for (const p of people) {
      if (!point(p) || !string(p.id, 80) || !string(p.name, 80) || !townIds.has(p.town) || !householdIds.has(p.household) || !TASKS.has(p.task) || !inRange(p.faith, 0, 1) || !inRange(p.hunger, 0, 1) || !inRange(p.energy, 0, 1) || !inRange(p.health, 0.18, 1) || !object(p.traits) || !inRange(p.traits.diligence, 0, 1) || !inRange(p.traits.independence, 0, 1) || !(p.target === null || point(p.target)) || !inRange(p.effort, 0, 1e12) || !finite(p.nextDecision) || !finite(p.taskSince) || !(p.lastSign === null || (string(p.lastSign, 80) && /^e[1-9]\d*$/.test(p.lastSign))) || !(p.lastOracle === null || string(p.lastOracle, 80)) || !string(p.reason)) { fail('個人資料無效。'); continue; }
      const household = households.find(h => h && h.id === p.household);
      if (!household || household.town !== p.town || !Array.isArray(household.members) || !household.members.includes(p.id)) fail('個人與家戶歸屬不一致。');
    }
    if (!list(s.rainZones, 12) || s.rainZones.some(z => !point(z) || !inRange(z.radius, 1, 7) || !inRange(z.remaining, 1, 22) || !string(z.id, 80) || !string(z.eventId, 80))) fail('降雨範圍無效。');
    if (!Number.isSafeInteger(s.eventSeq) || s.eventSeq < 0 || !list(s.events, MAX_EVENTS)) fail('歷史資料無效。');
    else {
      let seq = 0;
      for (const e of s.events) {
        if (!object(e) || !Number.isSafeInteger(e.seq) || e.seq <= seq || e.seq > s.eventSeq || e.id !== 'e' + e.seq || !inRange(e.tick, 0, s.tick) || !string(e.type, 80) || !string(e.text, 1000) || !string(e.reason, 1000) || !list(e.parents, 8) || e.parents.some(id => !string(id, 80))) fail('歷史事件無效。');
        seq = e && e.seq;
      }
    }
    if (!Number.isSafeInteger(s.actionSeq) || s.actionSeq < 0 || !list(s.actions, MAX_ACTIONS)) fail('神意紀錄無效。');
    else for (const a of s.actions) if (!object(a) || !string(a.id, 80) || !Object.hasOwn(COSTS, a.type) || a.cost !== COSTS[a.type] || !inRange(a.tick, 0, s.tick) || !(townIds.has(a.target) || point(a.target))) fail('神意紀錄無效。');
    return { ok: errors.length === 0, errors };
  }
  return Object.freeze({ VERSION, WIDTH, HEIGHT, TICKS_PER_DAY, MAX_EVENTS, MAX_ACTIONS, MAX_POWER, COSTS, presets, create, step, act, stats, validateSave });
});
