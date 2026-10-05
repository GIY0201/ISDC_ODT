import {createUtcCodec} from './orbit_utc.js';
const copy=v=>structuredClone(v);
const quality=v=>['ut1','polar_motion'].every(k=>['final_b','observed_a','predicted_a'].includes(v?.[k]));
const identity=v=>JSON.stringify([v?.group,v?.catalog_number,v?.normalized_gp_sha256,v?.eop_sha256,v?.leap_sha256,v?.profile,v?.epoch_utc]);

// Presentation-owned readonly query. Positions always come from the native/EOP API.
export function createCatalogTrack(api,onDisplay=()=>{},notify=()=>{},host={}){
 const requestId=host.requestId??(()=>crypto.randomUUID());
 const s={selected:null,enabled:true,pending:false,result:null,error:''};
 let codec=null,dead=false,generation=0,abort=null,latest=null;
 const emit=()=>{if(!dead)notify();};
 function clear(){generation++;abort?.abort();abort=null;latest=null;s.pending=false;s.result=null;s.error='';if(!dead)onDisplay(null);}
 function canonical(utc){if(!codec)throw Error('카탈로그 위성을 먼저 선택하세요.');return codec.advance(utc,0);}
 function validate(v,p){
  if(!v||v.version!==1||identity(v)!==identity(s.selected)||v.client_request_id!==p.client_request_id||v.reference_utc!==p.utc||!['valid','partial','error'].includes(v.status)||v.frame!=='ITRF'||v.eop_kind!=='IERS_A'||!['celestrak-live','celestrak-cache','celestrak-stale'].includes(v.source)||v.units?.position!=='m'||v.units?.time!=='UTC'||v.units?.period!=='s'||!Number.isFinite(v.period_seconds)||v.period_seconds<=0||!Number.isInteger(v.count)||v.count<1||v.count>1023||!Array.isArray(v.rows)||v.rows.length!==v.count)throw Error('궤적 응답의 선택·출처·단위가 일치하지 않습니다.');
  let failed=0,previous=-Infinity,center=false;
  const segments=[];let segment=[];
  const half=v.period_seconds/2;
  for(const row of v.rows){
   const offset=codec.difference(row.utc,p.utc);
   if(!Number.isFinite(offset)||offset<=previous||Math.abs(offset)>half+1e-8||!quality(row.eop_quality))throw Error('궤적 표본 시각·EOP 품질 오류');
   previous=offset;if(offset===0)center=true;
   if(row.status==='error'){
    failed++;if(row.position_m!==null||typeof row.error_code!=='string'||!row.error_code)throw Error('궤적 실패 표본 오류');
    if(segment.length>1)segments.push(segment);segment=[];
   }else{
    if(row.status!=='valid'||row.error_code!==null||!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite))throw Error('궤적 위치 응답 오류');
    segment.push([...row.position_m]);
   }
  }
  if(segment.length>1)segments.push(segment);
  if(!center||Math.abs(codec.difference(v.rows[0].utc,p.utc)+half)>1e-8||Math.abs(previous-half)>1e-8||v.error_count!==failed||v.valid_count!==v.count-failed||v.status!==(failed===v.count?'error':failed?'partial':'valid'))throw Error('궤적 응답 범위·실패 개수 오류');
  // Validate original dense .1-second window, including its endpoints and zero.
  const dense=Math.min(45,half),times=new Set(v.rows.map(r=>r.utc));
  for(let i=0;i<=Math.floor(2*dense/.1+1e-8);i++)if(!times.has(codec.advance(p.utc,Math.round((-dense+i*.1)*1e9)/1e9)))throw Error('궤적 응답 밀집 표본 누락');
  return segments;
 }
 async function query(utc){
  const ticket=generation;
  try{
   const p={group:s.selected.group,catalog_number:s.selected.catalog_number,normalized_gp_sha256:s.selected.normalized_gp_sha256,utc,client_request_id:requestId()};
   abort=new AbortController();s.pending=true;s.error='';emit();
   const v=await api.catalogTrack(p,{signal:abort.signal});
   if(dead||ticket!==generation)return;
   const segments=validate(v,p),owned=copy(v);delete owned.rows;
   s.result=owned;onDisplay({...copy(owned),segments});
  }catch(e){
   if(dead||ticket!==generation)return;
   s.result=null;s.error=String(e.message||e);onDisplay(null);
   if(e.status===409){s.enabled=false;latest=null;host.onConflict?.();}
  }finally{
   if(!dead&&ticket===generation){abort=null;s.pending=false;emit();const next=latest;latest=null;if(next&&s.enabled&&!s.error)observe(next);}
  }
 }
 async function observe(utc){
  if(dead||!s.enabled||!s.selected||s.error)return;
  let value;try{value=canonical(utc);}catch(e){clear();s.error=e.message;emit();return;}
  if(s.pending){latest=value;return;}
  if(s.result&&Math.abs(codec.difference(value,s.result.reference_utc))<Math.min(45,s.result.period_seconds/2))return;
  return query(value);
 }
 return{snapshot:()=>copy(s),
  select(value){if(dead||identity(value)===identity(s.selected))return;clear();s.selected=value?copy(value):null;codec=null;try{if(value)codec=createUtcCodec(value.leap_sha256);}catch(e){s.error=e.message;}emit();},
  observe,
  async refresh(utc){if(dead)return;clear();emit();return observe(utc);},
  enabled(value){if(dead)return;s.enabled=Boolean(value);if(!s.enabled)clear();emit();},
  destroy(){if(dead)return;clear();dead=true;}
 };
}
