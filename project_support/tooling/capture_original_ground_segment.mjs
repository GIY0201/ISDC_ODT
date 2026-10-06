import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function groundSegmentTrace(createStore, model) {
  const bytes = new Map();
  const storage = { getItem: key => bytes.get(key) ?? null, setItem: (key, value) => bytes.set(key, value) };
  const store = createStore({ storage, model });
  const events = []; store.subscribe(event => events.push(event));
  const trace = [];
  const record = (action, result = null) => trace.push(structuredClone({ action, result, stations: store.stations,
    selectedId: store.selectedId, enabled: store.enabled.map(s => s.id), presets: store.availablePresets().map(s => s.key), saved: [...bytes] }));
  store.load(); record('load');
  record('preset', store.add({ preset: 'fairbanks' }));
  const custom = store.add({ name: '고흥', latitude: 34.6, longitude: 127.2 }); record('custom', custom);
  record('invalid', store.update(custom.id, { latitude: 200 }));
  record('update', store.update(custom.id, { name: '고흥 편집', min_elevation_deg: 7, bands: ['X'] }));
  record('disable', store.setEnabled('GS-JEJU', false));
  record('select', store.select(custom.id));
  const restored = createStore({ storage, model }); restored.load();
  trace.push(structuredClone({ action: 'restore', stations: restored.stations, selectedId: restored.selectedId }));
  record('remove', store.remove(custom.id)); record('remove-again', store.remove(custom.id));
  store.reset(); record('reset'); record('duplicate', store.add({ preset: 'jeju' }));
  return { trace, events };
}

async function pinned(path, hash) {
  const source = await readFile(path, 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== hash) throw new Error(`Source hash mismatch: ${path}`);
  return source;
}
export async function capture(root) {
  const modelSource = await pinned(`${root}/digital_twin/model_library/browser/ground_stations.js`, 'd63b55ab5d1e354de743f96a8998871d426217b62d551caeca131c39dc8c5ce4');
  const modelUrl = `data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`;
  const storeSource = await pinned(`${root}/user_application/web/scripts/communication/ground_segment.js`, '0d2e04eb662e97d9fbe877126b84b35eb383f578b049f7d6af8981ba3e2ba82c');
  const module = await import(`data:text/javascript;base64,${Buffer.from(storeSource.replace('/static/model_library/ground_stations.js', modelUrl)).toString('base64')}`);
  return { source_commit: '1a1e00297a0301637455b0ef2cf48b2e74576b07', ...groundSegmentTrace(module.createGroundSegmentStore) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(process.argv[3], `${JSON.stringify(await capture(process.argv[2]), null, 2)}\n`);
}
