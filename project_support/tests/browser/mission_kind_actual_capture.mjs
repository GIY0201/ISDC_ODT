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
let stage='initialization',workspace,scenario,sim,missions,fabric,external=null;const matrix=[];
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
  missions=createMissionServices({api,nodes:workspace,ground,readRuntime,readExternal:()=>external,module:{...module,status:async options=>{await sim.load();return module.status(options);}},library,groundLinks,model,constraints:createMissionConstraints({timeOf:model.timeOf}),codec,storage,nextRequestId:()=>`capture:${++request}`});
  fabric=createFabricExchange({client:createDataFabricClient({fetchImpl}),network:workspace,clientId:'capture_'+randomUUID()});
  scenario=createWorkspaceScenario({api,nodeWorkspace:workspace,ground,missionServices:missions,fabric,simController:sim,nodeLibrary:library,missionTypes:model,stationModel,assemblyFactory:createScenarioAssembly,kpi,storage});
 }
 await createOwners();
 stage='historical-source40-deployment';
 const definition=await api.scenario('SDC_POC_01'),ports=workspace.scenarioPorts();
 const assembled=scenario.assembly.assembleConstellation(definition,{epoch:Date.parse(utcOfRuntime(readRuntime())),idFactory:ports.store.idFactory(),formationId:'FRM-MATRIX'});
 assert.equal(assembled.nodes.length,40);ports.store.addMany(assembled.nodes);await ports.deployment.deploy();
 for(const station of scenario.assembly.assembleStations(definition)){const prior=ground.stations.find(s=>s.id===station.id);if(prior)ground.update(station.id,station);else ground.add(station);}
 await ports.prepareSimUtc(utcOfRuntime(readRuntime()));await missions.queryModule();
 const position=await call('/api/catalog/position',{group:'active',catalog_number:25544});
 const identity=Object.fromEntries(['group','catalog_number','normalized_gp_sha256','eop_sha256','leap_sha256','profile'].map(k=>[k,position[k]]));
 assert.equal(position.frame,'ITRF');
 const start=utcOfRuntime(readRuntime()),deadline=codec.advance(start,360),first=ports.store.deployed[0].id,second=ports.store.deployed[1].id;
 const specs=[
  {kind:'observe',params:{target:'seoul',target_name:'historical Seoul',latitude:37.5665,longitude:126.978,max_off_nadir_deg:30,product_mb:1,processing:true,processing_ratio:.4}},
  {kind:'compute',params:{source_satellite:first,input_mb:1,output_ratio:.2}},
  {kind:'relay',params:{source:'satellite:'+first,destination:'satellite:'+second,volume_mb:1}},
  {kind:'pickup',params:{external_id:'25544',external_name:'Historical ISS 2020 fixture',volume_mb:1,crosslink_rate_mbps:50,max_range_km:2000}},
  {kind:'fleet_update',params:{image_mb:1,apply_s:1,max_concurrent:1,satellites:[first]}}
 ];
 for(const spec of specs){
  stage=spec.kind;external=spec.kind==='pickup'?identity:null;await missions.queryModule();
  const added=missions.store.add({...spec,name:'historical isolated '+spec.kind,window_start:start,deadline},{satellites:ports.store.deployed,stations:ground.enabled});assert.deepEqual(added.errors,[]);const id=added.mission.id;
  const planned=await missions.execution.plan(id),inspection=missions.execution.inspection(id);assert.equal(planned.current,true);assert.equal(typeof planned.answer.feasible,'boolean');assert.equal(inspection.context.nodes.length,40);
  assert.equal(inspection.evidence.accepted_context.utc,start);assert.equal(Object.keys(inspection.evidence.definition_hashes).length,40);
  if(spec.kind==='pickup'){assert.equal(inspection.evidence.external_report.external.frame,'ITRF');assert.equal(inspection.evidence.external_report.external.normalized_gp_sha256,identity.normalized_gp_sha256);}
  let commit=null;if(planned.answer.feasible){commit=await missions.execution.commit(id);assert.equal(commit.answer.accepted,true);assert.equal(commit.current,true);}
  const aborted=await missions.execution.abort(id);assert.equal(aborted.answer.accepted,true);
  const replanned=await missions.execution.plan(id);assert.equal(replanned.answer.mission_version,planned.answer.mission_version+1);assert.equal(replanned.current,true);
  const finalAbort=await missions.execution.abort(id);assert.equal(finalAbort.answer.accepted,true);
  matrix.push({kind:spec.kind,id,feasible:planned.answer.feasible,tasks:planned.answer.tasks,context:inspection.evidence.accepted_context,external_report:inspection.evidence.external_report,commit:commit?.answer??null,abort:aborted.answer,replan:replanned.answer,final_abort:finalAbort.answer});
  emit({kind:'checkpoint',stage:spec.kind,feasible:planned.answer.feasible,task_count:planned.answer.tasks.length});
 }
 assert.deepEqual(matrix.map(x=>x.kind),Object.keys(model.MISSION_KINDS));assert.equal(Object.keys((await missions.queryModule()).committed).length,0);
 emit({kind:'result',success:true,stage:'five-kind-matrix',matrix,trace,historical:true,node_count:40,deadline_seconds:360});
}catch(error){emit({kind:'result',success:false,stage,error:String(error.stack??error),matrix,trace});process.exitCode=1;}
finally{scenario?.destroy();missions?.destroy();fabric?.destroy();workspace?.destroy();sim?.destroy();reader.close();}
