import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionServices} from '../../../user_application/web/scripts/missions/mission_services.js';
import {createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createNodeLinkResolver} from '../../../user_application/web/scripts/nodes/links.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {readFile} from 'node:fs/promises';
import {createMissionConstraints} from '../../../digital_twin/simulation/browser/mission_constraints.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const fixture=JSON.parse(await readFile(new URL('../fixtures/native_mission_request.json',import.meta.url)));
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'EQ'}),model=createMissionTypes(library),codec=createUtcCodec(LEAP_SHA256);
function setup(){
 const data=structuredClone(fixture),moduleStatus={exchange_contract:'guarded-v1',reachable:true,instance_id:'module',sequence:0,accepted_plans:{},accepted_decisions:{},committed:{}};
 const deployment={run_id:'run',revision:1,nodes:data.context.nodes.map(n=>({id:n.id,name:n.name,mode:n.mode,equipment:n.equipment}))};
 let nativeCalls=0,acceptCalls=0;let fail=false,accepted=null;
 const buffers=new Map(data.optical_receipts.map(r=>[r.request.start_utc,createNodeSampleBuffer(r.request,r.reply)]));
 const optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),readNodes:()=>data.context.nodes,readDisplay:()=>({utc:data.context.utc}),advanceUtc:codec.advance,requestCommunicationStates:async utc=>{const buffer=buffers.get(utc);assert.ok(buffer);return {utc,node_definitions:structuredClone(data.context.nodes),states:data.context.nodes.map(n=>[n.id,buffer.communicationStateFor(n,{utc})])};}});
 const nodes={missionInputs:()=>({nodes:data.context.nodes,utc:data.context.utc,deployment}),updateMissionLinks:()=>optical.update(),verifyMissionLinks:(...args)=>optical.verifyLinkSnapshot(...args)};
 const module={endpoint:()=>({base:'',placement:'server',source:'server'}),status:async()=>structuredClone(moduleStatus),guardedPlan:async(body,g)=>{const answer={exchange_contract:'guarded-v1',instance_id:g.instance_id,sequence:++moduleStatus.sequence,plan_sequence:moduleStatus.sequence,request_id:g.request_id,context_hash:g.context_hash,mission_id:body.mission.id,mission_version:g.mission_version,time:body.time,feasible:true,tasks:[],summary:{},checks:[],reasons:[]};moduleStatus.accepted_plans[body.mission.id]=answer;return answer;}};
 const api={nodeMissionContext:async(command)=>{acceptCalls++;accepted={schema_version:1,status:'verified_analysis_inputs',context_hash:'a'.repeat(64),nodes:command.nodes,stations:command.stations,utc:command.utc,external:command.external,faults:command.faults,deployment,definition_hashes:data.bundle.definition_hashes,module_instance:command.module_instance,module_sequence:command.module_sequence,communication_status:'unknown'};return structuredClone(accepted);},nodeMissionWindows:async(q,opts)=>{nativeCalls++;if(fail)throw Error('native unavailable');return {...data.bundle,accepted_context:structuredClone(accepted),request_id:q.request_id,conditions:{...data.bundle.conditions,start_utc:q.start_utc,end_utc:q.end_utc}};}};
 const service=createMissionServices({api,nodes,ground:{ready:true,get enabled(){return data.context.stations;}},readRuntime:()=>({active_faults:data.context.faults}),module,library,groundLinks:createGroundLinkModel({library,stationModel}),model,codec,constraints:createMissionConstraints({timeOf:model.timeOf}),storage:null,nextRequestId:(()=>{let n=0;return()=>`client:${++n}`;})()});
 return {service,data,nodes,module,api,moduleStatus,counts:()=>({nativeCalls,acceptCalls}),setFail:()=>{fail=true;}};
}
test('mission service requires real owners and preserves unknown context',()=>{
 assert.throws(()=>createMissionServices({}),/owners/);
 const s=setup();s.nodes.missionInputs=()=>{throw Error('deployment unconfirmed');};
 assert.throws(()=>s.service.context(),/unconfirmed/);s.service.destroy();
});
test('approved contacts retain original eclipse independence and reject malformed hidden contact rows',async()=>{
 const s=setup();try{s.data.bundle.eclipse_report=null;const receipt=await s.service.queryContactWindows({hours:2});assert.equal(s.service.verifyContactWindows(receipt),true);const g=receipt.contact_reports[0].geometry,row=g.passes[0];g.passes=Array.from({length:4},(_,i)=>({...row,id:'hidden-'+i}));g.passes[3].satellite='foreign';assert.equal(s.service.verifyContactWindows(receipt),false);}finally{s.service.destroy();}
});
test('approved contact service preserves24h and every enabled site with unchanged context authority',async()=>{
 const s=setup();try{
  const station={...structuredClone(s.data.context.stations[0]),id:'second-site',latitude:35};s.data.context.stations.push(station);
  const end=codec.advance(s.data.context.utc,86400),sites=s.data.context.stations.map(v=>({station_id:v.id,ground_point:{latitude_deg:v.latitude,longitude_deg:v.longitude,ellipsoid_height_m:(v.altitude_km??0)*1000},minimum_elevation_deg:v.min_elevation_deg??0}));
  const original=s.data.bundle.contact_reports[0];s.data.bundle.contact_reports=sites.map(site=>({station_id:site.station_id,geometry:{...structuredClone(original.geometry),site:site.ground_point,minimum_elevation_deg:site.minimum_elevation_deg,coverage:{...original.geometry.coverage,end_utc:end}}}));s.data.bundle.conditions.sites=sites;s.data.bundle.eclipse_report=null;
  const receipt=await s.service.queryContactWindows({hours:24});assert.equal(receipt.contact_reports.length,2);assert.equal(receipt.conditions.end_utc,end);assert.equal(s.service.verifyContactWindows(receipt),true);receipt.accepted_context.context_hash='invalid';assert.equal(s.service.verifyContactWindows(receipt),false);assert.deepEqual(s.counts(),{nativeCalls:1,acceptCalls:1});
 }finally{s.service.destroy();}
});
test('source store is loaded independently; native approval binds exact whole scope before query',async()=>{
 const s=setup();assert.equal(s.service.store.ready,true);const added=s.service.store.add(s.data.mission,{satellites:s.data.context.nodes,stations:s.data.context.stations});assert.equal(added.errors.length,0);
 // Use actual recorded optical receipt, not a fabricated link network.

 const original=s.api.nodeMissionContext;s.api.nodeMissionContext=async(c,o)=>{const a=await original(c,o);a.nodes[0].name='changed';return a;};
 await assert.rejects(s.service.execution.plan(added.mission.id),/approval scope/);assert.equal(s.counts().acceptCalls,1);assert.equal(s.counts().nativeCalls,0);s.service.destroy();
});

test('real native fixtures and optical owner reach guarded source plan via approved context',async()=>{const s=setup();const added=s.service.store.add(s.data.mission,{satellites:s.data.context.nodes,stations:s.data.context.stations});const result=await s.service.execution.plan(added.mission.id);assert.equal(result.current,true);assert.deepEqual(s.counts(),{acceptCalls:1,nativeCalls:1});assert.equal(s.service.store.selected.status,'planned');assert.equal(s.service.execution.inspection(added.mission.id).request.windows.contacts.length,1);s.service.destroy();});

test('late fault change rejects native result and retains no accepted source plan',async()=>{const s=setup();const added=s.service.store.add(s.data.mission);const calculate=s.api.nodeMissionWindows;s.api.nodeMissionWindows=async(...a)=>{const r=await calculate(...a);s.data.context.faults.push({kind:'link_loss',target:'N-1'});return r;};await assert.rejects(s.service.execution.plan(added.mission.id),/context|scope/);assert.equal(s.service.store.selected.plan,null);s.service.destroy();});
test('module-owned reservations include another window and ignore unproven local committed labels',async()=>{const s=setup();const task={id:'held',satellite:'N-1',start:s.data.context.utc,end:codec.advance(s.data.context.utc,30)};const original=s.module.status;s.module.status=async options=>({...await original(options),committed:{'other-window':{tasks:1}},accepted_plans:{'other-window':{instance_id:'module',tasks:[task]}}});await s.service.queryModule();const c=s.service.context();assert.equal(c.missions.filter(m=>m.status==='committed').length,1);assert.equal(c.missions.at(-1).id,'other-window');s.service.destroy();});

test('module query exposes a detached display receipt without authorizing unconfirmed nodes',async()=>{const s=setup();await s.service.queryModule();const v=s.service.moduleSnapshot();assert.equal(v.reachable,true);v.sequence=999;assert.equal(s.service.moduleSnapshot().sequence,0);s.service.destroy();});

test('readonly future contact query uses full native approval without creating missions or plans',async()=>{const s=setup(),before=s.service.store.missions;let plans=0;s.module.guardedPlan=async()=>{plans++;throw Error('unexpected plan');};const receipt=await s.service.queryContactWindows({hours:2});assert.equal(receipt.contact_reports.length,1);assert.equal(receipt.contact_reports[0].geometry.coverage.resolution_seconds,30);assert.deepEqual(s.service.store.missions,before);assert.equal(plans,0);assert.deepEqual(s.counts(),{nativeCalls:1,acceptCalls:1});assert.equal(s.service.verifyContactWindows(receipt),true);s.data.context.nodes[0].name='edited';assert.equal(s.service.verifyContactWindows(receipt),false);s.service.destroy();});
test('window query rejects late physical changes, malformed geometry and cancellation',async()=>{for(const kind of ['fault','bad','abort']){const s=setup(),controller=new AbortController(),calculate=s.api.nodeMissionWindows;s.api.nodeMissionWindows=async(...a)=>{const r=await calculate(...a);if(kind==='fault')s.data.context.faults.push({kind:'link_loss',target:'N-1'});if(kind==='bad')r.contact_reports[0].geometry.coverage.resolution_seconds=60;if(kind==='abort')controller.abort();return r;};await assert.rejects(s.service.queryContactWindows({hours:2,signal:controller.signal}),/scope|context|sampling|cancel|abort/i);assert.equal(s.service.store.missions.length,0);s.service.destroy();}});
test('contact receipt remains geometric when module sequence alone advances',async()=>{const s=setup(),receipt=await s.service.queryContactWindows({hours:2});const original=s.module.status;s.module.status=async options=>({...await original(options),sequence:88});await s.service.queryModule();assert.equal(s.service.verifyContactWindows(receipt),true);s.module.status=async()=>({exchange_contract:'guarded-v1',reachable:true,instance_id:'replacement',sequence:0,committed:{}});await s.service.queryModule();assert.equal(s.service.verifyContactWindows(receipt),false);s.service.destroy();});

test('readonly geometry approval preserves a previously planned context for later commit',async()=>{
 const s=setup(),approve=s.api.nodeMissionContext,windows=s.api.nodeMissionWindows;let proof,number=0;
 s.api.nodeMissionContext=async(...args)=>{proof=await approve(...args);proof.context_hash=String(++number).repeat(64);return structuredClone(proof);};s.api.nodeMissionWindows=async(...args)=>({...await windows(...args),accepted_context:structuredClone(proof)});
 s.module.guardedCommit=async(body,g)=>({exchange_contract:'guarded-v1',instance_id:g.instance_id,sequence:++s.moduleStatus.sequence,request_id:g.request_id,context_hash:g.context_hash,mission_id:body.mission_id,mission_version:body.version,plan_sequence:g.plan_sequence,accepted:true,decision:body.decision,held_tasks:body.tasks.length});
 const added=s.service.store.add(s.data.mission);await s.service.execution.plan(added.mission.id);const planned=s.service.execution.inspection(added.mission.id),before=JSON.stringify(s.service.store.missions);const receipt=await s.service.queryContactWindows({hours:2});assert.equal(receipt.accepted_context.context_hash,'2'.repeat(64));assert.equal(planned.evidence.accepted_context.context_hash,'1'.repeat(64));assert.equal(JSON.stringify(s.service.store.missions),before);assert.deepEqual(s.service.execution.inspection(added.mission.id),planned);const result=await s.service.execution.commit(added.mission.id);assert.equal(result.answer.context_hash,'1'.repeat(64));s.service.destroy();
});

test('latest-version recovery uses the full existing native approval and window path before accepted replan',async()=>{const s=setup(),added=s.service.store.add(s.data.mission);await s.service.execution.plan(added.mission.id);s.moduleStatus.accepted_plans[added.mission.id].mission_version=4;s.moduleStatus.sequence=7;let approval;const approve=s.api.nodeMissionContext;s.api.nodeMissionContext=async(body,...args)=>{approval=structuredClone(body);return approve(body,...args);};await s.service.execution.replanLatest(added.mission.id);assert.deepEqual(s.counts(),{nativeCalls:2,acceptCalls:2});assert.equal(approval.module_sequence,7);assert.deepEqual(approval.nodes,s.data.context.nodes);assert.equal(s.service.store.find(added.mission.id).plan.version,5);assert.equal(s.service.execution.inspection(added.mission.id).evidence.accepted_context.module_sequence,7);s.service.destroy();});
test('latest-version recovery leaves the old display plan intact if new native acceptance is malformed',async()=>{const s=setup(),added=s.service.store.add(s.data.mission);await s.service.execution.plan(added.mission.id);const before=s.service.store.missions,approve=s.api.nodeMissionContext;s.api.nodeMissionContext=async(...args)=>({...await approve(...args),context_hash:'malformed'});await assert.rejects(s.service.execution.replanLatest(added.mission.id),/approval scope changed/);assert.deepEqual(s.service.store.missions,before);assert.deepEqual(s.counts(),{nativeCalls:1,acceptCalls:2});assert.equal(s.moduleStatus.sequence,1);s.service.destroy();});
