/* Browser-only view/input adapter. All authoritative simulation resides in sim.js. */
(() => { 'use strict';
  const S = window.WoG2, Playtest = window.WOG_PLAYTEST;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  let activeProfile = null, activeReligionProfile = null, activeMobilityProfile = null, activeDivineProfile = null, activeOpponentProfile = null, activeOracleStrategyProfile = null, activePlaytestProfile = null, activeShrineProfile = null, activeVictoryProfile = null, activePolityProfile = null, profileLoading = true, divineKind = 'miracle', activeInspector = 'needs', housePage = 0, lastRoster = '';
  let state = S.create(), paused = true, speed = 1, acc = 0, previous = 0, lastDraw = 0;
  let armedMiracle = null, cursor = null, chosen = 'p1', lastEventId = -1, toastTimeout;
  let lastMiraclePreview=null, lastCastVisual=null;
  let visibleInjured=[],healLock=null; // UI-only snapshots, never stored in the world
  let focusedOracleId=null, selectedTownId = null, lastTownRoster = '', selectedSaintId=null, lastSaintRoster='', activePriestId=null, priestPetitionIndex=0;
  let selectedNeedId=null, needPage=0, lastNeedsMarkup=null;
  let selectedDisputeId=null, lastBattleMarkup=null;
  let lastAttentionSeq=0,attentionFocus=null;
  let presentedVictoryHour = null;
  const ticksPerRealSecond = 12 / 8;
  const SPEED_PRESETS = Object.freeze([0.1,1,4,16]);
  function selectSpeed(value){
    if(!SPEED_PRESETS.includes(value))return false;
    speed=value;acc=0;
    document.querySelectorAll('[data-speed]').forEach(b=>
      b.classList.toggle('active',Number(b.dataset.speed)===value));
    return true;
  }
  const format = (v, n=0) => Number(v || 0).toFixed(n);
  const html = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));

  function victoryDays(days){
    if(days%360===0)return (days/360)+' 年';
    if(days%30===0)return (days/30)+' 個月';
    return days+' 日';
  }
  function victoryOverview(){return S.victoryOverview(state);}
  function updateVictoryStatus(duel){
    const view=victoryOverview(), button=$('victoryStatusBtn');
    if(!view.enabled){
      button.disabled=true;
      $('devotionMetric').textContent='單神世界 · 無競賽';
      return;
    }
    button.disabled=false;
    const mine=view.teams.find(f=>f.id===state.religion.id);
    const leader=view.teams.find(f=>f.id===view.leaderId);
    const best=mine?.tiers.filter(t=>t.qualified).sort((a,b)=>
      a.remainingDays-b.remainingDays)[0];
    const percent=mine?(mine.share*100).toFixed(1):'0.0';
    $('devotionMetric').textContent=(view.winner?
      (view.continued?'自由沙盒 · ':'已結算 · '):'我方信仰 ')+percent+'%'+
      (best&&!view.winner?' · 距勝利 '+Math.ceil(best.remainingDays)+' 日':'');
    button.title='全球加權信仰占比：我方 '+percent+
      '%；領先宗教 '+(leader?.name||'尚無')+
      (best?'；目前最快倒數 '+Math.ceil(best.remainingDays)+' 日':'')+
      (duel?'；教學淨改宗 '+duel.net:'')+'。點擊查看全部門檻與進度。';
  }
  function showVictoryDialog(){
    const view=victoryOverview();
    if(!view.enabled){say('單神世界尚無宗教競賽。');return;}
    const won=view.winner;
    $('victoryDialogTitle').textContent=won?
      (won.godId===state.god.id?'主導勝利 · ':'主導失利 · ')+won.name:
      '全球宗教主導 · 勝負進度';
    const sorted=[...view.teams].sort((a,b)=>b.weight-a.weight);
    $('victoryReport').innerHTML=sorted.map(f=>
      '<div class="victory-rank"><strong><span>'+html(f.name)+
      (f.leading?' · 當前第一名':'')+'</span><span>'+
      (f.share*100).toFixed(2)+'%</span></strong><small>信仰貢獻 '+
      f.weight+' / '+view.totalWeight+'（全球在世信徒）</small></div>'+
      f.tiers.map(t=>'<div class="victory-tier'+(t.qualified?' active':'')+
        '"><span>≥'+(t.threshold*100).toFixed(1)+'% / '+
        victoryDays(t.requiredDays)+
        (t.minimumLeadShare?' · 領先第二名 ≥'+(t.minimumLeadShare*100).toFixed(0)+' 個百分點':'')+
        '</span><small>'+
        (t.qualified?'已維持 '+Math.floor(t.elapsedDays)+' 日':'未連續達標')+
        '</small><strong>'+(t.qualified?'餘 '+Math.ceil(t.remainingDays)+' 日':'—')+
        '</strong></div>').join('')
    ).join('')+(won?'<p class="victory-explain">已於第 '+
      (Math.floor(won.hour/24)+1)+' 日達成 '+
      (won.threshold*100).toFixed(1)+'% / '+victoryDays(won.requiredDays)+
      '；結算紀錄已保存，繼續遊戲也不會撤銷。</p>':'');
    $('victoryResolution').hidden=!won||view.continued;
    $('victoryContinueCheck').checked=false;
    if(!$('victoryDialog').open)$('victoryDialog').showModal();
  }
  function announceVictoryIfNeeded(){
    const verdict=state.victory;
    if(!verdict?.winner||verdict.continued)return false;
    paused=true;acc=0;
    if(presentedVictoryHour!==verdict.winner.hour){
      presentedVictoryHour=verdict.winner.hour;
      showVictoryDialog();
    }
    return true;
  }
  const taskName = {guard:'守備',march:'軍隊行軍',fight:'交戰',retreat:'撤退',build_watchtower:'修築瞭望塔',worship:'共同祈禱',build_ritual:'宗教設施施工',rest:'休息',family:'家庭／社交',pray:'祈禱',preach:'分享信仰',forage:'採集食物',farm:'耕作',wood:'伐木',stone:'採石',fiber:'採集纖維',build:'建造住所',care:'照顧家人／維護住所',travel:'短期出訪中',visit:'資源熱點停留',dead:'已離世'};
  const stageName = {adult:'成年人',child:'兒童',elder:'長者'};
  const occupationName = {food_producer:'糧食生產者',gatherer:'採集者',dependent:'受扶養者'};
  // First layer: action category; second layer: available power within that category.

  const availablePowers={
    miracle:[
      {id:'rain',label:'喚雨 Rain',hint:'改變土壤濕度；真正產量仍由世界決定'},
      {id:'ripening',label:'促熟 Ripening',hint:'已存在農田更快補充作物，不增加成熟存量上限'},
      {id:'harvest',label:'豐收 Harvest',hint:'增益現有待收作物，不會憑空生成庫存'},
      {id:'heal',label:'治療 Heal',hint:'治癒範圍內受傷的在世居民'},
      {id:'efficiency',label:'效率祝福 Efficiency',hint:'暫時提升範圍內己方信徒的實際工作效率'},
      {id:'drought',label:'乾旱 Drought',hint:'局部減弱水分補充；需足夠當地神性臨在'},
      {id:'lightning',label:'雷擊 Lightning',hint:'精確命中 1 格內居民或宗教建築；仍須當地 Presence 優勢'},
      {id:'confusion',label:'混亂 Confusion',hint:'暫時干擾自主判斷、傳教協調；不直接改宗'},
      {id:'blindness',label:'致盲 Blindness',hint:'暫時縮短居民尋找資源和農田的範圍'}
    ],
    oracle:[
      {id:'food.produce',label:'存糧',hint:'提高糧食安全、較能抵擋探索；忽略家庭照護時容易被育兒成果說服'},
      {id:'family.nurture',label:'育兒',hint:'加強真實照護，較能說服缺少照護的存糧居民；居住不足時容易被探索成果說服'},
      {id:'settlement.explore',label:'探索',hint:'提高住房與拓荒，較能抵擋育兒；缺糧時容易被有實際存糧的宗教說服'},
      {id:'religion.spread',label:'傳教',hint:'Saint 動員真實傳教；防禦視同預設，普通傳教不直接影響40+核心'},
      {id:'life.balance',label:'Reset · 回歸自主',hint:'神很滿意你們的行為，放下執著去追尋自己的需求'}
    ]
  };
  function activeOracleNames(faith){
    const current=(faith?.oracles||[]).filter(o=>o.status==='active');
    const names=current.map(o=>availablePowers.oracle.find(a=>a.id===o.intentType)?.label||o.intentType);
    return names.length?names.join('／'):'未發布';
  }
  const extraFaiths=()=>state.additionalReligions||[];
  const allDisplayedFaiths=()=>[state.religion,...(state.opponent?.enabled?[state.opponentReligion]:[]),...extraFaiths()];
  const factionColor=id=>id===state.religion.id?'#80d9e9':
    id===state.opponentReligion?.id?'#ed9187':id==='r3'?'#bca1f4':
    id==='r4'?'#e4c27e':'#bcd9d2';
  const faithName=id=>allDisplayedFaiths().find(f=>f?.id===id)?.name||id;
  const godFaithName=id=>allDisplayedFaiths().find(f=>f?.godId===id)?.name||id;
  function eventFaction(event){
    if(event.godId===state.god.id)return 'player';
    if(state.opponentGod&&event.godId===state.opponentGod.id)return 'opponent';
    if(event.godId&&event.godId===state.additionalGods?.[0]?.id)return 'third';
    if(event.godId&&event.godId===state.additionalGods?.[1]?.id)return 'fourth';
    if(event.godId)return 'neutral';
    // Only unambiguous old saved event text can be interpreted. Otherwise do
    // not invent an affiliation for a historical event without provenance.
    const own=event.text?.includes(state.religion.name);
    const enemy=state.opponentReligion&&event.text?.includes(state.opponentReligion.name);
    if(own&&!enemy)return 'player';
    if(enemy&&!own)return 'opponent';
    if(/^(你施展|你向|神諭交給|神宣告)/.test(event.text||''))return 'player';
    return 'neutral';
  }
  // Purely presentational input presets: each Miracle retains its last chosen
  // radius, intensity and duration; Oracle selection is remembered separately.
  // No presets are written into the deterministic World state or save schema.
  const rememberedPower={miracle:'rain',oracle:'food.produce'};
  const miracleSettings=Object.create(null);
  let configuredMiracleId=null;
  const selectedPower=()=> $('divinePowerSelect').value;
  function rememberMiracleSettings(){
    if(!configuredMiracleId)return;
    const current={radius:Number($('radius').value),
      intensityPercent:Number($('intensity').value),
      durationDays:Number($('duration').value)};
    if(Object.values(current).every(Number.isFinite))
      miracleSettings[configuredMiracleId]=current;
  }
  const bounded=(value,fallback,min,max)=>
    Math.min(max,Math.max(min,Number.isFinite(value)?value:fallback));
  const powerMeta=(kind=divineKind,id=selectedPower())=>
    availablePowers[kind]?.find(p=>p.id===id)||availablePowers[kind]?.[0];
  function configureMiracle(id){
    const rule=id==='rain'?{
      label:'喚雨 Rain',defaultRadius:state.rules.defaultRainRadius,
      defaultIntensity:state.rules.defaultRainIntensity,defaultDurationDays:state.rules.defaultRainDays,
      maxIntensity:state.rules.rainSupportMaxIntensity,maxDays:state.rules.rainMaxDays,instant:false
    }:state.divinePowers?.powers?.[id]||S.POWER_DEFAULTS[id];
    if(!rule)return;
    const prior=miracleSettings[id];
    const radius=$('radius'),intensity=$('intensity'),duration=$('duration');
    const precise=id==='lightning'&&state.shrineTemple?.precisionLightningEnabled;
    radius.min=precise?'1':'2';
    radius.max=precise?'1':'14';
    radius.disabled=precise;
    const maxIntensity=Math.round(rule.maxIntensity*100),instant=!!rule.instant;
    radius.value=String(bounded(prior?.radius,rule.defaultRadius,Number(radius.min)||2,Number(radius.max)||14));
    intensity.max=String(maxIntensity);
    intensity.value=String(bounded(
      prior?.intensityPercent,Math.round(rule.defaultIntensity*100),
      Number(intensity.min)||30,maxIntensity));
    // Show the same third parameter for every Miracle. Instant effects have
    // a truthful, non-adjustable zero duration rather than a fictitious slider.
    duration.min=instant?'0':'1';
    duration.max=instant?'0':String(Math.max(1,rule.maxDays));
    duration.disabled=instant;
    duration.value=instant?'0':String(bounded(
      prior?.durationDays,rule.defaultDurationDays||1,1,Math.max(1,rule.maxDays)));
    $('durationLabel').hidden=false;
    $('durationLabel').title=instant?
      '瞬間型 Miracle 在命中後立即結束；冷卻時間另外計算':
      '這個 Miracle 的效果持續時間，可自行調整';
    configuredMiracleId=id;
    $('miracleName').textContent=powerMeta('miracle',id)?.label||rule.label;
    $('miracleHint').textContent=powerMeta('miracle',id)?.hint||'神蹟改變現實，後續由世界決定';
    $('miracleHint').title=$('miracleHint').textContent;
  }

  function priestBubblePosition(p,size){
    // Keep the rendered prayer bubble at least 20 CSS px wide for mouse/touch.
    const canvasScale=canvas.width/Math.max(1,canvas.getBoundingClientRect().width);
    const radius=Math.max(size*.62,10*canvasScale);
    return {x:(p.x+.5)*size+Math.max(size*.82,radius*.72),
      y:(p.y+.5)*size-Math.max(size*1.10,radius*1.7),radius};
  }
  const needTitles={'food-water':'缺雨與作物','food-shortage':'糧食不足',
    healing:'傷病與治療',shelter:'住所與安居'};
  const openPrayers=()=>state.religion.prayers.filter(p=>p.status==='open')
    .sort((a,b)=>b.createdAtHour-a.createdAtHour||a.id.localeCompare(b.id));
  function currentNeed(){
    const prayer=state.religion.prayers.find(p=>p.id===selectedNeedId&&p.status==='open');
    return prayer?{prayer,location:S.prayerLocation(state,prayer.id)}:null;
  }
  function needCard(prayer){
    const place=prayer.location||S.prayerLocation(state,prayer.id);
    const title=prayer.title||needTitles[prayer.type]||'信徒祈求';
    const summary=prayer.summary||prayer.needSummary||'居民提出了實際生活需求';
    const coordinates=place?`(${format(place.center.x)}, ${format(place.center.y)})`:'';
    const source=place?.locationName||prayer.settlementName||'位置尚未記錄';
    const supporters=prayer.supporterCount??new Set(prayer.by||[]).size;
    return `<button type="button" class="need-locate-card${selectedNeedId===prayer.id?' is-located':''}"
      data-need-locate="${html(prayer.id)}"
      aria-label="在地圖定位：${html(title)}，${html(source)} ${html(coordinates)}"
      title="${html(summary)}">
      <span class="need-head"><strong>${html(title)}</strong><span>${html(source)} ${html(coordinates)}</span></span>
      <span class="need-detail">第 ${Math.floor(prayer.createdAtHour/24)+1} 日 · ${supporters} 位信徒 · ${html(summary)}</span>
    </button>`;
  }
  function locateNeed(id){
    const prayer=state.religion.prayers.find(p=>p.id===id&&p.status==='open');
    const location=prayer&&S.prayerLocation(state,prayer.id);
    if(!location){selectedNeedId=null;render();say('需求已結束，或缺少可確認的來源位置。');return;}
    selectedNeedId=prayer.id;cursor=null;render();
    say(`已定位 ${needTitles[prayer.type]||'祈求'}：${location.locationName} ${format(location.center.x)}, ${format(location.center.y)}`);
  }
  function bindNeedControls(){
    $('needsPanel').querySelectorAll('[data-need-locate]').forEach(button=>
      button.onclick=()=>locateNeed(button.dataset.needLocate));
    $('needsPanel').querySelectorAll('[data-needs-page]').forEach(button=>button.onclick=()=>{
      const max=Math.max(0,Math.ceil(openPrayers().length/3)-1);
      needPage=Math.max(0,Math.min(max,needPage+Number(button.dataset.needsPage)));
      selectedNeedId=null;cursor=null;render();
    });
    $('needsPanel').querySelectorAll('[data-need-clear]').forEach(button=>button.onclick=()=>{
      selectedNeedId=null;render();
    });
  }
  function showDivineKind(kind){
    if(divineKind==='miracle')rememberMiracleSettings();
    else rememberedPower.oracle=selectedPower();
    divineKind=kind;if(kind!=='miracle')armedMiracle=null;
    $('miraclePanel').hidden=kind!=='miracle';$('oraclePanel').hidden=kind!=='oracle';
    for(const [id,category] of [['miracleTab','miracle'],['oracleTab','oracle']]){
      $(id).classList.toggle('active',category===kind);
      $(id).setAttribute('aria-selected',String(category===kind));
    }
    const picker=$('divinePowerSelect');
    const entries=kind==='oracle'&&!state.oracleStrategy?
      availablePowers.oracle.filter(p=>['food.produce','religion.spread'].includes(p.id)):
      availablePowers[kind];
    picker.innerHTML=entries.map((p,i)=>`<option value="${p.id}">${kind==='miracle'?(i+1)+'. ':''}${p.label}</option>`).join('');
    picker.value=entries.some(p=>p.id===rememberedPower[kind])?
      rememberedPower[kind]:availablePowers[kind][0].id;
    rememberedPower[kind]=picker.value;
    if(kind==='miracle')configureMiracle(selectedPower());
    render();
  }
  function opponentOracleMarkers(){
    return S.oracleMap(state).filter(m=>m.religionId!==state.religion.id);
  }
  function oracleMarkerPosition(m){
    const index=allDisplayedFaiths().findIndex(f=>f.id===m.religionId);
    return {x:m.x+(m.kind==='town'?1.5:1.1)+Math.max(0,index-1)*.7,
      y:m.y-(m.kind==='town'?1.1:1.9)};
  }
  function oracleMarkerAt(at){
    if(!at)return null;
    const candidates=opponentOracleMarkers().map(m=>({
      ...m,distance:Math.hypot(at.x-oracleMarkerPosition(m).x,
        at.y-oracleMarkerPosition(m).y)
    })).filter(m=>m.distance<=1.65);
    candidates.sort((a,b)=>a.distance-b.distance||
      Number(b.kind==='town')-Number(a.kind==='town')||
      a.id.localeCompare(b.id));
    return candidates[0]||null;
  }
  function focusOpponentOracle(oracleId){
    const markers=opponentOracleMarkers().filter(m=>m.id===oracleId);
    if(!markers.length){say('這道 Oracle 已失效或 Saint 不在世。');return;}
    markers.sort((a,b)=>Number(b.kind==='town')-Number(a.kind==='town')||
      b.listenerCount-a.listenerCount||a.id.localeCompare(b.id));
    const target=markers[0];
    focusedOracleId=oracleId;
    cursor={x:target.x,y:target.y};
    if(target.townId)selectedTownId=target.townId;
    const pairing=target.miracle;
    if(pairing){
      if(divineKind==='miracle')rememberMiracleSettings();
      rememberedPower.miracle=pairing;
      if(divineKind!=='miracle')showDivineKind('miracle');
      $('divinePowerSelect').value=pairing;
      configureMiracle(pairing);
      armMiracleTarget(); // Only arms: no DP spent, no automatic cast.
    }
    render();
    const preview=pairing?S.evaluateMiracle(state,pairing,
      {x:target.x,y:target.y,...opts()}):null;
    say(target.religionName+' · '+(availablePowers.oracle.find(o=>
      o.id===target.intentType)?.label||target.intentType)+
      '，已定位'+(target.townName||' Saint')+
      (target.propagated?'（已傳達）':'（尚未傳達）')+
      (pairing?'；建議 '+(powerMeta('miracle',pairing)?.label||pairing)+
        (preview?.ok?'，點地圖才施放':'；此處目前不可施放：'+(preview?.reason||'請檢查條件')):''));
  }
  function showInspector(tab){
    activeInspector=tab;
    document.querySelectorAll('[data-inspect-tab]').forEach(b=>{
      const selected=b.dataset.inspectTab===tab;
      b.classList.toggle('active',selected);
      b.setAttribute('aria-selected',String(selected));
    });
    document.querySelectorAll('[data-inspect-panel]').forEach(el=>el.hidden=el.dataset.inspectPanel!==tab);
    render();
  }
  function nearVisibleInjured(at){
    if(!at)return null;
    const candidates=visibleInjured.filter(v=>Math.hypot(v.x-at.x,v.y-at.y)<=2.5);
    candidates.sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-
      Math.hypot(b.x-at.x,b.y-at.y)||a.id.localeCompare(b.id));
    return candidates[0]||null;
  }
  function healAimAt(at){
    if(!at||armedMiracle!=='heal')return at;
    const near=nearVisibleInjured(at);
    const locked=healLock&&Math.hypot(at.x-healLock.anchor.x,at.y-healLock.anchor.y)<=2.6?
      healLock:near?{id:near.id,anchor:at}:null;
    const patient=locked&&state.people.find(p=>p.id===locked.id&&p.alive&&p.health<100);
    return patient?{x:patient.x,y:patient.y,personId:patient.id,personName:patient.name}:at;
  }
  function armMiracleTarget(){
    if(profileLoading||divineKind!=='miracle')return false;
    const id=selectedPower(),target=healAimAt(cursor||state.camp);
    const result=S.evaluateMiracle(state,id,{x:target.x,y:target.y,...opts()});
    // Choosing a Miracle arms the map but does not cast. Target-specific
    // limitations (such as needing an injured recipient) remain checked at
    // the actual clicked point, not only at the preview position.
    if(state.god.dp+1e-8<(result.cost??Infinity)){
      armedMiracle=null;render();
      say(result.reason||'目前 Divine Power 不足');
      return false;
    }
    armedMiracle=id;render();
    say((result.overcast?'冷卻中強制施放（'+result.costMultiplier+'× DP）：':'選擇了 ')+
      (powerMeta('miracle',id)?.label||id)+'；點擊地圖施放，Esc 取消。');
    return true;
  }
  function toggleMiracleTarget(){
    if(profileLoading)return;
    if(divineKind!=='miracle')showDivineKind('miracle');
    if(armedMiracle){armedMiracle=null;render();return;}
    armMiracleTarget();
  }
  function selectMiracleByHotkey(id){
    if(profileLoading)return;
    if(divineKind==='miracle')rememberMiracleSettings();
    else{
      rememberedPower.miracle=id;
      showDivineKind('miracle');
    }
    $('divinePowerSelect').value=id;
    rememberedPower.miracle=id;
    configureMiracle(id);
    armMiracleTarget();
  }
  function say(text) { const box=$('toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('visible'),3000); }
  function opts() { return {radius:+$('radius').value,intensity:+$('intensity').value/100,
    durationDays:$('duration').disabled?0:+$('duration').value}; }
  function storageKey() {return 'wog-poc-v2-save';}
  const scenarioId=()=>state.playtest?.mode==='duel'?'duel':
    (state.playtest?.godCount||(state.additionalReligions?.length||0)+2)===4?'native4':
    (state.playtest?.godCount||(state.additionalReligions?.length||0)+2)===3?'native3':'native';
  const competitionScore=()=>Playtest?.score(state)||null;
  function playtestHint(){
    const score=competitionScore();
    if(!score)return null;
    if(score.won)return '宗教對決：已達淨改宗 +'+score.goal+
      '；可繼續觀察，但超過100天可能發生轉宗連鎖。';
    if(score.days>=score.targetDays)return '宗教對決已過 '+score.targetDays+
      ' 天，淨改宗 '+score.net+'，目標 +'+score.goal+'；可更換神諭重試。';
    return '宗教對決 '+score.days+'/'+score.targetDays+' 日 · 淨改宗 '+
      (score.net>0?'+':'')+score.net+'（獲得 '+score.gained+'／流失 '+score.lost+
      '）· 目標 +'+score.goal;
  }
  async function loadDivine(){
    if(window.WOG_DIVINE_PROFILE)return window.WOG_DIVINE_PROFILE;
    const response=await fetch('config/divine-powers-v0.1.json');
    if(!response.ok)throw new Error('Divine Powers Profile 無法載入');
    return response.json();
  }
  async function loadAgriculture() {
    if (window.WOG_AGRICULTURE_PROFILE) return window.WOG_AGRICULTURE_PROFILE;
    const response=await fetch('config/balance-agriculture-v0.1.json');
    if (!response.ok) throw new Error('Agriculture Profile 無法載入');
    return response.json();
  }
  async function loadReligion() {
    if(window.WOG_RELIGION_PROFILE)return window.WOG_RELIGION_PROFILE;
    const response=await fetch('config/religion-propagation-v0.1.json');
    if(!response.ok)throw new Error('Religion Propagation Profile 無法載入');
    return response.json();
  }
  async function loadMobility(){
    if(window.WOG_MOBILITY_PROFILE)return window.WOG_MOBILITY_PROFILE;
    const response=await fetch('config/mobility-contact-v0.1.json');
    if(!response.ok)throw new Error('Mobility Contact Profile 無法載入');
    return response.json();
  }
  async function loadShrine(){
    if(window.WOG_SHRINE_PROFILE)return window.WOG_SHRINE_PROFILE;
    const response=await fetch('config/shrine-temple-v0.1.json');
    if(!response.ok)throw new Error('Shrine / Temple Profile 無法載入');
    return response.json();
  }
  async function loadPolity(){
    if(window.WOG_POLITY_PROFILE)return window.WOG_POLITY_PROFILE;
    const response=await fetch('config/polity-command-v0.1.json');
    if(!response.ok)throw Error('Polity Command Profile 無法載入');
    return response.json();
  }
  async function loadVictory(){
    if(window.WOG_VICTORY_PROFILE)return window.WOG_VICTORY_PROFILE;
    const response=await fetch('config/victory-dominance-v0.1.json');
    if(!response.ok)throw new Error('Victory Profile 無法載入');
    return response.json();
  }
  async function loadOpponent(){
    if(window.WOG_OPPONENT_PROFILE)return window.WOG_OPPONENT_PROFILE;
    const response=await fetch('config/opponent-v0.2.json');
    if(!response.ok)throw new Error('Opponent Profile 無法載入');
    return response.json();
  }
  async function loadOracleStrategy(){
    if(window.WOG_ORACLE_STRATEGY_PROFILE)return window.WOG_ORACLE_STRATEGY_PROFILE;
    const response=await fetch('config/oracle-specialization-v0.1.json');
    if(!response.ok)throw new Error('Oracle Specialization Profile 無法載入');
    return response.json();
  }
  async function loadPlaytest(){
    if(window.WOG_PLAYTEST_PROFILE)return window.WOG_PLAYTEST_PROFILE;
    const response=await fetch('config/playable-evidence-v0.1.json');
    if(!response.ok)throw new Error('可玩版 Profile 無法載入');
    return response.json();
  }
  function newWorld() {
    const scenario=$('playtestScenario').value;
    const selected=scenario==='duel'?'duel':'native';
    if(selected==='duel'||scenario==='native3'||scenario==='native4')
      $('opponentMode').value='ai';
    state=Playtest.createWorld(S,{
      mode:selected,seed:state.seed,
      playtestProfile:activePlaytestProfile,
      oracleStrategyProfile:activeOracleStrategyProfile,
      opponentProfile:activeOpponentProfile||S.OPPONENT_DEFAULTS,
      balanceProfile:activeProfile,religionProfile:activeReligionProfile,
       mobilityProfile:activeMobilityProfile,
      divineProfile:activeDivineProfile,shrineProfile:activeShrineProfile,victoryProfile:activeVictoryProfile,
      politicsProfile:activePolityProfile,
      opponentMode:$('opponentMode').value,
      godCount:scenario==='native4'?4:scenario==='native3'?3:2,
      difficulty:$('aiDifficulty').value||'standard'
    });
    $('playtestScenario').value=scenario;
    if(selected==='duel'){
      rememberedPower.oracle='family.nurture';
      showDivineKind('oracle');
    }
    if(divineKind==='miracle')configureMiracle(selectedPower());
    else showDivineKind('oracle');
    $('balanceProfile').value=state.balanceProfileId==='agriculture-balance-v0.1'?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    $('opponentMode').disabled=scenario!=='native';
    $('aiDifficulty').disabled=scenario==='duel';
    if(state.opponent)$('aiDifficulty').value=state.opponent.difficulty||'standard';
    focusedOracleId=null;presentedVictoryHour=null;lastCastVisual=null;healLock=null;visibleInjured=[];paused=true;speed=1;acc=0;lastAttentionSeq=state.attention?.seq||0;attentionFocus=null;chosen='p1';lastEventId=-1;lastRoster='';lastTownRoster='';selectedTownId=null;selectedSaintId=null;lastSaintRoster='';activePriestId=null;priestPetitionIndex=0;housePage=0;armedMiracle=null;selectedNeedId=null;needPage=0;lastNeedsMarkup=null;selectedDisputeId=null;lastBattleMarkup=null;$('events').scrollTop=0;
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',+b.dataset.speed===1));
    render();
  }
  $('playtestScenario').addEventListener('change',e=>{
    if(profileLoading)return;
    const current=scenarioId(),requested=e.target.value;
    if(requested===current)return;
    if(!confirm('切換試玩情境會重新創世，未儲存進度將消失。請先匯出存檔。')){
      e.target.value=current;return;
    }
    if(requested!=='native')$('opponentMode').value='ai';
    try{newWorld();say(requested==='duel'?
      '對決已就緒：AI 已選存糧。請選育兒 Oracle，傳達後按開始。':
      '自然河谷已建立：居民和 AI 自主發展，宗教競爭需實際接觸。');}
    catch(err){e.target.value=current;say('無法開始：'+err.message);}
  });
  $('balanceProfile').addEventListener('change',async e=>{
    if(profileLoading)return;
    const desired=e.target.value;
    if(!confirm('切換 Balance Profile 會以相同 Seed 重新創世；尚未儲存的進度會消失。')){
      e.target.value=activeProfile?'agriculture':'original';return;
    }
    const previous=activeProfile;profileLoading=true;$('balanceProfile').disabled=true;$('pauseBtn').disabled=true;
    try{
      activeProfile=desired==='agriculture'?await loadAgriculture():null;
      newWorld();say(activeProfile?'Agriculture v0.1 已套用至新世界':'已切換為 Original');
    }catch(err){activeProfile=previous;$('balanceProfile').value=previous?'agriculture':'original';say('Profile 載入失敗：'+err.message);}
    finally{profileLoading=false;$('balanceProfile').disabled=false;$('pauseBtn').disabled=false;render();}
  });
  $('aiDifficulty').addEventListener('change',e=>{
    if(profileLoading||!state.opponent?.enabled)return;
    const result=S.setOpponentDifficulty(state,e.target.value);
    if(!result.ok){e.target.value=state.opponent.difficulty;say(result.reason);return;}
    const label={relaxed:'輕鬆',standard:'標準',challenging:'原版 AI'}[result.difficulty];
    // No world reset, no changed Faith, no free DP. The original AI remains
    // the maximum mode, so new difficulty is not a free information advantage.
    render();say('AI 難度已切換為'+label+'；現有世界進度保留。');
  });
  $('opponentMode').addEventListener('change',e=>{
    if(profileLoading)return;
    const requested=e.target.value;
    const current=state.opponent?.enabled?'ai':'off';
    if(requested===current)return;
    if(!confirm('切換對手模式會以相同 Seed 重新創世，尚未儲存的世界進度將消失。要繼續嗎？')){
      e.target.value=current;return;
    }
    newWorld();say(requested==='ai'?'已開啟 AI 對手，新世界從宗教競爭開始。':'新世界已改為單一神明模式。');
  });
  function save() { try {localStorage.setItem(storageKey(),JSON.stringify(state));say('已儲存目前的世界。');}catch(e){say('瀏覽器儲存失敗：請改用「匯出」。');} }
  function restore(raw) {try{const converted=JSON.parse(raw).version!==S.VERSION;state=S.restore(raw);activeProfile=state.agriculture||null;activeDivineProfile=state.divinePowers;
      activeMobilityProfile=state.mobility||activeMobilityProfile;
       activeShrineProfile=state.shrineTemple||activeShrineProfile;
    $('playtestScenario').value=scenarioId();
    activeOracleStrategyProfile=state.oracleStrategy||activeOracleStrategyProfile;
    if(state.opponent?.enabled&&state.opponent.profileId!=='opponent-v0.1')
      activeOpponentProfile=state.opponent;
    $('balanceProfile').value=activeProfile?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    $('opponentMode').disabled=scenarioId()!=='native';
    $('aiDifficulty').value=state.opponent?.difficulty||'standard';
    $('aiDifficulty').disabled=scenarioId()==='duel';
    focusedOracleId=null;presentedVictoryHour=null;lastCastVisual=null;healLock=null;visibleInjured=[];armedMiracle=null;chosen=state.people.find(p=>p.alive)?.id||null;paused=true;acc=0;lastAttentionSeq=state.attention?.seq||0;attentionFocus=null;lastEventId=-1;lastRoster='';lastTownRoster='';selectedTownId=null;selectedSaintId=null;lastSaintRoster='';activePriestId=null;priestPetitionIndex=0;housePage=0;selectedNeedId=null;needPage=0;lastNeedsMarkup=null;selectedDisputeId=null;lastBattleMarkup=null;$('events').scrollTop=0;if(divineKind==='miracle')configureMiracle(selectedPower());else showDivineKind('oracle');render();announceVictoryIfNeeded();say(state.agriculture&&!state.agriculture.workDemand?'舊版 Agriculture 存檔保留舊參數；請重新創世以套用新糧食平衡。':converted?'舊版存檔已升級；既有死亡不會倒轉。':'世界已讀取，並處於暫停狀態。');}catch(e){say('讀取失敗：'+e.message);} }
  function exportSave() { const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`world-of-god-mvp0-day-${S.days(state)+1}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function updateCost(){
    if(divineKind!=='miracle')return;
    const id=selectedPower();
    const target=healAimAt(cursor||currentNeed()?.location?.center||state.camp),
      preview=S.evaluateMiracle(state,id,{x:target.x,y:target.y,...opts()});
    lastMiraclePreview=preview;
    const actualRadius=Number.isFinite(preview.radius)?preview.radius:+$('radius').value;
    const durationText=preview.instant?'瞬間（0 日）':format(preview.durationDays,0)+' 日';
    $('radiusValue').textContent=actualRadius+' 格';
    $('intensityValue').textContent=format(+$('intensity').value/100,2)+'×';
    $('durationValue').textContent=preview.instant?'瞬間':durationText;
    $('effectSummary').textContent='有效範圍：半徑 '+actualRadius+' 格 · 作用時間：'+durationText;
    $('effectSummary').title='預覽依目前地圖中心計算；時間是效果持續時間，與下方冷卻時間分開';
    const left=Math.max(0,(state.god.skills[id]?.readyAtHour||0)-state.hour);
    if(armedMiracle&&armedMiracle!==id)armedMiracle=null;
    $('rainCost').textContent=`Lv${state.god.skills[id]?.level||1} · 預估 ${preview.cost??'—'} DP`+
      (preview.overcast?` · ${preview.costMultiplier}×`:'');
    $('rainCost').title=preview.overcast?
      `基本 ${preview.baseCost} DP × ${preview.costMultiplier} 次 = ${preview.cost} DP`:
      `本次基本消耗 ${preview.baseCost??'—'} DP`;
    const forecast=Number.isFinite(preview.cooldownDays)?
      `本次預計冷卻 ${format(preview.cooldownDays,1)} 模擬日`:'無法估算冷卻';
    $('rainCooldown').textContent=left?
      `冷卻中 · 剩餘 ${format(left/24,1)} 日 · 強制施放 ${preview.costMultiplier}× · ${forecast}`:
      (preview.reason?`${preview.reason} · ${forecast}`:`已就緒 · ${forecast}`);
    $('rainBtn').textContent=armedMiracle?'取消選點 (Esc)':
      preview.overcast?`強制施放 ${preview.costMultiplier}×`:'選擇施展位置';
    // A player must always be able to cancel aiming, even if the sliders now
    // describe a cast they cannot afford.
    $('rainBtn').disabled=profileLoading||(!armedMiracle&&
      state.god.dp+1e-8<(preview.cost??Infinity));
    $('rainBtn').setAttribute('aria-pressed',String(!!armedMiracle));
    $('rainBtn').title=preview.reason||
      `點圖施放將依當下神力、連發倍率與目標重新驗證；${forecast}`;
    $('rainBtn').classList.toggle('secondary',!!armedMiracle);
  }
  const polityColors=['#75b7e0','#f1b46f','#a4ce90','#d9a1e8','#e78c80','#d7cc76'];
  let diplomacyPage=0;
  function polityColor(polity){
    const union=(state.politics?.unions||[]).find(u=>!Number.isFinite(u.dissolvedAtHour)&&u.memberPolityIds.includes(polity?.id));
    if(union)return ['#efd16f','#85d7bc','#b8a5ed'][(state.politics.unions.indexOf(union))%3];
    const i=(state.politics?.polities||[]).indexOf(polity);
    return polityColors[Math.max(0,i)%polityColors.length];
  }
  function visibleConflict(){
    const conflicts=state.politics?.disputes||[];
    const active=conflicts.filter(c=>['marching','clashing'].includes(c.status));
    return active.find(c=>c.id===selectedDisputeId)||active[0]||
      conflicts.slice().reverse().find(c=>
        c.resolvedAtHour!==null&&state.hour-c.resolvedAtHour<=12*24)||null;
  }
  function conflictSummary(c){
    const a=state.politics?.polities.find(p=>p.id===c.aId),
      b=state.politics?.polities.find(p=>p.id===c.bId);
    const townName=p=>state.settlements.find(t=>t.id===p?.townId)?.name||'未知聚落';
    const side=p=>p?townName(p)+' '+p.militia.memberIds.length+' 人':'未知部隊';
    const title=c.status==='marching'?'正在向石礦進軍':
      c.status==='clashing'?'石礦交戰中':'石礦衝突已結束';
    const status=c.status==='clashing'?
      '第 '+(c.roundsCompleted||0)+' / '+(state.politics.battleRounds||3)+' 回合 · '+
      (paused?'模擬已暫停，可選擇神蹟後按繼續':'交戰中，可施放 Heal 介入'):
      c.status==='marching'?'雙方民兵正沿地圖行軍；接觸時將自動降至 1×':
      (c.winnerId?'勝方：'+townName(state.politics.polities.find(p=>p.id===c.winnerId)):'雙方撤退');
    return {title,status,a,b,sideA:side(a),sideB:side(b)};
  }
  function renderBattleStatus(){
    const element=$('battleFocusBtn'),c=visibleConflict();
    element.hidden=!c;
    if(!c){lastBattleMarkup=null;return;}
    const info=conflictSummary(c),badge=c.status==='clashing'?'⚔':c.status==='marching'?'➤':'✓';
    const markup='<span class="battle-focus-title">'+badge+' '+html(info.title)+'</span>'+
      '<span class="battle-focus-armies"><i style="background:'+polityColor(info.a)+'"></i>'+
      html(info.sideA)+'　vs　<i style="background:'+polityColor(info.b)+'"></i>'+html(info.sideB)+'</span>'+
      '<span class="battle-focus-detail">'+html(info.status)+'</span>';
    if(lastBattleMarkup!==markup){element.innerHTML=markup;lastBattleMarkup=markup;}
    element.setAttribute('aria-label','定位戰場：'+info.title+'，'+info.sideA+' 對 '+info.sideB+'，'+info.status);
  }
  function render() {
    if(selectedNeedId&&!currentNeed()?.location)selectedNeedId=null;
    const located=currentNeed();
    const st=S.stats(state), frontier=S.frontierStatus(state), current=state.people.find(p=>p.id===chosen);
    const battle=visibleConflict();
    renderBattleStatus();
    $('day').textContent=`第 ${st.day} 日`;
    $('weather').textContent=st.phase==='dry'?'乾旱期':st.phase==='rainy'?'雨季':'和暖時節';
    $('peopleMetric').textContent=st.people;
    const campingWounded=state.people.filter(p=>p.alive&&p.campInjury&&
      !p.campInjury.recoveredAtHour&&p.health<95).length;
    $('peopleMetric').title=campingWounded?
      '目前 '+campingWounded+' 位野營傷者，可使用 Heal（地圖紅色十字）':
      '目前沒有未痊癒的野營傷者';
    $('familiesMetric').textContent=`${st.households} 個家戶 · 出生 ${st.births} / 死亡 ${st.deaths}`;
    $('townMetric').textContent=st.settlements>1?`${st.settlements} 處聚落`:st.settlements?state.settlements[0].name:'尚未形成';
    $('townMetric').title=state.mobility?.enabled?
      '實體出訪完成 '+(state.counts.resourceVisitsCompleted||0)+
      ' 趟；跨聚落實際接觸 '+(state.counts.crossTownMeetings||0)+
      ' 次；必須在 '+state.mobility.contactRadius+' 格內遇見':
      '此舊世界仍使用既有的抽象接觸模型';
    $('townMetric').title+=' · Shrine '+(st.shrineCount||0)+' / Temple '+(st.templeCount||0)+' · 集會 '+(st.ritualAttendances||0)+' 次';
    const foremost=[...frontier.camps].sort((a,b)=>
      b.builtHomes-a.builtHomes||b.households-a.households)[0];
    $('houseMetric').textContent=foremost?
      `${st.houses}/${st.households} 有住所 · 拓荒 ${foremost.households}/${frontier.neededHouseholds} 戶（屋 ${foremost.builtHomes}/${frontier.neededHomes}）`:
      `${st.houses}/${st.households} 有住所 · 新成家 ${st.newFamilies||0}`;
    $('houseMetric').title=frontier.enabled?
      `新形成聚落 ${frontier.formed} · 自主遷出 ${frontier.departures} 戶 · 尚在外地 ${frontier.waiting} 戶。於宗教分頁查看當地拓荒進展。`:
      '此世界尚未啟用擴張型家戶模型';
    const dailyNeed=state.people.filter(p=>p.alive).reduce((a,p)=>a+(p.stage==='child'?state.rules.foodNeedChild:state.rules.foodNeedAdult),0);
    $('foodMetric').textContent=format(st.food);
    $('stockMetric').textContent=`約 ${format(st.food/Math.max(dailyNeed,.01),1)} 日 · 公共 ${format(st.commonFood)}`;
    const followerBreakdown=allDisplayedFaiths().map(f=>({
      name:f.name,count:state.people.filter(p=>p.alive&&p.religionId===f.id&&p.devotion>=40).length
    }));
    $('followersMetric').textContent=followerBreakdown.length>2?
      followerBreakdown.map((f,i)=>(i===0?'己 ':'')+f.count).join(' / '):
      st.opponentEnabled?`${st.followers} / ${st.opponentFollowers}`:st.followers;
    $('followersMetric').title=followerBreakdown.map(f=>f.name+'：'+f.count+' 位 40+ 核心').join('｜');
    const duel=competitionScore();
    updateVictoryStatus(duel);
    const myOracles=activeOracleNames(state.religion);
    const oracleSummary=allDisplayedFaiths().map((f,i)=>({
      side:i===0?'player':i===1?'opponent':i===2?'third':'fourth',
      name:f.name,oracle:activeOracleNames(f)
    }));
    $('oracleDuelStatus').innerHTML=oracleSummary.map((f,i)=>
      '<span class="side-'+f.side+'">'+html(i===0?'己':i===1?'敵':'神'+(i+1))+'：'+
      html(f.oracle)+'</span>').join('　');
    $('oracleDuelStatus').title='目前有效 Oracle（非歷史記錄）｜'+
      oracleSummary.map(f=>f.name+'：'+f.oracle).join('｜');
    $('powerMetric').textContent=format(state.god.dp,1);$('powerRate').textContent=`+${format(st.dpRateDay,2)} DP / 模擬日`;
    $('powerFill').style.width=Math.min(100,state.god.dp/state.god.cap*100)+'%';
    $('pauseBtn').textContent=paused?'▶ 開始 / 繼續':'Ⅱ 暫停';
    $('pauseBtn').disabled=profileLoading;
    $('balanceProfile').value=state.agriculture?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    $('playtestScenario').disabled=profileLoading;
    $('playtestScenario').value=scenarioId();
    $('opponentMode').disabled=profileLoading||scenarioId()!=='native';
    $('aiDifficulty').disabled=profileLoading||!state.opponent?.enabled||scenarioId()==='duel';
    if(state.opponent)$('aiDifficulty').value=state.opponent.difficulty||'standard';
    $('applyAgricultureBtn').disabled=profileLoading||!state.agriculture;
    const focused=focusedOracleId&&S.oracleMap(state).find(m=>
      m.id===focusedOracleId&&m.religionId!==state.religion.id);
    $('mapStatus').textContent=profileLoading?'載入平衡設定中…':
      battle?.status==='clashing'?'民兵正在石礦交戰：可在戰鬥結束前施放 Miracle':focused?
      '對手神諭定位：'+focused.religionName+' · '+
      (availablePowers.oracle.find(o=>o.id===focused.intentType)?.label||focused.intentType)+
      '（地圖有 Oracle 接收與傳達標記，實際受眾由個人傳播決定）':located?.location?
      `已定位 ${needTitles[located.prayer.type]||'需求'} · ${located.location.locationName} (${format(located.location.center.x)}, ${format(located.location.center.y)})`:
      state.agriculture?(state.nativeWorld?'原住民已在此生活 · Agriculture v0.1':'Agriculture v0.1 · 河流、季節與實際農作物'):
        'Original · 原始平衡對照';
    $('mapTip').hidden=!armedMiracle;
    $('simHint').textContent=armedMiracle?('已選擇'+(powerMeta('miracle',armedMiracle)?.label||'神蹟')+'：點擊地圖施展（Esc 取消）'):
      (playtestHint()?playtestHint():
      attentionFocus?.level==='pause'?('已暫停：'+attentionFocus.text+' · Esc 清除定位'):
      battle?.status==='clashing'?'真實民兵持續交戰中 · 地圖上兩側部隊可分開瞄準 Heal':
      located?.location?'需求中心已標示於地圖；缺雨虛線圈是農田評估範圍，不會自動施展神蹟。':
      st.settlements?'居民繼續自治。觀察天候、糧倉與神諭的實際後果。':'正在尋找建材、建造住屋；聚落不由神明直接放置。');
    $('simRate').textContent=`${speed}× · 約 ${format(2/speed,2)} 秒 / 模擬日`;
    updateCost();
    if(armedMiracle&&lastMiraclePreview){
      const effectTime=lastMiraclePreview.instant?'瞬間（0 日）':
        format(lastMiraclePreview.durationDays,0)+' 日';
      $('mapTip').textContent=(powerMeta('miracle',armedMiracle)?.label||armedMiracle)+
        ' · 半徑 '+lastMiraclePreview.radius+' 格 · '+effectTime+
        ' · 點地圖施放 / Esc 取消';
      const guided=healAimAt(cursor);
      if(guided?.personId)$('mapTip').textContent+=' · 追蹤 '+guided.personName;
    }
    const saints=state.religion.saints.map(id=>state.people.find(p=>p.id===id&&p.alive)).filter(Boolean);
    const saintRoster=saints.map(p=>p.id+':'+p.name).join('|');
    if(saintRoster!==lastSaintRoster){
      lastSaintRoster=saintRoster;
      $('saintSelect').innerHTML=saints.map(p=>`<option value="${html(p.id)}">${html(p.name)} · ${html(p.settlementId||'未歸屬聚落')}</option>`).join('');
    }
    if(!saints.some(p=>p.id===selectedSaintId))selectedSaintId=saints[0]?.id||null;
    $('saintSelect').value=selectedSaintId||'';
    $('saintSelect').disabled=!saints.length;
    const saint=saints.find(p=>p.id===selectedSaintId);
    const quota=saint&&state.religion.saintQuota?state.religion.saintQuota[saint.id]:null;
    $('saintQuota').textContent=quota?`${quota.quota} / ${state.rules.oracleQuota}`:'—';
    const intent=divineKind==='oracle'?selectedPower():'food.produce';
    const currentDirective=state.religion.oracles.find(o=>o.status==='active'&&o.saintId===selectedSaintId);
    const active=intent==='life.balance'?currentDirective:
      state.religion.oracles.find(o=>o.status==='active'&&o.saintId===selectedSaintId&&o.intentType===intent);
    $('oracleName').textContent=powerMeta('oracle',intent)?.label||'糧食生產';
    $('oracleHint').textContent=powerMeta('oracle',intent)?.hint||'Saint 傳遞意圖，居民自主行動';
    $('oracleStatus').textContent=active?
      (intent==='life.balance'?'目前特化：'+(powerMeta('oracle',active.intentType)?.label||active.intentType):
       intent==='religion.spread'?'持續中 · 已傳教 '+(active.influenceSermonCount||0)+' 次':
       '持續中 · 已採取相關工作 '+(active.influenceWorkCount||0)+' 次'):
      (currentDirective?'Saint 正在執行 '+(powerMeta('oracle',currentDirective.intentType)?.label||current.intentType):
        '目前沒有有效指派');
    const issueCheck=saint?S.checkOracle(state,saint.id,intent):
      {ok:false,reason:'需要合格 Saint 和可用額度'};
    const switching=!!(issueCheck.ok&&issueCheck.replace?.length);
    $('oracleReason').textContent=issueCheck.ok?
      (switching?'發佈後直接替換目前神諭，只消耗新神諭的 1 個額度。':
      active?'此神諭已在傳播。':'神諭不消耗 DP；使用 Saint 個人接收額度。'):
      (issueCheck.reason||'無法發佈');
    $('oracleBtn').textContent=switching?'替換神諭':'傳下神諭';
    $('oracleBtn').disabled=profileLoading||!issueCheck.ok;
    $('concludeBtn').hidden=!active||intent==='life.balance'||!!state.oracleStrategy;
    $('concludeBtn').disabled=!active||!quota||quota.quota<=-1;
    const prayers=openPrayers();
    const answered=state.religion.prayers.filter(p=>p.status==='answered').slice(-1);
    const focusedPriest=state.people.find(p=>p.id===activePriestId&&p.alive&&state.religion.priests.includes(p.id));
    const gathered=focusedPriest?S.priestPetitions(state,focusedPriest.id):[];
    let needsMarkup='';
    if(focusedPriest){
      priestPetitionIndex=Math.min(priestPetitionIndex,Math.max(0,gathered.length-1));
      const p=gathered[priestPetitionIndex];
      const card=p?needCard(p):
        '<div class="need-item"><small>目前尚未彙整到未完成的當地祈求。</small></div>';
      const nav=gathered.length>1?`<div class="priest-prayer-nav">
        <button type="button" data-priest-nav="-1" aria-label="上一則祈願" ${priestPetitionIndex===0?'disabled':''}>‹</button>
        <small>祈願 ${priestPetitionIndex+1} / ${gathered.length}</small>
        <button type="button" data-priest-nav="1" aria-label="下一則祈願" ${priestPetitionIndex>=gathered.length-1?'disabled':''}>›</button>
      </div>`:'';
      needsMarkup=`<div class="priest-summary"><b>${html(focusedPriest.name)} · Priest</b><small>彙整 ${gathered.length} 類未完成祈求；信徒仍可直接向 God 祈禱。</small></div>`+card+nav;
    }else{
      const pages=Math.ceil(prayers.length/3);
      needPage=Math.max(0,Math.min(needPage,Math.max(0,pages-1)));
      const cards=prayers.slice(needPage*3,(needPage+1)*3).map(needCard).join('');
      const pager=pages>1?`<div class="need-pager">
        <button type="button" data-needs-page="-1" aria-label="上一頁需求" ${needPage===0?'disabled':''}>‹</button>
        <small>需求 ${needPage*3+1}–${Math.min((needPage+1)*3,prayers.length)} / ${prayers.length}</small>
        <button type="button" data-needs-page="1" aria-label="下一頁需求" ${needPage>=pages-1?'disabled':''}>›</button>
      </div>`:'';
      needsMarkup=prayers.length?`<div class="need-list">${cards}</div>${pager}`:
        answered.length?'<div class="need-item"><strong>最近的祈求已獲得回應</strong><small>真實後果已更新參與信徒的信仰。</small></div>':
          '目前沒有迫切的祈禱。當居民遭遇缺水、缺糧、傷病或住房問題時，可能主動祈求。';
    }
    if(selectedNeedId)needsMarkup+='<button type="button" class="need-clear" data-need-clear="1">清除地圖定位 ×</button>';
    // Replacing innerHTML every redraw destroys the pressed/focused button mid-click.
    // Only refresh DOM and handlers when actual need content or selection changes.
    if(needsMarkup!==lastNeedsMarkup){
      lastNeedsMarkup=needsMarkup;
      $('needsPanel').innerHTML=needsMarkup;
      if(focusedPriest)$('needsPanel').querySelectorAll('[data-priest-nav]').forEach(button=>button.onclick=()=>{
        priestPetitionIndex=Math.max(0,Math.min(gathered.length-1,priestPetitionIndex+Number(button.dataset.priestNav)));
        selectedNeedId=gathered[priestPetitionIndex]?.id||null;
        cursor=null;render();
      });
      bindNeedControls();
    }
    $('weatherNotice').textContent=`農田 ${st.farmFields} 格${st.newFields?` · 新開墾 ${st.newFields} 格`:''} · 含水 ${format(st.avgMoisture*100)}% · ${st.phase==='dry'?'旱季，土地與工作效率降低':'農業依土壤、作物與實際勞動運作'}`;
    const townRoster=state.settlements.map(t=>t.id+':'+t.name).join('|');
    if(townRoster!==lastTownRoster){
      lastTownRoster=townRoster;
      $('settlementSelect').innerHTML=state.settlements.map(t=>`<option value="${html(t.id)}">${html(t.name)}</option>`).join('');
    }
    if(!state.settlements.some(t=>t.id===selectedTownId))selectedTownId=state.settlements[0]?.id||null;
    $('settlementSelect').value=selectedTownId||'';
    $('settlementSelect').disabled=!state.settlements.length;
    const town=state.settlements.find(t=>t.id===selectedTownId)||state.settlements[0];
    const localReligion=town?S.settlementReligionStats(state,town.id):null;
    // This inspector represents religious competition, not town accounting.
    // Existing household controls are retained hidden for old UI test bindings.
    const allReligions=allDisplayedFaiths().map((faith,i)=>({
      faith,side:['player','opponent','third','fourth'][i]||'neutral',
      role:i===0?'己方':'神'+(i+1),
      dp:i===0?state.god.dp:i===1?state.opponentGod.dp:
        state.additionalGods?.[i-2]?.dp||0
    }));
    $('faithOverview').classList.toggle('multi-deity',allReligions.length>2);
    $('faithOverview').innerHTML=allReligions.map(({faith,side,role,dp})=>{
      const adherents=state.people.filter(p=>p.alive&&p.religionId===faith.id);
      const believers=adherents.filter(p=>p.devotion>=20).length;
      const core=adherents.filter(p=>p.devotion>=40).length;
      const active=(faith.oracles||[]).filter(o=>o.status==='active');
      const saintIds=new Set(faith.saints||[]),priestIds=new Set(faith.priests||[]);
      const livingSaints=adherents.filter(p=>saintIds.has(p.id)).length;
      const livingPriests=adherents.filter(p=>priestIds.has(p.id)).length;
      const shrineCount=(state.religiousSites||[]).filter(v=>v.religionId===faith.id&&v.stage==='shrine').length;
      const templeCount=(state.religiousSites||[]).filter(v=>v.religionId===faith.id&&v.stage==='temple').length;
      const oracleSummary=active.length?active.slice(0,2).map(o=>
        availablePowers.oracle.find(x=>x.id===o.intentType)?.label||o.intentType).join('／')+
        (active.length>2?' +'+(active.length-2):''):'尚無有效神諭';
      const detail=active.map(o=>{
        const owner=state.people.find(p=>p.id===o.saintId);
        return (availablePowers.oracle.find(x=>x.id===o.intentType)?.label||o.intentType)+
          ' · '+(owner?.name||'Saint 已離世')+
          ' · 第'+Math.floor(o.issuedAtHour/24+1)+'日發布'+
          (o.propagatedAtHour===null?'（尚未傳播）':'（已傳達）');
      }).join('\n');
      return '<div class="faith-card side-'+side+'" title="'+html(detail||'目前沒有有效 Oracle')+'">'+
        '<strong>'+role+' · '+html(faith.name)+'</strong>'+
        '<span class="faith-active">Oracle：'+html(oracleSummary)+'</span>'+
        (side==='player'?'':active.map(o=>
          '<button type="button" class="oracle-locate" data-oracle-focus="'+html(o.id)+
          '" title="定位這道 Oracle 的真實接收者，選擇建議的 Miracle（不會直接施放）">'+
          '⌖ '+html(availablePowers.oracle.find(x=>x.id===o.intentType)?.label||o.intentType)+
          ' → '+html(S.ORACLE_MIRACLE_COUNTERS[o.intentType]||
            '僅觀察')+'</button>').join(''))+
        '<small>核心 40+：'+core+' · 信眾 20+：'+believers+'</small>'+
        '<small>Saint '+livingSaints+' / Priest '+livingPriests+' · DP '+format(dp,1)+'</small>'+
        '<small>Shrine '+shrineCount+' · Temple '+templeCount+'</small></div>';
    }).join('');
    $('faithOverview').querySelectorAll('[data-oracle-focus]').forEach(button=>{
      button.onclick=()=>focusOpponentOracle(button.dataset.oracleFocus);
    });
    const names={gathering:'聚會點',shrine:'Shrine',temple:'Temple',ruin:'遺址'};
    const sites=town?(state.religiousSites||[]).filter(v=>v.townId===town.id):[];
    const venue=sites.length?sites.map(v=>{
      const owner=v.religionId===state.religion.id?'己':
        faithName(v.religionId);
      return owner+' '+(names[v.stage]||v.stage)+(v.proposed?' → 籌建'+names[v.proposed]:'')+
        '（近30日 '+(v.visits||[]).length+' 次）';
    }).join('、'):'尚無固定宗教設施';
    const myPresence=town?S.presenceAt(state,town,state.religion.id):null;
    const enemyPresence=town&&state.opponent?.enabled?S.presenceAt(state,town,state.opponentReligion.id):null;
    const extraLocals=allDisplayedFaiths().slice(2).map(f=>{
      const residents=state.people.filter(p=>p.alive&&p.settlementId===town?.id&&
        p.religionId===f.id);
      const presence=town?S.presenceAt(state,town,f.id):null;
      return {faith:f,core:residents.filter(p=>p.devotion>=40).length,
        believers:residents.filter(p=>p.devotion>=20).length,
        presence:presence?.share||0};
    });
    const granary=town?.granary,granaryRules=state.agriculture?.granary;
    const granarySummary=!granary?'尚未動工':granary.built?'已完工':
      '建造 '+format(granary.progress,1)+' / '+format(granaryRules?.workRequired??6)+
      ' · '+(granary.materialsPaid?'建材已投入':
        '木材 '+format(town.storage.wood)+' / '+format(granaryRules?.woodRequired??6)+
        ' · 石材 '+format(town.storage.stone)+' / '+format(granaryRules?.stoneRequired??4));
    const polity=town?S.politicsOverview(state,town.id):null;
    const diplomaticRelations=(polity?.relations||[]).filter(r=>r.status!=='competition'||r.lastSeparation);
    diplomacyPage%=Math.max(1,diplomaticRelations.length);
    const politySummary=polity?'<div>政體：'+
      (polity.leaderName?'地方領袖 '+html(polity.leaderName):'地方繼承空窗 '+polity.vacantDays+' 日')+
      ' · 民兵 '+polity.militia+(polity.militiaReserveEnabled?'/'+polity.militiaCapacity:'')+
      (polity.mobilizingDays!==null?' · 集結剩 '+polity.mobilizingDays+' 日':
        polity.militiaReserveEnabled&&polity.militia<polity.militiaCapacity?' · 和平後備':'' )+
      ' · '+(polity.stance==='march'?'向礦區行軍':polity.stance==='return'?'撤退中':'防守')+
      ' · 瞭望塔 '+(polity.fort==='built'?'完成':polity.fort==='building'?'施工':'未建')+'</div>'+
      (polity.union?'<div title="'+html(polity.union.reason)+'">政治聯合：'+html(polity.union.name)+
        ' · '+(polity.union.leaderName?'共同領袖 '+html(polity.union.leaderName):'共同指揮空窗 '+polity.union.vacantDays+' 日')+
        ' · 各村庫存獨立</div>'+(polity.union.exitNotice?'<div title="'+html(polity.union.exitNotice.reason||'地方利益分歧')+
        '">退出協商：剩 '+Math.max(0,Math.ceil((polity.union.exitNotice.deadlineHour-state.hour)/24))+' 日</div>':''):
        polity.lastUnionSeparation?'<div title="'+html(polity.lastUnionSeparation.dissolutionReason)+'">前聯合已'+
          (polity.lastUnionSeparation.dissolutionKind==='breach'?'破約分裂':'和平退出')+'，各村獨立。</div>':'')+
      diplomaticRelations.slice(diplomacyPage,diplomacyPage+1).map(r=>'<div>外交：'+
        html(state.settlements.find(t=>t.id===r.partnerTownId)?.name||r.partnerTownId)+' · '+
        (r.status==='competition'?'破約後競爭':r.status==='alliance'?'互助同盟':'和平協議')+
        (state.hour<(r.nonAggressionUntilHour||0)?' · 禁戰 '+Math.ceil((r.nonAggressionUntilHour-state.hour)/24)+' 日':'')+
        ' · 已運抵 '+format(r.delivered,1)+
        '<br>'+html(r.reason)+'</div>').join('')+
      (diplomaticRelations.length>1?'<button id="diplomacyNext" class="secondary">外交 '+
        (diplomacyPage+1)+' / '+diplomaticRelations.length+' · 下一個</button>':''):'';
    $('townPanel').innerHTML=town?'<div class="religion-local">'+
      '<b>'+html(town.name)+'</b> · '+(town.native?'原生聚落':'居民聚落')+
      '<div>己方：核心 '+localReligion.followers+'／信眾 '+localReligion.believers+
      ' · Saint '+localReligion.saints+' / Priest '+localReligion.priests+'</div>'+
      (state.opponent?.enabled?'<div>對手：核心 '+localReligion.opponentFollowers+
        '／信眾 '+localReligion.opponentBelievers+' · Saint '+localReligion.opponentSaints+
        ' / Priest '+localReligion.opponentPriests+'</div>':'')+
      '<div>未入教 '+localReligion.unaffiliated+' · 當地 Presence：己 '+
      format((myPresence?.share||0)*100)+'%'+
      (enemyPresence?' / 敵 '+format(enemyPresence.share*100)+'%':'')+
      '（須同時看有效密度）</div>'+
      (extraLocals.map(v=>
        '<div>'+html(v.faith.name)+'：核心 '+v.core+'／信眾 '+v.believers+
        ' · Presence '+format(v.presence*100)+'%</div>').join(''))+
      '<div>設施：'+html(venue)+'</div><div>公共糧倉：'+html(granarySummary)+'</div>'+politySummary+'</div>':
      '<div class="religion-local">尚未形成聚落。宗教仍可由個別信徒自主發展。</div>';
    const townFrontier=frontier.camps.filter(p=>p.originTownId===town?.id);
    const ownedHomes=town?.householdIds.filter(id=>state.households.some(h=>
      h.id===id&&h.members.some(personId=>state.people.some(p=>
        p.id===personId&&p.alive)))).length||0;
    const readiness=ownedHomes<frontier.originMinHouseholds?
      '社群再增加 '+(frontier.originMinHouseholds-ownedHomes)+' 戶可提高向外拓荒機會':
      '居民可在物資允許時自主尋找外地定居點';
    const frontierSummary=frontier.enabled?
      '<div class="frontier-local"><b>自主拓荒</b> · 已新建 '+frontier.formed+
      ' 村 · 全圖在外地 '+frontier.waiting+' 戶'+
      '<div>'+html(town?town.name+'（'+ownedHomes+' 戶）':'全世界')+'：'+html(readiness)+'</div>'+
      (townFrontier.length?
        townFrontier.slice(0,2).map(p=>
          '<div>候選地 ('+p.x+','+p.y+') · 家戶 '+p.households+'/'+
          frontier.neededHouseholds+' · 完成住屋 '+p.builtHomes+'/'+
          frontier.neededHomes+(p.missingHouseholds||p.missingHomes?
            '（仍需'+(p.missingHouseholds?' +'+p.missingHouseholds+' 戶':'')+
            (p.missingHomes?' +'+p.missingHomes+' 屋':'')+'）':'（待居民正式聚集）')+
          '</div>').join(''):'<div>目前沒有從此地遷出的待建村家戶。</div>')+
      '</div>':'';
    $('townPanel').innerHTML+=frontierSummary;
    if(diplomaticRelations.length>1)$('diplomacyNext').onclick=()=>{diplomacyPage++;render();};
    const filteredHomes=town?state.households.filter(h=>town.householdIds.includes(h.id)):state.households;
    const housePageSize=2;
    const housePages=Math.max(1,Math.ceil(filteredHomes.length/housePageSize));
    housePage=Math.min(housePage,housePages-1);
    $('housePageLabel').textContent=`家戶 ${housePage+1} / ${housePages}`;
    $('housePrev').disabled=housePage===0;$('houseNext').disabled=housePage>=housePages-1;
    $('houseList').innerHTML=filteredHomes.slice(housePage*housePageSize,(housePage+1)*housePageSize).map(h=>{
      const access=S.inspectHousehold(state,h.id);
      const reach=access.settlementId?'可領公共糧':town?'公共糧倉不可及':'無公共糧倉';
      return `<div><b>${html(h.name)}</b><small>${h.home?'有住所':'建屋中'} · 私糧 ${format(h.inventory.food,1)}</small><small>${reach} · 可及 ${format(access.foodCoverageDays,1)} 日</small></div>`;
    }).join('');
    const alive=state.people.filter(p=>p.alive);
    if(!alive.some(p=>p.id===chosen))chosen=alive[0]?.id||null;
    const roster=alive.map(p=>p.id+':'+p.name).join('|');
    if(roster!==lastRoster){
      lastRoster=roster;
      $('residentSelect').innerHTML=alive.map(p=>`<option value="${html(p.id)}">${html(p.name)} · ${p.age}歲</option>`).join('');
    }
    $('residentSelect').value=chosen||'';
    const selectedPerson=state.people.find(p=>p.id===chosen&&p.alive);
    if(selectedPerson) {
      const current=selectedPerson;
      const p=current,h=state.households.find(v=>v.id===p.householdId),dec=p.lastDecision;
      const nativeInfo=current.nativeOrigin?' · 原生居民':'';
      const religious=allDisplayedFaiths().find(f=>f.id===current.religionId)?.name||'尚未歸屬';
      const currentFaith=allDisplayedFaiths().find(f=>f.id===current.religionId);
      const isOpponent=current.religionId!==state.religion.id;
      const isPriest=!!currentFaith?.priests.includes(p.id);
      const isSaint=!!currentFaith?.saints.includes(p.id);
      const roles=[isSaint?'Saint · 神諭聆聽者':null,isPriest?'Priest · 祭司':null].filter(Boolean);
      const prayerCount=isPriest&&!isOpponent?S.priestPetitions(state,p.id).length:0;
      const roleInfo=roles.length?`<div class="priest-summary">${html(roles.join(' / '))}${prayerCount?` · 已彙整 ${prayerCount} 類祈求（點地圖泡泡查看）`:''}</div>`:'';
      const workDay=dec && Number.isFinite(dec.hour)?`第 ${Math.floor(dec.hour/24)+1} 日的`:'先前的';
      const statusText=Object.entries(p.divineStatuses||{}).filter(([,v])=>v.endsAtHour>state.hour)
        .map(([key,v])=>(S.POWER_DEFAULTS[key]?.label||key)+` · 剩餘 ${Math.ceil((v.endsAtHour-state.hour)/24)} 日`).join('／');
      const activeReason=p.activityReason?`<div class="reason" title="${html(p.activityReason)}" tabindex="0"><b>此刻行動：</b>${html(p.activityReason)}</div>`:'';
      const injury=p.campInjury&&!p.campInjury.recoveredAtHour&&p.health<95?
        `<div class="divine-status" title="稀有資源區野營發生的非致命意外；同一次出訪不會重複受傷">野營受傷 · 健康 ${format(p.health)} / 100 · 可使用 Heal</div>`:'';
      const storedGold=(h?.inventory.gold||0)+
        (state.settlements.find(t=>t.id===p.settlementId)?.storage.gold||0);
      const goldHint=storedGold?`<div title="金礦暫作資源收藏，尚無完整交易用途">金礦存量：${format(storedGold,1)}</div>`:'';
      const physicalMeetings=state.mobility?.enabled?(state.contactLog||[]).filter(e=>
        e.a===p.id||e.b===p.id):[];
      const contactedPeople=new Set(physicalMeetings.map(e=>e.a===p.id?e.b:e.a));
      const outOfTown=physicalMeetings.filter(e=>e.aTownId&&e.bTownId&&e.aTownId!==e.bTownId).length;
      const meetingHint=state.mobility?.enabled?
        `<div class="reason" title="限近7日內真實小人同時距離不超過5格；每日同一對最多計一次" tabindex="0">實體接觸：${contactedPeople.size} 人 · 跨村 ${outOfTown} 次${p.mobilityTrip?' · 出訪中':''}</div>`:'';
      const evidence=p.lastFaithEvidence&&state.hour-p.lastFaithEvidence.hour<=90*24?
        `<div class="reason" title="真實神蹟或神諭成果造成的信仰改變；並非施法就直接改宗" tabindex="0"><b>最近的信仰證據：</b>${html(p.lastFaithEvidence.cause)}${p.lastFaithEvidence.change?
          ' · '+(p.lastFaithEvidence.change>0?'+':'')+format(p.lastFaithEvidence.change):''}</div>`:'';
      const impressions=Object.entries(p.miracleInterest||{}).filter(([,record])=>
        record.expiresAtHour>state.hour&&record.score>0).map(([godId,record])=>
        godFaithName(godId)+
        ' '+format(record.score)).join('／');
      const impressionHint=impressions?`<div title="對神蹟的暫時印象會影響個人日後自行接受宗教的可能；尚不等於改宗">神蹟印象：${html(impressions)}</div>`:'';
      const attraction=Object.entries(p.strategyAttraction||{}).filter(([,a])=>a.score>0)
        .map(([id,a])=>faithName(id)+' '+format(a.score,1)+
          '（可信觀察 '+a.observations+' 次）').join('／');
      const attractionHint=attraction?
        `<div title="必須反覆得到其他宗教真正的成果，才可能自主改宗">異教信任：${html(attraction)}</div>`:'';
      const conversionHint=p.lastStrategicConversion?
        `<div title="不是普通傳教直接越過40門檻">自主改宗：原信仰 ${format(p.lastStrategicConversion.fromDevotion,1)} · 累積可信觀察 ${p.lastStrategicConversion.observations} 次</div>`:'';
      $('personDetail').innerHTML=`<h3>${html(p.name)} · ${current.age} 歲</h3><div>${html(h?.name||'')} · ${stageName[p.stage]||'居民'}${nativeInfo} · ${religious}</div>${roleInfo}${statusText?`<div class="divine-status">限時狀態：${html(statusText)}</div>`:''}<div>信仰 ${format(p.devotion)} / 100 · 健康 ${format(p.health)} · 飢餓 ${format(p.hunger*100)}%</div><div>職業：${occupationName[p.occupation]||html(p.occupation)} · 此刻：${taskName[p.activity]||html(p.activity)}</div>${evidence}${impressionHint}${attractionHint}${conversionHint}${meetingHint}${injury}${goldHint}${activeReason}<div class="reason" title="${html(dec?.reason||'尚未進行工作決策')}" tabindex="0">${dec?`${workDay}工作選擇：${taskName[dec.work]||html(dec.work)}。${html(dec.reason)}${dec.oracleInfluence>0?`（神諭加權 +${format(dec.oracleInfluence,1)}）`:''}${dec.changedByOracle?' · 神諭實際改變了最高優先工作的選擇':''}`:'尚未進行工作決策。'}</div>`;
    }
    // History alone scrolls inside the fixed-size inspector; newest events stay first.
    const feed=$('events');
    $('historyCount').textContent=`保留 ${state.events.length} / ${state.rules.eventLimit} 筆 · 最新在上`;
    if(lastEventId!==state.eventSeq || feed.dataset.count!==String(state.events.length)){
      // Preserve the item being read when a new event is prepended; remain pinned
      // to the newest event only when the reader is already at the top.
      const oldTop=feed.scrollTop;
      const oldNewestId=feed.firstElementChild?.dataset.eventId;
      const readingOlder=oldTop>4;
      feed.innerHTML=state.events.slice().reverse()
        .map(e=>{
          const side=eventFaction(e);
          const sideLabel=side==='player'?'己方':side==='opponent'?'對手':'中立／未標示';
          return `<div class="event ${html(e.kind)} side-${side}" data-event-id="${html(e.id)}"><small><span class="event-source">${sideLabel}</span>第 ${Math.floor(e.hour/24)+1} 日 · ${html(e.kind)}</small><div>${html(e.text)}</div>${e.reasons?.length?`<details><summary>原因</summary>${e.reasons.map(x=>'<div>'+html(x)+'</div>').join('')}</details>`:''}</div>`;
        }).join('')||'<div class="muted">尚無重大歷史事件</div>';
      if(readingOlder && oldNewestId){
        const previousTopEvent=Array.from(feed.children).find(el=>el.dataset.eventId===oldNewestId);
        feed.scrollTop=oldTop+(previousTopEvent && feed.firstElementChild
          ? Math.max(0,previousTopEvent.offsetTop-feed.firstElementChild.offsetTop):0);
      }else feed.scrollTop=0;
      feed.dataset.count=String(state.events.length);
      lastEventId=state.eventSeq;
    }
    draw();
  }
  function draw() {
    const size=canvas.width/state.width;
    const c=ctx;c.clearRect(0,0,canvas.width,canvas.height);
    const time=performance.now()/1000;
    for(const t of state.tiles) {
      let color;
      if(t.terrain==='river') color='#478597';
      else if(t.terrain==='forest') color=t.moisture<.3?'#5c6750':'#3d6851';
      else if(t.terrain==='rock') color='#62716b';
      else if(t.terrain==='field') color=t.crop>.45?'#bc9754':t.crop>.22?'#987c49':'#7c6e48';
      else color=t.moisture<.27?'#9d9162':t.moisture<.5?'#71916c':'#588a70';
      c.fillStyle=color;c.fillRect(t.x*size,t.y*size,Math.ceil(size+.1),Math.ceil(size+.1));
      if(t.terrain==='forest' && ((t.x*7+t.y*13)%3===0)){c.fillStyle='#2d5242';c.fillRect(t.x*size+size*.27,t.y*size+size*.15,size*.5,size*.63)}
      if(t.terrain==='field' && t.crop>.18){c.strokeStyle=t.crop>.5?'#ead49b':'#af9759';c.lineWidth=.75;c.beginPath();c.moveTo(t.x*size+size*.22,t.y*size+size*.75);c.lineTo(t.x*size+size*.78,t.y*size+size*.20);c.stroke();}
    }
    // Sparse, perpetual resource sites act as visible shared destinations.
    for(const site of state.mobilityHotspots||[]){
      const px=(site.x+.5)*size,py=(site.y+.5)*size,rich=site.kind==='gold';
      c.save();c.fillStyle=rich?'#d9a43c':'#b8ad99';
      c.strokeStyle=rich?'#fff0a7':'#e3dacf';c.lineWidth=1.4;
      c.beginPath();c.arc(px,py,size*.70,0,2*Math.PI);c.fill();c.stroke();
      c.fillStyle=rich?'#44300e':'#343a36';c.textAlign='center';
      c.textBaseline='middle';c.font='bold '+Math.max(8,Math.floor(size*.95))+'px system-ui';
      c.fillText(rich?'金':'石',px,py);c.restore();
    }
    c.strokeStyle='#c7c7ab80';c.lineWidth=1;
    for(const h of state.households) {
      const px=h.x*size+size/2,py=h.y*size+size/2;
      if(h.home){c.fillStyle='#e1cf9d';c.fillRect(px-size*.47,py-size*.20,size*.95,size*.8);c.fillStyle='#7c6654';c.beginPath();c.moveTo(px-size*.72,py-size*.23);c.lineTo(px,py-size*.91);c.lineTo(px+size*.72,py-size*.23);c.closePath();c.fill();}
      else {c.fillStyle='#d6bb947e';c.beginPath();c.moveTo(px-size*.5,py+size*.28);c.lineTo(px,py-size*.47);c.lineTo(px+size*.5,py+size*.28);c.fill();}
    }
    // Each Settlement's granary is a genuine built structure, not a free storage icon.
    for(const town of state.settlements){
      const g=town.granary;if(!g)continue;
      const px=(g.x+.5)*size,py=(g.y+.5)*size;
      c.save();
      if(g.built){
        c.fillStyle='#d7a75e';c.strokeStyle='#4a3426';c.lineWidth=1.3;
        c.fillRect(px-size*.58,py-size*.28,size*1.16,size*.93);
        c.strokeRect(px-size*.58,py-size*.28,size*1.16,size*.93);
        c.fillStyle='#885f3a';c.beginPath();
        c.moveTo(px-size*.85,py-size*.3);c.lineTo(px,py-size*.95);
        c.lineTo(px+size*.85,py-size*.3);c.closePath();c.fill();
        c.fillStyle='#3c443a';c.fillRect(px-size*.12,py+size*.09,size*.24,size*.56);
      }else{
        c.strokeStyle=g.materialsPaid?'#e5ba74':'#b3a583';
        c.lineWidth=1.5;c.setLineDash(g.materialsPaid?[2,2]:[3,4]);
        c.strokeRect(px-size*.6,py-size*.6,size*1.2,size*1.2);
      }
      c.restore();
    }
    // Buildings and informal gathering places; neither is a Divine Presence source.
    for(const site of state.religiousSites||[]){
      const px=(site.x+.5)*size,py=(site.y+.5)*size;
      const color=factionColor(site.religionId);
      c.save();c.strokeStyle=color;
      c.fillStyle=site.religionId===state.religion.id?'#447b8b':'#554b4d';
      c.lineWidth=1.8;
      if(site.stage==='temple'){
        c.fillRect(px-size*.85,py-size*.35,size*1.7,size*1.15);
        c.strokeRect(px-size*.85,py-size*.35,size*1.7,size*1.15);
        c.beginPath();c.moveTo(px-size*1.1,py-size*.4);
        c.lineTo(px,py-size*1.45);c.lineTo(px+size*1.1,py-size*.4);
        c.closePath();c.fill();c.stroke();
      }else if(site.stage==='shrine'){
        c.beginPath();c.moveTo(px,py-size*1.0);c.lineTo(px+size*.78,py);
        c.lineTo(px,py+size*.8);c.lineTo(px-size*.78,py);
        c.closePath();c.fill();c.stroke();
      }else{
        c.setLineDash([2,2]);c.beginPath();c.arc(px,py,size*.7,0,Math.PI*2);c.stroke();
        c.setLineDash([]);c.fillStyle=site.stage==='ruin'?'#a4aaa0':'#f2e6c3';
        c.beginPath();c.arc(px,py,size*.25,0,Math.PI*2);c.fill();
      }
      if(site.proposed){c.strokeStyle='#f2d99e';c.setLineDash([2,2]);
        c.strokeRect(px-size*1.25,py-size*1.25,size*2.5,size*2.5);}
      c.restore();
    }
    for(const t of state.settlements){c.save();c.strokeStyle=t.id===selectedTownId?'#f4d69f':t.native?'#98cbb7':'#bed9b4';c.lineWidth=t.id===selectedTownId?2:1.4;c.setLineDash([8,7]);c.beginPath();c.arc(t.x*size,t.y*size,state.rules.settlementClusterDistance*size,0,2*Math.PI);c.stroke();c.setLineDash([]);c.font='bold 14px system-ui';c.textAlign='center';c.fillStyle='#faeed3';c.shadowColor='#0d1e18';c.shadowBlur=7;c.fillText(t.name,(t.x+1)*size,(t.y-5)*size);c.restore();}
    // Political links are visible independently of the history feed and religion.
    for(const r of state.politics?.diplomacy?.relations||[]){
      if(r.status==='competition'&&!r.lastSeparation)continue;
      const a=state.politics.polities.find(p=>p.id===r.aId),b=state.politics.polities.find(p=>p.id===r.bId);
      const ta=state.settlements.find(t=>t.id===a?.townId),tb=state.settlements.find(t=>t.id===b?.townId);
      if(!ta||!tb)continue;
      const union=(state.politics?.unions||[]).find(u=>!Number.isFinite(u.dissolvedAtHour)&&u.memberPolityIds.includes(a.id)&&u.memberPolityIds.includes(b.id));
      c.save();c.strokeStyle=union?polityColor(a):r.status==='competition'?'#dc9c8a':r.status==='alliance'?'#eed383':'#a4d9ce';c.fillStyle=c.strokeStyle;
      c.lineWidth=union?4:r.status==='alliance'?3:1.5;c.setLineDash(r.status==='alliance'?[]:[5,5]);
      c.beginPath();c.moveTo(ta.x*size,ta.y*size);c.lineTo(tb.x*size,tb.y*size);c.stroke();
      c.font='bold 12px system-ui';c.textAlign='center';
      c.fillText(union?(union.exitNotice?'◆ 退出協商 ':'◆ 政治聯合 ')+union.name:r.status==='competition'?'破約後競爭':r.status==='alliance'?'⚑ 互助同盟':r.lastSeparation?.kind==='exit'?'退出後和平':'和平協議',(ta.x+tb.x)*size/2,(ta.y+tb.y)*size/2-8);
      for(const t of [ta,tb])c.fillText(union?'◆ 聯合 '+(state.politics.unions.indexOf(union)+1):r.status==='competition'?'獨立':r.status==='alliance'?'⚑':'☮',t.x*size,(t.y-3)*size);
      c.restore();
    }
    for(const q of state.politics?.diplomacy?.shipments||[]){
      if(!['outbound','returning'].includes(q.status))continue;
      const at=q.path[q.pathIndex];c.save();c.fillStyle='#ffdd82';c.font='bold 11px system-ui';
      c.fillText(q.status==='outbound'?'▣ 運送':'▣ 返村',at.x*size,at.y*size-8);c.restore();
    }
    // Human-built towers use a different silhouette from religious temples.
    for(const polity of state.politics?.polities||[]){
      const town=state.settlements.find(t=>t.id===polity.townId);
      if(!town||polity.watchtower.status==='unbuilt')continue;
      const px=(town.x+2.3)*size,py=(town.y-1)*size;
      c.save();c.fillStyle='#35494b';c.strokeStyle=polityColor(polity);c.lineWidth=2;
      if(polity.watchtower.status==='built'){
        c.fillRect(px-size*.4,py-size*.5,size*.8,size*1.2);
        c.strokeRect(px-size*.4,py-size*.5,size*.8,size*1.2);
        c.fillStyle='#e8c995';c.fillRect(px-size*.56,py-size*.65,size*1.12,size*.26);
        c.fillStyle=polityColor(polity);c.beginPath();
        c.moveTo(px,py-size*.65);c.lineTo(px,py-size*1.35);
        c.lineTo(px+size*.75,py-size*1.12);c.lineTo(px,py-size*.94);c.fill();
      }else{c.setLineDash([3,3]);c.strokeRect(px-size*.5,py-size*.5,size,size);c.setLineDash([]);}
      c.restore();
    }
    // Outpost construction is derived from real independent households, not a divine zone.
    for(const camp of S.frontierStatus(state).camps){
      const px=(camp.x+.5)*size,py=(camp.y+.5)*size;
      c.save();c.strokeStyle='#e7cc87';c.lineWidth=1.5;c.setLineDash([3,4]);
      c.beginPath();c.arc(px,py,size*2.5,0,Math.PI*2);c.stroke();
      c.setLineDash([]);c.font='bold 10px system-ui';c.fillStyle='#ffdf97';
      c.textAlign='left';c.fillText(
        '拓荒 '+camp.households+'/'+(state.agriculture?.familyExpansion?.outpostMinHouseholds||2)+
        ' 戶 · 屋 '+camp.builtHomes+'/'+(state.agriculture?.familyExpansion?.outpostMinHuts||2),
        Math.min(canvas.width-158,px+size*2.5),Math.max(12,py-size*2.5));
      c.restore();
    }
    // Starting positions are historical camps, not fixed divine property lines.
    if(state.opponent?.originMode==='separated-native'&&state.opponentCamp){
      for(const origin of [{at:state.camp,name:'初光起點',stroke:'#f4d69f'},
        {at:state.opponentCamp,name:'暮影起點',stroke:'#ffb2a3'}]){
        c.save();c.lineWidth=1.3;c.strokeStyle=origin.stroke;c.setLineDash([3,4]);
        c.beginPath();c.arc((origin.at.x+.5)*size,(origin.at.y+.5)*size,size*4,0,Math.PI*2);c.stroke();
        c.setLineDash([]);c.fillStyle=origin.stroke;c.font='bold 11px system-ui';
        c.textAlign='center';c.fillText(origin.name,(origin.at.x+.5)*size,
          (origin.at.y-5)*size);c.restore();
      }
    }
    // Actual active Oracle transmission: visible town listeners and living
    // Saint sources only. Badge number is listeners, not a blanket area buff.
    for(const oracle of opponentOracleMarkers()){
      const point=oracleMarkerPosition(oracle);
      const px=(point.x+.5)*size,py=(point.y+.5)*size;
      const tint=factionColor(oracle.religionId);
      const letter={'family.nurture':'育','food.produce':'糧',
        'settlement.explore':'拓','religion.spread':'傳'}[oracle.intentType]||'諭';
      const label=oracle.kind==='town'?letter+oracle.listenerCount:'S'+letter;
      const selected=focusedOracleId===oracle.id;
      c.save();c.globalAlpha=oracle.propagated?1:.55;
      c.fillStyle='#112526e8';c.strokeStyle=tint;c.lineWidth=selected?3:1.7;
      const w=label.length*9+13,h=18;
      c.fillRect(px-w/2,py-h/2,w,h);c.strokeRect(px-w/2,py-h/2,w,h);
      c.font='bold 11px system-ui';c.textAlign='center';c.textBaseline='middle';
      c.fillStyle=tint;c.fillText(label,px,py);
      if(selected){
        c.setLineDash([3,3]);c.strokeStyle='#fff0c7';c.lineWidth=1.7;
        c.beginPath();c.arc(px,py,Math.max(13,size*1.8),0,2*Math.PI);c.stroke();
      }
      c.restore();
    }
    // Military group banners are POLITICAL, not religious. Real citizens
    // wear their own faith colors below; avoid a God-to-army one-to-one mapping.
    for(const polity of state.politics?.polities||[]){
      const m=polity.militia;
      if(!m.memberIds.length)continue;
      const px=(m.x+.5)*size,py=(m.y+.5)*size;
      c.save();c.strokeStyle=polityColor(polity);c.fillStyle='#102b2adf';c.lineWidth=1.8;
      c.beginPath();c.arc(px,py,Math.max(9,size*.85),0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle=polityColor(polity);c.font='bold 11px system-ui';c.textAlign='center';c.textBaseline='middle';
      c.fillText(String(m.memberIds.length),px,py-size*.8);
      if(m.stance==='march'||m.stance==='return'){
        const last=m.path?.[m.path.length-1];
        if(last){c.setLineDash([4,4]);c.beginPath();c.moveTo(px,py);
          c.lineTo((last.x+.5)*size,(last.y+.5)*size);c.stroke();c.setLineDash([]);}
      }
      c.restore();
    }
    const militiaIds=new Set((state.politics?.polities||[]).flatMap(v=>v.militia.memberIds));
    visibleInjured=state.people.filter(p=>p.alive&&
      (p.health<95||(militiaIds.has(p.id)&&p.health<100)))
      .map(p=>({id:p.id,x:p.x,y:p.y}));
    const allFaithForMap=allDisplayedFaiths();
    for(const p of state.people){if(!p.alive)continue;
      const soldierOf=(state.politics?.polities||[]).find(polity=>
        polity.militia.memberIds.includes(p.id));
      const ranks=soldierOf?.militia.memberIds||[];
      const visualOffset=soldierOf?(ranks.indexOf(p.id)-(ranks.length-1)/2)*size*.88:0;
      const px=(p.x+.5)*size+visualOffset,py=(p.y+.5)*size;
      const isLeader=(state.politics?.polities||[]).some(polity=>polity.leaderId===p.id);
      const faction=allFaithForMap.find(f=>f.id===p.religionId);
      const saint=!!faction?.saints.includes(p.id),priest=!!faction?.priests.includes(p.id);
      const rivalSaint=saint&&faction.id!==state.religion.id;
      const rivalPriest=priest&&faction.id!==state.religion.id;
      const rival=faction&&faction.id!==state.religion.id;
      c.beginPath();c.arc(px,py,p.stage==='child'?size*.23:size*.32,0,Math.PI*2);
      c.fillStyle=rivalSaint?'#ff8ca7':rivalPriest?'#ffd69e':
        saint?'#80e4eb':priest?'#c4a2fa':
        faction?factionColor(faction.id):p.devotion>=20?'#e1e6c2':'#bcd9d2';
      c.fill();c.strokeStyle='#21342fcc';c.lineWidth=1.4;c.stroke();
      // Readable human pictogram at 12px/map-cell. Head remains existing
      // religion/Priest/Saint color; arms, body, legs add human identity.
      const coat=c.fillStyle,step=['march','retreat','travel','fight'].includes(p.activity)?
        Math.sin(time*9+(p.x+p.y))*.12*size:0;
      c.strokeStyle='#1b312f';c.lineWidth=Math.max(1,size*.16);
      c.beginPath();
      c.moveTo(px-size*.18,py+size*.66);c.lineTo(px-size*.24-step,py+size*.9);
      c.moveTo(px+size*.18,py+size*.66);c.lineTo(px+size*.24+step,py+size*.9);c.stroke();
      c.fillStyle=coat;c.fillRect(px-size*.24,py+size*.26,size*.48,size*.41);
      c.strokeStyle='#18332fcc';c.lineWidth=Math.max(.8,size*.08);
      c.strokeRect(px-size*.24,py+size*.26,size*.48,size*.41);
      c.beginPath();c.moveTo(px-size*.25,py+size*.34);c.lineTo(px-size*.43,py+size*.55);
      c.moveTo(px+size*.25,py+size*.34);c.lineTo(px+size*.43,py+size*.55);c.stroke();
      if(soldierOf){
        const tint=polityColor(soldierOf);
        c.save();c.fillStyle=tint;c.strokeStyle='#10292c';c.lineWidth=1;
        c.beginPath();c.moveTo(px+size*.35,py+size*.13);
        c.lineTo(px+size*.78,py+size*.17);c.lineTo(px+size*.76,py+size*.6);
        c.lineTo(px+size*.55,py+size*.8);c.lineTo(px+size*.34,py+size*.6);
        c.closePath();c.fill();c.stroke();c.restore();
      }
      if(isLeader){
        c.save();c.fillStyle='#f5d17d';c.strokeStyle='#6b4c2e';c.lineWidth=1;
        c.beginPath();c.moveTo(px-size*.45,py-size*.6);
        c.lineTo(px-size*.4,py-size*1.1);c.lineTo(px-size*.14,py-size*.9);
        c.lineTo(px,py-size*1.25);c.lineTo(px+size*.2,py-size*.9);
        c.lineTo(px+size*.44,py-size*1.1);c.lineTo(px+size*.4,py-size*.6);
        c.closePath();c.fill();c.stroke();c.restore();
      }
      if(p.mobilityTrip){
        c.strokeStyle='#f4e2ae';c.lineWidth=1.2;c.setLineDash([2,2]);
        c.beginPath();c.arc(px,py,size*.56,0,Math.PI*2);c.stroke();c.setLineDash([]);
      }
      if((p.campInjury&&!p.campInjury.recoveredAtHour&&p.health<95)||
        (soldierOf&&p.health<100)){
        c.save();c.strokeStyle='#e53f48';c.lineWidth=Math.max(2,size*.25);
        c.beginPath();c.moveTo(px-size*.35,py-size*.72);
        c.lineTo(px+size*.35,py-size*.72);
        c.moveTo(px,py-size*1.05);c.lineTo(px,py-size*.38);c.stroke();c.restore();
      }
      if(saint&&priest){c.strokeStyle='#c4a2fa';c.lineWidth=2;c.beginPath();c.arc(px,py,size*.53,0,Math.PI*2);c.stroke();}
      if(rivalSaint&&rivalPriest){c.strokeStyle='#ffb06d';c.lineWidth=2;c.beginPath();c.arc(px,py,size*.53,0,Math.PI*2);c.stroke();}
      // Temporary statuses remain visible without obscuring Saint/Priest role colors.
      const statuses=Object.entries(p.divineStatuses||{}).filter(([,v])=>v.endsAtHour>state.hour);
      if(statuses.length){
        const statusColors={efficiency:'#77ecb2',confusion:'#e6a0d8',blindness:'#8799aa'};
        for(const [idx,[kind]] of statuses.entries()){
          c.strokeStyle=statusColors[kind]||'#ffffff';c.lineWidth=2;
          c.beginPath();c.arc(px,py,size*(.55+idx*.11),0,Math.PI*2);c.stroke();
        }
      }
      if(p.id===chosen){c.strokeStyle='#faf5c7';c.lineWidth=2;c.beginPath();c.arc(px,py,size*.84,0,Math.PI*2);c.stroke();}
    }
    // A speech bubble belongs only to a Priest who has collected real open petitions.
    for(const id of state.religion.priests){
      const priest=state.people.find(p=>p.id===id&&p.alive);
      if(!priest)continue;
      const petitions=S.priestPetitions(state,id);if(!petitions.length)continue;
      const b=priestBubblePosition(priest,size);
      c.save();c.fillStyle='#f6e2ae';c.strokeStyle='#624e88';c.lineWidth=1.7;
      c.beginPath();c.arc(b.x,b.y,b.radius,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='#4b3863';c.font=`bold ${Math.round(b.radius*1.05)}px system-ui`;c.textAlign='center';
      c.textBaseline='middle';c.fillText(petitions.length>9?'9+':String(petitions.length),b.x,b.y);
      c.restore();
    }
    for(const e of state.effects){
      if(state.hour>=e.endsAtHour)continue;
      const kind=e.type||'rain';
      c.save();
      c.fillStyle=kind==='ripening'?'#f3ce6622':kind==='drought'?'#b97e4926':'#9dccde24';
      c.strokeStyle=kind==='ripening'?'#e5c86b':kind==='drought'?'#bf885a':'#bfeaff';
      c.lineWidth=2.5;c.beginPath();c.arc(e.x*size,e.y*size,e.radius*size,0,Math.PI*2);c.fill();c.stroke();
      // The effect fill explains WHAT is happening; the outside outline
      // identifies WHICH God cast it. Neither changes the simulation.
      if(allDisplayedFaiths().some(f=>f.godId===e.godId)){
        const actor=allDisplayedFaiths().find(f=>f.godId===e.godId);
        c.strokeStyle=factionColor(actor.id);
        c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();
        c.arc(e.x*size,e.y*size,e.radius*size+3,0,Math.PI*2);c.stroke();
        c.setLineDash([]);
      }
      if(kind==='rain'){
        c.strokeStyle='#acd7e680';
        for(let i=0;i<30;i++){const aa=i*2.39996,rr=(i%10)/10*e.radius*size;const x=e.x*size+Math.cos(aa)*rr,y=e.y*size+Math.sin(aa)*rr;const fall=(time*19+i*13)%24;c.beginPath();c.moveTo(x,y+fall-12);c.lineTo(x-3,y+fall);c.stroke();}
      }
      c.restore();
    }
    // Persistent geographic conflict markers: line of approach and a
    // multi-day clash, instead of letting a one-tick decision vanish in logs.
    for(const conflict of state.politics?.disputes||[]){
      if(!['marching','clashing'].includes(conflict.status)&&
         !(conflict.resolvedAtHour!==null&&state.hour-conflict.resolvedAtHour<8*24))continue;
      const selected=conflict.id===visibleConflict()?.id;
      const x=(conflict.site.x+.5)*size,y=(conflict.site.y+.5)*size;
      const clash=conflict.status==='clashing',active=clash||conflict.status==='marching';
      const radius=size*(clash?2.1:1.45);
      c.save();c.lineWidth=selected?3:1.6;
      c.strokeStyle=clash?'#fa8d78':active?'#ffd57d':'#e0d1a8';
      c.fillStyle=clash?'#5f24244d':'#24383a8a';
      c.beginPath();c.arc(x,y,radius+(clash?Math.sin(time*8)*size*.15:0),0,Math.PI*2);
      c.fill();c.stroke();
      const a=state.politics.polities.find(v=>v.id===conflict.aId);
      const b=state.politics.polities.find(v=>v.id===conflict.bId);
      if(clash&&a&&b){
        c.setLineDash([4,4]);c.lineWidth=2;
        c.strokeStyle=polityColor(a);c.beginPath();
        c.moveTo((a.militia.x+.5)*size,(a.militia.y+.5)*size);c.lineTo(x,y);c.stroke();
        c.strokeStyle=polityColor(b);c.beginPath();
        c.moveTo((b.militia.x+.5)*size,(b.militia.y+.5)*size);c.lineTo(x,y);c.stroke();
        c.setLineDash([]);
        c.strokeStyle='#ffdb9d';c.lineWidth=2;
        const k=Math.sin(time*12)*size*.15;
        c.beginPath();c.moveTo(x-size*.7+k,y-size*.7);c.lineTo(x+size*.65,y+size*.7);
        c.moveTo(x+size*.7,y-size*.7-k);c.lineTo(x-size*.65,y+size*.7);c.stroke();
      }
      c.textAlign='center';c.textBaseline='middle';
      c.font='bold 11px system-ui';c.fillStyle='#ffeac3';
      c.fillText(clash?'⚔':active?'!':'✓',x,y);
      const banner=clash?'交戰 '+(conflict.roundsCompleted||0)+'/'+(state.politics.battleRounds||3):
        active?'軍隊接近中':'衝突結束';
      c.fillStyle='#0e2425e6';c.fillRect(x-47,y-radius-22,94,17);
      c.fillStyle=clash?'#ffe2b9':'#f2efdc';c.fillText(banner,x,y-radius-14);
      c.restore();
    }
    const source=currentNeed();
    if(source?.location){
      const loc=source.location,x=(loc.center.x+.5)*size,y=(loc.center.y+.5)*size;
      const isWater=source.prayer.type==='food-water';
      c.save();
      if(isWater){
        c.strokeStyle='#ffe4a6';c.lineWidth=2;c.setLineDash([8,5]);
        c.beginPath();c.arc(x,y,loc.radius*size,0,Math.PI*2);c.stroke();c.setLineDash([]);
      }
      c.fillStyle='#16272a';c.strokeStyle='#ffe4a6';c.lineWidth=2.5;
      c.beginPath();c.arc(x,y,Math.max(7,size*.85),0,Math.PI*2);c.fill();c.stroke();
      c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();
      c.moveTo(x-12,y);c.lineTo(x+12,y);c.moveTo(x,y-12);c.lineTo(x,y+12);c.stroke();
      const label=`${needTitles[source.prayer.type]||'需求'} (${format(loc.center.x)}, ${format(loc.center.y)})`;
      const labelX=Math.max(4,Math.min(canvas.width-194,x+size*2));
      const labelY=Math.max(24,Math.min(canvas.height-8,y-16));
      c.fillStyle='#182b2be8';c.fillRect(labelX-4,labelY-18,194,24);
      c.fillStyle='#fff4c9';c.font='bold 12px system-ui';c.textAlign='left';
      c.fillText(label,labelX,labelY-2);
      c.restore();
    }
    if(attentionFocus?.level==='pause'&&attentionFocus.center){
      const point=attentionFocus.center,x=(point.x+.5)*size,y=(point.y+.5)*size;
      c.save();c.strokeStyle='#ff8d91';c.lineWidth=2.6;
      c.beginPath();c.arc(x,y,Math.max(10,size*1.3),0,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(x-14,y);c.lineTo(x+14,y);c.moveTo(x,y-14);c.lineTo(x,y+14);c.stroke();c.restore();
    }
    // Recently completed instant Miracles leave a short *visual-only*
    // footprint; this is not an ongoing effect, additional damage, or Presence.
    if(lastCastVisual&&performance.now()<lastCastVisual.untilMs){
      const v=lastCastVisual;
      const px=v.x*size,py=v.y*size;
      c.save();c.strokeStyle='#ffeab0';c.lineWidth=2;c.setLineDash([2,5]);
      c.beginPath();c.arc(px,py,v.radius*size,0,Math.PI*2);c.stroke();
      c.setLineDash([]);c.fillStyle='#ffe6b2';c.font='bold 11px system-ui';
      c.fillText('瞬間施放 · 已結束',Math.max(5,Math.min(canvas.width-155,px+12)),
        Math.max(16,Math.min(canvas.height-9,py-10)));
      c.restore();
    }
    if(armedMiracle) {
      const target=healAimAt(cursor||source?.location?.center||state.camp);
      const preview=lastMiraclePreview;
      const radius=Number.isFinite(preview?.radius)?preview.radius:+$('radius').value;
      const effectTime=preview?.instant?'瞬間（0 日）':
        format(preview?.durationDays??+$('duration').value,0)+' 日';
      const px=target.x*size,py=target.y*size;
      c.save();c.strokeStyle='#ffdda7';c.lineWidth=3;c.setLineDash([7,4]);
      c.beginPath();c.arc(px,py,radius*size,0,Math.PI*2);c.stroke();
      c.setLineDash([]);c.font='bold 11px system-ui';
      const label='半徑 '+radius+' 格 · '+effectTime;
      const lx=Math.max(5,Math.min(canvas.width-170,px+size*1.5));
      const ly=Math.max(22,Math.min(canvas.height-5,py-size));
      c.fillStyle='#173032e9';c.fillRect(lx-4,ly-16,170,21);
      c.fillStyle='#ffe9bd';c.fillText(label,lx,ly-2);
      if(armedMiracle==='heal'&&target.personId){
        c.strokeStyle='#93f4c5';c.lineWidth=2;c.setLineDash([]);
        c.beginPath();c.arc(px+size*.5,py+size*.5,size*.9,0,Math.PI*2);c.stroke();
      }
      c.restore();
    }
    // A local 4× battle close-up solves the 64×64-map readability limit.
    // This is presentation only: every health bar belongs to a real citizen;
    // battle resolution remains in the deterministic human polity kernel.
    const battle=visibleConflict();
    if(battle?.status==='clashing'&&!armedMiracle){
      const a=state.politics.polities.find(p=>p.id===battle.aId),
        b=state.politics.polities.find(p=>p.id===battle.bId);
      if(a&&b){
        const left=canvas.width-287,top=canvas.height-158,w=277,h=147;
        c.save();
        c.fillStyle='#0b292dec';c.strokeStyle='#e4ac70';c.lineWidth=2;
        c.fillRect(left,top,w,h);c.strokeRect(left,top,w,h);
        c.fillStyle='#f8e3c4';c.font='bold 13px system-ui';c.textAlign='center';
        c.fillText('交戰近景 · 第 '+(battle.roundsCompleted+1)+' / '+
          (state.politics.battleRounds||3)+' 日',left+w/2,top+20);
        c.font='bold 10px system-ui';
        const factions=[a,b];
        for(let side=0;side<2;side++){
          const polity=factions[side],unit=polity.militia;
          const town=state.settlements.find(t=>t.id===polity.townId);
          const centerX=left+(side===0?74:203),tint=polityColor(polity);
          c.fillStyle=tint;
          c.fillText((town?.name||'部隊').slice(0,8),centerX,top+39);
          const participants=unit.memberIds.map(id=>state.people.find(p=>p.id===id&&p.alive)).filter(Boolean);
          const avg=participants.length?participants.reduce((n,p)=>n+p.health,0)/participants.length:0;
          c.fillStyle='#263b3e';c.fillRect(centerX-44,top+45,88,6);
          c.fillStyle=avg<45?'#eb8e7f':'#9ccf9b';c.fillRect(centerX-44,top+45,88*avg/100,6);
          c.fillStyle='#e7dfc8';c.font='10px system-ui';
          c.fillText('健康 '+Math.round(avg)+' / 100',centerX,top+61);
          participants.forEach((p,i)=>{
            const x=centerX+(i-(participants.length-1)/2)*31;
            const y=top+106+Math.sin(time*7+i+side)*2.4;
            const facing=side===0?1:-1;
            c.strokeStyle='#1f3435';c.lineWidth=2.2;
            c.beginPath();c.moveTo(x-5,y+10);c.lineTo(x-7,y+20);
            c.moveTo(x+5,y+10);c.lineTo(x+7,y+20);c.stroke();
            c.fillStyle=tint;c.fillRect(x-7,y-2,14,15);
            c.fillStyle='#e6ccb0';c.beginPath();c.arc(x,y-10,6,0,2*Math.PI);c.fill();
            c.strokeStyle='#1f3435';c.lineWidth=1.5;c.stroke();
            c.strokeStyle='#dbdde0';c.lineWidth=2.4;
            c.beginPath();c.moveTo(x+facing*8,y+2);
            c.lineTo(x+facing*19,y-10+Math.sin(time*10+side+i)*4);c.stroke();
            c.fillStyle=tint;c.beginPath();
            c.moveTo(x-facing*7,y);c.lineTo(x-facing*17,y-3);
            c.lineTo(x-facing*16,y+12);c.lineTo(x-facing*10,y+16);
            c.closePath();c.fill();
          });
        }
        c.fillStyle='#f8d58e';c.font='bold 20px system-ui';c.textAlign='center';
        c.fillText('⚔',left+w/2,top+111);
        c.fillStyle='#b9c9c5';c.font='10px system-ui';
        c.fillText('示意放大 · 選擇 Miracle 時還原完整地圖',left+w/2,top+138);
        c.restore();
      }
    }
  }
  function onMap(e) {
    const rect=canvas.getBoundingClientRect();const x=Math.floor((e.clientX-rect.left)*state.width/rect.width), y=Math.floor((e.clientY-rect.top)*state.height/rect.height);
    if(x<0||y<0||x>=state.width||y>=state.height)return;
    if(!armedMiracle){
      const oracle=oracleMarkerAt({x,y});
      if(oracle){focusOpponentOracle(oracle.id);return;}
    }
    if(armedMiracle){
      const aim=healAimAt({x,y});
      const id=armedMiracle,r=S.castMiracle(state,id,{x:aim.x,y:aim.y,...opts()});
      const effectTime=r.instant?'瞬間（0 日）':format(r.durationDays,0)+' 日';
      say(r.ok?(powerMeta('miracle',id)?.label||id)+
        ` 已${r.overcast?'強制':''}施展（${r.costMultiplier}×），消耗 ${r.cost} DP；`+
        `半徑 ${r.radius} 格，作用時間 ${effectTime}。`:r.reason);
      if(r.ok){
        lastCastVisual=r.instant?{x:aim.x,y:aim.y,radius:r.radius,untilMs:performance.now()+2400}:null;
        healLock=null;armedMiracle=null;
      }
      render();return;
    }
    const mx=(e.clientX-rect.left)*canvas.width/rect.width;
    const my=(e.clientY-rect.top)*canvas.height/rect.height;
    let marked=null,hit=Infinity;
    for(const id of state.religion.priests){
      const priest=state.people.find(p=>p.id===id&&p.alive);
      if(!priest||!S.priestPetitions(state,id).length)continue;
      const b=priestBubblePosition(priest,canvas.width/state.width);
      const d=Math.hypot(mx-b.x,my-b.y);
      if(d<=b.radius+5&&d<hit){marked=priest;hit=d;}
    }
    if(marked){
      if(activePriestId!==marked.id)priestPetitionIndex=0;
      activePriestId=marked.id;showInspector('needs');
      selectedNeedId=S.priestPetitions(state,activePriestId)[priestPetitionIndex]?.id||null;
      cursor=null;render();
      say(`查看 ${marked.name} 彙整的信徒祈求與來源位置。`);
      return;
    }
    const marker=currentNeed();
    if(marker?.location&&Math.hypot(x-marker.location.center.x,y-marker.location.center.y)<=1.6){
      showInspector('needs');return;
    }
    const dispute=(state.politics?.disputes||[]).slice().reverse().find(c=>
      Math.hypot(c.site.x-x,c.site.y-y)<=2.3&&
      (['marching','clashing'].includes(c.status)||
       (c.resolvedAtHour!==null&&state.hour-c.resolvedAtHour<8*24)));
    if(dispute){
      selectedDisputeId=dispute.id;render();
      const summary=conflictSummary(dispute);
      say('已定位石礦爭端：'+summary.sideA+' 對 '+summary.sideB+'。'+summary.status);
      return;
    }
    const site=(state.religiousSites||[]).find(v=>Math.hypot(v.x-x,v.y-y)<=1.5);
    if(site){
      selectedTownId=site.townId;showInspector('town');
      say('宗教集會點：'+(site.stage==='temple'?'Temple':site.stage==='shrine'?'Shrine':'自然聚會／遺址')+
        '；查看所在聚落的活動與建造進度。');
      return;
    }
    let selected=null,dd=Infinity;for(const p of state.people){if(!p.alive)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<dd){selected=p;dd=d;}}
    if(selected && dd<3.2){chosen=selected.id;showInspector('person');say(`正在觀察 ${selected.name} 的生活與工作選擇`);}else say(`土地 (${x}, ${y})：點選居民標記可查看個人的行動原因。`);
  }
  function receiveFastForwardNotice(notes){
    const note=notes.find(v=>v.type==='battle'||v.type==='battle-wounded')||
      notes.find(v=>v.level==='pause')||notes.find(v=>v.level==='slow');
    if(!note)return false;
    selectSpeed(note.type==='battle'||note.type==='battle-wounded'?0.1:1);
    attentionFocus=note;
    if(note.type==='battle'||note.type==='battle-wounded'){
      selectedDisputeId=note.disputeId;
      // First contact auto-pauses before damage. Resuming defaults to 0.1×,
      // giving 20 real seconds per simulation day; users can still change it.
      // No real-time reaction deadline, even when prior speed was 16×.
      paused=true;
      attentionFocus={...note,level:'pause'};
      say(note.type==='battle'?
        '民兵接戰，模擬已自動暫停（尚未造成戰鬥傷害）。已切至 0.1×；按繼續後慢速交戰，仍可施放神蹟。':
        '首輪交戰出現傷兵，模擬已自動暫停。已切至 0.1×；可先 Heal，按繼續才進入下一回合。');
      render();return true;
    }
    if(note.level==='pause'){
      paused=true;
      if(state.people.some(p=>p.id===note.personId&&p.alive))chosen=note.personId;
      showInspector('person');
      say('快進已暫停：'+note.text);
    }else{
      // A new, real prayer slows time and locates the actual petition center.
      paused=false;activePriestId=null;priestPetitionIndex=0;
      const prayers=openPrayers();
      const index=prayers.findIndex(p=>p.id===note.prayerId);
      if(index>=0){selectedNeedId=note.prayerId;needPage=Math.floor(index/3);}
      showInspector('needs');
      say('已切換 1×：'+note.text);
    }
    render();
    return true;
  }
  function animate(t) {
    const dt=Math.min(250,t-(previous||t));previous=t;
    if(!paused){
      acc+=dt/1000*ticksPerRealSecond*speed;
      const count=Math.min(Math.floor(acc),200);
      if(count>0){
        acc-=count;
        if(speed<=1){
          for(let i=0;i<count;i++){
            S.advanceTicks(state,1);
            if(announceVictoryIfNeeded())break;
            const items=(state.attention?.items||[]).filter(n=>n.seq>lastAttentionSeq);
            lastAttentionSeq=state.attention?.seq||lastAttentionSeq;
            // Ordinary prayer slowdown stays a fast-forward feature.
            // Actual combat, however, must pause even at 1×.
            if(items.some(n=>n.type==='battle'||n.type==='battle-wounded')&&
              receiveFastForwardNotice(items.filter(n=>
                n.type==='battle'||n.type==='battle-wounded')))break;
          }
        }else{
          // Check each simulation tick, not the end of a fast-forward batch:
          // otherwise an urgent event could be skipped by many simulated days.
          for(let i=0;i<count;i++){
            S.advanceTicks(state,1);
            if(announceVictoryIfNeeded())break;
            const items=(state.attention?.items||[]).filter(n=>n.seq>lastAttentionSeq);
            if(items.length){
              lastAttentionSeq=state.attention.seq;
              if(receiveFastForwardNotice(items))break;
            }
          }
        }
      }
    }
    if(t-lastDraw>145){lastDraw=t;render();}
    requestAnimationFrame(animate);
  }
  $('battleFocusBtn').onclick=()=>{
    const battle=visibleConflict();
    if(!battle)return;
    selectedDisputeId=battle.id;
    const info=conflictSummary(battle);
    attentionFocus={level:'battle',center:battle.site};
    say('戰場座標 ('+battle.site.x+', '+battle.site.y+')：'+info.sideA+
      ' 對 '+info.sideB+'；'+info.status);
    render();
  };
  $('pauseBtn').onclick=()=>{if(paused&&state.victory?.winner&&!state.victory.continued){showVictoryDialog();return;}paused=!paused;render();};
  document.querySelectorAll('[data-speed]').forEach(btn=>btn.onclick=()=>{
    selectSpeed(Number(btn.dataset.speed));render();
  });
  ['radius','intensity','duration'].forEach(id=>$(id).addEventListener('input',()=>{
    rememberMiracleSettings();updateCost();draw();
  }));
  $('rainBtn').onclick=toggleMiracleTarget;
  $('oracleBtn').onclick=()=>{
    const r=S.issueOracle(state,{saintId:selectedSaintId,intentType:selectedPower()});
    say(r.ok?(r.reset?'特化已解除；居民回歸自主需求。':
      r.replaced?.length?'已直接替換這位 Saint 的舊神諭，新策略開始傳播。':
      '神諭已交給 Saint；居民稍後自主聆聽與回應。'):r.reason);
    render();
  };
  $('concludeBtn').onclick=()=>{const o=state.religion.oracles.find(v=>v.status==='active'&&v.saintId===selectedSaintId&&v.intentType===selectedPower());const r=S.concludeOracle(state,o?.id);say(r.ok?'神已宣告此指派完成。':r.reason);render();};
  canvas.addEventListener('click',onMap);
  canvas.addEventListener('mousemove',e=>{
    const rect=canvas.getBoundingClientRect();
    cursor={x:Math.floor((e.clientX-rect.left)*state.width/rect.width),
      y:Math.floor((e.clientY-rect.top)*state.height/rect.height)};
    if(armedMiracle==='heal'){
      const nearby=nearVisibleInjured(cursor);
      if(nearby)healLock={id:nearby.id,anchor:{...cursor}};
      else if(healLock&&Math.hypot(cursor.x-healLock.anchor.x,
        cursor.y-healLock.anchor.y)>2.6)healLock=null;
    }
  });
  canvas.addEventListener('mouseleave',()=>{cursor=null;healLock=null;});
  $('residentSelect').onchange=e=>{chosen=e.target.value;render();};
  $('saintSelect').onchange=e=>{selectedSaintId=e.target.value;render();};
  $('settlementSelect').onchange=e=>{selectedTownId=e.target.value;housePage=0;render();};
  $('housePrev').onclick=()=>{housePage=Math.max(0,housePage-1);render();};
  $('houseNext').onclick=()=>{housePage++;render();};
  $('miracleTab').onclick=()=>{showDivineKind('miracle');armMiracleTarget();};
  $('oracleTab').onclick=()=>showDivineKind('oracle');
  $('divinePowerSelect').onchange=()=>{
    armedMiracle=null;healLock=null;
    if(divineKind==='miracle'){
      rememberMiracleSettings();
      rememberedPower.miracle=selectedPower();
      configureMiracle(selectedPower());
      armMiracleTarget(); // Selecting a Miracle is the first step of casting.
    }else{
      rememberedPower.oracle=selectedPower();
      render();
    }
  };
  document.querySelectorAll('[data-inspect-tab]').forEach(button=>button.onclick=()=>{if(button.dataset.inspectTab==='needs'){activePriestId=null;priestPetitionIndex=0;needPage=0;}showInspector(button.dataset.inspectTab);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&armedMiracle){
      armedMiracle=null;render();
    }else if(e.key==='Escape'&&selectedNeedId){
      selectedNeedId=null;render();
    }else if(e.key==='Escape'&&attentionFocus){
      attentionFocus=null;render();
    }else if(e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
    else if(!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)&&
      !document.activeElement?.isContentEditable){
      if(e.code==='Space'){
        e.preventDefault();if(paused&&state.victory?.winner&&!state.victory.continued){showVictoryDialog();return;}paused=!paused;render();
      }else if(!e.repeat&&/^[1-9]$/.test(e.key)){
        e.preventDefault();
        selectMiracleByHotkey(availablePowers.miracle[Number(e.key)-1].id);
      }
    }
  });
  $('victoryStatusBtn').onclick=showVictoryDialog;
  $('victoryCloseBtn').onclick=()=>$('victoryDialog').close();
  $('victoryConfirmBtn').onclick=()=>{
    if($('victoryContinueCheck').checked){
      S.continueVictory(state);
      paused=false;
      say('已進入自由沙盒；神力、冷卻、Presence 與 AI 規則完全不變。');
    }else{
      paused=true;
      say('勝負已結算，世界保持暫停。可點擊主導率重新選擇繼續遊戲。');
    }
    $('victoryDialog').close();render();
  };
  $('saveBtn').onclick=save;
  $('loadBtn').onclick=()=>{let raw=null;try{raw=localStorage.getItem(storageKey()) || localStorage.getItem('wog-mvp0-web-save');}catch(_){}if(raw)restore(raw);else say('目前沒有本機存檔；可以匯入 JSON。');};
  $('exportBtn').onclick=exportSave;
  $('importBtn').onclick=()=>$('importFile').click();
  $('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024){say('檔案超過 10 MB，無法匯入。');return;}restore(await file.text());e.target.value='';});
  $('applyAgricultureBtn').onclick=async()=>{
    if(profileLoading)return;
    if(!state.agriculture){say('目前使用 Original；請先選擇 Agriculture 世界。');return;}
    if(!confirm('更新目前世界的 Agriculture 平衡參數？會保留人口、食物庫存、已開墾農田及歷史，不會重新創世。建議先儲存或匯出備份。'))return;
    try{
      const latest=await loadAgriculture();
      const r=S.applyAgricultureProfile(state,latest);
      if(!r.ok){say(r.reason);return;}
      activeProfile=state.agriculture;
      render();say('已套用最新農業產能與擴張規則；世界歷史與食物存量完整保留。');
    }catch(e){say('更新失敗：'+e.message);}
  };
    $('resetBtn').onclick=()=>{if(!confirm('要重新開始此試玩情境嗎？目前未儲存的進度會消失。'))return;newWorld();say('試玩世界已重新生成。');};
  $('helpBtn').onclick=()=>$('infoDialog').showModal();$('closeHelp').onclick=()=>$('infoDialog').close();
  // New playtests start with the latest experimental Agriculture profile.
  // Loading failure is explicit and falls back to the reproducible Original rules.
  $('balanceProfile').disabled=true;$('opponentMode').disabled=true;
  $('playtestScenario').disabled=true;
  $('aiDifficulty').disabled=true;$('resetBtn').disabled=true;
  showDivineKind('miracle');showInspector('needs');
  requestAnimationFrame(animate);
  Promise.allSettled([loadAgriculture(),loadReligion(),loadMobility(),loadDivine(),loadOpponent(),loadOracleStrategy(),loadPlaytest(),loadShrine(),loadVictory(),loadPolity()]).then(([agriculture,religion,mobility,divine,opponent,oracleStrategy,playtest,shrine,victory,polity])=>{
    activeProfile=agriculture.status==='fulfilled'?agriculture.value:null;
    activeReligionProfile=religion.status==='fulfilled'?religion.value:null;
    activeMobilityProfile=mobility.status==='fulfilled'?mobility.value:null;
    activeDivineProfile=divine.status==='fulfilled'?divine.value:null;
    activeOpponentProfile=opponent.status==='fulfilled'?opponent.value:S.OPPONENT_DEFAULTS;
    activeOracleStrategyProfile=oracleStrategy.status==='fulfilled'?oracleStrategy.value:null;
    activePlaytestProfile=playtest.status==='fulfilled'?playtest.value:null;
    activeShrineProfile=shrine.status==='fulfilled'?shrine.value:null;
    activeVictoryProfile=victory.status==='fulfilled'?victory.value:null;
    activePolityProfile=polity.status==='fulfilled'?polity.value:null;
    if(!activeOracleStrategyProfile||!activePlaytestProfile||!activeShrineProfile||!Playtest)
      throw Error('可玩版必需的神諭策略或場景模組無法載入');
    $('playtestScenario').value=activePlaytestProfile.defaultScenario||'duel';
    // The initial unconfigured render displays the single-God placeholder.
    // Explicitly opt new browser worlds into the AI mode after profiles load.
    $('opponentMode').value='ai';
    newWorld();
    const failures=[agriculture,religion,mobility,divine,opponent,oracleStrategy,playtest,shrine,victory,polity].filter(x=>x.status==='rejected').map(x=>x.reason.message);
    say(failures.length?'Profile 載入失敗：'+failures.join('；'):
      '宗教對決已就緒。AI 選存糧；選育兒 Oracle → 傳下神諭 → 開始。');
  }).catch(err=>{
    console.error('Playtest bootstrap failed:',err);
    say('試玩世界無法啟動：'+err.message);
    $('pauseBtn').disabled=true;
  }).finally(()=>{
    profileLoading=false;$('balanceProfile').disabled=false;
    $('playtestScenario').disabled=false;
    $('opponentMode').disabled=scenarioId()!=='native';
    $('aiDifficulty').disabled=!state.opponent?.enabled||scenarioId()==='duel';
    $('resetBtn').disabled=false;render();
  });
})();
