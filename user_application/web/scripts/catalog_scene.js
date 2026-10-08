import {createBrowserId} from './browser_identity.js';
import {createUtcCodec,LEAP_SHA256} from './orbit_utc.js';
const copy=v=>structuredClone(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a,b)=>['group','query','orbit'].every(k=>a?.[k]===b?.[k]);
const quality=v=>['ut1','polar_motion'].every(k=>['final_b','observed_a','predicted_a'].includes(v?.[k]));

/** Owns presentation snapshots only. Full rows are copied on responses, never RAF. */
export function createCatalogScene(api,onDisplay=()=>{},notify=()=>{},host={}){
 const now=host.now??(()=>performance.now()),setTimer=host.setTimer??((fn,ms)=>setTimeout(fn,ms)),clearTimer=host.clearTimer??(id=>clearTimeout(id)),requestId=host.requestId??(()=>createBrowserId());
 const codec=createUtcCodec(LEAP_SHA256),s={context:null,enabled:false,pending:false,result:null,desiredUtc:'',error:'',timings:null};
 const yieldTask=host.yieldTask??(()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0)));
 let dead=false,generation=0,abort=null,timer=null,lastStarted=-Infinity,full=null,byId=new Map();
 const emit=()=>{if(!dead)notify();};
 function discard(){full=null;byId.clear();s.result=null;if(!dead)onDisplay(null);}
 function cancel(){generation++;abort?.abort();abort=null;s.pending=false;if(timer!==null)clearTimer(timer);timer=null;}
 function clear(){cancel();s.enabled=false;s.error='';discard();emit();}
 function prepare(v,p,ticket){
  if(!v||v.version!==1||!same(v,p)||v.client_request_id!==p.client_request_id||v.utc!==p.utc||
   !['celestrak-live','celestrak-cache','celestrak-stale'].includes(v.source)||v.frame!=='ITRF'||v.profile!=='WGS72_AFSPC'||v.eop_kind!=='IERS_A'||!quality(v.eop_quality)||
   !['scene_sha256','eop_sha256','leap_sha256'].every(k=>hash(v[k]))||v.leap_sha256!==LEAP_SHA256||p.expected_scene_sha256&&v.scene_sha256!==p.expected_scene_sha256||
   v.units?.position!=='m'||v.units?.time!=='UTC'||!['count','valid_count','error_count'].every(k=>Number.isInteger(v[k])&&v[k]>=0)||
   v.count!==v.valid_count+v.error_count||!Array.isArray(v.rows)||v.rows.length!==v.count)throw Error('전체 위성 응답의 조건·시각·출처가 일치하지 않습니다.');
  const ids=new Set(),internal=[],display=[],index=new Map();let failed=0,maxSlice=0;
  const {rows,...rawMetadata}=v,metadata=copy(rawMetadata);
  function consume(start,end){const started=now();
  for(let i=start;i<end;i++){const row=rows[i];
   if(!Number.isInteger(row.catalog_number)||row.catalog_number<1||row.catalog_number>999999999||ids.has(row.catalog_number)||typeof row.name!=='string'||typeof row.orbit_regime!=='string'||!hash(row.normalized_gp_sha256))throw Error('전체 위성 응답의 식별자 오류');
   ids.add(row.catalog_number);
   if(row.status==='error'){
    failed++;if(typeof row.error_code!=='string'||!row.error_code||row.position_m!==null)throw Error('전체 위성 응답의 실패 행 오류');
   }else if(row.status!=='valid'||row.error_code!==null||!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite)||typeof row.epoch_utc!=='string'||codec.advance(row.epoch_utc,0)!==row.epoch_utc)throw Error('전체 위성 응답의 위치·epoch 오류');
  }
  const portion=rows.slice(start,end),ownedRows=copy(portion),displayRows=copy(portion);
  for(let i=0;i<ownedRows.length;i++){internal.push(ownedRows[i]);display.push(displayRows[i]);index.set(ownedRows[i].catalog_number,ownedRows[i]);}
  maxSlice=Math.max(maxSlice,now()-started);
  }
  function finish(){
   if(failed!==v.error_count||v.status!==(v.count&&failed===v.count?'error':failed?'partial':'valid'))throw Error('전체 위성 응답의 성공·실패 개수 오류');
   return {full:{...metadata,rows:internal},owned:{...copy(metadata),rows:display},index,maxSlice};
  }
  if(rows.length<=512){consume(0,rows.length);return finish();}
  return (async()=>{
   for(let start=0;start<rows.length;start+=512){
    if(dead||ticket!==generation)return null;
    consume(start,Math.min(start+512,rows.length));
    if(start+512<rows.length)await yieldTask();
   }
   if(dead||ticket!==generation)return null;return finish();
  })();
 }
 function schedule(){
  if(dead||!s.enabled||s.pending||!s.desiredUtc)return;
  const polling=typeof host.readUtc==='function';
  if(s.result?.utc===s.desiredUtc&&!polling)return;
  if(timer!==null)clearTimer(timer);
  const wait=s.result?.utc===s.desiredUtc?1000:Math.max(0,1000-(now()-lastStarted));
  if(wait===0){void query();return;}
  const ticket=generation;
  timer=setTimer(()=>{timer=null;if(dead||ticket!==generation||!s.enabled)return;
   try{const next=polling?host.readUtc():null;if(dead||ticket!==generation||!s.enabled)return;if(next!==null&&next!==undefined)s.desiredUtc=codec.advance(next,0);}catch(e){if(dead||ticket!==generation)return;s.error=String(e.message||e);s.enabled=false;cancel();discard();emit();return;}
   if(s.result?.utc!==s.desiredUtc)void query();else schedule();
  },wait);
 }
 async function query(){
  if(dead||s.pending||!s.enabled||!s.context)return;
  const ticket=generation,p={...s.context,utc:s.desiredUtc,client_request_id:requestId()},started=now();
  if(s.result)p.expected_scene_sha256=s.result.scene_sha256;
  abort=new AbortController();s.pending=true;s.error='';lastStarted=now();emit();
  try{
   const v=await api.catalogScene(p,{signal:abort.signal});if(dead||ticket!==generation)return;const received=now();
   let ready=prepare(v,p,ticket);if(ready?.then)ready=await ready;if(!ready||dead||ticket!==generation)return;
   full=ready.full;byId=ready.index;const {rows,...metadata}=full;s.result=copy(metadata);const prepared=now();onDisplay(ready.owned);
   s.timings={http_ms:received-started,validation_and_copy_ms:prepared-received,max_preparation_slice_ms:ready.maxSlice,display_callback_ms:now()-prepared};
  }catch(e){
   if(dead||ticket!==generation)return;s.error=String(e.message||e);s.enabled=false;discard();if(e.status===409)host.onConflict?.();
  }finally{if(!dead&&ticket===generation){abort=null;s.pending=false;emit();schedule();}}
 }
 return{
  snapshot:()=>copy(s),row:number=>byId.has(number)?copy(byId.get(number)):null,
  configure(applied){
   if(dead)return;const context=applied?{group:applied.group,query:applied.query,orbit:applied.orbit}:null;
   if(same(s.context,context))return;clear();s.context=context;s.desiredUtc='';lastStarted=-Infinity;emit();
  },
  async load(utc){
   if(dead)return;cancel();try{if(!s.context)throw Error('카탈로그 조회 조건을 먼저 적용하세요.');const canonical=codec.advance(utc,0);s.desiredUtc=canonical;s.enabled=true;return await query();}
   catch(e){s.error=String(e.message||e);s.enabled=false;discard();emit();}
  },
  observe(utc){if(dead||!s.enabled)return;try{const canonical=codec.advance(utc,0);if(canonical===s.desiredUtc)return;s.desiredUtc=canonical;schedule();}catch(e){s.error=String(e.message||e);s.enabled=false;cancel();discard();emit();}},
  clear,destroy(){if(dead)return;clear();dead=true;},
 };
}
