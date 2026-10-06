const keys=['details_version','details_profile','details_units'];
const fields=['geodetic','teme_speed_km_s'];
export function validateCatalogDetails(meta,row=meta){
 const declared=keys.some(k=>meta?.[k]!==undefined);
 if(!declared){if(fields.some(k=>row?.[k]!==undefined))throw Error('카탈로그 상세 자료의 단위·프로필이 없습니다.');return false;}
 if(meta.details_version!==1||meta.details_profile!=='WGS84_ERFA_GC2GD_TEME_SPEED'||Object.entries({latitude:'deg',longitude:'deg',ellipsoid_height:'m',teme_speed:'km/s'}).some(([k,v])=>meta.details_units?.[k]!==v))throw Error('카탈로그 상세 자료 계약 오류');
 if(row?.status==='error'){if(fields.some(k=>row[k]!==null))throw Error('실패한 카탈로그 상세 자료는 null이어야 합니다.');return true;}
 const g=row?.geodetic;
 if(!g||g.ellipsoid!=='WGS84'||!Number.isFinite(g.latitude_deg)||Math.abs(g.latitude_deg)>90||!Number.isFinite(g.longitude_deg)||Math.abs(g.longitude_deg)>180||!Number.isFinite(g.ellipsoid_height_m)||g.ellipsoid_height_m<0||!Number.isFinite(row.teme_speed_km_s)||row.teme_speed_km_s<0)throw Error('카탈로그 상세 좌표·속력 오류');
 return true;
}
export function projectCatalogDetails(meta,row=meta){
 if(!validateCatalogDetails(meta,row))return {details_version:undefined,details_profile:undefined,details_units:undefined,geodetic:null,teme_speed_km_s:null,details_utc:null};
 return {details_version:meta.details_version,details_profile:meta.details_profile,details_units:structuredClone(meta.details_units),geodetic:structuredClone(row.geodetic),teme_speed_km_s:row.teme_speed_km_s,details_utc:row.utc};
}
