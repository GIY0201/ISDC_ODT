import {createUtcCodec} from './orbit_utc.js';
const copy=v=>structuredClone(v);
const key=t=>JSON.stringify(t&&[t.selected?.group,t.selected?.catalog_number,t.selected?.normalized_gp_sha256,t.selected?.epoch_utc,t.selected?.eop_sha256,t.selected?.leap_sha256,t.selected?.profile,t.utc,t.observer,t.minimumElevation]);
const pointEqual=(a,b)=>['latitude_deg','longitude_deg','ellipsoid_height_m','virtual','ellipsoid'].every(k=>a?.[k]===b?.[k]);
export function createCatalogPasses(api,notify=()=>{},onSeek=()=>{},host={}){
 let context=null,contextKey=null,generation=0,abort=null,dead=false;
 const s={pending:false,result:null,error:''},emit=()=>{if(!dead)notify();};
 function cancel(){generation++;abort?.abort();abort=null;s.pending=false;s.result=null;s.error='';}
 function validate(v,p,codec){
  const b=context.selected;
  if(!v||v.version!==1||v.client_request_id!==p.client_request_id||['group','catalog_number','normalized_gp_sha256','epoch_utc','eop_sha256','leap_sha256','profile'].some(k=>v[k]!==b[k])||v.frame!=='ITRF'||v.eop_kind!=='IERS_A'||!['celestrak-live','celestrak-cache','celestrak-stale'].includes(v.source)||v.communication_status!=='unknown'||v.query_start_utc!==p.query_start_utc||v.query_end_utc!==p.query_end_utc||!pointEqual(v.ground_point,p.ground_point)||v.minimum_elevation_deg!==p.minimum_elevation_deg||v.units?.time!=='UTC'||v.units?.elevation!=='deg'||v.units?.duration!=='s'||!['complete','partial','none','error'].includes(v.status)||!['intervals','contacts','errors'].every(k=>Array.isArray(v[k])))throw Error('가시 구간 응답의 선택·관측 조건·단위가 일치하지 않습니다.');
  const duration=codec.difference(p.query_end_utc,p.query_start_utc),at=utc=>{const value=codec.difference(utc,p.query_start_utc);if(!Number.isFinite(value)||value<0||value>duration)throw Error('가시 구간 응답 시각이 조회 범위를 벗어났습니다.');return value;};
  let previous=-Infinity;
  for(const row of v.intervals){const start=at(row.start_utc),end=at(row.end_utc),peak=at(row.peak_utc);if(start<previous||end<=start||peak<start||peak>end||!Number.isFinite(row.max_elevation_deg)||row.max_elevation_deg<p.minimum_elevation_deg-1e-7||row.max_elevation_deg>90||typeof row.start_clipped!=='boolean'||typeof row.end_clipped!=='boolean'||row.start_clipped&&start!==0||row.end_clipped&&end!==duration)throw Error('가시 구간 응답 경계·최대각 오류');previous=end;}
  previous=-Infinity;for(const row of v.contacts){const time=at(row.utc);if(time<previous||row.duration_seconds!==0)throw Error('가시 구간 접점 응답 오류');previous=time;}
  for(const row of v.errors){at(row.utc);if(typeof row.error_code!=='string'||!row.error_code)throw Error('가시 구간 실패 응답 오류');}
  const found=v.intervals.length+v.contacts.length;
  if(v.status==='none'&&(found||v.errors.length)||v.status==='complete'&&(!found||v.errors.length)||v.status==='partial'&&!v.errors.length||v.status==='error'&&(found||!v.errors.length))throw Error('가시 구간 응답 상태·개수 오류');
 }
 return{snapshot:()=>copy(s),
  update(t){if(dead)return;const next=key(t);if(next!==contextKey){cancel();context=t?copy(t):null;contextKey=next;emit();}},
  async query(){
   if(dead)return;cancel();const ticket=generation;
   try{
    if(!context?.selected||!context.observer)throw Error('카탈로그 위성과 관측 지상국을 먼저 선택하세요.');
    const codec=createUtcCodec(context.selected.leap_sha256),start=codec.advance(context.utc,0),p={group:context.selected.group,catalog_number:context.selected.catalog_number,normalized_gp_sha256:context.selected.normalized_gp_sha256,client_request_id:host.requestId?.()??crypto.randomUUID(),query_start_utc:start,query_end_utc:codec.advance(start,86400),ground_point:copy(context.observer),minimum_elevation_deg:context.minimumElevation};
    abort=new AbortController();s.pending=true;emit();const v=await api.catalogVisibility(p,{signal:abort.signal});
    if(dead||ticket!==generation)return;validate(v,p,codec);s.result=copy(v);
   }catch(e){if(dead||ticket!==generation)return;s.error=String(e.message||e);s.result=null;if(e.status===409)host.onConflict?.();}
   finally{if(!dead&&ticket===generation){s.pending=false;abort=null;emit();}}
  },
  seek(index){if(dead||!Number.isInteger(index)||!s.result?.intervals[index])return false;onSeek(s.result.intervals[index].start_utc);return true;},
  destroy(){if(dead)return;cancel();dead=true;}
 };
}
