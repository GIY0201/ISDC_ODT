const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  if (!response.ok) {
    let message = `요청 실패 (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

export class OrbitApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : detail?.message || `궤도 요청 실패 (${status})`);
    this.name = "OrbitApiError"; this.status = status; this.detail = detail;
    this.code = detail?.code; this.state = detail?.state;
  }
}
async function orbitRequest(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new OrbitApiError(response.status, data.detail);
  return data;
}

async function rfRequest(payload, { signal } = {}) {
  const response = await fetch('/api/communication/link-budget', { cache: 'no-store', method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload), signal });
  let data;
  try { data = await response.json(); } catch (_) { throw new Error(`RF 응답을 읽을 수 없습니다 (${response.status})`); }
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail) ? detail.map(item => `${item.loc?.at(-1) || '입력'}: ${item.msg || '유효하지 않은 값'}`).join('; ') : typeof detail === 'string' ? detail : `RF 요청 실패 (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function nodeRequest(path,payload,{signal}={}) {
  const response=await fetch(path,{cache:'no-store',method:'POST',headers:jsonHeaders,body:JSON.stringify(payload),signal});
  const mediaType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(mediaType!=='application/json')throw new OrbitApiError(response.status,'노드 응답 형식 오류');
  let data;
  try{data=await response.json();}catch(_){throw new OrbitApiError(response.status,'노드 응답을 읽을 수 없습니다');}
  if(!response.ok)throw new OrbitApiError(response.status,data?.detail);
  return data;
}

async function missionWindowRequest(payload,{signal}={}) {
  try{return await nodeRequest('/api/nodes/mission-windows',payload,{signal});}
  catch(error){if(signal?.aborted)signal.throwIfAborted();throw error;}
}

export const api = {
  nodeMissionWindows: missionWindowRequest,
  nodeSamples: (payload,options={}) => nodeRequest('/api/nodes/samples',payload,options),
  nodeTrack: (payload,options={}) => nodeRequest('/api/nodes/track',payload,options),
  solarSamples: (payload,{signal}={}) => orbitRequest('/api/solar/samples',{method:'POST',headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  satelliteModelManifest: ({signal}={}) => request('/static/satellite_display/manifest.json',{signal}),
  report: reportRequest,
  orbitRadioSeries: (payload, { signal } = {}) => orbitRequest('/api/orbit/radio-series', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  orbitRadio: (payload, { signal } = {}) => orbitRequest('/api/orbit/radio-geometry', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  orbitVisibility: (payload, { signal } = {}) => orbitRequest("/api/orbit/visibility", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  orbitInputs: ({ signal } = {}) => orbitRequest("/api/orbit/inputs", { signal }),
  orbitState: ({ signal } = {}) => orbitRequest("/api/orbit/state", { signal }),
  selectOrbit: (payload, { signal } = {}) => orbitRequest("/api/orbit/selection", { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  orbitSamples: (payload, { signal } = {}) => orbitRequest("/api/orbit/samples", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  bootstrap: ({ signal } = {}) => request("/api/bootstrap", { signal }),
  health: () => request("/api/health"),
  catalogPosition: (payload,{signal}={}) => request("/api/catalog/position",{method:"POST",headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  catalogScene: (payload,{signal}={}) => orbitRequest("/api/catalog/scene",{method:"POST",headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  catalogTrack: (payload,{signal}={}) => orbitRequest("/api/catalog/track",{method:"POST",headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  catalogVisibility: (payload,{signal}={}) => orbitRequest("/api/catalog/visibility",{method:"POST",headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  catalogSamples: (payload,{signal}={}) => request("/api/catalog/samples",{method:"POST",headers:jsonHeaders,body:JSON.stringify(payload),signal}),
  satelliteGroups: ({signal} = {}) => request("/api/satellite-groups", {signal}),
  satellites: ({ group = "active", limit = 0, offset = 0, query = "", orbit = "all" } = {}, {signal} = {}) => request(`/api/satellites?group=${encodeURIComponent(group)}&limit=${limit}&offset=${offset}&q=${encodeURIComponent(query)}&orbit=${encodeURIComponent(orbit)}`, {signal}),
  satelliteProfile: (catalogNumber, {signal} = {}) => request(`/api/satellites/${encodeURIComponent(catalogNumber)}`, {signal}),
  runtimeControl: (action, speed = undefined) => request("/api/runtime/control", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action, speed }) }),
  runtimeSpeed: (speed) => request("/api/runtime/speed", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ speed: Number(speed) }) }),
  selectScenario: (scenarioId) => request("/api/scenario/select", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ scenario_id: scenarioId }) }),
  injectFault: (payload) => request("/api/faults", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  linkBudget: rfRequest,
  issReceiveProfile: ({ signal } = {}) => request('/api/communication/iss-receive-profile', { signal }),
  route: (source, target, objective = "balanced", { signal } = {}) => request("/api/communication/route", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ source, target, objective }), signal }),
  contacts: (hours = 12, { signal } = {}) => request(`/api/communication/contacts?hours=${hours}`, { signal }),
  missionAction: (missionId, action) => request("/api/missions/action", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ mission_id: missionId, action }) }),
  missionTask: (payload) => request("/api/missions/tasks", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  validateMission: (missionId) => request(`/api/missions/${encodeURIComponent(missionId)}/validate`),
  replanMission: (missionId, apply = true) => request("/api/missions/replan", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ mission_id: missionId, apply }) }),
  deviceAction: (deviceId, action, {signal} = {}) => request("/api/hil/device", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ device_id: deviceId, action }), signal }),
  hilPreflight: ({signal} = {}) => request("/api/hil/preflight", {signal}),
  hilSequence: (sequenceId = "closed_loop", {signal} = {}) => request("/api/hil/sequence", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ sequence_id: sequenceId }), signal }),
  recording: (enabled, {signal} = {}) => request("/api/hil/recording", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ enabled }), signal }),
};

async function reportRequest(kind, { signal } = {}) {
  const formats = {csv:{path:'/api/reports/summary.csv',type:'text/csv',filename:'spacetwin-report.csv'},json:{path:'/api/reports/snapshot.json',type:'application/json',filename:'spacetwin-snapshot.json'}};
  const format=formats[kind];if(!format)throw new Error('보고서 형식 오류');
  const response=await fetch(format.path,{cache:'no-store',signal});
  if(!response.ok)throw new Error(`보고서 요청 실패 (${response.status})`);
  const mediaType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(mediaType!==format.type)throw new Error('보고서 응답 형식 오류');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length||bytes.byteLength>2*1024*1024)throw new Error('보고서 크기 오류');
  return {kind,filename:format.filename,mediaType,bytes};
}

export function telemetrySocket(onMessage, onStatus) {
  let socket;
  let closedByUser = false;
  let retryTimer;

  const connect = () => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${location.host}/ws/telemetry`);
    onStatus?.("connecting");
    socket.onopen = () => onStatus?.("open");
    socket.onmessage = (event) => {
      try { onMessage(JSON.parse(event.data)); } catch (error) { console.error("telemetry parse", error); }
    };
    socket.onerror = () => onStatus?.("error");
    socket.onclose = () => {
      onStatus?.("closed");
      if (!closedByUser) retryTimer = setTimeout(connect, 1800);
    };
  };
  connect();
  return () => {
    closedByUser = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
