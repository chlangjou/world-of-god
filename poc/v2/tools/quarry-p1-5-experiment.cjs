'use strict';
// Manual-only bounded natural A/B. Never added to GitHub CI.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const W=require('../src/sim.js');
const Core=require('./mineral-natural-core.js');
const {options}=require('./mineral-natural-experiment.cjs');
const SEEDS=Core.SEEDS,MODES=['finite-rights','finite-rights-p1-5'];
function execute(seeds=SEEDS,days=180){
  assert.ok(Core.SNAPSHOTS.includes(days)&&seeds.length&&
    seeds.every(s=>SEEDS.includes(s)),'bounded days and known seeds only');
  const cases=[];
  for(const seed of seeds){
    const pair=MODES.map(mode=>Core.run(W,W.create(options(seed,mode)),mode,days));
    assert.equal(pair[0].commonGenesisHash,pair[1].commonGenesisHash);
    const a=pair[0].snapshots.at(-1),b=pair[1].snapshots.at(-1);
    cases.push({seed,commonGenesisHash:pair[0].commonGenesisHash,
      noPolicy:pair[0],p15:pair[1],differences:{
        stoneDeliveredToPublic:b.publicStone-a.publicStone,
        extracted:b.stoneMined-a.stoneMined,
        claims:b.declarations-a.declarations,
        alternativeOreDelivered:b.alternativeOreUnitsDelivered-a.alternativeOreUnitsDelivered,
        accessGrants:b.accessGrants-a.accessGrants,
        actualChallenges:b.actualChallenges-a.actualChallenges,
        oldBattles:b.conflicts-a.conflicts}});
  }
  return {issue:14,stage:'P1.5',experiment:'matched unmodified naturally evolving worlds',
    implementation:'same World of God v2 sim.js UMD kernel, Node24 manually runnable',
    node:process.version,days,seeds,modes:MODES,subject:'actual quarry delivery, local guard, access trust, resident resistance',
    noArtificialGodOrders:true,noArtificialStocks:true,noArtificialPopulation:true,
    limitations:['Selection/delivery and negotiation are separate measured events',
      'Challenge warnings do not start territorial wars; that is deferred to P2',
      'Identical initial world does not guarantee identical subsequent RNG trajectories'],
    cases};
}
if(require.main===module){
  const args=process.argv.slice(2);
  assert.ok(args.every(v=>v.startsWith('--days=')||v.startsWith('--seed=')),'only --days and --seed permitted');
  const days=Number(args.find(v=>v.startsWith('--days='))?.slice(7)||'180');
  const seed=args.find(v=>v.startsWith('--seed='))?.slice(7)||'all';
  assert.ok(Core.SNAPSHOTS.includes(days)&&
    (seed==='all'||SEEDS.includes(seed)));
  const start=Date.now(),report=execute(seed==='all'?SEEDS:[seed],days);
  report.elapsedMs=Date.now()-start;
  const target=path.resolve(__dirname,'../reports/issue-14-quarry-p1-5-2026-10-24.json');
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  for(const c of report.cases)console.log(c.seed,JSON.stringify(c.differences));
  console.log(target);
}
module.exports={execute,SEEDS,MODES};
