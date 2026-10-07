import test from 'node:test';
import {fixture} from './workspace_fixture.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createScenarioAssembly as assemblyFactory} from '../../../digital_twin/model_library/browser/scenario_assembly.js';
import * as kpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
import {createWorkspaceScenario} from '../../../user_application/web/scripts/scenario/workspace_adapter.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
let sequence=0;const nodeLibrary=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++sequence}`}),missionTypes=createMissionTypes(nodeLibrary);
test('scenario source commands and tick boundary operations hold observer until actual runtime adoption',async()=>{
 let deps,depth=0,entries=0,releases=0,waiting=null,fail=false;
 const runtime={mode:'SIM',run_id:'run',scenario_id:'poc',running:true};let proposed={...runtime};
 const url=new URL('../../../user_application/web/scripts/scenario/workspace_adapter.js',import.meta.url);
 let source=await readFile(url,'utf8');
 source=source.replace("import {createScenarioRunner} from './runner.js';","const createScenarioRunner=globalThis.__controlScenarioRunner;").replace(/from '([^']+)'/g,(_,path)=>`from '${new URL(path,url).href}'`);
 globalThis.__controlScenarioRunner=options=>{deps=options;return{state:{phase:'preparing'},stop(){},suspend(){},subscribe:()=>()=>{},setup:async()=>{},pause:async()=>{},advance:async()=>{},skipToNextStep:async()=>{}};};
 const {createWorkspaceScenario:make}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));delete globalThis.__controlScenarioRunner;
 const api={runtimeControl:async action=>{assert.equal(depth,1);if(fail)throw Error('offline');proposed={...runtime,running:action==='start'};return proposed;},runtimeSpeed:async()=>proposed,selectScenario:async()=>proposed,scenarioAdvance:async()=>proposed,injectFault:async()=>({}),dataManagementRequest:async()=>({}),dataManagementDashboard:async()=>({module:{reachable:true}}),securityDashboard:async()=>({module:{reachable:true}})};
 const ports={nodeLibrary,store:{snapshot:()=>({}),idFactory:()=>()=> 'id'},deployment:{deploy(){}},prepareSimUtc(){},verifySimUtc(){},preflightSimScenario:async()=>true};
 const workspace=make({api,nodeWorkspace:{scenarioPorts:()=>ports},ground:{stations:[]},missionServices:{store:{missions:[]},execution:{plan(){},commit(){},abort(){},inspection(){}},queryModule:async()=>({reachable:true,exchange_contract:'guarded-v1',committed:{}})},fabric:{refresh:async()=>({reachable:true})},simController:{snapshot:()=>({runtime}),load:async()=>{assert.equal(depth,1);if(waiting)await waiting;Object.assign(runtime,proposed);}},missionTypes,stationModel,nodeLibrary,assemblyFactory:()=>({assembleConstellation:()=>({nodes:[]})}),kpi,onControl:()=>{entries++;depth++;return()=>{releases++;depth--;};}});
 try{
  await workspace.preflight({id:'poc'});assert.equal(entries,0);
  let finish;waiting=new Promise(resolve=>finish=resolve);const command=deps.api.runtimeControl('pause');await Promise.resolve();await Promise.resolve();assert.equal(depth,1);assert.equal(runtime.running,true);finish();await command;waiting=null;assert.equal(depth,0);assert.equal(runtime.running,false);
  runtime.running=true;const lease=await deps.beginTick();assert.equal(depth,0);assert.equal(runtime.running,false);await deps.endTick(lease,true,'playing');assert.equal(runtime.running,true);assert.equal(depth,0);
  fail=true;await assert.rejects(deps.api.runtimeControl('pause'),/offline/);assert.equal(depth,0);assert.equal(entries,releases);
 }finally{workspace.destroy();delete globalThis.__controlScenarioRunner;}
});
test('workspace preview loads source definition while unavailable nativeSIMUTC blocks setup before mutations',async()=>{let mutations=0;const ports={store:{},deployment:{},nodeLibrary};const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{scenarios:async()=>({scenarios:[{id:'poc',kind:'poc'}]}),scenario:async()=>({id:'poc',steps:[]}),runtimeControl:async()=>{mutations++;}},nodeWorkspace:{scenarioPorts:()=>ports},ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:{run_id:'run',started_at:'2026-10-07T00:00:00Z',elapsed_seconds:0,running:false,speed:1}})},missionTypes,stationModel});assert.equal((await workspace.runner.list()).length,1);await workspace.runner.select('poc');await assert.rejects(workspace.runner.setup(),/native.*SIM UTC/);assert.equal(mutations,0);assert.equal(workspace.runner.view().phase,'selected');workspace.destroy();});

test('restoring a ready record cannot bypass nativeSIMUTC command preflight',async()=>{
 let mutations=0;const saved=JSON.stringify({scenarioId:'poc',runId:'run',phase:'ready'});const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{scenario:async()=>({id:'poc',steps:[]}),runtimeControl:async()=>{mutations++;return {};},scenarios:async()=>({scenarios:[]})},nodeWorkspace:{scenarioPorts:()=>({store:{},deployment:{},nodeLibrary})},ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:{run_id:'run',started_at:'2026-10-07T00:00:00Z',elapsed_seconds:0,running:false,speed:1}})},missionTypes,stationModel,storage:{getItem:()=>saved,setItem(){}}});
 assert.equal(await workspace.runner.restore(),true);await assert.rejects(workspace.runner.play(),/native.*SIM UTC/);assert.equal(mutations,0);assert.equal(workspace.runner.state.phase,'ready');workspace.destroy();
});


test('unused workspace destruction never writes scenario storage',()=>{let writes=0;const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{},nodeWorkspace:{},nodeLibrary,ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:null})},missionTypes,stationModel,storage:{getItem:()=>null,setItem:()=>writes++}});workspace.destroy();assert.equal(writes,0);});


test('V6 scenario controls permit original 120x preset and reject above runtime128',async()=>{const f=fixture(1280,720,{hash:'#run'});try{f.get('sc-speed').value='120';await f.get('sc-speed-apply').dispatch('click');assert.match(f.get('sc-state').textContent,/세팅|native/);assert.doesNotMatch(f.get('sc-state').textContent,/배속은/);f.get('sc-speed').value='129';await f.get('sc-speed-apply').dispatch('click');assert.match(f.get('sc-state').textContent,/128/);await f.win.dispatch('pagehide',{persisted:false});}finally{f.dispose();}});
