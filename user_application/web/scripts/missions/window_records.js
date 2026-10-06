import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';

// Source ICD-03 window record projection only. No propagation, storage, clock or transport.
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
function iso(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('valid source UTC required');
 const result=new Date(value).toISOString();
 if(result.slice(0,19)!==value.slice(0,19))throw new Error('valid calendar UTC required');
 return result;
}
function verified(node,site,geometry,definitionHash){
 if(typeof node?.id!=='string'||!node.id.trim()||typeof definitionHash!=='string'||!/^[0-9a-f]{64}$/.test(definitionHash))throw new Error('explicit native definition identity required');
 if(geometry?.schema_version!==1||geometry.status!=='sampled'||Object.entries(NODE_COMMUNICATION_METADATA).some(([key,value])=>geometry[key]!==value))throw new Error('native mission geometry unavailable');
 if(!geometry.definition_hashes||Object.keys(geometry.definition_hashes).length!==1||geometry.definition_hashes[node.id]!==definitionHash)throw new Error('native mission definition changed');
 const height=site?.altitude_km===undefined?0:site.altitude_km*1000;
 if(!close(geometry.site?.latitude_deg,site?.latitude)||!close(geometry.site?.longitude_deg,site?.longitude)||!close(geometry.site?.ellipsoid_height_m,height))throw new Error('native mission site changed');
 const coverage=geometry.coverage;
 const first=Date.parse(iso(coverage?.start_utc)),last=Date.parse(iso(coverage?.end_utc));
 if(!(last>first&&last-first<=86400000)||coverage.resolution_seconds!==30||coverage.peak_bracket_seconds!==0.1||coverage.boundary_bracket_seconds!==1||coverage.short_intervals_may_be_missed!==true)throw new Error('native sampled coverage unavailable');
 if(!Array.isArray(geometry.passes)||geometry.passes.length>20000)throw new Error('native pass capacity invalid');
 const ids=new Set();
 return geometry.passes.map(pass=>{
  if(pass?.satellite!==node.id||typeof pass.id!=='string'||ids.has(pass.id)||!Number.isFinite(pass.max_elevation_deg)||pass.max_elevation_deg<0||pass.max_elevation_deg>90||typeof pass.in_progress!=='boolean'||typeof pass.truncated!=='boolean')throw new Error('invalid native pass record');
  ids.add(pass.id);
  const start=iso(pass.start),end=iso(pass.end),peak=iso(pass.peak),a=Date.parse(start),b=Date.parse(end),p=Date.parse(peak);
  if(a<first||b>last||b<a||p<a||p>b)throw new Error('native pass outside coverage');
  return {...pass,start,end,peak};
 });
}
export function createMissionWindowRecords({groundLinkModel,missionTypes}={}){
 if(['radioLinksOf','chooseBand'].some(key=>typeof groundLinkModel?.[key]!=='function')||!missionTypes?.UPLINK_RATE_MBPS)throw new TypeError('existing source ground/mission models required');
 const contacts=({node,station,geometry,definitionHash})=>{
  const passes=verified(node,station,geometry,definitionHash);
  if(typeof station.id!=='string'||!station.id.trim()||!close(geometry.minimum_elevation_deg,station.min_elevation_deg??0))throw new Error('native station/mask changed');
  const radios=groundLinkModel.radioLinksOf(node),band=groundLinkModel.chooseBand(radios,station);
  if(!band)return [];
  const spec=radios.get(band),rawRate=Number(spec?.data_rate_mbps??0),rate=rawRate||0,uplink=missionTypes.UPLINK_RATE_MBPS[band]||0;
  if(!Number.isFinite(rawRate)||rate<0||!Number.isFinite(uplink)||uplink<0)throw new Error('invalid source radio rate');
  return passes.map(pass=>({id:`${station.id}|${node.id}|${pass.start}`,satellite:node.id,station:station.id,band,
   rate_mbps:rate,uplink_mbps:uplink,start:pass.start,end:pass.end,peak:pass.peak,
   max_elevation:Math.round(pass.max_elevation_deg*10)/10,in_progress:pass.in_progress===true}));
 };
 const access=({node,target,offNadirDegrees,geometry,definitionHash})=>{
  const passes=verified(node,target,geometry,definitionHash);
  if(!Number.isFinite(offNadirDegrees)||offNadirDegrees<=0||offNadirDegrees>90||!close(geometry.off_nadir_degrees,offNadirDegrees)||!Number.isFinite(node.orbit?.altitude_km))throw new Error('native camera cone changed');
  // Exact original elevationForOffNadir equation; no propagation or new physical model.
  const ratio=(6378.137+Math.max(0,node.orbit.altitude_km))/6378.137*Math.sin(offNadirDegrees*Math.PI/180);
  const mask=ratio>=1?0:Math.acos(ratio)*180/Math.PI;
  return passes.map(pass=>{
   if(!close(pass.minimum_elevation_deg,mask))throw new Error('native access mask changed');
   return {id:`access|${node.id}|${pass.start}`,satellite:node.id,start:pass.start,end:pass.end,peak:pass.peak,
    max_elevation:Math.round(pass.max_elevation_deg*10)/10,min_elevation:Math.round(mask*10)/10};
  });
 };
 return Object.freeze({contacts,access});
}
