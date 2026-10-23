'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/sim.js');
const Politics=require('../src/politics.js');
const Agriculture=require('../config/balance-agriculture-v0.1.json');
const Mobility=require('../config/mobility-contact-v0.1.json');
const Shrine=require('../config/shrine-temple-v0.1.json');
const Opponent=require('../config/opponent-v0.2.json');
const Profile=require('../config/polity-command-v0.1.json');
const clone=value=>JSON.parse(JSON.stringify(value));
function options(extra={}){
  return {seed:'valley-spring-01',balanceProfile:Agriculture,opponentProfile:Opponent,
    // Short deterministic checks; preserve actual mapped quarries and route geometry.
    mobilityProfile:{...Mobility,tripChancePerDay:0,
      missionBaseChancePerDay:0,missionSpreadChancePerDay:0},
    shrineProfile:Shrine,...extra};
}
function world(extra={},config={}){
  return W.create(options({politicsProfile:{...Profile,...extra},...config}));
}
const days=(s,n)=>W.advanceTicks(s,n*3);
const good=s=>assert.deepEqual(W.validate(s).errors,[]);
const polityOf=(s,id)=>s.politics.polities.find(p=>p.townId===id);
const townOf=(s,p)=>s.settlements.find(t=>t.id===p.townId);

test('disabled polity profile does not mutate legacy worlds or old save behavior',()=>{
  const a=W.create(options()),b=W.create(options({politicsProfile:{...Profile,enabled:false}}));
  assert.equal(Object.hasOwn(a,'politics'),false);
  assert.deepEqual(a,b);
  days(a,5);days(b,5);
  assert.deepEqual(a,b);
  good(a);
});

test('independent polities elect real adults; each militia soldier stops ordinary work',()=>{
  const s=world();
  assert.equal(s.politics.enabled,true);
  days(s,2);
  assert.ok(s.politics.polities.length>=3);
  for(const p of s.politics.polities){
    const town=townOf(s,p),people=s.people.filter(q=>q.alive&&
      town.householdIds.includes(q.householdId));
    assert.ok(people.some(q=>q.id===p.leaderId&&q.stage==='adult'));
    assert.ok(p.militia.memberIds.length>=1);
    assert.ok(p.militia.memberIds.every(id=>people.some(q=>q.id===id&&q.stage==='adult')));
    assert.ok(!p.militia.memberIds.includes(p.leaderId));
    assert.ok(p.militia.memberIds.every(id=>
      s.people.find(q=>q.id===id).activity==='guard'));
  }
  good(s);
});

test('human watchtower consumes stock and real construction time; only command bonus is halved',()=>{
  const s=world();
  const town=s.settlements[0];
  town.storage.wood=20;town.storage.stone=15;town.storage.food=500;
  const [wood,stone]=[town.storage.wood,town.storage.stone];
  Politics.daily(s,()=>{},W.die); // deterministic isolated subsystem pulse before other workers gather
  const polity=polityOf(s,town.id);
  assert.equal(polity.watchtower.status,'building');
  assert.equal(polity.watchtower.materialsPaid,true);
  assert.equal(town.storage.wood,wood-Profile.watchtowerWood);
  assert.equal(town.storage.stone,stone-Profile.watchtowerStone);
  assert.equal(polity.watchtower.progress,0,'materials alone do not finish construction');
  days(s,8);
  assert.equal(polity.watchtower.status,'built');
  const before=Politics.defense(s,polity,town),leaderId=polity.leaderId;
  assert.equal(W.die(s,leaderId,'繼承真空測試').ok,true);
  const after=Politics.defense(s,polity,town);
  assert.equal(after.fort,before.fort,'physical fort does not collapse when the mayor dies');
  assert.equal(after.commanded,before.commanded*Profile.vacantCommandFactor);
  assert.equal(after.manpower,before.manpower);
  good(s);
});

test('leader death immediately cancels offense; 90-180 day vacancy then real succession',()=>{
  const s=world();
  days(s,2);
  const polity=s.politics.polities[0],old=polity.leaderId;
  assert.equal(W.die(s,old,'遭遇意外').ok,true);
  const remain=(polity.vacantUntilHour-s.hour)/24;
  assert.ok(remain>=Profile.successionMinDays&&remain<=Profile.successionMaxDays);
  assert.equal(polity.leaderId,null);
  assert.equal(W.politicsOverview(s,polity.townId).commandFactor,Profile.vacantCommandFactor);
  days(s,Math.floor(remain)-1);
  assert.equal(polity.leaderId,null,'vacancy cannot be skipped');
  days(s,2);
  assert.ok(polity.leaderId&&polity.leaderId!==old,'real remaining resident inherits');
  assert.equal(polity.vacantUntilHour,null);
  good(s);
});

test('Lightning preserves Presence requirement and can kill an actual leader',()=>{
  const s=world();
  days(s,2);
  const polity=s.politics.polities[0],town=townOf(s,polity);
  const residents=s.people.filter(q=>q.alive&&town.householdIds.includes(q.householdId));
  for(const person of residents){person.religionId=s.religion.id;person.devotion=90;}
  const leader=s.people.find(q=>q.id===polity.leaderId);
  leader.health=10;s.god.dp=s.god.cap;
  const params={x:leader.x,y:leader.y,radius:1,intensity:1};
  const check=W.evaluateMiracle(s,'lightning',params);
  assert.equal(check.ok,true,check.reason||'Lightning should be legal after local believers establish Presence');
  const cast=W.castMiracle(s,'lightning',params);
  assert.equal(cast.ok,true);
  assert.equal(leader.alive,false);
  assert.equal(polity.leaderId,null);
  assert.ok(polity.vacantUntilHour>s.hour);
  good(s);
});

test('quarry pressure creates actual travelling militia and resolves a material-backed conflict',()=>{
  const s=world();
  days(s,75);
  const resolved=s.politics.disputes.filter(c=>c.status==='resolved');
  assert.ok(resolved.length>=1,'expected at least one naturally arising contested quarry');
  assert.ok(s.politics.claims.length>=1,'winner must claim only mapped stone');
  const claim=s.politics.claims[0],node=s.tiles[claim.site.y*s.width+claim.site.x];
  assert.equal(node.resourceNode,'stone');
  assert.ok(claim.stoneGathered>0);
  assert.ok(node.stone<=1000-claim.stoneGathered+1e-9,
    'the winner cannot create stone that was not physically at the quarry');
  assert.ok(s.events.some(e=>e.kind==='conflict'&&e.text.includes('部隊撤回')));
  assert.ok(s.politics.polities.every(p=>p.militia.memberIds.every(id=>
    s.people.some(q=>q.id===id&&q.alive))));
  good(s);
});

test('assassinating a marching leader causes retreat, not a new attack',()=>{
  const s=world();
  for(let d=0;d<45&&
    !s.politics.disputes.some(c=>c.status==='marching');d++)days(s,1);
  const conflict=s.politics.disputes.find(c=>c.status==='marching');
  assert.ok(conflict,'natural resource pressure must initiate a physical sortie');
  const polity=s.politics.polities.find(p=>p.id===conflict.aId);
  assert.equal(polity.militia.stance,'march');
  W.die(s,polity.leaderId,'演習指揮官遭雷擊');
  assert.equal(conflict.status,'withdrawn');
  assert.equal(polity.militia.stance,'return');
  days(s,5);
  assert.notEqual(polity.militia.stance,'march','vacancy blocks immediate counterattack');
  good(s);
});

test('save/restore including mobile units and elections is deterministic',()=>{
  const s=world();
  days(s,16);
  const copy=W.restore(JSON.stringify(s));
  assert.deepEqual(copy,s);
  days(s,28);days(copy,28);
  assert.deepEqual(copy,s);
  good(copy);
});

test('battle is an observable multi-day event; soldiers are separated and can be healed selectively',()=>{
  const s=world();
  for(let day=0;day<65&&!s.politics.disputes.some(c=>c.status==='clashing');day++)
    days(s,1);
  const clash=s.politics.disputes.find(c=>c.status==='clashing');
  assert.ok(clash,'at least one skirmish should enter a visible ongoing phase');
  assert.equal(clash.roundsCompleted,0);
  const a=s.politics.polities.find(p=>p.id===clash.aId);
  const b=s.politics.polities.find(p=>p.id===clash.bId);
  assert.ok(Math.hypot(a.militia.x-b.militia.x,a.militia.y-b.militia.y)>=3,
    'opposing armies must have distinct nearby positions for tactical healing');
  assert.equal(a.militia.stance,'clash');
  assert.equal(b.militia.stance,'clash');
  assert.ok(s.attention.items.some(n=>n.type==='battle'&&n.disputeId===clash.id&&n.level==='slow'),
    'clash must create a real attention signal for fast-forward slowdown');
  days(s,1);
  assert.equal(clash.status,'clashing','first clash round cannot immediately settle war');
  assert.equal(clash.roundsCompleted,1);
  const wounded=a.militia.memberIds.map(id=>s.people.find(p=>p.id===id&&p.alive));
  assert.ok(wounded.some(p=>p.health<100),'real soldiers must acquire actual wounds');
  const opponentHealth=b.militia.memberIds.map(id=>s.people.find(p=>p.id===id).health);
  const healthBefore=wounded.map(p=>p.health);
  s.god.dp=s.god.cap;
  const heal=W.castMiracle(s,'heal',{x:a.militia.x,y:a.militia.y,radius:1,intensity:1});
  assert.equal(heal.ok,true,heal.reason||'tactical Heal should be possible during combat');
  assert.ok(wounded.some((p,i)=>p.health>healthBefore[i]),
    'Heal must visibly repair real participating soldiers');
  assert.deepEqual(b.militia.memberIds.map(id=>s.people.find(p=>p.id===id).health),opponentHealth,
    'a small-radius Heal should not heal the opposing formation');
  days(s,Profile.battleRounds-1);
  assert.equal(clash.status,'resolved');
  assert.equal(clash.roundsCompleted,Profile.battleRounds);
  good(s);
});

test('killing leader during ongoing clash withdraws the army and blocks new offense',()=>{
  const s=world();
  for(let day=0;day<65&&!s.politics.disputes.some(c=>c.status==='clashing');day++)
    days(s,1);
  const clash=s.politics.disputes.find(c=>c.status==='clashing');
  assert.ok(clash,'needs an active multi-day conflict');
  const a=s.politics.polities.find(p=>p.id===clash.aId);
  assert.equal(W.die(s,a.leaderId,'測試：領袖在交戰中遭到攻擊').ok,true);
  assert.equal(clash.status,'withdrawn');
  assert.equal(a.militia.stance,'return');
  assert.ok(a.vacantUntilHour>s.hour);
  days(s,5);
  assert.notEqual(a.militia.stance,'march');
  good(s);
});

test('the opt-in browser shows actual battle on map instead of history-only events',async()=>{
  const {boot}=require('./browser-harness.cjs');
  const ui=await boot({politicsProfile:Profile});
  const s=ui.world();
  assert.equal(s.politics?.enabled,true);
  for(let day=0;day<65&&!s.politics.disputes.some(c=>c.status==='clashing');day++)
    days(s,1);
  const clash=s.politics.disputes.find(c=>c.status==='clashing');
  assert.ok(clash);
  ui.render();
  const banner=ui.el('battleFocusBtn');
  assert.equal(banner.hidden,false);
  assert.match(banner.innerHTML,/石礦交戰中/);
  assert.match(banner.innerHTML,/回合/);
  assert.match(ui.el('mapStatus').textContent,/正在石礦交戰/);
  const drawn=ui.draw();
  assert.ok(drawn.some(x=>x.kind==='fillText'&&String(x.args[0]).includes('交戰')),
    'the map must paint a fighting marker, not only a text alert');
  assert.ok(drawn.some(x=>x.kind==='fillText'&&String(x.args[0]).includes('交戰近景')),
    'map needs a magnified fighting scene, not only tiny markers');
  const first=drawn.filter(x=>x.kind==='fillText'&&x.args[0]==='⚔');
  assert.ok(first.length,'the battlefield needs an immediately recognizable crossed-swords indicator');
  banner.onclick();
  assert.match(banner.title||ui.el('simHint').textContent,/./);
});
