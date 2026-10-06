import test from 'node:test';import assert from 'node:assert/strict';
import {validateCatalogDetails,projectCatalogDetails} from '../../../user_application/web/scripts/orbit/catalog_details.js';
const metadata={details_version:1,details_profile:'WGS84_ERFA_GC2GD_TEME_SPEED',details_units:{latitude:'deg',longitude:'deg',ellipsoid_height:'m',teme_speed:'km/s'}};
const row={utc:'2020-07-12T21:16:01.000416000Z',status:'valid',geodetic:{latitude_deg:36,longitude_deg:127,ellipsoid_height_m:410000,ellipsoid:'WGS84'},teme_speed_km_s:7.67};
test('native details preserve supplied sample UTC and units without deriving or mutating values',()=>{
 const input=structuredClone(row),projection=projectCatalogDetails(metadata,input);assert.equal(projection.details_utc,row.utc);assert.deepEqual(projection.geodetic,row.geodetic);assert.equal(projection.teme_speed_km_s,7.67);
 projection.geodetic.latitude_deg=90;assert.equal(input.geodetic.latitude_deg,36);assert.equal(validateCatalogDetails({},{}),false);
});
test('partial or malformed details cannot masquerade as known coordinates or speed',()=>{
 for(const change of [v=>delete v.details_units,v=>v.details_version=2,v=>v.details_units.teme_speed='m/s',v=>v.geodetic.latitude_deg=91,v=>v.geodetic.ellipsoid='WGS72',v=>v.geodetic.ellipsoid_height_m=NaN,v=>v.teme_speed_km_s=null]){
  const input=structuredClone({...metadata,...row});change(input);assert.throws(()=>validateCatalogDetails(input));
 }
 assert.throws(()=>validateCatalogDetails({},row));assert.throws(()=>validateCatalogDetails(metadata,{...row,status:'error'}));
 assert.equal(validateCatalogDetails(metadata,{status:'error',geodetic:null,teme_speed_km_s:null}),true);
});
