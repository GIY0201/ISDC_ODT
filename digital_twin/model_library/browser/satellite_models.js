// Ported from ISDC-ODT source1a1e002; ordered mapping and display semantics preserved.
// 위성 3D 모델 배정. 매니페스트(/static/assets/models/manifest.json)는 사람이 관리하는 매핑 규칙과
// 대표 치수이며, 이 모듈은 사본을 받아 순수 함수로 판정한다. 결과는 표시용이지 위성 식별의 근거가 아니다.
const ASSET_BASE = '/static/satellite_display/';
const DEBRIS_PATTERN = /\bDEB\b|DEBRIS|FRAGMENT/i;
const ROCKET_PATTERN = /\bR\/B\b|ROCKET BODY|\bAKM\b|\bPLAT\b/i;
const STATION_PATTERN = /^ISS\b|TIANGONG|\bCSS\b|SPACE STATION/i;
const CUBESAT_PATTERN = /CUBESAT|\bFLOCK\b|\bLEMUR\b|\bSPACEBEE\b|\bDOVE\b|\b[1-6]U\b/i;
const ORBITS = new Set(['LEO', 'MEO', 'GEO', 'HEO']);
const DEFAULT_CREDIT = 'NASA 3D Resources';

/** Validate a loaded static package, preserving raw source definitions separately. */
export function validateSatelliteManifest(input) {
  const fail = message => { throw new Error(`위성 모델 manifest 오류: ${message}`); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(input) || input.schema !== 2 || !Array.isArray(input.models) || input.models.length < 1 || input.models.length > 512) fail('schema/models');
  const manifest = structuredClone(input), repairs = [];
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
  const link = value => {
    if (value === '' || value == null) return true;
    if (typeof value !== 'string') return false;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  };
  const replace = (parent, key, value, path) => {
    repairs.push({ path, original: parent[key], replacement: value }); parent[key] = value;
  };
  if (!object(manifest.sources) || !object(manifest.representatives)) fail('sources/representatives');
  for (const [provider, source] of Object.entries(manifest.sources)) {
    if (!/^[a-z][a-z0-9_]*$/.test(provider) || !object(source) || !text(source.credit)) fail('provider/credit');
    if (!link(source.repository) || !link(source.usage_guidelines)) fail('provider link');
    if (provider === 'spacetwin') {
      if (source.credit.includes('\uFFFD')) replace(source, 'credit', 'SpaceTwin 자체 제작', `sources.${provider}.credit`);
      if (source.name?.includes('\uFFFD')) replace(source, 'name', 'SpaceTwin 자체 제작 대표 형상', `sources.${provider}.name`);
      if (source.note?.includes('\uFFFD')) replace(source, 'note', 'SpaceTwin이 만든 표시용 대표 형상이며 제조사 형상이나 실측 자료가 아닙니다.', `sources.${provider}.note`);
    } else if (source.credit.includes('\uFFFD')) fail('unverifiable provider credit');
  }
  const keys = new Set(), assets = new Map();
  for (const model of manifest.models) {
    if (!object(model) || typeof model.key !== 'string' || model.key.length > 80 || !/^[a-z][a-z0-9_]*$/.test(model.key) || keys.has(model.key)) fail('model key');
    keys.add(model.key);
    if (typeof model.file !== 'string' || !/^[a-z0-9_]+\.glb$/.test(model.file)) fail('model path');
    if (model.thumbnail != null && (typeof model.thumbnail !== 'string' || !/^[a-z0-9_]+\.(jpg|jpeg|png|webp)$/.test(model.thumbnail))) fail('thumbnail path');
    if (!Object.hasOwn(manifest.sources, model.provider) || !text(model.title) || model.title.includes('\uFFFD')) fail('model provider/title');
    if (!text(model.label) || model.label.includes('\uFFFD')) replace(model, 'label', model.title, `models.${model.key}.label`);
    if (typeof model.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(model.sha256) || !Number.isSafeInteger(model.bytes) || model.bytes <= 0) fail('asset hash/bytes');
    const identity = `${model.sha256}:${model.bytes}`;
    if (assets.has(model.file) && assets.get(model.file) !== identity) fail('conflicting shared asset');
    assets.set(model.file, identity);
    for (const kind of ['exact', 'series', 'family']) {
      const rule = model[kind];
      if (rule == null) continue;
      if (!object(rule) || !Array.isArray(rule.names) || rule.names.some(pattern => typeof pattern !== 'string' || pattern.length > 256)) fail('rule patterns');
      for (const pattern of rule.names) { try { new RegExp(pattern, 'i'); } catch { fail('invalid regex'); } }
      if (kind !== 'family' && (!Array.isArray(rule.norad) || rule.norad.some(id => !/^[1-9][0-9]*$/.test(String(id)) || !Number.isSafeInteger(Number(id))))) fail('rule NORAD');
    }
    if (model.orientation != null && (!object(model.orientation) || ['heading', 'pitch', 'roll'].some(key => model.orientation[key] != null && !Number.isFinite(model.orientation[key])))) fail('orientation');
  }
  for (const key of Object.values(manifest.representatives)) if (typeof key !== 'string' || !keys.has(key)) fail('representative reference');
  manifest.presentation_repairs = repairs;
  return manifest;
}

export function objectKind(item = {}, catalog = {}) {
  const name = String(catalog.OBJECT_NAME || item.OBJECT_NAME || '').trim().slice(0, 256);
  const type = String(catalog.OBJECT_TYPE || '').trim().toUpperCase();
  if (type === 'DEB' || DEBRIS_PATTERN.test(name)) return 'debris';
  if (type === 'R/B' || type === 'RB' || ROCKET_PATTERN.test(name)) return 'rocket';
  if (STATION_PATTERN.test(name)) return 'station';
  if (CUBESAT_PATTERN.test(name)) return 'cubesat';
  return 'payload';
}

function compile(patterns) {
  return (Array.isArray(patterns) ? patterns : []).map(pattern => new RegExp(pattern, 'i'));
}

function idSet(values) {
  return new Set((Array.isArray(values) ? values : []).map(String));
}

function sourcesOf(manifest) {
  if (manifest?.sources && typeof manifest.sources === 'object') return manifest.sources;
  return manifest?.source ? { nasa: manifest.source } : {};
}

export function createModelResolver(manifest, baseUrl = ASSET_BASE) {
  manifest = structuredClone(manifest);
  const models = Array.isArray(manifest?.models) ? manifest.models : [];
  const byKey = new Map(models.map(model => [model.key, model]));
  const rules = models.map(model => ({
    model,
    exactNorad: idSet(model.exact?.norad), exactNames: compile(model.exact?.names),
    seriesNorad: idSet(model.series?.norad), seriesNames: compile(model.series?.names),
    familyNames: compile(model.family?.names),
  }));
  const representatives = manifest?.representatives || {};
  const sources = sourcesOf(manifest);
  const requestedPixelSize = Number(manifest?.display?.minimum_pixel_size);
  const minimumPixelSize = Number.isFinite(requestedPixelSize) && requestedPixelSize > 0 ? requestedPixelSize : 12;

  const describe = (model, quality, kind, orbit) => {
    const provider = model.provider || 'nasa';
    const source = sources[provider] || {};
    const sizeMeters = Number.isFinite(Number(model.size_m)) && Number(model.size_m) > 0 ? Number(model.size_m) : null;
    const extent = Number.isFinite(Number(model.extent)) && Number(model.extent) > 0 ? Number(model.extent) : null;
    return {
      key: model.key, quality, kind, orbit, provider,
      title: model.title, label: model.label || model.title,
      url: baseUrl + model.file, thumbnail: model.thumbnail ? baseUrl + model.thumbnail : null,
      orientation: { heading: 0, pitch: 0, roll: 0, ...(model.orientation || {}) },
      minimumPixelSize,
      sizeMeters,
      scale: sizeMeters && extent ? sizeMeters / extent : 1,
      credit: source.credit || (provider === 'nasa' ? DEFAULT_CREDIT : provider),
      creditUrl: source.repository || '',
    };
  };

  return function resolveSatelliteModel(item = {}, catalog = {}) {
    const kind = objectKind(item, catalog);
    const orbitRaw = String(item.ORBIT_REGIME || '').toUpperCase();
    const orbit = ORBITS.has(orbitRaw) ? orbitRaw : 'LEO';
    // A user-placed node names its model directly; that choice is a display assignment, not a match.
    if (typeof item.model_key === 'string' && byKey.has(item.model_key)) return describe(byKey.get(item.model_key), 'assigned', kind, orbit);
    if (kind === 'rocket' || kind === 'debris') return null;
    const norad = String(item.NORAD_CAT_ID ?? catalog.NORAD_CAT_ID ?? '');
    const name = String(catalog.OBJECT_NAME || item.OBJECT_NAME || '').trim().slice(0, 256);
    const exact = rules.find(rule => rule.exactNorad.has(norad) || rule.exactNames.some(pattern => pattern.test(name)));
    if (exact) return describe(exact.model, 'exact', kind, orbit);
    const series = rules.find(rule => rule.seriesNorad.has(norad) || rule.seriesNames.some(pattern => pattern.test(name)));
    if (series) return describe(series.model, 'series', kind, orbit);
    const family = rules.find(rule => rule.familyNames.some(pattern => pattern.test(name)));
    if (family) return describe(family.model, 'representative', kind, orbit);
    const key = kind === 'station' ? representatives.station
      : kind === 'cubesat' ? representatives.cubesat
        : representatives[`payload:${orbit}`] || representatives['payload:LEO'];
    const model = byKey.get(key);
    return model ? describe(model, 'representative', kind, orbit) : null;
  };
}

