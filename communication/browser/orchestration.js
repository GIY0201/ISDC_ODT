// Browser client for the constellation operations ICD (ICD-03). The mission console sends one
// mission request with the windows the twin computed and receives the assigned tasks and verdict.
// The endpoint is this server by default (embedded stand-in or a module the server forwards to);
// an operator may point link L03 in the settings tab at another host, in which case the console
// talks to that host directly. Unreachable endpoints raise errors flagged `unavailable`.
import { INTEGRATION_SETTINGS_KEY, isLocalHost } from "/static/communication/data_fabric.js";

export const ORCHESTRATION_LINK_ID = "L03";
const PLAN_PATH = "/api/orchestration/plan";
const COMMIT_PATH = "/api/orchestration/commit";
const STATUS_PATH = "/api/orchestration/status";

export function resolveEndpoint({ storage = null, protocol = "http:" } = {}) {
  let override = null;
  try {
    const raw = storage?.getItem?.(INTEGRATION_SETTINGS_KEY);
    override = raw ? JSON.parse(raw)?.links?.[ORCHESTRATION_LINK_ID] || null : null;
  } catch { override = null; }
  if (override && override.enabled !== false && !isLocalHost(override.host) && Number(override.port) > 0) {
    const scheme = String(override.transport || "").toLowerCase() === "websocket" ? protocol : "http:";
    return { base: `${scheme}//${override.host}:${Number(override.port)}`, placement: "remote", source: "settings" };
  }
  return { base: "", placement: "server", source: "server" };
}

// Explicit dependencies: importing this module reads no storage and sends no requests.
export function createOrchestrationClient({fetchImpl=(...args)=>globalThis.fetch(...args),storage=null,protocol="http:"}={}) {
  const endpoint=()=>resolveEndpoint({storage,protocol});
  const unavailable=(message,target)=>Object.assign(new Error(message),{unavailable:true,endpoint:target});
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const finiteJson=value=>JSON.stringify(value,(_,item)=>{
    if(typeof item==='number'&&!Number.isFinite(item))throw new TypeError('유한한 임무 숫자가 필요합니다.');
    return item;
  });
  function guardedEndpoint(){
    let raw=null;
    try {
      raw=storage?.getItem?.(INTEGRATION_SETTINGS_KEY)??null;
      if(raw!==null){
        const settings=JSON.parse(raw);
        if(!object(settings)||(Object.hasOwn(settings,'links')&&!object(settings.links))||
           (settings.links&&Object.hasOwn(settings.links,ORCHESTRATION_LINK_ID)&&!object(settings.links[ORCHESTRATION_LINK_ID])))
          throw new TypeError('설정과 군집 운용 연결은 JSON 객체여야 합니다.');
      }
    }catch(error){throw unavailable('군집 운용 모듈 설정을 확인하세요: '+error.message);}
    return resolveEndpoint({storage:{getItem:()=>raw},protocol});
  }
  async function request(path,{target=endpoint(),...options}={}){
    let response;
    try{response=await fetchImpl(target.base+path,{cache:'no-store',...options});}
    catch(error){if(error.name==='AbortError')throw error;throw unavailable(`군집 운용 모듈 ${target.base||'(이 서버)'} 연결 실패: ${error.message}`,target);}
    let payload=null;
    try{payload=await response.json();}catch(error){if(error.name==='AbortError')throw error;}
    if(!response.ok){
      const detail=Array.isArray(payload?.detail)?payload.detail.map(item=>item.msg||JSON.stringify(item)).join('; '):payload?.detail;
      const error=Object.assign(new Error(detail||`군집 운용 요청 실패 (${response.status})`),{status:response.status,endpoint:target});
      if(response.status>=500)error.unavailable=true;
      if(response.status===409)error.conflict=true;
      throw error;
    }
    if(!object(payload))throw unavailable('군집 운용 JSON 객체 응답이 없습니다.',target);
    try{finiteJson(payload);}catch{throw unavailable('군집 운용 응답에 유효하지 않은 숫자가 있습니다.',target);}
    return payload;
  }
  const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  function headers(guard,operation){
    const number=operation==='plan'?guard.mission_version:guard.plan_sequence;
    const parts=/^([A-Za-z0-9_-]{1,80}):([1-9][0-9]{0,15})$/.exec(guard.request_id||'');
    if(typeof guard.instance_id!=='string'||!guard.instance_id||!Number.isSafeInteger(guard.expected_sequence)||guard.expected_sequence<0||
       !parts||!Number.isSafeInteger(Number(parts[2]))||!Number.isSafeInteger(number)||number<1||!/^[a-f0-9]{64}$/.test(guard.context_hash||''))
      throw new TypeError('군집 운용 instance/sequence/요청/계획 버전을 확인하세요.');
    return {'Content-Type':'application/json','X-ISDC-Orchestration-Instance':guard.instance_id,
      'X-ISDC-Orchestration-Sequence':String(guard.expected_sequence),'X-ISDC-Orchestration-Request-Id':guard.request_id,
      'X-ISDC-Orchestration-Context':guard.context_hash,
      ['X-ISDC-Orchestration-'+(operation==='plan'?'Mission-Version':'Plan-Sequence')]:String(number)};
  }
  async function guarded(operation,body,guard,{signal}={}){
    const input={...guard},wire=finiteJson(body),command=JSON.parse(wire),head=headers(input,operation),target=guardedEndpoint();
    if(!object(command))throw new TypeError('임무 요청은 객체여야 합니다.');
    const status=await request(STATUS_PATH,{target,signal});
    if(status.exchange_contract!=='guarded-v1'||status.reachable!==true||!Number.isSafeInteger(status.sequence)||status.sequence<0)
      throw unavailable('군집 운용 모듈의 guarded-v1 상태가 미확인입니다.',target);
    if(status.instance_id!==input.instance_id)
      throw Object.assign(new Error('군집 운용 모듈 실행이 바뀌었습니다.'),{conflict:true,status:409,endpoint:target});
    const reply=await request(operation==='plan'?PLAN_PATH:COMMIT_PATH,{method:'POST',headers:head,body:wire,target,signal});
    const mission=operation==='plan'?command.mission?.id:command.mission_id;
    let valid=reply.exchange_contract==='guarded-v1'&&reply.instance_id===input.instance_id&&
      Number.isSafeInteger(reply.sequence)&&reply.sequence===input.expected_sequence+1&&reply.request_id===input.request_id&&
      reply.context_hash===input.context_hash&&reply.mission_id===mission;
    if(operation==='plan')valid=valid&&reply.mission_version===input.mission_version&&reply.plan_sequence===reply.sequence&&
      typeof reply.feasible==='boolean'&&Array.isArray(reply.tasks)&&reply.time===command.time;
    else valid=valid&&reply.plan_sequence===input.plan_sequence&&reply.mission_version===command.version&&
      Number.isSafeInteger(reply.held_tasks)&&reply.held_tasks===(command.decision==='commit'?command.tasks?.length:0)&&
      reply.decision===command.decision&&reply.accepted===true;
    if(!valid)throw unavailable('군집 운용 수락 응답이 요청과 일치하지 않습니다.',target);
    return reply;
  }
  return Object.freeze({endpoint,
    plan:(body,options={})=>request(PLAN_PATH,{...json(body),...options}),
    commit:(body,options={})=>request(COMMIT_PATH,{...json(body),...options}),
    status:(options={})=>request(STATUS_PATH,options),
    guardedPlan:(body,guard,options={})=>guarded('plan',body,guard,options),
    guardedCommit:(body,guard,options={})=>guarded('commit',body,guard,options)
  });
}
