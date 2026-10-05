import {createUtcCodec,LEAP_SHA256} from '../orbit_utc.js';
import {createSampleBuffer} from '../orbit_playback.js';

// Readonly projection of source-native node receipts. No clock, HTTP or orbital propagation.
const metadata=Object.freeze({model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'});
const codec=createUtcCodec(LEAP_SHA256);
const fields=['position_m','inertial_velocity_km_s','raan_deg','argp_deg','mean_anomaly_deg','sunlit','longitude_deg','latitude_deg','height_km'];
const scalars=['raan_deg','argp_deg','mean_anomaly_deg','longitude_deg','latitude_deg','height_km'];
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
const valid=row=>row?.status==='valid'&&row.error_code===null&&vector(row.position_m)&&vector(row.inertial_velocity_km_s)&&scalars.every(key=>Number.isFinite(row[key]))&&typeof row.sunlit==='boolean';
function identity(value){
  const ordered=item=>{
    if(item===null||typeof item==='string'||typeof item==='boolean')return item;
    if(typeof item==='number'&&Number.isFinite(item))return item;
    if(Array.isArray(item))return item.map(ordered);
    if(item&&typeof item==='object'&&Object.getPrototypeOf(item)===Object.prototype)return Object.fromEntries(Object.keys(item).sort().map(key=>[key,ordered(item[key])]));
    throw new Error('finite JSON node definition required');
  };
  return JSON.stringify(ordered(value));
}
const interpolate=(a,b,fraction)=>{
  const linear=(left,right)=>left+(right-left)*fraction;
  const turn=(left,right,origin=0)=>{const delta=((right-left+180)%360+360)%360-180;return ((left+delta*fraction-origin)%360+360)%360+origin;};
  return {inertial_velocity_km_s:a.inertial_velocity_km_s.map((v,i)=>linear(v,b.inertial_velocity_km_s[i])),raan_deg:turn(a.raan_deg,b.raan_deg),argp_deg:turn(a.argp_deg,b.argp_deg),mean_anomaly_deg:turn(a.mean_anomaly_deg,b.mean_anomaly_deg),longitude_deg:turn(a.longitude_deg,b.longitude_deg,-180),latitude_deg:linear(a.latitude_deg,b.latitude_deg),height_km:linear(a.height_km,b.height_km),sunlit:a.sunlit};
};

export function createNodeSampleBuffer(request,response,{expectedHashes={}}={}){
  if(!request||typeof request.request_id!=='string'||!request.request_id.trim()||request.request_id.length>128||!Array.isArray(request.nodes)||request.nodes.length<1||request.nodes.length>240||!Number.isInteger(request.count)||request.count<1||request.count>601||request.step_seconds!==1)throw new Error('invalid node sample request');
  const start=codec.advance(request.start_utc,0),times=Array.from({length:request.count},(_,i)=>codec.advance(start,i));
  if(!response||response.schema_version!==1||response.request_id!==request.request_id||!['valid','partial','error'].includes(response.status)||Object.entries(metadata).some(([key,value])=>response[key]!==value)||!Array.isArray(response.nodes)||response.nodes.length!==request.nodes.length)throw new Error('node sample metadata mismatch');
  const entries=new Map(),catalogs=new Set();let errors=0;
  for(const [index,node]of request.nodes.entries()){
    const key=identity(node);
    if(node.schema!==1||typeof node.id!=='string'||!node.id.trim()||node.id.length>80||entries.has(node.id)||!Number.isSafeInteger(node.catalog_number)||node.catalog_number<900000||catalogs.has(node.catalog_number)||!node.orbit||Array.isArray(node.orbit)||typeof node.orbit!=='object')throw new Error('invalid node sample definitions');
    for(const field of ['altitude_km','inclination','eccentricity','raan','argp','mean_anomaly'])if(!Number.isFinite(node.orbit[field]??(['altitude_km','inclination'].includes(field)?NaN:0)))throw new Error('invalid node orbital field');
    const epoch=node.orbit.epoch;
    if(typeof epoch==='string')codec.advance(epoch,0);else if(typeof epoch!=='number'||!Number.isFinite(epoch)||Math.abs(epoch)>8.64e15)throw new Error('invalid node definition epoch');
    const result=response.nodes[index];
    if(!result||result.node_id!==node.id||typeof result.definition_hash!=='string'||!/^[0-9a-f]{64}$/.test(result.definition_hash)||Object.hasOwn(expectedHashes,node.id)&&expectedHashes[node.id]!==result.definition_hash||!Array.isArray(result.rows)||result.rows.length!==request.count)throw new Error('node sample identity/hash mismatch');
    const failureRows=new Map();
    for(const [i,row]of result.rows.entries()){
      if(!row||row.utc!==times[i])throw new Error('node sample UTC grid mismatch');
      if(row.status==='error'){
        if(typeof row.error_code!=='string'||!row.error_code.trim()||row.error_code.length>128||fields.some(key=>row[key]!==null))throw new Error('malformed native node error row');
        errors++;failureRows.set(row.utc,structuredClone(row));
      }else if(!valid(row))throw new Error('malformed native node success row');
    }
    catalogs.add(node.catalog_number);
    const buffer=createSampleBuffer(result.rows,codec.difference,{isValid:valid,interpolateFields:interpolate});
    entries.set(node.id,{definition:structuredClone(node),key,hash:result.definition_hash,buffer,failureRows});
  }
  const total=request.nodes.length*request.count;
  if(response.status!==(errors===total?'error':errors?'partial':'valid'))throw new Error('node sample aggregate status mismatch');
  function geometryFor(node,display){
    const entry=entries.get(node?.id);if(!entry)return null;
    try{
      if(identity(node)!==entry.key||typeof display?.utc!=='string'||codec.advance(display.utc,0)!==display.utc)return null;
      const row=entry.failureRows.get(display.utc)??entry.buffer.sampleAt(display.utc);if(!row)return null;
      if(row.status==='valid'&&!valid(row))return null;
      const elapsed=codec.difference(display.utc,start),observed=codec.advance(start,Math.floor(elapsed));
      return {...metadata,node_id:node.id,node_definition:structuredClone(entry.definition),definition_hash:entry.hash,row:structuredClone(row),observation_utc:observed,interpolated:display.utc!==observed};
    }catch{return null;}
  }
  return Object.freeze({geometryFor,nodeIds:()=>[...entries.keys()],definitionHashes:()=>Object.fromEntries([...entries].map(([id,entry])=>[id,entry.hash]))});
}
