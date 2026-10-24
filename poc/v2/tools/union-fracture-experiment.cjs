'use strict';
// Local-only bounded natural A/B. Controlled cases are separate in union-fracture.test.cjs.
const W=require('../src/sim.js'),{options}=require('./diplomacy-experiment.cjs');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
const SEEDS=['valley-spring-01','dry-stress','opponent-competition-replay'];
function summary(s){const unions=s.politics.unions||[],shipments=s.politics.diplomacy.shipments;
  return {formed:unions.length,active:unions.filter(u=>!Number.isFinite(u.dissolvedAtHour)).length,
    exits:unions.filter(u=>u.dissolutionKind==='exit').length,breaches:unions.filter(u=>u.dissolutionKind==='breach').length,
    notices:unions.reduce((n,u)=>n+u.history.filter(e=>e.type==='exit-notice').length,0),
    retractions:unions.reduce((n,u)=>n+u.history.filter(e=>e.type==='notice-retracted').length,0),
    conflicts:s.politics.disputes.length,deliveredBatches:shipments.filter(q=>q.delivered).length,
    recalled:shipments.filter(q=>q.cancelReason).length,refunded:shipments.filter(q=>q.refunded).length};}
function run(seed,enabled,days=180){
  assert.ok(SEEDS.includes(seed));assert.ok(Number.isInteger(days)&&days>=1&&days<=180);
  const start=performance.now(),s=W.create(options(seed,true,true,enabled));
  const genesisHash=createHash('sha256').update(JSON.stringify({people:s.people,households:s.households,settlements:s.settlements})).digest('hex');
  const moments=[];
  for(let d=1;d<=days;d++){
    W.advanceTicks(s,3);assert.deepEqual(W.validate(s).errors,[],seed+' day '+d);
    if([30,60,120,180].includes(d))moments.push({day:d,...summary(s)});
  }
  const endpoint=JSON.parse(JSON.stringify(s)),copy=W.restore(JSON.stringify(s));assert.deepEqual(copy,s);
  W.advanceTicks(s,3);W.advanceTicks(copy,3);assert.deepEqual(s,copy);
  return {seed,fractureEnabled:enabled,days,genesisHash,elapsedMs:performance.now()-start,
    summary:summary(endpoint),moments,unions:endpoint.politics.unions,
    relations:endpoint.politics.diplomacy.relations,conflicts:endpoint.politics.disputes,
    shipments:endpoint.politics.diplomacy.shipments.map(({path,...q})=>({...q,pathCells:path.length})),
    stocks:endpoint.settlements.map(t=>({id:t.id,storage:t.storage})),
    validation:'every day W.validate; exact save roundtrip and next-day deterministic replay'};
}
if(require.main===module){const start=performance.now(),results=[];
  for(const seed of SEEDS){for(const enabled of [false,true]){const r=run(seed,enabled);results.push(r);console.log(seed,enabled?'fracture':'permanent-union',JSON.stringify(r.summary));}
    assert.equal(results.at(-1).genesisHash,results.at(-2).genesisHash);}
  const output=path.resolve(__dirname,'../reports/issue-14-union-fracture-2026-10-24.json');
  fs.writeFileSync(output,JSON.stringify({issue:14,baseCommit:'d20c2d3',node:process.version,
    elapsedMs:performance.now()-start,fractureProfile:require('../config/polity-command-v0.1.json').diplomacy.union.fracture,
    scope:'Natural 3-seed 180-day A/B; no manufactured contacts, people, faith, treaties or stock. Separate controlled tests cover breach and logistics.',results},null,2)+'\n');
  console.log(output);
}
module.exports={run,summary};
