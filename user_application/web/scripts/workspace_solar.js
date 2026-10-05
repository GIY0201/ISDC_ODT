import {SolarDisplay} from '/static/visualization/solar_display.js';
import {createSolarTimeline} from './solar_timeline.js';
const KEY='spacetwin-globe-lighting-v1',EVENT='spacetwin:globelighting';

/** Existing globe/display owner assembly and original browser preference. */
export function createWorkspaceSolar({api,globe,overlay,host=window,createDisplay=(...args)=>new SolarDisplay(...args)}){
 let dead=false,renderer=null,context=null,theme='dark',enabled=true,renderStatus={phase:'unavailable',reason:'no_solar_geometry',indicator:'unavailable'},sample=null;
 const observers=new Set();
 try{enabled=host.localStorage?.getItem(KEY)!=='off';}catch{/* original session-only policy */}
 const state=()=>structuredClone({enabled,theme,context,timeline:timeline.snapshot(),renderer:renderStatus,
  geometry:sample?{utc:sample.utc,eop_quality:sample.eop_quality,eop_sha256:sample.eop_sha256,leap_sha256:sample.leap_sha256}:null});
 const notify=()=>{if(!dead)for(const fn of observers)fn(state());};
 function apply(){renderer?.setStyle(theme,enabled);notify();}
 const timeline=createSolarTimeline(api,value=>{
  sample=value;
  if(renderer){if(value)renderer.update(value);else renderer.clear(timeline.snapshot().error||'no_solar_geometry');}
 },notify);
 const removeContext=globe.observeDisplayContext(value=>{if(dead)return;context=value?structuredClone(value):null;timeline.setContext(value);notify();});
 const removeView=globe.observeView(value=>{if(dead)return;theme=value.choice.theme;apply();});
 const removeRenderer=globe.bindSolarRenderer((C,viewer)=>{
  if(dead)return null;
  renderer=createDisplay(C,viewer,overlay,{onStatus:value=>{if(dead)return;renderStatus=structuredClone(value);notify();}});
  apply();if(sample)renderer.update(sample);else renderer.clear(timeline.snapshot().error||'no_solar_geometry');
  return{destroy(){renderer?.destroy();renderer=null;renderStatus={phase:'unavailable',reason:'globe_unavailable',indicator:'unavailable'};}};
 });
 function setEnabled(value,broadcast=true){
  if(dead||typeof value!=='boolean')return false;enabled=value;
  if(broadcast){
   try{host.localStorage?.setItem(KEY,value?'on':'off');}catch{/* session only */}
   const EventClass=host.CustomEvent??globalThis.CustomEvent;
   if(EventClass)host.dispatchEvent?.(new EventClass(EVENT,{detail:{enabled,source:timeline}}));
  }
  apply();return true;
 }
 const event=value=>{if(value.detail?.source!==timeline&&typeof value.detail?.enabled==='boolean')setEnabled(value.detail.enabled,false);};
 const storage=value=>{if(value.key===KEY&&['on','off',null].includes(value.newValue))setEnabled(value.newValue!=='off',false);};
 host.addEventListener?.(EVENT,event);host.addEventListener?.('storage',storage);
 return{state,setEnabled,retry:()=>{if(!dead)timeline.retry();},
  observe(fn){if(dead)return()=>{};observers.add(fn);fn(state());return()=>observers.delete(fn);},
  destroy(){if(dead)return;dead=true;removeContext();removeView();removeRenderer();timeline.destroy();observers.clear();host.removeEventListener?.(EVENT,event);host.removeEventListener?.('storage',storage);context=null;sample=null;},
 };
}
