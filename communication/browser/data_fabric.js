// Browser client for the data fabric ICD (ICD-02). The twin console sends its network state and
// receives link quality, ground paths and store-and-forward state. The endpoint is this server by
// default (which embeds the stand-in or forwards to a module configured on the server); an operator
// may point link L02 in the settings tab at another host, in which case the console talks to that
// host directly. Unreachable endpoints raise errors flagged `unavailable`; nothing is faked.
export const INTEGRATION_SETTINGS_KEY = "spacetwin-integration-settings";
export const FABRIC_LINK_ID = "L02";
const NETWORK_PATH = "/api/data-fabric/network";
const ROUTE_PATH = "/api/data-fabric/route";
const STATUS_PATH = "/api/data-fabric/status";

export function isLocalHost(host) {
  const value = String(host ?? "").trim().toLowerCase();
  if (!value || value === "self" || value === "in-process" || value === "localhost" || value === "::1") return true;
  return value.startsWith("127.");
}

// Resolve where ICD-02 requests go. storage: the browser localStorage (settings tab overrides).
export function resolveEndpoint({ storage = null, protocol = "http:" } = {}) {
  let override = null;
  try {
    const raw = storage?.getItem?.(INTEGRATION_SETTINGS_KEY);
    override = raw ? JSON.parse(raw)?.links?.[FABRIC_LINK_ID] || null : null;
  } catch { override = null; }
  if (override && override.enabled !== false && !isLocalHost(override.host) && Number(override.port) > 0) {
    const scheme = String(override.transport || "").toLowerCase() === "websocket" ? protocol : "http:";
    return { base: `${scheme}//${override.host}:${Number(override.port)}`, placement: "remote", source: "settings" };
  }
  return { base: "", placement: "server", source: "server" };
}

// Dependencies are explicit; import does not access browser storage or start requests.
export function createDataFabricClient({fetchImpl=(...args)=>globalThis.fetch(...args),storage=null,protocol="http:"}={}) {
 const endpoint=()=>resolveEndpoint({storage,protocol});
 const unavailable=(message,target)=>Object.assign(new Error(message),{unavailable:true,endpoint:target});
 function guardedEndpoint(){
  let raw=null;
  try{
   raw=storage?.getItem?.(INTEGRATION_SETTINGS_KEY)??null;
   if(raw!==null){
    const settings=JSON.parse(raw),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
    if(!object(settings)||(Object.hasOwn(settings,'links')&&!object(settings.links))||
       (settings.links&&Object.hasOwn(settings.links,FABRIC_LINK_ID)&&!object(settings.links[FABRIC_LINK_ID])))
     throw new TypeError('설정과 통신 연결은 JSON 객체여야 합니다.');
   }
  }
  catch(error){throw unavailable('통신 모듈 설정을 확인하세요: '+error.message);}
  return resolveEndpoint({storage:{getItem:()=>raw},protocol});
 }
 async function request(path,{target=endpoint(),...options}={}){
  let response;
  try{response=await fetchImpl(target.base+path,{cache:'no-store',...options});}
  catch(error){if(error.name==='AbortError')throw error;throw unavailable(`데이터 패브릭 ${target.base||'(이 서버)'} 연결 실패: ${error.message}`,target);}
  let payload;
  try{payload=await response.json();}catch{payload=null;}
  if(!response.ok){
   const error=Object.assign(new Error(payload?.detail||`데이터 패브릭 요청 실패 (${response.status})`),{status:response.status,endpoint:target});
   if(response.status>=500)error.unavailable=true;if(response.status===409)error.conflict=true;throw error;
  }
  if(!payload||Array.isArray(payload)||typeof payload!=='object')throw unavailable('데이터 패브릭 JSON 객체 응답이 없습니다.',target);
  return payload;
 }
 const guardedJson=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body,(_,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('유한한 통신망 숫자가 필요합니다.');return value;})});
 const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 function guardHeaders(guard,update){
  if(!guard||typeof guard.instance_id!=='string'||!guard.instance_id||!Number.isSafeInteger(guard.expected_sequence)||guard.expected_sequence<0)throw new TypeError('통신 모듈 instance/sequence를 확인하세요.');
  const headers={'X-ISDC-Fabric-Instance':guard.instance_id,'X-ISDC-Fabric-Sequence':String(guard.expected_sequence)};
  if(update){const parts=/^([A-Za-z0-9_-]{1,80}):([1-9][0-9]{0,15})$/.exec(guard.request_id||'');
   if(!parts||!Number.isSafeInteger(Number(parts[2])))throw new TypeError('통신 요청 ID를 확인하세요.');
   headers['X-ISDC-Fabric-Request-Id']=guard.request_id;
  }
  return headers;
 }
 async function capability(target,guard,signal){
  const status=await request(STATUS_PATH,{target,signal});
  if(status.exchange_contract!=='guarded-v1'||status.reachable!==true||!Number.isSafeInteger(status.sequence)||status.sequence<0)throw unavailable('통신 모듈의 guarded-v1 상태가 미확인입니다.',target);
  if(status.instance_id!==guard.instance_id)throw Object.assign(new Error('통신 모듈 실행이 바뀌었습니다.'),{status:409,conflict:true,endpoint:target});
 }
 function receipt(value,guard,target,update){
  if(value.exchange_contract!=='guarded-v1'||value.instance_id!==guard.instance_id||value.sequence!==guard.expected_sequence+(update?1:0)||
     (update&&value.request_id!==guard.request_id)||!/^([a-f0-9]{64})$/.test(value.network_hash||''))throw unavailable('통신 모듈 수락 응답이 요청과 일치하지 않습니다.',target);
  return value;
 }
 return Object.freeze({endpoint,
  update:(snapshot,options={})=>request(NETWORK_PATH,{...json(snapshot),...options}),
  route:(source,target,objective='balanced',options={})=>request(ROUTE_PATH,{...json({source,target,objective}),...options}),
  status:(options={})=>request(STATUS_PATH,options),
  async guardedUpdate(snapshot,guard,{signal}={}){
   const input={...guard},headers=guardHeaders(input,true),target=guardedEndpoint(),body=guardedJson(snapshot);
   await capability(target,input,signal);
   return receipt(await request(NETWORK_PATH,{...body,headers:{...body.headers,...headers},target,signal}),input,target,true);
  },
  async guardedRoute(source,destination,objective,guard,{signal}={}){
   const input={...guard},headers=guardHeaders(input,false),target=guardedEndpoint(),body=guardedJson({source,target:destination,objective});
   await capability(target,input,signal);
   return receipt(await request(ROUTE_PATH,{...body,headers:{...body.headers,...headers},target,signal}),input,target,false);
  }
 });
}
