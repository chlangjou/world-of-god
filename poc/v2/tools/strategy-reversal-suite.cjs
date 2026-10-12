'use strict';
// Optional local machine runner for P0 then P1. Each case is a DIFFERENT Node
// subprocess with an enforced 12-second wall timeout and a 512MB V8 heap cap.
// Completed cases are immediately persisted as compact JSONL; no large output,
// no LLM or per-tick reasoning. Stop on first failure/timeout.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const worker=path.resolve(__dirname,'strategy-reversal-evaluation.cjs');
const output=path.resolve(__dirname,'../reports/strategy-reversal-p0-p1.jsonl');
const steps=[
  {phase:'P0',seed:'dry-stress',strategy:'passive',days:90},
  ...['dry-stress','opponent-competition-replay'].flatMap(seed=>
    ['passive','missionary','development','intervention'].map(strategy=>
      ({phase:'P1',seed,strategy,days:180})))
];
const hardTimeoutMs=12000;
function executeOne(step){
  const argv=['--max-old-space-size=512',worker,
    '--seed',step.seed,'--strategy',step.strategy,
    '--days',String(step.days),'--budget-ms',String(hardTimeoutMs)];
  const r=spawnSync(process.execPath,argv,{
    cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:hardTimeoutMs,
    maxBuffer:256*1024,killSignal:'SIGKILL',windowsHide:true
  });
  if(r.error||r.status!==0)throw Error(
    'Case '+step.phase+'/'+step.seed+'/'+step.strategy+
    ' failed: '+(r.error?.message||r.stderr||('exit status '+r.status)));
  const result=JSON.parse(r.stdout.trim());
  if(result.aborted||!result.valid||result.completedDays!==step.days)
    throw Error('Case incomplete or invalid: '+JSON.stringify(step));
  return result;
}
function suite(){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,'');
  let totalMs=0;
  for(const [index,step] of steps.entries()){
    const result=executeOne(step);
    totalMs+=result.elapsedMs;
    fs.appendFileSync(output,JSON.stringify({phase:step.phase,...result})+'\n');
    console.log(JSON.stringify({completed:index+1,total:steps.length,
      phase:step.phase,seed:step.seed,strategy:step.strategy,
      elapsedMs:result.elapsedMs,player:result.final.player,ai:result.final.ai}));
  }
  console.log(JSON.stringify({status:'PASS',cases:steps.length,totalMs,
    output,notes:'one persisted line per completed child; no raw world output'}));
  return {cases:steps.length,totalMs,output};
}
if(require.main===module){
  try{suite()}catch(e){console.error('ABORTED: '+e.message);
    console.error('Completed results remain at '+output);
    process.exitCode=2;}
}
module.exports={steps,executeOne,suite,hardTimeoutMs};
