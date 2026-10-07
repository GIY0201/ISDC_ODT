import {NODE_COMMUNICATION_METADATA} from './node_timeline.js';
// Readonly projection over existing native/fabric owners, never command or geometry authority.
const copy=v=>v==null?null:structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export function createMixedRouteEmphasis({readNetwork,verifyNetwork,readFabric,readDisplay,readAnalyticalFabric=null,verifyAnalyticalFabric=null,readSelectedLinkId=()=>null,differenceUtc=null}={}){
 if([readNetwork,verifyNetwork,readFabric,readDisplay].some(f=>typeof f!=='function'))throw TypeError('existing route/native/display owners required');
 const analyticalEnabled=readAnalyticalFabric!==null||verifyAnalyticalFabric!==null||differenceUtc!==null;if(analyticalEnabled&&[readAnalyticalFabric,verifyAnalyticalFabric,readSelectedLinkId,differenceUtc].some(fn=>typeof fn!=='function'))throw TypeError('complete analytical route owner ports required');
 let analyticalEpoch={},analyticalCurrent=null,analyticalIntrinsicCache=null;const analyticalRegistrations=new WeakMap();
 const clearAnalytical=()=>{analyticalEpoch={};analyticalCurrent=null;analyticalIntrinsicCache=null;};
 let dead=false,epoch={},current=null;const registrations=new WeakMap();
 const clear=()=>{epoch={};current=null;clearAnalytical();};
 function context(snapshot,receipt,route){
  const display=copy(readDisplay());if(!display||display.utc!==snapshot.utc||snapshot.presentation_kind==='NETWORK_SAMPLED_UI_V1'||snapshot.status!=='valid'||Date.parse(snapshot.utc)!==Date.parse(snapshot.network?.time)||!same(readNetwork(),snapshot)||verifyNetwork(snapshot)!==true)throw Error('exact current native route scope required');
  let state=null;
  if(route!==null){state=copy(readFabric());if(state?.status!=='accepted'||state.pending!==false||state.error||state.refresh_required||!receipt||!same(state.receipt,receipt)||!same(state.route,route)||route.instance_id!==receipt.instance_id||route.sequence!==receipt.sequence||route.network_hash!==receipt.network_hash)throw Error('current fabric route required');}
  if(!same(readDisplay(),display)||!same(readNetwork(),snapshot)||verifyNetwork(snapshot)!==true)throw Error('native route input changed');
  if(route!==null){const final=copy(readFabric());if(!same(final,state)||!same(readDisplay(),display)||verifyNetwork(snapshot)!==true)throw Error('fabric route changed');}
  // Owner verifiers are observational proofs, but a control callback invoked
  // within one can revoke fabric/source authority. Observe those owners after
  // the final native proof; private registration fences follow in verify().
  if(!same(readDisplay(),display)||route!==null&&!same(readFabric(),state))throw Error('terminal route authority changed');
  return display;
 }
 function capture({snapshot,receipt=null,route=null,selectedLinkId=null}={}){
  clear();const token=epoch;
  try{
   const native=copy(snapshot),accepted=copy(receipt),path=copy(route);if(!native||!Array.isArray(native.node_definitions)||!native.node_definitions.length||native.node_definitions.length>240||!Array.isArray(native.network?.links))throw Error('whole native network required');
   const ids=native.node_definitions.map(n=>n.id),hashes=native.definition_hashes;
   if(path?.status!=='available'&&!native.network.links.some(l=>l.kind==='oisl'&&l.id===selectedLinkId))return null;
   if(new Set(ids).size!==ids.length||!same(Object.keys(hashes??{}).sort(),[...ids].sort())||!Object.values(hashes??{}).every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))throw Error('complete native hashes required');
   const display=context(native,accepted,path),links=native.network.links,oisl=links.filter(l=>l.kind==='oisl').map(({id,a,b})=>({id,a,b})),routed=[];
   if(path?.status==='available'){
    if(!Array.isArray(path.path)||!Array.isArray(path.hop_list)||path.path.length!==path.hop_list.length+1)throw Error('full route hops required');
    for(const [i,hop]of path.hop_list.entries()){const link=links.find(l=>l.id===hop.link_id);if(!link||link.kind!==hop.kind||hop.from!==path.path[i]||hop.to!==path.path[i+1]||!(link.a===hop.from&&link.b===hop.to||link.b===hop.from&&link.a===hop.to))throw Error('route hop outside native scope');if(link.kind==='oisl')routed.push(link.id);}
   }
   const value=freeze({presentation_kind:'MIXED_ROUTE_EMPHASIS_UI_V1',analysis_utc:native.utc,node_definitions:copy(native.node_definitions),definition_hashes:copy(hashes),oisl_links:oisl,routed_ids:[...new Set(routed)],selected_id:oisl.some(l=>l.id===selectedLinkId)?selectedLinkId:null});
   if(dead||token!==epoch)return null;const record={epoch:token,native,receipt:accepted,route:path,display,value};registrations.set(value,record);current=record;return verify(value,{utc:native.utc})?value:null;
  }catch{if(token===epoch)current=null;return null;}
 }
 function verify(value,{utc,nodes}={}){
  const record=registrations.get(value);if(!record||record!==current||dead||record.epoch!==epoch)return false;
  try{if(utc!==record.native.utc||nodes!==undefined&&!same(nodes,record.native.node_definitions)||!same(context(record.native,record.receipt,record.route),record.display)||dead||record!==current||record.epoch!==epoch)throw Error('route visual proof changed');return true;}
  catch{registrations.delete(value);if(current===record)current=null;return false;}
 }
 function read({utc}={}){const record=current;if(!record||dead)return null;if(utc!==record.native.utc){registrations.delete(record.value);current=null;return null;}return verify(record.value,{utc})?record.value:null;}
 function analyticalContext(fabric,utc){
  const display=copy(readDisplay()),selected=readSelectedLinkId();
  if(!display||display.utc!==utc||!fabric||fabric.presentation_kind!=='FABRIC_ANALYTICAL_UI_V1'||!Object.isFrozen(fabric)||verifyAnalyticalFabric(fabric)!==true)throw Error('current registered analytical fabric required');
  if(!same(readDisplay(),display)||readAnalyticalFabric()!==fabric||readSelectedLinkId()!==selected||verifyAnalyticalFabric(fabric)!==true||!same(readDisplay(),display)||readSelectedLinkId()!==selected)throw Error('analytical fabric/display changed');
  // Observational fabric proof must follow display/selection callbacks.
  // Its owner capability then terminates the boundary; caller checks private epoch.
  if(readAnalyticalFabric()!==fabric||verifyAnalyticalFabric(fabric)!==true)throw Error('terminal analytical fabric revoked');
  return {display,selected};
 }
 function analyticalIntrinsic(fabric){
  const native=fabric.native_snapshot,receipt=fabric.receipt,path=fabric.route;
  if(!native||!Object.isFrozen(native)||native.status!=='valid'||native.schema_version!==1||native.error!==null||native.presentation_kind||native.utc!==fabric.analysis_utc||Date.parse(native.utc)!==Date.parse(native.network?.time)||Object.entries(NODE_COMMUNICATION_METADATA).some(([key,value])=>native[key]!==value))throw Error('full native analytical metadata required');
  const definitions=native.node_definitions,stations=native.stations,hashes=native.definition_hashes,links=native.network?.links,wire=native.network?.nodes;
  if(!Array.isArray(definitions)||!definitions.length||definitions.length>240||!Array.isArray(stations)||stations.length>24||!Array.isArray(native.faults)||!Array.isArray(links)||!Array.isArray(wire))throw Error('full native analytical roster required');
  const ids=definitions.map(node=>node.id),ground=stations.filter(station=>station.enabled).map(station=>station.id),members=new Set([...ids,...ground]);
  if(new Set(ids).size!==ids.length||members.size!==ids.length+ground.length||!same(Object.keys(hashes??{}).sort(),[...ids].sort())||!Object.values(hashes).every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))||!same(wire.map(node=>node.id).sort(),[...members].sort())||wire.some(node=>node.kind!==(ids.includes(node.id)?'satellite':'ground'))||new Set(links.map(link=>link.id)).size!==links.length||links.some(link=>typeof link.id!=='string'||!members.has(link.a)||!members.has(link.b)||!['oisl','ground','terrestrial'].includes(link.kind)))throw Error('complete native analytical identities required');
  const routed=[];
  if(path!==null){
   if(!receipt||path.instance_id!==receipt.instance_id||path.sequence!==receipt.sequence||path.network_hash!==receipt.network_hash)throw Error('accepted analytical route mismatch');
   if(path.status==='available'){
    if(!Array.isArray(path.path)||!Array.isArray(path.hop_list)||path.path.length!==path.hop_list.length+1||path.path.some(id=>!members.has(id)))throw Error('complete analytical route required');
    for(const [i,hop]of path.hop_list.entries()){const link=links.find(link=>link.id===hop.link_id);if(!link||link.kind!==hop.kind||hop.from!==path.path[i]||hop.to!==path.path[i+1]||!(link.a===hop.from&&link.b===hop.to||link.b===hop.from&&link.a===hop.to))throw Error('analytical hop outside native scope');routed.push(link.id);}
   }
  }
  return {native,routed:[...new Set(routed)],oisl:links.filter(link=>link.kind==='oisl').map(({id,a,b})=>({id,a,b})),ground:links.filter(link=>link.kind==='ground').map(({id,a,b})=>({id,a,b}))};
 }
 function verifyAnalytical(value,{utc,nodes}={}){
  const record=analyticalRegistrations.get(value);if(!record||record!==analyticalCurrent||dead||record.epoch!==analyticalEpoch)return false;
  try{if(utc!==value.display_utc||nodes!==undefined&&!same(nodes,value.node_definitions))throw Error('analytical frame roster changed');const scope=analyticalContext(record.fabric,utc);if(!same(scope.display,record.display)||scope.selected!==record.selected||dead||record!==analyticalCurrent||record.epoch!==analyticalEpoch)throw Error('analytical route context changed');return true;}catch{analyticalRegistrations.delete(value);if(analyticalCurrent===record)analyticalCurrent=null;return false;}
 }
 function readAnalytical({utc}={}){
  if(dead||!analyticalEnabled)return null;const epoch=analyticalEpoch;
  try{const fabric=readAnalyticalFabric(),scope=analyticalContext(fabric,utc);if(dead||epoch!==analyticalEpoch)return null;
   if(analyticalCurrent?.fabric===fabric&&same(analyticalCurrent.display,scope.display)&&analyticalCurrent.selected===scope.selected)return verifyAnalytical(analyticalCurrent.value,{utc})?analyticalCurrent.value:null;
   const intrinsic=analyticalIntrinsicCache?.fabric===fabric?analyticalIntrinsicCache.value:analyticalIntrinsic(fabric);analyticalIntrinsicCache={fabric,value:intrinsic};const native=intrinsic.native,age=differenceUtc(utc,native.utc);if(!Number.isFinite(age))throw Error('canonical analysis/display UTC required');
   const selected=native.network.links.some(link=>link.id===scope.selected)?scope.selected:null;
   const value=freeze({presentation_kind:'MIXED_ROUTE_ANALYTICAL_UI_V1',analysis_utc:native.utc,display_utc:utc,age_seconds:age,current_analysis:utc===native.utc,native_snapshot:native,fabric_view:fabric,node_definitions:native.node_definitions,definition_hashes:native.definition_hashes,oisl_links:intrinsic.oisl,ground_links:intrinsic.ground,routed_ids:intrinsic.routed,selected_id:selected,source:'captured_native_analysis',availability:'accepted',reason:'captured_native_analysis'});
   if(dead||epoch!==analyticalEpoch)return null;const record={epoch,fabric,display:scope.display,selected:scope.selected,value};analyticalRegistrations.set(value,record);analyticalCurrent=record;return verifyAnalytical(value,{utc})?value:null;
  }catch{if(epoch===analyticalEpoch)analyticalCurrent=null;return null;}
 }
 return Object.freeze({readAnalytical,verifyAnalytical,clearAnalytical,capture,read,verify,clear,destroy(){if(dead)return;dead=true;clear();}});
}
