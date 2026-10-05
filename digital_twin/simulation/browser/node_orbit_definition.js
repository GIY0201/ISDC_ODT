// Static node definition/domain/summary port from ISDC-ODT 1a1e002.
// No time propagation. Explicit epochs; engineering assumptions, not fitted GP.
const DEGREES = 180 / Math.PI;
const RADIANS = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
export const EARTH_A_KM = 6378.137;
export const EARTH_MU = 398600.4418;
export const EARTH_J2 = 1.08262668e-3;
export const MINIMUM_PERIGEE_ALTITUDE_KM = 120;
export const MAXIMUM_APOGEE_ALTITUDE_KM = 200_000;

// Elements are cached per definition object but keyed on the field values, so an orbit edited in
// place (the node editor does this) is recomputed instead of served from a stale entry.
const elementCache = new WeakMap();

function signatureOf(orbit) {
  return `${orbit.altitude_km}|${orbit.eccentricity}|${orbit.inclination}|${orbit.raan}|${orbit.argp}|${orbit.mean_anomaly}|${orbit.epoch instanceof Date ? orbit.epoch.getTime() : orbit.epoch}`;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function wrapDegrees(angle) {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function epochMillis(value) {
  if (finite(value)) return Number.isFinite(new Date(value).getTime()) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/.test(raw)) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === raw.slice(0, 19) ? time : null;
}

// Definition -> elements with J2 secular rates. Returns null for a definition outside the modelled
// domain instead of clamping it: a missing or impossible orbit is never replaced by a default one.
export function orbitElements(orbit) {
  if (!orbit || typeof orbit !== 'object') return null;
  const signature = signatureOf(orbit);
  const cached = elementCache.get(orbit);
  if (cached && cached.signature === signature) return cached.elements;
  const altitude = Number(orbit.altitude_km);
  const e = orbit.eccentricity === undefined || orbit.eccentricity === null || orbit.eccentricity === '' ? 0 : Number(orbit.eccentricity);
  const inclination = Number(orbit.inclination);
  const raan = orbit.raan === undefined ? 0 : Number(orbit.raan);
  const argp = orbit.argp === undefined ? 0 : Number(orbit.argp);
  const meanAnomaly = orbit.mean_anomaly === undefined ? 0 : Number(orbit.mean_anomaly);
  const epoch = epochMillis(orbit.epoch);
  let elements = null;
  if ([altitude, e, inclination, raan, argp, meanAnomaly].every(Number.isFinite) && epoch !== null
      && e >= 0 && e < 0.95 && inclination >= 0 && inclination <= 180) {
    const a = EARTH_A_KM + altitude;
    const perigeeAltitude = a * (1 - e) - EARTH_A_KM;
    const apogeeAltitude = a * (1 + e) - EARTH_A_KM;
    if (perigeeAltitude >= MINIMUM_PERIGEE_ALTITUDE_KM && apogeeAltitude <= MAXIMUM_APOGEE_ALTITUDE_KM) {
      const i = inclination * RADIANS;
      const n0 = Math.sqrt(EARTH_MU / (a * a * a));
      const p = a * (1 - e * e);
      const k = 1.5 * EARTH_J2 * (EARTH_A_KM / p) ** 2 * n0;
      const sin2 = Math.sin(i) ** 2;
      const raanDot = -k * Math.cos(i);
      const argpDot = k * (2 - 2.5 * sin2);
      const meanMotion = n0 + k * Math.sqrt(1 - e * e) * (1 - 1.5 * sin2);
      elements = Object.freeze({
        a, e, i, raan0: raan * RADIANS, argp0: argp * RADIANS, m0: meanAnomaly * RADIANS, epoch,
        n0, meanMotion, raanDot, argpDot, period: TWO_PI / n0, perigeeAltitude, apogeeAltitude,
        // The definition in degrees, kept so summaries do not carry radian round-trip noise.
        definition: Object.freeze({ altitude_km: altitude, eccentricity: e, inclination, raan: wrapDegrees(raan), argp: wrapDegrees(argp), mean_anomaly: wrapDegrees(meanAnomaly) }),
      });
    }
  }
  elementCache.set(orbit, { signature, elements });
  return elements;
}

export function orbitRegime({ periodMinutes, perigeeKm, apogeeKm, eccentricity }) {
  if (periodMinutes >= 1300 && periodMinutes <= 1550 && perigeeKm >= 30000 && perigeeKm <= 45000) return 'GEO';
  if (eccentricity >= 0.25 || apogeeKm >= 50000) return 'HEO';
  if (apogeeKm < 2000) return 'LEO';
  if (perigeeKm < 35786) return 'MEO';
  return 'GEO';
}

// GP-like summary fields for catalog listing and the inspector. Values derive from the definition
// (two-body mean motion), not from a fitted element set.
export function catalogElements(orbit) {
  const elements = orbitElements(orbit);
  if (!elements) return null;
  const periodMinutes = elements.period / 60;
  const meanMotion = 1440 / periodMinutes;
  const perigeeKm = elements.perigeeAltitude;
  const apogeeKm = elements.apogeeAltitude;
  return {
    EPOCH: new Date(elements.epoch).toISOString().replace('Z', ''),
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: elements.e,
    INCLINATION: elements.definition.inclination,
    RA_OF_ASC_NODE: elements.definition.raan,
    ARG_OF_PERICENTER: elements.definition.argp,
    MEAN_ANOMALY: elements.definition.mean_anomaly,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
    BSTAR: 0,
    PERIOD_MINUTES: Math.round(periodMinutes * 1000) / 1000,
    SEMI_MAJOR_AXIS_KM: Math.round(elements.a * 1000) / 1000,
    PERIGEE_KM: Math.round(perigeeKm * 100) / 100,
    APOGEE_KM: Math.round(apogeeKm * 100) / 100,
    ORBIT_REGIME: orbitRegime({ periodMinutes, perigeeKm, apogeeKm, eccentricity: elements.e }),
    RAAN_DRIFT_DEG_PER_DAY: elements.raanDot * 86400 * DEGREES,
    ARGP_DRIFT_DEG_PER_DAY: elements.argpDot * 86400 * DEGREES,
  };
}
