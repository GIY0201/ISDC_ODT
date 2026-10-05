import {createUtcCodec} from './orbit_utc.js';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const quality=value=>['ut1','polar_motion'].every(key=>['final_b','observed_a','predicted_a'].includes(value?.[key]));
const copy=value=>structuredClone(value);

// A bounded display-input cache. UTC is always supplied by the existing owner;
// this module owns neither playback, animation callbacks nor a wall clock.
export function createSolarTimeline(api,onDisplay=()=>{},notify=()=>{},host={}){
 const requestId=host.requestId??(()=>crypto.randomUUID());
 let dead=false,context=null,codec=null,generation=0,flight=null,buffers=[],pinned=null,failed=null,error='',display=null,direction=1;
 const emit=value=>{display=value;if(!dead){onDisplay(value?copy(value):null);notify();}};
 function cancel(){generation++;flight?.abort.abort();flight=null;}
 function clear(){if(dead)return;cancel();context=null;codec=null;buffers=[];pinned=null;failed=null;error='';direction=1;emit(null);}
 function contains(buffer,utc){try{const elapsed=codec.difference(utc,buffer.start_utc);return elapsed>=0&&elapsed<=600;}catch{return false;}}
 function sampleAt(utc){
  if(dead||!codec||!context)return null;
  try{
   if(codec.advance(utc,0)!==utc)return null;
   const buffer=[...buffers].reverse().find(value=>contains(value,utc));if(!buffer)return null;
   const elapsed=codec.difference(utc,buffer.start_utc),index=Math.floor(elapsed),fraction=elapsed-index,a=buffer.rows[index];
   let vector=[...a.direction_to_sun],q={...a.eop_quality};
   if(fraction>0){
    const b=buffer.rows[index+1];if(!b)return null;
    vector=vector.map((v,i)=>v+(b.direction_to_sun[i]-v)*fraction);
    const norm=Math.hypot(...vector);if(!Number.isFinite(norm)||norm<1e-12)return null;
    vector=vector.map(v=>v/norm);
    for(const key of ['ut1','polar_motion'])q[key]=[a.eop_quality[key],b.eop_quality[key]].includes('predicted_a')?'predicted_a':[a.eop_quality[key],b.eop_quality[key]].includes('observed_a')?'observed_a':'final_b';
   }
   return{utc,status:'valid',frame:'ITRF',direction_to_sun:vector,eop_quality:q,interpolated:fraction!==0,
    eop_sha256:buffer.eop_sha256,leap_sha256:buffer.leap_sha256,solar_model:buffer.solar_model,
    frame_transform:buffer.frame_transform,observed_cip_offsets:false};
  }catch{return null;}
 }
 function validate(value,payload){
  if(!value||value.schema_version!==1||value.status!=='valid'||value.client_request_id!==payload.client_request_id||value.frame!=='ITRF'
   ||value.start_utc!==payload.start_utc||value.end_utc!==codec.advance(payload.start_utc,600)||value.step_seconds!==1||value.count!==601
   ||!hash(value.eop_sha256)||value.leap_sha256!==context.leap_sha256
   ||(context.eop_sha256||pinned)&&value.eop_sha256!==(context.eop_sha256||pinned)
   ||value.solar_model!=='ERFA_builtin'||value.frame_transform!=='IAU2006_2000A'||value.observed_cip_offsets!==false
   ||value.purpose!=='display_geometry'||value.units?.direction!=='unitless'||value.units?.time!=='UTC'
   ||!Array.isArray(value.rows)||value.rows.length!==601)throw Error('태양 표본의 시각·단위·출처가 일치하지 않습니다.');
  const rows=value.rows.map((row,index)=>{
   const vector=row?.direction_to_sun;
   if(row?.utc!==codec.advance(payload.start_utc,index)||row.status!=='valid'||!quality(row.eop_quality)
    ||!Array.isArray(vector)||vector.length!==3||!vector.every(Number.isFinite)||Math.abs(Math.hypot(...vector)-1)>1e-8)
    throw Error('태양 표본의 좌표·간격·EOP 품질 오류');
   return Object.freeze({utc:row.utc,status:'valid',direction_to_sun:Object.freeze([...vector]),eop_quality:Object.freeze({...row.eop_quality})});
  });
  return Object.freeze({start_utc:value.start_utc,end_utc:value.end_utc,rows:Object.freeze(rows),eop_sha256:value.eop_sha256,
   leap_sha256:value.leap_sha256,solar_model:value.solar_model,frame_transform:value.frame_transform});
 }
 async function query(start){
  cancel();const ticket=generation,abort=new AbortController();
  const payload={client_request_id:requestId(),start_utc:start,step_seconds:1,count:601};
  flight={start_utc:start,abort};failed=null;error='';notify();
  try{
   const response=await api.solarSamples(payload,{signal:abort.signal});
   if(dead||ticket!==generation)return;
   const buffer=validate(response,payload);pinned=buffer.eop_sha256;
   buffers=[...buffers.filter(value=>value.start_utc!==buffer.start_utc),buffer].slice(-2);
   flight=null;emit(sampleAt(context.utc));
  }catch(e){
   if(dead||ticket!==generation)return;
   flight=null;buffers=[];failed={start_utc:start};error=String(e.message||e);emit(null);
  }
 }
 function paint(){
  const row=sampleAt(context.utc);emit(row);
  if(failed&&contains(failed,context.utc))return;
  if(!row){
   const invalid=buffers.find(value=>contains(value,context.utc));
   if(invalid){cancel();failed={start_utc:invalid.start_utc};buffers=[];error='태양 방향을 유효하게 보간할 수 없습니다.';emit(null);return;}
   if(!flight||!contains(flight,context.utc))void query(context.utc);
   return;
  }
  if(flight)return;
  const buffer=[...buffers].reverse().find(value=>contains(value,context.utc));
  const elapsed=codec.difference(context.utc,buffer.start_utc);
  if(direction>0&&600-elapsed<=120||direction<0&&elapsed<=120){
   const start=codec.advance(buffer.start_utc,direction*480);
   if(!buffers.some(value=>value.start_utc===start))void query(start);
  }
 }
 function setContext(input){
  if(dead)return;
  if(!input){clear();return;}
  try{
   if(typeof input.key!=='string'||!input.key.trim()||input.eop_sha256!=null&&!hash(input.eop_sha256))throw Error('태양 표시 대상·출처 오류');
   const nextCodec=createUtcCodec(input.leap_sha256),utc=nextCodec.advance(input.utc,0);
   const same=context?.key===input.key&&context.leap_sha256===input.leap_sha256&&context.eop_sha256===(input.eop_sha256??null);
   if(!same){cancel();buffers=[];pinned=null;failed=null;error='';direction=1;}
   else{const delta=nextCodec.difference(utc,context.utc);if(delta!==0)direction=Math.sign(delta);}
   codec=nextCodec;context={key:input.key,utc,leap_sha256:input.leap_sha256,eop_sha256:input.eop_sha256??null};paint();
  }catch(e){clear();error=String(e.message||e);notify();}
 }
 return{setContext,sampleAt,clear,
  retry(){if(!dead&&context){failed=null;buffers=[];emit(null);void query(context.utc);}},
  snapshot:()=>({key:context?.key??null,utc:context?.utc??null,pending:Boolean(flight),error,
   eop_sha256:pinned,leap_sha256:context?.leap_sha256??null,status:display?'ready':error?'error':flight?'loading':'unavailable',
   buffers:buffers.map(value=>({start_utc:value.start_utc,end_utc:value.end_utc,count:601}))}),
  destroy(){if(dead)return;clear();dead=true;},
 };
}
