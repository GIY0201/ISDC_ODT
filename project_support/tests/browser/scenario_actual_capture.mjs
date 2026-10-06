// Isolated ASGI capture. Only DOM/globe presentation is absent; native and every ICD use real HTTP.
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceNodes} from '../../../user_application/web/scripts/workspace_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createNetworkSnapshotModel} from '../../../digital_twin/simulation/browser/network_snapshot.js';
import {createGroundSegmentStore} from '../../../user_application/web/scripts/communication/ground_segment.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createMissionConstraints} from '../../../digital_twin/simulation/browser/mission_constraints.js';
import {createMissionServices} from '../../../user_application/web/scripts/missions/mission_services.js';
import {createOrchestrationClient} from '../../../communication/browser/orchestration.js';
import {createDataFabricClient} from '../../../communication/browser/data_fabric.js';
import {createFabricExchange} from '../../../user_application/web/scripts/tabs/fabric_exchange.js';
import {createSimWorkspace} from '../../../user_application/web/scripts/tabs/sim_workspace.js';
import {createWorkspaceScenario} from '../../../user_application/web/scripts/scenario/workspace_adapter.js';
import {createScenarioAssembly} from '../../../digital_twin/model_library/browser/scenario_assembly.js';
import * as kpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';

let serial=0;const pending=new Map(),trace=[];
const emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
console.warn=(...args)=>process.stderr.write(args.map(String).join(' ')+'\n');
const reader=readline.createInterface({input:process.stdin});reader.on('line',line=>{const value=JSON.parse(line);pending.get(value.id)?.(value);pending.delete(value.id);});
async function fetchImpl(path,options={}){const id=++serial;const body=options.body?JSON.parse(options.body):null;trace.push({id,path,method:options.method??'GET',body});const answer=await new Promise(resolve=>{pending.set(id,resolve);emit({kind:'request',id,path,method:options.method??'GET',headers:options.headers??{},body});});return {ok:answer.status>=200&&answer.status<300,status:answer.status,headers:{get:key=>answer.headers?.[key.toLowerCase()]??null},json:async()=>answer.body,text:async()=>JSON.stringify(answer.body)};}
async function call(path,body,headers={}){const reply=await fetchImpl(path,{method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body),headers});const value=await reply.json();if(!reply.ok)throw Error(`${path} HTTP ${reply.status}: ${JSON.stringify(value)}`);return value;}
const api={scenarios:()=>call('/api/scenarios'),scenario:id=>call('/api/scenarios/'+id),bootstrap:()=>call('/api/bootstrap'),runtimeControl:action=>call('/api/runtime/control',{action}),runtimeSpeed:speed=>call('/api/runtime/speed',{speed}),selectScenario:scenario_id=>call('/api/scenario/select',{scenario_id}),scenarioAdvance:seconds=>call('/api/scenario/advance',{seconds}),injectFault:body=>call('/api/faults',body),nodeSamples:body=>call('/api/nodes/samples',body),nodeTrack:body=>call('/api/nodes/track',body),nodeMissionContext:body=>call('/api/nodes/mission-context',body),nodeMissionWindows:(body,options)=>call('/api/nodes/mission-windows',body,{'X-ISDC-Mission-Context':options?.contextHash}),dataManagementDashboard:()=>call('/api/data-management/dashboard?limit=1'),dataManagementRequest:body=>call('/api/data-management/console/request',body),securityDashboard:()=>call('/api/security/dashboard')};
let stage='initialization',workspace,scenario,sim,missions,fabric;
try{
 await api.runtimeControl('pause');sim=createSimWorkspace(api,()=>()=>{});await sim.load();assert.equal(sim.snapshot().error,'');
 const codec=createUtcCodec(LEAP_SHA256),readRuntime=()=>sim.snapshot().runtime,utcOfRuntime=s=>codec.advance(new Date(Date.parse(s.started_at)+s.elapsed_seconds*1000).toISOString(),0);
 let context=null,listener=()=>{};
 const globe={observeDisplayContext(fn){listener=fn;fn(context);return()=>{};},displayContext:()=>context,bindNodeRenderer:()=>()=>{},nodeRendererState:()=>({phase:'ready'}),observeNodeRenderer:()=>()=>{},bindNodeInteraction:()=>()=>{},clearSatelliteModel(){},setSatelliteModel(){},releaseSatelliteModel(){}};
 const scenarioClock={readRuntime,utcOfRuntime,setDisplayUtc(value){const actual=readRuntime();if(actual.running||actual.run_id!==value.run_id||utcOfRuntime(actual)!==value.utc)return false;context={key:'sim:'+value.run_id,source:'sim',utc:value.utc,leap_sha256:value.leap_sha256,eop_sha256:null};listener(context);return true;},clearDisplayUtc(){context=null;listener(null);return true;}};
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>randomUUID()});
 let ground;const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const groundLinks=createGroundLinkModel({library,stationModel});const model=createMissionTypes(library);
 const host={crypto:{randomUUID},localStorage:storage,setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
 const document={getElementById:()=>null,createElement:()=>({querySelector:()=>null,remove(){}})};
 const Scene=class{};const tools={workPanelMarkup:()=>'',createNodeWorkPanel:()=>({refresh(){},destroy(){}})};
 const module=createOrchestrationClient({fetchImpl});let request=0;
 async function createOwners(){
  ground=createGroundSegmentStore({model:stationModel,storage});ground.load();
  workspace=createWorkspaceNodes({api,globe,library,orbitElements,catalogElements,oisl,Scene,tools,document,host,now:()=>Date.parse(utcOfRuntime(readRuntime())),resolveModel:()=>null,models:()=>[],fetchImpl,readClock:()=>({running:readRuntime().running,speed:readRuntime().speed}),scenarioClock,networkInputs:{model:createNetworkSnapshotModel({library,oisl,groundLinks}),readStations:()=>ground.enabled,readFaults:()=>readRuntime().active_faults,validateStation:stationModel.validateStation}});
  await workspace.start();
  missions=createMissionServices({api,nodes:workspace,ground,readRuntime,module:{...module,status:async options=>{await sim.load();return module.status(options);}},library,groundLinks,model,constraints:createMissionConstraints({timeOf:model.timeOf}),codec,storage,nextRequestId:()=>`capture:${++request}`});
  fabric=createFabricExchange({client:createDataFabricClient({fetchImpl}),network:workspace,clientId:'capture_'+randomUUID()});
  scenario=createWorkspaceScenario({api,nodeWorkspace:workspace,ground,missionServices:missions,fabric,simController:sim,nodeLibrary:library,missionTypes:model,stationModel,assemblyFactory:createScenarioAssembly,kpi,storage});
 }
 await createOwners();
 stage='definition';const definition=await scenario.runner.select('SDC_POC_01');assert.equal(definition.constellation.planes*definition.constellation.per_plane,40);
 stage='setup';await scenario.runner.setup();assert.equal(workspace.scenarioPorts().store.deployed.length,40);assert.equal(missions.store.missions.length,3);
 const lifecycle=trace.filter(t=>['/api/orchestration/plan','/api/orchestration/commit'].includes(t.path)).map(t=>t.path);assert.deepEqual(lifecycle,['/api/orchestration/plan','/api/orchestration/plan','/api/orchestration/plan','/api/orchestration/commit','/api/orchestration/commit']);
 emit({kind:'checkpoint',stage,node_count:40,missions:missions.store.missions.map(m=>({id:m.id,status:m.status,feasible:m.plan?.feasible,tasks:m.plan?.tasks?.length})),lifecycle});
 if(process.argv.includes('--resume-only')){
  stage='resume';const before=readRuntime(),priorDeployment=workspace.scenarioPorts().store.snapshot(),start=trace.length;
  scenario.destroy();missions.destroy();fabric.destroy();workspace.destroy();ground.destroy();sim.destroy();
  sim=createSimWorkspace(api,()=>()=>{});await sim.load();await createOwners();
  assert.equal(await scenario.runner.restore(),true);assert.equal(scenario.runner.state.phase,'ready');
  const accepted=await scenario.resumePreflight();assert.equal(accepted.node_count,40);
  const restoredDeployment=workspace.scenarioPorts().store.snapshot();assert.deepEqual(restoredDeployment.deployed,priorDeployment.deployed);assert.deepEqual(restoredDeployment.receipt,priorDeployment.receipt);assert.equal(restoredDeployment.deployedAt,priorDeployment.deployedAt);
  assert.ok(!trace.slice(start).some(item=>item.method==='POST'&&item.path==='/api/data-management/deployment'),'resume cannot redeploy');
  const after=readRuntime();for(const key of ['run_id','scenario_id','started_at','elapsed_seconds','running'])assert.equal(after[key],before[key],key+' unchanged');
  assert.ok(!trace.slice(start).some(item=>item.method==='POST'&&/^\/api\/(runtime\/|scenario\/)/.test(item.path)),'resume preflight cannot issue runtime commands');
  emit({kind:'result',success:true,stage,accepted,snapshot:scenario.runner.view(),trace});
 }else{
 stage='play';await scenario.runner.play();
 for(let index=0;index<8&&scenario.runner.state.phase!=='finished';index++){stage='advance-'+index;const next=await scenario.runner.skipToNextStep();emit({kind:'checkpoint',stage,next,snapshot:scenario.runner.view()});if(!next)break;}
 assert.equal(scenario.runner.state.phase,'finished','all original five steps must actually execute');
 assert.equal(scenario.runner.record().verdict.ok,true,'original three KPI verdict groups must pass');
 for(const step of scenario.runner.view().steps){assert.equal(step.checkSource,'completed',step.id+' historical evidence');assert.ok(step.checkResults.every(check=>check.ok===true&&!check.pending),step.id+' completion checks');}
 emit({kind:'result',success:true,stage,snapshot:scenario.runner.view(),result:scenario.runner.record(),trace});
 }
}catch(error){emit({kind:'result',success:false,stage,error:String(error.stack??error),snapshot:scenario?.runner.view(),stepEvidence:scenario?.runner.state.steps,workspaceEvidence:scenario?.runner.state.workspaceEvidence,missions:missions?.store.missions,trace});process.exitCode=1;}
finally{scenario?.destroy();missions?.destroy();fabric?.destroy();workspace?.destroy();sim?.destroy();reader.close();}
