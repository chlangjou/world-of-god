/**
 * Static formula calculation, not the game's production algorithm.
 * Usage: node tools/agriculture-balance-check.mjs [--json] [--check]
 * Requires only Node.js (>=18) and the existing browser-independent sim.js.
 */
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Game = require(resolve(root, 'sim.js'));
const baseline = JSON.parse(readFileSync(resolve(root, 'config/balance-default.json'), 'utf8'));
const candidate = JSON.parse(readFileSync(resolve(root, 'config/balance-agriculture-v0.1.json'), 'utf8'));

assert.deepEqual(Game.DEFAULT_RULES, baseline.rules, 'The reference baseline must match the actual sim.js DEFAULT_RULES');
assert.equal(candidate.loadedByRuntime, false, 'Candidate profile must remain experiment-only');

const clamp01 = x => Math.max(0, Math.min(1, x));
const round = (x, places = 2) => Number(x.toFixed(places));
function riverX(world, y) { return world.width * 0.46 + Math.sin(y * 0.17) * 4 + Math.sin(y * 0.052) * 5; }
function bankDistance(world, tile) { return Math.max(0, Math.abs(tile.x - riverX(world, tile.y)) - 1.6); }
function riverInfluence(d) {
  const {fullEffectThroughCells: inner, zeroEffectAtCells: outer, nearBankInfluence: power} = candidate.river;
  assert.ok(inner < outer && inner >= 0 && power >= 0 && power <= 1);
  return d <= inner ? power : d >= outer ? 0 : power * (outer - d) / (outer - inner);
}
function moisture(d, season) {
  const {backgroundMoisture: B, riverWaterAvailability: A} = candidate.seasons[season];
  return clamp01(B + (1 - B) * riverInfluence(d) * A);
}
function skillAfter(workdays) {
  const {startingSkillReference: initial, learningTimeConstantActualFoodWorkdays: tau} = candidate.worker;
  return 1 - (1 - initial) * Math.exp(-workdays / tau);
}
function reachablePlots(world) {
  return world.tiles.filter(t => t.terrain === 'field' && world.households.some(h => Math.abs(t.x - h.x) <= 9 && Math.abs(t.y - h.y) <= 9));
}
function seasonCapacity(world, season, workerSkill = skillAfter(1080), workforceShare = candidate.seasons[season].diagnosticFoodLaborShare) {
  const plots = reachablePlots(world), L = candidate.land, W = candidate.worker, C = candidate.calibration;
  assert.ok(plots.length > 0);
  let landCapacity = 0, weightedWetness = 0, fertilitySum = 0, moistureSum = 0;
  for (const cell of plots) {
    const m = moisture(bankDistance(world, cell), season), f = cell.fertility;
    landCapacity += L.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture * f * (m / L.referenceMoisture) ** L.moistureExponent;
    weightedWetness += f * (m / L.referenceMoisture) ** W.environmentMoistureExponent;
    fertilitySum += f;
    moistureSum += m;
  }
  const H = weightedWetness / fertilitySum;
  const skillFactor = W.skillOutputIntercept + W.skillOutputSlope * workerSkill;
  const workerDaily = W.foodUnitsPerFullWorkdayAt50PctSkillAndNeutralEnvironment * skillFactor * H;
  const laborCapacity = C.workCapableAdults * workforceShare * workerDaily;
  const foodProduced = Math.min(landCapacity, laborCapacity);
  const need = C.workCapableAdults * C.adultFoodNeedPerDay + C.dependents * C.dependentFoodNeedPerDay;
  assert.equal(C.population, C.workCapableAdults + C.dependents);
  assert.ok(Math.abs(need - C.totalFoodNeedPerDay) < 1e-8);
  return {
    season, plots:plots.length, avgFertility:round(fertilitySum/plots.length, 4),
    avgMoisture:round(moistureSum/plots.length, 4),
    landFoodPerDay:round(landCapacity, 3), landCoveragePct:round(100*landCapacity/need, 1),
    foodLaborSharePct:round(100*workforceShare,1), workerSkillPct:round(100*workerSkill,1),
    workerFoodPerWorkday:round(workerDaily,3), laborFoodPerDay:round(laborCapacity,3),
    sustainableFoodPerDay:round(foodProduced,3), sustainableCoveragePct:round(100*foodProduced/need,1),
    breakEvenFoodLaborSharePct:round(100*need/(C.workCapableAdults*workerDaily),1)
  };
}
function mean(a) { return a.reduce((s,x) => s + x, 0)/a.length; }
const seeds = ['calm-river','valley-spring-01','river-dawn-01','test-seed'];
const cases = seeds.flatMap(seed => {
  const world=Game.create({seed});
  return ['rain','mild','dry'].map(season => ({seed, ...seasonCapacity(world,season)}));
});
const sample = cases.filter(r => r.seed === 'calm-river');
const extra = Array.from({length:40},(_,i)=>`balance-map-${String(i).padStart(2,'0')}`);
const extraRows = extra.flatMap(seed => {
  const world=Game.create({seed});
  return ['rain','mild','dry'].map(season => ({seed, ...seasonCapacity(world,season)}));
});
const seasonSummary = Object.fromEntries(['rain','mild','dry'].map(season => {
  const seasonRows=extraRows.filter(r=>r.season===season);
  return [season, {
    landCoverageAvgPct:round(mean(seasonRows.map(r=>r.landCoveragePct)),1),
    landCoverageMinPct:round(Math.min(...seasonRows.map(r=>r.landCoveragePct)),1),
    landCoverageMaxPct:round(Math.max(...seasonRows.map(r=>r.landCoveragePct)),1),
    plotCountMin:Math.min(...seasonRows.map(r=>r.plots)), plotCountMax:Math.max(...seasonRows.map(r=>r.plots))
  }];
}));

assert.equal(riverInfluence(5), 0.95);
assert.equal(riverInfluence(15), 0);
assert.equal(riverInfluence(10), 0.475);
assert.ok(Math.abs(skillAfter(1080) - 0.923) < 0.003);
assert.equal(sample[0].plots, 118);
if (process.argv.includes('--check')) {
  const expected = {rain:143.8, mild:110.9, dry:70.2};
  for (const r of sample) assert.ok(Math.abs(r.landCoveragePct-expected[r.season]) <= 0.25, `Unexpected ${r.season} land coverage`);
  const expectedMeans={rain:151,mild:117,dry:74};
  for (const s of ['rain','mild','dry']) assert.ok(Math.abs(seasonSummary[s].landCoverageAvgPct-expectedMeans[s])<3,`Unexpected ${s} 40-map mean`);
}
const output={kind:'candidate-analytical-capacity-only',sourceSimulatorVersion:Game.VERSION,profileId:candidate.profileId,
  populationDemandPerDay:candidate.calibration.totalFoodNeedPerDay,
  experience:{at0:round(100*skillAfter(0),1),at360:round(100*skillAfter(360),1),at720:round(100*skillAfter(720),1),at1080:round(100*skillAfter(1080),1)},
  seedCases:cases, additionalSeedCount:extra.length, additionalSeedSummary:seasonSummary};
if (process.argv.includes('--json')) console.log(JSON.stringify(output,null,2));
else {
  console.log(`PoC agriculture candidate: ${output.profileId}; actual gameplay unchanged`);
  console.log(`Daily need=${output.populationDemandPerDay}, farm-workday skill:`,output.experience);
  console.table(cases.map(r=>({seed:r.seed,season:r.season,plots:r.plots,landPct:r.landCoveragePct,workerDay:r.workerFoodPerWorkday,laborPct:r.foodLaborSharePct,actualPct:r.sustainableCoveragePct})));
  console.table(seasonSummary);
  console.log('This estimates equilibrium capacity, not actual dynamic game harvest.');
}
