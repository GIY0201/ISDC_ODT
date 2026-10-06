import test from 'node:test';
import {fixture} from './workspace_fixture.mjs';
import assert from 'node:assert/strict';
import {createScenarioAssembly as assemblyFactory} from '../../../digital_twin/model_library/browser/scenario_assembly.js';
import * as kpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
import {createWorkspaceScenario} from '../../../user_application/web/scripts/scenario/workspace_adapter.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
let sequence=0;const nodeLibrary=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++sequence}`}),missionTypes=createMissionTypes(nodeLibrary);
test('workspace preview loads source definition while unavailable nativeSIMUTC blocks setup before mutations',async()=>{let mutations=0;const ports={store:{},deployment:{},nodeLibrary};const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{scenarios:async()=>({scenarios:[{id:'poc',kind:'poc'}]}),scenario:async()=>({id:'poc',steps:[]}),runtimeControl:async()=>{mutations++;}},nodeWorkspace:{scenarioPorts:()=>ports},ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:{run_id:'run',started_at:'2026-10-07T00:00:00Z',elapsed_seconds:0,running:false,speed:1}})},missionTypes,stationModel});assert.equal((await workspace.runner.list()).length,1);await workspace.runner.select('poc');await assert.rejects(workspace.runner.setup(),/native.*SIM UTC/);assert.equal(mutations,0);assert.equal(workspace.runner.view().phase,'selected');workspace.destroy();});

test('restoring a ready record cannot bypass nativeSIMUTC command preflight',async()=>{
 let mutations=0;const saved=JSON.stringify({scenarioId:'poc',runId:'run',phase:'ready'});const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{scenario:async()=>({id:'poc',steps:[]}),runtimeControl:async()=>{mutations++;return {};},scenarios:async()=>({scenarios:[]})},nodeWorkspace:{scenarioPorts:()=>({store:{},deployment:{},nodeLibrary})},ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:{run_id:'run',started_at:'2026-10-07T00:00:00Z',elapsed_seconds:0,running:false,speed:1}})},missionTypes,stationModel,storage:{getItem:()=>saved,setItem(){}}});
 assert.equal(await workspace.runner.restore(),true);await assert.rejects(workspace.runner.play(),/native.*SIM UTC/);assert.equal(mutations,0);assert.equal(workspace.runner.state.phase,'ready');workspace.destroy();
});


test('unused workspace destruction never writes scenario storage',()=>{let writes=0;const workspace=createWorkspaceScenario({assemblyFactory,kpi,api:{},nodeWorkspace:{},nodeLibrary,ground:{},missionServices:{store:{}},fabric:{},simController:{snapshot:()=>({runtime:null})},missionTypes,stationModel,storage:{getItem:()=>null,setItem:()=>writes++}});workspace.destroy();assert.equal(writes,0);});


test('V6 scenario controls permit original 120x preset and reject above runtime128',async()=>{const f=fixture(1280,720,{hash:'#run'});try{f.get('sc-speed').value='120';await f.get('sc-speed-apply').dispatch('click');assert.match(f.get('sc-state').textContent,/세팅|native/);assert.doesNotMatch(f.get('sc-state').textContent,/배속은/);f.get('sc-speed').value='129';await f.get('sc-speed-apply').dispatch('click');assert.match(f.get('sc-state').textContent,/128/);await f.win.dispatch('pagehide',{persisted:false});}finally{f.dispose();}});
