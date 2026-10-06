import {NODE_COMMUNICATION_METADATA,isNodeCommunicationState} from './node_timeline.js';

// Application input join only: shared native point/optical owners and source pure model.
function signature(value){
 const ordered=item=>{
  if(item===null||typeof item==='string'||typeof item==='boolean')return item;
  if(typeof item==='number'&&Number.isFinite(item))return item;
  if(Array.isArray(item))return item.map(ordered);
  if(item&&Object.getPrototypeOf(item)===Object.prototype)return Object.fromEntries(Object.keys(item).sort().map(key=>[key,ordered(item[key])]));
  throw new Error('finite network input required');
 };
 return JSON.stringify(ordered(value));
}
export function createNodeNetworkTimeline({model,optical,requestCommunicationStates,readNodes,nodeScopeRevision=null,readDisplay,readStations,readFaults,validateNode,validateStation,advanceUtc,onChange=()=>{}}={}){
 if(typeof model?.buildNetworkSnapshot!=='function'||!optical||['update','verifyLinkSnapshot'].some(key=>typeof optical[key]!=='function')||[requestCommunicationStates,readNodes,readDisplay,readStations,readFaults,validateNode,validateStation,advanceUtc,onChange].some(value=>typeof value!=='function'))throw new TypeError('network timeline dependencies required');
 if(nodeScopeRevision!==null&&typeof nodeScopeRevision!=='function')throw new TypeError('trusted network node revision callback required');
 let nodeScopeCache=null;
 const freezeScope=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeScope(child);Object.freeze(value);}return value;};
 let disposed=false,generation=0,active=null,last=null,failure=null,observerError='';
 function freshContext(){
  const utc=readDisplay()?.utc,nodes=structuredClone(readNodes()),stations=structuredClone(readStations()),faults=structuredClone(readFaults());
  if(typeof utc!=='string'||advanceUtc(utc,0)!==utc||/:60(?:\.|Z)/.test(utc)||!Number.isFinite(Date.parse(utc)))throw new Error('unsupported network UTC');
  if(!Array.isArray(nodes)||nodes.length>240||!Array.isArray(stations)||stations.length>24||!Array.isArray(faults))throw new Error('invalid network scope');
  const key=signature({utc,nodes,stations,faults}),ids=new Set(),catalogs=new Set();
  for(const node of nodes){
   if(validateNode(node).length||ids.has(node.id)||catalogs.has(node.catalog_number))throw new Error('invalid network node definitions');
   ids.add(node.id);catalogs.add(node.catalog_number);
  }
  for(const station of stations){
   if(validateStation(station).length||station.schema!==1||typeof station.name!=='string'||['latitude','longitude','altitude_km','dish_m','min_elevation_deg'].some(key=>!Number.isFinite(station[key]))||typeof station.id!=='string'||!station.id.trim()||station.id.length>80||ids.has(station.id)||typeof station.enabled!=='boolean')throw new Error('invalid network station definitions');
   ids.add(station.id);
  }
  for(const fault of faults)if(!fault||typeof fault!=='object'||Array.isArray(fault)||typeof fault.kind!=='string'||typeof fault.target!=='string')throw new Error('invalid network fault');
  return {utc,nodes,stations,faults,key,scope:signature(nodes)};
 }
 function context(){
  if(!nodeScopeRevision)return freshContext();
  const revision=nodeScopeRevision?.(),utc=readDisplay()?.utc;
  if(nodeScopeRevision&&(revision==null||nodeScopeRevision()!==revision))throw new Error('network node scope changed during read');
  let nodes,scope,nodeIds;
  if(nodeScopeRevision&&nodeScopeCache?.revision===revision){({nodes,scope,nodeIds}=nodeScopeCache);}
  else{
   nodes=structuredClone(readNodes());
   if(!Array.isArray(nodes)||nodes.length>240)throw new Error('invalid network scope');
   scope=signature(nodes);nodeIds=new Set();const catalogs=new Set();
   for(const node of nodes){
    if(validateNode(node).length||nodeIds.has(node.id)||catalogs.has(node.catalog_number))throw new Error('invalid network node definitions');
    nodeIds.add(node.id);catalogs.add(node.catalog_number);
   }
   if(nodeScopeRevision){if(nodeScopeRevision()!==revision)throw new Error('network node scope changed during read');freezeScope(nodes);nodeScopeCache={revision,nodes,scope,nodeIds};}
  }
  // Stations and runtime-derived faults never share the node-cohort cache.
  const stations=structuredClone(readStations()),faults=structuredClone(readFaults());
  if(typeof utc!=='string'||advanceUtc(utc,0)!==utc||/:60(?:\.|Z)/.test(utc)||!Number.isFinite(Date.parse(utc)))throw new Error('unsupported network UTC');
  if(!Array.isArray(stations)||stations.length>24||!Array.isArray(faults))throw new Error('invalid network scope');
  const ids=new Set(nodeIds);
  for(const station of stations){
   if(validateStation(station).length||station.schema!==1||typeof station.name!=='string'||['latitude','longitude','altitude_km','dish_m','min_elevation_deg'].some(key=>!Number.isFinite(station[key]))||typeof station.id!=='string'||!station.id.trim()||station.id.length>80||ids.has(station.id)||typeof station.enabled!=='boolean')throw new Error('invalid network station definitions');
   ids.add(station.id);
  }
  for(const fault of faults)if(!fault||typeof fault!=='object'||Array.isArray(fault)||typeof fault.kind!=='string'||typeof fault.target!=='string')throw new Error('invalid network fault');
  if(nodeScopeRevision&&(nodeScopeRevision()!==revision||readDisplay()?.utc!==utc||nodeScopeRevision()!==revision))throw new Error('network context changed during read');
  const key=nodeScopeRevision?`{"faults":${signature(faults)},"nodes":${scope},"stations":${signature(stations)},"utc":${JSON.stringify(utc)}}`:signature({utc,nodes,stations,faults});
  return {utc,nodes,stations,faults,key,scope};
 }

 const empty=(c,status,error=null)=>({...NODE_COMMUNICATION_METADATA,schema_version:1,status,error,utc:c?.utc??null,node_definitions:structuredClone(c?.nodes??[]),stations:structuredClone(c?.stations??[]),faults:structuredClone(c?.faults??[]),definition_hashes:{},network:null});
 function validLast(c){return last?.key===c.key&&optical.verifyLinkSnapshot(last.optical,{nodes:c.nodes,utc:c.utc})===true;}
 function snapshot(){
  if(disposed)return empty(null,'unavailable','disposed');
  try{const c=context();if(validLast(c))return structuredClone(last.value);if(failure?.key===c.key)return empty(c,'error',failure.error);if(active?.key===c.key)return empty(c,'pending');return empty(c,'unavailable');}
  catch(error){return empty(null,'error',String(error?.message??error));}
 }
 // UI-only status/time proof. This is never a mission/fabric action receipt.
 function presentation(){
  const summary=(status,utc,error=null,network=null,verified=false)=>({proof:{status,utc,error,network},verified});
  if(disposed)return summary('unavailable',null,'disposed');
  try{
   const c=context(),accepted=last,failed=failure,pending=active,ticket=generation,valid=validLast(c);
   if(disposed)return summary('unavailable',null,'disposed');
   const after=context();
   if(disposed||last!==accepted||failure!==failed||active!==pending||generation!==ticket||after.key!==c.key)return summary('unavailable',after.utc);
   if(valid)return summary('valid',c.utc,null,accepted.value.network?{time:accepted.value.network.time}:null,true);
   if(failed?.key===c.key)return summary('error',c.utc,failed.error);
   if(pending?.key===c.key)return summary('pending',c.utc);
   return summary('unavailable',c.utc);
  }catch(error){return disposed?summary('unavailable',null,'disposed'):summary('error',null,String(error?.message??error));}
 }
 function notify(){try{onChange(snapshot());}catch(error){observerError=String(error?.message??error);}}
 function cancel(){generation++;active?.controller.abort();active=null;}
 function verifySnapshot(value){
  if(disposed||!last)return false;
  try{const c=context();return validLast(c)&&signature(value)===last.proof&&context().key===c.key;}catch{return false;}
 }
 function update(){
  if(disposed)return Promise.resolve(null);
  let c;try{c=context();}catch(error){cancel();last=null;failure=null;notify();return Promise.resolve(snapshot());}
  if(validLast(c))return Promise.resolve(structuredClone(last.value));
  if(active?.key===c.key)return active.promise;
  cancel();last=null;failure=null;
  const task={key:c.key,generation,controller:new AbortController(),promise:null};active=task;
  const current=()=>{try{return !disposed&&active===task&&!task.controller.signal.aborted&&task.generation===generation&&context().key===c.key;}catch{return false;}};
  async function run(){
   try{
    if(!current())return null;
    const links=structuredClone(await optical.update());
    if(!current())return null;
    if(links?.status!=='valid'||links.utc!==c.utc||signature(links.node_definitions)!==c.scope||!optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc}))throw new Error('verified optical network input unavailable');
    const receipt=c.nodes.length?structuredClone(await requestCommunicationStates(c.utc,{signal:task.controller.signal})):{utc:c.utc,node_definitions:[],states:[]};
    if(!current())return null;
    if(receipt?.utc!==c.utc||signature(receipt.node_definitions)!==c.scope||!Array.isArray(receipt.states)||receipt.states.length!==c.nodes.length)throw new Error('native network scope mismatch');
    const states=new Map(receipt.states),hashes=new Map();if(states.size!==c.nodes.length)throw new Error('native network scope mismatch');
    for(const node of c.nodes){
     const state=states.get(node.id),geo=state?.geodetic;
     if(!isNodeCommunicationState(state,{node,utc:c.utc})||state.definition_hash!==links.definition_hashes?.[node.id]||Math.abs(geo.longitude)>180||Math.abs(geo.latitude)>90||geo.altitude<0)throw new Error('native network state unavailable');
     hashes.set(node.id,state.definition_hash);
    }
    if(!optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc}))throw new Error('optical network input invalidated');
    const network=model.buildNetworkSnapshot({date:Date.parse(c.utc),nodes:c.nodes,states,pairs:links.pairs,stations:c.stations.filter(station=>station.enabled),faults:c.faults});
    const value={...empty(c,'valid'),definition_hashes:Object.fromEntries(hashes),network:structuredClone(network)},proof=signature(value);
    if(!current()||!optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc}))return null;
    last={key:c.key,value,proof,optical:links};failure=null;return structuredClone(value);
   }catch(error){if(!current())return null;last=null;failure={key:c.key,error:String(error?.message??error)};return snapshot();}
   finally{if(active===task){active=null;notify();}}
  }
  task.promise=Promise.resolve().then(run);notify();return task.promise;
 }
 function clear(){if(disposed)return;cancel();last=null;failure=null;notify();}
 function destroy(){if(disposed)return;disposed=true;nodeScopeCache=null;cancel();last=null;failure=null;}
 return Object.freeze({update,snapshot,presentation,verifySnapshot,clear,destroy,get observerError(){return observerError;}});
}
