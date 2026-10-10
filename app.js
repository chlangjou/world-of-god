/* Browser-only view/input adapter. All authoritative simulation resides in sim.js. */
(() => { 'use strict';
  const S = window.WoG2;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  let state = S.create(), paused = true, speed = 1, acc = 0, previous = 0, lastDraw = 0;
  let armedRain = false, cursor = null, chosen = 'p1', lastEventId = 0, toastTimeout;
  const ticksPerRealSecond = 12 / 8;
  const format = (v, n=0) => Number(v || 0).toFixed(n);
  const html = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
  const taskName = {rest:'休息',family:'家庭／社交',pray:'祈禱',forage:'採集食物',farm:'耕作',wood:'伐木',stone:'採石',fiber:'採集纖維',build:'建造住所',dead:'已離世'};
  const stageName = {adult:'成年人',child:'兒童',elder:'長者'};
  function say(text) { const box=$('toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('visible'),3000); }
  function opts() { return {radius:+$('radius').value,intensity:+$('intensity').value/100,durationDays:+$('duration').value}; }
  function storageKey() {return 'wog-mvp0-web-save';}
  function save() { try {localStorage.setItem(storageKey(),JSON.stringify(state));say('已儲存目前的世界。');}catch(e){say('瀏覽器儲存失敗：請改用「匯出」。');} }
  function restore(raw) {try{state=S.restore(raw);armedRain=false;chosen=state.people.find(p=>p.alive)?.id||null;paused=true;acc=0;lastEventId=0;render();say('世界已讀取，並處於暫停狀態。');}catch(e){say('讀取失敗：'+e.message);} }
  function exportSave() { const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`world-of-god-mvp0-day-${S.days(state)+1}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function updateCost() {
    $('radiusValue').textContent=$('radius').value+' 格';$('intensityValue').textContent=format(+$('intensity').value/100,2)+'×';$('durationValue').textContent=$('duration').value+' 日';
    const target=cursor||state.camp, preview=S.evalRain(state,{x:target.x,y:target.y,...opts()});
    $('rainCost').textContent=`預估 ${preview.cost} DP`;const left=Math.max(0,state.god.skills.rain.readyAtHour-state.hour);
    $('rainCooldown').textContent=left ? `冷卻中：剩餘 ${Math.ceil(left/24)} 模擬日` : preview.reason || '可選擇施展位置；已準備好';
    $('rainBtn').textContent=armedRain?'取消選擇位置':'選擇降雨位置';
    $('rainBtn').classList.toggle('secondary',armedRain);
  }
  function render() {
    const st=S.stats(state), current=state.people.find(p=>p.id===chosen);
    $('day').textContent=`第 ${st.day} 日`;
    $('weather').textContent=st.phase==='dry'?'乾旱期':st.phase==='rainy'?'雨季':'和暖時節';
    $('peopleMetric').textContent=st.people;
    $('familiesMetric').textContent=`${st.households} 個家戶 · 出生 ${st.births} / 死亡 ${st.deaths}`;
    $('townMetric').textContent=st.settlements?state.settlements[0].name:'尚未形成';
    $('houseMetric').textContent=`${st.houses} / ${st.households} 戶有住所`;
    $('foodMetric').textContent=format(st.food);$('stockMetric').textContent=`共同儲存：${format(st.commonFood)}`;
    $('followersMetric').textContent=st.followers;$('devotionMetric').textContent=`奉獻權重 ${format(st.devotionWeight)} · 平均信仰 ${format(st.avgDevotion,1)}`;
    $('powerMetric').textContent=format(state.god.dp,1);$('powerRate').textContent=`+${format(st.dpRateDay,2)} DP / 模擬日`;
    $('powerFill').style.width=Math.min(100,state.god.dp/state.god.cap*100)+'%';
    $('pauseBtn').textContent=paused?'▶ 開始 / 繼續':'Ⅱ 暫停';
    $('simHint').textContent=armedRain?'已選擇降雨：點擊地圖施展（Esc 取消）':st.settlements?'居民繼續自治。觀察天候、糧倉與神諭的實際後果。':'正在尋找建材、建造住屋；聚落不由神明直接放置。';
    $('simRate').textContent=`${speed}× · 約 ${format(2/speed,2)} 秒 / 模擬日`;
    updateCost();
    const saint=state.people.find(p=>p.id===st.saintId);
    $('saintName').textContent=saint?`${saint.name} · ${stageName[saint.stage]||''}`:'尚未出現（通常在初期信仰活動後）';
    const quota=saint&&state.religion.saintQuota?state.religion.saintQuota[saint.id]:null;
    $('saintQuota').textContent=quota?`${quota.quota} / ${state.rules.oracleQuota}`:'—';
    const active=st.activeOracle;
    $('oracleStatus').textContent=active?`持續中 · 已影響工作選擇 ${active.influenceWorkCount} 次`:'目前沒有有效指派';
    $('oracleReason').textContent=active?active.propagatedAtHour===null?'Saint 已接收，準備向居民傳達。':`已傳播到 ${active.heardCount} 位可能聽見的居民；是否改變行為仍取決於實際生活。`:'神諭不消耗 DP，但需要合格的 Saint 和他的接收額度。';
    $('oracleBtn').disabled=!saint||!quota||quota.quota<1||!!active;
    $('concludeBtn').hidden=!active;
    const prayers=state.religion.prayers.filter(p=>p.status==='open');
    const answered=state.religion.prayers.filter(p=>p.status==='answered').slice(-1);
    $('needsPanel').innerHTML=prayers.length?prayers.map(p=>`<div class="need-item"><strong>缺雨與糧食的祈禱</strong><small>第 ${Math.floor(p.createdAtHour/24)+1} 日 · ${p.by.length} 位信徒提出實際需要</small><small>請觀察雨後是否真的改善耕作，而非只看施法次數。</small></div>`).join(''):
      answered.length?'<div class="need-item"><strong>最近的祈求已獲得回應</strong><small>土地、勞動與食物真的出現變化；對應信徒的信仰已更新。</small></div>':'目前沒有迫切的祈禱。當水分、作物或糧食受到壓力，居民可能主動祈求。';
    $('weatherNotice').textContent=`農田平均含水 ${format(st.avgMoisture*100)}% · 作物生長 ${format(st.avgCrop*100)}% · ${st.phase==='dry'?'土地正失水，乾旱是有限的自然變化。':'降水、地力與居民的勞動共同決定糧食。'}`;
    const town=state.settlements[0];
    $('townPanel').innerHTML=town?`<p><b>${html(town.name)}</b> · 第 ${Math.floor(town.foundedAtHour/24)+1} 日形成。</p><div class="details-grid"><div><small>共享糧食</small><b>${format(town.storage.food)}</b></div><div><small>共享木材</small><b>${format(town.storage.wood)}</b></div><div><small>食物需求壓力</small><b>${format(town.workDemand.foodPressure*100)}%</b></div><div><small>住房需求</small><b>${format(town.workDemand.housingPressure*100)}%</b></div></div>`:
      `<p>尚未形成正式聚落。當附近家戶實際收集材料、完成至少 ${state.rules.settlementMinHuts} 座住所並維持聚居，才會開始共同生活。</p><div class="details-grid"><div><small>已建住屋</small><b>${st.houses}</b></div><div><small>仍需住屋</small><b>${st.householdsUnhoused}</b></div></div>`;
    $('houseList').innerHTML=state.households.map(h=>`<div><b>${html(h.name)}</b><small>${h.home?'已有住所':'準備建屋'} · 存糧 ${format(h.inventory.food,1)}</small></div>`).join('');
    $('personList').innerHTML=state.people.filter(p=>p.alive).slice(0,36).map(p=>`<button data-person="${p.id}" class="${p.id===chosen?'active':''}" type="button">${html(p.name)}</button>`).join('');
    if(current) {
      const p=current,h=state.households.find(v=>v.id===p.householdId),dec=p.lastDecision;
      const religious=current.religionId===state.religion.id?'初光信仰':'尚未歸屬';
      $('personDetail').innerHTML=`<h3>${html(p.name)} · ${current.age} 歲</h3><div>${html(h?.name||'')} · ${stageName[p.stage]||'居民'} · ${religious}</div><div>信仰 ${format(p.devotion)} / 100 · 健康 ${format(p.health)} · 飢餓 ${format(p.hunger*100)}%</div><div>職業：${html(p.occupation)} · 此刻：${taskName[p.activity]||html(p.activity)}</div><div class="reason">${dec?`上次工作：${taskName[dec.work]||html(dec.work)}。${html(dec.reason)}${dec.oracleInfluence>0?`（神諭決策權重 +${format(dec.oracleInfluence,1)}）`:''}${dec.changedByOracle?' ★ 相較一般決策，神諭使他的選擇改變':''}`:'尚未進行工作決策，開始歷史後可查看。'}</div>`;
    }
    // Preserve DOM details scroll as much as possible; event list redraw only on new events.
    if(lastEventId!==state.eventSeq) {
      lastEventId=state.eventSeq;
      $('events').innerHTML=state.events.slice(-25).reverse().map(e=>`<div class="event ${html(e.kind)}"><small>第 ${Math.floor(e.hour/24)+1} 日 · ${html(e.kind)} · #${e.id}</small><div>${html(e.text)}</div>${e.reasons?.length?`<details><summary>發生原因</summary>${e.reasons.map(x=>'<div>'+html(x)+'</div>').join('')}</details>`:''}</div>`).join('');
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
    if(state.settlements.length){const t=state.settlements[0];c.save();c.strokeStyle='#f4d69f';c.lineWidth=2;c.setLineDash([8,7]);c.beginPath();c.arc(t.x*size,t.y*size,14*size,0,2*Math.PI);c.stroke();c.setLineDash([]);c.font='bold 17px system-ui';c.textAlign='center';c.fillStyle='#faeed3';c.shadowColor='#0d1e18';c.shadowBlur=7;c.fillText(t.name,(t.x+1)*size,(t.y-11)*size);c.restore();}
    for(const p of state.people){if(!p.alive)continue;const px=(p.x+.5)*size,py=(p.y+.5)*size;
      c.beginPath();c.arc(px,py,p.stage==='child'?size*.23:size*.3,0,Math.PI*2);
      c.fillStyle=p.devotion>=40?'#f6d2a0':p.devotion>=20?'#e1e6c2':'#bcd9d2';c.fill();c.strokeStyle='#21342fcc';c.lineWidth=1.4;c.stroke();
      if(p.id===chosen){c.strokeStyle='#faf5c7';c.lineWidth=2;c.beginPath();c.arc(px,py,size*.59,0,Math.PI*2);c.stroke();}
    }
    for(const e of state.effects){if(state.hour>=e.endsAtHour)continue;c.save();c.fillStyle='#9dccde24';c.strokeStyle='#bfeaff';c.lineWidth=2.5;c.beginPath();c.arc(e.x*size,e.y*size,e.radius*size,0,Math.PI*2);c.fill();c.stroke();
      c.strokeStyle='#acd7e680';for(let i=0;i<30;i++){const aa=i*2.39996,rr=(i%10)/10*e.radius*size;const x=e.x*size+Math.cos(aa)*rr,y=e.y*size+Math.sin(aa)*rr;const fall=(time*19+i*13)%24;c.beginPath();c.moveTo(x,y+fall-12);c.lineTo(x-3,y+fall);c.stroke();}c.restore();}
    if(armedRain) {const target=cursor||state.camp;c.save();c.strokeStyle='#ffdda7';c.lineWidth=3;c.setLineDash([7,4]);c.beginPath();c.arc(target.x*size,target.y*size,+$('radius').value*size,0,Math.PI*2);c.stroke();c.restore();}
  }
  function onMap(e) {
    const rect=canvas.getBoundingClientRect();const x=Math.floor((e.clientX-rect.left)*state.width/rect.width), y=Math.floor((e.clientY-rect.top)*state.height/rect.height);
    if(x<0||y<0||x>=state.width||y>=state.height)return;
    if(armedRain){const r=S.castRain(state,{x,y,...opts()});say(r.ok?`降雨成功：消耗 ${r.cost} DP，世界將自行運作。`:r.reason);if(r.ok)armedRain=false;render();return;}
    let selected=null,dd=Infinity;for(const p of state.people){if(!p.alive)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<dd){selected=p;dd=d;}}
    if(selected && dd<3.2){chosen=selected.id;render();say(`正在觀察 ${selected.name} 的生活與工作選擇`);}else say(`土地 (${x}, ${y})：點選居民標記可查看個人的行動原因。`);
  }
  function animate(t) {
    const dt=Math.min(250,t-(previous||t));previous=t;
    if(!paused){acc+=dt/1000 * ticksPerRealSecond*speed;
      let count=Math.floor(acc);if(count>0){count=Math.min(count,200);acc-=count;S.advanceTicks(state,count);}
    }
    if(t-lastDraw>145){lastDraw=t;render();}
    requestAnimationFrame(animate);
  }
  $('pauseBtn').onclick=()=>{paused=!paused;render();};
  document.querySelectorAll('[data-speed]').forEach(btn=>btn.onclick=()=>{speed=+btn.dataset.speed;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===btn));render();});
  ['radius','intensity','duration'].forEach(id=>$(id).addEventListener('input',()=>{updateCost();draw();}));
  $('rainBtn').onclick=()=>{armedRain=!armedRain;render();if(armedRain)say('請點擊地圖上的目標位置，確認施展喚雨。');};
  $('oracleBtn').onclick=()=>{const r=S.issueOracle(state,{intentType:'food.produce'});say(r.ok?'神諭已交給 Saint；居民稍後自主聆聽與回應。':r.reason);render();};
  $('concludeBtn').onclick=()=>{const o=S.stats(state).activeOracle;const r=S.concludeOracle(state,o?.id);say(r.ok?'神已宣告此指派完成。':r.reason);render();};
  canvas.addEventListener('click',onMap);
  canvas.addEventListener('mousemove',e=>{const rect=canvas.getBoundingClientRect();cursor={x:Math.floor((e.clientX-rect.left)*state.width/rect.width),y:Math.floor((e.clientY-rect.top)*state.height/rect.height)};});
  canvas.addEventListener('mouseleave',()=>{cursor=null;});
  $('personList').addEventListener('click',e=>{const p=e.target.closest('button[data-person]');if(p){chosen=p.dataset.person;render();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&armedRain){armedRain=false;render();}else if(e.code==='Space'&&!['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();paused=!paused;render();}else if(e.key==='1'&&!['INPUT'].includes(document.activeElement?.tagName)){armedRain=!armedRain;render();}});
  $('saveBtn').onclick=save;
  $('loadBtn').onclick=()=>{let raw=null;try{raw=localStorage.getItem(storageKey());}catch(_){}if(raw)restore(raw);else say('目前沒有本機存檔；可以匯入 JSON。');};
  $('exportBtn').onclick=exportSave;
  $('importBtn').onclick=()=>$('importFile').click();
  $('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024){say('檔案超過 10 MB，無法匯入。');return;}restore(await file.text());e.target.value='';});
  $('resetBtn').onclick=()=>{if(!confirm('要重新開始河谷世界嗎？目前未儲存的進度會消失。'))return;state=S.create();paused=true;speed=1;acc=0;chosen='p1';lastEventId=0;armedRain=false;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',+b.dataset.speed===1));render();say('新世界已生成。');};
  $('helpBtn').onclick=()=>$('infoDialog').showModal();$('closeHelp').onclick=()=>$('infoDialog').close();
  render();requestAnimationFrame(animate);
})();
