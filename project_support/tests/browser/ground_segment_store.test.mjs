import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
import { createGroundSegmentStore, STATIONS_KEY, MAX_STATIONS } from '../../../user_application/web/scripts/communication/ground_segment.js';
import { groundSegmentTrace } from '../../tooling/capture_original_ground_segment.mjs';
const golden = JSON.parse(await readFile(new URL('../fixtures/original_ground_segment.json', import.meta.url), 'utf8'));
function setup(raw = null) {
  let bytes = raw; let fail = false;
  const storage = { getItem: () => bytes, setItem: (_, next) => { if (fail) throw Error('quota'); bytes = next; } };
  const store = createGroundSegmentStore({ model, storage }); store.load();
  return { store, bytes: () => bytes, fail: value => { fail = value; } };
}
test('original ground store complete valid operation trace matches pinned source', () => {
  assert.deepEqual(groundSegmentTrace(createGroundSegmentStore, model), { trace: golden.trace, events: golden.events });
});
test('all returned station/preset/operation values are independent', () => {
  const { store } = setup(); const before = store.stations;
  for (const value of [store.stations[0], store.enabled[0], store.find(before[0].id)]) { value.bands.length = 0; value.latitude = 90; }
  assert.deepEqual(store.stations, before);
  const station = store.add({ preset: 'fairbanks' }); station.bands.length = 0;
  const selected = store.selected; selected.name = 'mutated';
  assert.notEqual(store.selected.name, 'mutated'); assert.ok(store.selected.bands.length);
  store.availablePresets()[0].bands.length = 0; assert.ok(store.availablePresets()[0].bands.length);
});
test('storage failure preserves roster selection sequence bytes and accepted events for every mutation', () => {
  for (const operation of [s => s.add({ preset: 'fairbanks' }), s => s.update('GS-JEJU', { name: '편집' }),
    s => s.setEnabled('GS-JEJU', false), s => s.remove('GS-JEJU'), s => s.select('GS-JEJU'), s => s.reset()]) {
    const item = setup(); item.store.add({ name: 'first' });
    const before = item.store.stations; const selected = item.store.selectedId; const bytes = item.bytes();
    const events = []; item.store.subscribe(event => events.push(event)); item.fail(true);
    assert.throws(() => operation(item.store), /저장/);
    assert.deepEqual(item.store.stations, before); assert.equal(item.store.selectedId, selected);
    assert.equal(item.bytes(), bytes); assert.deepEqual(events, ['error']); assert.equal(item.store.ready, true);
    item.fail(false); assert.equal(item.store.add({ name: 'second' }).id, 'GS-SITE_2'); assert.equal(item.store.error, null);
  }
});
test('corrupt or denied restore never substitutes defaults or rewrites evidence; explicit reset recovers', () => {
  for (const raw of ['{', '', 'null', JSON.stringify({ schema: 2, stations: [] }),
    JSON.stringify({ schema: 1, sequence: 0, selectedId: null, stations: [null] })]) {
    const item = setup(raw); assert.equal(item.store.ready, false); assert.deepEqual(item.store.stations, []);
    assert.equal(item.bytes(), raw); assert.ok(item.store.error); assert.throws(() => item.store.add({}), /불러/);
    item.store.reset(); assert.equal(item.store.ready, true); assert.equal(item.store.stations.length, 3);
  }
  const store = createGroundSegmentStore({ model, storage: { getItem() { throw Error('denied'); } } });
  store.load(); assert.equal(store.ready, false); assert.match(store.error, /불러/);
});
test('invalid typed edit/add and persisted fields cannot be normalized into valid defaults', () => {
  for (const partial of [{ latitude: null }, { longitude: '1' }, { dish_m: NaN }, { bands: [] }, { bands: ['L'] }, { enabled: 'false' }]) {
    const { store } = setup(); const before = store.stations;
    assert.throws(() => store.add(partial)); assert.ok(store.update('GS-JEJU', partial).length); assert.deepEqual(store.stations, before);
  }
  const { store } = setup(); const valid = { schema: 1, sequence: 0, selectedId: null, stations: store.stations };
  for (const corrupt of [s => s.stations[0].latitude = null, s => s.stations.push(s.stations[0]),
    s => s.sequence = -1, s => s.stations = Array(25).fill(s.stations[0]), s => s.selectedId = 42]) {
    const value = structuredClone(valid); corrupt(value); assert.equal(setup(JSON.stringify(value)).store.ready, false);
  }
});
test('original communication custom-add action accepts empty name as generated-name request', () => {
  const { store } = setup();
  const station = store.add({ name: '', latitude: 37.5, longitude: 127 });
  assert.equal(station.id, 'GS-SITE_1'); assert.equal(station.name, '지상국 1');
  assert.deepEqual(store.update(station.id, { name: '' }), ['지상국 이름은 1~40자여야 합니다.']);
});
test('capacity, sequence after reset, observer isolation and disposal preserve contract', () => {
  const { store } = setup(); store.subscribe(() => { throw Error('observer'); });
  store.add({ name: 'first' }); store.reset(); assert.equal(store.add({ name: 'second' }).id, 'GS-SITE_2');
  while (store.stations.length < MAX_STATIONS) store.add({ name: 'more' });
  assert.throws(() => store.add({}), RangeError); assert.equal(store.stations.length, 24);
  store.destroy(); assert.throws(() => store.reset(), /종료/);
  assert.equal(STATIONS_KEY, 'spacetwin-ground-stations-v1');
});
test('explicit reload atomically replaces browser configuration without writing or sharing it', () => {
  let bytes = null; const storage = { getItem: () => bytes, setItem: (_, value) => { bytes = value; } };
  const a = createGroundSegmentStore({ model, storage }); const b = createGroundSegmentStore({ model, storage });
  a.load(); b.load(); a.add({ preset: 'fairbanks' }); assert.equal(b.stations.length, 3);
  const saved = bytes; b.load(); assert.equal(b.stations.length, 4); assert.equal(bytes, saved);
  bytes = '{'; b.load(); assert.equal(b.ready, false); assert.equal(b.stations.length, 4);
  assert.throws(() => b.remove('GS-JEJU')); bytes = saved; b.load(); assert.equal(b.ready, true);
});
