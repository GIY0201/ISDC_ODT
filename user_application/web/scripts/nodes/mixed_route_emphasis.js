// Readonly projection over existing native/fabric owners, never command or geometry authority.
const copy=v=>v==null?null:structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export function createMixedRouteEmphasis({readNetwork,verifyNetwork,readFabric,readDisplay}={}){
 if([readNetwork,verifyNetwork,readFabric,readDisplay].some(f=>typeof f!=='function'))throw TypeError('existing route/native/display owners required');
 let dead=false,epoch={},current=null;const registrations=new WeakMap();
 const clear=()=>{epoch={};current=null;};
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
 return Object.freeze({capture,read,verify,clear,destroy(){if(dead)return;dead=true;clear();}});
}
