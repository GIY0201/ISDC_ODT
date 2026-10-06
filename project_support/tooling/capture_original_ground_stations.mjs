import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function stationTrace(model) {
  const created = Object.keys(model.STATION_PRESETS).map(preset => model.createStation({ preset }));
  const custom = model.createStation({ name: '  고흥 ', latitude: 34.6, longitude: 127.2,
    dish_m: 5, bands: ['X', 'L'], min_elevation_deg: 10 }, { id: 'GS-CUSTOM' });
  return {
    presets: model.STATION_PRESETS, bands: model.BANDS, labels: model.BAND_LABELS,
    frequencies: model.BAND_FREQUENCY_GHZ, defaults: model.DEFAULT_STATION_KEYS,
    created, custom,
    restored: model.normalizeStation({ id: 'GS-SEOUL', preset: 'seoul', enabled: false, min_elevation_deg: '8' }),
    invalidRestore: model.normalizeStation({ name: 'no id' }),
    validation: [...created, custom, { ...custom, latitude: 95, bands: [], dish_m: 0 },
      { ...custom, longitude: 181, altitude_km: 10, min_elevation_deg: 90, name: 'x'.repeat(41) }]
      .map(value => model.validateStation(value)),
    antenna: [0, 0.5, 7.3, 11, 13, 70].flatMap(dish => ['S', 'X', 'Ka', 'L'].map(band => ({
      dish, band, gain: model.antennaGainDbi(dish, band), gt: model.figureOfMeritDbK(dish, band),
    }))),
    distances: created.flatMap(a => created.map(b => ({ a: a.id, b: b.id, km: model.surfaceDistanceKm(a, b) }))),
    coverage: [0, 550, 1200, 35786].flatMap(altitude => [0, 5, 10, 30, 89].map(mask => ({
      altitude, mask, km: model.coverageRadiusKm(altitude, mask),
    }))),
    ids: ['punta_arenas', '', 'custom site', '서울'].map(key => model.stationIdFor(key)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sourcePath, outputPath, sourceCommit] = process.argv.slice(2);
  if (!sourcePath || !outputPath || !/^[a-f0-9]{40}$/.test(sourceCommit || '')) throw new Error('source, output and pinned commit required');
  const bytes = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sourceCommit !== '1a1e00297a0301637455b0ef2cf48b2e74576b07'
      || sha256 !== 'd63b55ab5d1e354de743f96a8998871d426217b62d551caeca131c39dc8c5ce4') {
    throw new Error('source commit or bytes differ from the reviewed original');
  }
  const source = await import(`data:text/javascript;base64,${bytes.toString('base64')}`);
  await writeFile(outputPath, JSON.stringify({ schema: 1, source_commit: sourceCommit,
    source_file: 'digital_twin/model_library/browser/ground_stations.js',
    source_sha256: sha256, trace: stationTrace(source) }, null, 2) + '\n');
}
