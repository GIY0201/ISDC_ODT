// Scheduling only. Fabric retains the sole command/receipt/route lifecycle.
export const FABRIC_MIN_EXCHANGE_INTERVAL_MS=900;
export function createPeriodicFabricExchange({fabric,capture,verify,readRoute=()=>null,now=()=>performance.now(),onChange=()=>{}}={}){
 if(['sendAnalytical','routeAnalytical','invalidate'].some(key=>typeof fabric?.[key]!=='function')||[capture,verify,readRoute,now,onChange].some(fn=>typeof fn!=='function'))throw TypeError('periodic fabric owner ports required');
 let dead=false,enabled=false,epoch={},active=null,lastSentAt=null;
 function tick(){
  if(dead||!enabled)return Promise.resolve(null);if(active)return active.promise;
  const currentEpoch=epoch;let token,time;try{token=capture();time=now();if(!token||verify(token)!==true||!Number.isFinite(time)||dead||!enabled||currentEpoch!==epoch||lastSentAt!==null&&time-lastSentAt<FABRIC_MIN_EXCHANGE_INTERVAL_MS)return Promise.resolve(null);}catch{return Promise.resolve(null);}
  const task={token,epoch:currentEpoch,promise:null};active=task;lastSentAt=time;
  const current=()=>!dead&&enabled&&active===task&&epoch===task.epoch&&verify(task.token)===true&&!dead&&enabled&&active===task&&epoch===task.epoch;
  task.promise=Promise.resolve().then(async()=>{try{if(!current())return null;const receipt=await fabric.sendAnalytical(token);if(!receipt||!current())return null;const route=readRoute();if(!current())return null;if(route?.source&&route.target)await fabric.routeAnalytical(route.source,route.target,route.objective??'balanced');return current()?receipt:null;}catch{return null;}finally{if(active===task){active=null;try{onChange();}catch{}}}});return task.promise;
 }
 return Object.freeze({tick,setActive(value){if(dead||enabled===(value===true))return;enabled=value===true;epoch={};lastSentAt=null;if(!enabled)fabric.invalidate();},destroy(){if(dead)return;dead=true;enabled=false;epoch={};fabric.invalidate();}});
}
