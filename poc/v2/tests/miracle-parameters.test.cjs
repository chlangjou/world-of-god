'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/sim.js');
const {boot}=require('./browser-harness.cjs');

test('Miracle radius, intensity and duration return to the values entered for each skill',async()=>{
  const ui=await boot(),world=ui.world();
  assert.equal(ui.el('divinePowerSelect').value,'rain');
  const initialDp=world.god.dp;
  ui.set('radius',11);ui.set('intensity',110);ui.set('duration',18);
  ui.choose('ripening');
  assert.deepEqual(ui.values(),{radius:7,intensity:100,duration:12},
    'an untouched Miracle initially uses its own defaults');
  ui.set('radius',5);ui.set('intensity',165);ui.set('duration',23);
  ui.choose('harvest');
  assert.equal(ui.el('durationLabel').hidden,false,'instant Miracle keeps a visible time field');
  assert.equal(ui.el('duration').disabled,true,'instant duration is read-only');
  assert.equal(ui.el('duration').value,'0');
  assert.equal(ui.el('durationValue').textContent,'瞬間');
  ui.set('radius',9);ui.set('intensity',150);
  ui.choose('ripening');
  assert.deepEqual(ui.values(),{radius:5,intensity:165,duration:23});
  assert.equal(ui.el('durationLabel').hidden,false);
  assert.equal(ui.el('duration').disabled,false);
  ui.choose('harvest');
  assert.equal(ui.el('radius').value,'9');
  assert.equal(ui.el('intensity').value,'150');
  assert.equal(ui.el('durationLabel').hidden,false);
  assert.equal(ui.el('duration').disabled,true);
  ui.choose('rain');
  assert.deepEqual(ui.values(),{radius:11,intensity:110,duration:18});
  assert.equal(world.god.dp,initialDp,'switching powers never charges Divine Power');

  // Actually cast after returning, verifying simulator receives retained inputs.
  world.god.dp=world.god.cap;
  assert.ok(ui.el('rainBtn').textContent.includes('取消'),
    'selecting Rain should already have armed its map target');
  const camp=world.camp;
  ui.clickMap(camp.x,camp.y);
  const cast=world.effects.find(e=>(e.type||'rain')==='rain');
  assert.ok(cast,'the chosen Miracle is actually cast');
  assert.equal(cast.radius,11);
  assert.equal(cast.intensity,1.1);
  assert.equal((cast.endsAtHour-cast.startsAtHour)/24,18);
});

test('instant Lightning keeps truthful area/time preview without a fake duration',async()=>{
  const ui=await boot(),s=ui.world();
  ui.choose('ripening');
  assert.equal(ui.el('duration').disabled,false);
  assert.ok(ui.el('effectSummary').textContent.includes('半徑 7 格'));
  assert.ok(ui.el('effectSummary').textContent.includes('12 日'));
  ui.set('radius',9);ui.set('duration',21);
  ui.choose('lightning');
  assert.equal(ui.el('durationLabel').hidden,false);
  assert.equal(ui.el('duration').disabled,true);
  assert.equal(ui.el('duration').value,'0');
  assert.equal(ui.el('durationValue').textContent,'瞬間');
  assert.equal(ui.el('radius').disabled,true);
  assert.equal(ui.el('radius').value,'1');
  assert.equal(ui.el('radiusValue').textContent,'1 格');
  assert.equal(ui.el('effectSummary').textContent,
    '有效範圍：半徑 1 格 · 作用時間：瞬間（0 日）');
  assert.ok(ui.el('mapTip').textContent.includes('半徑 1 格'));
  assert.ok(ui.el('mapTip').textContent.includes('瞬間（0 日）'));
  assert.ok(ui.el('rainCooldown').textContent.includes('本次預計冷卻'),
    'effect duration and recovery cooldown must stay separate');
  for(const type of ['heal','harvest']){
    ui.choose(type);
    assert.equal(ui.el('durationLabel').hidden,false);
    assert.equal(ui.el('duration').value,'0');
    assert.equal(ui.el('duration').disabled,true);
    assert.ok(ui.el('effectSummary').textContent.includes('瞬間（0 日）'));
  }
  ui.choose('ripening');
  assert.equal(ui.el('duration').disabled,false);
  assert.equal(ui.el('duration').value,'21');
  assert.equal(ui.el('radius').value,'9');
  ui.choose('lightning');
  s.god.dp=s.god.cap;
  const at=s.camp;
  const can=W.evaluateMiracle(s,'lightning',{x:at.x,y:at.y,radius:1,intensity:1,durationDays:0});
  assert.equal(can.ok,true,can.reason);
  ui.clickMap(at.x,at.y);
  assert.ok(ui.el('toast').textContent.includes('半徑 1 格，作用時間 瞬間（0 日）'));
  assert.equal(ui.el('mapTip').hidden,true);
});

test('current Oracle strategy is visible for both gods without reading History',async()=>{
  const ui=await boot(),s=ui.world();
  assert.ok(s.opponentReligion,'test needs a rival God');
  s.religion.oracles.push({id:'visual-o1',godId:s.god.id,
    intentType:'family.nurture',status:'active',saintId:'none',
    issuedAtHour:s.hour,propagatedAtHour:s.hour,heardCount:5});
  s.opponentReligion.oracles.push({id:'visual-o2',godId:s.opponentGod.id,
    intentType:'settlement.explore',status:'active',saintId:'none',
    issuedAtHour:s.hour,propagatedAtHour:s.hour,heardCount:8});
  ui.el('miracleTab').onclick();
  const strip=ui.el('oracleDuelStatus').innerHTML;
  assert.ok(strip.includes('己：育兒'),strip);
  assert.ok(strip.includes('敵：探索'),strip);
  const overview=ui.el('faithOverview').innerHTML;
  assert.ok(overview.includes('Oracle：育兒'),overview);
  assert.ok(overview.includes('Oracle：探索'),overview);
  assert.ok(overview.includes('side-player')&&overview.includes('side-opponent'));
});
test('History colors identify responsible God independently from event kind',async()=>{
  const ui=await boot(),s=ui.world();
  const types=[
    {kind:'miracle',godId:s.god.id,text:'你施展治療'},
    {kind:'miracle',godId:s.opponentGod.id,text:'敵神施展治療'},
    {kind:'oracle',godId:s.opponentGod.id,text:'外教祭司宣布探索'},
    {kind:'birth',text:'中立村落出生'}
  ];
  for(const e of types)s.events.push({id:++s.eventSeq,hour:s.hour,reasons:[],...e});
  ui.el('miracleTab').onclick();
  const history=ui.el('events').innerHTML;
  assert.match(history,/class="event miracle side-player"/);
  assert.match(history,/class="event miracle side-opponent"/);
  assert.match(history,/class="event oracle side-opponent"/);
  assert.match(history,/class="event birth side-neutral"/);
  assert.ok(history.includes('對手')&&history.includes('己方')&&history.includes('中立／未標示'));
});
test('Heal targets the current position of a wounded person seen on a prior frame',async()=>{
  const ui=await boot(),s=ui.world();
  s.god.dp=s.god.cap;
  const patient=s.people.find(p=>p.alive);
  patient.health=38;patient.x=9;patient.y=9;
  ui.choose('heal'); // Renders a snapshot of the patient on the map.
  const tile=ui.canvas.width/s.width,original={x:patient.x,y:patient.y};
  ui.canvas.listeners.mousemove({clientX:(original.x+.25)*tile,
    clientY:(original.y+.25)*tile});
  patient.x=original.x+13;patient.y=original.y+6;
  const before=s.god.dp,health=patient.health;
  // Pointer remains over where the person was last seen.
  ui.clickMap(original.x,original.y);
  assert.ok(patient.health>health,'Heal should cast at the tracked resident current position');
  assert.ok(s.god.dp<before,'tracking cannot waive normal DP costs');
  assert.ok(ui.el('toast').textContent.includes('治療 Heal'));
  assert.equal(ui.el('mapTip').hidden,true);
});
test('Heal still allows a free area cast when the cursor is not on a wounded person',async()=>{
  const ui=await boot(),s=ui.world();
  s.god.dp=s.god.cap;
  const patient=s.people.find(p=>p.alive);patient.health=36;
  patient.x=9;patient.y=9;
  ui.choose('heal');
  const originalHealth=patient.health,center={x:21,y:18};
  ui.clickMap(center.x,center.y);
  assert.equal(patient.health,originalHealth);
  assert.equal(s.god.dp,s.god.cap,'empty target never spends DP');
});

test('Miracle and Oracle tabs remember selected powers and sliders across world reset and load',async()=>{
  const ui=await boot();
  ui.choose('efficiency');
  ui.set('radius',8);ui.set('intensity',125);ui.set('duration',16);
  ui.el('oracleTab').onclick();
  assert.equal(ui.el('divinePowerSelect').value,'food.produce');
  ui.choose('religion.spread');
  ui.el('miracleTab').onclick();
  assert.equal(ui.el('divinePowerSelect').value,'efficiency');
  assert.deepEqual(ui.values(),{radius:8,intensity:125,duration:16});
  ui.el('miracleTab').onclick(); // reselecting the current tab should be harmless
  assert.deepEqual(ui.values(),{radius:8,intensity:125,duration:16});
  ui.el('resetBtn').onclick();
  assert.equal(ui.el('divinePowerSelect').value,'efficiency');
  assert.deepEqual(ui.values(),{radius:8,intensity:125,duration:16});
  ui.el('saveBtn').onclick();
  ui.el('loadBtn').onclick();
  assert.deepEqual(ui.values(),{radius:8,intensity:125,duration:16});
  ui.el('oracleTab').onclick();
  assert.equal(ui.el('divinePowerSelect').value,'religion.spread');
  ui.el('miracleTab').onclick();
  assert.equal(ui.el('divinePowerSelect').value,'efficiency');
});

test('remembered Miracle presets remain within changed profile maxima',async()=>{
  const ui=await boot();
  ui.set('radius',12);ui.set('intensity',115);ui.set('duration',25);
  ui.choose('heal');
  const world=ui.world();
  world.rules.rainSupportMaxIntensity=.70;
  world.rules.rainMaxDays=6;
  ui.choose('rain');
  assert.deepEqual(ui.values(),{radius:12,intensity:70,duration:6});
  assert.equal(ui.el('intensity').max,'70');
  assert.equal(ui.el('duration').max,'6');
  assert.equal(ui.el('durationLabel').hidden,false);
});

test('cooldown preview changes with selected Rain duration and matches the final cast',async()=>{
  const ui=await boot(),s=ui.world();
  s.god.dp=s.god.cap;
  ui.set('radius',14);
  ui.set('intensity',100);
  ui.set('duration',30);
  const full=ui.el('rainCooldown').textContent;
  assert.ok(full.includes('本次預計冷卻'),full);
  const longDays=Number(full.match(/冷卻 ([0-9.]+) 模擬日/)?.[1]);
  assert.ok(Number.isFinite(longDays));
  ui.set('duration',5);
  const short=ui.el('rainCooldown').textContent;
  const shortDays=Number(short.match(/冷卻 ([0-9.]+) 模擬日/)?.[1]);
  assert.ok(Number.isFinite(shortDays)&&shortDays<longDays,
    'changing duration must immediately shorten the preview, even for wide spells');
  const expected=W.evalRain(s,{x:s.camp.x,y:s.camp.y,radius:14,intensity:1,durationDays:5});
  assert.equal(shortDays,Number(expected.cooldownDays.toFixed(1)));
  ui.el('rainBtn').onclick();
  const unit=768/s.width;
  ui.canvas.listeners.click({clientX:(s.camp.x+.25)*unit,clientY:(s.camp.y+.25)*unit});
  assert.equal(s.god.skills.rain.readyAtHour-s.hour,
    Math.round(expected.cooldownDays*24/8)*8);
  assert.ok(ui.el('rainCooldown').textContent.includes('冷卻中'));
  // An affordable forced cast remains available even during the current cooldown.
  assert.equal(ui.el('rainBtn').disabled,false,
    'Cooldown is a surcharge, not a hard-disabled button');
  assert.ok(ui.el('rainBtn').textContent.includes('強制施放 2×'));
  assert.ok(ui.el('rainCost').textContent.includes('2×'));
  assert.ok(ui.el('rainCost').title.includes('基本'),
    'expanded cost calculation remains available as a tooltip');
  const before=s.god.dp;
  const secondPreview=W.evalRain(s,{x:s.camp.x,y:s.camp.y,
    radius:14,intensity:1,durationDays:5});
  assert.equal(secondPreview.costMultiplier,2);
  ui.el('rainBtn').onclick();
  ui.canvas.listeners.click({clientX:(s.camp.x+.25)*unit,
    clientY:(s.camp.y+.25)*unit});
  assert.equal(s.god.dp,before-secondPreview.cost);
  assert.equal(s.god.skills.rain.cooldownCastCount,2);
  assert.ok(ui.el('rainCooldown').textContent.includes('強制施放 3×'));
  assert.equal(ui.el('rainBtn').disabled,true,
    'the button disables when next escalation cannot be afforded');
});

test('live AI difficulty selector preserves the current world and saved setting',async()=>{
  const ui=await boot(),world=ui.world();
  assert.ok(world.opponent?.enabled,'new World PoC starts with an actual AI opponent');
  const difficulty=ui.el('aiDifficulty');
  assert.equal(difficulty.value,'standard');
  assert.equal(difficulty.disabled,false);
  const before={hour:world.hour,people:JSON.stringify(world.people),
    resources:JSON.stringify(world.settlements),dp:world.opponentGod.dp,
    rng:world.opponentRng};
  difficulty.value='relaxed';
  difficulty.listeners.change({target:difficulty});
  assert.equal(ui.world(),world,'changing difficulty never creates a new world');
  assert.equal(world.opponent.difficulty,'relaxed');
  assert.deepEqual({hour:world.hour,people:JSON.stringify(world.people),
    resources:JSON.stringify(world.settlements),dp:world.opponentGod.dp,
    rng:world.opponentRng},before,'AI policy switch changes no physical world state');
  ui.el('saveBtn').onclick();
  difficulty.value='challenging';
  difficulty.listeners.change({target:difficulty});
  assert.equal(world.opponent.difficulty,'challenging');
  ui.el('loadBtn').onclick();
  assert.equal(ui.world().opponent.difficulty,'relaxed','saved AI mode survives load');
  assert.equal(ui.el('aiDifficulty').value,'relaxed','UI follows loaded world state');
});


test('selecting a Miracle immediately arms the map and only a map click spends DP',async()=>{
  const ui=await boot(),world=ui.world();
  const initialDp=world.god.dp;
  assert.equal(ui.el('mapTip').hidden,true,'new world should not accidentally start aiming');
  ui.choose('ripening');
  assert.equal(ui.el('mapTip').hidden,false,'power change must arm the map');
  assert.ok(ui.el('rainBtn').textContent.includes('取消'),'cancel is now the primary action while aiming');
  assert.equal(world.god.dp,initialDp,'selecting never spends Divine Power');
  ui.choose('rain');
  assert.equal(ui.el('mapTip').hidden,false,'switching spells must remain armed');
  assert.equal(world.god.dp,initialDp,'switching still never casts');
  const before=world.god.dp;
  ui.clickMap(world.camp.x,world.camp.y);
  assert.ok(world.god.dp<before,'map click should cast without an extra button press');
  assert.equal(ui.el('mapTip').hidden,true,'successful cast exits targeting to avoid accidental recasts');
});

test('Esc and cancel button prevent casts, even after changing sliders to unaffordable settings',async()=>{
  const ui=await boot(),world=ui.world();
  ui.choose('rain');
  assert.equal(ui.el('mapTip').hidden,false);
  ui.key('Escape');
  assert.equal(ui.el('mapTip').hidden,true);
  const before=world.god.dp;
  ui.clickMap(world.camp.x,world.camp.y);
  assert.equal(world.god.dp,before,'after Esc the map should inspect, never cast');
  ui.choose('rain');
  assert.equal(ui.el('mapTip').hidden,false);
  world.god.dp=0;
  ui.set('intensity',120);
  assert.equal(ui.el('rainBtn').disabled,false,'cancel must not be disabled by insufficient DP');
  ui.el('rainBtn').onclick();
  assert.equal(ui.el('mapTip').hidden,true,'cancel button should leave aim mode');
  ui.clickMap(world.camp.x,world.camp.y);
  assert.equal(world.god.dp,0,'cancelled low-DP target must not cast');
  ui.choose('rain');
  assert.equal(ui.el('mapTip').hidden,true,'unaffordable new selection must not leave a blocked target armed');
});

test('number hotkeys 1–9 select and arm Miracles, Esc cancels and focused controls are ignored',async()=>{
  const ui=await boot(),world=ui.world();
  assert.ok(ui.el('divinePowerSelect').innerHTML.includes('<option value="heal">4. 治療 Heal</option>'),'hotkey numbers are visible in the Miracle dropdown');
  assert.equal(ui.key('4'),true);
  assert.equal(ui.el('divinePowerSelect').value,'heal');
  assert.equal(ui.el('mapTip').hidden,false);
  assert.equal(ui.key('9'),true);
  assert.equal(ui.el('divinePowerSelect').value,'blindness');
  const noChange=ui.el('divinePowerSelect').value;
  assert.equal(ui.key('2',{focus:'INPUT'}),false);
  assert.equal(ui.key('2',{focus:'SELECT'}),false);
  assert.equal(ui.key('2',{focus:'BUTTON'}),false);
  assert.equal(ui.key('2',{ctrlKey:true}),false);
  assert.equal(ui.key('2',{altKey:true}),false);
  assert.equal(ui.key('2',{repeat:true}),false);
  assert.equal(ui.el('divinePowerSelect').value,noChange);
  ui.key('Escape');
  assert.equal(ui.el('mapTip').hidden,true);
  ui.key('1');
  assert.equal(ui.el('divinePowerSelect').value,'rain');
  assert.equal(ui.el('mapTip').hidden,false,'hotkey must rearm even after cancel');
  ui.el('oracleTab').onclick();
  assert.equal(ui.el('mapTip').hidden,true);
  assert.equal(ui.key('2'),true,'hotkey works from Oracle tab');
  assert.equal(ui.el('divinePowerSelect').value,'ripening');
  assert.equal(ui.el('miraclePanel').hidden,false);
  assert.equal(ui.el('mapTip').hidden,false);
  assert.equal(world.god.dp,W.DEFAULT_RULES.initialDp,'hotkey never casts automatically');
});
