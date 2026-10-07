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
export function createNodeNetworkTimeline({model,optical,requestCommunicationStates,readNodes,nodeScopeRevision=null,readDisplay,readStations,readFaults,validateNode,validateStation,advanceUtc,readContinuity=null,verifyContinuity=null,onChange=()=>{}}={}){
 if(typeof model?.buildNetworkSnapshot!=='function'||!optical||['update','verifyLinkSnapshot'].some(key=>typeof optical[key]!=='function')||[requestCommunicationStates,readNodes,readDisplay,readStations,readFaults,validateNode,validateStation,advanceUtc,onChange].some(value=>typeof value!=='function'))throw new TypeError('network timeline dependencies required');
 if(nodeScopeRevision!==null&&typeof nodeScopeRevision!=='function')throw new TypeError('trusted network node revision callback required');
 if((readContinuity===null)!==(verifyContinuity===null)||readContinuity!==null&&[readContinuity,verifyContinuity].some(fn=>typeof fn!=='function'))throw new TypeError('complete sampled network continuity pair required');
 let nodeScopeCache=null,intrinsicCache=null;const sampledProofs=new WeakMap();
 const freezeScope=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeScope(child);Object.freeze(value);}return value;};
 let disposed=false,generation=0,active=null,sampledDrain=null,last=null,failure=null,observerError='';
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
 function validLast(c){return last?.key===c.key&&(last.sampled?currentPermit(last.sampled):optical.verifyLinkSnapshot(last.optical,{nodes:c.nodes,utc:c.utc})===true);}
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
   if(valid&&(!accepted.sampled||currentPermit(accepted.sampled)))return summary('valid',c.utc,null,accepted.value.network?{time:accepted.value.network.time}:null,true);
   if(failed?.key===c.key)return summary('error',c.utc,failed.error);
   if(pending?.key===c.key)return summary('pending',c.utc);
   return summary('unavailable',c.utc);
  }catch(error){return disposed?summary('unavailable',null,'disposed'):summary('error',null,String(error?.message??error));}
 }
 function notify(){try{onChange(snapshot());}catch(error){observerError=String(error?.message??error);}}
 function cancel(){generation++;if(active?.permit&&active.promise){const drain=active.promise;sampledDrain=drain;const settled=()=>{if(sampledDrain===drain)sampledDrain=null;};drain.then(settled,settled);}active?.controller.abort();active=null;}
 function verifySnapshot(value){
  if(disposed||!last)return false;
  try{const c=context();return validLast(c)&&signature(value)===last.proof&&context().key===c.key&&(!last.sampled||currentPermit(last.sampled));}catch{return false;}
 }
 function update(){
  if(disposed)return Promise.resolve(null);
  let c;try{c=context();}catch(error){cancel();last=null;failure=null;notify();return Promise.resolve(snapshot());}
  if(active?.permit&&active.key===c.key)return active.promise.then(()=>{try{return !disposed&&context().key===c.key&&validLast(c)?snapshot():null;}catch{return null;}});
  if(active&&!active.permit&&active.key===c.key)return active.promise;
  const draining=active?.permit?active.promise:sampledDrain;
  if(!draining&&validLast(c))return Promise.resolve(structuredClone(last.value));
  if(!draining&&active?.key===c.key)return active.promise;
  return begin(c,null,draining).promise;
 }
 function begin(c,permit=null,draining=null){
  cancel();if(!permit)last=null;failure=null;
  const task={key:c.key,context:c,permit,generation,controller:new AbortController(),promise:null};active=task;
  const current=()=>{try{return !disposed&&active===task&&!task.controller.signal.aborted&&task.generation===generation&&(permit?currentPermit(permit):context().key===c.key);}catch{return false;}};
  async function run(){
   try{
    if(!current())return null;
    const links=permit?c.links:structuredClone(await optical.update());
    if(!current())return null;
    if(links?.status!=='valid'||links.utc!==c.utc||signature(links.node_definitions)!==c.scope||!(permit?currentPermit(permit):optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc})))throw new Error('verified optical network input unavailable');
    const receipt=c.nodes.length?structuredClone(await requestCommunicationStates(c.utc,{signal:task.controller.signal})):{utc:c.utc,node_definitions:[],states:[]};
    if(!current())return null;
    if(receipt?.utc!==c.utc||signature(receipt.node_definitions)!==c.scope||!Array.isArray(receipt.states)||receipt.states.length!==c.nodes.length)throw new Error('native network scope mismatch');
    const states=new Map(receipt.states),hashes=new Map();if(states.size!==c.nodes.length)throw new Error('native network scope mismatch');
    for(const node of c.nodes){
     const state=states.get(node.id),geo=state?.geodetic;
     if(!isNodeCommunicationState(state,{node,utc:c.utc})||state.definition_hash!==links.definition_hashes?.[node.id]||Math.abs(geo.longitude)>180||Math.abs(geo.latitude)>90||geo.altitude<0)throw new Error('native network state unavailable');
     hashes.set(node.id,state.definition_hash);
    }
    if(!(permit?currentPermit(permit):optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc})))throw new Error('optical network input invalidated');
    const network=model.buildNetworkSnapshot({date:Date.parse(c.utc),nodes:c.nodes,states,pairs:links.pairs,stations:c.stations.filter(station=>station.enabled),faults:c.faults});
    const value={...empty(c,'valid'),definition_hashes:Object.fromEntries(hashes),network:structuredClone(network)},proof=signature(value);
    if(!current()||!(permit?currentPermit(permit):optical.verifyLinkSnapshot(links,{nodes:c.nodes,utc:c.utc})))return null;
    last={key:c.key,value:permit?freezeScope(value):value,proof,optical:links,sampled:permit,context:c};failure=null;return structuredClone(value);
   }catch(error){if(!current())return null;last=null;failure={key:c.key,error:String(error?.message??error),sampled:permit,context:c};return snapshot();}
   finally{if(active===task){active=null;notify();}}
  }
  task.promise=Promise.resolve(draining??sampledDrain).then(run);if(permit)task.sampledPromise=task.promise.then(value=>value===null?emptySampled('unavailable','sampled network query invalidated'):sampledPresentation());notify();return task;
 }

 // Registered historical presentation only; never a current command envelope.
 function inputKey(c){return `{"faults":${signature(c.faults)},"nodes":${c.scope},"stations":${signature(c.stations)}}`;}
 function displaySource(){const d=structuredClone(readDisplay());if(!d?.key||!d?.source)throw Error('sampled network source unavailable');delete d.utc;return signature(d);}
 function intrinsic(view){const copy={...view};for(const key of ['presentation_kind','analysis_utc','display_utc','age_seconds','current_analysis','availability','reason'])delete copy[key];const entries=Object.entries(copy);if(intrinsicCache&&entries.length===intrinsicCache.entries.length&&entries.every(([k,v],i)=>k===intrinsicCache.entries[i][0]&&v===intrinsicCache.entries[i][1]))return intrinsicCache.content;const content=signature(copy);intrinsicCache={entries,content};return content;}
 function readOptical(c){
  if(typeof optical.sampledPresentation!=='function'||typeof optical.verifySampledPresentation!=='function')throw Error('registered sampled optical owner unavailable');
  const view=optical.sampledPresentation();
  if(!Object.isFrozen(view)||view?.presentation_kind!=='OPTICAL_SAMPLED_UI_V1'||view.status!=='valid'||view.display_utc!==c.utc||view.utc!==view.analysis_utc||signature(view.node_definitions)!==c.scope||Object.entries(NODE_COMMUNICATION_METADATA).some(([k,v])=>view[k]!==v)||optical.verifySampledPresentation(view,{utc:c.utc,nodes:c.nodes})!==true)throw Error('sampled optical analysis unavailable');
  if(advanceUtc(view.analysis_utc,0)!==view.analysis_utc||/:60(?:\.|Z)/.test(view.analysis_utc)||!Number.isFinite(Date.parse(view.analysis_utc)))throw Error('unsupported sampled network analysis UTC');
  return view;
 }
 function capturePermit(c){
  if(!readContinuity)throw Error('sampled network continuity unavailable');
  const lease=readContinuity();if(lease==null||verifyContinuity(lease)!==true)throw Error('sampled network continuity unavailable');
  const source=displaySource(),view=readOptical(c);
  return {lease,source,input:inputKey(c),content:intrinsic(view),analysisUtc:view.analysis_utc};
 }
 function permitMatches(permit){
  if(disposed||!permit||!verifyContinuity||verifyContinuity(permit.lease)!==true)return false;
  try{const c=context();if(inputKey(c)!==permit.input||displaySource()!==permit.source)return false;const view=readOptical(c);if(view.analysis_utc!==permit.analysisUtc||intrinsic(view)!==permit.content)return false;
   const after=context();return !disposed&&after.key===c.key&&inputKey(after)===permit.input&&displaySource()===permit.source&&verifyContinuity(permit.lease)===true;
  }catch{return false;}
 }
 function currentPermit(permit){const valid=permitMatches(permit);if(!valid&&permit&&last?.sampled===permit)last=null;return valid;}
 function emptySampled(status='unavailable',error='sampled network analysis unavailable'){
  let utc=null;try{utc=context().utc;}catch{}return freezeScope({...empty(null,status,error),presentation_kind:'NETWORK_SAMPLED_UI_V1',analysis_utc:null,display_utc:utc,age_seconds:null,current_analysis:false,availability:status,reason:error});
 }
 function sampledPresentation(){
  if(disposed)return emptySampled('unavailable','disposed');
  try{const c=context(),accepted=last,request=active,failed=failure,ticket=generation;
   const valid=!!accepted?.sampled&&currentPermit(accepted.sampled),pending=(!!request?.permit&&currentPermit(request.permit))||(valid&&readOptical(c).availability==='pending'),bad=!!failed?.sampled&&currentPermit(failed.sampled);
   const permit=valid?accepted.sampled:pending?request.permit:bad?failed.sampled:null;
   if(!currentPermit(permit))return emptySampled();
   const status=valid?'valid':bad?'error':pending?'pending':'unavailable',analysis=permit.analysisUtc,currentAnalysis=valid&&analysis===c.utc;
   const reason=status==='error'?failed.error:pending?'pending_current_analysis':valid&&!currentAnalysis?'current_analysis_unavailable':valid?'exact_analysis_available':'sampled network analysis unavailable';
   const value=freezeScope({...valid?accepted.value:empty(request?.context??failed?.context,status,status==='error'?failed.error:null),presentation_kind:'NETWORK_SAMPLED_UI_V1',analysis_utc:analysis,display_utc:c.utc,age_seconds:(Date.parse(c.utc)-Date.parse(analysis))/1000,current_analysis:currentAnalysis,availability:valid?(pending?'pending':'sampled'):status,reason});
   if(context().key!==c.key||last!==accepted||active!==request||failure!==failed||generation!==ticket||!currentPermit(permit))return emptySampled('unavailable','sampled network authority changed during publication');
   sampledProofs.set(value,{accepted,request,failed,ticket,permit,key:c.key});return value;
  }catch(error){if(last?.sampled)last=null;return emptySampled('unavailable',String(error?.message??error));}
 }
 function verifySampledPresentation(value,{utc,nodes}={}){
  const proof=sampledProofs.get(value);if(disposed||!proof||value?.presentation_kind!=='NETWORK_SAMPLED_UI_V1'||value.status!=='valid'||value.display_utc!==utc)return false;
  try{const c=context();if(c.utc!==utc||c.key!==proof.key||nodes!==undefined&&signature(nodes)!==c.scope)return false;
   return last===proof.accepted&&active===proof.request&&failure===proof.failed&&generation===proof.ticket&&currentPermit(proof.permit)&&context().key===c.key&&last===proof.accepted&&active===proof.request&&failure===proof.failed&&generation===proof.ticket&&currentPermit(proof.permit);
  }catch{return false;}
 }
 function updateSampled(){
  if(disposed)return Promise.resolve(emptySampled('unavailable','disposed'));
  let c,permit;try{c=context();permit=capturePermit(c);if(!currentPermit(permit))throw Error('sampled network context changed during capture');c={...c,utc:permit.analysisUtc,links:readOptical(c)};c.key=signature({utc:c.utc,nodes:c.nodes,stations:c.stations,faults:c.faults});if(nodeScopeRevision)c.key=`{\"faults\":${signature(c.faults)},\"nodes\":${c.scope},\"stations\":${signature(c.stations)},\"utc\":${JSON.stringify(c.utc)}}`;}catch(error){if(active?.permit)cancel();if(last?.sampled)last=null;return Promise.resolve(emptySampled('unavailable',String(error?.message??error)));}
  if(active?.permit&&active.permit.lease===permit.lease&&active.permit.input===permit.input&&active.permit.content===permit.content&&currentPermit(active.permit))return active.sampledPromise;
  if(active&&!active.permit)return active.promise.then(()=>updateSampled());
  if(last?.sampled&&last.sampled.lease===permit.lease&&last.sampled.input===permit.input&&last.sampled.content===permit.content&&currentPermit(last.sampled))return Promise.resolve(sampledPresentation());
  const task=begin(c,permit,active?.promise??sampledDrain);return task.sampledPromise;
 }
 function cancelSampled(){if(disposed)return;if(active?.permit)cancel();if(last?.sampled)last=null;if(failure?.sampled)failure=null;}

 function clear(){if(disposed)return;cancel();last=null;failure=null;notify();}
 function destroy(){if(disposed)return;disposed=true;nodeScopeCache=null;intrinsicCache=null;cancel();last=null;failure=null;}
 return Object.freeze({update,updateSampled,sampledPresentation,verifySampledPresentation,cancelSampled,snapshot,presentation,verifySnapshot,clear,destroy,get observerError(){return observerError;}});
}
