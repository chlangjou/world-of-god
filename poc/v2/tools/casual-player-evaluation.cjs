'use strict';
// Reproducible *behavioral proxy*, not an actual recorded player or browser bot.
// Models partial observation via existing UI-visible projection functions, rarely
// inspecting one village and optionally one visible resident. It neither runs
// a world-state optimizer nor waits for cooldown, quota or AI decision dates.
const W=require('../src/sim.js');
const agriculture=require('../config/balance-agriculture-v0.1.json');
const religion=require('../config/religion-propagation-v0.1.json');
const divine=require('../config/divine-powers-v0.1.json');
const opponent=require('../config/opponent-v0.2.json');

function fnv(s){
  let v=2166136261;
  for(const c of String(s)){v^=c.charCodeAt(0);v=Math.imul(v,16777619);}
  return v>>>0||1;
}
function casualPlayer({seed='valley-spring-01',playerSeed=1,
  secondsPerDay=2,minSessionSeconds=75,maxSessionSeconds=185,
  durationDays=360,difficulty='standard',passive=false,style='balanced'}={}){
  const styles={
    wandering:{look:.34,oracle:.12,spread:.45,need:.35},
    balanced:{look:.19,oracle:.23,spread:.55,need:.45},
    missionary:{look:.19,oracle:.36,spread:.85,need:.42}
  };
  const tendency=styles[style]||styles.balanced;
  const s=W.create({seed,balanceProfile:agriculture,religionProfile:religion,
    divineProfile:divine,opponentProfile:{...opponent,difficulty}});
  let rng=fnv(seed+'|human|'+playerSeed),events=[],inspections=0,
    tries=0,casts=0,oracles=0,successful=0,clicks=0;
  const rand=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};
  const choice=xs=>xs[Math.min(xs.length-1,Math.floor(rand()*xs.length))];
  const roll=p=>rand()<p;
  const wait=()=>minSessionSeconds+rand()*(maxSessionSeconds-minSessionSeconds);
  let nextDay=Math.max(1,Math.round(wait()/secondsPerDay));
  const record=day=>{
    const st=W.stats(s);
    return {day,player:st.believers,ai:st.opponentBelievers,
      neutral:st.unaffiliated,playerCore:st.followers,aiCore:st.opponentFollowers,
      aiTurns:s.opponent.turns,aiCasts:s.opponent.casts};
  };
  const milestones=[record(0)];
  for(let day=1;day<=durationDays;day++){
    W.advanceTicks(s,3);
    if(day%90===0)milestones.push(record(day));
    if(passive||day<nextDay)continue;
    tries++;
    // One village selected via the visible map/settlement dropdown. No scan of
    // all settlements' religion or all persons' health for the best possible cast.
    const natives=s.settlements.filter(v=>v.native);
    const town=natives.length?choice(natives):s.settlements[0]||null;
    const townInfo=town?W.settlementReligionStats(s,town.id):null;
    let seen=null;
    if(town){
      inspections++;clicks+=2; // open/select/read one settlement
      if(roll(.42)){
        const markers=s.people.filter(p=>p.alive&&Math.hypot(p.x-town.x,p.y-town.y)<=5.5);
        if(markers.length){seen=choice(markers);clicks+=2;inspections++;}
      }
    }
    // Reading a state without issuing a command is a legitimate sandbox turn.
    if(roll(tendency.look)){events.push({day,action:'look'});nextDay=day+Math.max(1,Math.round(wait()/secondsPerDay));continue;}
    const prayerList=s.religion.prayers.filter(p=>p.status==='open').slice(-3);
    const need=prayerList.length&&roll(tendency.need)?choice(prayerList):null;
    if(need){inspections++;clicks+=2;} // needs tab and a single prayer card
    if(roll(tendency.oracle)){
      const saint=s.religion.saints[0]; // visible in the Saint dropdown
      const want=roll(tendency.spread)?'religion.spread':'food.produce';
      const result=W.issueOracle(s,{saintId:saint,intentType:want,durationDays:180});
      clicks+=4;oracles+=Number(result.ok);successful+=Number(result.ok);
      events.push({day,action:'oracle:'+want,ok:result.ok});
    }else{
      let type;
      if(need&&roll(.72)){
        type=need.type==='food-water'?'rain':
          need.type==='healing'?'heal':
          need.type==='food-shortage'?'ripening':'efficiency';
      }else if(seen&&seen.health<75&&roll(.7))type='heal';
      else {
        // The player has recognizable preferences but no miracle-utility score.
        type=choice(['ripening','efficiency','rain','harvest','ripening',
          'efficiency','heal','harvest','rain']);
      }
      let dest;
      if(need&&roll(.68))dest=need.center;
      else if(type==='efficiency'&&roll(.72))dest=s.camp;
      else if(type==='heal'&&seen&&roll(.8))dest=seen;
      else if(roll(.3))dest=s.camp;
      else dest=town||s.camp;
      const dt=roll(.28)?Math.round((rand()-.5)*3):0;
      const cx=Math.max(1,Math.min(s.width-2,dest.x+dt)),cy=Math.max(1,Math.min(s.height-2,dest.y+dt));
      const args={x:cx,y:cy,radius:type==='heal'?5:7,
        intensity:type==='rain'?.85:1,durationDays:type==='rain'?9:12};
      // Never pre-query readyAtHour, AI turn date or all visible crop tiles.
      const result=W.castMiracle(s,type,args);
      clicks+=4+(roll(.28)?2:0);casts+=Number(result.ok);
      successful+=Number(result.ok);
      events.push({day,action:'miracle:'+type,ok:result.ok});
    }
    nextDay=day+Math.max(1,Math.round(wait()/secondsPerDay));
  }
  const end=record(durationDays);
  return {seed,playerSeed,secondsPerDay,passive,style,days:durationDays,
    sessions:tries,clicks,inspections,successful,casts,oracles,
    end,lead:end.player-end.ai,
    close:Math.abs(end.player-end.ai)<=10,
    playerAhead:end.player>end.ai,
    milestones,events};
}
module.exports={casualPlayer};
