import {readFile} from 'node:fs/promises';
import {createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createNodeLinkResolver} from '../../../user_application/web/scripts/nodes/links.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createMissionConstraints} from '../../../digital_twin/simulation/browser/mission_constraints.js';
import {createMissionWindowRecords} from '../../../user_application/web/scripts/missions/window_records.js';
import {NODE_COMMUNICATION_METADATA as metadata} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {createNativeMissionRequestBuilder} from '../../../user_application/web/scripts/missions/mission_request.js';
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'EQ-1'}),types=createMissionTypes(library);
const codec=createUtcCodec(LEAP_SHA256),hash='a'.repeat(64);
function setup({requestWindows,verifyContext=()=>true}={}){
 const utc='2020-07-12T21:16:01.000416000Z';
 const node={id:'N-1',name:'one',mode:'nominal',bus:'small',orbit:{altitude_km:550},power:{generation_w:200,bus_w:100,battery_wh:300},equipment:[{id:'RF',catalog:'s_band_ttc',enabled:true},{id:'CAM',catalog:'eo_camera',enabled:true}]};
 const context={utc,nodes:[node],stations:[{id:'GS-1',name:'site',latitude:36.35,longitude:127.38,altitude_km:0.07,min_elevation_deg:10,bands:['S']}],missions:[],faults:[],deployment:{revision:1},settings:{endpoint:'/api/orchestration'},module:{instance:'module-1'}};
 const mission={id:'M-1',name:'test mission',kind:'compute',priority:1,window_start:utc,deadline:codec.advance(utc,3600),params:{input_mb:10,output_ratio:0.1},exclude:[]};
 let lastQuery=null;let pairs=[];
 const optical={async update(){return {...metadata,schema_version:1,status:'valid',utc:context.utc,node_definitions:structuredClone(context.nodes),definition_hashes:Object.fromEntries(context.nodes.map(n=>[n.id,hash])),pairs:structuredClone(pairs)};},verifyLinkSnapshot:()=>true};
 function bundle(q){
  const coverage={start_utc:q.start_utc,end_utc:q.end_utc,resolution_seconds:30,peak_bracket_seconds:0.1,boundary_bracket_seconds:1,short_intervals_may_be_missed:true};
  const hashes=Object.fromEntries(q.nodes.map(n=>[n.id,hash]));const base={...metadata,schema_version:1,status:'sampled',definition_hashes:hashes};const eclipseBase={...base};delete eclipseBase.schema_version;
  const contact={...base,site:q.sites[0].ground_point,minimum_elevation_deg:10,coverage,passes:[{id:'pass|N-1|'+q.start_utc,satellite:'N-1',start:q.start_utc,end:q.end_utc,peak:codec.advance(q.start_utc,3600),max_elevation_deg:40,duration_seconds:7200,in_progress:true,truncated:true}]};
  return {schema_version:1,status:'sampled',request_id:q.request_id,node_definitions:structuredClone(q.nodes),definition_hashes:hashes,conditions:{sites:q.sites,target:q.target,external:q.external,max_external_range_km:q.max_external_range_km,start_utc:q.start_utc,end_utc:q.end_utc},communication_status:'unknown',contact_reports:[{station_id:'GS-1',geometry:contact}],eclipse_report:{...eclipseBase,coverage:{start_utc:q.start_utc,end_utc:q.end_utc,resolution_seconds:60,boundary_tolerance_seconds:1,short_intervals_may_be_missed:true},windows:[]},target_report:q.target?{...contact,site:q.target.ground_point,minimum_elevation_deg:null,off_nadir_degrees:q.target.off_nadir_degrees,passes:[]}:null,external_report:null};
 }
 const builder=createNativeMissionRequestBuilder({missionTypes:types,constraints:createMissionConstraints({timeOf:types.timeOf}),windowRecords:createMissionWindowRecords({groundLinkModel:createGroundLinkModel({library,stationModel}),missionTypes:types}),optical,readContext:()=>context,verifyContext,advanceUtc:codec.advance,differenceUtc:codec.difference,requestWindows:async(q,opts)=>{lastQuery=structuredClone(q);return requestWindows?requestWindows(q,opts,bundle):bundle(q);}});
 return {builder,context,mission,optical,bundle,query:()=>lastQuery,setPairs:value=>pairs=value};
}
test('source OR-01 shape uses native contacts, precise common UTC and detached evidence',async()=>{
 const s=setup(),before=structuredClone(s.context);const result=await s.builder.build(s.mission,{requestId:'REQ-1',exclude:['N-X','N-X']});
 assert.equal(result.request.time,s.context.utc);assert.equal(result.request.horizon.end,codec.advance(s.context.utc,7200));
 assert.equal(result.request.windows.contacts[0].rate_mbps,2);assert.equal(result.request.windows.contacts[0].uplink_mbps,0.5);
 assert.deepEqual(result.request.exclude,['N-X']);assert.deepEqual(result.request.mesh,{});assert.equal(result.evidence.communication_status,'unknown');
 assert.deepEqual(s.context,before);result.context.nodes[0].name='changed';assert.equal(s.context.nodes[0].name,'one');
});
test('original faults filter source stations and locked mesh, preserving total locked count',async()=>{
 const s=setup();s.context.nodes.push({...structuredClone(s.context.nodes[0]),id:'N-2'});s.setPairs([{key:'PAIR',a:'N-1',b:'N-2',state:'locked'}]);s.context.faults=[{kind:'link_loss',target:'GS-1'},{kind:'link_loss',target:'PAIR'}];
 const r=await s.builder.build(s.mission,{requestId:'REQ'});assert.deepEqual(r.request.stations,[]);assert.deepEqual(r.request.windows.contacts,[]);assert.deepEqual(r.request.horizon.faulted_stations,['GS-1']);assert.deepEqual(r.request.mesh,{});assert.equal(r.request.horizon.locked_links,1);assert.deepEqual(r.request.horizon.faulted_links,['PAIR']);
});
for(const field of ['utc','stations','faults','deployment','settings','module','missions','nodes'])test('context change during native await rejects '+field,async()=>{
 const s=setup({requestWindows:(q,o,b)=>{if(field==='utc')s.context.utc=codec.advance(s.context.utc,1);else if(Array.isArray(s.context[field]))s.context[field].push({id:'changed'});else s.context[field].changed=true;return b(q);}});
 await assert.rejects(s.builder.build(s.mission,{requestId:'REQ'}),/context changed/);
});
for(const mutate of [b=>b.request_id='other',b=>b.definition_hashes['N-1']='b'.repeat(64),b=>b.node_definitions[0].name='other',b=>b.conditions.sites[0].ground_point.ellipsoid_height_m=0,b=>b.eclipse_report.frame='ITRF',b=>b.contact_reports[0].geometry.definition_hashes.other=hash,b=>b.contact_reports[0].geometry.passes[0].satellite='other',b=>b.eclipse_report.windows.push({id:'x',satellite:'other',start:b.conditions.start_utc,end:b.conditions.end_utc,in_progress:true,truncated:true}),b=>b.eclipse_report.coverage.resolution_seconds=1])test('malformed complete bundle is rejected '+mutate.toString(),async()=>{
 const s=setup({requestWindows:(q,o,f)=>{const b=structuredClone(f(q));mutate(b);return b;}});await assert.rejects(s.builder.build(s.mission,{requestId:'REQ'}));
});
test('abort, unavailable optical and authority failure never return source windows',async()=>{
 const s=setup(),controller=new AbortController();controller.abort();await assert.rejects(s.builder.build(s.mission,{requestId:'REQ',signal:controller.signal}),{name:'AbortError'});
 s.optical.verifyLinkSnapshot=()=>false;await assert.rejects(s.builder.build(s.mission,{requestId:'REQ'}),/optical/);
 const denied=setup({verifyContext:()=>false});await assert.rejects(denied.builder.build(denied.mission,{requestId:'REQ'}),/context/);assert.equal(denied.query(),null);
});
test('observe requests native target but source camera capability determines projected records',async()=>{
 const s=setup();s.mission.kind='observe';s.mission.params={latitude:36.35,longitude:127.38,max_off_nadir_deg:45,product_mb:10};
 const r=await s.builder.build(s.mission,{requestId:'REQ'});assert.equal(s.query().target.off_nadir_degrees,45);assert.equal(r.request.mission.params.processing,true);assert.deepEqual(r.request.windows.target_access,[]);
});
test('pickup requires explicit catalog GP identity rather than private satellite.js fallback',async()=>{
 const s=setup();s.mission.kind='pickup';s.mission.params={external_id:'25544',volume_mb:10,crosslink_rate_mbps:100,max_range_km:2000};
 await assert.rejects(s.builder.build(s.mission,{requestId:'REQ'}),/external/);assert.equal(s.query(),null);
});

test('locked native mesh and other accepted-task projection retain source semantics',async()=>{
 const s=setup();s.context.nodes.push({...structuredClone(s.context.nodes[0]),id:'N-2'});s.setPairs([{key:'PAIR',a:'N-1',b:'N-2',state:'locked'}]);
 const task={id:'held',satellite:'N-1',start:s.context.utc,end:codec.advance(s.context.utc,30)};
 s.context.missions=[{id:'M-OTHER',status:'committed',plan:{tasks:[task]}},{id:'M-1',status:'committed',plan:{tasks:[task]}}];
 const r=await s.builder.build(s.mission,{requestId:'REQ'});assert.deepEqual(r.request.mesh,{'N-1':['N-2'],'N-2':['N-1']});assert.equal(r.request.satellites[0].busy.length,1);assert.equal(r.request.satellites[0].busy[0].mission_id,'M-OTHER');
});
test('mission edits, disposal and abort after await invalidate results',async()=>{
 for(const change of ['mission','dispose','abort']){
  const controller=new AbortController();const s=setup({requestWindows:(q,o,f)=>{if(change==='mission')s.mission.params.input_mb=20;else if(change==='dispose')s.builder.destroy();else controller.abort();return f(q);}});
  await assert.rejects(s.builder.build(s.mission,{requestId:'REQ',signal:controller.signal}));
 }
});

const native=JSON.parse(await readFile(new URL('../fixtures/native_mission_request.json',import.meta.url),'utf8'));
test('installed native bundle joins real source optical owner and source OR-01 projection',async()=>{
 const context=structuredClone(native.context),mission=structuredClone(native.mission),before=structuredClone(context);
 const buffers=new Map(native.optical_receipts.map(r=>[r.request.start_utc,createNodeSampleBuffer(r.request,r.reply)]));
 const calls=[];
 const optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),readNodes:()=>context.nodes,readDisplay:()=>({utc:context.utc}),advanceUtc:codec.advance,requestCommunicationStates:async utc=>{
  calls.push(utc);const buffer=buffers.get(utc);assert.ok(buffer,'captured exact native priming UTC required');
  return {utc,node_definitions:structuredClone(context.nodes),states:context.nodes.map(n=>[n.id,buffer.communicationStateFor(n,{utc})])};
 }});
 let query=null;
 const primed=await optical.update();assert.equal(primed.status,'valid',JSON.stringify(primed));
 const builder=createNativeMissionRequestBuilder({missionTypes:types,constraints:createMissionConstraints({timeOf:types.timeOf}),windowRecords:createMissionWindowRecords({groundLinkModel:createGroundLinkModel({library,stationModel}),missionTypes:types}),optical,readContext:()=>context,verifyContext:c=>assert.deepEqual(c,before)===undefined,advanceUtc:codec.advance,differenceUtc:codec.difference,requestWindows:async q=>{query=q;return structuredClone(native.bundle);}});
 const result=await builder.build(mission,{requestId:native.bundle.request_id});
 assert.deepEqual(query.nodes,context.nodes);assert.equal(calls.length,3);assert.equal(result.request.windows.contacts.length,1);assert.equal(result.request.windows.eclipses.length,3);assert.equal(result.request.satellites.length,2);assert.equal(result.request.time,context.utc);assert.deepEqual(result.evidence.definition_hashes,optical.snapshot().definition_hashes);assert.deepEqual(context,before);
 // Verify the existing owner revokes this receipt on a complete definition edit.
 context.nodes[0].name='edited';await assert.rejects(builder.build(mission,{requestId:'changed'}),/context|AssertionError/);
 builder.destroy();optical.destroy();
});

test('pickup binds precise external identity and retains engineering provenance beside source windows',async()=>{
 const external={group:'active',catalog_number:25544,normalized_gp_sha256:'b'.repeat(64),eop_sha256:'c'.repeat(64),leap_sha256:'d'.repeat(64),profile:'WGS72_AFSPC'};
 const s=setup({requestWindows:(q,o,f)=>{
  const b=f(q);b.external_report={...metadata,schema_version:1,status:'sampled',definition_hashes:b.definition_hashes,external:{...q.external,source:'celestrak-cache',fetched_at:'2020-07-12T00:00:00Z',warning:'',stale:false,epoch_utc:q.start_utc,name:'fixture',frame:'ITRF',eop_kind:'IERS_A',eop_qualities:[{ut1:'final_b',polar_motion:'final_b'}]},comparison_frame:'WGS84_GEODETIC_EARTH_FIXED_APPROX',max_range_km:q.max_external_range_km,los_margin_km:100,coverage:{start_utc:q.start_utc,end_utc:q.end_utc,resolution_seconds:30,boundary_tolerance_seconds:1,range_resolution_seconds:10,minimum_range_is_sampled:true,short_intervals_may_be_missed:true,exact_end_included:true},windows:[{id:'crosslink|N-1|25544|'+q.start_utc,satellite:'N-1',external:'25544',start:q.start_utc,end:q.end_utc,min_range_km:10,in_progress:true,truncated:true}]};return b;
 }});
 s.context.external=external;s.mission.kind='pickup';s.mission.params={external_id:'25544',volume_mb:10,crosslink_rate_mbps:100,max_range_km:2000};
 const r=await s.builder.build(s.mission,{requestId:'REQ'});assert.equal(r.request.windows.crosslinks.length,1);assert.equal(r.evidence.external_report.external.frame,'ITRF');assert.equal(r.evidence.external_report.comparison_frame,'WGS84_GEODETIC_EARTH_FIXED_APPROX');
});
