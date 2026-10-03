'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../core.js');
const clone = value => JSON.parse(JSON.stringify(value));
const make = config => Core.create({ seed: 'test-seed', ...config });

function assertValid(state) {
  const result = Core.validateSave(state);
  assert.equal(result.ok, true, result.errors.join('\n'));
}

test('exports the same API to browser globals without Node dependencies', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../core.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.WoG.create, 'function');
  assert.equal(sandbox.WoG.create({ seed: 'browser' }).people.length, 24);
});

test('curated presets contain two villages, eight households, and 24 unique people', () => {
  for (const preset of ['valley', 'dry', 'islands']) {
    const state = make({ preset });
    assert.equal(state.tiles.length, 40 * 26);
    assert.equal(state.towns.length, 2);
    assert.equal(state.households.length, 8);
    assert.equal(state.people.length, 24);
    assert.equal(new Set(state.people.map(p => p.name)).size, 24);
    assert.equal(state.power, 38);
    for (const house of state.households) {
      assert.equal(house.members.length, 3);
      for (const id of house.members) assert.equal(state.people.find(p => p.id === id).household, house.id);
    }
    assertValid(state);
  }
});

test('normalizes invalid creation input without non-finite state', () => {
  for (const config of [null, {}, { preset: '__proto__', difficulty: '__proto__' }, { moisture: NaN, food: Infinity, belief: -2 }, { moisture: 4, food: -5, seed: 'a'.repeat(1000) }]) {
    assertValid(Core.create(config));
  }
});

test('same seed, config, ticks and input log reproduce exactly', () => {
  const a = make(), b = make();
  Core.step(a, 24); Core.step(b, 24);
  assert.deepEqual(Core.act(a, 'rain', { x: 10, y: 14 }), Core.act(b, 'rain', { x: 10, y: 14 }));
  Core.step(a, 35); Core.step(b, 35);
  assert.deepEqual(Core.act(a, 'oracle', 'town-2'), Core.act(b, 'oracle', 'town-2'));
  Core.step(a, 140); Core.step(b, 140);
  assert.deepEqual(a, b);
  assert.notDeepEqual(make({ seed: 'another-seed' }).tiles, make().tiles);
});

test('batch stepping is equivalent to single stepping and rejects unbounded inputs', () => {
  const a = make(), b = make();
  Core.step(a, 150);
  for (let i = 0; i < 150; i++) Core.step(b);
  assert.deepEqual(a, b);
  assert.equal(Core.step(a, 0), a);
  assert.throws(() => Core.step(a, Infinity), TypeError);
  assert.throws(() => Core.step(a, -1), TypeError);
  assert.throws(() => Core.step(a, 100001), RangeError);
  assert.equal(a.day, 13);
  assert.equal(a.time.tick, a.tick);
  assert.equal(a.time.day, a.day);
});

test('difficulty changes divine power accumulation only', () => {
  const worlds = ['relaxed', 'standard', 'scarce'].map(difficulty => make({ difficulty }));
  worlds.forEach(s => Core.step(s, 40));
  assert.ok(worlds[0].power > worlds[1].power);
  assert.ok(worlds[1].power > worlds[2].power);
  worlds.forEach(s => { s.power = 0; s.config.difficulty = 'standard'; });
  assert.deepEqual(worlds[0], worlds[1]);
  assert.deepEqual(worlds[1], worlds[2]);
});

test('rain costs 18, wets a local area, and never spawns food or plants', () => {
  const state = make();
  const beforeFood = Core.stats(state).food;
  const beforeGrowth = state.tiles.map(t => t.growth);
  const far = state.tiles.find(t => t.x === 35 && t.y === 22);
  const farMoisture = far.moisture;
  const near = state.tiles.find(t => t.x === 10 && t.y === 15);
  const nearMoisture = near.moisture;
  const result = Core.act(state, 'rain', { x: 10, y: 14 });
  assert.equal(result.ok, true);
  assert.equal(state.power, 20);
  assert.equal(Core.stats(state).food, beforeFood);
  assert.deepEqual(state.tiles.map(t => t.growth), beforeGrowth);
  assert.ok(near.moisture > nearMoisture);
  assert.equal(far.moisture, farMoisture);
  assert.equal(state.rainZones.length, 1);
  Core.step(state, 22);
  assert.equal(state.rainZones.length, 0);
  assertValid(state);
});

test('blessing modifies crop growth over time and expires', () => {
  const baseline = make(), blessed = make();
  const beforeFood = Core.stats(blessed).food;
  const beforeGrowth = blessed.tiles.map(t => t.growth);
  assert.equal(Core.act(blessed, 'bless', 'town-1').ok, true);
  assert.equal(blessed.power, 24);
  assert.equal(Core.stats(blessed).food, beforeFood);
  assert.deepEqual(blessed.tiles.map(t => t.growth), beforeGrowth);
  assert.equal(blessed.towns[0].blessing, 72);
  Core.step(baseline); Core.step(blessed);
  const index = blessed.tiles.findIndex(t => t.town === 'town-1' && t.kind === 'field');
  assert.ok(blessed.tiles[index].growth > baseline.tiles[index].growth);
  Core.step(blessed, 71);
  assert.equal(blessed.towns[0].blessing, 0);
});

test('invalid targets, actions, and insufficient power leave the state unchanged', () => {
  const state = make();
  for (const [type, target] of [['unknown', 'town-1'], ['rain', { x: -1, y: 3 }], ['rain', { x: NaN, y: 3 }], ['bless', 'missing'], ['oracle', null]]) {
    const before = clone(state);
    assert.equal(Core.act(state, type, target).ok, false);
    assert.deepEqual(state, before);
  }
  state.power = 9;
  const before = clone(state);
  assert.equal(Core.act(state, 'oracle', 'town-1').ok, false);
  assert.deepEqual(state, before);
});

test('oracle stages are persistent, sequential, causally linked, and non-instant', () => {
  const state = make({ belief: 0.8 });
  const jobs = state.people.map(p => p.task);
  assert.equal(Core.act(state, 'oracle', 'town-1').ok, true);
  const oracle = state.towns[0].oracle;
  assert.equal(oracle.stage, 'issued');
  assert.equal(state.power, 28);
  assert.deepEqual(state.people.map(p => p.task), jobs);
  assert.equal(Core.act(state, 'oracle', 'town-1').ok, false);
  Core.step(state, 3); assert.equal(oracle.stage, 'issued');
  Core.step(state); assert.equal(oracle.stage, 'heard');
  Core.step(state, 8); assert.equal(oracle.stage, 'interpreted');
  Core.step(state, 108);
  assert.equal(oracle.stage, 'consequences');
  assert.equal(oracle.outcome, 'completed');
  assert.deepEqual(oracle.history.map(h => h.stage), ['issued', 'heard', 'interpreted', 'accepted', 'attempted', 'completed', 'consequences']);
  for (let i = 1; i < oracle.history.length; i++) {
    assert.ok(oracle.history[i].tick > oracle.history[i - 1].tick);
    const event = state.events.find(e => e.id === oracle.history[i].eventId);
    assert.deepEqual(event.parents, [oracle.history[i - 1].eventId]);
    assert.ok(event.reason.length > 0);
  }
  assert.ok(oracle.progress >= oracle.target);
  assert.equal(Core.act(state, 'oracle', 'town-1').ok, true);
  assertValid(state);
});

test('weak faith can refuse an oracle instead of following a guaranteed command', () => {
  const state = make({ belief: 0 });
  Core.act(state, 'oracle', 'town-1'); Core.step(state, 45);
  const oracle = state.towns[0].oracle;
  assert.equal(oracle.stage, 'consequences');
  assert.equal(oracle.outcome, 'refused');
  assert.ok(oracle.history.some(h => h.stage === 'refused'));
  assert.ok(!oracle.history.some(h => h.stage === 'attempted'));
});

test('pressing needs can defer an oracle, and dry crops can defeat accepted intent', () => {
  const deferred = make({ belief: 0.8, moisture: 0, food: 0 });
  Core.act(deferred, 'oracle', 'town-1'); Core.step(deferred, 23);
  assert.equal(deferred.towns[0].oracle.stage, 'deferred');
  const dry = make({ belief: 0.8, moisture: 0, food: 200 });
  Core.act(dry, 'oracle', 'town-1'); Core.step(dry, 110);
  assert.equal(dry.towns[0].oracle.outcome, 'failed');
  assert.ok(dry.towns[0].oracle.history.some(h => h.stage === 'attempted'));
  assert.match(dry.towns[0].oracle.history.find(h => h.stage === 'failed').reason, /乾燥/);
});

test('autonomous weather produces visible drought and food pressure without player input', () => {
  const state = make();
  Core.step(state, 72);
  assert.equal(state.weather.kind, 'drought');
  assert.ok(state.events.some(e => e.type === 'weather' && e.text.includes('乾旱')));
  Core.step(state, 220);
  assert.ok(state.events.some(e => e.type === 'scarcity'));
  assert.ok(Core.stats(state).food < 60);
  assert.ok(state.towns.some(t => t.harvested > 0));
  assert.ok(state.people.some(p => p.x !== state.households.find(h => h.id === p.household).x));
  assertValid(state);
});

test('zero faith preserves a divine spark and an autonomous world with no game over', () => {
  const state = make({ belief: 0 });
  state.people.forEach(p => { p.faith = 0; });
  state.power = 0;
  assert.equal(Core.stats(state).followers, 0);
  assert.equal(Core.stats(state).devotion, 0);
  assert.ok(Core.stats(state).powerRate > 0);
  Core.step(state, 200);
  assert.ok(state.power > 0);
  assert.equal(state.tick, 200);
  assert.equal(state.people.length, 24);
  assertValid(state);
});

test('personal faith, follower threshold, devotion and power are distinct values', () => {
  const state = make();
  state.people.forEach(p => { p.faith = 0.34; p.task = 'resting'; });
  state.people[0].faith = 0.35;
  state.power = 12;
  const summary = Core.stats(state);
  assert.equal(summary.followers, 1);
  assert.equal(summary.power, 12);
  assert.ok(summary.devotion > 1 && summary.devotion < 12);
  assert.notEqual(summary.averageFaith, summary.devotion);
});

test('mid-action JSON saves continue deterministically, including RNG and active oracle', () => {
  const a = make();
  Core.act(a, 'oracle', 'town-1'); Core.act(a, 'rain', 'town-2'); Core.step(a, 15);
  const b = clone(a);
  assertValid(b);
  Core.step(a, 170); Core.step(b, 170);
  assert.deepEqual(a, b);
  assertValid(b);
});

test('history and action logs remain bounded while event identity stays monotonic', () => {
  const state = make();
  for (let i = 0; i < 140; i++) { state.power = 100; Core.act(state, 'rain', 'town-1'); }
  assert.equal(state.events.length, Core.MAX_EVENTS);
  assert.equal(state.actions.length, Core.MAX_ACTIONS);
  assert.ok(state.eventSeq > state.events.length);
  assert.equal(new Set(state.events.map(e => e.id)).size, state.events.length);
  assert.equal(new Set(state.actions.map(e => e.id)).size, state.actions.length);
  assert.equal(state.events.at(-1).seq, state.eventSeq);
  assert.equal(state.rainZones.length, 12);
  Core.step(state, 2000);
  assert.ok(state.events.length <= Core.MAX_EVENTS);
  assertValid(state);
});

test('save validation rejects corrupted and hostile-shaped data without throwing', () => {
  for (const input of [null, undefined, true, 42, 'save', [], {}, { version: 1 }]) {
    assert.equal(Core.validateSave(input).ok, false);
  }
  const corruptions = [
    s => { s.version = 999; }, s => { s.rng = Infinity; }, s => { s.power = -1; },
    s => { s.people[0] = null; }, s => { s.towns[0] = null; }, s => { s.households[0] = null; },
    s => { s.people[0].target = { x: NaN, y: 4 }; }, s => { s.people[0].lastSign = {}; }, s => { s.people[0].traits = null; },
    s => { s.tiles[0].kind = 'lava'; }, s => { s.tiles.pop(); }, s => { s.weather = null; },
    s => { s.events[0] = null; }, s => { s.events[1].seq = s.events[0].seq; },
    s => { s.towns[0].oracle = {}; }, s => { s.rainZones = [{}]; },
    s => { s.people[0].household = 'no-such-house'; }, s => { s.config.difficulty = 'impossible'; },
    s => { s.actions = [{}]; }, s => { s.time.tick = 20; }
  ];
  for (const corrupt of corruptions) {
    const state = make(); corrupt(state);
    assert.equal(Core.validateSave(state).ok, false);
  }
});

test('long-duration headless runs preserve numeric ranges and serializability', () => {
  for (const preset of ['valley', 'dry', 'islands']) {
    const state = make({ preset });
    Core.step(state, 3000);
    assertValid(state);
    assert.equal(state.people.length, 24);
    assert.ok(state.power >= 0 && state.power <= 100);
    assertValid(clone(state));
    assert.ok(state.towns.every(t => t.food >= 0));
  }
});

test('multiple visible miracles are witnessed once each rather than oscillating faith credit', () => {
  const state = make({ belief: 0.35 });
  Core.act(state, 'rain', 'town-1');
  state.power = 100;
  Core.act(state, 'rain', 'town-1');
  const people = state.people.filter(p => p.town === 'town-1');
  const initialFaith = people.map(p => p.faith);
  const rainIds = state.towns[0].signs.filter(s => s.type === 'rain').map(s => s.id);
  Core.step(state);
  assert.ok(people.every(p => p.lastSign === rainIds[0]));
  Core.step(state);
  assert.ok(people.every(p => p.lastSign === rainIds[1]));
  Core.step(state, 14);
  assert.ok(people.every(p => p.lastSign === rainIds[1]));
  people.forEach((p, i) => assert.ok(p.faith - initialFaith[i] <= 0.05 + 16 * 0.0006 + 1e-9));
  assertValid(state);
});

test('fractional in-bounds rain targets round-trip through save validation', () => {
  const state = make();
  assert.equal(Core.act(state, 'rain', { x: 39.5, y: 25.5 }).ok, true);
  assertValid(state);
  assertValid(clone(state));
});
