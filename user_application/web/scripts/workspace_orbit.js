import {installOrbitUiMeasurement} from './orbit_ui_measurement.js';
import {projectWorkspaceContext} from './workspace_context.js';
import {createMissionServices} from './missions/mission_services.js';
import {createFuturePasses} from './nodes/future_passes.js';
import {createSourceDataPanel} from './tabs/source_data.js';
import {createSourceSecurityPanel} from './tabs/source_security.js';
import {createSourceSettingsPanel} from './tabs/source_settings.js';
import {createAnalysisFollowCoordinator} from './scenario/analysis_follow.js';
import {createAnalysisTransport} from './scenario/analysis_transport.js';
import {createWorkspaceScenario} from './scenario/workspace_adapter.js';
import {createSourceScenarioPanel} from './tabs/source_scenarios.js';
import {createScenarioAssembly} from '/static/model_library/scenario_assembly.js';
import * as scenarioKpi from '/static/scenario_verification/scenario_kpi.js';
import * as dataViewModel from './data_management/view_model.js';
import {createSourceMissionPanel} from './tabs/source_missions.js';
import {createMissionTypes} from '/static/model_library/mission_types.js';
import {createMissionConstraints} from '/static/simulation/mission_constraints.js';
import {createOrchestrationClient} from '/static/communication/orchestration.js';
import {layoutTimeline,timelineMarkup} from '/static/visualization/mission_timeline.js';
import {createBrowserId} from './browser_identity.js';
import {createWorkspaceSolar} from './workspace_solar.js?v=t135-r1';
import {createWorkspaceNodes} from './workspace_nodes.js?v=t151-r1';
import {createGroundSegmentStore} from './communication/ground_segment.js';
import {createGroundNetworkPanel} from './tabs/ground_network.js';
import * as networkDiagram from '/static/visualization/network_diagram.js';
import {NativeNetworkScene} from '/static/visualization/native_network_scene.js';
import {createFabricExchange} from './tabs/fabric_exchange.js';
import {createDataFabricClient} from '/static/communication/data_fabric.js';
import * as sourceStationModel from '/static/model_library/ground_stations.js';
import {createGroundLinkModel} from '/static/simulation/ground_links.js';
import {createNetworkSnapshotModel} from '/static/simulation/network_snapshot.js';
import {createNodeClockControls} from './nodes/clock_controls.js';
import {createUtcCodec,LEAP_SHA256} from './orbit_utc.js';
import {createNodeLibrary} from '/static/model_library/satellite_nodes.js';
import {orbitElements,catalogElements} from '/static/simulation/node_orbit_definition.js';
import * as nodeOisl from '/static/simulation/oisl.js';
import {NodeScene} from '/static/visualization/node_scene.js';
import {createSatelliteNodePanelTools} from './tabs/satellite_nodes.js';
import {createGlobeViewPanel} from './tabs/globe_view.js?v=t135-r1';
import {createSatelliteModelPanel} from './tabs/satellite_model.js?v=t128-r1';
import {createSatelliteHover} from './tabs/satellite_hover.js?v=t129-r1';
import {createSatelliteModelSelection} from './orbit/satellite_model_selection.js?v=t128-r1';
import {createModelResolver,validateSatelliteManifest} from '/static/model_library/satellite_models.js';
import {createCatalogTrack} from './catalog_track.js?v=t115-r1';
import {createCatalogPasses} from './catalog_passes.js?v=t115-r1';
import {createCatalogPassPanel} from './tabs/catalog_passes.js?v=t115-r1';
import {createCatalogTimeline} from './catalog_timeline.js?v=t110-r3';
import {createCatalogScene} from './catalog_scene.js?v=t110-r3';
import {createCatalogScenePanel} from './tabs/catalog_scene.js?v=t175-r1';
import {createCatalogTimePanel} from './tabs/catalog_time.js?v=t103-r3';
import {GROUND_STATIONS,stationGroups} from '/static/model_library/ground_station_sites.js';
import {createStationPanel} from './tabs/station_workspace.js?v=t103-r3';
import {createCatalogGeometry} from './catalog_geometry.js?v=t110-r3';
import {createCatalogPanel} from './tabs/catalog_workspace.js?v=t175-r1';
import {createHilPanel} from './tabs/hil_workspace.js?v=t069-r2';
import {hilTopology} from '/static/visualization/hil_topology.js';
import {createWorkspaceRevisionSync} from './workspace_revision_sync.js';
import {api,telemetrySocket} from '/static/communication/api.js?v=t135-r1';
import {createKpiPanel} from './tabs/kpi_workspace.js?v=t069-r2';
import {drawMultiLine,drawSparkline} from '/static/visualization/charts.js';
import {createSimPanel} from './tabs/sim_workspace.js?v=t069-r2';
import {createMissionPanel} from './tabs/mission_workspace.js?v=t069-r2';
import {createOrbitSelection} from './orbit_selection.js?v=t031-r1';
import {createWorkspaceGlobe} from './workspace_globe.js?v=t136-r1';
import {createWorkspacePlayback} from './workspace_playback.js';
import {createGroundPanel} from './tabs/ground_visibility.js?v=t097-r2';
import {createRadioSeriesPanel} from './tabs/orbit_radio_series.js?v=t053-r1';
import {createOrbitRadioPanel} from './tabs/orbit_radio.js?v=t048-r3';
import {createCommunicationPlanningPanel} from './tabs/communication_planning.js?v=t043-r1';
import {createRfPanel} from './tabs/rf_link_budget.js?v=t039-r1';

const escape=value=>String(value??'미확인').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view=null,displayUtc=null,displayElevation='자료 준비 중',wallSceneScope='ours';
let analysisFollow=null,transportError='';
const followPorts={pending:()=>analysisFollow?.isPending()===true,source:()=>analysisFollow?.followedSource()??null,locked:()=>analysisFollow?.isFollowing()===true,invalidate:reason=>analysisFollow?.invalidate(reason)};
const storedTransport=createAnalysisTransport({follow:followPorts,independent:{play:()=>command(()=>client.control('play')),pause:()=>command(()=>client.control('pause')),speed:n=>command(()=>client.control('speed',n)),seek:utc=>command(()=>client.seek(utc)),epoch:utc=>command(()=>client.seek(utc))}});
async function transport(action,value){try{transportError='';await storedTransport.run(action,value);}catch(error){transportError=error.message;}render();}
const contextListeners=new Set();let contextReady=false;
function notifyWorkspaceContext(){if(!contextReady)return;updateWallDisplay();nodeWorkspace?.observeNetworkInputs();void futurePasses?.observe();const value=readWorkspaceContext();for(const listener of contextListeners){try{listener(value);}catch{}}}
export function observeWorkspaceContext(listener){contextListeners.add(listener);if(contextReady)listener(readWorkspaceContext());return()=>contextListeners.delete(listener);}
export function readWorkspaceContext(){let context=null;try{context=missionServices.context();}catch{}const network=typeof nodeWorkspace.networkPresentation==='function'?nodeWorkspace.networkPresentation():(()=>{const proof=nodeWorkspace.networkSnapshot?.();return {proof,verified:proof?nodeWorkspace.verifyNetworkSnapshot?.(proof)===true:false};})();return projectWorkspaceContext({selection:nodeWorkspace.selection?.()??null,display:globe.displayContext(),catalog:catalogTimeline.snapshot(),stored:client.snapshot(),nodes:nodeWorkspace.contextPresentation(),sim:simPanel.controller.snapshot(),mission:{ready:missionServices.store.ready,selected:missionServices.store.selected,module:missionServices.moduleSnapshot(),inspection:missionServices.store.selectedId?missionServices.execution.inspection(missionServices.store.selectedId):null,context},network,fabric:fabric.snapshot(),data:sourceDataPanel.contextSnapshot()});}
let openWorkspaceView=()=>{};
export function bindWorkspaceView(open){openWorkspaceView=open;}
const globe=createWorkspaceGlobe(document.getElementById('stored-orbit-globe'),document.getElementById('orbit-globe-status'),document.getElementById('orbit-globe-focus'));
const solar=createWorkspaceSolar({api,globe,overlay:document.getElementById('orbit-solar-overlay')});
const globeViewPanel=createGlobeViewPanel(globe,solar);
const modelPanel=createSatelliteModelPanel(globe);
let satelliteHover=null;
let nodeWorkspace=null;
let groundNetworkPanel=null;
let futurePasses=null;
let nodeClock=null;
const simUtcCodec=createUtcCodec(LEAP_SHA256);
function simRuntimeUtc(runtime){
  const start=Date.parse(runtime?.started_at),elapsed=runtime?.elapsed_seconds;
  if(runtime?.mode!=='SIM'||!Number.isFinite(start)||!Number.isFinite(elapsed)||elapsed<0)throw Error('실제 SIM UTC 입력이 없습니다.');
  return simUtcCodec.advance(new Date(start+elapsed*1000).toISOString(),0);
}
const scenarioClockPorts={controls:{play:()=>scenarioWorkspace.runner.play(),pause:()=>scenarioWorkspace.runner.pause(),step:n=>scenarioWorkspace.runner.advance(n),setSpeed:n=>scenarioWorkspace.runner.setSpeed(n)},readRuntime:()=>simPanel.controller.snapshot().runtime,utcOfRuntime:simRuntimeUtc,setDisplayUtc:value=>globe.setScenarioDisplayContext(value),clearDisplayUtc:runId=>globe.clearScenarioDisplayContext(runId)};
function renderSatelliteHover(payload,C,kind='gp'){
  if(!satelliteHover&&payload&&C)satelliteHover=createSatelliteHover(document.getElementById('stored-orbit-globe'),C);
  if(payload)satelliteHover?.show(payload);else satelliteHover?.clear(kind);
}
const removeSatelliteHover=globe.observeSatelliteHover((payload,C)=>renderSatelliteHover(payload,C));
const stationPanel=createStationPanel(GROUND_STATIONS,stationGroups(),{select:key=>globe.selectStation(key),focus:key=>globe.focusStation(key),use:site=>{const staged=groundPanel.stageStation(site);location.hash='ground';return staged;},useCatalog:site=>{catalogTimePanel.stage(site);location.hash='satellite';},getCatalogTimeline:()=>catalogTimeline.snapshot(),getCatalogPasses:()=>catalogPasses.snapshot(),queryCatalogPasses:()=>catalogPasses.query()});
globe.stations(Object.values(GROUND_STATIONS),key=>stationPanel.controller.choose(key));
const client=createOrbitSelection(api,()=>{render();notifyWorkspaceContext();},undefined,undefined,()=>nodeWorkspace?.beginFuturePassControl?.());
const revisionSync=createWorkspaceRevisionSync(client);
const seriesPanel=createRadioSeriesPanel(client,api);
const groundPanel=createGroundPanel(client,api,{onInterval:(source,index)=>seriesPanel.choose(source,index),onInvalidate:()=>seriesPanel.clearInterval()});
const rfPanel=createRfPanel(api);
const planningPanel=createCommunicationPlanningPanel(api);
const radioPanel=createOrbitRadioPanel(client,api);
const missionPanel=createMissionPanel(api);
const kpiPanel=createKpiPanel(api,drawMultiLine);
let catalogPanel,catalogTimePanel,catalogScene,catalogScenePanel,catalogTrack,catalogPasses,catalogPassPanel,modelSelection;
// UTC/position changes already refresh source nodes through the globe display observer.
// Keep every other catalog state change (including controls, selection and errors).
let catalogNodeControlKey=null;
function syncModel(selection){if(!modelSelection||!catalogPanel)return;const selected=selection??catalogPanel.controller.snapshot();modelSelection.select(selected.selectedItem,selected.profile,catalogTimeline.snapshot().selected);}
const catalogTimeline=createCatalogTimeline(api,value=>globe.catalog(value),()=>{catalogTimePanel?.update();catalogPanel?.update();stationPanel.update();const t=catalogTimeline.snapshot();const controlKey=JSON.stringify(Object.fromEntries(Object.entries(t).filter(([key])=>!['utc','display'].includes(key))));if(controlKey!==catalogNodeControlKey){catalogNodeControlKey=controlKey;nodeWorkspace?.refresh();}catalogTrack?.select(t.selected);if(t.utc)catalogTrack?.observe(t.utc);catalogPasses?.update(t);catalogPassPanel?.update();notifyWorkspaceContext();if(catalogScenePanel?.followsTimeline()&&t.selected?.group===catalogScene?.snapshot().context?.group&&t.utc)catalogScene.observe(t.utc);});
const removeCatalogContinuity=typeof globe.bindCatalogDisplayContinuity==='function'&&catalogTimeline.displayContinuity?globe.bindCatalogDisplayContinuity(catalogTimeline.displayContinuity):()=>{};
catalogTrack=createCatalogTrack(api,value=>globe.catalogTrack(value),()=>catalogPassPanel?.update(),{onConflict:()=>{catalogGeometry.clear();catalogTimeline.clear();}});
catalogPasses=createCatalogPasses(api,()=>{catalogPassPanel?.update();stationPanel.update();},async utc=>{catalogTimeline.seek(utc);await catalogTimeline.calculate();},{onConflict:()=>{catalogGeometry.clear();catalogTimeline.clear();}});
catalogPassPanel=createCatalogPassPanel(catalogTrack,catalogPasses,()=>catalogTimeline.snapshot());
catalogTimePanel=createCatalogTimePanel(catalogTimeline,GROUND_STATIONS,{follow:followPorts});
const catalogGeometry=createCatalogGeometry(api,(value,pin)=>{catalogTimeline.select(value,pin);syncModel();},()=>{catalogPanel?.update();if(catalogGeometry.snapshot().hashConflict){catalogScene?.clear();catalogTimeline.clear();}});
catalogScene=createCatalogScene(api,value=>globe.catalogScene(value,number=>{const s=catalogScene.snapshot();const row=catalogScene.row(number);if(row&&s.result&&!catalogPanel.controller.snapshot().pending){catalogPanel.controller.selectExternal(row,s.result);openWorkspaceView('satellite');}}),()=>{catalogScenePanel?.update();if(contextReady)updateWallDisplay();},{onConflict:()=>{catalogGeometry.clear();catalogTimeline.clear();}});
catalogScenePanel=createCatalogScenePanel(catalogScene,()=>catalogTimeline.snapshot(),{setLabelsVisible:value=>globe.setCatalogLabels(value),labelsVisible:()=>globe.catalogLabelsVisible()});
catalogPanel=createCatalogPanel(api,catalogGeometry,{applied:p=>catalogScene.configure(p),getCatalogTimeline:()=>catalogTimeline.snapshot()});
modelSelection=createSatelliteModelSelection({api,globe,timeline:catalogTimeline,validateManifest:validateSatelliteManifest,createResolver:createModelResolver});
const removeModelSelection=catalogPanel.controller.observeSelection(syncModel);
const nodeLibrary=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>createBrowserId(window.crypto)});
let groundStorage=null;const groundStoragePort={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
try{if(window.localStorage)groundStorage=groundStoragePort;}catch{groundStorage=groundStoragePort;}
const sourceGround=createGroundSegmentStore({model:sourceStationModel,storage:groundStorage});sourceGround.load();
const sourceNetworkModel=createNetworkSnapshotModel({library:nodeLibrary,oisl:nodeOisl,groundLinks:createGroundLinkModel({library:nodeLibrary,stationModel:sourceStationModel})});
nodeClock=createNodeClockControls({follow:followPorts,readContext:()=>nodeWorkspace?.snapshot().display,stored:client,catalog:catalogTimeline,advanceUtc:createUtcCodec(LEAP_SHA256).advance,now:()=>Date.now(),runStored:command,scenario:scenarioClockPorts});
nodeWorkspace=createWorkspaceNodes({api,globe,solar,library:nodeLibrary,orbitElements,catalogElements,oisl:nodeOisl,Scene:NodeScene,NetworkScene:NativeNetworkScene,tools:createSatelliteNodePanelTools({library:nodeLibrary}),document,host:window,now:()=>Date.now(),resolveModel:item=>modelSelection.resolve(item),models:()=>modelSelection.models(),fetchImpl:window.fetch.bind(window),readClock:context=>nodeClock.read(context),clockActions:nodeClock.actions,scenarioClock:scenarioClockPorts,onHover:payload=>renderSatelliteHover(payload,window.Cesium,'source_node'),networkInputs:{model:sourceNetworkModel,readFabricState:()=>fabric.snapshot(),coverageRadiusKm:(station,nodes)=>{const values=nodes.map(n=>n.orbit.altitude_km).filter(Number.isFinite).sort((a,b)=>a-b);return sourceStationModel.coverageRadiusKm(values.length?values[Math.floor(values.length/2)]:550,station.min_elevation_deg);},validateStation:sourceStationModel.validateStation,stationInteractionReady:()=>sourceGround.ready&&!groundNetworkPanel?.hasExternalChange(),selectStation:id=>sourceGround.select(id),readStations:()=>{if(!sourceGround.ready||groundNetworkPanel?.hasExternalChange())throw Error('지상국 설정을 다시 확인하세요.');return sourceGround.stations;},readFaults:()=>{const state=simPanel.controller.snapshot();if(!state.runtime||state.error)throw Error(state.error||'SIM 상태 미확인');return state.runtime.active_faults;},onChange:()=>{groundNetworkPanel?.update();notifyWorkspaceContext();}}});
void nodeWorkspace.start().then(()=>nodeWorkspace.show(view));
void modelSelection.load().then(()=>nodeWorkspace.refreshModels());
const hilPanel=createHilPanel(api,hilTopology,drawSparkline);
let uiMeasurement=null;
let sourceSecurityPanel=null,sourceSettingsPanel=null,sourceScenarioPanel=null,scenarioWorkspace=null;
const simPanel=createSimPanel(api,telemetrySocket,values=>missionPanel.controller.receiveMissions(values),{control:()=>nodeWorkspace?.beginFuturePassControl?.(),frame:value=>{kpiPanel.receive(value);hilPanel.receive(value);sourceSecurityPanel?.updateTelemetry(value);scenarioWorkspace?.runner.onTelemetry?.(value);sourceScenarioPanel?.update();notifyWorkspaceContext();},status:value=>{kpiPanel.connection(value);hilPanel.connection(value);sourceSecurityPanel?.updateSocket(value);sourceSettingsPanel?.update();notifyWorkspaceContext();}});
sourceSecurityPanel=createSourceSecurityPanel({api,document,host:window});
const removeScenarioRuntime=globe.bindScenarioRuntime(scenarioClockPorts.readRuntime,simRuntimeUtc,{projectDisplay:()=>{const p=scenarioWorkspace?.clock?.displayProjection?.();return p?{...p,utc:simUtcCodec.advance(new Date(p.time_ms).toISOString(),0)}:null;}});
const fabric=createFabricExchange({client:createDataFabricClient({fetchImpl:window.fetch.bind(window),storage:{getItem:key=>window.localStorage.getItem(key)},protocol:window.location?.protocol||'http:'}),network:nodeWorkspace,clientId:createBrowserId(window.crypto),onChange:()=>{groundNetworkPanel?.update();notifyWorkspaceContext();}});
const futurePassClientId=createBrowserId(window.crypto);let futurePassCounter=0;
futurePasses=createFuturePasses({api,inputs:nodeWorkspace,readDisplay:()=>globe.displayContext(),codec:simUtcCodec,nextRequestId:()=>`${futurePassClientId}:${++futurePassCounter}`,onChange:()=>groundNetworkPanel?.update()});
groundNetworkPanel=createGroundNetworkPanel({onRfLinkDraft:(link,context)=>rfPanel.applySourceLinkDraft(link,context),futurePasses,drawSparkline,store:sourceGround,model:sourceStationModel,network:nodeWorkspace,fabric,contactWindows:{query:options=>missionServices.queryContactWindows(options),verify:receipt=>missionServices.verifyContactWindows(receipt)},networkScene:{setActive:value=>nodeWorkspace.setNetworkVisualActive(value),setSnapshot:value=>nodeWorkspace.setNetworkScene(value),setGroundLinksVisible:value=>nodeWorkspace.setGroundLinksVisible(value),setCoverageVisible:value=>nodeWorkspace.setCoverageVisible(value),clear:()=>nodeWorkspace.clearNetworkScene()},diagram:{...networkDiagram,LINK_KIND_LABELS:sourceNetworkModel.LINK_KIND_LABELS,CUSTODY_LABELS:sourceNetworkModel.CUSTODY_LABELS},document,host:window,refreshRuntime:async()=>{await simPanel.controller.load();const state=simPanel.controller.snapshot();if(!state.runtime||state.error)throw Error(state.error||'SIM 상태 미확인');}});
const missionTypes=createMissionTypes(nodeLibrary);
const missionModule=createOrchestrationClient({fetchImpl:window.fetch.bind(window),storage:{getItem:key=>window.localStorage.getItem(key)},protocol:window.location?.protocol||'http:'});
let sourceMissionPanel=null;const missionClientId=createBrowserId(window.crypto);let missionCounter=0;
const removePeriodicFabric=nodeWorkspace?.bindPeriodicFabric?.({fabric,readRoute:()=>groundNetworkPanel?.routeRequest?.()??null,readSelectedLinkId:()=>groundNetworkPanel?.selectedLinkId?.()??null,onChange:()=>groundNetworkPanel?.update()})??(()=>{});
const missionServices=createMissionServices({api,nodes:nodeWorkspace,ground:{get ready(){return sourceGround.ready&&!groundNetworkPanel?.hasExternalChange()&&!sourceMissionPanel?.hasExternalChange();},get enabled(){return sourceGround.enabled;}},readRuntime:()=>{const s=simPanel.controller.snapshot();if(!s.runtime||s.error)throw Error(s.error||'SIM 상태 미확인');return s.runtime;},module:{...missionModule,status:async options=>{await simPanel.controller.load();return missionModule.status(options);}},readExternal:()=>{const s=catalogTimeline.snapshot();return !s.pending&&!s.error?s.selected:null;},library:nodeLibrary,groundLinks:createGroundLinkModel({library:nodeLibrary,stationModel:sourceStationModel}),model:missionTypes,constraints:createMissionConstraints({timeOf:missionTypes.timeOf}),codec:createUtcCodec(LEAP_SHA256),storage:groundStorage,nextRequestId:()=>`${missionClientId}:${++missionCounter}`,onChange:()=>{sourceMissionPanel?.update();groundNetworkPanel?.update();notifyWorkspaceContext();}});
sourceMissionPanel=createSourceMissionPanel({services:missionServices,model:missionTypes,layoutTimeline,timelineMarkup,document,host:window});
const sourceDataPanel=createSourceDataPanel({api,model:dataViewModel,document,host:window,drawSparkline,onContextChange:notifyWorkspaceContext});
sourceSettingsPanel=createSourceSettingsPanel({document,host:window,storage:groundStorage,probe:(body,options)=>api.integrationProbe(body,options),readSocket:()=>simPanel.controller.snapshot().connection,openDiagnostics:()=>{uiMeasurement??=installOrbitUiMeasurement(window);uiMeasurement.show();},canShowAttribution:()=>globe.canShowAttribution(),showAttribution:()=>globe.showAttribution(),bindAttributionAccess:()=>globe.bindAttributionAccess()});
analysisFollow=createAnalysisFollowCoordinator({stored:client,catalog:catalogTimeline,readRuntime:()=>simPanel.controller.snapshot().runtime,utcOfRuntime:simRuntimeUtc,codec:simUtcCodec});
scenarioWorkspace=createWorkspaceScenario({onControl:()=>nodeWorkspace?.beginFuturePassControl?.(),clockOwners:{receivedAt:()=>simPanel.controller.displayReceipt?.()?.received_at_ms,followAll:analysisFollow.followAll,releaseAll:analysisFollow.releaseAll,followedSource:analysisFollow.followedSource,align:analysisFollow.align},api,nodeWorkspace,ground:sourceGround,missionServices,fabric,simController:simPanel.controller,nodeLibrary,missionTypes,stationModel:sourceStationModel,assemblyFactory:createScenarioAssembly,kpi:scenarioKpi,storage:groundStorage,onRouteSpec:spec=>groundNetworkPanel?.adoptRouteDraft?.(spec)??false,onChange:()=>sourceScenarioPanel?.update(),switchTab:tab=>openWorkspaceView({nodes:'satellite',orbit:'satellite',communication:'ground',missions:'mission',data_management:'data',security:'security'}[tab]??tab)});
sourceScenarioPanel=createSourceScenarioPanel({onOpenTab:tab=>openWorkspaceView({nodes:'satellite',orbit:'satellite',communication:'ground',missions:'mission',data_management:'data',security:'security',status:'operations'}[tab]??tab),runner:scenarioWorkspace.runner,comparisonRows:scenarioKpi.comparisonRows,document,host:window,onResume:()=>scenarioWorkspace.resumePreflight(),onReviewFinished:()=>scenarioWorkspace.reviewFinishedInputs(),onFollow:()=>scenarioWorkspace.followAnalysis(),onRelease:()=>scenarioWorkspace.releaseAnalysis(),onStop:()=>scenarioWorkspace.stopReviewed()});
window.addEventListener('pagehide',event=>{if(!event.persisted){analysisFollow.destroy();sourceDataPanel.destroy();sourceSecurityPanel.destroy();sourceSettingsPanel.destroy();sourceScenarioPanel.destroy();scenarioWorkspace.destroy();removeScenarioRuntime();}});
const playback=createWorkspacePlayback(client,(snapshot,row,utc,error)=>{
  displayUtc=utc;displayElevation=row?`${row.elevation_deg.toFixed(4)}°`:'자료 준비 중 / 위치 미표시';globe.update(error?{...snapshot,status:'error',error}:snapshot,row,utc);
  const clock=document.getElementById('orbit-display-utc');if(clock)clock.textContent=utc||'미선택';
  const elevation=document.getElementById('orbit-display-elevation');if(elevation)elevation.textContent=displayElevation;
});
const removeWallModel=globe.observeModel?.(()=>{if(contextReady)updateWallDisplay();})??(()=>{});
let disposed=false;
window.addEventListener('pagehide',event=>{if(!event.persisted&&!disposed){disposed=true;removeWallModel();removePeriodicFabric();removeSatelliteHover();satelliteHover?.destroy();removeModelSelection();removeCatalogContinuity();nodeClock?.destroy();groundNetworkPanel?.destroy();futurePasses?.destroy();fabric.destroy();sourceGround.destroy();nodeWorkspace?.destroy();modelSelection.destroy();modelPanel.destroy();globeViewPanel.destroy();solar.destroy();revisionSync.destroy();client.destroy();groundPanel.destroy();rfPanel.destroy();planningPanel.destroy();radioPanel.destroy();seriesPanel.destroy();missionPanel.destroy();sourceMissionPanel.destroy();missionServices.destroy();simPanel.destroy();kpiPanel.destroy();hilPanel.destroy();catalogPanel.destroy();catalogGeometry.destroy();catalogTimePanel.destroy();catalogTimeline.destroy();catalogScene.destroy();catalogScenePanel.destroy();catalogPassPanel.destroy();catalogPasses.destroy();catalogTrack.destroy();stationPanel.destroy();playback.destroy();globe.destroy();}});
async function command(work){await work();const current=client.snapshot();if(current.status==='ready'&&!current.state?.playing)await client.samples({stepSeconds:1,count:3});}
let wallCatalogGeneration=0,wallCatalogRequest=null,wallReplica=null,wallMode='3d';
export function detachWorkspaceWall(){wallReplica?.destroy();wallReplica=null;}
export function mountWorkspaceWall(target,caption){detachWorkspaceWall();wallReplica=globe.createDisplayReplica(target,caption);if(!wallReplica)return false;nodeWorkspace.bindDisplayReplica(wallReplica);solar.bindDisplayReplica(wallReplica,document.getElementById('wall-solar-overlay'));wallReplica.setMode(wallMode);updateWallDisplay();return true;}
function updateWallDisplay(){
  if(!nodeWorkspace)return;
  if(view!=='wall'){nodeWorkspace.setSceneDisplayScope?.('all');globe.setDisplayVisibility?.({catalog:true,selected:true});return;}
  const own=wallSceneScope==='ours',selected=globe.modelState().selected;
  nodeWorkspace.setSceneDisplayScope('all');
  const row=selected?.catalog_number?catalogScene.row(selected.catalog_number):null;
  const selectedVisible=!!selected?.node_id&&nodeWorkspace.isSceneNodeDisplayed(selected.node_id)||!own&&!!row&&row.status==='valid'&&row.normalized_gp_sha256===selected.normalized_gp_sha256;
  globe.setDisplayVisibility({catalog:true,selected:true});wallReplica?.setCatalogVisible(!own);
  const source=catalogScene.snapshot(),context=nodeWorkspace.contextPresentation(),display=globe.displayContext();
  const status=document.getElementById('wall-scope-status');if(status)status.textContent=own?`우리 위성 · 프로젝트 배포 ${context?.deployed_count??0}개 · 배포와 일치하는 정의의 준비된 기하만 표시 · 표시 UTC ${display?.utc??'미제공'}`:`전체 위성 · 불러온 카탈로그 ${source.result?.count??0}개 / 유효 ${source.result?.valid_count??0} / 실패 ${source.result?.error_count??0} · 원본 snapshot UTC ${source.result?.utc??'미제공'} · 현재 표시 UTC ${display?.utc??'미제공'} · 전체 우주 위성 목록이 아닙니다.`;
  const toggle=document.getElementById('wall-whole');if(toggle){toggle.setAttribute('aria-pressed',String(!own));toggle.textContent=!own&&(source.pending||wallCatalogRequest?.pending)?'전체 위성 준비 중 · OFF':'전체 위성 '+(own?'OFF':'ON');toggle.disabled=false;}const mode=document.getElementById('wall-mode');if(mode)mode.value=wallMode;if(status&&!own){status.textContent+=` · 프로젝트 배포 ${context?.deployed_count??0}개 함께 표시${source.error?' · '+source.error:''}`;if(wallCatalogRequest)status.textContent+=` · ${wallCatalogRequest.pending?'조회 준비 중':'조회'} UTC ${wallCatalogRequest.utc||'기존 조회 초안 준비 중'}${wallCatalogRequest.error?' · '+wallCatalogRequest.error:''}`;const caption=document.getElementById('wall-globe-caption');if(caption&&!globe.displayContext()?.utc)caption.textContent=source.result?status.textContent:source.error||wallCatalogRequest?.error||`전체 카탈로그 ${source.pending||wallCatalogRequest?.pending?'조회 준비 중':'위치 미표시'} · 조회 UTC ${wallCatalogRequest?.utc||catalogScenePanel.requestUtc()} · GP 모델 / 실측 아님`;}
  const current=document.getElementById('wall-current-status');if(current){const value=readWorkspaceContext();current.textContent=`${value.text.satellite} · ${value.text.clock} · ${value.text.status}`;}
  if(own){if(status&&!context?.deployment_confirmed)status.textContent+=' · 로컬 배포 수락 미확인';const caption=document.getElementById('wall-globe-caption');if(caption&&!display?.utc)caption.textContent=status?.textContent||'프로젝트 배포의 현재 UTC 위치 미표시';}
}
export function resizeWorkspaceGlobe(){wallReplica?.resize();return globe.resize();}
export function observeWorkspaceModel(listener){return globe.observeModel?.(listener)??(()=>{});}
export function setWorkspaceWallMode(mode){if(disposed||!['2d','3d'].includes(mode))return false;wallMode=mode;wallReplica?.setMode(mode);updateWallDisplay();return true;}
async function requestWallCatalog(ticket){
 const current=()=>!disposed&&ticket===wallCatalogGeneration&&wallSceneScope==='whole'&&view==='wall';
 try{if(!catalogScene.snapshot().context){await catalogPanel.controller.load();if(!current())return;}if(!current())return;if(!catalogScene.snapshot().context)throw Error(catalogPanel.controller.snapshot().error||'카탈로그 조회 조건을 준비하지 못했습니다.');const utc=catalogScenePanel.requestUtc();wallCatalogRequest={pending:true,utc,error:''};updateWallDisplay();if(!current())return;await catalogScene.load(utc);}
 catch(error){if(current())wallCatalogRequest={pending:false,utc:wallCatalogRequest?.utc||'',error:String(error.message||error)};}
 finally{if(current()){if(wallCatalogRequest)wallCatalogRequest.pending=false;updateWallDisplay();}}
}
export function setWorkspaceWallScope(scope){if(disposed||!['ours','whole','toggle'].includes(scope))return false;const ticket=++wallCatalogGeneration;wallSceneScope=scope==='toggle'?(wallSceneScope==='ours'?'whole':'ours'):scope;wallCatalogRequest=null;updateWallDisplay();globe.resize();if(scope==='toggle'&&wallSceneScope==='whole'){const source=catalogScene.snapshot();if(!source.result&&!source.pending){wallCatalogRequest={pending:true,utc:'',error:''};updateWallDisplay();void requestWallCatalog(ticket);}}return true;}
function render(){
  groundNetworkPanel?.update();
  nodeWorkspace?.refresh();
  revisionSync.observe(client.snapshot());
  playback.update(client.snapshot());
  groundPanel.update();
  rfPanel.update();
  planningPanel.update();
  radioPanel.update();
  seriesPanel.update();
  missionPanel.update();
  sourceMissionPanel?.update();
  simPanel.update();
  kpiPanel.update();
  hilPanel.update();
  catalogPanel.update();
  catalogTimePanel.update();
  catalogScenePanel.update();
  catalogPassPanel.update();
  stationPanel.update();
  modelPanel.update();
  updateWallDisplay();
  if(view!=='satellite')return;
  const screen=document.getElementById('screen');let panel=document.getElementById('stored-orbit');
  if(!panel){panel=document.createElement('section');panel.id='stored-orbit';panel.className='panel';screen.prepend(panel);}
  const {inputs,state,result,status,error}=client.snapshot();
  const record=inputs.find(item=>item.input_id===state?.input_id);
  const oldUtc=document.getElementById('orbit-utc');const draft=oldUtc?.dataset?.dirty?oldUtc.value:null;
  const followed=storedTransport.source(),following=storedTransport.locked(),playing=followed?.running??state?.playing,rate=followed?.speed??state?.play_rate;
  const rates=[...new Set([.1,1,10,60,...(Number.isFinite(rate)&&rate>=.1&&rate<=128?[rate]:[])])].sort((a,b)=>a-b);
  const disabled=!record||status==='pending'||followPorts.pending()||(following&&!followed);
  const controls=`<div class="orbit-playback-controls"><button id="orbit-play" type="button" ${disabled||playing?'disabled':''}>재생</button><button id="orbit-pause" type="button" ${disabled||!playing?'disabled':''}>정지</button><label>속도 <select id="orbit-rate" ${disabled?'disabled':''}>${rates.map(value=>`<option value="${value}" ${value===rate?'selected':''}>${value}×</option>`).join('')}</select></label><label>UTC <input id="orbit-utc" ${draft!==null?'data-dirty="true"':''} type="text" value="${escape(draft??state?.current_utc??'')}" placeholder="YYYY-MM-DDTHH:mm:ss.sssssssssZ" ${disabled?'disabled':''}></label><button id="orbit-seek" type="button" ${disabled?'disabled':''}>UTC 적용·정지</button><button id="orbit-epoch" type="button" ${disabled?'disabled':''}>입력 epoch 복귀</button><p>표시 UTC <output id="orbit-display-utc">${escape(displayUtc||'미선택')}</output><br>표시 고도각 <output id="orbit-display-elevation">${escape(displayElevation)}</output></p><small>${following?'SIM 따라가기 · 제어는 기존 SIM 시계에 적용됩니다. ':''}1초 샘플만 보간합니다. 자료 밖에서는 위치를 표시하지 않습니다.</small></div>`;
  const age=record&&state?((Date.parse(state.current_utc)-Date.parse(record.epoch_utc))/3600000):NaN;
  panel.innerHTML=`<header><h2>저장 궤도 입력 · 실제 계산</h2><small>SGP4 모델 결과 / 실측 아님</small></header><div class="body">${controls}<p role="status">${escape(status)} ${escape(transportError||error||'')}</p><label>저장 입력 <select id="orbit-input"><option value="">입력 선택</option>${inputs.map(item=>`<option value="${escape(item.input_id)}" ${item.input_id===state?.input_id?'selected':''}>${escape(item.satellite_id)} / ${escape(item.format)}</option>`).join('')}</select></label><p>입력 epoch에서 시작합니다. OMM은 공개 TLE에서 파생한 동등 형식이며 현재 ISS 관측 자료가 아닙니다.</p>${record?`<dl><dt>출처</dt><dd>${escape(record.source)}</dd><dt>epoch UTC</dt><dd>${escape(record.epoch_utc)}</dd><dt>보존 UTC</dt><dd>${escape(record.fetched_utc)}</dd><dt>서버 UTC</dt><dd>${escape(state.current_utc)}</dd><dt>epoch 대비 경과</dt><dd>${Number.isFinite(age)?age.toFixed(3)+' h':'UTC 윤초 포함 시 단순 날짜 차이는 미표시'}</dd><dt>입력 SHA256</dt><dd style="overflow-wrap:anywhere">${escape(record.raw_sha256)}</dd></dl><button type="button" id="orbit-calculate" ${status==='pending'?'disabled':''}>${state.playing?"재생 버퍼 다시 계산":"현재 UTC부터 3개 샘플 계산"}</button>`:''}${status==='empty'?'<p>저장 입력이 없습니다. quickstart의 저장 입력 profile로 실행하세요.</p>':''}${result?`<p>ITRF 위치 m / 선택 가상 지점 고도각 ° · 실제 통신 조건 미확인</p><ul>${result.rows.slice(0,3).map(row=>`<li>${escape(row.utc)} / ${row.position_m?row.position_m.map(x=>Number(x).toFixed(2)).join(', '):'위치 계산 실패'} / ${row.elevation_deg==null?'고도각 없음':Number(row.elevation_deg).toFixed(4)+'°'} / ${escape(row.status)}</li>`).join('')}</ul><p>총 ${result.rows.length}행 / 앞 3행 미리보기 · revision ${escape(result.revision)} / ${escape(result.status)}</p>`:''}</div>`;
  panel.querySelector('#orbit-input').addEventListener('change',event=>{if(event.target.value){storedTransport.invalidate('저장 궤도 입력 변경');client.select(event.target.value);}else event.target.value=state?.input_id||'';});
  panel.querySelector('#orbit-calculate')?.addEventListener('click',()=>client.samples({startUtc:displayUtc||state.current_utc,stepSeconds:1,count:state.playing?601:3}));
  panel.querySelector('#orbit-play').addEventListener('click',()=>transport('play'));
  panel.querySelector('#orbit-pause').addEventListener('click',()=>transport('pause'));
  panel.querySelector('#orbit-rate').addEventListener('change',event=>transport('speed',Number(event.target.value)));
  panel.querySelector('#orbit-utc').addEventListener('input',event=>{event.target.dataset.dirty='true';});
  panel.querySelector('#orbit-seek').addEventListener('click',()=>{const field=panel.querySelector('#orbit-utc'),utc=field.value.trim();delete field.dataset.dirty;transport('seek',utc);});
  panel.querySelector('#orbit-epoch').addEventListener('click',()=>{delete panel.querySelector('#orbit-utc').dataset.dirty;transport('epoch',record.epoch_utc);});
}
// Projected poses render each frame; shared text is refreshed by the existing
// telemetry receipt callback, so it does not revalidate all mission proofs at FPS.
contextReady=true;const stopContextDisplay=globe.observeDisplayContext(value=>{if(!value?.projected)notifyWorkspaceContext();});
window.addEventListener('pagehide',event=>{if(!event.persisted){contextReady=false;stopContextDisplay();contextListeners.clear();}});
export function showWorkspaceOrbit(currentView){if(view==='wall'&&currentView!=='wall'){wallCatalogGeneration++;wallCatalogRequest=null;detachWorkspaceWall();}view=currentView;if(['integration','security','composer'].includes(view))simPanel.controller.connect();groundPanel.show(view);rfPanel.show(view);planningPanel.show(view);radioPanel.show(view);seriesPanel.show(view);missionPanel.show(view);simPanel.show(view);kpiPanel.show(view);hilPanel.show(view);catalogPanel.show(view);catalogTimePanel.show(view);catalogScenePanel.show(view);catalogPassPanel.show(view);stationPanel.show(view);if(view!=='settings')globeViewPanel.show(view);modelPanel.show(view);nodeWorkspace?.show(view);groundNetworkPanel?.show(view);sourceMissionPanel?.show(view);sourceDataPanel.show(view);sourceSecurityPanel.show(view);sourceSettingsPanel.show(view);if(view==='settings')globeViewPanel.show(view);sourceScenarioPanel.show(view);render();globe.resize?.();}
client.load();

export function applyWorkspaceDraft(items,remote=false){
  sourceSettingsPanel.applyDraft(items,remote);
  modelPanel.applyDraft(items);
  globeViewPanel.applyDraft(items);
  missionPanel.applyDraft(items,remote);
  simPanel.applyDraft(items);
  kpiPanel.applyDraft(items);
  hilPanel.applyDraft(items);
  catalogPanel.applyDraft(items);
  catalogTimePanel.applyDraft(items);
  catalogScenePanel.applyDraft(items);
  catalogPassPanel.applyDraft(items);
  groundPanel.applyDraft(items);
  rfPanel.applyDraft(items,remote);
  planningPanel.applyDraft(items,remote);
  radioPanel.applyDraft(items,remote);
  seriesPanel.applyDraft(items,remote);
  for(const item of items){if(item.id!=='orbit-utc'||typeof item.value!=='string')continue;const field=document.getElementById(item.id);if(field){field.value=item.value;field.dataset.dirty='true';}}
}
