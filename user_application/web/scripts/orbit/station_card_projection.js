import {stationCardModel} from './station_card.js';
const samePoint=(a,b)=>['latitude_deg','longitude_deg','ellipsoid_height_m','virtual','ellipsoid'].every(k=>a?.[k]===b?.[k]);
/** Readonly projection of the existing native observer and pass owners. */
export function stationCatalogCard(site,timeline=null,passes=null){
 if(!site)return null;const t=timeline??{},v=t.display,selected=t.selected;
 const isObserver=Boolean(t.observer&&t.observer.latitude_deg===site.latitude&&t.observer.longitude_deg===site.longitude);
 const matching=Boolean(selected&&v)&&isObserver&&v?.catalog_number===selected?.catalog_number&&v?.normalized_gp_sha256===selected?.normalized_gp_sha256&&v?.utc===t.utc&&typeof v?.observation_utc==='string'&&samePoint(v.ground_point,t.observer)&&v.minimum_elevation_deg===t.minimumElevation;
 const look=matching&&Number.isFinite(v.observed_elevation_deg)&&Number.isFinite(v.range_m)&&v.range_m>0&&(v.azimuth_deg===null||Number.isFinite(v.azimuth_deg))?{azimuth:v.azimuth_deg,elevation:v.observed_elevation_deg,rangeKm:v.range_m/1000}:null;
 const r=passes?.result,passMatches=Boolean(selected&&r)&&isObserver&&r?.catalog_number===selected?.catalog_number&&r?.normalized_gp_sha256===selected?.normalized_gp_sha256&&samePoint(r.ground_point,t.observer)&&r.minimum_elevation_deg===t.minimumElevation&&r.query_start_utc===t.utc;
 const first=passMatches&&['complete','partial'].includes(r.status)?r.intervals?.[0]:null;
 const model=stationCardModel(site,{selectedName:selected?.name??(selected?`NORAD ${selected.catalog_number}`:null),look,maskDegrees:t.minimumElevation??site.minElevationDeg,isObserver,nextPass:first?{aos:new Date(first.start_utc),maxElevation:first.max_elevation_deg}:null});
 model.live=model.live.map(([key,value])=>key==='다음 관측창'?[key,!selected?'—':!isObserver?'관측 조건 미적용':passes?.pending?'계산 중':passes?.error?'계산 실패 · 미확인':!passMatches?'24 h 구간 미조회':r.status==='none'?'조회한 24 h 내 없음':first?value+(r.status==='partial'?' · 부분 결과 / 누락 가능':''):r.status==='partial'?'부분 실패 · 관측창 미확인':'계산 실패 · 미확인']:[key,value]);
 model.observationUtc=matching&&look?v.observation_utc:null;
 model.note+=' SGP4 궤도 모델과 IERS-A 관측 표본을 재사용하며, 다른 지점·GP·UTC 결과는 섞지 않습니다. 실제 통신·장비 상태 미확인.';
 return model;
}
