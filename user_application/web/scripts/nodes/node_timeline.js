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
function definitionKeyFor(node,ids,catalogs){
  const key=identity(node);
  if(node.schema!==1||typeof node.id!=='string'||!node.id.trim()||node.id.length>80||ids.has(node.id)||!Number.isSafeInteger(node.catalog_number)||node.catalog_number<900000||catalogs.has(node.catalog_number)||!node.orbit||Array.isArray(node.orbit)||typeof node.orbit!=='object')throw new Error('invalid node sample definitions');
  for(const field of ['altitude_km','inclination','eccentricity','raan','argp','mean_anomaly'])if(!Number.isFinite(node.orbit[field]??(['altitude_km','inclination'].includes(field)?NaN:0)))throw new Error('invalid node orbital field');
  const epoch=node.orbit.epoch;
  if(typeof epoch==='string')codec.advance(epoch,0);else if(typeof epoch!=='number'||!Number.isFinite(epoch)||Math.abs(epoch)>8.64e15)throw new Error('invalid node definition epoch');
  return key;
}
const interpolate=(a,b,fraction)=>{
  const linear=(left,right)=>left+(right-left)*fraction;
  const turn=(left,right,origin=0)=>{const delta=((right-left+180)%360+360)%360-180;return ((left+delta*fraction-origin)%360+360)%360+origin;};
  return {inertial_velocity_km_s:a.inertial_velocity_km_s.map((v,i)=>linear(v,b.inertial_velocity_km_s[i])),raan_deg:turn(a.raan_deg,b.raan_deg),argp_deg:turn(a.argp_deg,b.argp_deg),mean_anomaly_deg:turn(a.mean_anomaly_deg,b.mean_anomaly_deg),longitude_deg:turn(a.longitude_deg,b.longitude_deg,-180),latitude_deg:linear(a.latitude_deg,b.latitude_deg),height_km:linear(a.height_km,b.height_km),sunlit:a.sunlit};
};

function* prepareNodeSampleBuffer(request,response,{expectedHashes={}}={}){
  if(!request||typeof request.request_id!=='string'||!request.request_id.trim()||request.request_id.length>128||!Array.isArray(request.nodes)||request.nodes.length<1||request.nodes.length>240||!Number.isInteger(request.count)||request.count<1||request.count>601||request.step_seconds!==1)throw new Error('invalid node sample request');
  const start=codec.advance(request.start_utc,0),times=Array.from({length:request.count},(_,i)=>codec.advance(start,i));
  if(!response||response.schema_version!==1||response.request_id!==request.request_id||!['valid','partial','error'].includes(response.status)||Object.entries(metadata).some(([key,value])=>response[key]!==value)||!Array.isArray(response.nodes)||response.nodes.length!==request.nodes.length)throw new Error('node sample metadata mismatch');
  const responseStatus=response.status,entries=new Map(),catalogs=new Set();let errors=0;
  for(const [index,node]of request.nodes.entries()){
    const key=definitionKeyFor(node,entries,catalogs);
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
    yield;
  }
  const total=request.nodes.length*request.count;
  if(responseStatus!==(errors===total?'error':errors?'partial':'valid'))throw new Error('node sample aggregate status mismatch');
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

export function createNodeSampleBuffer(request,response,options){
  const work=prepareNodeSampleBuffer(request,response,options);let next=work.next();while(!next.done)next=work.next();return next.value;
}

export async function createNodeSampleBufferAsync(request,response,{yieldControl,signal,...options}={}){
  if(typeof yieldControl!=='function')throw new TypeError('node buffer cooperative executor required');
  const captured=structuredClone(request),work=prepareNodeSampleBuffer(captured,response,options);
  const check=()=>{if(signal?.aborted)throw signal.reason??new Error('node buffer aborted');};
  for(;;){check();const next=work.next();if(next.done)return next.value;await yieldControl({signal});check();}
}

// Application owns when to ask for a new shared UTC. This object owns only readonly sample buffers.
export function createNodeTimeline({api,requestId,yieldControl,onChange=()=>{},onError=()=>{}}={}){
  if(typeof api?.nodeSamples!=='function'||typeof requestId!=='function'||typeof yieldControl!=='function')throw new TypeError('node timeline dependencies required');
  let disposed=false,generation=0,sequence=0,definitions=[],definitionKey='[]',active=null,buffers=new Map(),hashes={},startUtc=null,error='';
  const requireOpen=()=>{if(disposed)throw new Error('node timeline disposed');};
  const snapshot=()=>({generation,pending:active!==null,startUtc,error,nodeIds:definitions.map(node=>node.id),definitionHashes:structuredClone(hashes)});
  const emit=()=>{if(disposed)return;try{onChange(snapshot());}catch(e){try{onError(e instanceof Error?e.message:String(e));}catch{/* Observer failures do not change a native receipt. */}}};
  function invalidate(clear){generation++;active?.controller.abort();active=null;if(clear){buffers=new Map();startUtc=null;}error='';}
  function setDefinitions(nodes){
    requireOpen();if(!Array.isArray(nodes)||nodes.length>240)throw new Error('node definition limit0..240');
    const key=identity(nodes),ids=new Set(),catalogs=new Set();
    for(const node of nodes){
      definitionKeyFor(node,ids,catalogs);
      ids.add(node.id);catalogs.add(node.catalog_number);
    }
    if(key===definitionKey)return false;invalidate(true);definitions=structuredClone(nodes);definitionKey=key;hashes={};emit();return true;
  }
  function calculate(utc,{background=false}={}){
    requireOpen();let canonical;
    try{canonical=codec.advance(utc,0);}catch(e){invalidate(true);error=e instanceof Error?e.message:String(e);emit();return Promise.resolve(false);}
    if(!definitions.length)return Promise.resolve(false);
    if(background&&active?.start===canonical)return active.promise??Promise.resolve(false);
    invalidate(!background);const ticket=generation,controller=new AbortController(),scope=structuredClone(definitions),known=structuredClone(hashes);
    const task={start:canonical,controller,promise:null};active=task;emit();
    const current=()=>!disposed&&ticket===generation&&!controller.signal.aborted;
    async function run(){
      const candidate=new Map(),candidateHashes={};
      try{
        for(let offset=0;offset<scope.length;offset+=83){
          if(!current())return false;
          const base=requestId();if(typeof base!=='string'||!base.trim())throw new Error('node request identity required');
          const p={request_id:`${base}-${ticket}-${++sequence}`,nodes:scope.slice(offset,offset+83),start_utc:canonical,count:601,step_seconds:1};
          if(p.request_id.length>128)throw new Error('node request identity exceeds128');
          const value=await api.nodeSamples(structuredClone(p),{signal:controller.signal});if(!current())return false;
          const buffer=await createNodeSampleBufferAsync(p,value,{expectedHashes:known,yieldControl,signal:controller.signal});if(!current())return false;
          for(const id of buffer.nodeIds())candidate.set(id,buffer);
          for(const [id,hash]of Object.entries(buffer.definitionHashes()))Object.defineProperty(candidateHashes,id,{value:hash,enumerable:true});
        }
        if(!current())return false;
        buffers=candidate;hashes=candidateHashes;startUtc=canonical;error='';return true;
      }catch(e){if(!current())return false;buffers=new Map();startUtc=null;error=e instanceof Error?e.message:String(e);return false;}
      finally{if(current()){active=null;emit();}}
    }
    task.promise=run();return task.promise;
  }
  function geometryFor(node,display){if(disposed)return null;return buffers.get(node?.id)?.geometryFor(node,display)??null;}
  function cancel(){requireOpen();invalidate(true);emit();}
  function destroy(){if(disposed)return;invalidate(true);disposed=true;definitions=[];hashes={};}
  return Object.freeze({setDefinitions,calculate,geometryFor,snapshot,cancel,destroy});
}
