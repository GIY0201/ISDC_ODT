import {createBrowserId} from './browser_identity.js';
import {createConstellationStore,DRAFT_KEY} from './nodes/constellation.js';
import {createNodeDisplayTimeline,createNodeSampleBufferAsync,isNodeCommunicationState} from './nodes/node_timeline.js';
import {createNodeOpticalTimeline} from './nodes/optical_timeline.js';
import {createOpticalDisplayScheduler} from './nodes/optical_display_scheduler.js';
import {createNodeLinkResolver} from './nodes/links.js';
import {createNodeNetworkTimeline} from './nodes/network_timeline.js';
import {createPeriodicFabricExchange} from './nodes/periodic_fabric_exchange.js';
import {createMixedRouteEmphasis} from './nodes/mixed_route_emphasis.js';
import {createDataDeployment} from './nodes/data_deployment.js';
import {createNodeEditorTools} from './nodes/editor.js';
import {createUtcCodec,LEAP_SHA256} from './orbit_utc.js';

// Application composition only. Native buffers, source store and shared globe retain ownership.
export function createWorkspaceNodes({api,globe,solar=null,library,orbitElements,catalogElements,oisl,Scene,NetworkScene=null,tools,document,host,now,resolveModel,models,fetchImpl,clockActions={},readClock=()=>({}),onHover=()=>{},networkInputs=null,scenarioClock=null}={}){
 const codec=createUtcCodec(LEAP_SHA256),advanceUtc=codec.advance;
 let dead=false,started=false,root=null,panel=null,scene=null,display=null,deployment=null,activeSelection=false,selectedSignature=null,definitionsSignature=null,error='';
 let networkScene=null,networkSceneInput=null,groundLinksVisible=true,coverageVisible=true,networkVisualActive=false,network=null,networkComposition=0,displayLease=null,replicaOptical=null;
 let tracks=true,links=true,modelsVisible=true;const readiness=new Map(),removers=[];
 let savedRecheckJob=null,savedRecheckPromise=null,savedReceiptKnown=null;
 let restorePromise=null,scenarioReceipt=null,networkFaultSignature=null,mixedRoute=null,periodicFabric=null,analyticalFabricBinding=null;
 let futureEpoch={},futureControlDepth=0;const futureInputs=new WeakMap();const rawInputs=new WeakMap();
 const revokeFuturePassInputs=()=>{futureEpoch={};mixedRoute?.clear();};
 function beginFuturePassControl(){revokeFuturePassInputs();futureControlDepth++;let released=false;return()=>{if(released)return;released=true;futureControlDepth--;};}
 function futurePassScope(stationId){
  if(dead||!started||!networkVisualActive||futureControlDepth||typeof networkInputs?.stationInteractionReady!=='function'||networkInputs.stationInteractionReady()!==true)throw Error('future pass configuration unavailable');
  const state=deployment.state,local=store.snapshot();
  if(!store.loaded||!store.deploymentConfirmed||store.error||store.isDirty()||state.disposed||state.error||state.busy||state.syncRequired||!state.server||!local.deployed.length||local.deployed.length>240||!deployment.matchesServer(local.receipt))throw Error('whole accepted deployment required');
  const stations=structuredClone(networkInputs.readStations());
  if(!Array.isArray(stations)||stations.length>24||new Set(stations.map(s=>s.id)).size!==stations.length)throw Error('complete station definitions required');
  for(const station of stations)if(networkInputs.validateStation(station).length)throw Error('invalid station definition');
  const station=stationId===null?stations.find(s=>s.enabled):stations.find(s=>s.id===stationId&&s.enabled);if(!station)throw Error('enabled station required');
  const context=structuredClone(typeof globe.displayContext==='function'?globe.displayContext():display);if(!context||projectedSim(context))throw Error('actual display required');
  const utc=advanceUtc(context.utc,0);if(utc!==context.utc||/T\d{2}:\d{2}:60/.test(utc)||!Number.isFinite(Date.parse(utc)))throw Error('unsupported analysis UTC');
  const clock=readClock(context),source={...context};delete source.utc;
  const lease=readContinuity?.()??null,natural=clock?.running===true;
  if(natural&&((context.source??context.key?.split(':')[0])!=='catalog'||!lease||verifyContinuity?.(lease)!==true)||!natural&&clock?.running!==false)throw Error('actual stopped clock or catalog continuity required');
  if(networkInputs.stationInteractionReady()!==true)throw Error('configuration changed');
  return {utc,nodes:local.deployed,station,deployment:state.server,source,natural,lease,key:JSON.stringify({nodes:local.deployed,receipt:local.receipt,deployment:state.server,stations,source})};
 }
 function verifyFuturePassInputs(value){
  const record=futureInputs.get(value);if(!record||record.revoked)return false;
  try{
   if(record.epoch!==futureEpoch||dead||futureControlDepth)throw Error('scope revoked');
   const a=futurePassScope(record.stationId),b=futurePassScope(record.stationId);
   if(a.key!==record.key||b.key!==record.key||a.natural!==record.natural||b.natural!==record.natural)throw Error('future inputs changed');
   if(record.natural?(a.lease!==record.lease||b.lease!==record.lease||verifyContinuity?.(record.lease)!==true):(a.utc!==record.utc||b.utc!==record.utc))throw Error('future display changed');
   if(record.epoch!==futureEpoch||dead||futureControlDepth)throw Error('scope revoked');return true;
  }catch{record.revoked=true;return false;}
 }
 function captureFuturePassInputs(stationId=null){
  if(stationId!==null&&typeof stationId!=='string')return null;const epoch=futureEpoch;
  try{const scope=futurePassScope(stationId);if(dead||futureControlDepth||epoch!==futureEpoch)return null;
   const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
   const value=freeze(structuredClone({presentation_kind:'FUTURE_PASS_INPUT_V1',analysis_utc:scope.utc,nodes:scope.nodes,station:scope.station,deployment:scope.deployment}));
   futureInputs.set(value,{epoch,stationId,key:scope.key,natural:scope.natural,lease:scope.lease,utc:scope.utc,revoked:false});return verifyFuturePassInputs(value)?value:null;
  }catch{return null;}
 }
 function analyticalScope(token){
  if(dead||!started||!networkVisualActive||futureControlDepth||networkInputs?.stationInteractionReady?.()!==true)throw Error('analytical configuration unavailable');
  const local=store.snapshot(),state=deployment.state,stations=structuredClone(networkInputs.readStations());
  if(!store.loaded||!store.deploymentConfirmed||store.error||store.isDirty()||state.disposed||state.error||state.busy||state.syncRequired||!state.server||!local.deployed.length||local.deployed.length>240||!deployment.matchesServer(local.receipt)||JSON.stringify(local.deployed)!==JSON.stringify(token.snapshot.node_definitions))throw Error('whole accepted native deployment required');
  if(!Array.isArray(stations)||stations.length>24||stations.some(station=>networkInputs.validateStation(station).length)||JSON.stringify(stations)!==JSON.stringify(token.snapshot.stations)||networkInputs.stationInteractionReady()!==true)throw Error('complete analytical station scope required');
  return JSON.stringify({nodes:local.deployed,receipt:local.receipt,server:state.server,stations});
 }
 function verifyRawAnalysis(token){
  const record=rawInputs.get(token);if(!record||record.revoked)return false;
  try{if(dead||futureControlDepth||record.epoch!==futureEpoch||network?.verifyRawAnalysis(token)!==true||analyticalScope(token)!==record.key||analyticalScope(token)!==record.key||network.verifyRawAnalysis(token)!==true||dead||futureControlDepth||record.epoch!==futureEpoch)throw Error('analytical command scope revoked');return true;}catch{record.revoked=true;return false;}
 }
 function captureRawAnalysis(){
  const epoch=futureEpoch;try{const token=network?.captureRawAnalysis();if(!token||network.verifyRawAnalysis(token)!==true)return null;const key=analyticalScope(token);if(dead||epoch!==futureEpoch)return null;rawInputs.set(token,{epoch,key,revoked:false});return verifyRawAnalysis(token)?token:null;}catch{return null;}
 }
 function bindPeriodicFabric({fabric,readRoute=()=>null,readSelectedLinkId=()=>null,onChange=()=>{}}={}){
  if(dead||periodicFabric)throw Error('periodic fabric is already bound or disposed');
  if(typeof readSelectedLinkId!=='function')throw TypeError('readonly selected link callback required');analyticalFabricBinding={fabric,readSelectedLinkId};mixedRoute.clearAnalytical();
  periodicFabric=createPeriodicFabricExchange({fabric,capture:captureRawAnalysis,verify:verifyRawAnalysis,readRoute,now:()=>host.performance?.now?.()??Date.now(),onChange});periodicFabric.setActive(networkVisualActive);if(started)opticalScheduler.start();const binding=periodicFabric,analyticalBinding=analyticalFabricBinding;
  return()=>{binding.destroy();if(periodicFabric===binding)periodicFabric=null;if(analyticalFabricBinding===analyticalBinding){analyticalFabricBinding=null;mixedRoute.clearAnalytical();}};
 }
 let applyingSelectedPose=false;
 let reviewedRevision=null,refreshingPanel=false;
 const id=()=>createBrowserId(host.crypto);
 const report=value=>{if(dead)return;error=String(value?.message??value);refreshPanel();};
 const projectedSim=value=>value?.source==='sim'&&value.projected===true;
 const readDisplay=()=>{if(projectedSim(display))throw Error('보간 SIM 표시는 실제 native 통신 입력이 아닙니다. SIM을 정지하여 검증하세요.');return {...readClock(display),utc:display?.utc??null};};
 const readAnalyticalDisplay=()=>{if(projectedSim(display))throw Error('보간 SIM 표시는 실제 native 통신 입력이 아닙니다. SIM을 정지하여 검증하세요.');return display?{...display,source:display.source??display.key?.split(':')[0]??null}:{utc:null,key:null,source:null};};
 const hasContinuity=typeof globe.captureDisplayContinuity==='function'&&typeof globe.verifyDisplayContinuity==='function';
 const readContinuity=hasContinuity?()=>dead?null:globe.captureDisplayContinuity():null;
 const verifyContinuity=hasContinuity?value=>!dead&&globe.verifyDisplayContinuity(value)===true:null;
 let storage=null;const storagePort={getItem:key=>host.localStorage.getItem(key),setItem:(key,value)=>host.localStorage.setItem(key,value)};
 try{if(host.localStorage)storage=storagePort;}catch{storage=storagePort;}
 const store=createConstellationStore({library,storage,now,verifyAcceptance:(...args)=>deployment?.verifyAcceptance(...args)===true&&(!savedRecheckJob||args[2]!=='restore'||savedRecheckCurrent(savedRecheckJob))});
 // HTTP source track grids use the source three-decimal-minute n0 period.
 const timeline=createNodeDisplayTimeline({api,periodFor:node=>Math.round(orbitElements(node.orbit)?.period/60*1000)/1000,requestId:id,yieldControl:()=>new Promise(resolve=>host.setTimeout(resolve,0)),onChange:(_snapshot,reason)=>{if(dead)return;if(reason?.kind==='communication'){refreshPanel({metadataOnly:true});return;}refreshPose();scene?.update(display?.utc??null);refreshPanel();},onError:report});
 let opticalScopeRevision=Object.freeze({});
 const optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),requestCommunicationStates:timeline.requestCommunicationStates,readNodes:()=>store.drafts,nodeScopeRevision:()=>dead?null:opticalScopeRevision,readDisplay:readAnalyticalDisplay,advanceUtc,readContinuity,verifyContinuity,onChange:value=>{if(dead)return;replicaOptical=value;const sampled=optical.sampledPresentation();if(sampled.status==='valid'&&optical.verifySampledPresentation(sampled,{utc:display?.utc}))scene?.update(display?.utc??null);else scene?.setLinks(value);refreshPanel();}});
 const opticalScheduler=createOpticalDisplayScheduler({readDisplay:readAnalyticalDisplay,readContinuity,verifyContinuity,
  requestSampled:async(_display,lease)=>{const ticket=networkComposition;if(verifyContinuity?.(lease)===true)displayLease=lease;await optical.updateSampled();if(!dead&&networkVisualActive&&ticket===networkComposition&&verifyContinuity?.(lease)===true)return network?.updateSampled();},
  requestExact:async value=>{const ticket=networkComposition;await optical.update();if(!dead&&networkVisualActive&&ticket===networkComposition&&display?.utc===value?.utc)return network?.update();},
  onAnalysisTick:()=>periodicFabric?.tick(),
  cancelSampled:()=>{networkComposition++;optical.cancelSampled();network?.cancelSampled();if(networkVisualActive&&!dead)networkInputs?.onChange?.();},onError:report,setTimer:host.setTimeout.bind(host),clearTimer:host.clearTimeout.bind(host)});
 const removeContinuity=hasContinuity&&typeof globe.observeDisplayContinuity==='function'?globe.observeDisplayContinuity(event=>{if(!dead){if(event?.phase==='invalidated')revokeFuturePassInputs();opticalScheduler.continuityEvent(event);}}):()=>{};
 // Communication consumers use these existing owners; no mutable owner escapes this port.
 network=networkInputs===null?null:createNodeNetworkTimeline({model:networkInputs.model,optical,
  requestCommunicationStates:timeline.requestCommunicationStates,readNodes:()=>{
   if(!started||!store.loaded)throw Error('노드 설정 불러오기 미완료');return store.drafts;
  },nodeScopeRevision:()=>dead?null:opticalScopeRevision,readDisplay:readAnalyticalDisplay,readContinuity,verifyContinuity,readStations:networkInputs.readStations,readFaults:networkInputs.readFaults,
  validateNode:library.validateNode,validateStation:networkInputs.validateStation,advanceUtc,
  onChange:value=>{if(!dead)networkInputs.onChange?.(value);}});
 mixedRoute=createMixedRouteEmphasis({readNetwork:()=>network?.snapshot(),verifyNetwork:value=>!dead&&network?.verifySnapshot(value)===true,readFabric:()=>networkInputs?.readFabricState?.(),readDisplay:()=>dead?null:display,readAnalyticalFabric:()=>dead||!networkVisualActive?null:analyticalFabricBinding?.fabric?.analyticalPresentation?.()??null,verifyAnalyticalFabric:value=>!dead&&networkVisualActive&&analyticalFabricBinding?.fabric?.verifyAnalyticalPresentation?.(value)===true,readSelectedLinkId:()=>analyticalFabricBinding?.readSelectedLinkId?.()??null,differenceUtc:codec.difference});
 const geometryFor=(node,at)=>timeline.geometryFor(node,at);
 const modelFor=node=>resolveModel(library.nodeCatalogItem(node));
 let sceneDisplayScope='all';
 function displayNodeIds(){
  if(sceneDisplayScope==='all')return null;if(sceneDisplayScope==='none')return [];
  const roster=store.presentationRoster(),accepted=new Map(roster.deployed.map(node=>[node.id,JSON.stringify(node)]));
  return roster.drafts.filter(node=>accepted.get(node.id)===JSON.stringify(node)).map(node=>node.id);
 }
 function applySceneDisplayScope(){scene?.setDisplayNodes?.(displayNodeIds());}
 function refreshPose(){
  if(dead||!activeSelection)return;
  const node=store.selected,geometry=node&&display?.utc?geometryFor(node,{utc:display.utc}):null;
  if(!node||!geometry||geometry.row?.status!=='valid'){
   if(selectedSignature!==null){selectedSignature=null;applyingSelectedPose=true;try{globe.clearSatelliteModel();}finally{applyingSelectedPose=false;}}return;
  }
  const match=modelFor(node),description={...match,url:modelsVisible?match?.url:null,pose_source:{kind:'source_node',node_definition:node,definition_hash:geometry.definition_hash}};
  const signature=JSON.stringify(description);if(signature===selectedSignature)return;selectedSignature=signature;
  applyingSelectedPose=true;try{globe.setSatelliteModel(description,{timeSource:()=>display?.utc??null,advanceUtc,sampleAt:utc=>{const current=store.selected;return current&&JSON.stringify(current)===JSON.stringify(node)?geometryFor(current,{utc}):null;}});}finally{applyingSelectedPose=false;}
  networkInputs?.onChange?.();
 }
 // Explicit node-selection intent is not an alternative selection authority.
 // Current target identity is read from the existing shared model owner.
 function selection(){
  if(dead||!activeSelection||!display?.utc||typeof globe.modelState!=='function')return null;
  const selected=globe.modelState().selected,node=store.selected,geometry=node&&geometryFor(node,{utc:display.utc});
  if(!node||selected?.node_id!==node.id||selected.definition_hash!==geometry?.definition_hash||geometry?.row?.status!=='valid'||geometry.row.error_code!==null)return null;
  return {domain:'source_node',id:node.id,definition_hash:geometry.definition_hash,utc:display.utc};
 }
 function select(){if(dead)return;if(!activeSelection)globe.clearSatelliteModel();activeSelection=true;scene?.select(store.selectedId);refreshPose();refreshPanel();}
 async function focus(){
  if(dead||!store.selected||!display?.utc||!geometryFor(store.selected,{utc:display.utc})||geometryFor(store.selected,{utc:display.utc}).row?.status!=='valid')return false;
  select();return globe.focusSatelliteModel({follow:true});
 }
 function syncDefinitions(){
  if(dead||!started||!store.loaded)return;const nodes=store.drafts,signature=JSON.stringify(nodes);
  if(signature!==definitionsSignature){definitionsSignature=signature;timeline.setDefinitions(nodes);optical.pruneHistories(new Set(nodes.map(n=>n.id)));network?.clear();refreshModels();if(display?.utc){if(hasContinuity)opticalScheduler.force();else void optical.update();}}
  scene?.select(activeSelection?store.selectedId:null);applySceneDisplayScope();refreshPose();refreshPanel();
 }
 function refreshModels(){
  if(dead)return;
  if(scene)void scene.setNodes(store.drafts.map(node=>({id:node.id,definition:node,model:modelFor(node),orbit_regime:library.nodeCatalogItem(node).ORBIT_REGIME}))).catch(report);
  applySceneDisplayScope();refreshPose();refreshPanel();
 }
 function refreshPanel(options){
  const metadataOnly=options?.metadataOnly===true;
  if(dead||refreshingPanel)return;
  refreshingPanel=true;
  try{
  if(!metadataOnly)panel?.refresh();if(dead||!root)return;
  // A panel callback can report errors or change definitions synchronously.
  // Read fresh owner metadata after callbacks; borrowed rosters stay readonly.
  const metadata=store.presentationMetadata();
  const state=deployment.contextPresentation(),ready=store.loaded&&state.server!==null&&!state.syncRequired&&!state.busy;
  const deploy=root.querySelector('#nodes-deploy'),recall=root.querySelector('#nodes-recall'),label=root.querySelector('#deploy-state');
  if(deploy)deploy.disabled=!ready||metadata.draft_count===0;
  const reapply=root.querySelector('#nodes-reapply');if(reapply){reapply.hidden=!state.syncRequired;reapply.disabled=!store.loaded||state.server===null||state.busy||!state.syncRequired||metadata.draft_count===0;}
  const reviewedRecall=root.querySelector('#nodes-recall-reviewed');if(reviewedRecall){reviewedRecall.hidden=!state.syncRequired;reviewedRecall.disabled=!store.loaded||state.server===null||state.busy||!state.syncRequired||state.server_count===0;}
  const serverReview=root.querySelector('#node-server-configuration');if(serverReview){serverReview.hidden=!state.syncRequired;serverReview.textContent=state.syncRequired&&state.server?deployment.reviewConfigurationJson():'';}
  if(recall)recall.disabled=!ready||state.server_count===0;
  if(label)label.textContent=error||store.error?.message||state.error||(state.busy?'서버 배치 처리 중':state.server?`서버 배치 revision ${state.server.revision} · ${metadata.dirty?'편집 변경 있음':'확인됨'}`:'서버 배치 미확인');
  const native=root.querySelector('#node-native-state'),retry=root.querySelector('#nodes-retry'),calculation=timeline.snapshot();
  if(native)native.textContent=calculation.error||(!display?.utc?'공용 표시 UTC를 먼저 선택하세요.':calculation.pending?'Rust 노드 계산 중':metadata.draft_count?'Kepler+J2 모의 계산 · 실제 통신 미확인':'작업 세트에 노드가 없습니다.');
  if(retry)retry.disabled=!display?.utc||metadata.draft_count===0||calculation.pending;
  const recheck=root.querySelector('#nodes-recheck-saved');if(recheck)recheck.disabled=!canRecheckSaved()||!!savedRecheckPromise;
  const restore=root.querySelector('#nodes-restore');if(restore)restore.disabled=!!restorePromise||(store.loaded&&state.server!==null&&!state.syncRequired&&!state.error);
  const summary=root.querySelector('#node-scene-summary');if(summary)summary.textContent=`공유 작업 세트 · 초안 ${metadata.draft_count}개 · 수락 배치 ${metadata.deployed_count}개 · ${store.deploymentConfirmed?'서버 수락 확인':'배치 수락 미확인'} · 표시 UTC ${display?.utc??'미제공'} · 실제 통신 미확인`;
  const definitions=root.querySelector('#node-scene-definitions');if(definitions&&reviewedRevision!==store.revision){reviewedRevision=store.revision;const roster=store.presentationRoster();definitions.textContent=JSON.stringify({drafts:roster.drafts,deployed:roster.deployed,selected_id:roster.selected_id},null,2);}
  }finally{refreshingPanel=false;}
 }
 function sceneSnapshot(){
  if(dead)return null;
  return structuredClone({drafts:store.drafts,deployed:store.deployed,selected_id:store.selectedId,revision:store.revision,loaded:store.loaded,deployment_confirmed:store.deploymentConfirmed,persistence:store.persistence,display,server:deployment.state.server,calculation:timeline.snapshot(),model_status:[...readiness.values()],error:error||store.error?.message||deployment.state.error||''});
 }
 function bindDisplayReplica(replica){
  if(dead||!replica||typeof replica.bindNodes!=='function')return false;
  return replica.bindNodes((cesium,viewer,ports)=>{
   const readonlyGeometry=(node,options)=>{const before=ports.readDisplayUtc();if(dead||!before)return null;const value=geometryFor(node,options);return !dead&&ports.readDisplayUtc()===before?value:null;};
   const nodeRenderer=new Scene({cesium,viewer,timeSource:ports.readDisplayUtc,advanceUtc,geometryFor:readonlyGeometry,displayGeometry:timeline.displayGeometry,pathFor:timeline.pathFor,pathRevisionFor:timeline.pathRevisionFor,tracksVisible:()=>tracks,palette:theme=>globe.palette?.(theme)??{},isTransitioning:ports.isTransitioning,sampledLinks:{read:()=>dead?null:optical.sampledPresentation(),verify:(value,options)=>!dead&&optical.verifySampledPresentation(value,options)===true},analyticalRouteEmphasis:{read:options=>dead||!networkVisualActive?null:mixedRoute.readAnalytical(options),verify:(value,options)=>!dead&&networkVisualActive&&mixedRoute.verifyAnalytical(value,options)},routeEmphasis:{read:options=>dead?null:mixedRoute.read(options),verify:(value,options)=>!dead&&mixedRoute.verify(value,options)},verifyLinkSnapshot:optical.verifyLinkSnapshot});
   const groundRenderer=NetworkScene&&network?new NetworkScene({cesium,viewer,timeSource:ports.readDisplayUtc,geometryFor:readonlyGeometry,verifyNetworkSnapshot:value=>!dead&&network.verifySnapshot(value),analyticalRouteEmphasis:{read:options=>dead||!networkVisualActive?null:mixedRoute.readAnalytical(options),verify:(value,options)=>!dead&&networkVisualActive&&mixedRoute.verifyAnalytical(value,options)},sampledNetwork:{read:()=>!dead&&networkVisualActive?network.sampledPresentation():null,verify:(value,options)=>!dead&&networkVisualActive&&network.verifySampledPresentation(value,options)===true},readFabricState:()=>networkInputs.readFabricState?.(),coverageRadiusKm:(station,snapshot)=>networkInputs.coverageRadiusKm?.(station,snapshot?.node_definitions??[])??0,isTransitioning:ports.isTransitioning}):null;
   let stopped=false,roster=null,selection=null,networkValue=null,opticalValue=null,theme=null;
   const isNodeDisplayed=id=>{if(stopped||dead)return false;const value=store.presentationRoster(),node=value.drafts.find(node=>node.id===id),accepted=value.deployed.find(node=>node.id===id);return !!node&&!!accepted&&JSON.stringify(node)===JSON.stringify(accepted);};
   const nativeNode=id=>{const utc=ports.readDisplayUtc(),node=store.find(id);if(stopped||dead||!utc||!isNodeDisplayed(id)||!node||ports.verifySource()!==true)return null;const value=readonlyGeometry(node,{utc});return value?.row?.status==='valid'&&value.row.error_code===null&&ports.readDisplayUtc()===utc&&ports.verifySource()===true?value:null;};
   const verifyStation=value=>{if(stopped||dead||!networkVisualActive||!groundRenderer||networkInputs.stationInteractionReady?.()!==true||ports.verifySource()!==true)return false;const station=networkInputs.readStations().find(station=>station.id===value?.id);return station?.enabled===true&&JSON.stringify(station)===JSON.stringify(value.station)&&groundRenderer.verifyStationPick(value)===true&&ports.verifySource()===true&&groundRenderer.verifyStationPick(value)===true&&!stopped&&!dead;};
   return {isNodeDisplayed,interaction:{owns(id,primitive,selectedModel){return nativeNode(id)!==null&&primitive?.show===true&&(selectedModel||[nodeRenderer.points.get(id),nodeRenderer.labels.get(id),nodeRenderer.models.get(id)?.model].includes(primitive))&&nativeNode(id)!==null&&!stopped&&!dead;},onSelect:id=>{if(nativeNode(id)){store.select(id);select();}}},groundInteraction:groundRenderer?{read:picked=>{const value=groundRenderer.stationPick(picked);return value&&verifyStation(value)?value:null;},verify:verifyStation,onSelect:value=>{if(verifyStation(value))networkInputs.selectStation?.(value.id);}}:null,syncFrame(utc,phase){
    if(stopped)return;const value=dead?null:store.presentationRoster();
    if(!value||!started){nodeRenderer.setDisplayNodes([]);nodeRenderer.syncFrame(null,phase);groundRenderer?.clear();return;}
    const currentTheme=globe.viewState?.().choice.theme??'light';if(theme!==currentTheme){theme=currentTheme;nodeRenderer.setTheme(theme);}if(roster!==value.drafts){roster=value.drafts;void nodeRenderer.setNodes(roster.map(node=>({id:node.id,definition:node,model:modelFor(node),orbit_regime:library.nodeCatalogItem(node).ORBIT_REGIME}))).catch(()=>{});}
    if(selection!==value.selected_id){selection=value.selected_id;nodeRenderer.select(selection);}
    const accepted=new Map(value.deployed.map(node=>[node.id,JSON.stringify(node)]));nodeRenderer.setDisplayNodes(value.drafts.filter(node=>accepted.get(node.id)===JSON.stringify(node)).map(node=>node.id));nodeRenderer.setModelsVisible(modelsVisible);nodeRenderer.setLinksVisible(links);if(opticalValue!==replicaOptical){opticalValue=replicaOptical;if(opticalValue)nodeRenderer.setLinks(opticalValue);}nodeRenderer.syncFrame(utc,phase);
    if(groundRenderer){groundRenderer.setSampledActive(networkVisualActive);groundRenderer.setGroundLinksVisible(groundLinksVisible);groundRenderer.setCoverageVisible(coverageVisible);if(networkValue!==networkSceneInput){networkValue=networkSceneInput;if(networkValue)groundRenderer.setSnapshot(networkValue);else groundRenderer.clear();}groundRenderer.syncFrame(utc,phase);}
   },destroy(){if(stopped)return;stopped=true;try{groundRenderer?.destroy();}finally{nodeRenderer.destroy();}}};
  });
 }
 function contextPresentation(){
  if(dead)return null;
  const accepted=deployment.contextPresentation(),local=store.contextPresentation(accepted.server_node_ids);
  return {...local,contract:'node-workspace-presentation-v1',server:accepted.server,error:error||local.error||accepted.error||'',nodeForSelection:store.nodeForPresentation,matchesDeployed:store.matchesDeployed,matchesServer:deployment.matchesServer,matchesServerNodes:deployment.matchesServerNodes};
 }
 const editorTools=createNodeEditorTools({library,catalogElements,now});
 deployment=createDataDeployment({constellation:store,fetchImpl,createId:id,setTimer:host.setTimeout.bind(host),clearTimer:host.clearTimeout.bind(host),onChange:()=>{revokeFuturePassInputs();refreshPanel();}});
 const removeStore=store.subscribe(()=>{savedReceiptKnown=null;if(savedRecheckJob)savedRecheckJob.invalidated=true;revokeFuturePassInputs();opticalScopeRevision=Object.freeze({});syncDefinitions();});
 const removeDisplay=globe.observeDisplayContext(value=>{
  if(dead)return;const previousUtc=display?.utc??null,wasProjected=projectedSim(display),previousSource=display?{...display}:null;if(previousSource)delete previousSource.utc;display=value?structuredClone(value):null;
  const lease=readContinuity?.()??null,sameContinuous=lease!==null&&lease===displayLease&&verifyContinuity?.(lease)===true;displayLease=lease;
  const nextSource=display?{...display}:null;if(nextSource)delete nextSource.utc;
  if(JSON.stringify(previousSource)!==JSON.stringify(nextSource)||previousUtc!==(display?.utc??null)&&!sameContinuous)revokeFuturePassInputs();
  if(previousUtc!==(display?.utc??null)&&!sameContinuous)network?.clear();
  if(display?.utc){void timeline.observe(display.utc);if(projectedSim(display)){if(!wasProjected)optical.resetHistories();}else if(hasContinuity)opticalScheduler.observe();else void optical.update();}else{timeline.clear();optical.resetHistories();opticalScheduler.observe();}
  refreshPose();refreshPanel();
 });
 const removeRenderer=globe.bindNodeRenderer((cesium,viewer)=>{
  scene=new Scene({cesium,viewer,timeSource:()=>display?.utc??null,advanceUtc,geometryFor,displayGeometry:timeline.displayGeometry,pathFor:timeline.pathFor,pathRevisionFor:timeline.pathRevisionFor,tracksVisible:()=>tracks,palette:theme=>globe.palette?.(theme)??{},isTransitioning:()=>typeof globe.isTransitioning==='function'?globe.isTransitioning():globe.viewState?.().mode.phase!=='ready',sampledLinks:{read:()=>dead?null:optical.sampledPresentation(),verify:(value,options)=>!dead&&optical.verifySampledPresentation(value,options)===true},analyticalRouteEmphasis:{read:options=>dead||!networkVisualActive?null:mixedRoute.readAnalytical(options),verify:(value,options)=>!dead&&networkVisualActive&&mixedRoute.verifyAnalytical(value,options)},routeEmphasis:{read:options=>dead?null:mixedRoute.read(options),verify:(value,options)=>!dead&&mixedRoute.verify(value,options)},verifyLinkSnapshot:optical.verifyLinkSnapshot,onStatus:value=>{if(dead)return;readiness.set(value.node_id,structuredClone(value));refreshPanel();}});
  scene.setTheme(globe.viewState?.().choice.theme??'dark');refreshModels();
  if(!NetworkScene||!network)return scene;
  const nodeRenderer=scene,groundRenderer=networkScene=new NetworkScene({cesium,viewer,timeSource:()=>display?.utc??null,geometryFor,verifyNetworkSnapshot:value=>!dead&&network.verifySnapshot(value),analyticalRouteEmphasis:{read:options=>dead||!networkVisualActive?null:mixedRoute.readAnalytical(options),verify:(value,options)=>!dead&&networkVisualActive&&mixedRoute.verifyAnalytical(value,options)},sampledNetwork:{read:()=>!dead&&networkVisualActive?network.sampledPresentation():null,verify:(value,options)=>!dead&&networkVisualActive&&network.verifySampledPresentation(value,options)===true},readFabricState:()=>networkInputs.readFabricState?.(),coverageRadiusKm:(station,snapshot)=>networkInputs.coverageRadiusKm?.(station,snapshot?.node_definitions??[])??0,isTransitioning:()=>typeof globe.isTransitioning==='function'?globe.isTransitioning():globe.viewState?.().mode.phase!=='ready'});
  groundRenderer.setSampledActive?.(networkVisualActive);
  groundRenderer.setGroundLinksVisible(groundLinksVisible);groundRenderer.setCoverageVisible(coverageVisible);if(networkSceneInput)groundRenderer.setSnapshot(networkSceneInput);
  return {syncFrame(...args){nodeRenderer.syncFrame(...args);groundRenderer.syncFrame(...args);},destroy(){try{groundRenderer.destroy();}finally{nodeRenderer.destroy();if(networkScene===groundRenderer)networkScene=null;}}};
 });
 const removeStatus=globe.observeNodeRenderer(refreshPanel);
 const removeView=globe.observeView?.(value=>{if(dead)return;scene?.setTheme(value.choice.theme);scene?.update(display?.utc??null);panel?.refreshScene?.();})??(()=>{});
 const removeLighting=solar?.observe(()=>{if(!dead)panel?.refreshScene?.();})??(()=>{});
 const removeCamera=globe.observeCamera?.(()=>{if(!dead)panel?.refreshScene?.();})??(()=>{});
 const removeModel=globe.observeModel?.(value=>{
  if(dead||applyingSelectedPose||!activeSelection)return;
  // A GP selection or an explicit model clear releases node selection. Late
  // native/model/definition notifications must not overwrite that newer owner.
  if(value?.selected?.node_id!==store.selectedId){activeSelection=false;selectedSignature=null;scene?.select(null);refreshPanel();networkInputs?.onChange?.();}
 })??(()=>{});
 function pickGeometry(id){
  if(dead||!started||!display?.utc||globe.nodeRendererState().phase!=='ready')return null;
  const node=store.find(id),geometry=node&&geometryFor(node,{utc:display.utc});return geometry?.row?.status==='valid'&&geometry.row.error_code===null?geometry:null;
 }
 function captureSourceNetworkNode(id){
  try{if(dead||!networkVisualActive||typeof id!=='string')return null;const utc=display?.utc,node=store.find(id),geometry=pickGeometry(id);if(!node||!geometry)return null;const value={id,utc,node,hash:geometry.definition_hash};if(dead||!networkVisualActive||display?.utc!==utc||JSON.stringify(store.find(id))!==JSON.stringify(node)||pickGeometry(id)?.definition_hash!==value.hash)return null;return value;}catch{return null;}
 }
 async function focusSourceNetworkNode(id){
  const value=captureSourceNetworkNode(id);if(!value)return false;
  try{store.select(id);select();if(dead||!networkVisualActive||display?.utc!==value.utc||store.selectedId!==id||JSON.stringify(store.find(id))!==JSON.stringify(value.node)||pickGeometry(id)?.definition_hash!==value.hash)return false;const result=await globe.focusSatelliteModel({follow:true}),current=captureSourceNetworkNode(id);return result===true&&current!==null&&current.utc===value.utc&&current.hash===value.hash&&JSON.stringify(current.node)===JSON.stringify(value.node)&&store.selectedId===id;}catch{return false;}
 }
 const removeInteraction=globe.bindNodeInteraction({
  owns:(id,primitive,selectedModel=false)=>{
   if(!pickGeometry(id)||!scene||scene.disposed)return false;
   if(selectedModel)return activeSelection&&store.selectedId===id&&selectedSignature!==null;
   return primitive?.show===true&&[scene.points?.get(id),scene.labels?.get(id),scene.models?.get(id)?.model].some(value=>value!==undefined&&value===primitive);
  },
  onSelect:id=>{if(!pickGeometry(id))return;try{store.select(id);select();}catch(value){report(value);}},
  onHover:(id,screen)=>{
   if(dead)return;const geometry=id&&pickGeometry(id),validId=geometry?id:null;
   if(scene?.hoveredId!==validId)scene?.setHovered(validId);
   const node=validId&&store.find(validId);
   onHover(node&&screen&&[screen.x,screen.y].every(Number.isFinite)?structuredClone({kind:'source_node',id:validId,item:library.nodeCatalogItem(node),node_geometry:geometry,screen}):null);
  },
 });
 function verifyGroundStation(value){
  const owner=networkScene,generation=networkComposition;
  const current=()=>!dead&&started&&networkVisualActive&&networkScene===owner&&generation===networkComposition;
  try{
   if(!current()||!owner||typeof owner.verifyStationPick!=='function'||typeof networkInputs?.stationInteractionReady!=='function'||networkInputs.stationInteractionReady()!==true||!current())return false;
   if(owner.verifyStationPick(value)!==true||!current())return false;
   const stations=networkInputs.readStations(),station=stations?.find(s=>s.id===value?.id);
   if(!current()||!station||station.enabled!==true||JSON.stringify(station)!==JSON.stringify(value.station))return false;
   if(owner.verifyStationPick(value)!==true||!current())return false;
   return networkInputs.stationInteractionReady()===true&&current();
  }catch{return false;}
 }
 function captureGroundStation(id){try{if(dead||!started||!networkVisualActive)return null;const value=networkScene?.captureStationPick?.(id);return verifyGroundStation(value)?value:null;}catch{return null;}}
 function focusGroundStation(value){
  if(!verifyGroundStation(value)||typeof globe.focusGroundNetworkStation!=='function')return false;
  try{return globe.focusGroundNetworkStation(structuredClone(value.station),{verify:()=>verifyGroundStation(value)})===true;}catch{return false;}
 }
 const removeGroundInteraction=globe.bindGroundNetworkInteraction?.({
  read:picked=>{try{if(dead||!networkVisualActive)return null;const value=networkScene?.stationPick?.(picked);return verifyGroundStation(value)?value:null;}catch{return null;}},
  verify:verifyGroundStation,
  onSelect:value=>{if(!verifyGroundStation(value)||typeof networkInputs?.selectStation!=='function')return false;try{return networkInputs.selectStation(value.id)===value.id;}catch(cause){report(cause);return false;}},
  onFocus:focusGroundStation,
 })??(()=>{});
 const external=event=>{if(!dead&&event.key===DRAFT_KEY)store.receiveExternalDraft(event.newValue);};host.addEventListener('storage',external);
 function show(view){
  if(dead||!started)return;
  if(!['satellite','scene','composer'].includes(view)){if(root)root.hidden=true;return;}
  if(root&&!document.getElementById('satellite-nodes')){panel?.destroy();root=null;panel=null;reviewedRevision=null;for(const remove of removers.splice(0))remove();}
  if(!root){
   root=document.createElement('section');root.id='satellite-nodes';root.className='panel';root.innerHTML=tools.workPanelMarkup({sampledLinks:true})+'<p role="status" id="node-native-state"></p><button type="button" id="nodes-retry">노드 계산 다시 시도</button><button type="button" id="nodes-restore">초안 복원·서버 조회 재시도</button><button type="button" id="nodes-recheck-saved">저장 배치 재확인</button><p role="status" id="node-scene-summary"></p><details><summary>공유 노드 정의 확인 · 초안과 수락 배치</summary><pre id="node-scene-definitions" style="max-height:24rem;overflow:auto;white-space:pre-wrap"></pre></details><pre id="node-server-configuration" aria-label="조회한 서버 배치 구성" style="max-height:16rem;overflow:auto"></pre><button type="button" id="nodes-reapply">서버 구성 확인 후 초안 재적용</button><button type="button" id="nodes-recall-reviewed">서버 구성 확인 후 배치 회수</button>';document.getElementById('screen').prepend(root);
   panel=tools.createNodeWorkPanel({root,store,readPresentation:()=>dead?null:store.presentationRoster(),editorTools,now,timers:{set:host.setTimeout.bind(host),clear:host.clearTimeout.bind(host)},createFormationId:id,readDisplay,viewport:()=>({width:host.innerWidth,height:host.innerHeight}),scrollTarget:host,geometryFor,linksFor:()=>optical.snapshot(),linksPresentationFor:()=>dead?null:optical.presentation(),verifyLinkPresentation:optical.verifyPresentation,sampledLinksPresentationFor:()=>dead?null:optical.sampledPresentation(),verifySampledLinkPresentation:(value,options)=>!dead&&optical.verifySampledPresentation(value,options)===true,verifyLinkSnapshot:optical.verifyLinkSnapshot,oislPresentation:oisl,modelFor,modelReadinessFor:node=>readiness.get(node.id)??null,models,onModelChange:key=>resolveModel({model_key:key}),confirmClear:()=>host.confirm('작업 세트의 모든 노드를 삭제할까요?'),onDefinitionsChanged:syncDefinitions,onResetTerminals:optical.resetHistories,onSelected:select,onFocus:focus,onError:report,
    readScene:()=>({ready:globe.nodeRendererState().phase==='ready',cameraReady:globe.cameraState?.().ready===true,lighting:solar?.state().enabled,zoom:globe.cameraState?.().zoom??null,tracks,links,models:modelsVisible}),actions:{...clockActions,setLighting:value=>!dead&&(solar?.setEnabled(value)??false),home:()=>!dead&&globe.home?.(),zoomBy:value=>!dead&&globe.zoomBy?.(value),setZoom:value=>!dead&&globe.setZoom?.(value),untrack:options=>!dead&&globe.releaseSatelliteModel(options),toggleTracks:()=>{tracks=!tracks;scene?.update(display?.utc??null);refreshPanel();},setLinksVisible:value=>{const next=Boolean(value);if(next!==links)mixedRoute.clearAnalytical();links=next;scene?.setLinksVisible(value);refreshPanel();},setModelsVisible:value=>{modelsVisible=value;scene?.setModelsVisible(value);refreshPose();refreshPanel();}}});
   for(const [key,action]of [['nodes-deploy',()=>deployment.deploy()],['nodes-recall',()=>deployment.recall()],['nodes-reapply',()=>deployment.deploy()],['nodes-recall-reviewed',()=>deployment.recall()]]){const button=root.querySelector('#'+key),handler=()=>{if(dead||button.disabled)return;error='';void action().catch(report);};button.addEventListener('click',handler);removers.push(()=>button.removeEventListener('click',handler));}
   const restore=root.querySelector('#nodes-restore');if(restore){const handler=()=>{if(dead||restore.disabled)return;void retryRestore();};restore.addEventListener('click',handler);removers.push(()=>restore.removeEventListener('click',handler));}
   const recheck=root.querySelector('#nodes-recheck-saved');if(recheck){const handler=()=>{if(dead||recheck.disabled||root?.hidden)return;void recheckSavedDeployment();};recheck.addEventListener('click',handler);removers.push(()=>recheck.removeEventListener('click',handler));}
   const retry=root.querySelector('#nodes-retry');if(retry){const handler=()=>{if(dead||retry.disabled)return;error='';optical.resetHistories();void timeline.retry().then(()=>optical.update()).catch(report);};retry.addEventListener('click',handler);removers.push(()=>retry.removeEventListener('click',handler));}
  }
  root.hidden=false;refreshPanel();
 }
 const savedSignature=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 function savedLocalScope(){const value=store.snapshot();return savedSignature({drafts:value.drafts,deployed:value.deployed,receipt:value.receipt});}
 function canRecheckSaved(){try{const local=store.contextPresentation(),state=deployment.contextPresentation();if(dead||!started||!local.loaded||local.error||local.deployment_confirmed||!local.drafts_equal_deployed||state.busy||state.syncRequired||state.error||state.server===null||!local.deployed_count)return false;if(savedReceiptKnown===null)savedReceiptKnown=store.snapshot().receipt!==null;return savedReceiptKnown;}catch{return false;}}
 function savedRecheckCurrent(job){return !dead&&!job.invalidated&&savedRecheckJob===job&&job.root.isConnected!==false&&root===job.root&&document.getElementById('satellite-nodes')===job.root&&!store.error&&store.loaded&&savedLocalScope()===job.scope;}
 function recheckSavedDeployment(){
  if(savedRecheckPromise)return savedRecheckPromise;if(!canRecheckSaved()||!root||root.hidden)return Promise.resolve(null);
  const local=store.snapshot(),job={root,scope:savedLocalScope()};savedRecheckJob=job;error='';
  savedRecheckPromise=deployment.reacceptCachedDeployment(structuredClone(local.receipt),structuredClone(local.deployed)).catch(cause=>{if(savedRecheckCurrent(job))report(cause);return null;}).finally(()=>{if(savedRecheckJob===job){savedRecheckJob=null;savedRecheckPromise=null;if(!dead&&root===job.root)refreshPanel();}});refreshPanel();return savedRecheckPromise;
 }
 function retryRestore(){
  if(dead)return Promise.resolve(null);if(restorePromise)return restorePromise;
  restorePromise=Promise.resolve().then(async()=>{
   if(dead)return null;error='';
   try{if(!store.loaded)store.load();syncDefinitions();if(!dead)await (deployment.state.server===null?deployment.initialize():deployment.refresh());}catch(value){report(value);}
   return dead?null:deployment.state;
  }).finally(()=>{restorePromise=null;refreshPanel();});refreshPanel();return restorePromise;
 }
 function simUtc(){
  const state=scenarioClock?.readRuntime?.();
  if(!state||state.mode!=='SIM'||typeof state.run_id!=='string'||!state.run_id||typeof state.running!=='boolean'||!Number.isFinite(state.elapsed_seconds)||state.elapsed_seconds<0||!state.started_at)throw Error('실제 SIM owner 상태를 확인하세요.');
  return codec.advance(typeof scenarioClock.utcOfRuntime==='function'?scenarioClock.utcOfRuntime(state):codec.advance(state.started_at,state.elapsed_seconds),0);
 }
 function scenarioReady(){
  if(dead||!started||!store.loaded||store.error||deployment.state.server===null||deployment.state.busy||deployment.state.syncRequired||deployment.state.error)throw Error('기존 노드 초안과 서버 배치 조회를 먼저 확인하세요.');
  if(!scenarioClock||['readRuntime','setDisplayUtc','clearDisplayUtc'].some(k=>typeof scenarioClock[k]!=='function'))throw Error('공용 SIM 표시 owner 연결이 없습니다.');
  simUtc();
 }
 async function preflightSimScenario({definition,nodes}={}){
  scenarioReady();const before=JSON.stringify(store.snapshot()),runtime=scenarioClock.readRuntime(),run=runtime.run_id;
  if(!definition?.id||!Array.isArray(nodes)||nodes.length<1||nodes.length>240||nodes.some(n=>library.validateNode(n).length))throw Error('원본 시나리오 노드 정의를 확인하세요.');
  const utc=simUtc(),request={request_id:id()+'-scenario-preflight',nodes:structuredClone(nodes),start_utc:utc,count:1,step_seconds:1};
  const reply=await api.nodeSamples(request);
  const buffer=await createNodeSampleBufferAsync(request,reply,{yieldControl:()=>new Promise(resolve=>host.setTimeout(resolve,0))});
  if(dead||JSON.stringify(store.snapshot())!==before||scenarioClock.readRuntime().run_id!==run)throw Error('시나리오 검토 중 현재 실행 또는 초안이 바뀌었습니다.');
  if(nodes.some(node=>!buffer.communicationStateFor(node,{utc})))throw Error('원본 시나리오 전체 노드의 native 입력을 검증하지 못했습니다.');
  return true;
 }
 async function prepareSimUtc(value){
  scenarioReady();const runtime=scenarioClock.readRuntime(),utc=codec.advance(value,0);
  if(runtime.running!==false)throw Error('native SIM 입력 검증 전에 실제 SIM을 정지하세요.');
  if(utc!==simUtc())throw Error('요청 UTC가 현재 실제 SIM UTC와 다릅니다.');
  if(!store.deploymentConfirmed||store.deployed.length===0||store.isDirty()||deployment.state.server.run_id!==runtime.run_id)throw Error('현재 SIM 실행의 수락 배치 roster를 먼저 확인하세요.');
  const definitions=store.deployed,scope=JSON.stringify(definitions),accepted=JSON.stringify(deployment.state.server);
  const exactRequest=timeline.requestCommunicationStates(utc);void exactRequest.catch(()=>{});
  if(await scenarioClock.setDisplayUtc({run_id:runtime.run_id,utc,leap_sha256:LEAP_SHA256})!==true)throw Error('공용 SIM 표시 UTC가 수락되지 않았습니다.');
  const authoritative=typeof globe.displayContext==='function'?globe.displayContext():display;
  if(authoritative?.key!=='sim:'+runtime.run_id||authoritative.utc!==utc)throw Error('공용 표시 owner가 현재 SIM UTC와 일치하지 않습니다.');
  const result=await exactRequest;
  if(dead||scenarioClock.readRuntime().running!==false||simUtc()!==utc||JSON.stringify(store.deployed)!==scope||JSON.stringify(deployment.state.server)!==accepted||JSON.stringify(result.node_definitions)!==scope||result.states.length!==definitions.length||result.states.some(([nodeId,state],i)=>nodeId!==definitions[i].id||!isNodeCommunicationState(state,{node:definitions[i],utc})))throw Error('native SIM 입력 수락 중 UTC 또는 배치 정의가 바뀌었습니다.');
  await optical.update();
  scenarioReceipt=structuredClone({run_id:runtime.run_id,utc,nodes:definitions,deployment:deployment.state.server,states:result.states});
  return structuredClone(scenarioReceipt);
 }
 function verifySimUtc(receipt,value){
  try{scenarioReady();const utc=codec.advance(value,0),runtime=scenarioClock.readRuntime();return JSON.stringify(receipt)===JSON.stringify(scenarioReceipt)&&runtime.running===false&&receipt?.run_id===runtime.run_id&&receipt.utc===utc&&utc===simUtc()&&(typeof globe.displayContext==='function'?globe.displayContext():display)?.key==='sim:'+runtime.run_id&&(typeof globe.displayContext==='function'?globe.displayContext():display)?.utc===utc&&store.deploymentConfirmed&&!store.isDirty()&&JSON.stringify(receipt.nodes)===JSON.stringify(store.deployed)&&JSON.stringify(receipt.deployment)===JSON.stringify(deployment.state.server)&&receipt.states.length===receipt.nodes.length&&receipt.states.every(([id,state],i)=>id===receipt.nodes[i].id&&isNodeCommunicationState(state,{node:receipt.nodes[i],utc}));}catch{return false;}
 }
 const scenarioPorts=Object.freeze({store,deployment,nodeLibrary:library,preflightSimScenario,prepareSimUtc,verifySimUtc,simUtc,releaseDisplay(){const runtime=scenarioClock?.readRuntime?.();return runtime?scenarioClock?.clearDisplayUtc?.(runtime.run_id)??false:false;}});
 return Object.freeze({
  async start(){if(dead||started)return;started=true;const result=await retryRestore();if(!dead&&(hasContinuity||periodicFabric))opticalScheduler.start();return result;},retryRestore,
  scenarioPorts:()=>scenarioPorts,
  setSceneDisplayScope(scope){if(dead||!['all','deployed','none'].includes(scope))return false;sceneDisplayScope=scope;applySceneDisplayScope();return true;},
  isSceneNodeDisplayed(id){if(dead)return false;const ids=displayNodeIds();return ids===null||ids.includes(String(id));},
  show,refresh:refreshPanel,refreshModels,sceneSnapshot,contextPresentation,selection,bindDisplayReplica,captureFuturePassInputs,verifyFuturePassInputs,beginFuturePassControl,snapshot:()=>({display:display?structuredClone(display):null,timeline:timeline.snapshot(),deployment:deployment.state,error}),
  missionInputs(){
   const state=deployment.state;
   if(dead||!started||!store.loaded||!store.deploymentConfirmed||store.deployed.length===0||store.error||state.server===null||state.syncRequired||state.busy||store.isDirty())throw Error('위성 설정을 불러오고 현재 초안을 서버에 배치하세요.');
   const clock=readDisplay();if(!clock.utc)throw Error('공용 표시 UTC를 먼저 선택하세요.');
   if(clock.running!==false)throw Error('임무 계산 전에 분석 시계를 정지하세요.');
   return structuredClone({nodes:store.deployed,utc:clock.utc,deployment:state.server});
  },
  updateMissionLinks:()=>dead?Promise.reject(Error('위성 작업 창이 종료되었습니다.')):optical.update(),
  verifyMissionLinks:(...args)=>!dead&&optical.verifyLinkSnapshot(...args)===true,
  setNetworkScene:value=>{if(dead)return false;networkSceneInput=value?structuredClone(value):null;if(networkSceneInput)mixedRoute.capture(networkSceneInput);else mixedRoute.clear();return networkScene?.setSnapshot(networkSceneInput??{})??false;},
  setGroundLinksVisible:value=>{if(dead)return;const next=Boolean(value);if(next!==groundLinksVisible)mixedRoute.clearAnalytical();groundLinksVisible=next;networkScene?.setGroundLinksVisible(groundLinksVisible);},
  setCoverageVisible:value=>{if(dead)return;const next=Boolean(value);if(next!==coverageVisible)mixedRoute.clearAnalytical();coverageVisible=next;networkScene?.setCoverageVisible(coverageVisible);},
  canFocusSourceNetworkNode:id=>captureSourceNetworkNode(id)!==null,focusSourceNetworkNode,
  canFocusGroundNetworkStation:id=>captureGroundStation(id)!==null,
  focusGroundNetworkStation:id=>{const value=captureGroundStation(id);return value!==null&&focusGroundStation(value);},
  setNetworkVisualActive:value=>{if(dead)return;const active=value===true;if(networkVisualActive===active)return;revokeFuturePassInputs();networkVisualActive=active;periodicFabric?.setActive(active);networkComposition++;networkScene?.setSampledActive?.(active);if(active)opticalScheduler.force();else network?.cancelSampled();},
  clearNetworkScene:()=>{revokeFuturePassInputs();networkVisualActive=false;periodicFabric?.setActive(false);networkComposition++;network?.cancelSampled();networkScene?.setSampledActive?.(false);networkSceneInput=null;networkScene?.clear();},
  updateNetwork:()=>dead?Promise.resolve(null):network?.update()??Promise.resolve(null),
  // UI status/time only; full receipts remain on the original action/render ports.
  networkPresentation:()=>{
   if(dead||!network)return {proof:null,verified:false};
   if(typeof network.presentation==='function')return network.presentation();
   const proof=network.snapshot();return {proof,verified:proof?network.verifySnapshot(proof)===true:false};
  },
  readAnalyticalRoute:options=>dead||!networkVisualActive?null:mixedRoute.readAnalytical(options),verifyAnalyticalRoute:(value,options)=>!dead&&networkVisualActive&&mixedRoute.verifyAnalytical(value,options),
  captureRawAnalysis,verifyRawAnalysis,bindPeriodicFabric,
  networkSnapshot:()=>dead?null:network?.snapshot()??null,
  networkSampledPresentation:()=>dead?null:network?.sampledPresentation()??null,
  verifySampledNetworkPresentation:(value,options)=>!dead&&network?.verifySampledPresentation(value,options)===true,
  verifyNetworkSnapshot:value=>!dead&&network?.verifySnapshot(value)===true,
  clearNetwork:()=>{if(dead)return;revokeFuturePassInputs();networkComposition++;network?.clear();if(networkVisualActive)opticalScheduler.force();},
  observeNetworkInputs(){
   if(dead||!network)return;
   let signature;try{signature=JSON.stringify({faults:networkInputs.readFaults()});}catch{signature='unavailable';}
   if(signature===networkFaultSignature)return;
   const previous=networkFaultSignature;networkFaultSignature=signature;
   if(previous===null)return;
   networkComposition++;network.clear();if(networkVisualActive)opticalScheduler.force();
  },
  destroy(){if(dead)return;dead=true;scenarioReceipt=null;mixedRoute.destroy();periodicFabric?.destroy();opticalScheduler.destroy();removeContinuity();try{onHover(null);}catch{/* Scoped presentation cleanup. */}for(const remove of removers.splice(0))remove();removeStore();removeDisplay();removeStatus();removeView();removeLighting();removeCamera();removeModel();removeInteraction();removeGroundInteraction();removeRenderer();host.removeEventListener('storage',external);panel?.destroy();root?.remove();network?.destroy();optical.destroy();timeline.destroy();deployment.destroy();if(activeSelection)globe.clearSatelliteModel();scene=null;panel=null;root=null;},
 });
}
