const copy=v=>structuredClone(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function createCatalogGeometry(api,onDisplay=()=>{},notify=()=>{}){
 let dead=false,token=0,abort;const s={pending:false,result:null,error:''};
 function clear(){token++;abort?.abort();s.pending=false;s.result=null;s.error='';if(!dead){onDisplay(null);notify();}}
 async function select(number,group){
  if(dead)return;clear();const current=++token;abort=new AbortController();s.pending=true;notify();
  try{const v=await api.catalogPosition({group,catalog_number:number},{signal:abort.signal});if(dead||current!==token)return;
   if(v?.version!==1||v.status!=='valid'||v.group!==group||v.catalog_number!==number||!['celestrak-live','celestrak-cache','celestrak-stale'].includes(v.source)||v.frame!=='ITRF'||v.profile!=='WGS72_AFSPC'||!Array.isArray(v.position_m)||v.position_m.length!==3||!v.position_m.every(Number.isFinite)||typeof v.utc!=='string'||!v.utc.endsWith('Z')||!Number.isFinite(Date.parse(v.utc))||v.utc!==v.epoch_utc||!['normalized_gp_sha256','eop_sha256','leap_sha256'].every(k=>hash(v[k]))||v.eop_kind!=='IERS_A'||!['ut1','polar_motion'].every(k=>['final_b','observed_a','predicted_a'].includes(v.eop_quality?.[k])))throw Error('카탈로그 위치 응답 오류');
   s.result=copy(v);onDisplay(copy(v));
  }catch(e){if(!dead&&current===token){s.error=String(e.message||e);onDisplay(null);}}
  finally{if(!dead&&current===token){s.pending=false;notify();}}
 }
 return {select,clear,snapshot:()=>copy(s),destroy(){clear();dead=true;}};
}
