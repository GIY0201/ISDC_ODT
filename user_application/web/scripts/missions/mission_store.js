// Working set of missions for the mission console: requests, the plans the operations module
// answered, the operator's commit/abort decisions and a short decision log. A per-browser display
// configuration in localStorage (like the node working set), not server runtime state.

export const MISSIONS_KEY = "spacetwin-missions-v1";
export const MAX_MISSIONS = 60;
export const MAX_LOG = 200;

function writeJson(storage, key, value) {
  try { storage?.setItem?.(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function createMissionStore({ model, storage = null, now = () => Date.now() } = {}) {
  if (!model || ['createMission','normalizeMission','validateMission'].some(key=>typeof model[key]!=='function')) throw new TypeError('mission model required');
  if(storage&&['getItem','setItem'].some(key=>typeof storage[key]!=='function'))throw new TypeError('mission storage required');
  const {createMission,normalizeMission,validateMission}=model;
  let ready=false,dead=false,error='',token=null;
  const copy=value=>structuredClone(value);
  function finite(value,seen=new Set()){
    if(typeof value==='number'&&!Number.isFinite(value))throw Error('임무 입력은 유한한 숫자여야 합니다.');
    if(value&&typeof value==='object'){
      if(seen.has(value))throw Error('순환 임무 입력은 지원하지 않습니다.');seen.add(value);
      for(const item of Object.values(value))finite(item,seen);seen.delete(value);
    }
  }
  function live(requireReady=true){if(dead)throw Error('임무 설정이 종료되었습니다.');if(requireReady&&!ready)throw Error('임무 설정을 먼저 불러오세요.');}
  function validateSaved(saved){
    if(!saved||saved.schema!==1||!Number.isSafeInteger(saved.sequence)||saved.sequence<0||!Array.isArray(saved.missions)||saved.missions.length>MAX_MISSIONS||!Array.isArray(saved.log)||saved.log.length>MAX_LOG||!(saved.selectedId===null||typeof saved.selectedId==='string'))throw Error('임무 저장 형식이 올바르지 않습니다.');
    const ids=new Set();finite(saved);
    for(const mission of saved.missions){
      if(!mission||mission.schema!==1||typeof mission.id!=='string'||!mission.id.trim()||mission.id.length>80||ids.has(mission.id)||!Number.isSafeInteger(Number(/^MSN-(\d+)$/.exec(mission.id)?.[1]??0))||!Object.hasOwn(model.MISSION_KINDS,mission.kind)||!Object.hasOwn(model.MISSION_STATUSES,mission.status)||!mission.params||Array.isArray(mission.params)||typeof mission.params!=='object'||!Number.isFinite(Date.parse(mission.window_start))||!Number.isFinite(Date.parse(mission.deadline)))throw Error('임무 저장 형식이 올바르지 않습니다.');
      ids.add(mission.id);
    }
    if(saved.log.some(entry=>!entry||typeof entry!=='object'||Array.isArray(entry)))throw Error('임무 기록 저장 형식이 올바르지 않습니다.');
    if(saved.selectedId!==null&&!ids.has(saved.selectedId))throw Error('저장된 임무 선택을 확인하세요.');
  }
  const listeners = new Set();
  let missions = [];
  let log = [];
  let sequence = 0;
  let selectedId = null;
  const notify = event => {for(const listener of [...listeners]){try{listener(event,api);}catch{/* Observers do not own accepted requests. */}}};

  function persist() {
    const value={ schema: 1, sequence, selectedId, missions, log };
    finite(value);
    validateSaved(value);
    if(storage&&storage.getItem(MISSIONS_KEY)!==token)throw Error('다른 창의 임무 변경을 먼저 불러오세요.');
    if(!writeJson(storage,MISSIONS_KEY,value))throw Error('임무 저장 실패. 이전 설정을 유지했습니다.');
    if(storage)token=JSON.stringify(value);
  }

  function load() {
    const raw=storage?storage.getItem(MISSIONS_KEY):null;
    let saved=null;
    try{if(raw!==null){saved=JSON.parse(raw);validateSaved(saved);}}catch(cause){throw Error('임무 저장 형식을 확인하세요: '+cause.message);}
    token=raw;
    const epoch = now();
    missions = (Array.isArray(saved?.missions) ? saved.missions : []).map(item => normalizeMission(item, epoch)).filter(Boolean).slice(0, MAX_MISSIONS);
    log = (Array.isArray(saved?.log) ? saved.log : []).filter(entry => entry && typeof entry === "object").slice(-MAX_LOG);
    const highest = missions.reduce((max, mission) => Math.max(max, Number(/^MSN-(\d+)$/.exec(mission.id)?.[1]) || 0), 0);
    sequence = Math.max(Number(saved?.sequence) || 0, highest);
    selectedId = missions.some(mission => mission.id === saved?.selectedId) ? saved.selectedId : missions[0]?.id || null;
    ready=true;notify("load");
  }

  function find(id) {
    return missions.find(mission => mission.id === id) || null;
  }

  function record(entry) {
    log = [...log, { time: new Date(now()).toISOString(), ...entry }].slice(-MAX_LOG);
  }

  function add(partial = {}, context = {}) {
    if(sequence>=Number.MAX_SAFE_INTEGER)throw new RangeError("임무 요청 번호 한도입니다.");
    if (missions.length >= MAX_MISSIONS) throw new RangeError(`임무는 최대 ${MAX_MISSIONS}개까지 둘 수 있습니다.`);
    sequence += 1;
    const mission = createMission(partial, { id: `MSN-${String(sequence).padStart(4, "0")}`, now: now() });
    const errors = validateMission(mission, context);
    if (errors.length) { sequence -= 1; return { mission: null, errors }; }
    missions = [...missions, mission];
    selectedId = mission.id;
    record({ mission_id: mission.id, kind: "created", message: `${mission.name} 요청 등록` });
    persist(); notify("add");
    return { mission, errors: [] };
  }

  // Replace request fields; a changed request drops the plan and returns the mission to draft.
  function update(id, patch, context = {}) {
    const index = missions.findIndex(mission => mission.id === id);
    if (index < 0) return ["임무를 찾을 수 없습니다."];
    const current = missions[index];
    const candidate = createMission({ ...current, ...patch, params: { ...current.params, ...(patch.params || {}) }, plan: null, status: "draft", committed_at: null }, { id, now: now() });
    const errors = validateMission(candidate, context);
    if (errors.length) return errors;
    missions = missions.map(mission => (mission.id === id ? candidate : mission));
    record({ mission_id: id, kind: "edited", message: `${candidate.name} 요청 수정 · 계획 초기화` });
    persist(); notify("update");
    return [];
  }

  function setPlan(id, plan, { source = "orchestrator" } = {}) {
    const mission = find(id);
    if (!mission || !plan) return null;
    const version = (mission.plan?.version || 0) + 1;
    const next = { ...mission, plan: { ...plan, version, source, received_at: new Date(now()).toISOString() }, status: mission.status === "committed" ? "committed" : "planned", updated_at: new Date(now()).toISOString() };
    missions = missions.map(item => (item.id === id ? next : item));
    record({ mission_id: id, kind: plan.feasible ? "planned" : "infeasible", message: `${next.name} 계획 v${version} · ${plan.feasible ? `${plan.tasks?.length || 0}개 작업, ${plan.summary?.satellites?.length || 0}기` : (plan.reasons?.[0] || plan.checks?.find(check => !check.ok)?.detail || "실행 불가")}` });
    persist(); notify("plan");
    return next;
  }

  function setStatus(id, status, message = null) {
    const mission = find(id);
    if (!mission) return null;
    const next = { ...mission, status, updated_at: new Date(now()).toISOString(), committed_at: status === "committed" ? new Date(now()).toISOString() : status === "draft" || status === "planned" ? null : mission.committed_at };
    missions = missions.map(item => (item.id === id ? next : item));
    record({ mission_id: id, kind: status, message: message || `${next.name} · ${status}` });
    persist(); notify("status");
    return next;
  }

  function remove(id) {
    const mission = find(id);
    if (!mission) return false;
    missions = missions.filter(item => item.id !== id);
    if (selectedId === id) selectedId = missions[0]?.id || null;
    record({ mission_id: id, kind: "removed", message: `${mission.name} 삭제` });
    persist(); notify("remove");
    return true;
  }

  function duplicate(id) {
    const source = find(id);
    if (!source) return null;
    const { plan, status, committed_at, created_at, ...rest } = source;
    return add({ ...rest, name: `${source.name} 사본` }).mission;
  }

  function select(id) {
    selectedId = find(id) ? id : null;
    persist(); notify("select");
    return selectedId;
  }

  function transaction(action,{loading=false}={}){
    live(!loading);
    const previous={missions:copy(missions),log:copy(log),sequence,selectedId,token};error='';
    try{return copy(action());}catch(cause){({missions,log,sequence,selectedId,token}=previous);error=String(cause.message);if(loading)ready=false;throw cause;}
  }
  const mutate=action=>(...args)=>transaction(()=>{finite(args);return action(...copy(args));});
  const api = {
    load(){try{transaction(load,{loading:true});return true;}catch{return false;}},
    add:mutate(add),update:mutate(update),setPlan:mutate(setPlan),setStatus:mutate(setStatus),remove:mutate(remove),duplicate:mutate(duplicate),select:mutate(select),
    find:id=>copy(find(id)),record:mutate(entry=>{record(entry);persist();notify('log');}),
    get missions(){return copy(missions);},get log(){return copy(log);},get selectedId(){return selectedId;},get selected(){return copy(find(selectedId));},
    get ready(){return !dead&&ready;},get error(){return error;},get persistence(){return storage?'browser':'memory_only';},
    subscribe(listener){live(false);listeners.add(listener);return()=>listeners.delete(listener);},
    destroy(){if(dead)return;dead=true;ready=false;listeners.clear();}
  };
  return api;
}
