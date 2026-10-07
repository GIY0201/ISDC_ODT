import {createAnalysisTransport} from '../scenario/analysis_transport.js';
import {LEAP_SHA256} from '../orbit_utc.js';

// Commands target the existing displayed owner. This adapter neither advances a clock nor owns UTC.
export function createNodeClockControls({readContext,stored,catalog,advanceUtc,now,runStored=work=>work(),scenario=null,follow=null,resolveSceneSource=null,verifySceneSource=null}={}){
 if([readContext,advanceUtc,now,runStored].some(value=>typeof value!=='function')||!stored||!catalog)throw new TypeError('explicit node clock owners required');
 const transport=createAnalysisTransport({follow});
 const speeds=Object.freeze([.1,1,10,60]);let dead=false;
 function directOwner(context){
  if(dead||!context||context.leap_sha256!==LEAP_SHA256)return null;
  try{if(advanceUtc(context.utc,0)!==context.utc)return null;}catch{return null;}
  if(context.key?.startsWith('sim:')){
   if(context.source!=='sim'||context.eop_sha256!==null||typeof scenario?.readRuntime!=='function'||typeof scenario?.utcOfRuntime!=='function')return null;
   try{const s=scenario.readRuntime();if(!s||typeof s.run_id!=='string'||!s.run_id||context.key!==`sim:${s.run_id}`||!Number.isFinite(s.speed)||s.speed<=0)return null;
    if(s.running===false){if(context.projected===true||scenario.utcOfRuntime(s)!==context.utc)return null;}
    else if(s.running===true){const age=context.projection_age_ms,delta=Date.parse(context.utc)-Date.parse(scenario.utcOfRuntime(s));if(context.projected!==true||context.runtime_sequence!==s.sequence||context.runtime_elapsed_seconds!==s.elapsed_seconds||context.frame!=='EARTH_FIXED_GMST_UTC_APPROX'||context.quality!=='engineering_assumption'||!Number.isFinite(age)||age<0||age>3500||!Number.isFinite(delta)||Math.abs(delta-age*s.speed)>2)return null;}
    else return null;
    return{kind:'sim',state:structuredClone(s)};}catch{return null;}
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
 function sourceIdentity(kind,state){
  if(kind==='stored')return JSON.stringify([state.input_id,state.input_hash,state.ground_point,state.minimum_elevation_deg,state.eop_sha256,state.leap_sha256,state.frame,state.profile]);
  if(kind==='catalog'){const selected=state.selected;return JSON.stringify([selected?.catalog_number,selected?.group,selected?.normalized_gp_sha256,selected?.eop_sha256,selected?.leap_sha256,selected?.profile,state.observer,state.minimumElevation]);}
  return JSON.stringify([state.run_id,state.scenario_id]);
 }
 function settledState(kind){
  if(dead)return null;
  if(kind==='stored'){const value=stored.snapshot();return !dead&&value.status==='ready'&&!value.error&&!value.fetching&&value.state?value.state:null;}
  if(kind==='catalog'){const value=catalog.snapshot();return !dead&&!value.pending&&!value.error&&value.selected?value:null;}
  const value=scenario?.readRuntime?.();return !dead&&value&&typeof value.running==='boolean'?value:null;
 }
 function owner(context){
  if(!context?.key?.startsWith('scene:'))return directOwner(context);
  if(dead||context.leap_sha256!==LEAP_SHA256||typeof resolveSceneSource!=='function'||typeof verifySceneSource!=='function')return null;
  try{
   if(advanceUtc(context.utc,0)!==context.utc)return null;
   const view=resolveSceneSource(context);if(dead||!view||!['stored','catalog','sim'].includes(view.kind)||verifySceneSource(view,{context})!==true||dead)return null;
   const target=directOwner(view.context);if(!target||target.kind!==view.kind||dead)return null;
   const state=settledState(target.kind);if(!state||sourceIdentity(target.kind,state)!==sourceIdentity(target.kind,target.state)||verifySceneSource(view,{context})!==true||dead)return null;
   return {...target,sourceContext:structuredClone(view.context),scene:{view,display:structuredClone(context),identity:sourceIdentity(target.kind,state)}};
  }catch{return null;}
 }
 function entry(target){
  if(!target.scene)return;
  const context=readContext();if(dead||context?.key!==target.scene.display.key||context.utc!==target.scene.display.utc||verifySceneSource(target.scene.view,{context})!==true||dead)throw unavailable();
  const state=settledState(target.kind);if(!state||sourceIdentity(target.kind,state)!==target.scene.identity||verifySceneSource(target.scene.view,{context})!==true||dead)throw unavailable();
 }
 function settlement(target){if(target.scene){const state=settledState(target.kind);if(!state||sourceIdentity(target.kind,state)!==target.scene.identity||dead)throw new Error('시간 제어 이후 원천 연결이 변경되었습니다. 현재 서버 상태를 확인하세요.');}}
 async function invoke(target,work){
  entry(target);const result=await work();
  // A normal explicit control revokes the old display binding. Settlement uses
  // the same actual input/run owner, never resurrects that obsolete display proof.
  settlement(target);
  return result;
 }
 const unavailable=()=>new Error('현재 표시 UTC와 일치하는 기존 분석 시계가 없습니다.');
 function current(){const context=readContext(),target=owner(context);if(!target)throw unavailable();return{context:structuredClone(target.sourceContext??context),...target};}
 async function control(action,rate){
  const target=current();
  if(target.kind!=='sim'&&transport.locked()){if(target.scene)throw unavailable();return transport.run(action,...(action==='speed'?[rate]:[]));}
  if(target.kind==='sim'){const controls=scenario?.controls,command=action==='speed'?controls?.setSpeed:controls?.[action];if(typeof command!=='function')throw new Error('명시적인 SIM 소유자 제어가 없습니다.');if(action==='speed'&&(!Number.isFinite(rate)||rate<=0))throw new Error('유효한 SIM 배속이 필요합니다.');return invoke(target,()=>action==='speed'?command.call(controls,rate):command.call(controls));}
  if(action==='speed'&&!speeds.includes(rate))throw new Error('지원하는 기존 분석 배속을 선택하세요.');
  if(target.kind==='stored')return invoke(target,()=>runStored(()=>{entry(target);return stored.control(action,...(action==='speed'?[rate]:[]));}));
  if(action==='play'){if(!target.state.buffer)throw new Error('카탈로그 재생 샘플을 먼저 계산하세요.');return invoke(target,()=>catalog.play());}
  if(action==='pause')return invoke(target,()=>catalog.pause());return invoke(target,()=>catalog.rate(rate));
 }
 async function seek(target,utc){
  if(target.kind==='sim'&&typeof scenario?.controls?.seek!=='function')throw new Error('명시적인 SIM UTC 이동 제어가 없습니다.');
  const canonical=advanceUtc(utc,0);if(!canonical)throw unavailable();
  if(target.kind==='sim')return invoke(target,()=>scenario.controls.seek(canonical));
  if(target.kind==='stored')return invoke(target,()=>runStored(()=>{entry(target);return stored.seek(canonical);}));
  return invoke(target,()=>{catalog.seek(canonical);settlement(target);return catalog.calculate();});
 }
 return Object.freeze({
  read(context){const target=owner(context);if(!target)return{};const s=target.state;const followed=transport.source();if(target.kind!=='sim'&&followed)return{mode:'SIM 따라가기',running:followed.running===true,speed:followed.speed,speeds:[]};
   if(target.kind==='sim')return{mode:'SIM',running:s.running,speed:s.speed,speeds:Array.isArray(scenario?.controls?.speeds)?[...scenario.controls.speeds]:[]};
   return{mode:target.kind==='stored'?'저장 궤도':'카탈로그',...(target.kind==='stored'||s.buffer||s.playing?{running:s.playing}:{}),speed:target.kind==='stored'?s.play_rate:s.rate,speeds:[...speeds]};},
  actions:Object.freeze({play:()=>control('play'),pause:()=>control('pause'),setSpeed:value=>control('speed',value),
   step:async seconds=>{const target=current();if(!Number.isFinite(seconds))throw new Error('유한한 UTC 이동 간격이 필요합니다.');if(target.kind!=='sim'&&transport.locked())return transport.run('step',seconds);if(target.kind==='sim'&&typeof scenario?.controls?.step==='function')return invoke(target,()=>scenario.controls.step(seconds));return seek(target,advanceUtc(target.context.utc,seconds));},
   live:async()=>{const target=current();if(target.kind!=='sim'&&transport.locked())return transport.run('live');const value=now();if(!Number.isFinite(value))throw new Error('명시적인 현재 시각이 필요합니다.');return seek(target,new Date(value).toISOString());},
  }),
  destroy(){dead=true;},
 });
}
