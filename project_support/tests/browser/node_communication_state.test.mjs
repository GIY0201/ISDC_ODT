import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';

const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0);
const fixture=JSON.parse(await readFile(new URL('../fixtures/original_satellite_nodes.json',import.meta.url),'utf8'));
function data(state){
 const node={schema:1,id:'N-1',catalog_number:900001,orbit:{epoch:1791151272000,altitude_km:550,eccentricity:0,inclination:53,raan:0,argp:0,mean_anomaly:0}};
 const request={request_id:'communication',nodes:[node],start_utc:start,count:2,step_seconds:1};
 const response={schema_version:1,request_id:'communication',status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:[{node_id:'N-1',definition_hash:'a'.repeat(64),rows:[0,1].map(i=>({utc:codec.advance(start,i),status:'valid',error_code:null,position_m:state.fixed.r.map(v=>v*1000),inertial_position_km:structuredClone(state.inertial.r),inertial_velocity_km_s:structuredClone(state.inertial.v),lvlh_basis:structuredClone(state.basis),raan_deg:state.raan,argp_deg:state.argp,mean_anomaly_deg:state.meanAnomaly,sunlit:state.sunlit,longitude_deg:state.geodetic.longitude,latitude_deg:state.geodetic.latitude,height_km:state.geodetic.altitude}))}]};
 return {node,request,response};
}

test('all original source states map exact inertial vectors and axes with copies',()=>{
 const cases=fixture.cases.filter(c=>c.id.startsWith('state:'));assert.equal(cases.length,20);
 for(const c of cases){
  const f=data(c.expected),buffer=createNodeSampleBuffer(f.request,f.response),value=buffer.communicationStateFor(f.node,{utc:start});
  assert.deepEqual(value.inertial,c.expected.inertial);assert.deepEqual(value.basis,c.expected.basis);assert.deepEqual(value.geodetic,c.expected.geodetic);
  assert.equal(value.utc,start);assert.equal(value.interpolated,false);assert.equal(value.inertial_frame,'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX');
  value.inertial.r[0]=0;value.basis.x[0]=999;f.response.nodes[0].rows[0].lvlh_basis.x[0]=888;
  assert.deepEqual(buffer.communicationStateFor(f.node,{utc:start}).basis,c.expected.basis);
 }
});

test('fractional display, missing input, invalid basis, foreign definitions and out-of-range fail closed',()=>{
 const original=fixture.cases.find(c=>c.id.startsWith('state:')).expected;
 for(const mutate of [r=>delete r.lvlh_basis,r=>delete r.inertial_position_km,r=>r.lvlh_basis.x=[0,0,0],r=>r.lvlh_basis.y=r.lvlh_basis.x,r=>r.lvlh_basis.z=r.lvlh_basis.z.map(v=>-v),r=>r.inertial_position_km=[0,0,0],r=>r.lvlh_basis.x=[1,2],r=>r.lvlh_basis.x[0]=NaN]){
  const f=data(original);mutate(f.response.nodes[0].rows[0]);const buffer=createNodeSampleBuffer(f.request,f.response);
  assert.equal(buffer.communicationStateFor(f.node,{utc:start}),null);
  assert.ok(buffer.geometryFor(f.node,{utc:start}),'existing display remains independent');
 }
 const f=data(original),buffer=createNodeSampleBuffer(f.request,f.response);
 for(const utc of [codec.advance(start,.5),codec.advance(start,-1),codec.advance(start,2),'2026-10-04T22:01:12Z'])assert.equal(buffer.communicationStateFor(f.node,{utc}),null);
 assert.equal(buffer.communicationStateFor({...f.node,name:'edited'},{utc:start}),null);
 assert.ok(buffer.geometryFor(f.node,{utc:codec.advance(start,.5)}));
});

test('aligned native errors never become communication states',()=>{
 const f=data(fixture.cases.find(c=>c.id.startsWith('state:')).expected);const row=f.response.nodes[0].rows[0];
 for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;
 row.status='error';row.error_code='unsupported_node_time';f.response.status='partial';
 const buffer=createNodeSampleBuffer(f.request,f.response);assert.equal(buffer.communicationStateFor(f.node,{utc:start}),null);
 assert.ok(buffer.communicationStateFor(f.node,{utc:codec.advance(start,1)}));
});
