import {createNativeContactBundleValidator} from '../missions/native_contact_bundle.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const copy=value=>structuredClone(value);
const sourceKey=display=>{const source={...display};delete source.utc;return JSON.stringify(source);};
// Owns one readonly query lane and historical presentation, never current state.
export function createFuturePasses({api,inputs,readDisplay,codec,nextRequestId,onChange=()=>{}}={}){
 if(typeof api?.nodeMissionWindows!=='function'||typeof inputs?.captureFuturePassInputs!=='function'||typeof inputs?.verifyFuturePassInputs!=='function'||typeof readDisplay!=='function'||typeof codec?.advance!=='function'||typeof codec?.difference!=='function'||typeof nextRequestId!=='function')throw TypeError('actual future pass owners required');
 const validator=createNativeContactBundleValidator({advanceUtc:codec.advance,differenceUtc:codec.difference});
 let active=false,dead=false,generation=0,stationId=null,result=null,inFlight=null,queued=false,error='',lastAttempt=null,cancelDepth=0;
 const views=new WeakMap();
 const bound=version=>!dead&&active&&!cancelDepth&&generation===version;
 const emit=version=>{if(!bound(version))return;try{onChange();}catch(exc){if(!bound(version))return;++generation;result=null;queued=false;error=String(exc?.message??exc);cancelDepth++;try{inFlight?.abort.abort();}finally{cancelDepth--;}}};
 function display(){const value=copy(readDisplay());if(!value||codec.advance(value.utc,0)!==value.utc||!Number.isFinite(Date.parse(value.utc))||/T\d{2}:\d{2}:60/.test(value.utc))throw Error('actual display UTC unavailable');return value;}
 function proof(record){
  const version=generation;try{
   if(!record||!bound(version)||record.generation!==version||inputs.verifyFuturePassInputs(record.input)!==true)return null;
   const a=display(),b=display();
   if(sourceKey(a)!==record.source||JSON.stringify(a)!==JSON.stringify(b)||!bound(version)||inputs.verifyFuturePassInputs(record.input)!==true||!bound(version))return null;
   return a;
  }catch{return null;}
 }
 function capture(){
  const version=generation;try{
   if(!bound(version))return null;const input=inputs.captureFuturePassInputs(stationId);
   if(!bound(version)||!input||input.presentation_kind!=='FUTURE_PASS_INPUT_V1'||!Object.isFrozen(input)||!Array.isArray(input.nodes)||!input.nodes.length||input.nodes.length>240||!input.station?.enabled||stationId!==null&&input.station.id!==stationId||inputs.verifyFuturePassInputs(input)!==true)return null;
   const value=display();if(input.analysis_utc!==value.utc||!bound(version))return null;
   const record={input,source:sourceKey(value),generation:version};return proof(record)?record:null;
  }catch{return null;}
 }
 function invalidate(message='',suppress=true){
  const version=++generation;result=null;queued=false;error=message;if(!suppress)lastAttempt=null;
  cancelDepth++;try{inFlight?.abort.abort();}finally{cancelDepth--;}
  emit(version);
 }
 function projection(bundle,record){
  const passes=bundle.contact_reports[0].geometry.passes,rows=[];
  for(const node of record.input.nodes){const selected=passes.filter(row=>row.satellite===node.id).sort((a,b)=>codec.difference(a.start,b.start)).slice(0,3);for(const row of selected)rows.push({satellite:row.satellite,name:node.name||node.id,start:row.start,end:row.end,peak:row.peak,max_elevation_deg:row.max_elevation_deg,duration_seconds:codec.difference(row.end,row.start),in_progress:row.in_progress,truncated:row.truncated});}
  rows.sort((a,b)=>codec.difference(a.start,b.start));
  const coverage=bundle.contact_reports[0].geometry.coverage;
  return freeze({record,analysis_utc:record.input.analysis_utc,end_utc:bundle.conditions.end_utc,station:copy(record.input.station),satellite_count:record.input.nodes.length,rows:copy(rows.slice(0,12)),coverage:{...copy(coverage),peak_tolerance_seconds:coverage.peak_bracket_seconds,boundary_tolerance_seconds:coverage.boundary_bracket_seconds}});
 }
 function start(record){
  if(inFlight){queued=true;return inFlight.task;}
  const version=generation,input=record.input,query={request_id:nextRequestId(),nodes:copy(input.nodes),sites:[{station_id:input.station.id,ground_point:{latitude_deg:input.station.latitude,longitude_deg:input.station.longitude,ellipsoid_height_m:(input.station.altitude_km??0)*1000},minimum_elevation_deg:input.station.min_elevation_deg??0}],start_utc:input.analysis_utc,end_utc:codec.advance(input.analysis_utc,10800),target:null,external:null,max_external_range_km:null};
  if(!bound(version)||inFlight||!proof(record))return inFlight?.task??Promise.resolve();
  const job={record,abort:new AbortController(),task:null};inFlight=job;lastAttempt={utc:query.start_utc,source:record.source,input};error='';emit(version);
  job.task=(async()=>{
   try{
    if(inFlight!==job||!proof(record))return;
    const bundle=copy(await api.nodeMissionWindows(query,{signal:job.abort.signal}));
    if(inFlight!==job||job.abort.signal.aborted||!proof(record))return;
    if('accepted_context'in bundle||bundle.target_report!==null||bundle.external_report!==null)throw Error('visual geometry cannot carry approval or foreign reports');
    validator.validateContacts(bundle,{query,maximumHorizonSeconds:10800});
    validator.validateEclipse(bundle.eclipse_report,{startUtc:query.start_utc,endUtc:query.end_utc,definitionHashes:bundle.definition_hashes,nodeIds:input.nodes.map(n=>n.id)});
    const accepted=projection(bundle,record);if(inFlight!==job||job.abort.signal.aborted||!proof(record))return;
    result=accepted;error='';emit(version);
   }catch(exc){if(inFlight===job&&!job.abort.signal.aborted&&proof(record)&&inFlight===job&&bound(version)){result=null;error=String(exc?.message??exc);emit(version);}}
   finally{
    if(inFlight===job){inFlight=null;const resume=queued;queued=false;if(bound(generation)){emit(generation);if(resume&&bound(generation))void observe();}}
   }
  })();return job.task;
 }
 function observe(){
  if(!bound(generation))return Promise.resolve();
  if(inFlight?.record.generation===generation&&!proof(inFlight.record))invalidate('',false);
  if(result&&!proof(result.record))invalidate('',false);
  const version=generation;
  if(lastAttempt){const attempted=lastAttempt;let valid=false;try{valid=inputs.verifyFuturePassInputs(attempted.input)===true;}catch{/* Failed owner proof retires only the captured attempt. */}if(!bound(version))return Promise.resolve();if(lastAttempt===attempted&&!valid)lastAttempt=null;}
  if(!bound(version))return Promise.resolve();
  if(!bound(generation))return Promise.resolve();const record=capture();if(!record){if(result||!error)invalidate('future pass inputs unavailable');return Promise.resolve();}
  const utc=record.input.analysis_utc;
  if(inFlight){if(inFlight.record.generation!==generation||Math.abs(Date.parse(utc)-Date.parse(inFlight.record.input.analysis_utc))>60000)queued=true;return inFlight.task;}
  if(lastAttempt&&lastAttempt.source===record.source&&Math.abs(Date.parse(utc)-Date.parse(lastAttempt.utc))<=60000)return Promise.resolve();
  return start(record);
 }
 function refresh(){if(!bound(generation))return Promise.resolve();invalidate('',false);if(!bound(generation))return Promise.resolve();const record=capture();if(!record){error='future pass inputs unavailable';emit(generation);return Promise.resolve();}return start(record);}
 function presentation(){
  const version=generation,accepted=result,current=accepted?proof(accepted.record):null;
  if(!current||result!==accepted||!bound(version))return freeze({presentation_kind:'FUTURE_PASSES_UI_V1',status:error?'error':inFlight&&active?'pending':'unavailable',availability:error?'error':inFlight&&active?'pending':'unavailable',error,analysis_utc:null,display_utc:null,end_utc:null,age_seconds:null,station:null,satellite_count:0,rows:[],coverage:null,communication_status:'unknown'});
  const value=freeze({presentation_kind:'FUTURE_PASSES_UI_V1',status:'valid',availability:inFlight||queued?'pending':'sampled',error:'',analysis_utc:accepted.analysis_utc,display_utc:current.utc,end_utc:accepted.end_utc,age_seconds:codec.difference(current.utc,accepted.analysis_utc),station:accepted.station,satellite_count:accepted.satellite_count,rows:accepted.rows.map(row=>({...row,live:codec.difference(current.utc,row.start)>=0&&codec.difference(row.end,current.utc)>=0})),coverage:accepted.coverage,communication_status:'unknown'});
  const finalDisplay=proof(accepted.record);if(!finalDisplay||JSON.stringify(finalDisplay)!==JSON.stringify(current)||!bound(version)||result!==accepted)return freeze({...value,status:'unavailable',availability:'unavailable',rows:[]});views.set(value,{generation:version,result:accepted,utc:current.utc});return value;
 }
 function verifyPresentation(value){
  const registration=views.get(value);if(!registration)return false;
  let valid=false;
  if(registration.generation===generation&&registration.result===result){const current=proof(registration.result.record);valid=!!current&&current.utc===registration.utc&&registration.generation===generation&&registration.result===result&&bound(generation);}
  if(!valid)views.delete(value);return valid;
 }
 return Object.freeze({setActive(value){if(dead)return Promise.resolve();const next=value===true;if(next===active)return next?observe():Promise.resolve();active=next;invalidate('',false);return next?observe():Promise.resolve();},selectStation(id){if(id!==null&&typeof id!=='string')throw TypeError('station ID required');if(dead)return Promise.resolve();stationId=id;return refresh();},refresh,observe,presentation,verifyPresentation,snapshot:()=>({...copy(presentation()),active,disposed:dead,station_id:stationId,pending:!!inFlight||queued}),cancel(){if(dead)return;invalidate();},destroy(){if(dead)return;dead=true;active=false;invalidate();}});
}
