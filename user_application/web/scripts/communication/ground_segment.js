// Source ground_segment operations, adapted at the application boundary. See ADR0024.
// Per-browser configuration only: no runtime, clock, network or import-time storage access.
export const STATIONS_KEY = 'spacetwin-ground-stations-v1';
export const MAX_STATIONS = 24;
const numericFields = ['latitude', 'longitude', 'altitude_km', 'dish_m', 'min_elevation_deg'];
const copy = value => structuredClone(value);

export function createGroundSegmentStore({ model, storage = null } = {}) {
  if (!model || ['createStation', 'normalizeStation', 'stationIdFor', 'validateStation'].some(key => typeof model[key] !== 'function')) {
    throw new TypeError('지상국 모델이 필요합니다.');
  }
  const { DEFAULT_STATION_KEYS, STATION_PRESETS, BANDS, createStation, normalizeStation, stationIdFor, validateStation } = model;
  let stations = []; let selectedId = null; let sequence = 0;
  let ready = false; let error = null; let destroyed = false;
  let storageToken = null; let tokenKnown = false;
  const listeners = new Set();
  const internalFind = id => stations.find(station => station.id === id) || null;
  const defaults = () => DEFAULT_STATION_KEYS.map(key => createStation({ preset: key }, { id: stationIdFor(key) }));
  function notify(event) {
    for (const listener of [...listeners]) { try { listener(event, api); } catch { /* accepted config must survive observers */ } }
  }
  function live(requireReady = true) {
    if (destroyed) throw new Error('지상국 설정이 종료되었습니다.');
    if (requireReady && !ready) throw new Error('지상국 설정을 먼저 불러오세요.');
  }
  function typedErrors(value, complete = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ['지상국 정의가 없습니다.'];
    const errors = [];
    for (const field of numericFields) {
      if ((complete || Object.hasOwn(value, field)) && (typeof value[field] !== 'number' || !Number.isFinite(value[field]))) errors.push(`${field}: 유한한 숫자가 필요합니다.`);
    }
    if ((complete || Object.hasOwn(value, 'name')) && (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 40)) errors.push('지상국 이름은 1~40자여야 합니다.');
    if ((complete || Object.hasOwn(value, 'enabled')) && typeof value.enabled !== 'boolean') errors.push('활성 상태는 참 또는 거짓이어야 합니다.');
    if ((complete || Object.hasOwn(value, 'bands')) && (!Array.isArray(value.bands) || !value.bands.length || value.bands.some(band => !BANDS.includes(band)))) errors.push('대역을 하나 이상 선택하세요 (S, X, Ka).');
    if (complete && (value.schema !== 1 || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 80 || typeof value.region !== 'string'
      || !(value.preset === null || (typeof value.preset === 'string' && Object.hasOwn(STATION_PRESETS, value.preset))))) errors.push('지상국 저장 형식이 올바르지 않습니다.');
    return errors;
  }
  function validateSaved(saved) {
    if (!saved || saved.schema !== 1 || !Number.isSafeInteger(saved.sequence) || saved.sequence < 0
      || !Array.isArray(saved.stations) || saved.stations.length > MAX_STATIONS
      || !(saved.selectedId === null || typeof saved.selectedId === 'string')) throw Error('저장 형식이 올바르지 않습니다.');
    const ids = new Set();
    for (const station of saved.stations) {
      const errors = [...typedErrors(station, true), ...validateStation(station)];
      if (errors.length || ids.has(station.id)) throw Error(errors.join(' ') || '지상국 ID가 중복됩니다.');
      ids.add(station.id);
    }
    return saved;
  }
  function accept(next, event, persist = true) {
    validateSaved(next);
    if (persist && storage !== null) {
      try {
        if (typeof storage.setItem !== 'function') throw Error('저장 기능이 없습니다.');
        if (tokenKnown && storage.getItem(STATIONS_KEY) !== storageToken) {
          ready = false; throw Error('다른 창의 지상국 변경과 충돌했습니다. 확인 후 다시 불러오세요.');
        }
        const encoded = JSON.stringify(next);
        storage.setItem(STATIONS_KEY, encoded); storageToken = encoded; tokenKnown = true;
      } catch (cause) {
        error = `지상국 설정 저장 실패: ${cause.message}`; notify('error'); throw new Error(error, { cause });
      }
    }
    stations = copy(next.stations); selectedId = next.selectedId; sequence = next.sequence;
    ready = true; error = null; notify(event);
  }
  const current = (overrides = {}) => ({ schema: 1, sequence, selectedId, stations, ...overrides });
  function load() {
    live(false);
    try {
      let raw = null;
      if (storage !== null) {
        if (typeof storage.getItem !== 'function') throw Error('읽기 기능이 없습니다.');
        raw = storage.getItem(STATIONS_KEY);
      }
      storageToken = raw; tokenKnown = true;
      if (raw === null) accept({ schema: 1, sequence: 0, selectedId: null, stations: defaults() }, 'load', false);
      else {
        const saved = validateSaved(JSON.parse(raw));
        accept({ ...saved, stations: saved.stations.map(normalizeStation),
          selectedId: saved.stations.some(station => station.id === saved.selectedId) ? saved.selectedId : null }, 'load', false);
      }
      return true;
    } catch (cause) { ready = false; error = `지상국 설정 불러오기 실패: ${cause.message}`; notify('error'); return false; }
  }
  function uniqueId(base) {
    let candidate = base; let suffix = 1;
    while (internalFind(candidate)) { suffix += 1; candidate = `${base}_${suffix}`; }
    return candidate;
  }
  function add(partial = {}) {
    live();
    if (stations.length >= MAX_STATIONS) throw new RangeError(`지상국은 최대 ${MAX_STATIONS}개까지 둘 수 있습니다.`);
    // The original custom-add button sends name:'' to request its sequential name.
    const input = partial?.name === '' ? { ...partial, name: `지상국 ${sequence + 1}` } : partial;
    const errors = typedErrors(input); if (errors.length) throw new TypeError(errors.join(' '));
    if (sequence >= Number.MAX_SAFE_INTEGER) throw new RangeError('지상국 번호 한도입니다.');
    const nextSequence = sequence + 1;
    const preset = Object.hasOwn(STATION_PRESETS, partial.preset) ? STATION_PRESETS[partial.preset] : null;
    const id = uniqueId(preset ? stationIdFor(preset.key) : stationIdFor(`site_${nextSequence}`));
    const station = createStation(preset ? { ...preset, ...partial, preset: preset.key }
      : { ...partial, preset: null, name: partial.name || `지상국 ${nextSequence}` }, { id });
    const invalid = validateStation(station); if (invalid.length) throw new TypeError(invalid.join(' '));
    accept(current({ stations: [...stations, station], sequence: nextSequence, selectedId: id }), 'add');
    return copy(station);
  }
  function update(id, next) {
    live(); const station = internalFind(id);
    if (!station) return ['지상국을 찾을 수 없습니다.'];
    const errors = typedErrors(next); if (errors.length) return errors;
    const candidate = createStation({ ...station, ...next, preset: station.preset }, { id });
    const invalid = validateStation(candidate); if (invalid.length) return invalid;
    accept(current({ stations: stations.map(item => item.id === id ? candidate : item) }), 'update'); return [];
  }
  function setEnabled(id, enabled) {
    live(); if (!internalFind(id)) return false;
    accept(current({ stations: stations.map(item => item.id === id ? { ...item, enabled: enabled !== false } : item) }), 'update'); return true;
  }
  function remove(id) {
    live(); if (!internalFind(id)) return false;
    accept(current({ stations: stations.filter(station => station.id !== id), selectedId: selectedId === id ? null : selectedId }), 'remove'); return true;
  }
  function select(id) {
    live(); const nextId = internalFind(id) ? id : null;
    accept(current({ selectedId: nextId }), 'select'); return nextId;
  }
  function reset() { live(false); accept(current({ stations: defaults(), selectedId: null }), 'reset'); }
  const api = {
    load, add, update, setEnabled, remove, select, reset,
    find: id => copy(internalFind(id)),
    get stations() { return copy(stations); }, get enabled() { return copy(stations.filter(station => station.enabled !== false)); },
    get selectedId() { return selectedId; }, get selected() { return copy(internalFind(selectedId)); },
    get ready() { return ready && !destroyed; }, get error() { return error; },
    get persistence() { return storage === null ? 'memory_only' : 'browser_storage'; },
    availablePresets: () => copy(Object.values(STATION_PRESETS).filter(preset => !stations.some(station => station.preset === preset.key))),
    subscribe(listener) { live(false); if (typeof listener !== 'function') throw new TypeError('수신 함수가 필요합니다.'); listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { destroyed = true; ready = false; listeners.clear(); },
  };
  return Object.freeze(api);
}
