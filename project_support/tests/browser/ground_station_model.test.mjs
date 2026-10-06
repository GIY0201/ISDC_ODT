import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
import { STATION_PRESETS } from '../../../digital_twin/model_library/browser/station_presets.js';
import { stationTrace } from '../../tooling/capture_original_ground_stations.mjs';

const golden = JSON.parse(await readFile(new URL('../fixtures/original_ground_stations.json', import.meta.url), 'utf8'));

test('all original station constructors, validation and engineering calculations match pinned capture', () => {
  assert.equal(golden.source_commit, '1a1e00297a0301637455b0ef2cf48b2e74576b07');
  assert.deepEqual(stationTrace(model), golden.trace);
});

test('communication and existing observer sites share the original preset definitions', () => {
  assert.equal(model.STATION_PRESETS, STATION_PRESETS);
  assert.equal(Object.keys(model.STATION_PRESETS).length, 12);
});

test('created and restored station edits cannot mutate model presets or input bands', () => {
  const before = structuredClone(STATION_PRESETS);
  const first = model.createStation({ preset: 'daejeon' });
  first.bands.push('L'); first.latitude = -90;
  const raw = { id: 'GS-CUSTOM', name: 'Test', bands: ['S', 'X'] };
  const restored = model.normalizeStation(raw);
  restored.bands.pop();
  assert.deepEqual(raw.bands, ['S', 'X']);
  assert.deepEqual(STATION_PRESETS, before);
  assert.deepEqual(model.createStation({ preset: 'daejeon' }).bands, ['S', 'X', 'Ka']);
});

test('source validation rejects every numeric boundary outside its defined range', () => {
  const valid = model.createStation({ preset: 'seoul' });
  for (const [field, values] of Object.entries({ latitude: [-90.01, 90.01], longitude: [-180.01, 180.01],
    altitude_km: [-0.501, 9.001], dish_m: [0.499, 70.001], min_elevation_deg: [-0.001, 90] })) {
    for (const value of values) assert.equal(model.validateStation({ ...valid, [field]: value }).length, 1, `${field}:${value}`);
  }
  assert.equal(model.antennaGainDbi(0, 'X'), null);
  assert.equal(model.figureOfMeritDbK(7.3, 'L'), null);
  assert.equal(model.surfaceDistanceKm(valid, valid), 0);
  assert.ok(model.coverageRadiusKm(550, 10) < model.coverageRadiusKm(550, 0));
});
