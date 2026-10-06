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
export function createNodeOpticalTimeline({resolver,requestCommunicationStates,readNodes,nodeScopeRevision=null,readDisplay,advanceUtc,onChange=()=>{}}={}){
  if(!resolver||['resolveLinks','terminalKey'].some(key=>typeof resolver[key]!=='function')||[requestCommunicationStates,readNodes,readDisplay,advanceUtc,onChange].some(value=>typeof value!=='function'))throw new TypeError('optical timeline dependencies required');
  if(nodeScopeRevision!==null&&typeof nodeScopeRevision!=='function')throw new TypeError('trusted node scope revision callback required');
  let scopeCache=null,presentationCache=null;
  const presentationProofs=new WeakMap();
  const freezeScope=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeScope(child);Object.freeze(value);}return value;};
  let disposed=false,generation=0,active=null,last=null,failure=null,histories=new Map(),owners=new Map(),knownDefinitions=new Map(),knownHashes=new Map(),observerError='';
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
    try{const c=context();if(last?.key===c.key)return structuredClone(last.value);if(failure?.key===c.key)return empty(c,'error',failure.error);if(active?.key===c.key)return empty(c,'pending');return empty(c,'unavailable');}
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
      if(presentationCache?.key===c.key&&presentationCache.accepted===accepted&&presentationCache.request===request&&presentationCache.error===error&&presentationCache.generation===revision)return presentationCache.value;
      const valid=accepted?.key===c.key,status=valid?'valid':error?.key===c.key?'error':request?.key===c.key?'pending':'unavailable';
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
      if(disposed||utc!==c.utc||proof.key!==c.key||last!==proof.accepted||last?.key!==c.key||active!==proof.request||failure!==proof.error||generation!==proof.generation)return false;
      const after=context();return !disposed&&after.key===c.key&&last===proof.accepted&&active===proof.request&&failure===proof.error&&generation===proof.generation;
    }catch{return false;}
  }
  function notify(){try{onChange(snapshot());}catch(error){observerError=error instanceof Error?error.message:String(error);}}
  function cancel(){generation++;active?.controller.abort();active=null;}
  function verifyLinkSnapshot(value,{nodes,utc}={}){
    if(disposed||!last)return false;
    try{const c=context();return last.key===c.key&&utc===c.utc&&signature(nodes)===c.scope&&signature(value)===last.proof&&context().key===c.key;}
    catch{return false;}
  }
  function update(){
    if(disposed)return Promise.resolve(null);
    let c;try{c=context();}catch(error){cancel();last=null;failure=null;notify();return Promise.resolve(snapshot());}
    if(last?.key===c.key)return Promise.resolve(structuredClone(last.value));
    if(active?.key===c.key)return active.promise;
    cancel();failure=null;
    const task={key:c.key,generation,controller:new AbortController(),promise:null};active=task;
    const current=()=>{try{return !disposed&&active===task&&!task.controller.signal.aborted&&task.generation===generation&&context().key===c.key;}catch{return false;}};
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
        histories=new Map([...result.histories].map(([key,state])=>[key,structuredClone(state)]));owners=nextOwners;knownDefinitions=nodeKeys;knownHashes=hashes;last={key:c.key,value:freezeScope(value),proof};failure=null;
        return structuredClone(value);
      }catch(error){if(!current())return null;last=null;failure={key:c.key,error:error instanceof Error?error.message:String(error)};return snapshot();}
      finally{if(active===task){active=null;notify();}}
    }
    task.promise=Promise.resolve().then(run);return task.promise;
  }
  function resetHistories(){if(disposed)return;cancel();histories=new Map();owners=new Map();knownDefinitions=new Map();knownHashes=new Map();last=null;failure=null;notify();}
  function pruneHistories(keep){if(disposed)return;const ids=keep instanceof Set?keep:new Set(keep??[]);cancel();for(const key of [...histories.keys()])if(!ids.has(owners.get(key))){histories.delete(key);owners.delete(key);}last=null;failure=null;notify();}
  function destroy(){if(disposed)return;disposed=true;scopeCache=null;presentationCache=null;cancel();histories=new Map();owners=new Map();knownDefinitions=new Map();knownHashes=new Map();last=null;failure=null;}
  return Object.freeze({update,snapshot,presentation,verifyPresentation,verifyLinkSnapshot,resetHistories,pruneHistories,destroy,historyEntries:()=>structuredClone([...histories]),get observerError(){return observerError;}});
}
