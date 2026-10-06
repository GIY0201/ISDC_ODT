// Original ISDC-ODT 1a1e002 WGS84 ENU geometry only; no propagation or clock.
const DEGREES = 180 / Math.PI;
const RADIANS = Math.PI / 180;
const EARTH_A_KM = 6378.137;
const EARTH_FLATTENING = 1 / 298.257223563;
const EARTH_B_KM = EARTH_A_KM * (1 - EARTH_FLATTENING);
const EARTH_E2 = EARTH_FLATTENING * (2 - EARTH_FLATTENING);

function validCoordinates(value, altitude) {
  return value != null && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
    && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && Number.isFinite(altitude) && altitude >= 0;
}

function stationAltitude(station) {
  return station?.altitudeKm === undefined ? 0 : station.altitudeKm;
}

function validStation(station) {
  const altitude = stationAltitude(station);
  return validCoordinates(station, 0) && Number.isFinite(altitude) && altitude > -EARTH_B_KM;
}

function ecfFromGeodetic(position, altitude) {
  const latitude = position.latitude * RADIANS;
  const longitude = position.longitude * RADIANS;
  const normal = EARTH_A_KM / Math.sqrt(1 - EARTH_E2 * Math.sin(latitude) ** 2);
  return {
    x: (normal + altitude) * Math.cos(latitude) * Math.cos(longitude),
    y: (normal + altitude) * Math.cos(latitude) * Math.sin(longitude),
    z: (normal * (1 - EARTH_E2) + altitude) * Math.sin(latitude),
  };
}

// WGS84 ECEF -> local east/north/up (ESA Navipedia). Altitudes are ellipsoidal,
// in km; an omitted station altitude alone means 0 km. This is geometry only,
// without terrain, refraction or link availability. Zenith/nadir azimuth is
// undefined and represented as 0 by convention; zero separation returns null.
export function lookAnglesAt(position, station) {
  if (!validCoordinates(position, position?.altitude) || !validStation(station)) return null;
  const target = ecfFromGeodetic(position, position.altitude);
  const observer = ecfFromGeodetic(station, stationAltitude(station));
  const x = target.x - observer.x;
  const y = target.y - observer.y;
  const z = target.z - observer.z;
  const latitude = station.latitude * RADIANS;
  const longitude = station.longitude * RADIANS;
  const east = -Math.sin(longitude) * x + Math.cos(longitude) * y;
  const north = -Math.sin(latitude) * Math.cos(longitude) * x
    - Math.sin(latitude) * Math.sin(longitude) * y + Math.cos(latitude) * z;
  const up = Math.cos(latitude) * Math.cos(longitude) * x
    + Math.cos(latitude) * Math.sin(longitude) * y + Math.sin(latitude) * z;
  const rangeKm = Math.hypot(east, north, up);
  if (!Number.isFinite(rangeKm) || rangeKm === 0) return null;
  const horizontal = Math.hypot(east, north);
  return {
    azimuth: horizontal <= rangeKm * 1e-12 ? 0 : (Math.atan2(east, north) * DEGREES + 360) % 360,
    elevation: Math.atan2(up, horizontal) * DEGREES,
    rangeKm,
  };
}

