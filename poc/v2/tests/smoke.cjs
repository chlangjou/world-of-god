'use strict';
const W=require('../src/sim.js'), profile=require('../config/balance-agriculture-v0.1.json');
const rows=[];
for(const [name,config] of [['Original',{seed:'valley-spring-01'}],
 ['Agriculture v0.1',{seed:'valley-spring-01',balanceProfile:profile}]]){
 const world=W.create(config);
 W.advanceTicks(world,400*3);
 const start=W.stats(world),oracle=W.issueOracle(world,{intentType:'food.produce'});
 const rain=W.castRain(world,{x:world.camp.x,y:world.camp.y,radius:8,intensity:1,durationDays:14});
 W.advanceTicks(world,45*3);
 const finish=W.stats(world);
 const pass=start.settlements>0&&!!start.saintId&&oracle.ok&&rain.ok&&
   finish.people>0&&W.validate(world).ok&&
   world.balanceProfileId===(config.balanceProfile?.profileId||'original');
 rows.push({name,pass,people:finish.people,settlements:finish.settlements,oracle:oracle.ok,rain:rain.ok});
}
console.log(JSON.stringify(rows,null,2));
if(rows.some(row=>!row.pass))process.exitCode=1;
