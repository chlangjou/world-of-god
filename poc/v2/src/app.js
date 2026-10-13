/* Browser-only view/input adapter. All authoritative simulation resides in sim.js. */
(() => { 'use strict';
  const S = window.WoG2;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  let activeProfile = null, activeReligionProfile = null, activeDivineProfile = null, activeOpponentProfile = null, activeOracleStrategyProfile = null, profileLoading = true, divineKind = 'miracle', activeInspector = 'needs', housePage = 0, lastRoster = '';
  let state = S.create(), paused = true, speed = 1, acc = 0, previous = 0, lastDraw = 0;
  let armedMiracle = null, cursor = null, chosen = 'p1', lastEventId = -1, toastTimeout;
  let selectedTownId = null, lastTownRoster = '', selectedSaintId=null, lastSaintRoster='', activePriestId=null, priestPetitionIndex=0;
  let selectedNeedId=null, needPage=0, lastNeedsMarkup=null;
  let lastAttentionSeq=0,attentionFocus=null;
  const ticksPerRealSecond = 12 / 8;
  const format = (v, n=0) => Number(v || 0).toFixed(n);
  const html = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
  const taskName = {rest:'休息',family:'家庭／社交',pray:'祈禱',preach:'分享信仰',forage:'採集食物',farm:'耕作',wood:'伐木',stone:'採石',fiber:'採集纖維',build:'建造住所',care:'照顧家人／維護住所',dead:'已離世'};
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
      {id:'lightning',label:'雷擊 Lightning',hint:'立即傷害範圍內居民及作物，不區分信仰'},
      {id:'confusion',label:'混亂 Confusion',hint:'暫時干擾自主判斷、傳教協調；不直接改宗'},
      {id:'blindness',label:'致盲 Blindness',hint:'暫時縮短居民尋找資源和農田的範圍'}
    ],
    oracle:[
      {id:'food.produce',label:'存糧',hint:'優先實際糧食生產，會減少其他投入'},
      {id:'family.nurture',label:'育兒',hint:'加強家人照顧與有條件的生育投入，拓荒機會較低'},
      {id:'settlement.explore',label:'探索',hint:'提高建材、住房與拓荒優先度，非缺糧時減少農作投入'},
      {id:'religion.spread',label:'傳教',hint:'Saint 動員傳教意願，仍依接觸與真實成果判斷'},
      {id:'life.balance',label:'Reset · 回歸自主',hint:'神很滿意你們的行為，放下執著去追尋自己的需求'}
    ]
  };
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
    const maxIntensity=Math.round(rule.maxIntensity*100),maxDays=Math.max(1,rule.maxDays);
    radius.value=String(bounded(prior?.radius,rule.defaultRadius,Number(radius.min)||2,14));
    intensity.max=String(maxIntensity);
    intensity.value=String(bounded(
      prior?.intensityPercent,Math.round(rule.defaultIntensity*100),
      Number(intensity.min)||30,maxIntensity));
    duration.max=String(maxDays);
    duration.value=String(bounded(
      prior?.durationDays,rule.defaultDurationDays||1,Number(duration.min)||1,maxDays));
    $('durationLabel').hidden=!!rule.instant;
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
    picker.innerHTML=entries.map(p=>`<option value="${p.id}">${p.label}</option>`).join('');
    picker.value=entries.some(p=>p.id===rememberedPower[kind])?
      rememberedPower[kind]:availablePowers[kind][0].id;
    rememberedPower[kind]=picker.value;
    if(kind==='miracle')configureMiracle(selectedPower());
    render();
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
  function toggleMiracleTarget(){
    if(profileLoading)return;
    if(divineKind!=='miracle')showDivineKind('miracle');
    if(armedMiracle){armedMiracle=null;render();return;}
    const id=selectedPower(),target=cursor||state.camp;
    const result=S.evaluateMiracle(state,id,{x:target.x,y:target.y,...opts()});
    if(state.god.dp+1e-8<result.cost){
      say(result.reason||'目前 Divine Power 不足');updateCost();return;
    }
    // The cursor may currently be over an empty/no-presence area. Do not prevent
    // aiming elsewhere; every clicked map center is independently validated.
    armedMiracle=id;render();
    say((result.overcast?'冷卻中強制施放（'+result.costMultiplier+'× DP）：':'請點擊地圖施展 ')+
      powerMeta('miracle',id).label+'。Esc 可取消。');
  }
  function say(text) { const box=$('toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('visible'),3000); }
  function opts() { return {radius:+$('radius').value,intensity:+$('intensity').value/100,durationDays:+$('duration').value}; }
  function storageKey() {return 'wog-poc-v2-save';}
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
  function newWorld() {
    state=S.create({seed:state.seed,...(activeProfile?{balanceProfile:activeProfile}:{}),
      religionProfile:activeReligionProfile,divineProfile:activeDivineProfile,
      oracleStrategyProfile:activeOracleStrategyProfile,
      worldGenesisMode:'native',
      opponentProfile:$('opponentMode').value==='ai'?
        {...(activeOpponentProfile||S.OPPONENT_DEFAULTS),
          difficulty:$('aiDifficulty').value||'standard'}:null});
    if(divineKind==='miracle')configureMiracle(selectedPower());
    else showDivineKind('oracle');
    $('balanceProfile').value=state.balanceProfileId==='agriculture-balance-v0.1'?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    if(state.opponent)$('aiDifficulty').value=state.opponent.difficulty||'standard';
    paused=true;speed=1;acc=0;lastAttentionSeq=state.attention?.seq||0;attentionFocus=null;chosen='p1';lastEventId=-1;lastRoster='';lastTownRoster='';selectedTownId=null;selectedSaintId=null;lastSaintRoster='';activePriestId=null;priestPetitionIndex=0;housePage=0;armedMiracle=null;selectedNeedId=null;needPage=0;lastNeedsMarkup=null;$('events').scrollTop=0;
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',+b.dataset.speed===1));
    render();
  }
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
    activeOracleStrategyProfile=state.oracleStrategy||activeOracleStrategyProfile;
    if(state.opponent?.enabled&&state.opponent.profileId!=='opponent-v0.1')
      activeOpponentProfile=state.opponent;
    $('balanceProfile').value=activeProfile?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    $('aiDifficulty').value=state.opponent?.difficulty||'standard';
    armedMiracle=null;chosen=state.people.find(p=>p.alive)?.id||null;paused=true;acc=0;lastAttentionSeq=state.attention?.seq||0;attentionFocus=null;lastEventId=-1;lastRoster='';lastTownRoster='';selectedTownId=null;selectedSaintId=null;lastSaintRoster='';activePriestId=null;priestPetitionIndex=0;housePage=0;selectedNeedId=null;needPage=0;lastNeedsMarkup=null;$('events').scrollTop=0;if(divineKind==='miracle')configureMiracle(selectedPower());else showDivineKind('oracle');render();say(state.agriculture&&!state.agriculture.workDemand?'舊版 Agriculture 存檔保留舊參數；請重新創世以套用新糧食平衡。':converted?'舊版存檔已升級；既有死亡不會倒轉。':'世界已讀取，並處於暫停狀態。');}catch(e){say('讀取失敗：'+e.message);} }
  function exportSave() { const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`world-of-god-mvp0-day-${S.days(state)+1}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function updateCost(){
    if(divineKind!=='miracle')return;
    const id=selectedPower();
    $('radiusValue').textContent=$('radius').value+' 格';
    $('intensityValue').textContent=format(+$('intensity').value/100,2)+'×';
    $('durationValue').textContent=$('durationLabel').hidden?'即時':$('duration').value+' 日';
    const target=cursor||currentNeed()?.location?.center||state.camp,
      preview=S.evaluateMiracle(state,id,{x:target.x,y:target.y,...opts()});
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
      preview.reason||`已就緒 · ${forecast}`;
    $('rainBtn').textContent=armedMiracle?'取消選擇位置':
      preview.overcast?`強制施放 ${preview.costMultiplier}×`:'選擇施展位置';
    $('rainBtn').disabled=profileLoading||state.god.dp+1e-8<(preview.cost??Infinity);
    $('rainBtn').title=preview.reason||
      `點圖施放將依當下神力、連發倍率與目標重新驗證；${forecast}`;
    $('rainBtn').classList.toggle('secondary',!!armedMiracle);
  }
  function render() {
    if(selectedNeedId&&!currentNeed()?.location)selectedNeedId=null;
    const located=currentNeed();
    const st=S.stats(state), current=state.people.find(p=>p.id===chosen);
    $('day').textContent=`第 ${st.day} 日`;
    $('weather').textContent=st.phase==='dry'?'乾旱期':st.phase==='rainy'?'雨季':'和暖時節';
    $('peopleMetric').textContent=st.people;
    $('familiesMetric').textContent=`${st.households} 個家戶 · 出生 ${st.births} / 死亡 ${st.deaths}`;
    $('townMetric').textContent=st.settlements>1?`${st.settlements} 處聚落`:st.settlements?state.settlements[0].name:'尚未形成';
    $('houseMetric').textContent=`${st.houses}/${st.households} 有住所 · 新成家 ${st.newFamilies||0}`;
    const dailyNeed=state.people.filter(p=>p.alive).reduce((a,p)=>a+(p.stage==='child'?state.rules.foodNeedChild:state.rules.foodNeedAdult),0);
    $('foodMetric').textContent=format(st.food);
    $('stockMetric').textContent=`約 ${format(st.food/Math.max(dailyNeed,.01),1)} 日 · 公共 ${format(st.commonFood)}`;
    $('followersMetric').textContent=st.opponentEnabled?
      `${st.followers} / ${st.opponentFollowers}`:st.followers;
    $('followersMetric').title=st.opponentEnabled?'我方信徒 / 對手信徒（虔誠度 40+）':'我方信徒（虔誠度 40+）';
    $('devotionMetric').textContent=st.opponentEnabled?
      `信眾 己 ${st.believers} / 敵 ${st.opponentBelievers} · 未入教 ${st.unaffiliated}`:
      `信眾 ${st.believers} · 未入教 ${st.unaffiliated} · 奉獻 ${format(st.devotionWeight)}`;
    $('powerMetric').textContent=format(state.god.dp,1);$('powerRate').textContent=`+${format(st.dpRateDay,2)} DP / 模擬日`;
    $('powerFill').style.width=Math.min(100,state.god.dp/state.god.cap*100)+'%';
    $('pauseBtn').textContent=paused?'▶ 開始 / 繼續':'Ⅱ 暫停';
    $('pauseBtn').disabled=profileLoading;
    $('balanceProfile').value=state.agriculture?'agriculture':'original';
    $('opponentMode').value=state.opponent?.enabled?'ai':'off';
    $('aiDifficulty').disabled=profileLoading||!state.opponent?.enabled;
    if(state.opponent)$('aiDifficulty').value=state.opponent.difficulty||'standard';
    $('applyAgricultureBtn').disabled=profileLoading||!state.agriculture;
    $('mapStatus').textContent=profileLoading?'載入平衡設定中…':located?.location?
      `已定位 ${needTitles[located.prayer.type]||'需求'} · ${located.location.locationName} (${format(located.location.center.x)}, ${format(located.location.center.y)})`:
      state.agriculture?(state.nativeWorld?'原住民已在此生活 · Agriculture v0.1':'Agriculture v0.1 · 河流、季節與實際農作物'):
        'Original · 原始平衡對照';
    $('mapTip').hidden=!armedMiracle;
    $('simHint').textContent=armedMiracle?('已選擇'+(powerMeta('miracle',armedMiracle)?.label||'神蹟')+'：點擊地圖施展（Esc 取消）'):
      attentionFocus?.level==='pause'?('已暫停：'+attentionFocus.text+' · Esc 清除定位'):
      located?.location?'需求中心已標示於地圖；缺雨虛線圈是農田評估範圍，不會自動施展神蹟。':
      st.settlements?'居民繼續自治。觀察天候、糧倉與神諭的實際後果。':'正在尋找建材、建造住屋；聚落不由神明直接放置。';
    $('simRate').textContent=`${speed}× · 約 ${format(2/speed,2)} 秒 / 模擬日`;
    updateCost();
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
    $('oracleReason').textContent=active?active.propagatedAtHour===null?'Saint 已接收，準備向居民傳達。':
      `已傳播到 ${active.heardCount} 位可聆聽的居民；實際結果仍取決於當地活動。`:
      (saint?S.checkOracle(state,saint.id,intent).reason||'神諭不消耗 DP；會使用 Saint 個人接收額度。':'需要合格 Saint 和可用額度');
    $('oracleBtn').disabled=profileLoading||!saint||!S.checkOracle(state,saint?.id,intent).ok;
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
    const rivalTown=town&&state.opponent?.enabled?
      `<p title="${html(state.opponentReligion.name)}：S=Saint，P=Priest；對手以真實信徒恢復神力">對手：信眾 ${localReligion.opponentBelievers} ·
        40+ ${localReligion.opponentFollowers} · S${localReligion.opponentSaints}/P${localReligion.opponentPriests}
        · ${format(state.opponentGod.dp)} DP</p>`:'';
    const reserveHint=town?.workDemand?.reserveTargetDays?
      ` · 儲糧目標 ${town.workDemand.reserveTargetDays} 日`:'';
    const granary=town?.granary;
    const granaryStatus=granary?.built?'已建成':
      granary?.materialsPaid?'建造中':granary?'籌備建材':'尚無計畫';
    $('townPanel').innerHTML=town?`<p><b>${html(town.name)}</b>${town.native?' · 原生聚落':''} · 第 ${Math.floor(town.foundedAtHour/24)+1} 日形成。${town.famineActive?' · 目前正處於飢荒危機':''}</p><p title="信眾為 Devotion 20+；信徒為 40+。Saint 與 Priest 是獨立角色。">宗教：信眾 ${localReligion.believers}/${localReligion.population} · 未入教 ${localReligion.unaffiliated} · 信徒 ${localReligion.followers} · Saint ${localReligion.saints} / Priest ${localReligion.priests} · 神諭 ${localReligion.activeOracles}</p>${rivalTown}<p title="未完成糧倉時，公共糧食以臨時共同儲備方式保管並保持可及；真正的糧倉需使用本聚落材料及居民建造。">公共糧倉：${granaryStatus} · 本地公糧 ${format(town.storage.food)} · 石材 ${format(town.storage.stone,1)}${reserveHint}</p><div class="details-grid"><div><small>共享糧食</small><b>${format(town.storage.food)}</b></div><div><small>共享木材</small><b>${format(town.storage.wood)}</b></div><div><small>食物需求壓力</small><b>${format(town.workDemand.foodPressure*100)}%</b></div><div><small>住房需求</small><b>${format(town.workDemand.housingPressure*100)}%</b></div></div>`:
      `<p>尚未形成正式聚落。當附近家戶實際收集材料、完成至少 ${state.rules.settlementMinHuts} 座住所並維持聚居，才會開始共同生活。</p><div class="details-grid"><div><small>已建住屋</small><b>${st.houses}</b></div><div><small>仍需住屋</small><b>${st.householdsUnhoused}</b></div></div>`;
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
      const religious=current.religionId===state.religion.id?state.religion.name:
        current.religionId===state.opponentReligion?.id?state.opponentReligion.name:'尚未歸屬';
      const isOpponent=current.religionId===state.opponentReligion?.id;
      const isPriest=(isOpponent?state.opponentReligion?.priests:state.religion.priests).includes(p.id);
      const isSaint=(isOpponent?state.opponentReligion?.saints:state.religion.saints).includes(p.id);
      const roles=[isSaint?'Saint · 神諭聆聽者':null,isPriest?'Priest · 祭司':null].filter(Boolean);
      const prayerCount=isPriest&&!isOpponent?S.priestPetitions(state,p.id).length:0;
      const roleInfo=roles.length?`<div class="priest-summary">${html(roles.join(' / '))}${prayerCount?` · 已彙整 ${prayerCount} 類祈求（點地圖泡泡查看）`:''}</div>`:'';
      const workDay=dec && Number.isFinite(dec.hour)?`第 ${Math.floor(dec.hour/24)+1} 日的`:'先前的';
      const statusText=Object.entries(p.divineStatuses||{}).filter(([,v])=>v.endsAtHour>state.hour)
        .map(([key,v])=>(S.POWER_DEFAULTS[key]?.label||key)+` · 剩餘 ${Math.ceil((v.endsAtHour-state.hour)/24)} 日`).join('／');
      const activeReason=p.activityReason?`<div class="reason" title="${html(p.activityReason)}" tabindex="0"><b>此刻行動：</b>${html(p.activityReason)}</div>`:'';
      const evidence=p.lastFaithEvidence&&state.hour-p.lastFaithEvidence.hour<=90*24?
        `<div class="reason" title="真實神蹟或神諭成果造成的信仰改變；並非施法就直接改宗" tabindex="0"><b>最近的信仰證據：</b>${html(p.lastFaithEvidence.cause)}${p.lastFaithEvidence.change?
          ' · '+(p.lastFaithEvidence.change>0?'+':'')+format(p.lastFaithEvidence.change):''}</div>`:'';
      const impressions=Object.entries(p.miracleInterest||{}).filter(([,record])=>
        record.expiresAtHour>state.hour&&record.score>0).map(([godId,record])=>
        (godId===state.god.id?state.religion.name:state.opponentReligion?.name||godId)+
        ' '+format(record.score)).join('／');
      const impressionHint=impressions?`<div title="對神蹟的暫時印象會影響個人日後自行接受宗教的可能；尚不等於改宗">神蹟印象：${html(impressions)}</div>`:'';
      $('personDetail').innerHTML=`<h3>${html(p.name)} · ${current.age} 歲</h3><div>${html(h?.name||'')} · ${stageName[p.stage]||'居民'}${nativeInfo} · ${religious}</div>${roleInfo}${statusText?`<div class="divine-status">限時狀態：${html(statusText)}</div>`:''}<div>信仰 ${format(p.devotion)} / 100 · 健康 ${format(p.health)} · 飢餓 ${format(p.hunger*100)}%</div><div>職業：${occupationName[p.occupation]||html(p.occupation)} · 此刻：${taskName[p.activity]||html(p.activity)}</div>${evidence}${impressionHint}${activeReason}<div class="reason" title="${html(dec?.reason||'尚未進行工作決策')}" tabindex="0">${dec?`${workDay}工作選擇：${taskName[dec.work]||html(dec.work)}。${html(dec.reason)}${dec.oracleInfluence>0?`（神諭加權 +${format(dec.oracleInfluence,1)}）`:''}${dec.changedByOracle?' · 神諭實際改變了最高優先工作的選擇':''}`:'尚未進行工作決策。'}</div>`;
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
        .map(e=>`<div class="event ${html(e.kind)}" data-event-id="${html(e.id)}"><small>第 ${Math.floor(e.hour/24)+1} 日 · ${html(e.kind)}</small><div>${html(e.text)}</div>${e.reasons?.length?`<details><summary>原因</summary>${e.reasons.map(x=>'<div>'+html(x)+'</div>').join('')}</details>`:''}</div>`).join('')||'<div class="muted">尚無重大歷史事件</div>';
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
    for(const t of state.settlements){c.save();c.strokeStyle=t.id===selectedTownId?'#f4d69f':t.native?'#98cbb7':'#bed9b4';c.lineWidth=t.id===selectedTownId?2:1.4;c.setLineDash([8,7]);c.beginPath();c.arc(t.x*size,t.y*size,state.rules.settlementClusterDistance*size,0,2*Math.PI);c.stroke();c.setLineDash([]);c.font='bold 14px system-ui';c.textAlign='center';c.fillStyle='#faeed3';c.shadowColor='#0d1e18';c.shadowBlur=7;c.fillText(t.name,(t.x+1)*size,(t.y-5)*size);c.restore();}
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
    const saintIds=new Set(state.religion.saints), priestIds=new Set(state.religion.priests);
    const rivalSaintIds=new Set(state.opponentReligion?.saints||[]),
      rivalPriestIds=new Set(state.opponentReligion?.priests||[]);
    for(const p of state.people){if(!p.alive)continue;const px=(p.x+.5)*size,py=(p.y+.5)*size;
      const saint=saintIds.has(p.id),priest=priestIds.has(p.id),
        rivalSaint=rivalSaintIds.has(p.id),rivalPriest=rivalPriestIds.has(p.id),
        rival=p.religionId===state.opponentReligion?.id;
      c.beginPath();c.arc(px,py,p.stage==='child'?size*.23:size*.32,0,Math.PI*2);
      c.fillStyle=rivalSaint?'#ff7d98':rivalPriest?'#f0a070':rival?'#cf7775':
        saint?'#80e4eb':priest?'#c4a2fa':p.devotion>=40?'#f6d2a0':p.devotion>=20?'#e1e6c2':'#bcd9d2';
      c.fill();c.strokeStyle='#21342fcc';c.lineWidth=1.4;c.stroke();
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
      if(kind==='rain'){
        c.strokeStyle='#acd7e680';
        for(let i=0;i<30;i++){const aa=i*2.39996,rr=(i%10)/10*e.radius*size;const x=e.x*size+Math.cos(aa)*rr,y=e.y*size+Math.sin(aa)*rr;const fall=(time*19+i*13)%24;c.beginPath();c.moveTo(x,y+fall-12);c.lineTo(x-3,y+fall);c.stroke();}
      }
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
    if(armedMiracle) {
      const target=cursor||source?.location?.center||state.camp;
      c.save();c.strokeStyle='#ffdda7';c.lineWidth=3;c.setLineDash([7,4]);
      c.beginPath();c.arc(target.x*size,target.y*size,+$('radius').value*size,0,Math.PI*2);c.stroke();c.restore();
    }
  }
  function onMap(e) {
    const rect=canvas.getBoundingClientRect();const x=Math.floor((e.clientX-rect.left)*state.width/rect.width), y=Math.floor((e.clientY-rect.top)*state.height/rect.height);
    if(x<0||y<0||x>=state.width||y>=state.height)return;
    if(armedMiracle){
      const id=armedMiracle,r=S.castMiracle(state,id,{x,y,...opts()});
      say(r.ok?(powerMeta('miracle',id)?.label||id)+
        ` 已${r.overcast?'強制':''}施展（${r.costMultiplier}×），消耗 ${r.cost} DP；世界繼續自主運作。`:r.reason);
      if(r.ok)armedMiracle=null;
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
    let selected=null,dd=Infinity;for(const p of state.people){if(!p.alive)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<dd){selected=p;dd=d;}}
    if(selected && dd<3.2){chosen=selected.id;showInspector('person');say(`正在觀察 ${selected.name} 的生活與工作選擇`);}else say(`土地 (${x}, ${y})：點選居民標記可查看個人的行動原因。`);
  }
  function receiveFastForwardNotice(notes){
    const note=notes.find(v=>v.level==='pause')||notes.find(v=>v.level==='slow');
    if(!note)return false;
    speed=1;acc=0;
    document.querySelectorAll('[data-speed]').forEach(b=>
      b.classList.toggle('active',Number(b.dataset.speed)===1));
    attentionFocus=note;
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
          S.advanceTicks(state,count);
          lastAttentionSeq=state.attention?.seq||lastAttentionSeq;
        }else{
          // Check each simulation tick, not the end of a fast-forward batch:
          // otherwise an urgent event could be skipped by many simulated days.
          for(let i=0;i<count;i++){
            S.advanceTicks(state,1);
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
  $('pauseBtn').onclick=()=>{paused=!paused;render();};
  document.querySelectorAll('[data-speed]').forEach(btn=>btn.onclick=()=>{speed=+btn.dataset.speed;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===btn));render();});
  ['radius','intensity','duration'].forEach(id=>$(id).addEventListener('input',()=>{
    rememberMiracleSettings();updateCost();draw();
  }));
  $('rainBtn').onclick=toggleMiracleTarget;
  $('oracleBtn').onclick=()=>{const r=S.issueOracle(state,{saintId:selectedSaintId,intentType:selectedPower()});say(r.ok?(r.reset?'特化已解除；居民回歸自主需求。':'神諭已交給 Saint；居民稍後自主聆聽與回應。'):r.reason);render();};
  $('concludeBtn').onclick=()=>{const o=state.religion.oracles.find(v=>v.status==='active'&&v.saintId===selectedSaintId&&v.intentType===selectedPower());const r=S.concludeOracle(state,o?.id);say(r.ok?'神已宣告此指派完成。':r.reason);render();};
  canvas.addEventListener('click',onMap);
  canvas.addEventListener('mousemove',e=>{const rect=canvas.getBoundingClientRect();cursor={x:Math.floor((e.clientX-rect.left)*state.width/rect.width),y:Math.floor((e.clientY-rect.top)*state.height/rect.height)};});
  canvas.addEventListener('mouseleave',()=>{cursor=null;});
  $('residentSelect').onchange=e=>{chosen=e.target.value;render();};
  $('saintSelect').onchange=e=>{selectedSaintId=e.target.value;render();};
  $('settlementSelect').onchange=e=>{selectedTownId=e.target.value;housePage=0;render();};
  $('housePrev').onclick=()=>{housePage=Math.max(0,housePage-1);render();};
  $('houseNext').onclick=()=>{housePage++;render();};
  $('miracleTab').onclick=()=>showDivineKind('miracle');
  $('oracleTab').onclick=()=>showDivineKind('oracle');
  $('divinePowerSelect').onchange=()=>{
    armedMiracle=null;
    if(divineKind==='miracle'){
      rememberMiracleSettings();
      rememberedPower.miracle=selectedPower();
      configureMiracle(selectedPower());
    }else rememberedPower.oracle=selectedPower();
    render();
  };
  document.querySelectorAll('[data-inspect-tab]').forEach(button=>button.onclick=()=>{if(button.dataset.inspectTab==='needs'){activePriestId=null;priestPetitionIndex=0;needPage=0;}showInspector(button.dataset.inspectTab);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&armedMiracle){armedMiracle=null;render();}else if(e.key==='Escape'&&selectedNeedId){selectedNeedId=null;render();}else if(e.key==='Escape'&&attentionFocus){attentionFocus=null;render();}else if(e.code==='Space'&&!['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();paused=!paused;render();}else if(e.key==='1'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){toggleMiracleTarget();}});
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
    $('resetBtn').onclick=()=>{if(!confirm('要重新開始河谷世界嗎？目前未儲存的進度會消失。'))return;newWorld();say('新世界已生成。');};
  $('helpBtn').onclick=()=>$('infoDialog').showModal();$('closeHelp').onclick=()=>$('infoDialog').close();
  // New playtests start with the latest experimental Agriculture profile.
  // Loading failure is explicit and falls back to the reproducible Original rules.
  $('balanceProfile').disabled=true;$('opponentMode').disabled=true;
  $('aiDifficulty').disabled=true;$('resetBtn').disabled=true;
  showDivineKind('miracle');showInspector('needs');
  requestAnimationFrame(animate);
  Promise.allSettled([loadAgriculture(),loadReligion(),loadDivine(),loadOpponent(),loadOracleStrategy()]).then(([agriculture,religion,divine,opponent,oracleStrategy])=>{
    activeProfile=agriculture.status==='fulfilled'?agriculture.value:null;
    activeReligionProfile=religion.status==='fulfilled'?religion.value:null;
    activeDivineProfile=divine.status==='fulfilled'?divine.value:null;
    activeOpponentProfile=opponent.status==='fulfilled'?opponent.value:S.OPPONENT_DEFAULTS;
    activeOracleStrategyProfile=oracleStrategy.status==='fulfilled'?oracleStrategy.value:null;
    // The initial unconfigured render displays the single-God placeholder.
    // Explicitly opt new browser worlds into the AI mode after profiles load.
    $('opponentMode').value='ai';
    newWorld();
    const failures=[agriculture,religion,divine,opponent,oracleStrategy].filter(x=>x.status==='rejected').map(x=>x.reason.message);
    say(failures.length?'Profile 載入失敗，採用內建預設：'+failures.join('；'):
      'Agriculture、Religion、Divine Powers、AI 與 Oracle 特化已啟用。');
  }).finally(()=>{
    profileLoading=false;$('balanceProfile').disabled=false;$('opponentMode').disabled=false;
    $('aiDifficulty').disabled=!state.opponent?.enabled;
    $('resetBtn').disabled=false;render();
  });
})();
