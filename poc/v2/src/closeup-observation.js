/* Issue #15 P0: close-up viewing policy and dead-zone follow.
   Pure presentation state; no simulation RNG, timeline, saves or decisions. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function create(){
  return {active:false,suppressed:false,savedSpeed:null,userOverride:false};
}
// Entering a 4x+ close-up offers genuine .1x world speed. Hysteresis keeps
// wheel zoom near the border from repeatedly replacing user choices.
function zoom(state,magnification,currentSpeed){
  if(magnification<=3){
    const restore=state.active&&!state.userOverride?state.savedSpeed:null;
    state.active=false;state.savedSpeed=null;state.userOverride=false;
    state.suppressed=false;
    return restore;
  }
  if(magnification>=4&&!state.active&&!state.suppressed){
    state.active=true;state.savedSpeed=currentSpeed;state.userOverride=false;
    return .1;
  }
  return null;
}
function toggle(state,magnification,currentSpeed){
  if(state.active){
    const restore=!state.userOverride?state.savedSpeed:null;
    state.active=false;state.savedSpeed=null;state.userOverride=false;
    state.suppressed=true;
    return restore;
  }
  if(magnification<4)return null;
  state.active=true;state.savedSpeed=currentSpeed;state.userOverride=false;
  state.suppressed=false;
  return .1;
}
function speedChosen(state,newSpeed){
  if(state.active){
    if(newSpeed>=4){
      // 4x/16x is an explicit choice to leave close-up observation;
      // do not secretly apply a speed cap and do not restore the old speed.
      state.active=false;state.savedSpeed=null;
      state.userOverride=false;state.suppressed=true;
    }else{
      // User may choose 1x or 0.1x while remaining in the viewing mode.
      state.userOverride=true;
    }
  }
  return newSpeed;
}
function urgentSpeed(state){
  // A battle or prayer changed real-world speed. Exiting zoom cannot silently
  // override a safety/attention action with an old 16x preset.
  if(state.active)state.userOverride=true;
}
function deadZoneFollow(camera,worldTarget,frameMs=33){
  if(!worldTarget||!Number.isFinite(worldTarget.x)||!Number.isFinite(worldTarget.y))
    return {moved:false,jump:false};
  const spanX=camera.width/camera.zoom,spanY=camera.height/camera.zoom;
  const dx=worldTarget.x-camera.x,dy=worldTarget.y-camera.y;
  const jump=Math.abs(dx)>spanX*.85||Math.abs(dy)>spanY*.85;
  if(jump){
    camera.x=worldTarget.x;camera.y=worldTarget.y;
  }else{
    // Central 50% of the viewport is stationary; move only when necessary.
    const excessX=Math.sign(dx)*Math.max(0,Math.abs(dx)-spanX*.25);
    const excessY=Math.sign(dy)*Math.max(0,Math.abs(dy)-spanY*.25);
    const weight=1-Math.exp(-Math.max(0,Math.min(250,frameMs))/100);
    camera.x+=excessX*weight;camera.y+=excessY*weight;
  }
  const halfX=spanX/2,halfY=spanY/2;
  camera.x=clamp(camera.x,halfX,camera.width-halfX);
  camera.y=clamp(camera.y,halfY,camera.height-halfY);
  return {moved:jump||Math.abs(dx)>spanX*.25||Math.abs(dy)>spanY*.25,jump};
}
const API={create,zoom,toggle,speedChosen,urgentSpeed,deadZoneFollow};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.WOG_CLOSEUP=API;
})(typeof window!=='undefined'?window:null);
