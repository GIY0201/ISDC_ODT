// Owns only copied ICD-02 commands/receipts. Native geometry and clocks stay in workspace nodes.
export function createFabricExchange({client,network,clientId,onChange=()=>{}}={}){
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(clientId??'')||['status','endpoint','guardedUpdate','guardedRoute'].some(key=>typeof client?.[key]!=='function')||['networkSnapshot','verifyNetworkSnapshot'].some(key=>typeof network?.[key]!=='function'))throw new TypeError('fabric exchange dependencies required');
 let dead=false,counter=0,active=null,command=null,accepted=null,routeResult=null,state='unavailable',error='',review=false;
 const copy=value=>value==null?null:structuredClone(value);
 const signature=value=>JSON.stringify(value);
 let poll=null,pollEpoch={},pollCancellation=0,commandEpoch={},commandEntry=0,observation={endpoint:null,status:'unavailable',value:null,error:''},historyEndpoint=null,historyInstance=null;
 const histories=new Map();
 function cancelStatusPoll(){
  pollEpoch={};cancelPoll();
 }
 function cancelPoll(){
  if(!poll)return;const task=poll;poll=null;pollEpoch={};pollCancellation++;
  observation={endpoint:copy(task.endpoint),status:'unavailable',value:null,error:''};
  try{task.abort.abort();}finally{pollCancellation--;}
 }
 function observationScope(){
  const endpoint=copy(client.endpoint()),key=signature(endpoint);
  if(dead)return {endpoint,key};
  if(historyEndpoint!==key){cancelPoll();histories.clear();historyInstance=null;historyEndpoint=key;observation={endpoint,status:'unavailable',value:null,error:''};}
  return {endpoint,key};
 }
 function observeInstance(instance){if(historyInstance!==null&&historyInstance!==instance)histories.clear();historyInstance=instance;}
 function qualityHistory(linkId){if(dead)return [];observationScope();return copy(histories.get(linkId)??[]);}
 function moduleStatus(){if(!dead)observationScope();return copy(observation);}
 function rememberQuality(receipt,proof,endpoint){
  const key=signature(endpoint);if(historyEndpoint!==key){histories.clear();historyInstance=null;historyEndpoint=key;}
  observeInstance(receipt.instance_id);
  const links=Array.isArray(receipt.links)?receipt.links:[],members=new Set(links.map(link=>link?.id).filter(id=>typeof id==='string'&&id));
  for(const id of histories.keys())if(!members.has(id))histories.delete(id);
  const reported=new Set();
  for(const link of links){
   const id=link?.id;if(!members.has(id)||reported.has(id)||!proof.network.links.some(item=>item.id===id))continue;reported.add(id);
   const quality=link.usable===false?0:link.usable===true&&Number.isFinite(link.quality)?link.quality:null;if(quality===null)continue;
   const sample={quality,utc:proof.utc,instance_id:receipt.instance_id,sequence:receipt.sequence,network_hash:receipt.network_hash,request_id:receipt.request_id,link_id:id};
   const list=histories.get(id)??[];
   if(!list.some(item=>item.instance_id===sample.instance_id&&item.sequence===sample.sequence&&item.network_hash===sample.network_hash&&item.request_id===sample.request_id)){
    list.push(sample);if(list.length>48)list.splice(0,list.length-48);histories.set(id,list);
   }
  }
 }
 function pollStatus(){
  if(dead||pollCancellation||commandEntry||active)return Promise.resolve(null);
  const epoch=commandEpoch,cancellation=pollEpoch,scope=observationScope();
  if(dead||pollCancellation||commandEntry||active||epoch!==commandEpoch||cancellation!==pollEpoch)return Promise.resolve(null);if(poll)return poll.promise;
  const task={...scope,epoch,cancellation,abort:new AbortController(),promise:null};poll=task;
  observation={endpoint:copy(task.endpoint),status:'pending',value:null,error:''};
  const current=()=>{
   if(dead||pollCancellation||commandEntry||active||commandEpoch!==task.epoch||pollEpoch!==task.cancellation||poll!==task||task.abort.signal.aborted)return false;
   const key=observationScope().key;
   return !dead&&!pollCancellation&&!commandEntry&&!active&&commandEpoch===task.epoch&&pollEpoch===task.cancellation&&poll===task&&!task.abort.signal.aborted&&key===task.key;
  };
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(!current())return null;
    const value=copy(capability(await client.status({signal:task.abort.signal,target:copy(task.endpoint)})));if(!current())return null;
    reconcile();if(!current())return null;observeInstance(value.instance_id);
    if(accepted&&(accepted.receipt.instance_id!==value.instance_id||accepted.receipt.sequence!==value.sequence||accepted.receipt.network_hash!==value.network_hash)){
     accepted=null;routeResult=null;command=null;state='unavailable';
    }else if(command&&!accepted&&command.guard.instance_id!==value.instance_id){
     command=null;review=true;error='이전 요청의 모듈 실행이 바뀌었습니다. 모듈 상태를 명시적으로 검토하세요.';
    }
    observation={endpoint:copy(task.endpoint),status:'valid',value,error:''};return copy(value);
   }catch(cause){if(current())observation={endpoint:copy(task.endpoint),status:'error',value:null,error:String(cause?.message??cause)};return null;}
   finally{if(poll===task){poll=null;notify();}}
  });notify();return task.promise;
 }
 function context(){
  const proof=network.networkSnapshot();
  if(proof?.status!=='valid'||!network.verifyNetworkSnapshot(proof)||!proof.network||Date.parse(proof.utc)!==Date.parse(proof.network.time))throw Error('현재 UTC와 입력의 검증된 통신망이 필요합니다.');
  const endpoint=client.endpoint(),finalProof=network.networkSnapshot();
  if(signature(finalProof)!==signature(proof)||!network.verifyNetworkSnapshot(proof))throw Error('현재 통신망 입력이 변경되었습니다.');
  return {proof:copy(proof),endpoint:copy(endpoint),key:signature({proof,endpoint})};
 }
 function matches(key){try{return !dead&&context().key===key;}catch{return false;}}
 function reconcile(){
  const uncertain=!!command&&!accepted;
  if(accepted&&!matches(accepted.key)){accepted=null;routeResult=null;state='unavailable';}
  if(command&&!matches(command.key)){command=null;accepted=null;routeResult=null;state='unavailable';if(uncertain){review=true;error='이전 요청의 수락 여부가 미확인입니다. 모듈 상태를 조회한 뒤 다시 전송하세요.';}}
 }
 function snapshot(){reconcile();return {status:dead?'disposed':state,error,receipt:copy(accepted?.receipt),route:copy(routeResult),pending:!!active,retry_available:!dead&&!active&&!review&&!!command&&!accepted,refresh_required:review};}
 function notify(){try{onChange(snapshot());}catch{/* Presentation errors cannot publish or alter protocol state. */}}
 function capability(value){if(value?.exchange_contract!=='guarded-v1'||value.reachable!==true||typeof value.instance_id!=='string'||!value.instance_id||!Number.isSafeInteger(value.sequence)||value.sequence<0)throw Error('통신 모듈 상태가 미확인입니다.');return value;}
 function taskCurrent(task){if(dead||active!==task||task.abort.signal.aborted||!matches(task.key))return false;return !dead&&active===task&&!task.abort.signal.aborted;}
 function fail(cause){accepted=null;routeResult=null;error=String(cause?.message??cause);review=cause?.conflict===true;state=review?'conflict':'error';if(review)command=null;}
 function explicitCommand(action,args=[]){
  commandEpoch={};commandEntry++;cancelStatusPoll();
  try{return action(...args);}finally{commandEntry--;}
 }
 function send(){return explicitCommand(sendCommand);}
 function refresh(){return explicitCommand(refreshCommand);}
 function route(...args){return explicitCommand(routeCommand,args);}
 function sendCommand(){
  if(dead)return Promise.resolve(null);cancelStatusPoll();observationScope();if(dead)return Promise.resolve(null);if(active)return active.promise;reconcile();if(review)return Promise.resolve(null);
  let c;try{c=context();}catch(cause){fail(cause);notify();return Promise.resolve(null);}if(dead)return Promise.resolve(null);
  if(accepted)return Promise.resolve(copy(accepted.receipt));
  const task={key:c.key,abort:new AbortController(),promise:null};active=task;state='pending';error='';
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(!taskCurrent(task))return null;
    if(!command){
     const status=capability(await client.status({signal:task.abort.signal}));if(!taskCurrent(task))return null;
     if(counter>=Number.MAX_SAFE_INTEGER)throw Error('통신 요청 번호 한도를 초과했습니다.');
     command={key:c.key,body:copy(c.proof.network),guard:{instance_id:status.instance_id,expected_sequence:status.sequence,request_id:clientId+':'+(++counter)}};
    }
    if(!taskCurrent(task))return null;
    const current=command,receipt=await client.guardedUpdate(copy(current.body),copy(current.guard),{signal:task.abort.signal});
    if(!taskCurrent(task)||command!==current)return null;
    if(receipt?.instance_id!==current.guard.instance_id||receipt.sequence!==current.guard.expected_sequence+1||receipt.request_id!==current.guard.request_id||! /^[a-f0-9]{64}$/.test(receipt.network_hash??''))throw Error('통신 수락 응답 불일치');
    accepted={key:c.key,receipt:copy(receipt)};routeResult=null;state='accepted';rememberQuality(receipt,c.proof,c.endpoint);return copy(receipt);
   }catch(cause){if(taskCurrent(task))fail(cause);return null;}
   finally{if(active===task){active=null;reconcile();if(!matches(c.key)){command=null;accepted=null;routeResult=null;state='unavailable';}notify();}}
  });notify();return task.promise;
 }
 function refreshCommand(){
  if(dead)return Promise.resolve(null);cancelStatusPoll();observationScope();if(dead)return Promise.resolve(null);if(active)return active.promise;
  // Review refresh is explicit; it never sends a replacement network command.
  const task={abort:new AbortController(),promise:null};active=task;
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(dead||active!==task||task.abort.signal.aborted)return null;
    const status=capability(await client.status({signal:task.abort.signal}));if(dead||active!==task)return null;
    reconcile();observeInstance(status.instance_id);if(accepted&&(accepted.receipt.instance_id!==status.instance_id||accepted.receipt.sequence!==status.sequence||accepted.receipt.network_hash!==status.network_hash)){accepted=null;routeResult=null;}
    if(command&&command.guard.instance_id!==status.instance_id)command=null;
    review=false;error='';state=accepted?'accepted':'unavailable';return copy(status);
   }catch(cause){if(!dead&&active===task)fail(cause);return null;}
   finally{if(active===task){active=null;notify();}}
  });notify();return task.promise;
 }
 function routeCommand(source,target,objective='balanced'){
  if(dead)return Promise.reject(Error('통신 화면이 종료됐습니다.'));cancelStatusPoll();observationScope();if(dead)return Promise.reject(Error('통신 화면이 종료됐습니다.'));reconcile();
  if(!accepted||review||active)return Promise.reject(Error('현재 통신망 전송 수락을 먼저 확인하세요.'));
  const receipt=copy(accepted.receipt),key=accepted.key,c=context(),ids=new Set(c.proof.network.nodes.map(node=>node.id));
  if(!ids.has(source)||!ids.has(target)||!['balanced','latency','reliability'].includes(objective))return Promise.reject(Error('경로 입력을 확인하세요.'));
  const task={key,abort:new AbortController(),promise:null};active=task;routeResult=null;error='';
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(!taskCurrent(task))return null;
    const result=await client.guardedRoute(source,target,objective,{instance_id:receipt.instance_id,expected_sequence:receipt.sequence},{signal:task.abort.signal});
    if(!taskCurrent(task))return null;
    if(result.instance_id!==receipt.instance_id||result.sequence!==receipt.sequence||result.network_hash!==receipt.network_hash||result.source!==source||result.target!==target||result.objective!==objective)throw Error('경로가 수락된 통신망과 일치하지 않습니다.');
    routeResult=copy(result);return copy(result);
   }catch(cause){if(taskCurrent(task))fail(cause);return null;}
   finally{if(active===task){active=null;reconcile();notify();}}
  });notify();return task.promise;
 }
 return Object.freeze({send,refresh,route,snapshot,pollStatus,cancelStatusPoll,moduleStatus,qualityHistory,invalidate(){if(dead)return;pollCancellation++;try{cancelStatusPoll();histories.clear();historyInstance=null;observation={endpoint:null,status:'unavailable',value:null,error:''};active?.abort.abort();active=null;command=null;accepted=null;routeResult=null;state='unavailable';error='';notify();}finally{pollCancellation--;}},destroy(){if(dead)return;dead=true;cancelStatusPoll();histories.clear();historyInstance=null;observation={endpoint:null,status:'unavailable',value:null,error:''};active?.abort.abort();active=null;command=null;accepted=null;routeResult=null;}});
}
