import {validateCatalogDetails} from './catalog_details.js';
import {finiteNumber,displayNumber,epochAgeHours,utcLabel} from './catalog.js';
const number=(v,d)=>finiteNumber(v)===null?'미제공':displayNumber(v,d);
/** Source inspector element/source policy adapted to existing readonly V6 owners. */
export function catalogInspectorRows(item,profile,{timeline=null}={}){
 const gp=profile?.gp??item??{},mean=finiteNumber(gp.MEAN_MOTION),ecc=finiteNumber(gp.ECCENTRICITY),period=mean!==null&&mean>0,shape=period&&ecc!==null&&ecc>=0&&ecc<1;
 const selected=timeline?.selected,matching=Boolean(selected&&item)&&selected.catalog_number===item.NORAD_CAT_ID,v=matching?timeline.display:null;
 const age=matching&&typeof timeline.utc==='string'?epochAgeHours(gp,Date.parse(timeline.utc)):null;
 const valid=v&&v.catalog_number===selected.catalog_number&&v.normalized_gp_sha256===selected.normalized_gp_sha256&&v.utc===timeline.utc&&Array.isArray(v.position_m)&&v.position_m.length===3&&v.position_m.every(Number.isFinite);
 let detailed=false;try{detailed=Boolean(valid&&typeof v.details_utc==='string'&&v.details_utc&&(v.details_utc===v.utc||v.details_utc===v.observation_utc)&&validateCatalogDetails(v));}catch{}
 const geo=detailed?v.geodetic:null;
 return [['승교점 적경 °',number(gp.RA_OF_ASC_NODE,3)],['근지점 편각 °',number(gp.ARG_OF_PERICENTER,3)],['평균 근점 이각 °',number(gp.MEAN_ANOMALY,3)],['평균 운동 rev/day',number(period?mean:null,8)],['궤도 장반경 km · GP 근사',number(period?gp.SEMI_MAJOR_AXIS_KM:null,2)],['근지점 km · GP 형태 확인',number(shape?gp.PERIGEE_KM:null,1)],['원지점 km · GP 형태 확인',number(shape?gp.APOGEE_KM:null,1)],['분석 UTC',matching?utcLabel(timeline.utc):'미제공'],['분석 UTC − GP epoch h',number(age,1)],['현재 위치 ITRF m',valid?v.position_m.map(x=>x.toFixed(3)).join(', '):'미제공'],['속력 TEME km/s',number(detailed?v.teme_speed_km_s:null,3)],['위도 ° · WGS84',number(geo?.latitude_deg,4)],['경도 ° · WGS84',number(geo?.longitude_deg,4)],['타원체 고도 km · WGS84',number(geo?geo.ellipsoid_height_m/1000:null,1)],['상세 native 표본 UTC',detailed?v.details_utc:'미제공'],['상세 좌표·속력 의미',detailed?'TEME 속력과 WGS84 좌표 변환 · 위 표본 UTC 값 / 실측 아님':'현재 검증된 native 상세 표본 미제공']];
}
