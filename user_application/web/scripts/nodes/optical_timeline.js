import {NODE_COMMUNICATION_METADATA,isNodeCommunicationState} from './node_timeline.js';
// Original network_twin priming/history with injected native inputs and existing UTC owner.
// Derived optical history only; no clock, propagation, fabric verdict or runtime mutation.
export const PRIME_STEPS_S=Object.freeze([120,60]);
function signature(value){
  const ordered=item=>{
    if(item===null||typeof item==='string'||typeof item==='boolean')return item;
    if(typeof item==='number'&&Number.isFinite(item))return item;
    if(Array.isArray(item))return item.map(ordered);
    if(item&&Object.getPrototypeOf(item)===Object.prototype)return Object.fromEntries(Object.keys(item).sort().map(key=>[key,ordered(item[key])]));
    throw new Error('finite optical input required');
  };
  return JSON.stringify(ordered(value));
}
export function createNodeOpticalTimeline({resolver,requestCommunicationStates,readNodes,nodeScopeRevision=null,readDisplay,advanceUtc,readContinuity=null,verifyContinuity=null,onChange=()=>{}}={}){
  if(!resolver||['resolveLinks','terminalKey'].some(key=>typeof resolver[key]!=='function')||[requestCommunicationStates,readNodes,readDisplay,advanceUtc,onChange].some(value=>typeof value!=='function'))throw new TypeError('optical timeline dependencies required');
  if(nodeScopeRevision!==null&&typeof nodeScopeRevision!=='function')throw new TypeError('trusted node scope revision callback required');
  if((readContinuity===null)!==(verifyContinuity===null)||readContinuity!==null&&[readContinuity,verifyContinuity].some(value=>typeof value!=='function'))throw new TypeError('sampled optical continuity pair required');
  let scopeCache=null,presentationCache=null;
  const sampledProofs=new WeakMap();
  const presentationProofs=new WeakMap();
  const freezeScope=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeScope(child);Object.freeze(value);}return value;};
  let disposed=false,generation=0,active=null,sampledDrain=null,last=null,failure=null,histories=new Map(),owners=new Map(),knownDefinitions=new Map(),knownHashes=new Map(),observerError='';
  function context(){
    const revision=nodeScopeRevision?.(),utc=readDisplay()?.utc;
    if(nodeScopeRevision&&(revision==null||nodeScopeRevision()!==revision))throw new Error('optical node scope changed during read');
    let nodes,scope,nodeKeys;
    if(nodeScopeRevision&&scopeCache?.revision===revision){({nodes,scope,nodeKeys}=scopeCache);}
    else{
      nodes=structuredClone(readNodes());
      if(!Array.isArray(nodes)||nodes.length>240||new Set(nodes.map(n=>n?.id)).size!==nodes.length)throw new Error('invalid optical node scope');
      scope=signature(nodes);
      if(nodeScopeRevision){
        if(nodeScopeRevision()!==revision)throw new Error('optical node scope changed during read');
        nodeKeys=new Map(nodes.map(node=>[node.id,signature(node)]));
        freezeScope(nodes);scopeCache={revision,nodes,scope,nodeKeys};
      }
    }
    if(typeof utc!=='string'||advanceUtc(utc,0)!==utc||/:60(?:\.|Z)/.test(utc)||!Number.isFinite(Date.parse(utc)))throw new Error('unsupported optical analysis UTC');
    if(nodeScopeRevision&&(nodeScopeRevision()!==revision||readDisplay()?.utc!==utc||nodeScopeRevision()!==revision))throw new Error('optical context changed during read');
    // Identical canonical scope + exact UTC remains the receipt authority;
    // owner tokens only permit reuse of a completely validated frozen scope.
    return {utc,nodes,scope,nodeKeys,key:nodeScopeRevision?`[${JSON.stringify(utc)},${scope}]`:signature([utc,nodes])};
  }

  const empty=(c,status,error=null)=>({...NODE_COMMUNICATION_METADATA,schema_version:1,status,error,utc:c?.utc??null,node_definitions:structuredClone(c?.nodes??[]),definition_hashes:{},terminals:[],pairs:[]});
  function snapshot(){
    if(disposed)return empty(null,'unavailable','disposed');
    try{const c=context();if(last?.key===c.key&&exactOriginCurrent(last))return structuredClone(last.value);if(failure?.key===c.key&&exactOriginCurrent(failure))return empty(c,'error',failure.error);if(active?.key===c.key)return empty(c,'pending');return empty(c,'unavailable');}
    catch(error){return empty(null,'error',error.message);}
  }
  // UI-only immutable borrowed projection. Registration is private; its marker
  // deliberately prevents it being accepted as a public action receipt.
  function presentation(){
    const unavailable=error=>freezeScope({...empty(null,error==='disposed'?'unavailable':'error',error),presentation_kind:'OPTICAL_UI_V1'});
    if(disposed)return unavailable('disposed');
    try{
      const c=context(),accepted=last,request=active,error=failure,revision=generation;
      const after=context();
      if(disposed)return unavailable('disposed');
      if(c.key!==after.key||last!==accepted||active!==request||failure!==error||generation!==revision)return unavailable('optical presentation changed during read');
      if(exactOriginCurrent(accepted)&&presentationCache?.key===c.key&&presentationCache.accepted===accepted&&presentationCache.request===request&&presentationCache.error===error&&presentationCache.generation===revision)return presentationCache.value;
      const valid=accepted?.key===c.key&&exactOriginCurrent(accepted),status=valid?'valid':error?.key===c.key&&exactOriginCurrent(error)?'error':request?.key===c.key?'pending':'unavailable';
      const value=freezeScope({...valid?accepted.value:{...NODE_COMMUNICATION_METADATA,schema_version:1,status,error:status==='error'?error.error:null,utc:c.utc,node_definitions:c.nodes,definition_hashes:{},terminals:[],pairs:[]},presentation_kind:'OPTICAL_UI_V1'});
      const proof={key:c.key,accepted,request,error,generation:revision};
      presentationProofs.set(value,proof);presentationCache={...proof,value};return value;
    }catch(error){return unavailable(error.message);}
  }
  function verifyPresentation(value,{utc}={}){
    if(disposed)return false;
    const proof=presentationProofs.get(value);if(!proof||value.status!=='valid')return false;
    try{
      const c=context();
      if(disposed||utc!==c.utc||proof.key!==c.key||last!==proof.accepted||last?.key!==c.key||active!==proof.request||failure!==proof.error||generation!==proof.generation||!exactOriginCurrent(last))return false;
      const after=context();return !disposed&&after.key===c.key&&last===proof.accepted&&active===proof.request&&failure===proof.error&&generation===proof.generation&&exactOriginCurrent(last);
    }catch{return false;}
  }
  function notify(){try{onChange(snapshot());}catch(error){observerError=error instanceof Error?error.message:String(error);}}
  function cancel(){generation++;if(active?.permit&&active.promise){const drain=active.promise;sampledDrain=drain;const settled=()=>{if(sampledDrain===drain)sampledDrain=null;};drain.then(settled,settled);}active?.controller.abort();active=null;}
  function verifyLinkSnapshot(value,{nodes,utc}={}){
    if(disposed||!last)return false;
    try{const c=context();return last.key===c.key&&utc===c.utc&&signature(nodes)===c.scope&&signature(value)===last.proof&&context().key===c.key&&exactOriginCurrent(last);}
    catch{return false;}
  }
  // Optional owner-issued continuity is a capability, never fields inferred from UTC.
  function displaySource(){
    const display=structuredClone(readDisplay());
    if(!display||typeof display.key!=='string'||!display.key||typeof display.source!=='string'||!display.source)throw new Error('sampled optical display source unavailable');
    delete display.utc;return signature(display);
  }
  function capturePermit(){
    if(!readContinuity)throw new Error('sampled optical continuity unavailable');
    const lease=readContinuity();if(lease==null||verifyContinuity(lease)!==true)throw new Error('sampled optical continuity unavailable');
    const source=displaySource();if(verifyContinuity(lease)!==true||displaySource()!==source||verifyContinuity(lease)!==true)throw new Error('sampled optical continuity changed during read');
    return {lease,source};
  }
  function currentPermit(permit,scope){
    if(!permit||!verifyContinuity||verifyContinuity(permit.lease)!==true)return false;
    try{const c=context();return c.scope===scope&&displaySource()===permit.source&&verifyContinuity(permit.lease)===true&&context().scope===scope&&displaySource()===permit.source&&verifyContinuity(permit.lease)===true;}catch{return false;}
  }
  function exactOriginCurrent(record){return !record?.sampled||currentPermit(record.sampled,record.scope??record.context?.scope);}
  function emptySampled(status='unavailable',error='sampled optical analysis unavailable'){
    let displayUtc=null;try{displayUtc=context().utc;}catch{/* Unavailable display is not a clock. */}
    return freezeScope({...empty(null,status,error),presentation_kind:'OPTICAL_SAMPLED_UI_V1',analysis_utc:null,display_utc:displayUtc,age_seconds:null,current_analysis:false,availability:status,reason:error});
  }
  function sampledPresentation(){
    if(disposed)return emptySampled('unavailable','disposed');
    try{
      const c=context(),accepted=last,request=active,failed=failure,ticket=generation;
      const valid=!!accepted?.sampled&&currentPermit(accepted.sampled,accepted.scope);
      const pending=!!request?.permit&&currentPermit(request.permit,request.context.scope),failedCurrent=!!failed?.sampled&&currentPermit(failed.sampled,failed.context.scope);
      const permit=valid?accepted.sampled:pending?request.permit:failedCurrent?failed.sampled:null;
      const scope=valid?accepted.scope:pending?request.context.scope:failedCurrent?failed.context.scope:null;
      if(!currentPermit(permit,scope))return emptySampled('unavailable','sampled optical continuity or scope unavailable');
      const after=context();if(disposed||after.key!==c.key||last!==accepted||active!==request||failure!==failed||generation!==ticket)return emptySampled('unavailable','sampled optical display changed during read');
      const status=valid?'valid':failedCurrent?'error':pending?'pending':'unavailable',analysisUtc=valid?accepted.value.utc:request?.context?.utc??failed?.context?.utc??null;
      const currentAnalysis=valid&&analysisUtc===c.utc,availability=valid?(pending?'pending':'sampled'):status;
      const reason=status==='error'?failed.error:pending?'pending_current_analysis':valid&&!currentAnalysis?'current_analysis_unavailable':valid?'exact_analysis_available':'sampled optical analysis unavailable';
      const value=freezeScope({...valid?accepted.value:{...empty(null,status,status==='error'?failed.error:null),utc:analysisUtc,node_definitions:request?.context?.nodes??failed?.context?.nodes??[]},presentation_kind:'OPTICAL_SAMPLED_UI_V1',analysis_utc:analysisUtc,display_utc:c.utc,age_seconds:analysisUtc?(Date.parse(c.utc)-Date.parse(analysisUtc))/1000:null,current_analysis:currentAnalysis,availability,reason});
      if(!currentPermit(permit,scope)||context().key!==c.key||last!==accepted||active!==request||failure!==failed||generation!==ticket||!currentPermit(permit,scope))return emptySampled('unavailable','sampled optical authority changed during publication');
      sampledProofs.set(value,{accepted,request,failed,ticket,permit,scope,displayKey:c.key});return value;
    }catch(error){return emptySampled('unavailable',String(error?.message??error));}
  }
  function verifySampledPresentation(value,{utc,nodes}={}){
    const proof=sampledProofs.get(value);if(disposed||!proof||value.status!=='valid'||utc!==value.display_utc||value.presentation_kind!=='OPTICAL_SAMPLED_UI_V1')return false;
    try{const c=context();if(c.key!==proof.displayKey||c.utc!==utc||last!==proof.accepted||active!==proof.request||failure!==proof.failed||generation!==proof.ticket||nodes!==undefined&&signature(nodes)!==c.scope||!currentPermit(proof.permit,c.scope))return false;
      const after=context();return !disposed&&after.key===c.key&&last===proof.accepted&&active===proof.request&&failure===proof.failed&&generation===proof.ticket&&currentPermit(proof.permit,after.scope);
    }catch{return false;}
  }
  function begin(c,permit=null,draining=null){
    cancel();failure=null;
    const task={key:c.key,context:c,permit,generation,controller:new AbortController(),promise:null,sampledPromise:null};active=task;
    const current=()=>{try{return !disposed&&active===task&&!task.controller.signal.aborted&&task.generation===generation&&(permit?currentPermit(permit,c.scope):context().key===c.key);}catch{return false;}};
    async function run(){
      const nodeKeys=c.nodeKeys??new Map(c.nodes.map(node=>[node.id,signature(node)])),nextHistories=new Map(),hashes=new Map();
      for(const [key,state] of histories){const owner=owners.get(key);if(nodeKeys.get(owner)===knownDefinitions.get(owner))nextHistories.set(key,structuredClone(state));}
      for(const [id,hash] of knownHashes)if(nodeKeys.get(id)===knownDefinitions.get(id))hashes.set(id,hash);
      async function statesAt(utc){
        const receipt=structuredClone(await requestCommunicationStates(utc,{signal:task.controller.signal}));
        if(!current())throw new Error('optical request invalidated');
        if(receipt?.utc!==utc||signature(receipt.node_definitions)!==c.scope||!Array.isArray(receipt.states)||receipt.states.length!==c.nodes.length)throw new Error('native optical scope mismatch');
        const states=new Map(receipt.states);if(states.size!==c.nodes.length)throw new Error('native optical scope mismatch');
        for(const node of c.nodes){const state=states.get(node.id);if(!isNodeCommunicationState(state,{node,utc}))throw new Error('native optical state unavailable');
          if(hashes.has(node.id)&&hashes.get(node.id)!==state.definition_hash)throw new Error('native optical definition hash mismatch');hashes.set(node.id,state.definition_hash);
        }
        return states;
      }
      try{
        if(!current())return null;
        let candidate=nextHistories;
        if(c.nodes.length&&!candidate.size)for(const seconds of PRIME_STEPS_S){
          // Original Date Unix-ms subtraction, not an invented precise/leap time model.
          const at=Date.parse(c.utc)-seconds*1000,utc=advanceUtc(new Date(at).toISOString(),0);
          candidate=resolver.resolveLinks(c.nodes,await statesAt(utc),candidate,at).histories;
        }
        const states=c.nodes.length?await statesAt(c.utc):new Map();if(!current())return null;
        const result=resolver.resolveLinks(c.nodes,states,candidate,Date.parse(c.utc));
        const nextOwners=new Map();for(const terminal of result.terminals){const key=resolver.terminalKey(terminal.nodeId,terminal.equipmentId);if(nextOwners.has(key))throw new Error('ambiguous optical terminal identity');nextOwners.set(key,terminal.nodeId);}
        const value={...empty(c,'valid'),definition_hashes:Object.fromEntries(hashes),terminals:structuredClone(result.terminals),pairs:structuredClone(result.pairs)},proof=signature(value);
        if(!current())return null;
        histories=new Map([...result.histories].map(([key,state])=>[key,structuredClone(state)]));owners=nextOwners;knownDefinitions=nodeKeys;knownHashes=hashes;last={key:c.key,scope:c.scope,value:freezeScope(value),proof,sampled:permit,task};failure=null;
        return structuredClone(value);
      }catch(error){if(!current())return null;last=null;failure={key:c.key,error:error instanceof Error?error.message:String(error),sampled:permit,context:c};return snapshot();}
      finally{if(active===task){active=null;notify();}}
    }

    task.promise=Promise.resolve(draining??sampledDrain).then(run);return task;
  }
  function update(){
    if(disposed)return Promise.resolve(null);
    let c;try{c=context();}catch(error){cancel();last=null;failure=null;notify();return Promise.resolve(snapshot());}
    if(active?.permit&&active.key===c.key){
      return active.promise.then(()=>{try{return !disposed&&context().key===c.key&&last?.key===c.key?snapshot():null;}catch{return null;}});
    }
    const draining=active?.permit?active.promise:sampledDrain;
    if(!draining&&last?.key===c.key&&exactOriginCurrent(last))return Promise.resolve(structuredClone(last.value));
    if(!draining&&active?.key===c.key)return active.promise;
    return begin(c,null,draining).promise;
  }
  function updateSampled(){
    if(disposed)return Promise.resolve(emptySampled('unavailable','disposed'));
    let c,permit;try{c=context();permit=capturePermit();if(!currentPermit(permit,c.scope))throw new Error('sampled optical scope changed during read');}catch(error){if(active?.permit)cancel();return Promise.resolve(emptySampled('unavailable',String(error?.message??error)));}
    if(active?.permit&&active.context.scope===c.scope&&active.permit.source===permit.source&&active.permit.lease===permit.lease&&currentPermit(active.permit,c.scope))return active.sampledPromise;
    if(active&&!active.permit)return active.promise.then(()=>updateSampled());
    if(last?.key===c.key&&last.sampled&&last.sampled.lease===permit.lease&&currentPermit(last.sampled,c.scope))return Promise.resolve(sampledPresentation());
    const draining=active?.promise??sampledDrain,task=begin(c,permit,draining);
    task.sampledPromise=task.promise.then(result=>result===null?emptySampled('unavailable','sampled optical query invalidated'):sampledPresentation());return task.sampledPromise;
  }
  function cancelSampled(){
    if(disposed)return;
    if(active?.permit)cancel();
    if(last?.sampled)last=null;
    if(failure?.sampled)failure=null;
  }
  function resetHistories(){if(disposed)return;cancel();histories=new Map();owners=new Map();knownDefinitions=new Map();knownHashes=new Map();last=null;failure=null;notify();}
  function pruneHistories(keep){if(disposed)return;const ids=keep instanceof Set?keep:new Set(keep??[]);cancel();for(const key of [...histories.keys()])if(!ids.has(owners.get(key))){histories.delete(key);owners.delete(key);}last=null;failure=null;notify();}
  function destroy(){if(disposed)return;disposed=true;scopeCache=null;presentationCache=null;cancel();histories=new Map();owners=new Map();knownDefinitions=new Map();knownHashes=new Map();last=null;failure=null;}
  return Object.freeze({update,updateSampled,cancelSampled,sampledPresentation,verifySampledPresentation,snapshot,presentation,verifyPresentation,verifyLinkSnapshot,resetHistories,pruneHistories,destroy,historyEntries:()=>structuredClone([...histories]),get observerError(){return observerError;}});
}
