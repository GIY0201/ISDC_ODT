// Reused from ISDC-ODT 1a1e002; formulas and constructor semantics preserved.
import { STATION_PRESETS } from './station_presets.js';
// Ground station definitions for the communication console: site presets with real coordinates,
// the antenna and RF bands each site offers, and the functions that create, normalise and validate
// a station the operator places. Pure data and functions; no DOM, storage or transport.
// Antenna figures are representative engineering values, not the specification of any facility.

export const STATION_SCHEMA = 1;
export const BANDS = Object.freeze(['S', 'X', 'Ka']);
export const BAND_LABELS = Object.freeze({ S: 'S 대역 (TT&C)', X: 'X 대역 (데이터)', Ka: 'Ka 대역 (고속 데이터)' });
// System noise temperature per band used for G/T of the station antenna.
const SYSTEM_TEMPERATURE_K = Object.freeze({ S: 150, X: 200, Ka: 300 });
const APERTURE_EFFICIENCY = 0.6;
const SPEED_OF_LIGHT_M_S = 299_792_458;
export const BAND_FREQUENCY_GHZ = Object.freeze({ S: 2.2, X: 8.2, Ka: 20 });

// Site presets. Coordinates are the published locations of the cities or facilities; heights are
// WGS84 ellipsoidal in km (0 where unknown). Bands and dish size are representative.
export { STATION_PRESETS } from './station_presets.js';

// The stations a fresh console starts with: the Korean sites plus one polar site for high-latitude passes.
export const DEFAULT_STATION_KEYS = Object.freeze(['daejeon', 'jeju', 'svalbard']);

export function stationIdFor(key) {
  return `GS-${String(key || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'SITE'}`;
}

// Parabolic dish gain (dBi) at a band frequency with a fixed aperture efficiency.
export function antennaGainDbi(dishMeters, band) {
  const frequency = BAND_FREQUENCY_GHZ[band];
  const dish = Number(dishMeters);
  if (!frequency || !(dish > 0)) return null;
  const wavelength = SPEED_OF_LIGHT_M_S / (frequency * 1e9);
  return 10 * Math.log10(APERTURE_EFFICIENCY * (Math.PI * dish / wavelength) ** 2);
}

// Figure of merit G/T (dB/K) for the station antenna at a band.
export function figureOfMeritDbK(dishMeters, band) {
  const gain = antennaGainDbi(dishMeters, band);
  return gain === null ? null : gain - 10 * Math.log10(SYSTEM_TEMPERATURE_K[band]);
}

export function createStation(partial = {}, { id = null } = {}) {
  const preset = STATION_PRESETS[partial.preset] || null;
  const base = preset || STATION_PRESETS.seoul;
  const bands = Array.isArray(partial.bands) ? partial.bands.filter(band => BANDS.includes(band)) : [...base.bands];
  return {
    schema: STATION_SCHEMA,
    id: id || stationIdFor(partial.preset || partial.name || 'site'),
    preset: preset ? preset.key : null,
    name: String(partial.name ?? base.name).trim() || base.name,
    region: String(partial.region ?? base.region ?? '').trim(),
    latitude: Number.isFinite(Number(partial.latitude)) ? Number(partial.latitude) : base.latitude,
    longitude: Number.isFinite(Number(partial.longitude)) ? Number(partial.longitude) : base.longitude,
    altitude_km: Number.isFinite(Number(partial.altitude_km)) ? Number(partial.altitude_km) : base.altitude_km,
    dish_m: Number.isFinite(Number(partial.dish_m)) ? Number(partial.dish_m) : base.dish_m,
    bands: bands.length ? bands : [...base.bands],
    min_elevation_deg: Number.isFinite(Number(partial.min_elevation_deg)) ? Number(partial.min_elevation_deg) : base.min_elevation_deg,
    enabled: partial.enabled !== false,
  };
}

export function normalizeStation(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return createStation(raw, { id: raw.id });
}

export function validateStation(station) {
  const errors = [];
  if (!station || typeof station !== 'object') return ['지상국 정의가 없습니다.'];
  const name = String(station.name ?? '').trim();
  if (!name || name.length > 40) errors.push('지상국 이름은 1~40자여야 합니다.');
  if (!(Number(station.latitude) >= -90 && Number(station.latitude) <= 90)) errors.push('위도는 -90~90°여야 합니다.');
  if (!(Number(station.longitude) >= -180 && Number(station.longitude) <= 180)) errors.push('경도는 -180~180°여야 합니다.');
  if (!(Number(station.altitude_km) >= -0.5 && Number(station.altitude_km) <= 9)) errors.push('고도는 -0.5~9 km여야 합니다.');
  if (!(Number(station.dish_m) >= 0.5 && Number(station.dish_m) <= 70)) errors.push('안테나 지름은 0.5~70 m여야 합니다.');
  if (!(Number(station.min_elevation_deg) >= 0 && Number(station.min_elevation_deg) < 90)) errors.push('최소 고각은 0° 이상 90° 미만이어야 합니다.');
  if (!Array.isArray(station.bands) || !station.bands.length || station.bands.some(band => !BANDS.includes(band))) errors.push('대역을 하나 이상 선택하세요 (S, X, Ka).');
  return errors;
}

// Great-circle distance between two stations on a sphere of the WGS84 equatorial radius (km).
export function surfaceDistanceKm(a, b) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const phi1 = toRadians(a.latitude); const phi2 = toRadians(b.latitude);
  const dPhi = toRadians(b.latitude - a.latitude); const dLambda = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * 6378.137 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Ground range (km along the surface) inside which a satellite at the altitude is above the mask:
// the central angle acos(Re / (Re + h) · cos(mask)) − mask on a spherical Earth.
export function coverageRadiusKm(altitudeKm, maskDegrees) {
  const earth = 6378.137;
  const mask = Math.max(0, Number(maskDegrees) || 0) * Math.PI / 180;
  const ratio = earth / (earth + Math.max(0, Number(altitudeKm) || 0));
  const central = Math.acos(Math.min(1, ratio * Math.cos(mask))) - mask;
  return Math.max(0, central) * earth;
}
