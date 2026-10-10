/**
 * Tiny crop-stock conservation / seasonal moisture lag test, independent of the game.
 * Usage: node tools/agriculture-climate-check.mjs [--check] [--json]
 * NOTE: climate timings and two-day crop-stock cap are exploratory, not adopted gameplay rules.
 */
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Game = require(resolve(root,'sim.js'));
const C = JSON.parse(readFileSync(resolve(root,'config/balance-agriculture-v0.1.json'),'utf8'));
const world = Game.create({seed:C.calibration.referenceSeed});
const fields = world.tiles.filter(t=>t.terrain==='field');
const clamp01 = x=>Math.max(0, Math.min(1, x));
const rx = y=>world.width*.46 + Math.sin(y*.17)*4 + Math.sin(y*.052)*5;
const river = d => d<=C.river.fullEffectThroughCells?C.river.nearBankInfluence :
  d>=C.river.zeroEffectAtCells?0:C.river.nearBankInfluence*(C.river.zeroEffectAtCells-d)/(C.river.zeroEffectAtCells-C.river.fullEffectThroughCells);
const targetWet=(p,season)=>{
  const {backgroundMoisture:b,riverWaterAvailability:a}=C.seasons[season];
  return clamp01(b+(1-b)*river(p.distance)*a);
};
const matureSkill=1-(1-C.worker.startingSkillReference)*Math.exp(-1080/C.worker.learningTimeConstantActualFoodWorkdays);
const skillCoeff=C.worker.skillOutputIntercept + C.worker.skillOutputSlope*matureSkill;
const q=C.land.foodUnitsPerPlotPerDayAtFullFertilityAnd90PctMoisture;
const refWet=C.land.referenceMoisture;
const demand=C.calibration.totalFoodNeedPerDay;
const pattern={
  current:d=>{d%=160;return d>=14&&d<=29?'dry':d<6||d>=32&&d<40||d>=68&&d<75?'rain':'mild';},
  long:d=>{d%=160;return d<40?'rain':d>=140?'dry':'mild';}
};
function run(kind,tau=3){
  const plots=fields.map(t=>({
    f:t.fertility, distance:Math.max(0,Math.abs(t.x-rx(t.y))-1.6), m:0, stock:0,
    cap:q*t.fertility*(1/refWet)**C.land.moistureExponent*2
  }));
  for(const p of plots)p.m=targetWet(p,'mild');
  const buckets={rain:[],mild:[],dry:[]};
  let regenSum=0,discardedSum=0,harvestSum=0;
  for(let day=0;day<800;day++){
    const season=pattern[kind](day);
    let available=0,weighted=0,fertility=0;
    for(const p of plots){
      p.m+=(1-Math.exp(-1/tau))*(targetWet(p,season)-p.m);
      const add=q*p.f*(p.m/refWet)**C.land.moistureExponent;
      regenSum+=add;
      const total=p.stock+add;
      p.stock=Math.min(total,p.cap);
      discardedSum+=total-p.stock;
      available+=p.stock;
      weighted+=p.f*(p.m/refWet)**C.worker.environmentMoistureExponent;
      fertility+=p.f;
    }
    const workerDay=C.worker.foodUnitsPerFullWorkdayAt50PctSkillAndNeutralEnvironment*skillCoeff*weighted/fertility;
    const labor=C.calibration.workCapableAdults*C.seasons[season].diagnosticFoodLaborShare*workerDay;
    const collected=Math.min(available,labor);
    for(const p of plots)p.stock-=available>0?collected*p.stock/available:0;
    harvestSum+=collected;
    if(day>=640)buckets[season].push(collected);
  }
  const endStock=plots.reduce((sum,p)=>sum+p.stock,0);
  const balanceError=regenSum-discardedSum-harvestSum-endStock;
  assert.ok(Math.abs(balanceError)<1e-6,'Crop stock conservation failed');
  return {pattern:kind,soilResponseTauDays:tau,plotCount:plots.length,
    ...Object.fromEntries(Object.entries(buckets).map(([s,arr])=>[s+'CoveragePct',+(100*arr.reduce((a,b)=>a+b,0)/arr.length/demand).toFixed(1)])),
    massBalanceError:balanceError};
}
const result=['current','long'].flatMap(p=>[1,3,5].map(t=>run(p,t)));
if(process.argv.includes('--check')) {
  const short3=result.find(x=>x.pattern==='current'&&x.soilResponseTauDays===3);
  const short5=result.find(x=>x.pattern==='current'&&x.soilResponseTauDays===5);
  assert.ok(short3.rainCoveragePct>100 && short3.rainCoveragePct<130);
  assert.ok(short5.rainCoveragePct<100 && short5.rainCoveragePct>75);
}
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else {console.table(result);console.log('Micro-model only: rainfall spell lengths, crop-stock cap and soil lag are NOT gameplay settings.');}
