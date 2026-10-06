import {createUtcCodec,LEAP_SHA256} from '../orbit_utc.js';

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
  if(typeof epoch==='string'){
    if(/T\d{2}:\d{2}:60(?:\.|Z|\+00:00)/.test(epoch))codec.advance(epoch.replace(/\+00:00$/,'Z'),0);
    else nodeGregorianMillis(epoch);
  }else if(typeof epoch!=='number'||!Number.isFinite(epoch)||Math.abs(epoch)>8.64e15)throw new Error('invalid node definition epoch');
  return key;
}
function freezeProjection(value,seen=new WeakSet()){
  if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const child of Object.values(value))freezeProjection(child,seen);Object.freeze(value);}
  return value;
}
function bindDisplayGeometryOwner({revision,bufferForNode}){
  const registered=new WeakMap();
  const isCurrent=view=>{const own=registered.get(view);return !!own&&revision()===own.revision&&bufferForNode(view.node_id)===own.buffer&&own.buffer.displayGeometry.isCurrent(view);};
  return Object.freeze({revision,isCurrent,
    viewFor(node){const token=revision(),buffer=token&&bufferForNode(node?.id);if(!buffer)return null;const view=buffer.displayGeometry.viewFor(node);if(!view||revision()!==token||bufferForNode(node.id)!==buffer)return null;registered.set(view,{revision:token,buffer});return view;},
    sampleAt(view,utc){if(!isCurrent(view))return null;const value=registered.get(view).buffer.displayGeometry.sampleAt(view,utc);return isCurrent(view)?value:null;},
    verifySample(view,value,utc){return isCurrent(view)&&registered.get(view).buffer.displayGeometry.verifySample(view,value,utc)&&isCurrent(view);},
  });
}
function guardDisplayGeometry(port,allowed){
  return Object.freeze({revision:()=>allowed()?port.revision():null,isCurrent:view=>allowed()&&port.isCurrent(view),
    viewFor(node){if(!allowed())return null;const view=port.viewFor(node);return allowed()?view:null;},
    sampleAt(view,utc){if(!allowed())return null;const value=port.sampleAt(view,utc);return allowed()?value:null;},
    verifySample:(view,value,utc)=>allowed()&&port.verifySample(view,value,utc)&&allowed(),
  });
}
export const NODE_COMMUNICATION_METADATA=metadata;
export function isNodeCommunicationState(value,{node,utc}={}){
  try{
    if(!value||Object.entries(metadata).some(([key,expected])=>value[key]!==expected)||value.node_id!==node.id||identity(value.node_definition)!==identity(node)||value.utc!==utc||codec.advance(utc,0)!==utc||value.interpolated!==false||!(/^[a-f0-9]{64}$/.test(value.definition_hash)))return false;
    return validCommunicationPayload(value);
  }catch{return false;}
}
function validCommunicationPayload(value){
    const r=value.inertial?.r,v=value.inertial?.v,basis=value.basis;
    if(!vector(r)||!vector(v)||!(Math.hypot(...r)>0)||!(Math.hypot(...v)>0)||!basis||!['x','y','z'].every(axis=>vector(basis[axis])&&Math.abs(Math.hypot(...basis[axis])-1)<=1e-7))return false;
    const dot=(a,b)=>a.reduce((sum,item,i)=>sum+item*b[i],0);
    if(Math.abs(dot(basis.x,basis.y))>1e-7||Math.abs(dot(basis.x,basis.z))>1e-7||Math.abs(dot(basis.y,basis.z))>1e-7)return false;
    const cross=[basis.x[1]*basis.y[2]-basis.x[2]*basis.y[1],basis.x[2]*basis.y[0]-basis.x[0]*basis.y[2],basis.x[0]*basis.y[1]-basis.x[1]*basis.y[0]];
    return cross.every((item,i)=>Math.abs(item-basis.z[i])<=1e-7)&&typeof value.sunlit==='boolean'&&['longitude','latitude','altitude','velocity'].every(key=>Number.isFinite(value.geodetic?.[key]))&&value.geodetic.velocity===Math.hypot(...v);
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
  // Capture and freeze complete native rows before private projection reads.
  // Keep the full validation result only for those immutable row/vector objects
  // inside this prepared native buffer. A replacement buffer gets a new memo;
  // mutable/interpolated public results still undergo the complete check below.
  const rowValidity=new WeakMap();
  const immutableRowValid=row=>{
    if(rowValidity.has(row))return rowValidity.get(row);
    const accepted=valid(row);
    if(row&&typeof row==='object'&&Object.isFrozen(row)&&Object.isFrozen(row.position_m)&&Object.isFrozen(row.inertial_velocity_km_s))rowValidity.set(row,accepted);
    return accepted;
  };
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
    const captured=freezeProjection(structuredClone(result.rows));
    const offsets=captured.map(row=>codec.difference(row.utc,start));
    // The receipt already proves the canonical one-second grid. This private
    // sampler has no caller-provided callbacks or mutable inputs to isolate.
    // Retain the generic sampler's exact binary search/interpolation semantics.
    const buffer={sampleAt(utc){
      const target=codec.difference(utc,start);
      if(!Number.isFinite(target)||target<offsets[0]||target>offsets.at(-1))return null;
      let left=0,right=offsets.length-1;
      while(left<right){const mid=(left+right)>>1;if(offsets[mid]<target)left=mid+1;else right=mid;}
      if(offsets[left]===target)return immutableRowValid(captured[left])?captured[left]:null;
      const a=captured[left-1],b=captured[left],span=offsets[left]-offsets[left-1];
      if(!immutableRowValid(a)||!immutableRowValid(b)||span>1.000000001)return null;
      const fraction=(target-offsets[left-1])/span;
      return {...interpolate(a,b,fraction),utc,status:'valid',error_code:null,position_m:a.position_m.map((v,i)=>v+(b.position_m[i]-v)*fraction)};
    }};
    entries.set(node.id,{definition:structuredClone(node),key,hash:result.definition_hash,buffer,failureRows});
    yield;
  }
  const total=request.nodes.length*request.count;
  if(responseStatus!==(errors===total?'error':errors?'partial':'valid'))throw new Error('node sample aggregate status mismatch');
  function projectEntry(entry,utc){
    const row=entry.failureRows.get(utc)??entry.buffer.sampleAt(utc);if(!row)return null;
    // Immutable captured rows reuse their prior full proof; every new fractional
    // result receives the complete finite/type check before packet registration.
    if(row.status==='valid'&&!immutableRowValid(row))return null;
    const elapsed=codec.difference(utc,start),observed=codec.advance(start,Math.floor(elapsed));
    return {...metadata,node_id:entry.definition.id,node_definition:entry.definition,definition_hash:entry.hash,row,observation_utc:observed,interpolated:utc!==observed};
  }
  function geometryFor(node,display){
    const entry=entries.get(node?.id);if(!entry)return null;
    try{
      if(identity(node)!==entry.key||typeof display?.utc!=='string'||codec.advance(display.utc,0)!==display.utc)return null;
      const value=projectEntry(entry,display.utc);if(!value)return null;
      return {...value,node_definition:structuredClone(entry.definition),row:structuredClone(value.row)};
    }catch{return null;}
  }
  function communicationStateFor(node,display){
    const value=geometryFor(node,display);
    if(!value||value.interpolated||!valid(value.row))return null;
    const row=value.row,basis=row.lvlh_basis;
    if(!vector(row.inertial_position_km)||!vector(row.inertial_velocity_km_s))return null;
    const result={...metadata,node_id:node.id,node_definition:structuredClone(value.node_definition),definition_hash:value.definition_hash,
      utc:display.utc,interpolated:false,inertial:{r:[...row.inertial_position_km],v:[...row.inertial_velocity_km_s]},basis:structuredClone(basis),
      geodetic:{longitude:row.longitude_deg,latitude:row.latitude_deg,altitude:row.height_km,velocity:Math.hypot(...row.inertial_velocity_km_s)},sunlit:row.sunlit};
    return isNodeCommunicationState(result,{node,utc:display.utc})?result:null;
  }
  // Internal exact-point cohort extraction. Full definition matching happens
  // at this boundary; private immutable rows do not pass through the copied
  // geometry API. The complete public communication payload is still checked.
  function communicationStatesFor(nodes,display){
    try{
      if(!Array.isArray(nodes)||!nodes.length||nodes.length>240||typeof display?.utc!=='string'||codec.advance(display.utc,0)!==display.utc)return null;
      const ids=new Set(),states=[];
      for(const node of nodes){
        const entry=entries.get(node?.id);if(!entry||ids.has(entry.definition.id)||identity(node)!==entry.key)return null;
        ids.add(entry.definition.id);
        const value=projectEntry(entry,display.utc);if(!value||value.interpolated||!immutableRowValid(value.row))return null;
        const row=value.row,result={...metadata,node_id:entry.definition.id,node_definition:entry.definition,definition_hash:entry.hash,
          utc:display.utc,interpolated:false,inertial:{r:row.inertial_position_km,v:row.inertial_velocity_km_s},basis:row.lvlh_basis,
          geodetic:{longitude:row.longitude_deg,latitude:row.latitude_deg,altitude:row.height_km,velocity:Math.hypot(...row.inertial_velocity_km_s)},sunlit:row.sunlit};
        if(!validCommunicationPayload(result))return null;
        states.push([entry.definition.id,result]);
      }
      return structuredClone(states);
    }catch{return null;}
  }
  // These registered display packets are derived immutable projections, never
  // mutable runtime state. The public geometryFor above retains fresh copies.
  const receiptRevision=Object.freeze({}),views=new Map(),registeredViews=new WeakMap(),registeredPackets=new WeakMap();
  const displayGeometry=Object.freeze({revision:()=>receiptRevision,isCurrent:view=>registeredViews.has(view),
    viewFor(node){
      const entry=entries.get(node?.id);if(!entry)return null;
      try{if(identity(node)!==entry.key)return null;}catch{return null;}
      if(views.has(node.id))return views.get(node.id);
      const view=freezeProjection({...metadata,node_id:node.id,definition_key:entry.key,node_definition:structuredClone(entry.definition),definition_hash:entry.hash,receipt_revision:receiptRevision});
      views.set(node.id,view);registeredViews.set(view,{entry,cache:new Map()});return view;
    },
    sampleAt(view,utc){
      const own=registeredViews.get(view);if(!own||typeof utc!=='string')return null;
      if(own.cache.has(utc)){const value=own.cache.get(utc);own.cache.delete(utc);own.cache.set(utc,value);return value;}
      let value=null;
      try{
        if(codec.advance(utc,0)===utc){
          const projection=projectEntry(own.entry,utc);
          if(projection)value=freezeProjection({...projection,node_definition:view.node_definition});
        }
      }catch{/* Invalid UTC or nonfinite interpolation cannot become a packet. */}
      if(value)registeredPackets.set(value,{view,utc});
      own.cache.set(utc,value);if(own.cache.size>2)own.cache.delete(own.cache.keys().next().value);return value;
    },
    verifySample(view,value,utc){const own=registeredPackets.get(value);return registeredViews.has(view)&&!!own&&own.view===view&&own.utc===utc&&value.row?.utc===utc;},
  });
  return Object.freeze({geometryFor,communicationStateFor,communicationStatesFor,displayGeometry,nodeIds:()=>[...entries.keys()],definitionHashes:()=>Object.fromEntries([...entries].map(([id,entry])=>[id,entry.hash]))});
}

export function createNodeSampleBuffer(request,response,options){
  const work=prepareNodeSampleBuffer(request,response,options);let next=work.next();while(!next.done)next=work.next();return next.value;
}

export async function createNodeSampleBufferAsync(request,response,{yieldControl,signal,...options}={}){
  if(typeof yieldControl!=='function')throw new TypeError('node buffer cooperative executor required');
  const captured=structuredClone(request),work=prepareNodeSampleBuffer(captured,response,options);
  const check=()=>{if(signal?.aborted)throw signal.reason??new Error('node buffer aborted');};
  // A complete native point batch is at most240 rows. Validate that bounded
  // receipt atomically through the same generator; timer scheduling must not
  // add one wait per node to the command lane. Large display grids still yield.
  const bounded=Array.isArray(captured?.nodes)&&Number.isSafeInteger(captured.count)&&captured.count>0&&captured.nodes.length*captured.count<=240;
  for(;;){check();const next=work.next();if(next.done){check();return next.value;}if(!bounded)await yieldControl({signal});check();}
}

// Calendar conversion for the source Date TimeClip grid, not a display clock.
function nodeGregorianMillis(utc){
  const match=typeof utc==='string'&&/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|\+00:00)$/.exec(utc);
  if(!match)throw new Error('explicit node UTC required');
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  if(second===60)throw new Error('unsupported_node_time');
  const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(hour,minute,second,0);
  if(year<1||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||date.getUTCHours()!==hour||date.getUTCMinutes()!==minute||date.getUTCSeconds()!==second)throw new Error('invalid node UTC calendar');
  return date.getTime()+Number('0.'+(match[7]??'0'))*1000;
}

function* prepareNodeTrackBuffer(request,response,{periodFor,expectedHashes={}}={}){
  if(typeof periodFor!=='function')throw new TypeError('source static period resolver required');
  if(!request||typeof request.request_id!=='string'||!request.request_id.trim()||request.request_id.length>128||!Array.isArray(request.nodes)||request.nodes.length<1||request.nodes.length>240)throw new Error('invalid node track request');
  const center=nodeGregorianMillis(request.center_utc);
  if(!response||response.schema_version!==1||response.request_id!==request.request_id||!['valid','partial','error'].includes(response.status)||Object.entries(metadata).some(([key,value])=>response[key]!==value)||!Array.isArray(response.nodes)||response.nodes.length!==request.nodes.length)throw new Error('node track metadata mismatch');
  const responseStatus=response.status,entries=new Map(),catalogs=new Set();let errors=0;
  for(const [index,node]of request.nodes.entries()){
    const key=definitionKeyFor(node,entries,catalogs),period=periodFor(structuredClone(node)),result=response.nodes[index];
    if(!Number.isFinite(period)||period<=0||!result||result.period_minutes!==period||result.node_id!==node.id||typeof result.definition_hash!=='string'||!/^[0-9a-f]{64}$/.test(result.definition_hash)||Object.hasOwn(expectedHashes,node.id)&&expectedHashes[node.id]!==result.definition_hash||!Array.isArray(result.rows)||result.rows.length!==121)throw new Error('node track identity/hash/period mismatch');
    const failures=[],positions=[];
    for(const [i,row]of result.rows.entries()){
      const utc=codec.advance(new Date(Math.trunc(center+(i-60)*period*60000/120)).toISOString(),0);
      if(!row||row.utc!==utc)throw new Error('node track UTC grid mismatch');
      if(row.status==='error'){
        if(typeof row.error_code!=='string'||!row.error_code.trim()||row.error_code.length>128||fields.some(field=>row[field]!==null))throw new Error('malformed native node track error');
        errors++;failures.push({utc,error_code:row.error_code});
      }else if(!valid(row))throw new Error('malformed native node track success');
      else positions.push([...row.position_m]);
    }
    const visible=failures.length===0;
    if(result.path_visible!==visible)throw new Error('node track visibility mismatch');
    catalogs.add(node.catalog_number);entries.set(node.id,{key,revision:Object.freeze({}),path:{...metadata,node_id:node.id,node_definition:structuredClone(node),definition_hash:result.definition_hash,center_utc:request.center_utc,period_minutes:period,visible,positions_m:visible?positions:[],errors:failures}});
    yield;
  }
  if(responseStatus!==(errors===request.nodes.length*121?'error':errors?'partial':'valid'))throw new Error('node track aggregate status mismatch');
  const entryFor=node=>{const entry=entries.get(node?.id);if(!entry)return null;try{return identity(node)===entry.key?entry:null;}catch{return null;}};
  // Opaque per-node identities refer only to this immutable accepted buffer, never runtime state.
  return Object.freeze({pathFor:node=>{const entry=entryFor(node);return entry?structuredClone(entry.path):null;},pathRevisionFor:node=>entryFor(node)?.revision??null,nodeIds:()=>[...entries.keys()],definitionHashes:()=>Object.fromEntries([...entries].map(([id,entry])=>[id,entry.path.definition_hash]))});
}

export function createNodeTrackBuffer(request,response,options){
  const work=prepareNodeTrackBuffer(request,response,options);let next=work.next();while(!next.done)next=work.next();return next.value;
}

export async function createNodeTrackBufferAsync(request,response,{yieldControl,signal,...options}={}){
  if(typeof yieldControl!=='function')throw new TypeError('node track cooperative executor required');
  const work=prepareNodeTrackBuffer(structuredClone(request),response,options);
  for(;;){if(signal?.aborted)throw signal.reason??new Error('node track aborted');const next=work.next();if(next.done)return next.value;await yieldControl({signal});}
}

// Separate request generation from sample queries: their refreshes cannot cancel each other.
// The application still serializes native calls and supplies the existing display UTC.
export function createNodeTrackTimeline({api,periodFor,requestId,yieldControl,onChange=()=>{},onError=()=>{}}={}){
  if(typeof api?.nodeTrack!=='function'||typeof periodFor!=='function'||typeof requestId!=='function'||typeof yieldControl!=='function')throw new TypeError('node track dependencies required');
  let disposed=false,generation=0,sequence=0,definitions=[],definitionKey='[]',active=null,buffer=null,centerUtc=null,hashes={},error='';
  const requireOpen=()=>{if(disposed)throw new Error('node track timeline disposed');};
  const snapshot=()=>({generation,pending:active!==null,centerUtc,error,nodeIds:definitions.map(n=>n.id),definitionHashes:structuredClone(hashes)});
  const emit=()=>{if(disposed)return;try{onChange(snapshot());}catch(e){try{onError(e instanceof Error?e.message:String(e));}catch{/* Observer does not own the receipt. */}}};
  function invalidate(clear){generation++;active?.controller.abort();active=null;if(clear){buffer=null;centerUtc=null;}error='';}
  function setDefinitions(nodes){
    requireOpen();if(!Array.isArray(nodes)||nodes.length>240)throw new Error('node definition limit0..240');
    const key=identity(nodes),ids=new Set(),catalogs=new Set();for(const node of nodes){definitionKeyFor(node,ids,catalogs);ids.add(node.id);catalogs.add(node.catalog_number);}
    if(key===definitionKey)return false;invalidate(true);definitions=structuredClone(nodes);definitionKey=key;hashes={};emit();return true;
  }
  function calculate(utc,{background=false,expectedHashes={}}={}){
    requireOpen();let canonical;
    try{nodeGregorianMillis(utc);canonical=codec.advance(utc,0);}catch(e){invalidate(true);error=e instanceof Error?e.message:String(e);emit();return Promise.resolve(false);}
    if(!definitions.length)return Promise.resolve(false);
    invalidate(!background);const ticket=generation,controller=new AbortController(),scope=structuredClone(definitions),known=structuredClone(expectedHashes),previous=structuredClone(hashes);
    const task={center:canonical,controller,promise:null};active=task;emit();
    const current=()=>!disposed&&generation===ticket&&!controller.signal.aborted;
    async function run(){
      try{
        // Both sources constrain the response independently; conflicting bindings fail closed.
        for(const id of Object.keys(previous)){if(Object.hasOwn(known,id)&&known[id]!==previous[id])throw new Error('node track known hash conflict');Object.defineProperty(known,id,{value:previous[id],enumerable:true,configurable:true});}
        const base=requestId();if(typeof base!=='string'||!base.trim())throw new Error('node track request identity required');
        const p={request_id:`${base}-track-${ticket}-${++sequence}`,nodes:scope,center_utc:canonical};if(p.request_id.length>128)throw new Error('node track request identity exceeds128');
        const receipt=await api.nodeTrack(structuredClone(p),{signal:controller.signal});if(!current())return false;
        const candidate=await createNodeTrackBufferAsync(p,receipt,{periodFor,expectedHashes:known,yieldControl,signal:controller.signal});if(!current())return false;
        buffer=candidate;centerUtc=canonical;hashes=candidate.definitionHashes();error='';return true;
      }catch(e){if(!current())return false;buffer=null;centerUtc=null;error=e instanceof Error?e.message:String(e);return false;}
      finally{if(current()){active=null;emit();}}
    }
    task.promise=run();return task.promise;
  }
  function refresh(utc,options={}){
    requireOpen();if(error)return Promise.resolve(false);
    try{
      const center=nodeGregorianMillis(utc);
      if(active)return active.promise??Promise.resolve(false);
      if(!active&&centerUtc&&Math.abs(center-nodeGregorianMillis(centerUtc))<30000)return Promise.resolve(false);
    }catch{return calculate(utc,options);}
    return calculate(utc,{...options,background:true});
  }
  function cancel(){requireOpen();invalidate(true);emit();}
  function destroy(){if(disposed)return;invalidate(true);disposed=true;definitions=[];hashes={};}
  return Object.freeze({setDefinitions,calculate,refresh,pathFor:node=>disposed?null:buffer?.pathFor(node)??null,pathRevisionFor:node=>disposed?null:buffer?.pathRevisionFor(node)??null,snapshot,cancel,destroy});
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
  function communicationStateFor(node,display){if(disposed)return null;return buffers.get(node?.id)?.communicationStateFor(node,display)??null;}
  function communicationStatesFor(nodes,display){
    if(disposed||!Array.isArray(nodes)||!nodes.length||nodes.length>240)return null;
    const accepted=buffers,groups=new Map(),ids=new Set();
    try{
      for(const node of nodes){const buffer=accepted.get(node?.id);if(!buffer||ids.has(node.id))return null;ids.add(node.id);if(!groups.has(buffer))groups.set(buffer,[]);groups.get(buffer).push(node);}
      const states=new Map();
      for(const [buffer,scope] of groups){const values=buffer.communicationStatesFor(scope,display);if(!values||disposed||buffers!==accepted)return null;for(const [id,state]of values)states.set(id,state);}
      return nodes.map(node=>[node.id,states.get(node.id)]);
    }catch{return null;}
  }
  function cancel(){requireOpen();invalidate(true);emit();}
  function destroy(){if(disposed)return;invalidate(true);disposed=true;definitions=[];hashes={};}
  const cohortRevisions=new WeakMap();
  const displayGeometry=bindDisplayGeometryOwner({revision:()=>{
    if(disposed||!buffers.size)return null;let token=cohortRevisions.get(buffers);if(!token){token=Object.freeze({});cohortRevisions.set(buffers,token);}return token;
  },bufferForNode:id=>disposed?null:buffers.get(id)});
  return Object.freeze({setDefinitions,calculate,geometryFor,communicationStateFor,communicationStatesFor,displayGeometry,snapshot,cancel,destroy});
}

// One application queue for source-native display work. No clock or animation scheduler.
export function createNodeDisplayTimeline({api,periodFor,requestId,yieldControl,onChange=()=>{},onError=()=>{}}={}){
  if(typeof yieldControl!=='function')throw new TypeError('node display cooperative executor required');
  const samples=createNodeTimeline({api,requestId,yieldControl:cooperate}),tracks=createNodeTrackTimeline({api,periodFor,requestId,yieldControl:cooperate});
  let disposed=false,utc=null,direction=1,nodeCount=0,runner=null,activeKind=null,inputError='';
  // Private definitions only change at setDefinitions; every outgoing value is a copy.
  let definitions=[],definitionScope='[]',communicationGeneration=0,communicationSequence=0,activeCommunication=null;
  const communicationJobs=[];
  let validationWaiter=null;
  // Immutable native point receipts in this existing query owner, never current
  // runtime state. Keep only eight exact UTCs (prime history + recent ticks).
  const communicationPoints=new Map(),communicationPointLimit=8;
  const requireOpen=()=>{if(disposed)throw new Error('node display timeline disposed');};
  const snapshot=()=>{const sample=samples.snapshot(),track=tracks.snapshot();return {utc,direction,pending:runner!==null,activeKind,error:inputError||sample.error||track.error,samples:sample,tracks:track,communicationPending:communicationJobs.length+(activeCommunication?1:0)};};
  const emit=(reason={kind:'display'})=>{if(disposed)return;try{onChange(snapshot(),reason);}catch(e){try{onError(e instanceof Error?e.message:String(e));}catch{/* Display observers do not own calculations. */}}};
  // Called only after a display HTTP receipt has returned. Its uncommitted
  // validation can yield to exact-point work without overlapping native HTTP.
  async function cooperate({signal}={}){
    let done=false,failure=null;const token={resolve:null};
    const wake=()=>{if(validationWaiter===token)token.resolve?.();};
    const check=()=>{if(signal?.aborted)throw signal.reason??new Error('node validation aborted');};
    check();signal?.addEventListener('abort',wake,{once:true});
    Promise.resolve().then(()=>yieldControl({signal})).then(()=>{done=true;wake();},error=>{failure=error;done=true;wake();});
    try{
      for(;;){
        check();
        while(communicationJobs.length){
          const kind=activeKind;
          try{await serveCommunication(communicationJobs.shift());}finally{activeKind=kind;}
          check();
        }
        if(done){if(failure)throw failure;return;}
        await new Promise(resolve=>{token.resolve=resolve;validationWaiter=token;if(done||communicationJobs.length||signal?.aborted)resolve();});
      }
    }finally{if(validationWaiter===token)validationWaiter=null;signal?.removeEventListener('abort',wake);}
  }
  function settleCommunication(job,value,error){
    if(job.settled)return;job.settled=true;job.signal?.removeEventListener('abort',job.abort);
    if(error)job.reject(error);else job.resolve(value);
  }
  function invalidateCommunication(){
    communicationGeneration++;
    communicationPoints.clear();
    for(const job of [...communicationJobs.splice(0),...(activeCommunication?[activeCommunication]:[])]){
      job.controller.abort();settleCommunication(job,null,new Error('native communication request invalidated'));
    }
  }
  async function serveCommunication(job){
    if(job.settled)return;
    activeCommunication=job;activeKind='communication';emit({kind:'communication'});
    const current=()=>!disposed&&!job.controller.signal.aborted&&job.generation===communicationGeneration&&job.scope===definitionScope;
    try{
      if(!current())throw new Error('native communication request invalidated');
      const cached=communicationPoints.get(job.utc),known=samples.snapshot().definitionHashes;
      if(cached&&cached.generation===job.generation&&cached.scope===job.scope){
        for(const [id,state]of cached.result.states)if(Object.hasOwn(known,id)&&known[id]!==state.definition_hash)throw new Error('native communication definition hash mismatch');
        if(!current())throw new Error('native communication request invalidated');
        communicationPoints.delete(job.utc);communicationPoints.set(job.utc,cached);
        settleCommunication(job,structuredClone(cached.result));return;
      }
      let states=samples.communicationStatesFor(job.nodes,{utc:job.utc});
      if(!states){
        const base=requestId();if(typeof base!=='string'||!base.trim())throw new Error('node request identity required');
        const request={request_id:`${base}-communication-${job.generation}-${++communicationSequence}`,nodes:job.nodes,start_utc:job.utc,count:1,step_seconds:1};
        if(request.request_id.length>128)throw new Error('node request identity exceeds128');
        const response=await api.nodeSamples(structuredClone(request),{signal:job.controller.signal});
        if(!current())throw new Error('native communication request invalidated');
        const buffer=await createNodeSampleBufferAsync(request,response,{expectedHashes:known,yieldControl,signal:job.controller.signal});
        if(!current())throw new Error('native communication request invalidated');
        states=buffer.communicationStatesFor(job.nodes,{utc:job.utc});
      }
      if(!states||states.some(([,state])=>!state))throw new Error('native communication states unavailable');
      if(!current())throw new Error('native communication request invalidated');
      // Both batch paths return fresh owned states; the complete definitions were
      // privately captured and deeply frozen at setDefinitions. Freeze the cache
      // once without recopying either cohort, then copy only at the public boundary.
      const result=freezeProjection({utc:job.utc,node_definitions:job.nodes,states},new WeakSet([job.nodes]));
      communicationPoints.set(job.utc,{generation:job.generation,scope:job.scope,result});
      if(communicationPoints.size>communicationPointLimit)communicationPoints.delete(communicationPoints.keys().next().value);
      settleCommunication(job,structuredClone(result));
    }catch(error){settleCommunication(job,null,error instanceof Error?error:new Error(String(error)));}
    finally{activeCommunication=null;activeKind=null;emit({kind:'communication'});}
  }
  function requestCommunicationStates(value,{signal}={}){
    requireOpen();let canonical;
    try{canonical=codec.advance(value,0);if(signal?.aborted)throw signal.reason??new Error('native communication request aborted');}
    catch(error){return Promise.reject(error);}
    if(!definitions.length)return Promise.resolve({utc:canonical,node_definitions:[],states:[]});
    return new Promise((resolve,reject)=>{
      const job={utc:canonical,nodes:definitions,scope:definitionScope,generation:communicationGeneration,controller:new AbortController(),signal,resolve,reject,settled:false};
      job.abort=()=>{job.controller.abort();settleCommunication(job,null,signal.reason??new Error('native communication request aborted'));};
      signal?.addEventListener('abort',job.abort,{once:true});communicationJobs.push(job);validationWaiter?.resolve?.();void schedule();
    });
  }
  function schedule(){
    if(disposed||(!utc&&!communicationJobs.length)||!nodeCount)return Promise.resolve();
    if(runner)return runner;
    async function run(){
      while(!disposed&&(utc||communicationJobs.length)&&nodeCount){
        if(communicationJobs.length){await serveCommunication(communicationJobs.shift());continue;}
        if(!utc||inputError)break;
        const sample=samples.snapshot();if(sample.error)break;
        let target=null,background=false;
        if(!sample.startUtc)target=direction<0?codec.advance(utc,-600):utc;
        else{
          const elapsed=codec.difference(utc,sample.startUtc);
          if(elapsed<0||elapsed>600)target=direction<0?codec.advance(utc,-600):utc;
          else if(direction>0&&elapsed>=300){target=codec.advance(sample.startUtc,300);background=true;}
          else if(direction<0&&elapsed<=300){target=codec.advance(sample.startUtc,-300);background=true;}
        }
        if(target){activeKind='samples';emit();await samples.calculate(target,{background});activeKind=null;emit();continue;}
        const track=tracks.snapshot();
        let trackDue=!track.centerUtc;
        if(!trackDue&&!track.error){try{trackDue=Math.abs(nodeGregorianMillis(utc)-nodeGregorianMillis(track.centerUtc))>=30000;}catch{trackDue=true;}}
        if(!track.error&&trackDue){
          activeKind='track';emit();await tracks.refresh(utc,{expectedHashes:sample.definitionHashes});activeKind=null;emit();continue;
        }
        break;
      }
    }
    runner=Promise.resolve().then(run).catch(e=>{if(!disposed){inputError=e instanceof Error?e.message:String(e);samples.cancel();tracks.cancel();invalidateCommunication();}}).finally(()=>{runner=null;activeKind=null;emit();if(communicationJobs.length)void schedule();});
    return runner;
  }
  function setDefinitions(nodes){
    requireOpen();const changed=samples.setDefinitions(nodes);tracks.setDefinitions(nodes);nodeCount=nodes.length;
    if(changed){invalidateCommunication();definitions=freezeProjection(structuredClone(nodes));definitionScope=identity(definitions);inputError='';emit();void schedule();}return changed;
  }
  function observe(value,{seek=false}={}){
    requireOpen();let canonical;
    try{canonical=codec.advance(value,0);}catch(e){samples.cancel();tracks.cancel();invalidateCommunication();utc=null;inputError=e instanceof Error?e.message:String(e);emit();return Promise.resolve();}
    if(utc){const delta=codec.difference(canonical,utc);if(delta)direction=Math.sign(delta);}
    utc=canonical;
    if(seek){samples.cancel();tracks.cancel();invalidateCommunication();inputError='';}
    return schedule();
  }
  function retry(){requireOpen();samples.cancel();tracks.cancel();invalidateCommunication();inputError='';return schedule();}
  function clear(){requireOpen();utc=null;direction=1;inputError='';samples.cancel();tracks.cancel();invalidateCommunication();emit();}
  function destroy(){if(disposed)return;disposed=true;utc=null;invalidateCommunication();definitions=[];definitionScope='[]';samples.destroy();tracks.destroy();}
  const displayGeometry=guardDisplayGeometry(samples.displayGeometry,()=>!disposed&&!inputError);
  return Object.freeze({setDefinitions,observe,retry,clear,snapshot,requestCommunicationStates,displayGeometry,geometryFor:(node,display={utc})=>disposed||inputError?null:samples.geometryFor(node,display),communicationStateFor:(node,display={utc})=>disposed||inputError?null:samples.communicationStateFor(node,display),pathFor:node=>disposed||inputError?null:tracks.pathFor(node),pathRevisionFor:node=>disposed||inputError?null:tracks.pathRevisionFor(node),destroy});
}
