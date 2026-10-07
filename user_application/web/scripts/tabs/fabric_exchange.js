// Owns only copied ICD-02 commands/receipts. Native geometry and clocks stay in workspace nodes.
export function createFabricExchange({client,network,clientId,onChange=()=>{}}={}){
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(clientId??'')||['status','endpoint','guardedUpdate','guardedRoute'].some(key=>typeof client?.[key]!=='function')||['networkSnapshot','verifyNetworkSnapshot'].some(key=>typeof network?.[key]!=='function'))throw new TypeError('fabric exchange dependencies required');
 let dead=false,counter=0,active=null,command=null,accepted=null,routeResult=null,state='unavailable',error='',review=false;
 const copy=value=>value==null?null:structuredClone(value);
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const analyticalViews=new WeakMap();let analyticalCache=null;
 const hasRaw=typeof network.captureRawAnalysis==='function'&&typeof network.verifyRawAnalysis==='function';
 const signature=value=>JSON.stringify(value);
 let poll=null,pollEpoch={},pollCancellation=0,commandEpoch={},controlEpoch={},commandEntry=0,observation={endpoint:null,status:'unavailable',value:null,error:''},historyEndpoint=null,historyInstance=null;
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
 function rawContext(token,expectedEndpoint=null){
  if(!hasRaw||!token||token.kind!=='NETWORK_RAW_ANALYSIS_V1'||!Object.isFrozen(token)||token.analysis_utc!==token.snapshot?.utc||token.snapshot?.status!=='valid'||token.snapshot.presentation_kind||Date.parse(token.analysis_utc)!==Date.parse(token.snapshot.network?.time)||network.verifyRawAnalysis(token)!==true)throw Error('registered raw native analysis required');
  const endpoint=copy(client.endpoint());if(expectedEndpoint!==null&&signature(endpoint)!==signature(expectedEndpoint)||network.verifyRawAnalysis(token)!==true||dead)throw Error('analytical source or endpoint changed');
  return {proof:copy(token.snapshot),token,endpoint,key:signature({proof:token.snapshot,endpoint}),origin:'captured_analysis'};
 }
 function matches(key,record=null){try{record??=[active,command,accepted].find(value=>value?.key===key);return !dead&&(record?.origin==='captured_analysis'?rawContext(record.token,record.endpoint).key:context().key)===key;}catch{return false;}}
 function reconcile(){
  const uncertain=!!command&&!accepted;
  if(accepted&&!matches(accepted.key)){accepted=null;routeResult=null;state='unavailable';}
  if(command&&!matches(command.key)){command=null;accepted=null;routeResult=null;state='unavailable';if(uncertain){review=true;error='이전 요청의 수락 여부가 미확인입니다. 모듈 상태를 조회한 뒤 다시 전송하세요.';}}
 }
 function snapshot(){reconcile();const exact=accepted?.origin!=='captured_analysis';return {status:dead?'disposed':state==='accepted'&&!exact?'unavailable':state,error,receipt:copy(exact?accepted?.receipt:null),route:copy(exact?routeResult:null),pending:!!active,retry_available:!dead&&!active&&!review&&command?.origin!=='captured_analysis'&&!!command&&!accepted,refresh_required:review};}
 function notify(){try{onChange(snapshot());}catch{/* Presentation errors cannot publish or alter protocol state. */}}
 function capability(value){if(value?.exchange_contract!=='guarded-v1'||value.reachable!==true||typeof value.instance_id!=='string'||!value.instance_id||!Number.isSafeInteger(value.sequence)||value.sequence<0)throw Error('통신 모듈 상태가 미확인입니다.');return value;}
 function taskCurrent(task){if(dead||active!==task||task.abort.signal.aborted||task.controlEpoch&&task.controlEpoch!==controlEpoch||!matches(task.key,task))return false;return !dead&&active===task&&!task.abort.signal.aborted;}
 function fail(cause){accepted=null;routeResult=null;error=String(cause?.message??cause);review=cause?.conflict===true;state=review?'conflict':'error';if(review)command=null;}
 function explicitCommand(action,args=[]){
  commandEpoch={};commandEntry++;cancelStatusPoll();
  try{return action(...args);}finally{commandEntry--;}
 }
 function send(){return explicitCommand(sendCommand);}
 function sendAnalytical(token){return explicitCommand(sendAnalyticalCommand,[token]);}
 function routeAnalytical(...args){return explicitCommand(routeCommand,[...args,true]);}
 function refresh(){return explicitCommand(refreshCommand);}
 function route(...args){return explicitCommand(routeCommand,args);}
 function sendCommand(){
  if(dead)return Promise.resolve(null);cancelStatusPoll();observationScope();if(dead)return Promise.resolve(null);if(active)return active.origin==='captured_analysis'?Promise.resolve(null):active.promise;reconcile();if(review)return Promise.resolve(null);
  let c;try{c=context();}catch(cause){fail(cause);notify();return Promise.resolve(null);}if(dead)return Promise.resolve(null);
  if(accepted?.origin==='captured_analysis'){accepted=null;command=null;routeResult=null;}
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
 function sendAnalyticalCommand(token){
  const epoch=controlEpoch;if(dead)return Promise.resolve(null);cancelStatusPoll();observationScope();if(dead||epoch!==controlEpoch)return Promise.resolve(null);if(active)return active.origin==='captured_analysis'?active.promise:Promise.resolve(null);reconcile();if(review)return Promise.resolve(null);
  if(command&&!accepted){review=true;notify();return Promise.resolve(null);}
  let c;try{c=rawContext(token);}catch{return Promise.resolve(null);}if(dead||epoch!==controlEpoch)return Promise.resolve(null);
  // Periodic exchanges are fresh commands even at the same analysis UTC.
  command=null;accepted=null;routeResult=null;
  const task={...c,controlEpoch:epoch,abort:new AbortController(),promise:null};active=task;state='pending';error='';
  task.promise=Promise.resolve().then(async()=>{
   try{
    if(!taskCurrent(task))return null;
    const status=capability(await client.status({signal:task.abort.signal,target:copy(c.endpoint)}));if(!taskCurrent(task))return null;
    if(counter>=Number.MAX_SAFE_INTEGER)throw Error('통신 요청 번호 한도를 초과했습니다.');
    const current=command={...c,body:copy(c.proof.network),guard:{instance_id:status.instance_id,expected_sequence:status.sequence,request_id:clientId+':'+(++counter)}};
    if(!taskCurrent(task))return null;
    task.posted=true;const receipt=await client.guardedUpdate(copy(current.body),copy(current.guard),{signal:task.abort.signal});
    if(!taskCurrent(task)||command!==current)return null;
    if(receipt?.instance_id!==current.guard.instance_id||receipt.sequence!==current.guard.expected_sequence+1||receipt.request_id!==current.guard.request_id||! /^[a-f0-9]{64}$/.test(receipt.network_hash??''))throw Error('통신 수락 응답 불일치');
    accepted={...c,receipt:copy(receipt)};routeResult=null;state='accepted';rememberQuality(receipt,c.proof,c.endpoint);return copy(receipt);
   }catch(cause){if(taskCurrent(task)){fail(cause);review=true;}return null;}
   finally{if(active===task){active=null;reconcile();if(!matches(c.key,c)){const uncertain=!!command&&!accepted;command=null;accepted=null;routeResult=null;state='unavailable';if(uncertain)review=true;}notify();}}
  });notify();return task.promise;
 }
 function analyticalPresentation(){
  reconcile();if(dead||!accepted||accepted.origin!=='captured_analysis'||active||review||state!=='accepted')return null;
  const record=accepted,route=routeResult;if(analyticalCache?.record===record&&analyticalCache.route===route&&analyticalViews.has(analyticalCache.value))return verifyAnalyticalPresentation(analyticalCache.value)?analyticalCache.value:null;
  const native=freeze(copy(record.proof)),value=freeze({presentation_kind:'FABRIC_ANALYTICAL_UI_V1',analysis_utc:record.proof.utc,receipt:copy(record.receipt),route:copy(route),native_snapshot:native,network:native.network,source:'captured_native_analysis',current_analysis:false});
  analyticalCache={record,route,value};
  analyticalViews.set(value,{record,route});return verifyAnalyticalPresentation(value)?value:null;
 }
 function verifyAnalyticalPresentation(value){
  const registration=analyticalViews.get(value);if(!registration)return false;
  const current=()=>!dead&&!active&&!review&&state==='accepted'&&accepted===registration.record&&routeResult===registration.route;
  if(!current()||!matches(registration.record.key,registration.record)||!current()){analyticalViews.delete(value);if(analyticalCache?.value===value)analyticalCache=null;return false;}return true;
 }
 function refreshCommand(){
  if(dead)return Promise.resolve(null);cancelStatusPoll();observationScope();if(dead)return Promise.resolve(null);if(active)return active.origin==='captured_analysis'?Promise.resolve(null):active.promise;
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
 function routeCommand(source,target,objective='balanced',analytical=false){
  const epoch=controlEpoch;if(dead)return Promise.reject(Error('통신 화면이 종료됐습니다.'));cancelStatusPoll();observationScope();if(dead)return Promise.reject(Error('통신 화면이 종료됐습니다.'));reconcile();
  if(!accepted||review||active||((accepted.origin==='captured_analysis')!==analytical))return Promise.reject(Error('현재 통신망 전송 수락을 먼저 확인하세요.'));
  const receipt=copy(accepted.receipt),key=accepted.key,c=analytical?rawContext(accepted.token,accepted.endpoint):context(),ids=new Set(c.proof.network.nodes.map(node=>node.id));
  if(!ids.has(source)||!ids.has(target)||!['balanced','latency','reliability'].includes(objective))return Promise.reject(Error('경로 입력을 확인하세요.'));
  if(analytical&&(dead||epoch!==controlEpoch))return Promise.resolve(null);
  const task={...c,key,...(analytical?{controlEpoch:epoch}:{}),abort:new AbortController(),promise:null};active=task;routeResult=null;error='';
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
 return Object.freeze({send,sendAnalytical,routeAnalytical,analyticalPresentation,verifyAnalyticalPresentation,refresh,route,snapshot,pollStatus,cancelStatusPoll,moduleStatus,qualityHistory,invalidate(){if(dead)return;analyticalCache=null;commandEpoch={};controlEpoch={};const uncertainAnalytical=active?.origin==='captured_analysis'&&active.posted===true&&!accepted;pollCancellation++;try{cancelStatusPoll();histories.clear();historyInstance=null;observation={endpoint:null,status:'unavailable',value:null,error:''};active?.abort.abort();command=null;accepted=null;routeResult=null;state='unavailable';error=uncertainAnalytical?'이전 분석 통신 요청의 수락이 미확인입니다. 모듈 상태를 명시적으로 검토하세요.':'';review=uncertainAnalytical||review;notify();}finally{pollCancellation--;}},destroy(){if(dead)return;dead=true;analyticalCache=null;cancelStatusPoll();histories.clear();historyInstance=null;observation={endpoint:null,status:'unavailable',value:null,error:''};active?.abort.abort();active=null;command=null;accepted=null;routeResult=null;}});
}
