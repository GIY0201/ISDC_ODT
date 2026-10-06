// The accepted server configuration drives data operations. The local constellation remains a
// browser display copy; requests carry only equipment identities, never expanded model values.
const ENDPOINT = '/api/data-management/deployment';
const clone = value => structuredClone(value);

function deploymentNodes(nodes) {
  return nodes.map(node => ({
    id: node.id, name: node.name, mode: node.mode,
    equipment: (node.equipment || []).map(item => ({ id: item.id, catalog: item.catalog, enabled: item.enabled !== false })),
  }));
}

function signature(nodes) {
  return JSON.stringify(deploymentNodes(nodes).sort((a, b) => a.id.localeCompare(b.id)).map(node => ({
    ...node, equipment: node.equipment.sort((a, b) => a.id.localeCompare(b.id)),
  })));
}


// Validate the actual T149 receipt before projecting or accepting any public values.
const EQUIPMENT = new Set(['oisl_standard','oisl_long_range','oisl_mini','ka_user_link','x_band_downlink','s_band_ttc','eo_camera','dtn_store','gnss_receiver']);
function validateReceipt(body) {
  const invalid = () => { throw new Error('서버 배치 응답 형식이 올바르지 않습니다.'); };
  const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Number.isSafeInteger(body.revision) || body.revision < 0 || !Array.isArray(body.nodes) || body.nodes.length > 240
      || !text(body.run_id,240) || !text(body.scope_id,240)
      || !(body.deployment_id === null || (text(body.deployment_id,100) && /^[A-Za-z0-9_-]+$/.test(body.deployment_id)))) invalid();
  const expectedScope = `${body.run_id}:${body.deployment_id === null ? 'unconfigured' : `deployment:${body.deployment_id}`}`;
  if (body.scope_id !== expectedScope || (body.deployment_id === null && (body.revision !== 0 || body.nodes.length !== 0))) invalid();
  const ids = new Set();
  for (const node of body.nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || !text(node.id,80) || !text(node.name,80)
        || !['nominal','standby','safe'].includes(node.mode) || !Array.isArray(node.equipment) || node.equipment.length > 100
        || ids.has(node.id) || Object.keys(node).some(key => !['id','name','mode','equipment'].includes(key))) invalid();
    ids.add(node.id); const equipmentIds = new Set();
    for (const item of node.equipment) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !text(item.id,80) || !EQUIPMENT.has(item.catalog)
          || typeof item.enabled !== 'boolean' || equipmentIds.has(item.id)
          || Object.keys(item).some(key => !['id','catalog','enabled'].includes(key))) invalid();
      equipmentIds.add(item.id);
    }
  }
}

export function createDataDeployment({
  constellation, fetchImpl, createId,
  setTimer = setTimeout, clearTimer = clearTimeout,
  emit = () => {}, onChange = () => {},
} = {}) {
  if (!constellation || typeof fetchImpl !== 'function' || typeof createId !== 'function') {
    throw new TypeError('명시적인 배치 저장소·HTTP·ID 공급자가 필요합니다.');
  }
  let disposed = false, authorization = null, notificationError = null;
  const requests = new Set();
  const ensureActive = () => { if (disposed) throw new Error('배치 클라이언트가 종료되었습니다.'); };
  let server = null, error = null, syncRequired = false;
  let queue = Promise.resolve(), queued = 0, initialized = false, initializing = null;
  let pending = null;
  const listeners = new Set();
  const state = () => ({ server: clone(server), error, syncRequired, busy: queued > 0, disposed, notificationError });
  const changed = () => {
    if (disposed) return;
    for (const listener of [onChange, ...listeners]) {
      try { listener(state()); } catch { notificationError = '배치 변경 알림을 처리하지 못했습니다.'; }
    }
  };
  const publish = (type, data) => {
    if (disposed) return;
    try { emit(type, clone(data)); } catch { notificationError = '배치 이벤트를 전달하지 못했습니다.'; }
  };

  function serial(action) {
    if (disposed) return Promise.reject(new Error('배치 클라이언트가 종료되었습니다.'));
    queued++; changed();
    const result = queue.then(async () => {
      error = null; changed();
      try { ensureActive(); return await action(); }
      catch (failure) { error = failure.message || '서버 배치 동기화 실패'; throw failure; }
      finally { queued--; changed(); }
    });
    queue = result.catch(() => {});
    return result;
  }

  async function request(method, payload) {
    ensureActive();
    const controller = new AbortController();
    const timer = setTimer(() => controller.abort(), 15000);
    const active = {controller, timer}; requests.add(active);
    try {
      const response = await fetchImpl(ENDPOINT, {
        method, signal: controller.signal, cache: 'no-store',
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      ensureActive();
      if (controller.signal.aborted) throw new Error('배치 요청 시간 제한을 초과했습니다.');
      const contentType = response.headers?.get('content-type') || '';
      if(contentType.includes('text/html')) {
        throw new Error(`현재 접속 서버가 배치 API 대신 HTML 화면을 반환했습니다 (${ENDPOINT}, HTTP ${response.status}). 이 서버에 배치 API가 등록되어 있는지 확인해야 합니다.`);
      }
      let body;
      try { body = await response.json(); }
      catch { throw new Error(`배치 API의 JSON 응답을 읽을 수 없습니다 (${ENDPOINT}, HTTP ${response.status}). 서버 응답을 확인해야 합니다.`); }
      ensureActive();
      if (controller.signal.aborted) throw new Error('배치 요청 시간 제한을 초과했습니다.');
      if (!response.ok) {
        const failure = new Error(typeof body?.detail === 'string' ? body.detail : `서버 배치 동기화 실패 (${response.status})`);
        failure.status = response.status;
        throw failure;
      }
      validateReceipt(body);
      return body;
    } finally { clearTimer(timer); requests.delete(active); }
  }

  async function read() {
    const response = await request('GET');
    ensureActive();
    server = clone(response);
    syncRequired = signature(server.nodes) !== signature(constellation.deployed);
    publish('data:deployment', server); changed();
    return clone(server);
  }

  async function apply(nodes, kind) {
    if (!server) {
      await read();
      // A first failed GET must not turn the next button click into an unconfirmed overwrite.
      if (syncRequired && server.revision !== 0) {
        throw new Error('서버에 다른 배치가 있습니다. 현재 구성을 확인한 후 다시 배치해 주세요.');
      }
    }
    const projected = deploymentNodes(nodes);
    const key = signature(projected);
    if (!pending || pending.key !== key || pending.kind !== kind) {
      pending = {
        key, kind, nodes: clone(nodes),
        acceptedRevision: server.deployment_id && signature(server.nodes) === key ? server.revision : server.revision + 1,
        payload: {
          deployment_id: server.deployment_id && signature(server.nodes) === key ? server.deployment_id : createId(),
          expected_revision: server.revision, nodes: projected,
        },
      };
    }
    if (typeof pending.payload.deployment_id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(pending.payload.deployment_id)) {
      pending = null; throw new Error('유효한 배치 ID가 필요합니다.');
    }
    let response;
    try { response = await request('POST', pending.payload); }
    catch (failure) {
      if (failure.status === 409) {
        pending = null;
        try { await read(); } catch { server = null; }
        syncRequired = true;
      }
      throw failure;
    }
    ensureActive();
    if (response.deployment_id !== pending.payload.deployment_id || response.revision !== pending.acceptedRevision || signature(response.nodes) !== key) {
      throw new Error('서버가 수락한 배치와 요청한 구성이 다릅니다. 다시 동기화해 주세요.');
    }
    server = clone(response); syncRequired = true;
    authorization = {nodes: clone(pending.nodes), receipt: clone(response), kind: kind === 'recall' ? 'recall' : 'deploy'};
    try {
      if (kind === 'recall') constellation.recall(clone(response));
      else constellation.deploy(clone(pending.nodes), clone(response));
    } finally { authorization = null; }
    pending = null; syncRequired = false;
    publish('nodes:deployed', { nodes: clone(constellation.deployed), items: constellation.deployedItems() });
    publish('data:deployment', server);
    return clone(server);
  }

  return {
    get state() { return state(); },
    verifyAcceptance(nodes, receipt, kind) {
      return !disposed && authorization !== null && kind === authorization.kind
        && JSON.stringify(nodes) === JSON.stringify(authorization.nodes)
        && JSON.stringify(receipt) === JSON.stringify(authorization.receipt);
    },
    destroy() {
      if (disposed) return;
      disposed = true; authorization = null; listeners.clear();
      for (const {controller, timer} of requests) { controller.abort(); clearTimer(timer); }
      requests.clear();
    },
    initialize() {
      if (disposed) return Promise.reject(new Error('배치 클라이언트가 종료되었습니다.'));
      if (initialized) return Promise.resolve(clone(server));
      if (initializing) return initializing;
      initializing = serial(async () => {
        await read();
        initialized = true;
        return clone(server);
      }).finally(() => { initializing = null; });
      return initializing;
    },
    refresh: () => serial(read),
    deploy() { const nodes = clone(constellation.drafts); return serial(() => apply(nodes, 'deploy')); },
    recall: () => serial(() => apply([], 'recall')),
    // Several owners (the node tab, the scenario player) watch one client; each gets state copies.
    subscribe(listener) { ensureActive(); listeners.add(listener); return () => listeners.delete(listener); },
  };
}
