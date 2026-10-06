import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSampleBuffer} from '../../../user_application/web/scripts/orbit_playback.js';
import {createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),H='a'.repeat(64);
const definition=id=>({schema:1,id,catalog_number:900001+Number(id.slice(2)),name:id,orbit:{epoch:1791151272000,altitude_km:550,eccentricity:0,inclination:53,raan:1,argp:2,mean_anomaly:3}});
function fixture({count=3,startUtc=start,ids=['N-0']}={}){
  const request={request_id:'sample-test',nodes:ids.map(definition),start_utc:startUtc,count,step_seconds:1};
  const response={schema_version:1,request_id:request.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:request.nodes.map((node,n)=>({node_id:node.id,definition_hash:H,rows:Array.from({length:count},(_,i)=>({utc:codec.advance(startUtc,i),status:'valid',error_code:null,position_m:[7000000+i,n*1000,0],inertial_velocity_km_s:[0,7.5+i*.1,0],raan_deg:i===0?359:1,argp_deg:10+i,mean_anomaly_deg:i===0?359:1,sunlit:i===0,longitude_deg:i===0?179:-179,latitude_deg:10+i,height_km:550+i}))}))};
  return {request,response};
}
test('native node buffer preserves exact samples, definitions, metadata, units and ownership copies',()=>{
  const f=fixture(),buffer=createNodeSampleBuffer(f.request,f.response),node=structuredClone(f.request.nodes[0]);
  const value=buffer.geometryFor(node,{utc:start});assert.deepEqual(value.row,f.response.nodes[0].rows[0]);assert.equal(value.frame,f.response.frame);assert.equal(value.definition_hash,H);assert.deepEqual(value.node_definition,node);
  value.row.position_m[0]=0;value.node_definition.name='changed';f.response.nodes[0].rows[0].position_m[0]=0;f.request.nodes[0].name='foreign';
  assert.equal(buffer.geometryFor(node,{utc:start}).row.position_m[0],7000000);assert.equal(buffer.geometryFor(node,{utc:start}).node_definition.name,'N-0');
});
test('fractional UTC reuses linear native position/velocity interpolation and wraps angle/longitude without orbital propagation',()=>{
  const {request,response}=fixture(),buffer=createNodeSampleBuffer(request,response),utc=codec.advance(start,.5),v=buffer.geometryFor(request.nodes[0],{utc});
  assert.deepEqual(v.row.position_m,[7000000.5,0,0]);assert.deepEqual(v.row.inertial_velocity_km_s,[0,7.55,0]);assert.equal(v.row.raan_deg,0);assert.equal(v.row.mean_anomaly_deg,0);assert.equal(v.row.longitude_deg,-180);assert.equal(v.row.sunlit,true);assert.equal(v.row.latitude_deg,10.5);assert.equal(v.observation_utc,start);assert.equal(v.interpolated,true);
});
test('rows cannot extrapolate, mix identities/definitions, collapse noncanonical UTC or invent missing nodes',()=>{
  const f=fixture({ids:['N-0','N-1']}),buffer=createNodeSampleBuffer(f.request,f.response);
  for(const utc of [codec.advance(start,-.001),codec.advance(start,2.001),'2026-10-04T22:01:12Z','invalid'])assert.equal(buffer.geometryFor(f.request.nodes[0],{utc}),null);
  assert.equal(buffer.geometryFor({...f.request.nodes[0],name:'new definition'},{utc:start}),null);assert.equal(buffer.geometryFor(definition('N-2'),{utc:start}),null);
  assert.equal(buffer.geometryFor(f.request.nodes[1],{utc:start}).row.position_m[1],1000);
});
test('bad metadata, request/hash alignment, count/order/UTC, nonfinite fields and statuses reject the whole receipt',()=>{
  const changes=[r=>r.frame='ITRF',r=>r.request_id='other',r=>r.quality='measured',r=>r.model_profile='SGP4',r=>r.nodes[0].node_id='other',r=>r.nodes[0].definition_hash='bad',r=>r.nodes[0].rows.pop(),r=>r.nodes[0].rows[1].utc=start,r=>r.nodes[0].rows[0].position_m[0]=Infinity,r=>r.nodes[0].rows[0].inertial_velocity_km_s=[1,2],r=>r.nodes[0].rows[0].sunlit=1,r=>r.nodes[0].rows[0].raan_deg=null,r=>r.status='partial'];
  for(const change of changes){const f=fixture();change(f.response);assert.throws(()=>createNodeSampleBuffer(f.request,f.response));}
  const f=fixture();assert.throws(()=>createNodeSampleBuffer(f.request,f.response,{expectedHashes:{'N-0':'b'.repeat(64)}}));
});
test('aligned native errors remain visible as errors and neither side interpolates across a gap',()=>{
  const f=fixture(),row=f.response.nodes[0].rows[1];for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='unsupported_node_time';f.response.status='partial';
  const buffer=createNodeSampleBuffer(f.request,f.response);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:row.utc}).row.error_code,'unsupported_node_time');
  for(const elapsed of [.5,1.5])assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:codec.advance(start,elapsed)}),null);
  row.position_m=[1,2,3];assert.throws(()=>createNodeSampleBuffer(f.request,f.response));
});
test('existing SI/UTC leap codec retains the unsupported native leap row instead of joining across it',()=>{
  const leap=codec.advance('2016-12-31T23:59:59Z',0),f=fixture({startUtc:leap}),row=f.response.nodes[0].rows[1];for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='unsupported_node_time';f.response.status='partial';
  const buffer=createNodeSampleBuffer(f.request,f.response);assert.match(row.utc,/:60\./);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:row.utc}).row.status,'error');assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:codec.advance(leap,.5)}),null);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:codec.advance(leap,2)}).row.status,'valid');
});
test('all 240 nodes and 601 native samples are retained without truncation or requests during lookup',()=>{
  const f=fixture({count:601,ids:Array.from({length:240},(_,i)=>`N-${i}`)}),buffer=createNodeSampleBuffer(f.request,f.response);
  const last=buffer.geometryFor(f.request.nodes[239],{utc:codec.advance(start,600)});assert.equal(last.row.position_m[1],239000);assert.equal(last.node_id,'N-239');assert.equal(buffer.nodeIds().length,240);
});
test('original twenty source states survive named native wire mapping and readonly buffer lookup unchanged',async()=>{
  const source=JSON.parse(await readFile(new URL('../fixtures/original_satellite_nodes.json',import.meta.url),'utf8'));let count=0;
  for(const c of source.cases.filter(c=>c.id.startsWith('state:'))){
    const utc=codec.advance(new Date(c.input.millis).toISOString(),0),f=fixture({count:1,startUtc:utc});f.request.nodes[0].orbit=c.input.orbit;
    const value=c.expected,row=f.response.nodes[0].rows[0];Object.assign(row,{position_m:value.fixed.r.map(v=>v*1000),inertial_velocity_km_s:value.inertial.v,raan_deg:value.raan,argp_deg:value.argp,mean_anomaly_deg:value.meanAnomaly,longitude_deg:value.geodetic.longitude,latitude_deg:value.geodetic.latitude,height_km:value.geodetic.altitude,sunlit:value.sunlit});
    const buffer=createNodeSampleBuffer(f.request,f.response),actual=buffer.geometryFor(f.request.nodes[0],{utc});assert.deepEqual(actual.row,row,c.id);assert.equal(actual.interpolated,false);count++;
  }assert.equal(count,20);
});
test('shared interpolation extension isolates callback inputs/outputs and preserves its existing default shape',()=>{
  const rows=[0,1].map(i=>({utc:codec.advance(start,i),status:'valid',position_m:[i,0,0],elevation_deg:i}));let captured;
  const buffer=createSampleBuffer(rows,codec.difference,{interpolateFields:(a,b)=>{a.position_m[0]=999;captured={extra:[1,2,3]};return captured;}});
  const value=buffer.sampleAt(codec.advance(start,.5));assert.deepEqual(value.position_m,[.5,0,0]);captured.extra[0]=99;assert.deepEqual(value.extra,[1,2,3]);assert.deepEqual(buffer.sampleAt(start).position_m,[0,0,0]);
  const base=createSampleBuffer(rows,codec.difference).sampleAt(codec.advance(start,.5));assert.deepEqual(base,{utc:codec.advance(start,.5),status:'valid',error_code:null,position_m:[.5,0,0],elevation_deg:.5});
});
test('invalid captured definitions, duplicate catalogs and malformed top scope never create a node buffer',()=>{
  for(const change of [r=>r.nodes[0].orbit=true,r=>r.nodes[0].orbit.epoch=null,r=>r.nodes[0].orbit.altitude_km='550',r=>r.nodes[0].schema=2,r=>r.nodes[0].catalog_number=1,r=>r.count=0,r=>r.step_seconds=2,r=>r.nodes[0].name=NaN]){const f=fixture();change(f.request);assert.throws(()=>createNodeSampleBuffer(f.request,f.response));}
  const f=fixture({ids:['N-0','N-1']});f.request.nodes[1].catalog_number=f.request.nodes[0].catalog_number;assert.throws(()=>createNodeSampleBuffer(f.request,f.response));
});
test('valid source IDs that match object prototype names are fenced by own hash entries',()=>{
  const f=fixture();f.request.nodes[0].id='__proto__';f.response.nodes[0].node_id='__proto__';
  const buffer=createNodeSampleBuffer(f.request,f.response);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:start}).definition_hash,H);
  assert.equal(Object.hasOwn(buffer.definitionHashes(),'__proto__'),true);
});
test('source Gregorian definition epochs are independent of the frozen display leap-table domain',()=>{
  for(const epoch of ['1970-01-01T00:00:00Z','1969-12-31T23:59:59.123456789+00:00','2026-10-04T00:00:00+00:00']){
    const f=fixture();f.request.nodes[0].orbit.epoch=epoch;const buffer=createNodeSampleBuffer(f.request,f.response);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:start}).node_definition.orbit.epoch,epoch);
  }
  for(const epoch of ['0000-01-01T00:00:00Z','2026-02-30T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:60Z']){const f=fixture();f.request.nodes[0].orbit.epoch=epoch;assert.throws(()=>createNodeSampleBuffer(f.request,f.response));}
});
test('valid leap epoch retains aligned native errors while malformed leap epoch is rejected',()=>{
  const f=fixture();f.request.nodes[0].orbit.epoch='2016-12-31T23:59:60+00:00';f.response.status='error';
  for(const row of f.response.nodes[0].rows){for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='unsupported_node_time';}
  const buffer=createNodeSampleBuffer(f.request,f.response);assert.equal(buffer.geometryFor(f.request.nodes[0],{utc:start}).row.error_code,'unsupported_node_time');
  f.request.nodes[0].orbit.epoch='2016-12-30T23:59:60Z';assert.throws(()=>createNodeSampleBuffer(f.request,f.response));
});
test('custom validity predicates receive readonly captured rows and cannot leak mutable buffer state',()=>{
  const rows=[0,1].map(i=>({utc:codec.advance(start,i),status:'valid',position_m:[i,0,0],elevation_deg:i}));let captured;
  const buffer=createSampleBuffer(rows,codec.difference,{isValid:row=>{captured=row;return row.status==='valid';}});
  buffer.sampleAt(start);assert.throws(()=>{captured.position_m[0]=999;},TypeError);assert.equal(buffer.sampleAt(start).position_m[0],0);
});

test('immutable native rows reuse their complete validation while mutable outputs and replacement buffers remain independent',()=>{
 const f=fixture(),node=structuredClone(f.request.nodes[0]),buffer=createNodeSampleBuffer(f.request,f.response);
 const measure=fn=>{const finite=Number.isFinite;let count=0;Number.isFinite=value=>{count++;return finite(value);};try{const result=fn();return {result,count};}finally{Number.isFinite=finite;}};
 const first=measure(()=>buffer.geometryFor(node,{utc:start})),again=measure(()=>buffer.geometryFor(node,{utc:start}));
 assert.deepEqual(again.result,first.result);assert.ok(again.count<first.count,'a previously validated immutable sample must not repeat all field checks');
 again.result.row.position_m[0]=NaN;again.result.row.inertial_velocity_km_s[0]=Infinity;again.result.node_definition.orbit.altitude_km=NaN;
 assert.deepEqual(buffer.geometryFor(node,{utc:start}),first.result);assert.equal(buffer.geometryFor({...node,orbit:{...node.orbit,altitude_km:NaN}},{utc:start}),null);
 f.response.nodes[0].rows[0].position_m[0]+=1000;f.response.nodes[0].definition_hash='b'.repeat(64);
 const replacement=createNodeSampleBuffer(f.request,f.response),cold=measure(()=>replacement.geometryFor(node,{utc:start})),warm=measure(()=>replacement.geometryFor(node,{utc:start}));
 assert.ok(warm.count<cold.count);assert.equal(cold.result.row.position_m[0],first.result.row.position_m[0]+1000);assert.equal(cold.result.definition_hash,'b'.repeat(64));assert.deepEqual(buffer.geometryFor(node,{utc:start}),first.result);
 f.response.nodes[0].rows[0].position_m[0]=NaN;assert.throws(()=>createNodeSampleBuffer(f.request,f.response),/success row/);
});

test('native row validation memo cannot approve nonfinite interpolation or mutate nested captured data',()=>{
 const f=fixture();f.response.nodes[0].rows[0].position_m[0]=Number.MAX_VALUE;f.response.nodes[0].rows[1].position_m[0]=-Number.MAX_VALUE;
 const buffer=createNodeSampleBuffer(f.request,f.response),node=f.request.nodes[0];assert.ok(buffer.geometryFor(node,{utc:start}));assert.ok(buffer.geometryFor(node,{utc:codec.advance(start,1)}));
 assert.equal(buffer.geometryFor(node,{utc:codec.advance(start,.5)}),null,'mutable interpolated output must still receive the complete finite-vector validation');
 const rows=[{utc:start,status:'valid',position_m:[1,2,3],inertial_velocity_km_s:[0,7,0],extra:{power:{samples:[1,2]},basis:{x:[1,0,0]}}}];let captured;
 const owned=createSampleBuffer(rows,codec.difference,{isValid:row=>{captured=row;return true;}});owned.sampleAt(start);
 for(const value of [captured,captured.position_m,captured.inertial_velocity_km_s,captured.extra,captured.extra.power,captured.extra.power.samples,captured.extra.basis,captured.extra.basis.x])assert.equal(Object.isFrozen(value),true);
 assert.throws(()=>{captured.extra.power.samples[0]=999;},TypeError);assert.equal(owned.sampleAt(start).extra.power.samples[0],1);
});

test('native display projections are privately registered deeply readonly exact packets with a two-UTC cache',()=>{
 const f=fixture(),buffer=createNodeSampleBuffer(f.request,f.response),port=buffer.displayGeometry,node=f.request.nodes[0];
 assert.ok(port);const view=port.viewFor(node);assert.ok(view);assert.equal(port.isCurrent(view),true);assert.equal(view.receipt_revision,port.revision());
 assert.equal(port.isCurrent(Object.freeze({...view})),false);assert.equal(port.viewFor({...node,name:'changed'}),null);
 const first=port.sampleAt(view,start);assert.deepEqual(first,buffer.geometryFor(node,{utc:start}));assert.equal(port.sampleAt(view,start),first);assert.equal(port.verifySample(view,first,start),true);assert.equal(port.verifySample(view,structuredClone(first),start),false);
 for(const value of [view,view.node_definition,view.node_definition.orbit,first,first.row,first.row.position_m,first.row.inertial_velocity_km_s])assert.equal(Object.isFrozen(value),true);
 assert.throws(()=>{first.row.position_m[0]=0;},TypeError);assert.throws(()=>{view.node_definition.orbit.altitude_km=0;},TypeError);
 assert.equal(port.sampleAt(view,codec.advance(start,-1)),null);assert.equal(port.sampleAt(view,'2026-10-04T22:01:12Z'),null);
 const middle=port.sampleAt(view,codec.advance(start,1)),last=port.sampleAt(view,codec.advance(start,2));assert.ok(middle);assert.ok(last);assert.notEqual(port.sampleAt(view,start),first,'third exact UTC evicts the earliest strong cached packet');assert.equal(port.verifySample(view,first,start),true,'held immutable genuine packets retain their provenance after eviction');
 const copy=buffer.geometryFor(node,{utc:start});copy.row.position_m[0]=0;assert.equal(port.sampleAt(view,start).row.position_m[0],7000000);
});
