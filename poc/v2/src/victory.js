/* Victory v0.1: deterministic religious dominance, independent of rendering and AI.
   All thresholds are shares of living people's existing faithfulWeight, not headcount. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WoGVictory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PROFILE_ID='victory-dominance-v0.1';
  const DEFAULT_TIERS=Object.freeze([
    {margin:.10,days:3600,label:'55% / 10 年（雙神基準）'},
    {margin:.30,days:1800,label:'65% / 5 年（雙神基準）'},
    {margin:.40,days:720,label:'70% / 2 年（雙神基準）'},
    {margin:.80,days:30,label:'90% / 1 個月（雙神基準）'}
  ]);
  function normalize(profile,godCount=2){
    const valid=profile?.profileId===PROFILE_ID;
    const requested=valid?(profile.tiersByGodCount?.[godCount]||profile.tiers):null;
    return {profileId:PROFILE_ID,tiers:DEFAULT_TIERS.map((d,i)=>{
      const r=Array.isArray(requested)?requested[i]:null;
      const margin=Number.isFinite(r?.margin)?r.margin:d.margin;
      const days=Number.isFinite(r?.days)?r.days:d.days;
      return {margin:Math.max(0,Math.min(.999,margin)),
        days:Math.max(1,Math.round(days)),label:d.label,
        ...(Number.isFinite(r?.share)?{share:Math.max(0,Math.min(1,r.share))}:{}),
        ...(Number.isFinite(r?.minimumLeadShare)?{
          minimumLeadShare:Math.max(0,Math.min(1,r.minimumLeadShare))}:{})};
    })};
  }
  function registered(s){
    const additional=Array.isArray(s.additionalReligions)?s.additionalReligions:[];
    const roots=[s.religion,s.opponent?.enabled?s.opponentReligion:null,...additional];
    const seen=new Set();
    return roots.filter(f=>{
      if(!f?.id||!f.godId||seen.has(f.id))return false;
      seen.add(f.id);return true;
    }).map(f=>({id:f.id,godId:f.godId,name:f.name||f.id}));
  }
  function reset(s,weight,profile){
    const contestants=registered(s);
    s.victory={version:1,profile:normalize(profile,contestants.length),
      contestants,starts:Object.fromEntries(contestants.map(f=>
        [f.id,DEFAULT_TIERS.map(()=>null)])),
      winner:null,continued:false};
    // Count qualification from the exact moment this playable world's setup ends.
    if(contestants.length>=2)update(s,weight);
    return s.victory;
  }
  function ensure(s,weight){
    const v=s.victory;
    if(!v||v.version!==1||!Array.isArray(v.contestants)||
       !v.profile||!Array.isArray(v.profile.tiers)||
       !v.starts||typeof v.starts!=='object')return reset(s,weight);
    return v;
  }
  function compute(s,weight,v){
    const contestants=v.contestants;
    const sum=Object.fromEntries(contestants.map(f=>[f.id,0]));
    for(const p of s.people||[]){
      if(!p.alive||!Object.hasOwn(sum,p.religionId))continue;
      const w=weight(p.devotion);
      if(Number.isFinite(w)&&w>0)sum[p.religionId]+=w;
    }
    const total=Object.values(sum).reduce((a,b)=>a+b,0);
    const teams=contestants.map(f=>({...f,weight:sum[f.id],
      share:total?sum[f.id]/total:0}));
    const sorted=[...teams].sort((a,b)=>b.weight-a.weight||
      a.id.localeCompare(b.id));
    const leader=total>0&&sorted[0]?.weight>sorted[1]?.weight?
      sorted[0]:null;
    return {teams,total,leader,contestants:contestants.length};
  }
  function threshold(n,margin){
    return n>1?1/n+(1-1/n)*margin:Infinity;
  }
  function qualification(computed,faith,t){
    const share=computed.teams.find(f=>f.id===faith.id)?.share||0;
    const runnerUpShare=Math.max(0,...computed.teams.filter(f=>f.id!==faith.id).map(f=>f.share));
    const minimum=Number.isFinite(t.share)?t.share:threshold(computed.contestants,t.margin);
    const minimumLeadShare=t.minimumLeadShare||0;
    return {minimum,minimumLeadShare,leadShare:share-runnerUpShare,
      eligible:computed.leader?.id===faith.id&&share+1e-12>=minimum&&
        share-runnerUpShare+1e-12>=minimumLeadShare};
  }
  function update(s,weight){
    const v=ensure(s,weight);
    if(v.winner||v.contestants.length<2)return null;
    const computed=compute(s,weight,v);
    const hour=s.hour;
    const tiers=v.profile.tiers;
    for(const faith of v.contestants){
      const row=Array.isArray(v.starts[faith.id])?
        v.starts[faith.id]:(v.starts[faith.id]=tiers.map(()=>null));
      const share=computed.teams.find(t=>t.id===faith.id)?.share||0;
      for(let i=0;i<tiers.length;i++){
        const t=tiers[i],q=qualification(computed,faith,t),min=q.minimum;
        const qualified=q.eligible;
        if(!qualified){row[i]=null;continue;}
        if(!Number.isSafeInteger(row[i])||row[i]>hour||row[i]<0)row[i]=hour;
        if(hour-row[i]>=t.days*24){
          v.winner={religionId:faith.id,godId:faith.godId,name:faith.name,
            tier:i,share,hour,threshold:min,requiredDays:t.days,
            totalWeight:computed.total,minimumLeadShare:q.minimumLeadShare};
          return v.winner;
        }
      }
    }
    return null;
  }
  function overview(s,weight){
    const v=ensure(s,weight),computed=compute(s,weight,v);
    const rows=computed.teams.map(f=>({
      ...f,leading:computed.leader?.id===f.id,
      tiers:v.profile.tiers.map((t,i)=>{
        const q=qualification(computed,f,t),minimum=q.minimum;
        const since=v.starts[f.id]?.[i];
        const eligible=q.eligible;
        const elapsed=eligible&&Number.isSafeInteger(since)?
          Math.max(0,(s.hour-since)/24):0;
        return {threshold:minimum,requiredDays:t.days,
          minimumLeadShare:q.minimumLeadShare,leadShare:q.leadShare,
          elapsedDays:elapsed,remainingDays:Math.max(0,t.days-elapsed),
          qualified:eligible,sinceHour:eligible?since:null,label:t.label};
      })
    }));
    return {enabled:computed.contestants>=2,contestants:computed.contestants,
      totalWeight:computed.total,leaderId:computed.leader?.id||null,
      teams:rows,winner:v.winner,continued:!!v.continued};
  }
  function continueAfterVictory(s){
    if(!s.victory?.winner)return false;
    s.victory.continued=true;
    return true;
  }
  return {PROFILE_ID,DEFAULT_TIERS,normalize,registered,reset,ensure,update,
    threshold,overview,continueAfterVictory};
});
