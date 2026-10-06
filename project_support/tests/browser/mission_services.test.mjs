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
 return {service,data,nodes,module,api,counts:()=>({nativeCalls,acceptCalls}),setFail:()=>{fail=true;}};
}
test('mission service requires real owners and preserves unknown context',()=>{
 assert.throws(()=>createMissionServices({}),/owners/);
 const s=setup();s.nodes.missionInputs=()=>{throw Error('deployment unconfirmed');};
 assert.throws(()=>s.service.context(),/unconfirmed/);s.service.destroy();
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
