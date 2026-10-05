// Source constellation flow from ISDC-ODT 1a1e002. Owns presentation copies only.
// The server acceptance verifier is supplied by the T150 client; no HTTP, camera or clock owner.
export const DRAFT_KEY='spacetwin-nodes-draft-v1';
export const DEPLOYED_KEY='spacetwin-nodes-deployed-v1';
export const MAX_NODES=240;

export class ConstellationError extends Error {
  constructor(code,message){super(message);this.name='ConstellationError';this.code=code;}
}
function copy(value){
  const encoded=JSON.stringify(value,(_,item)=>{
    if(typeof item==='number'&&!Number.isFinite(item))throw new TypeError('유한한 노드 값이 필요합니다.');
    if(['undefined','function','symbol','bigint'].includes(typeof item))throw new TypeError('JSON 노드 값이 필요합니다.');
    return item;
  });
  return JSON.parse(encoded);
}
function strip(node){const {updated_at,...rest}=node;return rest;}

export function createConstellationStore({library,storage=null,now,verifyAcceptance=null}={}){
  for(const name of ['createNode','cloneNode','normalizeNode','validateNode','nodeCatalogItem']){
    if(typeof library?.[name]!=='function')throw new TypeError('노드 라이브러리가 필요합니다.');
  }
  const BASE=library.NODE_CATALOG_BASE;
  if(!Number.isSafeInteger(BASE)||BASE<1)throw new TypeError('노드 catalog 기준 번호가 필요합니다.');
  if(typeof now!=='function')throw new TypeError('명시적인 시각 공급자가 필요합니다.');
  let state={drafts:[],deployed:[],deployedAt:null,sequence:0,selectedId:null,revision:0,deployedRevision:0,receipt:null};
  let draftToken=null,deployedToken=null,loaded=false,confirmed=false,lastError=null;
  const listeners=new Set();
  const fail=(code,message)=>{lastError={code,message};return new ConstellationError(code,message);};
  const time=()=>{const value=now();if(!['number','string'].includes(typeof value)||!Number.isFinite(new Date(value).getTime()))throw fail('invalid_time','유효한 명시 시각이 필요합니다.');return value;};
  const ready=()=>{if(!loaded)throw fail('not_loaded','초안 복원을 먼저 확인하세요.');};
  function validate(nodes){
    if(!Array.isArray(nodes)||nodes.length>MAX_NODES)throw fail('invalid_nodes','노드는 최대 240개까지 둘 수 있습니다.');
    const owned=copy(nodes),ids=new Set(),numbers=new Set();
    for(const node of owned){
      const errors=library.validateNode(node);
      if(errors.length)throw fail('invalid_nodes',errors.join(' '));
      if(ids.has(node.id)||numbers.has(node.catalog_number))throw fail('invalid_nodes','노드 ID 또는 가상 catalog 번호가 중복입니다.');
      ids.add(node.id);numbers.add(node.catalog_number);
    }
    return owned;
  }
  function sequenceOf(candidate){
    let highest=candidate.sequence;
    const identities=new Map(),numbers=new Map();
    for(const node of [...candidate.drafts,...candidate.deployed]){
      if((identities.has(node.id)&&identities.get(node.id)!==node.catalog_number)||(numbers.has(node.catalog_number)&&numbers.get(node.catalog_number)!==node.id)){
        throw fail('invalid_nodes','초안과 배치 사본의 식별자가 충돌합니다.');
      }
      identities.set(node.id,node.catalog_number);numbers.set(node.catalog_number,node.id);
      highest=Math.max(highest,node.catalog_number-BASE,Number(/^NODE-(\d+)$/.exec(node.id)?.[1])||0);
    }
    if(!Number.isSafeInteger(highest)||highest<0||!Number.isSafeInteger(BASE+highest))throw fail('invalid_nodes','노드 번호 범위를 확인하세요.');
    return highest;
  }
  function read(key){
    if(storage===null)return null;
    try{return storage.getItem(key);}catch{throw fail('storage_unavailable','저장 자료를 읽을 수 없습니다.');}
  }
  function record(raw,kind,epoch){
    if(raw===null)return kind==='draft'?{nodes:[],sequence:0,selectedId:null,revision:0}:{nodes:[],deployedAt:null,revision:0,receipt:null};
    try{
      const value=JSON.parse(raw);
      if(!value||value.schema!==1||!Array.isArray(value.nodes)||value.nodes.length>MAX_NODES)throw new Error();
      const revision=value.revision??0;
      if(!Number.isSafeInteger(revision)||revision<0)throw new Error();
      const normalized=value.nodes.map(node=>library.normalizeNode(node,epoch));
      if(normalized.some(node=>node===null))throw new Error();
      const nodes=validate(normalized);
      if(kind==='draft'){
        const sequence=value.sequence??0;
        if(!Number.isSafeInteger(sequence)||sequence<0||(value.selectedId!==null&&value.selectedId!==undefined&&typeof value.selectedId!=='string'))throw new Error();
        return {nodes,sequence,selectedId:value.selectedId===null?null:nodes.some(n=>n.id===value.selectedId)?value.selectedId:nodes[0]?.id??null,revision};
      }
      if(value.deployedAt!==null&&value.deployedAt!==undefined&&(typeof value.deployedAt!=='string'||!Number.isFinite(new Date(value.deployedAt).getTime())))throw new Error();
      return {nodes,deployedAt:value.deployedAt??null,receipt:value.receipt??null,revision};
    }catch{throw fail('invalid_storage','저장된 노드 자료가 손상되었거나 허용 범위를 벗어났습니다.');}
  }
  function snapshot(){return copy({...state,deploymentConfirmed:confirmed,persistence:storage===null?'memory_only':loaded?'stored':'not_loaded',error:lastError});}
  function notify(event){
    for(const listener of listeners){try{listener(event,snapshot());}catch{lastError={code:'listener_error',message:'변경 알림을 처리하지 못했습니다.'};}}
  }
  function commit(candidate,event,kind='draft',accepted=confirmed){
    ready();candidate=copy(candidate);candidate.drafts=validate(candidate.drafts);candidate.deployed=validate(candidate.deployed);candidate.sequence=sequenceOf(candidate);
    const key=kind==='draft'?DRAFT_KEY:DEPLOYED_KEY;
    const revision=(kind==='draft'?state.revision:state.deployedRevision)+1;
    if(!Number.isSafeInteger(revision))throw fail('storage_conflict','초안 변경 번호 범위를 확인하세요.');
    if(kind==='draft')candidate.revision=revision;else candidate.deployedRevision=revision;
    if(storage!==null){
      if(read(DRAFT_KEY)!==draftToken||read(DEPLOYED_KEY)!==deployedToken)throw fail('storage_conflict','다른 창의 변경과 충돌했습니다. 초안을 확인하고 다시 불러오세요.');
      const payload=kind==='draft'?{schema:1,sequence:candidate.sequence,selectedId:candidate.selectedId,revision,nodes:candidate.drafts}
        :{schema:1,deployedAt:candidate.deployedAt,revision,receipt:candidate.receipt,nodes:candidate.deployed};
      const encoded=JSON.stringify(payload);
      try{storage.setItem(key,encoded);}catch{throw fail('storage_unavailable','노드 자료를 저장하지 못했습니다. 기존 초안을 유지합니다.');}
      if(kind==='draft')draftToken=encoded;else deployedToken=encoded;
    }
    state=candidate;confirmed=accepted;lastError=null;notify(event);
  }
  function load({discardLocal=false}={}){
    const draftRaw=read(DRAFT_KEY),liveRaw=read(DEPLOYED_KEY);
    if(loaded&&!discardLocal&&(draftRaw!==draftToken||liveRaw!==deployedToken))throw fail('storage_conflict','다른 창의 변경과 충돌했습니다. 명시적으로 다시 불러오세요.');
    const epoch=time(),draft=record(draftRaw,'draft',epoch),live=record(liveRaw,'live',epoch);
    const candidate={drafts:draft.nodes,deployed:live.nodes,deployedAt:live.deployedAt,sequence:draft.sequence,selectedId:draft.selectedId,revision:draft.revision,deployedRevision:live.revision,receipt:live.receipt};
    candidate.sequence=sequenceOf(candidate);
    state=candidate;draftToken=draftRaw;deployedToken=liveRaw;loaded=true;confirmed=false;lastError=null;notify('load');return snapshot();
  }
  function nextIds(){
    ready();const sequence=state.sequence+1;if(!Number.isSafeInteger(BASE+sequence))throw fail('invalid_nodes','노드 번호가 소진되었습니다.');
    commit({...state,sequence},'ids');return {id:`NODE-${String(sequence).padStart(4,'0')}`,catalogNumber:BASE+sequence};
  }
  function idFactory(){
    ready();let sequence=state.sequence;
    return ()=>{sequence++;if(!Number.isSafeInteger(BASE+sequence))throw fail('invalid_nodes','노드 번호가 소진되었습니다.');return {id:`NODE-${String(sequence).padStart(4,'0')}`,catalogNumber:BASE+sequence};};
  }
  function add(partial={},options={}){
    ready();if(state.drafts.length>=MAX_NODES)throw fail('invalid_nodes','노드는 최대 240개까지 둘 수 있습니다.');
    const sequence=state.sequence+1,id=`NODE-${String(sequence).padStart(4,'0')}`;
    const node=library.createNode({...copy(partial),name:partial.name||id},{...options,epoch:time(),id,catalogNumber:BASE+sequence});
    commit({...state,drafts:[...state.drafts,node],sequence,selectedId:id},'add');return copy(node);
  }
  function addMany(nodes){const owned=validate(nodes);commit({...state,drafts:[...state.drafts,...owned],selectedId:owned[0]?.id??state.selectedId},'add');return copy(owned);}
  const find=id=>copy(state.drafts.find(node=>node.id===id)??null);
  function duplicate(id){
    ready();const source=find(id);if(!source)return null;
    if(state.drafts.length>=MAX_NODES)throw fail('invalid_nodes','노드는 최대 240개까지 둘 수 있습니다.');
    const sequence=state.sequence+1,copyId=`NODE-${String(sequence).padStart(4,'0')}`;
    const node=library.cloneNode(source,{epoch:time(),id:copyId,catalogNumber:BASE+sequence});
    commit({...state,drafts:[...state.drafts,node],sequence,selectedId:node.id},'add');return copy(node);
  }
  function update(id,next){
    ready();const original=find(id);if(!original)return ['노드를 찾을 수 없습니다.'];
    try{
      const candidate={...copy(next),id,catalog_number:original.catalog_number,formation:null,updated_at:new Date(time()).toISOString()};
      validate([candidate]);commit({...state,drafts:state.drafts.map(n=>n.id===id?candidate:n)},'update');return [];
    }catch(error){return [error.message];}
  }
  function remove(id){
    ready();const drafts=state.drafts.filter(n=>n.id!==id);if(drafts.length===state.drafts.length)return false;
    commit({...state,drafts,selectedId:state.selectedId===id?drafts[0]?.id??null:state.selectedId},'remove');return true;
  }
  function formationId(id){if(typeof id!=='string'||!id.trim()||id.length>80)throw fail('invalid_nodes','편대 ID가 필요합니다.');}
  function removeFormation(id){
    ready();formationId(id);const removed=state.drafts.filter(n=>n.formation?.id===id).map(n=>n.id);if(!removed.length)return [];
    const drafts=state.drafts.filter(n=>n.formation?.id!==id);
    commit({...state,drafts,selectedId:drafts.some(n=>n.id===state.selectedId)?state.selectedId:drafts[0]?.id??null},'remove');return removed;
  }
  function replaceFormation(id,nodes){
    ready();formationId(id);const owned=validate(nodes);
    if(owned.some(n=>n.formation?.id!==id))throw fail('invalid_nodes','교체할 편대 ID가 일치하지 않습니다.');
    const others=state.drafts.filter(n=>n.formation?.id!==id),firstIndex=state.drafts.findIndex(n=>n.formation?.id===id);
    const drafts=firstIndex<0?[...others,...owned]:[...others.slice(0,firstIndex),...owned,...others.slice(firstIndex)];
    commit({...state,drafts,selectedId:drafts.some(n=>n.id===state.selectedId)?state.selectedId:owned[0]?.id??drafts[0]?.id??null},'update');return copy(owned);
  }
  function deploy(nodes=state.drafts,receipt=null){
    ready();const owned=validate(nodes);
    if(typeof verifyAcceptance!=='function'||verifyAcceptance(copy(owned),copy(receipt),'deploy')!==true)throw fail('unconfirmed_deployment','서버 수락 검증이 필요합니다.');
    commit({...state,deployed:owned,deployedAt:new Date(time()).toISOString(),receipt:copy(receipt)},'deploy','live',true);return copy(owned);
  }
  function recall(receipt=null){
    ready();if(typeof verifyAcceptance!=='function'||verifyAcceptance([],copy(receipt),'recall')!==true)throw fail('unconfirmed_deployment','서버 수락 검증이 필요합니다.');
    commit({...state,deployed:[],deployedAt:null,receipt:copy(receipt)},'deploy','live',true);
  }
  function isDirty(){const live=new Map(state.deployed.map(node=>[node.id,JSON.stringify(strip(node))]));return state.drafts.length!==state.deployed.length||state.drafts.some(n=>live.get(n.id)!==JSON.stringify(strip(n)));}
  function receiveExternalDraft(raw){
    if(raw===draftToken)return true;
    try{record(raw,'draft',time());}catch{return false;}
    fail('storage_conflict','다른 창의 변경과 충돌했습니다. 초안을 확인하고 다시 불러오세요.');notify('conflict');return false;
  }
  return Object.freeze({load,add,addMany,duplicate,update,remove,removeFormation,replaceFormation,deploy,recall,isDirty,find,nextIds,idFactory,receiveExternalDraft,
    clear(){commit({...state,drafts:[],selectedId:null},'remove');},
    select(id){const selectedId=state.drafts.some(n=>n.id===id)?id:null;commit({...state,selectedId},'select');return selectedId;},
    get drafts(){return copy(state.drafts);},get deployed(){return copy(state.deployed);},get deployedAt(){return state.deployedAt;},
    get selectedId(){return state.selectedId;},get selected(){return find(state.selectedId);},get revision(){return state.revision;},
    get deploymentConfirmed(){return confirmed;},get persistence(){return snapshot().persistence;},get error(){return copy(lastError);},snapshot,
    draftItems:()=>copy(state.drafts.map(library.nodeCatalogItem)),deployedItems:()=>copy(state.deployed.map(library.nodeCatalogItem)),
    subscribe(listener){if(typeof listener!=='function')throw new TypeError('listener required');listeners.add(listener);return ()=>listeners.delete(listener);}
  });
}
