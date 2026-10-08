import {createBrowserId} from './browser_identity.js';
import {createUtcCodec} from './orbit_utc.js';
import {createSampleBuffer} from './orbit_playback.js';
import {validateCatalogDetails,projectCatalogDetails} from './orbit/catalog_details.js';
const copy=v=>structuredClone(v);
const samePoint=(a,b)=>['latitude_deg','longitude_deg','ellipsoid_height_m','virtual','ellipsoid'].every(k=>a?.[k]===b?.[k]);
const quality=v=>['ut1','polar_motion'].every(k=>['final_b','observed_a','predicted_a'].includes(v?.[k]));

export function createCatalogTimeline(api,onDisplay=()=>{},notify=()=>{},host={}){
 const wallNow=host.wallNow??(()=>Date.now());
 const now=host.now??(()=>performance.now()),requestFrame=host.requestFrame??(fn=>requestAnimationFrame(fn)),cancelFrame=host.cancelFrame??(id=>cancelAnimationFrame(id)),requestId=host.requestId??(()=>createBrowserId());
 const s={selected:null,observer:null,minimumElevation:5,utc:'',playing:false,live:false,sceneFollowing:false,rate:1,pending:false,buffer:null,display:null,error:''};
 let dead=false,generation=0,abort=null,frame=null,codec=null,sampleBuffer=null,anchorUtc=null,anchorMs=0,lastNotify=-Infinity;
 const continuityProofs=new WeakMap(),continuityObservers=new Set();
 let continuityToken=Object.freeze({}),continuityLease=null,commandDepth=0,displayAvailable=false;
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 function continuityEvent(phase,reason){if(dead)return;for(const fn of [...continuityObservers]){try{fn(Object.freeze({phase,reason}));}catch{/* Observers cannot own the catalog clock. */}}}
 function revokeContinuity(reason,phase='invalidated'){continuityToken=Object.freeze({});continuityLease=null;continuityEvent(phase,reason);}
 function command(reason,work){
  s.sceneFollowing=false;
  commandDepth++;revokeContinuity(reason);
  const finish=()=>{commandDepth--;continuityEvent('settled',reason);};
  try{const result=work();if(result&&typeof result.then==='function')return Promise.resolve(result).finally(finish);finish();return result;}catch(error){finish();throw error;}
 }
 function continuityReady(){
  const row=s.display,selected=s.selected;
  return !dead&&commandDepth===0&&displayAvailable&&s.playing===true&&!s.error&&!!s.buffer&&!!sampleBuffer&&!!s.observer&&!!selected&&!!row&&row.status==='valid'&&row.error_code===null&&row.utc===s.utc&&row.frame==='ITRF'&&row.catalog_number===selected.catalog_number&&row.group===selected.group&&row.normalized_gp_sha256===selected.normalized_gp_sha256&&row.eop_sha256===selected.eop_sha256&&row.leap_sha256===selected.leap_sha256&&row.profile===selected.profile&&Array.isArray(row.position_m)&&row.position_m.length===3&&row.position_m.every(Number.isFinite);
 }
 function currentProof(proof){return !!proof&&continuityReady()&&proof.token===continuityToken&&proof.selected===s.selected&&proof.observer===s.observer&&proof.minimum===s.minimumElevation&&proof.rate===s.rate;}
 const displayContinuity=Object.freeze({
  capture(){
   if(!continuityReady())return null;
   if(continuityLease&&currentProof(continuityProofs.get(continuityLease)))return continuityLease;
   const proof={token:continuityToken,selected:s.selected,observer:s.observer,minimum:s.minimumElevation,rate:s.rate};
   const lease=freeze(copy({contract:'catalog-display-continuity-v1',source:'catalog',key:`catalog:${s.selected.catalog_number}:${s.selected.normalized_gp_sha256}`,selected:s.selected,observer:s.observer,minimumElevation:s.minimumElevation,rate:s.rate}));
   if(!currentProof(proof))return null;continuityProofs.set(lease,proof);continuityLease=lease;return lease;
  },
  isCurrent(lease,expected=null){
   const proof=continuityProofs.get(lease);if(!currentProof(proof))return false;
   if(expected!==null&&(!expected||['catalog_number','normalized_gp_sha256','leap_sha256','eop_sha256'].some(key=>expected[key]!==proof.selected[key])))return false;
   return currentProof(proof);
  },
  observe(fn){if(typeof fn!=='function')throw new TypeError('catalog continuity observer required');if(dead)return()=>{};continuityObservers.add(fn);return()=>continuityObservers.delete(fn);},
 });
 const emit=()=>{if(!dead)notify();};
 function pause(){if(s.playing)paint();s.playing=false;s.live=false;if(frame!==null)cancelFrame(frame);frame=null;emit();}
 function cancel(){generation++;abort?.abort();abort=null;s.pending=false;s.buffer=null;sampleBuffer=null;s.error='';pause();}
 function display(value){const previous=displayAvailable;displayAvailable=!!value;s.display=value?copy(value):null;if(previous&&!displayAvailable)revokeContinuity('display unavailable','availability');if(!dead)onDisplay(value?copy(value):null);if(!previous&&displayAvailable)continuityEvent('availability','display available');}
 function reset(){cancel();display(s.selected);emit();}
 function paint(){
  if(dead||!s.buffer||!codec)return;
  const utc=s.live?codec.advance(new Date(wallNow()).toISOString(),0):s.playing?codec.advance(anchorUtc,Math.max(0,now()-anchorMs)/1000*s.rate):s.utc;
  s.utc=utc;
  const row=sampleBuffer.sampleAt(utc),elapsed=codec.difference(utc,s.buffer.start_utc),index=Math.floor(elapsed+1e-9),observed=s.buffer.rows[index];
  if(row&&observed?.status==='valid')display({...s.selected,...row,...projectCatalogDetails(s.buffer,observed),eop_quality:observed.eop_quality,ground_point:s.observer,minimum_elevation_deg:s.minimumElevation,range_m:observed.range_m,azimuth_deg:observed.azimuth_deg,observation_utc:observed.utc,observed_elevation_deg:observed.elevation_deg,visible:observed.visible,interpolated:utc!==observed.utc});else display(null);
  if(s.playing&&elapsed>=300&&!s.pending)query(s.live?utc:codec.advance(s.buffer.start_utc,300),true);
  if(now()-lastNotify>=200){lastNotify=now();emit();}
 }
 function tick(){frame=null;if(dead||!s.playing)return;paint();if(s.playing)frame=requestFrame(tick);}
 function validate(v,p){
  const base=s.selected;
  if(!v||v.version!==1||!['valid','partial','error'].includes(v.status)||v.client_request_id!==p.client_request_id||v.group!==p.group||v.catalog_number!==p.catalog_number||v.normalized_gp_sha256!==p.normalized_gp_sha256||v.epoch_utc!==base.epoch_utc||v.eop_sha256!==base.eop_sha256||v.leap_sha256!==base.leap_sha256||v.frame!=='ITRF'||v.profile!==base.profile||v.eop_kind!=='IERS_A'||v.communication_status!=='unknown'||!['celestrak-live','celestrak-cache','celestrak-stale'].includes(v.source)||!samePoint(v.ground_point,p.ground_point)||v.minimum_elevation_deg!==p.minimum_elevation_deg||v.start_utc!==p.start_utc||v.step_seconds!==1||v.count!==p.count||!Array.isArray(v.rows)||v.rows.length!==p.count||Object.entries({position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'}).some(([k,value])=>v.units?.[k]!==value))throw Error('카탈로그 시간 응답의 선택·단위·자료가 일치하지 않습니다.');
  let failed=0;
  for(const [i,row] of v.rows.entries()){
   validateCatalogDetails(v,row);
   if(row.utc!==codec.advance(p.start_utc,i)||!quality(row.eop_quality))throw Error('카탈로그 표본 시각·EOP 품질 오류');
   if(row.status==='error'){
    failed++;if(typeof row.error_code!=='string'||!row.error_code||['position_m','elevation_deg','range_m','azimuth_deg','visible'].some(k=>row[k]!==null))throw Error('카탈로그 실패 표본 오류');
   }else if(row.status!=='valid'||row.error_code!==null||!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite)||!Number.isFinite(row.elevation_deg)||Math.abs(row.elevation_deg)>90||!Number.isFinite(row.range_m)||row.range_m<=0||row.azimuth_deg!==null&&(!Number.isFinite(row.azimuth_deg)||row.azimuth_deg<0||row.azimuth_deg>=360)||row.visible!==(row.elevation_deg>=p.minimum_elevation_deg))throw Error('카탈로그 관측 표본 오류');
  }
  if(v.status!==(failed===v.count?'error':failed?'partial':'valid'))throw Error('카탈로그 부분 실패 상태 오류');
 }
 async function query(start,background=false){
  if(dead)return;
  if(!background){cancel();display(null);}
  const ticket=generation;
  try{
   if(!s.selected||!s.observer)throw Error('카탈로그 위성과 가상 관측 지상국을 먼저 선택하세요.');
   const utc=codec.advance(start,0),p={client_request_id:requestId(),group:s.selected.group,catalog_number:s.selected.catalog_number,normalized_gp_sha256:s.selected.normalized_gp_sha256,start_utc:utc,step_seconds:1,count:601,ground_point:copy(s.observer),minimum_elevation_deg:s.minimumElevation};
   abort=new AbortController();s.pending=true;emit();const v=await api.catalogSamples(p,{signal:abort.signal});
   if(dead||ticket!==generation)return;validate(v,p);s.buffer=copy(v);sampleBuffer=createSampleBuffer(v.rows,codec.difference);
   if(!background){s.utc=utc;anchorUtc=utc;anchorMs=now();}paint();
  }catch(e){if(dead||ticket!==generation)return;s.buffer=null;sampleBuffer=null;s.error=String(e.message||e);revokeContinuity('failure');pause();display(null);}
  if(!dead&&ticket===generation){abort=null;s.pending=false;emit();}
 }
 // Readonly display-model projection. Never fetch, paint, seek or create a
 // clock: native samples and the existing leap codec remain the only sources.
 function advanceUtc(utc,seconds){
  if(dead||!codec||!Number.isFinite(seconds))return null;
  try{return codec.advance(utc,seconds);}catch{return null;}
 }
 function sampleAt(utc){
  if(dead||!codec||!s.selected)return null;
  const canonical=advanceUtc(utc,0);if(!canonical||canonical!==utc)return null;
  if(sampleBuffer&&s.buffer){
   const row=sampleBuffer.sampleAt(utc);if(!row)return null;
   const index=Math.floor(codec.difference(utc,s.buffer.start_utc)+1e-9),observed=s.buffer.rows[index];
   if(observed?.status!=='valid')return null;
   return copy({...s.selected,...row,...projectCatalogDetails(s.buffer,observed),eop_quality:observed.eop_quality,interpolated:utc!==observed.utc});
  }
  const row=s.display;
  if(!row||row.utc!==utc||row.frame!=='ITRF'||row.status==='error'||row.error_code||
   row.catalog_number!==s.selected.catalog_number||row.normalized_gp_sha256!==s.selected.normalized_gp_sha256||
   !Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite))return null;
  return copy({...row,interpolated:false});
 }
 return{snapshot:()=>copy({...s,buffer:s.buffer?{start_utc:s.buffer.start_utc,count:s.buffer.count,status:s.buffer.status}:null}),
  displayContinuity,sampleAt,advanceUtc,currentUtc:()=>dead?null:s.utc||null,
  // Accepted whole-scene native snapshots supply display geometry only.
  // No observer, per-satellite query, RAF clock or playback state is created.
  displaySceneSelection(scene){
   if(dead||!s.selected||s.observer||s.pending||s.playing||s.buffer)return false;
   const row=scene?.rows?.find(value=>value.catalog_number===s.selected.catalog_number);
   let valid=scene?.frame==='ITRF'&&scene.group===s.selected.group&&scene.profile===s.selected.profile&&
    scene.eop_sha256===s.selected.eop_sha256&&scene.leap_sha256===s.selected.leap_sha256&&quality(scene.eop_quality)&&
    row?.status==='valid'&&row.error_code===null&&row.normalized_gp_sha256===s.selected.normalized_gp_sha256&&
    Array.isArray(row.position_m)&&row.position_m.length===3&&row.position_m.every(Number.isFinite);
   try{valid=valid&&codec.advance(scene.utc,0)===scene.utc;}catch{valid=false;}
   if(!valid){if(s.sceneFollowing){s.utc='';display(null);emit();}return false;}
   s.sceneFollowing=true;s.utc=scene.utc;s.error='';
   display({...s.selected,...copy(row),...projectCatalogDetails(scene,{...row,utc:scene.utc}),utc:scene.utc,frame:scene.frame,
    eop_quality:copy(scene.eop_quality),eop_sha256:scene.eop_sha256,leap_sha256:scene.leap_sha256,
    ground_point:null,range_m:null,azimuth_deg:null,elevation_deg:null,visible:null,observation_utc:null,interpolated:false});
   emit();return true;
  },
  select(base,pin=null){if(dead)return;return command('select',()=>{cancel();s.selected=base?copy(base):null;codec=null;let first=base?{...base,...projectCatalogDetails(base)}:base;try{codec=base?createUtcCodec(base.leap_sha256):null;
   if(base&&pin){if(pin.normalized_gp_sha256!==base.normalized_gp_sha256||!Array.isArray(pin.position_m)||pin.position_m.length!==3||!pin.position_m.every(Number.isFinite))throw Error('지구 선택 GP/위치가 일치하지 않습니다.');const utc=codec.advance(pin.utc,0);first={...base,...(utc===base.utc?projectCatalogDetails(base):{geodetic:null,teme_speed_km_s:null,details_utc:null}),utc,position_m:copy(pin.position_m)};}
  }catch(e){s.error=e.message;first=pin?null:base;}s.utc=first?.utc??base?.epoch_utc??'';anchorUtc=s.utc;display(first);emit();});},
  observer(point,minimum){if(dead)return false;if(!point||!['latitude_deg','longitude_deg','ellipsoid_height_m'].every(k=>Number.isFinite(point[k]))||Math.abs(point.latitude_deg)>90||Math.abs(point.longitude_deg)>180||point.virtual!==true||point.ellipsoid!=='WGS84'||!Number.isFinite(minimum)||minimum<0||minimum>90)return false;return command('observer',()=>{s.observer=copy(point);s.minimumElevation=minimum;reset();return true;});},
  seek(utc){if(dead||!codec)return;const canonical=codec.advance(utc,0);return command('seek',()=>{cancel();s.utc=canonical;anchorUtc=canonical;display(null);emit();});},
  calculate(){if(dead)return query(s.utc);return command('calculate',()=>query(s.utc));},
  live(){if(dead||!codec)return;return command('live',async()=>{const start=codec.advance(new Date(wallNow()).toISOString(),0),pending=query(start),ticket=generation;await pending;if(dead||ticket!==generation||!s.buffer||s.error)return;s.rate=1;s.live=true;s.playing=true;anchorUtc=s.utc;anchorMs=now();paint();frame=requestFrame(tick);emit();});},
  invalidate(){if(!dead)return command('invalidate',reset);},
  play(){if(dead||!s.buffer||s.playing)return;return command('play',()=>{s.playing=true;anchorUtc=s.utc;anchorMs=now();frame=requestFrame(tick);emit();});},pause(){if(!dead)return command('pause',pause);},
  rate(value){if(dead||![.1,1,10,60].includes(value))return;return command('rate',()=>{const playing=s.playing;pause();s.rate=value;anchorUtc=s.utc;anchorMs=now();if(playing){s.playing=true;frame=requestFrame(tick);}emit();});},
  clear(){if(dead)return;return command('clear',()=>{cancel();s.selected=null;s.utc='';codec=null;display(null);emit();});},
  destroy(){if(dead)return;return command('destroy',()=>{cancel();display(null);dead=true;continuityObservers.clear();continuityLease=null;});},
 };
}
