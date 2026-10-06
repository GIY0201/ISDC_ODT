// Owns only copied ICD-02 commands/receipts. Native geometry and clocks stay in workspace nodes.
export function createFabricExchange({client,network,clientId,onChange=()=>{}}={}){
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(clientId??'')||['status','endpoint','guardedUpdate','guardedRoute'].some(key=>typeof client?.[key]!=='function')||['networkSnapshot','verifyNetworkSnapshot'].some(key=>typeof network?.[key]!=='function'))throw new TypeError('fabric exchange dependencies required');
 let dead=false,counter=0,active=null,command=null,accepted=null,routeResult=null,state='unavailable',error='',review=false;
 const copy=value=>value==null?null:structuredClone(value);
 const signature=value=>JSON.stringify(value);
 function context(){
  const proof=network.networkSnapshot();
  if(proof?.status!=='valid'||!network.verifyNetworkSnapshot(proof)||!proof.network||Date.parse(proof.utc)!==Date.parse(proof.network.time))throw Error('현재 UTC와 입력의 검증된 통신망이 필요합니다.');
  const endpoint=client.endpoint();return {proof:copy(proof),key:signature({proof,endpoint})};
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
 function taskCurrent(task){return !dead&&active===task&&!task.abort.signal.aborted&&matches(task.key);}
 function fail(cause){accepted=null;routeResult=null;error=String(cause?.message??cause);review=cause?.conflict===true;state=review?'conflict':'error';if(review)command=null;}
 function send(){
  if(dead)return Promise.resolve(null);if(active)return active.promise;reconcile();if(review)return Promise.resolve(null);
  let c;try{c=context();}catch(cause){fail(cause);notify();return Promise.resolve(null);}
  if(accepted)return Promise.resolve(copy(accepted.receipt));
  const task={key:c.key,abort:new AbortController(),promise:null};active=task;state='pending';error='';
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(!command){
     const status=capability(await client.status({signal:task.abort.signal}));if(!taskCurrent(task))return null;
     if(counter>=Number.MAX_SAFE_INTEGER)throw Error('통신 요청 번호 한도를 초과했습니다.');
     command={key:c.key,body:copy(c.proof.network),guard:{instance_id:status.instance_id,expected_sequence:status.sequence,request_id:clientId+':'+(++counter)}};
    }
    if(!taskCurrent(task))return null;
    const current=command,receipt=await client.guardedUpdate(copy(current.body),copy(current.guard),{signal:task.abort.signal});
    if(!taskCurrent(task)||command!==current)return null;
    if(receipt?.instance_id!==current.guard.instance_id||receipt.sequence!==current.guard.expected_sequence+1||receipt.request_id!==current.guard.request_id||! /^[a-f0-9]{64}$/.test(receipt.network_hash??''))throw Error('통신 수락 응답 불일치');
    accepted={key:c.key,receipt:copy(receipt)};routeResult=null;state='accepted';return copy(receipt);
   }catch(cause){if(taskCurrent(task))fail(cause);return null;}
   finally{if(active===task){active=null;reconcile();if(!matches(c.key)){command=null;accepted=null;routeResult=null;state='unavailable';}notify();}}
  });notify();return task.promise;
 }
 function refresh(){
  if(dead)return Promise.resolve(null);if(active)return active.promise;
  // Review refresh is explicit; it never sends a replacement network command.
  const task={abort:new AbortController(),promise:null};active=task;
  task.promise=Promise.resolve().then(async()=>{
   try{
    const status=capability(await client.status({signal:task.abort.signal}));if(dead||active!==task)return null;
    reconcile();if(accepted&&(accepted.receipt.instance_id!==status.instance_id||accepted.receipt.sequence!==status.sequence||accepted.receipt.network_hash!==status.network_hash)){accepted=null;routeResult=null;}
    if(command&&command.guard.instance_id!==status.instance_id)command=null;
    review=false;error='';state=accepted?'accepted':'unavailable';return copy(status);
   }catch(cause){if(!dead&&active===task)fail(cause);return null;}
   finally{if(active===task){active=null;notify();}}
  });notify();return task.promise;
 }
 function route(source,target,objective='balanced'){
  if(dead)return Promise.reject(Error('통신 화면이 종료됐습니다.'));reconcile();
  if(!accepted||review||active)return Promise.reject(Error('현재 통신망 전송 수락을 먼저 확인하세요.'));
  const receipt=copy(accepted.receipt),key=accepted.key,c=context(),ids=new Set(c.proof.network.nodes.map(node=>node.id));
  if(!ids.has(source)||!ids.has(target)||!['balanced','latency','reliability'].includes(objective))return Promise.reject(Error('경로 입력을 확인하세요.'));
  const task={key,abort:new AbortController(),promise:null};active=task;routeResult=null;error='';
  task.promise=Promise.resolve().then(async()=>{
   try{
    const result=await client.guardedRoute(source,target,objective,{instance_id:receipt.instance_id,expected_sequence:receipt.sequence},{signal:task.abort.signal});
    if(!taskCurrent(task))return null;
    if(result.instance_id!==receipt.instance_id||result.sequence!==receipt.sequence||result.network_hash!==receipt.network_hash||result.source!==source||result.target!==target||result.objective!==objective)throw Error('경로가 수락된 통신망과 일치하지 않습니다.');
    routeResult=copy(result);return copy(result);
   }catch(cause){if(taskCurrent(task))fail(cause);return null;}
   finally{if(active===task){active=null;reconcile();notify();}}
  });notify();return task.promise;
 }
 return Object.freeze({send,refresh,route,snapshot,invalidate(){if(dead)return;active?.abort.abort();active=null;command=null;accepted=null;routeResult=null;state='unavailable';error='';notify();},destroy(){if(dead)return;dead=true;active?.abort.abort();active=null;command=null;accepted=null;routeResult=null;}});
}
