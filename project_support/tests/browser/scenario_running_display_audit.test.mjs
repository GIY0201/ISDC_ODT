// Acceptance-gap audit: actual installed-native receipt replay, actual shared display owner.
// Renderer is presentation-only stubbed; no native positions/proofs are manufactured.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNodeSampleBuffer,NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createScenarioClock} from '../../../user_application/web/scripts/scenario/clock.js';
import {createSimWorkspace} from '../../../user_application/web/scripts/tabs/sim_workspace.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256);
const evidencePath=process.env.ISDC_SCENARIO_NATIVE_EVIDENCE;
test('actual captured40-native buffer supports bounded display interpolation while refusing interpolated communication', {skip:!evidencePath},async()=>{
 const evidence=JSON.parse(await readFile(evidencePath,'utf8'));
 const record=evidence.records.find(r=>r.request?.path==='/api/nodes/samples'&&r.request.body.count===601&&r.request.body.nodes.length===40&&r.status===200);
 assert.ok(record,'actual40x601 native receipt required');const request=record.request.body,buffer=createNodeSampleBuffer(request,record.response);
 for(const node of request.nodes){const at=codec.advance(request.start_utc,12.5),value=buffer.geometryFor(node,{utc:at});assert.equal(value.row.utc,at);assert.equal(value.interpolated,true);assert.equal(value.frame,NODE_COMMUNICATION_METADATA.frame);assert.equal(value.quality,'engineering_assumption');assert.ok(value.row.position_m.every(Number.isFinite));assert.equal(buffer.communicationStateFor(node,{utc:at}),null);assert.equal(buffer.geometryFor(node,{utc:codec.advance(request.start_utc,600.001)}),null);assert.equal(buffer.geometryFor({...node,name:node.name+'changed'},{utc:at}),null);}
});
test('shared display refuses running sourceSIM without an explicit fresh projection port',async()=>{
 globalThis.AuditScenarioGlobe=class{constructor(){this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};}update(){return false;}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setCatalogScene(){}setCatalogTrack(){}destroy(){}};
 let source=await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8');source=source.replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.AuditScenarioGlobe;').replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href));
 const{createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},{Cesium:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}});
 let runtime={run_id:'RUN-AUDIT',running:false,utc:codec.advance('2026-10-07T00:00:00Z',0)};
 ui.bindScenarioRuntime(()=>structuredClone(runtime),r=>r.utc);
 assert.equal(ui.setScenarioDisplayContext({run_id:runtime.run_id,utc:runtime.utc,leap_sha256:LEAP_SHA256}),true);assert.equal(ui.displayContext().utc,runtime.utc);
 runtime.running=true;assert.equal(ui.displayContext(),null,'current gate explicitly rejects running actualSIM');
 runtime.utc=codec.advance(runtime.utc,.5);assert.equal(ui.setScenarioDisplayContext({run_id:runtime.run_id,utc:runtime.utc,leap_sha256:LEAP_SHA256}),false,'updating to real running UTC also rejected');assert.equal(ui.displayContext(),null);
 ui.destroy();delete globalThis.AuditScenarioGlobe;
});

test('actual SIM receipt owner feeds bounded original-source projection and invalidates bootstrap/stale/error/dispose',async()=>{
 let receive,expire,wall=1000;const r={mode:'SIM',running:true,speed:120,elapsed_seconds:10,sequence:1,run_id:'R',scenario_id:'S',started_at:'2026-10-07T00:00:00Z',active_faults:[]};
 const boot={runtime:r,scenarios:[{id:'S',name:'source'}],events:[],missions:[]};
 const controller=createSimWorkspace({bootstrap:async()=>structuredClone(boot)},fn=>{receive=fn;return()=>{};},()=>{},()=>{},{now:()=>wall,setTimer:fn=>(expire=fn,1),clearTimer(){}});
 const clock=createScenarioClock({runtime:()=>controller.snapshot().runtime,receivedAt:()=>controller.displayReceipt()?.received_at_ms,wallNow:()=>wall});
 controller.connect();await controller.load();assert.equal(controller.displayReceipt(),null);assert.equal(clock.displayProjection(),null);
 const metricNames=['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'];
 const frame={type:'telemetry',runtime:r,events:[],missions:[],wall_time:'2026-10-07T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'},telemetry:Object.fromEntries(metricNames.map(k=>[k,1]))};
 receive(frame);assert.equal(controller.displayReceipt().sequence,1);wall+=500;const projection=clock.displayProjection();assert.equal(projection.time_ms,Date.parse(r.started_at)+70000);assert.equal(projection.age_ms,500);assert.equal(controller.snapshot().runtime.elapsed_seconds,10,'display does not advance runtime');
 wall+=3501;assert.equal(clock.displayProjection(),null);expire();assert.equal(controller.displayReceipt(),null);
 receive(frame);assert.ok(controller.displayReceipt());await controller.load();assert.equal(controller.displayReceipt(),null,'bootstrap is not a fresh telemetry receipt');
 receive(frame);receive({...frame,telemetry:{}});assert.equal(controller.displayReceipt(),null);controller.destroy();assert.equal(clock.displayProjection(),null);assert.equal(controller.displayReceipt(),null);
});
test('shared sourceSIM rendering uses fresh runtime identity and engineering projection and rejects drift',async()=>{
 globalThis.RunningScenarioGlobe=class{constructor(){this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};}update(){return false;}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setCatalogScene(){}setCatalogTrack(){}destroy(){}};
 let source=await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8');source=source.replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.RunningScenarioGlobe;').replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href));
 const{createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);const ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},{Cesium:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}});
 const runtime={run_id:'R',sequence:1,running:false,speed:120,elapsed_seconds:0,utc:codec.advance('2026-10-07T00:00:00Z',0),active_faults:[]};let age=0,invalid=null;
 ui.bindScenarioRuntime(()=>runtime,r=>r.utc,{projectDisplay:()=>invalid??{run_id:runtime.run_id,sequence:runtime.sequence,elapsed_seconds:runtime.elapsed_seconds,age_ms:age,projected:true,utc:codec.advance(runtime.utc,age/1000*runtime.speed)}});
 assert.equal(ui.setScenarioDisplayContext({run_id:'R',utc:runtime.utc,leap_sha256:LEAP_SHA256}),true);runtime.running=true;age=100;assert.equal(ui.displayContext().utc,codec.advance(runtime.utc,12));assert.equal(ui.displayContext().frame,'EARTH_FIXED_GMST_UTC_APPROX');assert.equal(ui.displayContext().projected,true);age=500;assert.equal(ui.displayContext().utc,codec.advance(runtime.utc,60));
 runtime.active_faults=[{id:'F',kind:'link_loss'}];assert.ok(ui.displayContext(),'fault does not invent orbital pose change');
 for(const patch of [{sequence:999},{run_id:'foreign'},{elapsed_seconds:1},{age_ms:3501},{utc:'bad'}]){invalid={run_id:'R',sequence:1,elapsed_seconds:0,age_ms:age,projected:true,utc:codec.advance(runtime.utc,age/1000*runtime.speed),...patch};assert.equal(ui.displayContext(),null);}invalid=null;runtime.run_id='foreign';assert.equal(ui.displayContext(),null);runtime.run_id='R';runtime.running=false;assert.equal(ui.displayContext().utc,runtime.utc);runtime.utc=codec.advance(runtime.utc,1);assert.equal(ui.displayContext().utc,runtime.utc,'enabled display derives exact paused actualUTC without clearing same-run samples');assert.equal(ui.displayContext().projected,undefined);ui.destroy();assert.equal(ui.displayContext(),null);delete globalThis.RunningScenarioGlobe;
});
