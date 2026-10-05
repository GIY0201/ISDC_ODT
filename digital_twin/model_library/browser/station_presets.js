// Original prototype representative preset data only; not verified facility specifications.
export const STATION_PRESETS = Object.freeze({
  seoul: { key: 'seoul', name: '서울', region: '대한민국', latitude: 37.5665, longitude: 126.978, altitude_km: 0.04, dish_m: 7.3, bands: ['S', 'X', 'Ka'], min_elevation_deg: 5 },
  daejeon: { key: 'daejeon', name: '대전', region: '대한민국', latitude: 36.3742, longitude: 127.3567, altitude_km: 0.07, dish_m: 13, bands: ['S', 'X', 'Ka'], min_elevation_deg: 5 },
  jeju: { key: 'jeju', name: '제주', region: '대한민국', latitude: 33.4996, longitude: 126.5312, altitude_km: 0.03, dish_m: 7.3, bands: ['S', 'X'], min_elevation_deg: 5 },
  svalbard: { key: 'svalbard', name: '스발바르', region: '노르웨이', latitude: 78.2298, longitude: 15.4078, altitude_km: 0.45, dish_m: 11, bands: ['S', 'X', 'Ka'], min_elevation_deg: 3 },
  tromso: { key: 'tromso', name: '트롬쇠', region: '노르웨이', latitude: 69.6627, longitude: 18.9401, altitude_km: 0.1, dish_m: 11, bands: ['S', 'X'], min_elevation_deg: 5 },
  fairbanks: { key: 'fairbanks', name: '페어뱅크스', region: '미국 알래스카', latitude: 64.8378, longitude: -147.7164, altitude_km: 0.14, dish_m: 11, bands: ['S', 'X', 'Ka'], min_elevation_deg: 5 },
  inuvik: { key: 'inuvik', name: '이누빅', region: '캐나다', latitude: 68.3607, longitude: -133.723, altitude_km: 0.02, dish_m: 13, bands: ['S', 'X'], min_elevation_deg: 5 },
  singapore: { key: 'singapore', name: '싱가포르', region: '싱가포르', latitude: 1.3521, longitude: 103.8198, altitude_km: 0.02, dish_m: 7.3, bands: ['S', 'X'], min_elevation_deg: 7 },
  hawaii: { key: 'hawaii', name: '하와이', region: '미국', latitude: 19.0136, longitude: -155.6634, altitude_km: 0.2, dish_m: 9, bands: ['S', 'X'], min_elevation_deg: 5 },
  atacama: { key: 'atacama', name: '아타카마', region: '칠레', latitude: -23.0229, longitude: -67.753, altitude_km: 2.4, dish_m: 7.3, bands: ['S', 'X'], min_elevation_deg: 5 },
  punta_arenas: { key: 'punta_arenas', name: '푼타아레나스', region: '칠레', latitude: -53.1638, longitude: -70.9171, altitude_km: 0.03, dish_m: 11, bands: ['S', 'X', 'Ka'], min_elevation_deg: 5 },
  hobart: { key: 'hobart', name: '호바트', region: '호주', latitude: -42.8821, longitude: 147.3272, altitude_km: 0.02, dish_m: 7.3, bands: ['S', 'X'], min_elevation_deg: 5 },
});
