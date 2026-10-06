import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeTrackBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),hash='a'.repeat(64);
const period=95.651;
function fixture(center='2026-10-04T22:01:12.000900000Z'){
 const node={schema:1,id:'N-1',catalog_number:900001,orbit:{altitude_km:550,inclination:53,epoch:'2026-10-04T00:00:00Z'}};
 const request={request_id:'track-1',nodes:[node],center_utc:center};
 // Independent source Date TimeClip grid: keep sub-ms center until each timestamp truncates.
 const millis=Date.parse(center.slice(0,19)+'Z')+Number('0.'+center.split('.')[1].slice(0,-1))*1000;
 const rows=Array.from({length:121},(_,i)=>({utc:codec.advance(new Date(Math.trunc(millis+(i-60)*period*60000/120)).toISOString(),0),status:'valid',error_code:null,position_m:[i,2,3],inertial_velocity_km_s:[1,2,3],raan_deg:1,argp_deg:2,mean_anomaly_deg:3,sunlit:true,longitude_deg:4,latitude_deg:5,height_km:550}));
 const response={schema_version:1,request_id:request.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:[{node_id:node.id,definition_hash:hash,period_minutes:period,path_visible:true,rows}]};
 return {request,response};
}
const options={periodFor:()=>period};
test('source121 vertices use final TimeClip and return defensive native metre vectors',()=>{
 const f=fixture(),buffer=createNodeTrackBuffer(f.request,f.response,options),path=buffer.pathFor(f.request.nodes[0]);
 assert.equal(path.visible,true);assert.equal(path.positions_m.length,121);assert.deepEqual(path.positions_m[120],[120,2,3]);
 path.positions_m[0][0]=999;f.response.nodes[0].rows[1].position_m[0]=999;
 assert.deepEqual(buffer.pathFor(f.request.nodes[0]).positions_m[0],[0,2,3]);assert.deepEqual(buffer.pathFor(f.request.nodes[0]).positions_m[1],[1,2,3]);
 const changed=structuredClone(f.request.nodes[0]);changed.orbit.altitude_km++;assert.equal(buffer.pathFor(changed),null);
});
test('one missing native vertex hides the entire path with its original error',()=>{
 const f=fixture(),row=f.response.nodes[0].rows[60];for(const k of Object.keys(row))if(!['utc','status','error_code'].includes(k))row[k]=null;
 Object.assign(row,{status:'error',error_code:'native_failure'});f.response.status='partial';f.response.nodes[0].path_visible=false;
 const path=createNodeTrackBuffer(f.request,f.response,options).pathFor(f.request.nodes[0]);assert.equal(path.visible,false);assert.deepEqual(path.positions_m,[]);assert.deepEqual(path.errors,[{utc:row.utc,error_code:'native_failure'}]);
 f.response.nodes[0].path_visible=true;assert.throws(()=>createNodeTrackBuffer(f.request,f.response,options));
});
test('malformed period grid hash identity aggregate and payloads are rejected',()=>{
 for(const mutate of [f=>f.response.nodes[0].period_minutes++,f=>f.response.nodes[0].rows.pop(),f=>f.response.nodes[0].rows[0].utc=f.response.nodes[0].rows[1].utc,f=>f.response.nodes[0].rows[0].position_m=[NaN,0,0],f=>f.response.status='partial',f=>f.response.frame='ITRF',f=>f.response.nodes[0].node_id='wrong']){
  const f=fixture();mutate(f);assert.throws(()=>createNodeTrackBuffer(f.request,f.response,options));
 }
 const f=fixture();assert.throws(()=>createNodeTrackBuffer(f.request,f.response,{...options,expectedHashes:{'N-1':'b'.repeat(64)}}));
 assert.throws(()=>createNodeTrackBuffer(f.request,f.response,{periodFor:()=>NaN}));
});
test('unsupported leap center fails explicitly instead of collapsing to next second',()=>{
 const f=fixture();f.request.center_utc='2016-12-31T23:59:60Z';assert.throws(()=>createNodeTrackBuffer(f.request,f.response,options),/unsupported_node_time/);
});
test('submillisecond center survives until each fractional-period offset is truncated',()=>{
 const f=fixture(),first=f.response.nodes[0].rows[1].utc;
 const prematurelyClipped=codec.advance(new Date(Math.trunc(Date.parse(f.request.center_utc)+(1-60)*period*60000/120)).toISOString(),0);
 assert.notEqual(first,prematurelyClipped);assert.equal(createNodeTrackBuffer(f.request,f.response,options).pathFor(f.request.nodes[0]).visible,true);
});
test('all240 source nodes retain121 native vertices independently and enforce request limits',()=>{
 const f=fixture(),node=f.request.nodes[0],result=f.response.nodes[0];
 f.request.nodes=Array.from({length:240},(_,i)=>({...structuredClone(node),id:i?'N-'+i:'__proto__',catalog_number:900001+i}));
 f.response.nodes=f.request.nodes.map(n=>({...structuredClone(result),node_id:n.id}));
 const buffer=createNodeTrackBuffer(f.request,f.response,options);
 assert.equal(buffer.nodeIds().length,240);assert.equal(buffer.pathFor(f.request.nodes[239]).positions_m.length,121);assert.equal(Object.hasOwn(buffer.definitionHashes(),'__proto__'),true);
 for(const mutate of [r=>r.nodes=[],r=>r.nodes.push({...node,id:'overflow',catalog_number:901000}),r=>r.center_utc='2026-02-30T00:00:00Z',r=>r.request_id='']){const r=structuredClone(f.request);mutate(r);assert.throws(()=>createNodeTrackBuffer(r,f.response,options));}
});
test('all failed vertices retain121 aligned errors and reject nonnull failure geometry',()=>{
 const f=fixture();f.response.status='error';f.response.nodes[0].path_visible=false;
 for(const row of f.response.nodes[0].rows){for(const k of Object.keys(row))if(!['utc','status','error_code'].includes(k))row[k]=null;row.status='error';row.error_code='invalid_node_orbit';}
 assert.equal(createNodeTrackBuffer(f.request,f.response,options).pathFor(f.request.nodes[0]).errors.length,121);
 f.response.nodes[0].rows[0].height_km=0;assert.throws(()=>createNodeTrackBuffer(f.request,f.response,options));
});

test('readonly revision identities remain stable per node and change only with a new accepted buffer',()=>{
 const f=fixture(),buffer=createNodeTrackBuffer(f.request,f.response,options),node=f.request.nodes[0];const token=buffer.pathRevisionFor(node);
 assert.ok(token&&Object.isFrozen(token));assert.equal(buffer.pathRevisionFor(structuredClone(node)),token);assert.deepEqual(Object.keys(token),[]);
 const changed=structuredClone(node);changed.name='edited';assert.equal(buffer.pathRevisionFor(changed),null);
 buffer.pathFor(node).positions_m[0][0]=999;assert.equal(buffer.pathRevisionFor(node),token);assert.equal(buffer.pathFor(node).positions_m[0][0],0);
 const newer=createNodeTrackBuffer(f.request,f.response,options);assert.notEqual(newer.pathRevisionFor(node),token);assert.equal(buffer.pathRevisionFor(null),null);
});
