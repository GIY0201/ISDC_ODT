// Application command lifecycle over existing source store and guarded ICD-03 client.
// Stored plans are display copies. Module receipts own accepted work; no clock or scheduler here.
const clone=v=>structuredClone(v);
function signature(v){
 const sorted=value=>{
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map(sorted);
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
  throw Error('finite mission command required');
 };
 return JSON.stringify(sorted(v));
}
const check=(ok,message)=>{if(!ok)throw Error(message);};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function requestKey(mission){
 check(mission,'mission missing');const value=clone(mission);
 for(const key of ['plan','status','updated_at','committed_at'])delete value[key];
 return signature(value);
}
function moduleStatus(s){
 check(s?.exchange_contract==='guarded-v1'&&s.reachable===true&&typeof s.instance_id==='string'&&s.instance_id.trim()&&Number.isSafeInteger(s.sequence)&&s.sequence>=0&&s.accepted_plans&&Object.getPrototypeOf(s.accepted_plans)===Object.prototype&&s.committed&&Object.getPrototypeOf(s.committed)===Object.prototype,'verified module status required');
 signature(s);return s;
}
function planReceipt(p,id,instance){
 check(p?.exchange_contract==='guarded-v1'&&p.instance_id===instance&&p.mission_id===id&&typeof p.request_id==='string'&&hash(p.context_hash)&&Number.isSafeInteger(p.mission_version)&&p.mission_version>=1&&Number.isSafeInteger(p.plan_sequence)&&p.plan_sequence>=1&&p.sequence===p.plan_sequence&&typeof p.feasible==='boolean'&&Array.isArray(p.tasks)&&p.tasks.length<=2000&&typeof p.time==='string'&&Number.isFinite(Date.parse(p.time)),'verified accepted plan required');
 signature(p);return p;
}
export function createMissionExecution({store,builder,client,verifyContext,hashContext,nextRequestId,onChange=()=>{}}={}){
 if(['find','setPlan','setStatus'].some(k=>typeof store?.[k]!=='function')||typeof builder?.build!=='function'||['status','guardedPlan','guardedCommit','endpoint'].some(k=>typeof client?.[k]!=='function')||[verifyContext,hashContext,nextRequestId,onChange].some(f=>typeof f!=='function'))throw TypeError('existing mission store/builder/client/context dependencies required');
 let dead=false,active=false,pending=null,state={status:'idle',result:null,error:null};const records=new Map();
 const snapshot=()=>clone({...state,pending});
 const emit=()=>{try{onChange(snapshot());}catch{/* Observer cannot change command outcome. */}};
 const live=()=>check(!dead,'mission execution disposed');
 const current=record=>{try{return !dead&&requestKey(store.find(record.id))===record.missionKey&&signature(client.endpoint())===record.endpoint&&verifyContext(clone(record.built))===true;}catch{return false;}};
 const reserve=()=>{live();check(!active&&!pending,'pending mission command must be resolved first');active=true;state={status:'pending',result:null,error:null};emit();};
 async function status(signal){return moduleStatus(clone(await client.status({signal})));}
 function guard(s,context,kind,number){return {instance_id:s.instance_id,expected_sequence:s.sequence,request_id:nextRequestId(),context_hash:context,[kind==='plan'?'mission_version':'plan_sequence']:number};}
 function accept(command,answer){
   signature(answer);
   const g=command.guard,id=command.id;
   check(answer.exchange_contract==='guarded-v1'&&answer.instance_id===g.instance_id&&answer.request_id===g.request_id&&answer.context_hash===g.context_hash&&answer.mission_id===id&&answer.sequence===g.expected_sequence+1,'accepted command receipt changed');
   if(command.operation==='plan'){
    planReceipt(answer,id,g.instance_id);check(answer.mission_version===g.mission_version&&answer.time===command.body.time,'plan version/UTC changed');
    const record={id,missionKey:command.missionKey,endpoint:command.endpoint,built:clone(command.built),answer:clone(answer)};records.set(id,record);
    const isCurrent=current(record);pending=null;
    if(isCurrent){const saved=store.setPlan(id,answer,{source:'orchestrator'});check(saved?.plan?.version===answer.mission_version,'accepted plan display version changed');}
    state={status:isCurrent?'planned':'stale',error:null,result:{answer,current:isCurrent}};
   }else{
    check(answer.accepted===true&&answer.decision===command.body.decision&&answer.mission_version===command.body.version&&answer.plan_sequence===g.plan_sequence&&answer.held_tasks===(command.body.decision==='commit'?command.body.tasks.length:0),'accepted decision receipt changed');
    pending=null;
    // A command can be accepted before context changes; retain the actual accepted outcome.
    if(!dead&&store.find(id))store.setStatus(id,command.body.decision==='commit'?'committed':'aborted');
    const isCurrent=command.operation==='abort'?true:current(records.get(id));
    if(command.operation==='abort')records.delete(id);
    state={status:command.operation==='abort'?'aborted':isCurrent?'committed':'stale',error:null,result:{answer,current:isCurrent}};
   }
   emit();return clone(state.result);
 }
 async function transmit(command,signal,retrying=false){
  live();check(signature(client.endpoint())===command.endpoint,'module endpoint changed');
  if(signal?.aborted)signal.throwIfAborted();
  let answer;
  try{
   answer=clone(await (command.operation==='plan'?client.guardedPlan(command.body,command.guard,{signal}):client.guardedCommit(command.body,command.guard,{signal})));
   return accept(command,answer);
  }catch(error){
   if(!retrying&&error.conflict===true&&!answer){pending=null;state={status:'conflict',error:String(error.message),result:null};}
   else {pending=clone(command);state={status:answer?.accepted===true||answer?.plan_sequence?'accepted_unpersisted':'uncertain',error:String(error.message),result:answer?{answer,current:false}:null};}
   emit();throw error;
  }
 }
 async function plan(id,{signal,exclude=[]}={}){
  reserve();let prepared=false;
  try{
   const mission=store.find(id),missionKey=requestKey(mission),endpoint=signature(client.endpoint()),s=await status(signal);live();
   check(!s.committed[id],'abort accepted held mission before replanning');
   const version=(mission.plan?.version??0)+1;
   check(Number.isSafeInteger(version)&&version>=(s.accepted_plans[id]?.mission_version??0)+1,'stored mission version must be reconciled first');
   const g=guard(s,'', 'plan',version),built=clone(await builder.build(mission,{requestId:g.request_id,exclude,signal}));
   g.context_hash=await hashContext(clone(built));check(hash(g.context_hash),'verified full context hash required');
   const record={id,missionKey,endpoint,built};check(current(record),'mission context changed before plan request');
   const command={operation:'plan',id,missionKey,endpoint,built,body:clone(built.request),guard:g};pending=clone(command);prepared=true;
   return await transmit(command,signal);
  }catch(error){if(!prepared){state={status:'error',result:null,error:String(error.message)};emit();}throw error;}finally{active=false;}
 }
 async function decide(id,decision,{signal}={}){
  reserve();let prepared=false;
  try{
   const endpoint=signature(client.endpoint()),s=await status(signal);live();const p=planReceipt(s.accepted_plans[id],id,s.instance_id);
   if(decision==='commit'){
    const record=records.get(id),local=store.find(id)?.plan;
    check(record&&current(record)&&signature(record.answer)===signature(p),'accepted plan or current context changed');
    check(local?.version===p.mission_version&&local.plan_sequence===p.plan_sequence&&local.context_hash===p.context_hash&&signature(local.tasks)===signature(p.tasks)&&p.feasible&&!s.committed[id],'local plan changed, infeasible or already committed');
   }
   check(signature(client.endpoint())===endpoint,'module endpoint changed');
   const body={time:p.time,mission_id:id,decision,version:p.mission_version,tasks:decision==='commit'?clone(p.tasks):[]};
   const command={operation:decision,id,endpoint,body,guard:guard(s,p.context_hash,'commit',p.plan_sequence)};pending=clone(command);prepared=true;
   return await transmit(command,signal);
  }catch(error){if(!prepared){state={status:'error',result:null,error:String(error.message)};emit();}throw error;}finally{active=false;}
 }
 async function retry({signal}={}){
  live();check(!active&&pending,'no pending command to retry');active=true;const command=clone(pending);
  try{return await transmit(command,signal,true);}finally{active=false;}
 }
 async function reconcile({signal}={}){
  live();check(!active&&pending,'no pending command to reconcile');active=true;const command=clone(pending);
  try{
   check(signature(client.endpoint())===command.endpoint,'module endpoint changed');const s=await status(signal);live();
   check(s.instance_id===command.guard.instance_id,'module instance changed; accepted outcome unresolved');
   const receipt=command.operation==='plan'?s.accepted_plans[command.id]:s.accepted_decisions?.[command.id];
   check(receipt?.request_id===command.guard.request_id,'accepted outcome not proven; retain pending command');
   return accept(command,clone(receipt));
  }finally{active=false;}
 }
 return Object.freeze({plan,commit:(id,options)=>decide(id,'commit',options),abort:(id,options)=>decide(id,'abort',options),retry,reconcile,snapshot,destroy(){dead=true;emit();}});
}
