'use strict';
// Presentation-only. No imports or mutation of the world state, camera or RNG.
(() => {
  const MODES=Object.freeze({
    full:'完整村落：960×620 全景',
    '4x':'4×：同一張場景裁切 720×540',
    '8x':'8×：裁切 360×270，正好是 4× 的兩倍放大'
  });
  const chosen=new URLSearchParams(location.search).get('zoom');
  const initial=Object.hasOwn(MODES,chosen)?chosen:'full';
  const buttons=[...document.querySelectorAll('[data-view]')];
  function setView(mode){
    if(!Object.hasOwn(MODES,mode))return;
    document.body.dataset.view=mode;
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.view===mode));
    document.getElementById('view-note').textContent=MODES[mode]+'；靜態藝術比較，非實際遊戲渲染。';
    history.replaceState(null,'',location.pathname+'?zoom='+mode);
  }
  for(const b of buttons)b.addEventListener('click',()=>setView(b.dataset.view));
  setView(initial);
  Promise.all([...document.querySelectorAll('.viewport img')].map(img=>img.decode())).then(()=>{
    document.getElementById('render-status').textContent='3/3 向量樣板已獨立載入；程式載入成功不代表美術驗收通過。';
    document.body.dataset.artReady='true';
  }).catch(err=>{
    document.getElementById('render-status').textContent='素材載入失敗：'+err.message;
    document.body.dataset.artReady='false';
  });
})();
