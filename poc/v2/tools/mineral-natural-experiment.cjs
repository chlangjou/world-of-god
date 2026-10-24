'use strict';
// Bounded, manual-only runner. GitHub CI never executes this 30-180 day sweep.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const Core=require('./mineral-natural-core.js');
const Mobility=require('../config/mobility-contact-v0.1.json');
const Experiment=require('../config/mineral-rights-experiment-v0.1.json');
const Politics=require('../config/polity-command-v0.1.json');
const Agriculture=require('../config/balance-agriculture-v0.1.json');
const Opponent=require('../config/opponent-v0.2.json');
const Religion=require('../config/religion-propagation-v0.1.json');
const Divine=require('../config/divine-powers-v0.1.json');
const Oracle=require('../config/oracle-specialization-v0.1.json');
const Shrine=require('../config/shrine-temple-v0.1.json');

function options(seed,mode){
  assert.ok(Core.SEEDS.includes(seed),'only reproducible named seeds');
  assert.ok(Core.MODES.includes(mode),'unknown mode');
  const finite=mode!=='legacy',rights=mode==='finite-rights';
  return {seed,balanceProfile:Agriculture,opponentProfile:Opponent,
    religionProfile:Religion,divineProfile:Divine,
    oracleStrategyProfile:Oracle,shrineProfile:Shrine,
    mobilityProfile:{...Mobility,...(finite?{
      finiteMineralsEnabled:true,
      naturalStoneCapacity:Experiment.naturalStoneCapacity,
      naturalStoneRegenPerDay:Experiment.naturalStoneRegenPerDay,
      naturalGoldCapacity:Experiment.naturalGoldCapacity,
      naturalGoldRegenPerDay:Experiment.naturalGoldRegenPerDay
    }:{})},
    politicsProfile:{...Politics,...(rights?{mineralRights:Experiment.mineralRights}:{})}
  };
}
function execute({days=180,seeds=Core.SEEDS,modes=Core.MODES}={}){
  assert.ok(Core.SNAPSHOTS.includes(days),'bounded 30/60/120/180 days only');
  assert.ok(seeds.length>0&&seeds.every(s=>Core.SEEDS.includes(s)));
  assert.ok(modes.length>0&&modes.every(m=>Core.MODES.includes(m)));
  const results=[];
  for(const seed of seeds)for(const mode of modes){
    const world=W.create(options(seed,mode));
    results.push(Core.run(W,world,mode,days));
  }
  for(const seed of seeds){
    const group=results.filter(r=>r.seed===seed);
    assert.equal(new Set(group.map(r=>r.commonGenesisHash)).size,1,
      'matched seed must use the same initial people, terrain and household geometry');
  }
  return {issue:14,
    category:'matched natural world; no God casts or artificial stock, people or political inputs',
    model:'actual World of God v2 runtime',node:process.version,
    seedCount:seeds.length,days,profiles:{
      naturalStoneCapacity:Experiment.naturalStoneCapacity,
      naturalStoneRegenPerDay:Experiment.naturalStoneRegenPerDay,
      naturalGoldCapacity:Experiment.naturalGoldCapacity,
      naturalGoldRegenPerDay:Experiment.naturalGoldRegenPerDay,
      mineralRights:Experiment.mineralRights},
    results};
}
if(require.main===module){
  const args=process.argv.slice(2),arg=(name,def)=>{
    const hit=args.filter(a=>a.startsWith(name+'='));
    assert.ok(hit.length<=1,'duplicate argument '+name);
    return hit.length?hit[0].slice(name.length+1):def;
  };
  assert.ok(args.every(a=>a.startsWith('--days=')||a.startsWith('--seed=')),
    'only --days and --seed are supported');
  const days=Number(arg('--days','180')),seed=arg('--seed','all');
  assert.ok(Core.SNAPSHOTS.includes(days));
  assert.ok(seed==='all'||Core.SEEDS.includes(seed));
  const begin=Date.now(),out=execute({days,seeds:seed==='all'?Core.SEEDS:[seed]});
  out.elapsedMs=Date.now()-begin;
  const dest=path.join(__dirname,'../reports/issue-14-mineral-natural-2026-10-24.json');
  fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n','utf8');
  for(const item of out.results){
    console.log(item.seed,item.mode,JSON.stringify(item.snapshots.map(s=>({
      day:s.day,stoneAvailable:s.stoneAvailable,stoneMined:s.stoneMined,
      sharedMines:s.sharedMines,declarations:s.declarations,
      guardedClaims:s.guardedClaims,quarryDetours:s.quarryDetours,conflicts:s.conflicts
    }))));
  }
  console.log('report:',dest,'elapsedMs:',out.elapsedMs);
}
module.exports={options,execute};
