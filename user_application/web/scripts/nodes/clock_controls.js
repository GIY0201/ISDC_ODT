import {LEAP_SHA256} from '../orbit_utc.js';

// Commands target the existing displayed owner. This adapter neither advances a clock nor owns UTC.
export function createNodeClockControls({readContext,stored,catalog,advanceUtc,now,runStored=work=>work(),scenario=null}={}){
 if([readContext,advanceUtc,now,runStored].some(value=>typeof value!=='function')||!stored||!catalog)throw new TypeError('explicit node clock owners required');
 const speeds=Object.freeze([.1,1,10,60]);let dead=false;
 function owner(context){
  if(dead||!context||context.leap_sha256!==LEAP_SHA256)return null;
  try{if(advanceUtc(context.utc,0)!==context.utc)return null;}catch{return null;}
  if(context.key?.startsWith('sim:')){
   if(context.source!=='sim'||context.eop_sha256!==null||typeof scenario?.readRuntime!=='function'||typeof scenario?.utcOfRuntime!=='function')return null;
   try{const s=scenario.readRuntime();if(!s||typeof s.run_id!=='string'||!s.run_id||context.key!==`sim:${s.run_id}`||s.running!==false||!Number.isFinite(s.speed)||s.speed<=0||scenario.utcOfRuntime(s)!==context.utc)return null;return{kind:'sim',state:structuredClone(s)};}catch{return null;}
  }
  if(context.key?.startsWith('stored:')){
   const snapshot=stored.snapshot(),s=snapshot.state;
   if(!s?.input_id||context.key!==`stored:${s.input_id}:${s.input_hash}`||snapshot.status==='pending'||typeof s.playing!=='boolean'||!speeds.includes(s.play_rate))return null;
   return{kind:'stored',state:s};
  }
  if(context.key?.startsWith('catalog:')){
   const s=catalog.snapshot(),selected=s.selected;
   if(!selected||context.key!==`catalog:${selected.catalog_number}:${selected.normalized_gp_sha256}`||typeof s.playing!=='boolean'||!speeds.includes(s.rate))return null;
   return{kind:'catalog',state:s};
  }
  return null;
 }
 const unavailable=()=>new Error('현재 표시 UTC와 일치하는 기존 분석 시계가 없습니다.');
 function current(){const context=readContext(),target=owner(context);if(!target)throw unavailable();return{context:structuredClone(context),...target};}
 async function control(action,rate){
  const target=current();
  if(target.kind==='sim'){const controls=scenario?.controls,command=action==='speed'?controls?.setSpeed:controls?.[action];if(typeof command!=='function')throw new Error('명시적인 SIM 소유자 제어가 없습니다.');if(action==='speed'&&(!Number.isFinite(rate)||rate<=0))throw new Error('유효한 SIM 배속이 필요합니다.');return action==='speed'?command.call(controls,rate):command.call(controls);}
  if(action==='speed'&&!speeds.includes(rate))throw new Error('지원하는 기존 분석 배속을 선택하세요.');
  if(target.kind==='stored')return runStored(()=>stored.control(action,...(action==='speed'?[rate]:[])));
  if(action==='play'){if(!target.state.buffer)throw new Error('카탈로그 재생 샘플을 먼저 계산하세요.');return catalog.play();}
  if(action==='pause')return catalog.pause();return catalog.rate(rate);
 }
 async function seek(target,utc){
  if(target.kind==='sim'&&typeof scenario?.controls?.seek!=='function')throw new Error('명시적인 SIM UTC 이동 제어가 없습니다.');
  const canonical=advanceUtc(utc,0);if(!canonical)throw unavailable();
  if(target.kind==='sim')return scenario.controls.seek(canonical);
  if(target.kind==='stored')return runStored(()=>stored.seek(canonical));
  catalog.seek(canonical);return catalog.calculate();
 }
 return Object.freeze({
  read(context){const target=owner(context);if(!target)return{};const s=target.state;
   if(target.kind==='sim')return{mode:'SIM',running:false,speed:s.speed,speeds:Array.isArray(scenario?.controls?.speeds)?[...scenario.controls.speeds]:[]};
   return{mode:target.kind==='stored'?'저장 궤도':'카탈로그',...(target.kind==='stored'||s.buffer||s.playing?{running:s.playing}:{}),speed:target.kind==='stored'?s.play_rate:s.rate,speeds:[...speeds]};},
  actions:Object.freeze({play:()=>control('play'),pause:()=>control('pause'),setSpeed:value=>control('speed',value),
   step:async seconds=>{const target=current();if(!Number.isFinite(seconds))throw new Error('유한한 UTC 이동 간격이 필요합니다.');return seek(target,advanceUtc(target.context.utc,seconds));},
   live:async()=>{const target=current(),value=now();if(!Number.isFinite(value))throw new Error('명시적인 현재 시각이 필요합니다.');return seek(target,new Date(value).toISOString());},
  }),
  destroy(){dead=true;},
 });
}
