'use strict';
const E=require('./religion-politics-causality.cjs'),W=require('../src/sim.js'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),overlay=require('../config/religious-diplomacy-identity-v0.1.json');
if(require.main===module){const start=performance.now(),results=[];
  for(const seed of E.SEEDS){const source=JSON.stringify(W.restore(JSON.stringify(E.fresh(seed)))),baseHash=E.hash(source);
    for(const arm of ['passive','both']){const s=W.restore(source);
      assert.equal(E.hash(s),baseHash);s.politics.diplomacy.identity20Enabled=overlay.identity20Enabled;
      const r=E.run(JSON.stringify(s),arm,180);r.unmodifiedSourceHash=baseHash;results.push(r);
      console.log(seed,arm,JSON.stringify(r.summary));}}
  const out=path.resolve(__dirname,'../reports/issue-14-religious-identity-ab-2026-10-24.json');
  E.writeReport({issue:14,node:process.version,baseCommit:'dfab2d4',elapsedMs:performance.now()-start,
    overlay,comparison:'compare legacy report same seed/arm/source; only identity20Enabled changes; coefficients untouched',results},out);console.log(out);
}
