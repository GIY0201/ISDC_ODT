import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
import {createMissionStore} from './mission_store.js';
import {createNativeMissionRequestBuilder} from './mission_request.js';
import {createMissionExecution} from './mission_execution.js';
import {createMissionWindowRecords} from './window_records.js';
// Application assembly: current inputs remain owned by existing node/ground/SIM/module ports.
const copy=v=>structuredClone(v);
const key=v=>{const ordered=item=>{if(item===null||typeof item==='string'||typeof item==='boolean')return item;if(typeof item==='number'&&Number.isFinite(item))return item;if(Array.isArray(item))return item.map(ordered);if(item&&Object.getPrototypeOf(item)===Object.prototype)return Object.fromEntries(Object.keys(item).sort().map(k=>[k,ordered(item[k])]));throw Error('유한한 입력이 필요합니다.');};return JSON.stringify(ordered(v));};
const same=(a,b)=>key(a)===key(b);
const requireValue=(v,message)=>{if(!v)throw Error(message);};
export function createMissionServices({api,nodes,ground,readRuntime,readExternal=()=>null,module,library,groundLinks,model,codec,constraints,storage=null,nextRequestId,onChange=()=>{}}={}){
 if(!api||!nodes||!ground||!module||!library||!groundLinks||!model||!codec||!constraints||typeof readRuntime!=='function'||typeof nextRequestId!=='function')throw TypeError('existing mission owners required');
 let dead=false,status=null;
 const store=createMissionStore({model,storage});store.load();
 const client={endpoint:()=>module.endpoint(),status:async options=>{status=copy(await module.status(options));return copy(status);},guardedPlan:(...args)=>module.guardedPlan(...args),guardedCommit:(...args)=>module.guardedCommit(...args)};
 function context(){
  requireValue(!dead&&store.ready,'임무 저장소를 먼저 불러오세요.');
  const n=nodes.missionInputs(),runtime=readRuntime();requireValue(ground.ready&&Array.isArray(runtime?.active_faults),'지상국·SIM 상태를 확인하세요.');
  requireValue(status?.exchange_contract==='guarded-v1'&&status.reachable&&typeof status.instance_id==='string','군집 운용 모듈 상태를 먼저 조회하세요.');
  const held=Object.entries(status.committed??{}).map(([id])=>{const p=status.accepted_plans?.[id];requireValue(p?.instance_id===status.instance_id&&Array.isArray(p.tasks),'서버 확정 임무를 확인하세요.');return {id,status:'committed',plan:{tasks:copy(p.tasks)}};});
  // Module-held intervals own busy reservations, including those accepted in another window.
  const heldIds=new Set(held.map(m=>m.id));
  return copy({utc:codec.advance(n.utc,0),nodes:n.nodes,stations:ground.enabled,missions:[...store.missions.filter(m=>!heldIds.has(m.id)).map(m=>({...m,status:'draft',plan:null})),...held],faults:runtime.active_faults,deployment:n.deployment,settings:client.endpoint(),module:{instance:status.instance_id,sequence:status.sequence},external:(()=>{const e=readExternal();return e?Object.fromEntries(['group','catalog_number','normalized_gp_sha256','eop_sha256','leap_sha256','profile'].map(k=>[k,e[k]])):null;})()});
 }
 const physical=c=>{const v=copy(c);delete v.missions;v.module={instance:v.module.instance};return v;};
 const current=c=>{try{return !dead&&same(physical(c),physical(context()));}catch{return false;}};
 async function requestWindows(query,{signal}={}){
  if(signal?.aborted)throw new DOMException('native window query cancelled','AbortError');
  const c=context();requireValue(same(query.nodes,c.nodes)&&query.start_utc===c.utc,'계산 입력이 바뀌었습니다.');
  const command={request_id:query.request_id,nodes:c.nodes,run_id:c.deployment.run_id,deployment_revision:c.deployment.revision,utc:c.utc,stations:c.stations,faults:c.faults,module_instance:c.module.instance,module_sequence:c.module.sequence,external:query.external};
  const accepted=copy(await api.nodeMissionContext(command,{signal}));
  if(signal?.aborted)throw new DOMException('native window query cancelled','AbortError');
  requireValue(current(c)&&accepted.schema_version===1&&accepted.status==='verified_analysis_inputs'&&/^[a-f0-9]{64}$/.test(accepted.context_hash??'')&&accepted.communication_status==='unknown'&&same(accepted.nodes,c.nodes)&&same(accepted.stations,c.stations)&&same(accepted.faults,c.faults)&&same(accepted.deployment,c.deployment)&&accepted.utc===c.utc&&same(accepted.external,query.external)&&accepted.module_instance===c.module.instance&&accepted.module_sequence===c.module.sequence,'native approval scope changed');
  const result=copy(await api.nodeMissionWindows(query,{signal,contextHash:accepted.context_hash}));
  requireValue(current(c)&&same(result.accepted_context,accepted)&&same(result.definition_hashes,accepted.definition_hashes),'native approved window scope changed');
  return result;
 }
 function validateContacts(value,c){
  requireValue(value?.schema_version===1&&value.status==='sampled'&&value.communication_status==='unknown'&&same(value.display_context,physical(c)),'contact window context changed');
  const accepted=value.accepted_context,conditions=value.conditions,hashes=accepted?.definition_hashes;
  requireValue(accepted?.status==='verified_analysis_inputs'&&/^[a-f0-9]{64}$/.test(accepted.context_hash??'')&&accepted.utc===c.utc&&same(accepted.nodes,c.nodes)&&same(accepted.stations,c.stations)&&same(accepted.faults,c.faults)&&same(accepted.deployment,c.deployment)&&accepted.module_instance===c.module.instance&&accepted.external===null,'contact approval scope changed');
  requireValue(same(value.node_definitions,c.nodes)&&same(value.definition_hashes,hashes)&&same(Object.keys(hashes??{}).sort(),c.nodes.map(n=>n.id).sort())&&Object.values(hashes??{}).every(v=>/^[a-f0-9]{64}$/.test(v)),'contact definition scope changed');
  const sites=c.stations.map(s=>({station_id:s.id,ground_point:{latitude_deg:s.latitude,longitude_deg:s.longitude,ellipsoid_height_m:(s.altitude_km??0)*1000},minimum_elevation_deg:s.min_elevation_deg??0}));
  requireValue(conditions?.start_utc===c.utc&&codec.advance(conditions.end_utc,0)===conditions.end_utc&&codec.difference(conditions.end_utc,c.utc)>0&&codec.difference(conditions.end_utc,c.utc)<=86400&&same(conditions.sites,sites)&&conditions.target===null&&conditions.external===null&&conditions.max_external_range_km===null,'contact query conditions changed');
  requireValue(Array.isArray(value.contact_reports)&&value.contact_reports.length===sites.length&&new Set(value.contact_reports.map(r=>r.station_id)).size===sites.length,'contact site scope changed');
  let count=0;
  for(const item of value.contact_reports){
   const site=sites.find(s=>s.station_id===item.station_id),g=item.geometry,coverage=g?.coverage;
   requireValue(site&&g?.schema_version===1&&g.status==='sampled'&&Object.entries(NODE_COMMUNICATION_METADATA).every(([k,v])=>g[k]===v)&&same(g.definition_hashes,hashes)&&same(g.site,site.ground_point)&&g.minimum_elevation_deg===site.minimum_elevation_deg,'contact geometry scope changed');
   requireValue(coverage?.start_utc===c.utc&&coverage.end_utc===conditions.end_utc&&coverage.resolution_seconds===30&&coverage.peak_bracket_seconds===0.1&&coverage.boundary_bracket_seconds===1&&coverage.short_intervals_may_be_missed===true,'contact sampling contract changed');
   requireValue(Array.isArray(g.passes)&&((count+=g.passes.length)<=20000),'contact pass capacity invalid');
   const ids=new Set();
   for(const row of g.passes){
    requireValue(typeof row.id==='string'&&row.id&&!ids.has(row.id)&&c.nodes.some(n=>n.id===row.satellite)&&['start','end','peak'].every(k=>codec.advance(row[k],0)===row[k])&&codec.difference(row.start,c.utc)>=0&&codec.difference(conditions.end_utc,row.end)>=0&&codec.difference(row.end,row.start)>=0&&codec.difference(row.peak,row.start)>=0&&codec.difference(row.end,row.peak)>=0&&Number.isFinite(row.max_elevation_deg)&&row.max_elevation_deg>=0&&row.max_elevation_deg<=90&&typeof row.in_progress==='boolean'&&typeof row.truncated==='boolean','contact pass record invalid');ids.add(row.id);
   }
  }
  return true;
 }
 async function queryContactWindows({hours=3,signal}={}){
  const active=()=>{requireValue(!dead,'mission services disposed');if(signal?.aborted)throw new DOMException('contact query cancelled','AbortError');};active();
  requireValue(Number.isFinite(hours)&&hours>0&&hours<=24,'contact horizon must be0..<24h with24 allowed');
  await client.status({signal});active();const c=context(),requestId=nextRequestId();
  const query={request_id:requestId,nodes:c.nodes,sites:c.stations.map(s=>({station_id:s.id,ground_point:{latitude_deg:s.latitude,longitude_deg:s.longitude,ellipsoid_height_m:(s.altitude_km??0)*1000},minimum_elevation_deg:s.min_elevation_deg??0})),start_utc:c.utc,end_utc:codec.advance(c.utc,hours*3600),target:null,external:null,max_external_range_km:null};
  const value=copy(await requestWindows(query,{signal}));active();requireValue(current(c)&&value.request_id===requestId&&same(value.conditions,{sites:query.sites,target:null,external:null,max_external_range_km:null,start_utc:query.start_utc,end_utc:query.end_utc}),'contact query context changed');
  value.display_context=physical(c);validateContacts(value,c);requireValue(current(c),'contact query context changed');return copy(value);
 }
 function verifyContactWindows(value){try{const c=context();return validateContacts(value,c)&&current(c);}catch{return false;}}
 const builder=createNativeMissionRequestBuilder({missionTypes:model,constraints,windowRecords:createMissionWindowRecords({groundLinkModel:groundLinks,missionTypes:model}),optical:{update:()=>nodes.updateMissionLinks(),verifyLinkSnapshot:(...args)=>nodes.verifyMissionLinks(...args)},readContext:context,verifyContext:c=>same(c,context()),requestWindows,advanceUtc:codec.advance,differenceUtc:codec.difference});
 const execution=createMissionExecution({store,builder,client,nextRequestId,verifyContext:b=>current(b.context),hashContext:b=>{requireValue(current(b.context)&&b.evidence?.accepted_context,'현재 native 입력 검증이 필요합니다.');return b.evidence.accepted_context.context_hash;},onChange});
 return Object.freeze({store,execution,context,queryContactWindows,verifyContactWindows,moduleSnapshot:()=>copy(status),editorOptions:()=>{let n=[];try{n=nodes.missionInputs().nodes;}catch{}return copy({nodes:n,stations:ground.ready?ground.enabled:[],external:readExternal()});},queryModule:options=>client.status(options),destroy(){if(dead)return;dead=true;execution.destroy();builder.destroy();store.destroy();}});
}
