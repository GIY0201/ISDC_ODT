import {createBrowserId} from './browser_identity.js';
import {createConstellationStore,DRAFT_KEY} from './nodes/constellation.js';
import {createNodeDisplayTimeline} from './nodes/node_timeline.js';
import {createNodeOpticalTimeline} from './nodes/optical_timeline.js';
import {createNodeLinkResolver} from './nodes/links.js';
import {createDataDeployment} from './nodes/data_deployment.js';
import {createNodeEditorTools} from './nodes/editor.js';
import {createUtcCodec,LEAP_SHA256} from './orbit_utc.js';

// Application composition only. Native buffers, source store and shared globe retain ownership.
export function createWorkspaceNodes({api,globe,solar=null,library,orbitElements,catalogElements,oisl,Scene,tools,document,host,now,resolveModel,models,fetchImpl,clockActions={},readClock=()=>({}),onHover=()=>{}}={}){
 const codec=createUtcCodec(LEAP_SHA256),advanceUtc=codec.advance;
 let dead=false,started=false,root=null,panel=null,scene=null,display=null,deployment=null,activeSelection=false,selectedSignature=null,definitionsSignature=null,error='';
 let tracks=true,links=true,modelsVisible=true;const readiness=new Map(),removers=[];
 let restorePromise=null;
 let reviewedRevision=null;
 const id=()=>createBrowserId(host.crypto);
 const report=value=>{if(dead)return;error=String(value?.message??value);refreshPanel();};
 const readDisplay=()=>({...readClock(display),utc:display?.utc??null});
 let storage=null;const storagePort={getItem:key=>host.localStorage.getItem(key),setItem:(key,value)=>host.localStorage.setItem(key,value)};
 try{if(host.localStorage)storage=storagePort;}catch{storage=storagePort;}
 const store=createConstellationStore({library,storage,now,verifyAcceptance:(...args)=>deployment?.verifyAcceptance(...args)===true});
 const timeline=createNodeDisplayTimeline({api,periodFor:node=>orbitElements(node.orbit)?.period/60,requestId:id,yieldControl:()=>new Promise(resolve=>host.setTimeout(resolve,0)),onChange:()=>{if(dead)return;refreshPose();scene?.update(display?.utc??null);refreshPanel();},onError:report});
 const optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),requestCommunicationStates:timeline.requestCommunicationStates,readNodes:()=>store.drafts,readDisplay,advanceUtc,onChange:value=>{if(dead)return;scene?.setLinks(value);refreshPanel();}});
 const geometryFor=(node,at)=>timeline.geometryFor(node,at);
 const modelFor=node=>resolveModel(library.nodeCatalogItem(node));
 function refreshPose(){
  if(dead||!activeSelection)return;
  const node=store.selected,geometry=node&&display?.utc?geometryFor(node,{utc:display.utc}):null;
  if(!node||!geometry||geometry.row?.status!=='valid'){
   if(selectedSignature!==null){selectedSignature=null;globe.clearSatelliteModel();}return;
  }
  const match=modelFor(node),description={...match,url:modelsVisible?match?.url:null,pose_source:{kind:'source_node',node_definition:node,definition_hash:geometry.definition_hash}};
  const signature=JSON.stringify(description);if(signature===selectedSignature)return;selectedSignature=signature;
  globe.setSatelliteModel(description,{timeSource:()=>display?.utc??null,advanceUtc,sampleAt:utc=>{const current=store.selected;return current&&JSON.stringify(current)===JSON.stringify(node)?geometryFor(current,{utc}):null;}});
 }
 function select(){if(dead)return;if(!activeSelection)globe.clearSatelliteModel();activeSelection=true;scene?.select(store.selectedId);refreshPose();refreshPanel();}
 async function focus(){
  if(dead||!store.selected||!display?.utc||!geometryFor(store.selected,{utc:display.utc})||geometryFor(store.selected,{utc:display.utc}).row?.status!=='valid')return false;
  select();return globe.focusSatelliteModel({follow:true});
 }
 function syncDefinitions(){
  if(dead||!started||!store.loaded)return;const nodes=store.drafts,signature=JSON.stringify(nodes);
  if(signature!==definitionsSignature){definitionsSignature=signature;timeline.setDefinitions(nodes);optical.pruneHistories(new Set(nodes.map(n=>n.id)));refreshModels();if(display?.utc)void optical.update();}
  scene?.select(activeSelection?store.selectedId:null);refreshPose();refreshPanel();
 }
 function refreshModels(){
  if(dead)return;
  if(scene)void scene.setNodes(store.drafts.map(node=>({id:node.id,definition:node,model:modelFor(node),orbit_regime:library.nodeCatalogItem(node).ORBIT_REGIME}))).catch(report);
  refreshPose();refreshPanel();
 }
 function refreshPanel(){
  if(dead)return;panel?.refresh();if(!root)return;
  const state=deployment.state,ready=store.loaded&&state.server!==null&&!state.syncRequired&&!state.busy;
  const deploy=root.querySelector('#nodes-deploy'),recall=root.querySelector('#nodes-recall'),label=root.querySelector('#deploy-state');
  if(deploy)deploy.disabled=!ready||store.drafts.length===0;
  const reapply=root.querySelector('#nodes-reapply');if(reapply){reapply.hidden=!state.syncRequired;reapply.disabled=!store.loaded||state.server===null||state.busy||!state.syncRequired||store.drafts.length===0;}
  const reviewedRecall=root.querySelector('#nodes-recall-reviewed');if(reviewedRecall){reviewedRecall.hidden=!state.syncRequired;reviewedRecall.disabled=!store.loaded||state.server===null||state.busy||!state.syncRequired||state.server.nodes.length===0;}
  const serverReview=root.querySelector('#node-server-configuration');if(serverReview){serverReview.hidden=!state.syncRequired;serverReview.textContent=state.syncRequired&&state.server?JSON.stringify(state.server,null,2):'';}
  if(recall)recall.disabled=!ready||state.server.nodes.length===0;
  if(label)label.textContent=error||store.error?.message||state.error||(state.busy?'서버 배치 처리 중':state.server?`서버 배치 revision ${state.server.revision} · ${store.isDirty()?'편집 변경 있음':'확인됨'}`:'서버 배치 미확인');
  const native=root.querySelector('#node-native-state'),retry=root.querySelector('#nodes-retry'),calculation=timeline.snapshot();
  if(native)native.textContent=calculation.error||(!display?.utc?'공용 표시 UTC를 먼저 선택하세요.':calculation.pending?'Rust 노드 계산 중':store.drafts.length?'Kepler+J2 모의 계산 · 실제 통신 미확인':'작업 세트에 노드가 없습니다.');
  if(retry)retry.disabled=!display?.utc||store.drafts.length===0||calculation.pending;
  const restore=root.querySelector('#nodes-restore');if(restore)restore.disabled=!!restorePromise||(store.loaded&&state.server!==null&&!state.syncRequired&&!state.error);
  const summary=root.querySelector('#node-scene-summary');if(summary)summary.textContent=`공유 작업 세트 · 초안 ${store.drafts.length}개 · 수락 배치 ${store.deployed.length}개 · ${store.deploymentConfirmed?'서버 수락 확인':'배치 수락 미확인'} · 표시 UTC ${display?.utc??'미제공'} · 실제 통신 미확인`;
  const definitions=root.querySelector('#node-scene-definitions');if(definitions&&reviewedRevision!==store.revision){reviewedRevision=store.revision;definitions.textContent=JSON.stringify({drafts:store.drafts,deployed:store.deployed,selected_id:store.selectedId},null,2);}
 }
 function sceneSnapshot(){
  if(dead)return null;
  return structuredClone({drafts:store.drafts,deployed:store.deployed,selected_id:store.selectedId,revision:store.revision,loaded:store.loaded,deployment_confirmed:store.deploymentConfirmed,persistence:store.persistence,display,server:deployment.state.server,calculation:timeline.snapshot(),model_status:[...readiness.values()],error:error||store.error?.message||deployment.state.error||''});
 }
 const editorTools=createNodeEditorTools({library,catalogElements,now});
 deployment=createDataDeployment({constellation:store,fetchImpl,createId:id,setTimer:host.setTimeout.bind(host),clearTimer:host.clearTimeout.bind(host),onChange:refreshPanel});
 const removeStore=store.subscribe(()=>syncDefinitions());
 const removeDisplay=globe.observeDisplayContext(value=>{
  if(dead)return;display=value?structuredClone(value):null;
  if(display?.utc){void timeline.observe(display.utc);void optical.update();}else{timeline.clear();optical.resetHistories();}
  refreshPose();refreshPanel();
 });
 const removeRenderer=globe.bindNodeRenderer((cesium,viewer)=>{
  scene=new Scene({cesium,viewer,timeSource:()=>display?.utc??null,advanceUtc,geometryFor,pathFor:timeline.pathFor,pathRevisionFor:timeline.pathRevisionFor,tracksVisible:()=>tracks,palette:theme=>globe.palette?.(theme)??{},isTransitioning:()=>globe.viewState?.().mode.phase!=='ready',verifyLinkSnapshot:optical.verifyLinkSnapshot,onStatus:value=>{if(dead)return;readiness.set(value.node_id,structuredClone(value));refreshPanel();}});
  scene.setTheme(globe.viewState?.().choice.theme??'dark');refreshModels();return scene;
 });
 const removeStatus=globe.observeNodeRenderer(refreshPanel);
 const removeView=globe.observeView?.(value=>{if(dead)return;scene?.setTheme(value.choice.theme);scene?.update(display?.utc??null);panel?.refreshScene?.();})??(()=>{});
 const removeLighting=solar?.observe(()=>{if(!dead)panel?.refreshScene?.();})??(()=>{});
 const removeCamera=globe.observeCamera?.(()=>{if(!dead)panel?.refreshScene?.();})??(()=>{});
 function pickGeometry(id){
  if(dead||!started||!display?.utc||globe.nodeRendererState().phase!=='ready')return null;
  const node=store.find(id),geometry=node&&geometryFor(node,{utc:display.utc});return geometry?.row?.status==='valid'&&geometry.row.error_code===null?geometry:null;
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
 const external=event=>{if(!dead&&event.key===DRAFT_KEY)store.receiveExternalDraft(event.newValue);};host.addEventListener('storage',external);
 function show(view){
  if(dead||!started)return;
  if(!['satellite','scene','composer'].includes(view)){if(root)root.hidden=true;return;}
  if(root&&!document.getElementById('satellite-nodes')){panel?.destroy();root=null;panel=null;reviewedRevision=null;for(const remove of removers.splice(0))remove();}
  if(!root){
   root=document.createElement('section');root.id='satellite-nodes';root.className='panel';root.innerHTML=tools.workPanelMarkup()+'<p role="status" id="node-native-state"></p><button type="button" id="nodes-retry">노드 계산 다시 시도</button><button type="button" id="nodes-restore">초안 복원·서버 조회 재시도</button><p role="status" id="node-scene-summary"></p><details><summary>공유 노드 정의 확인 · 초안과 수락 배치</summary><pre id="node-scene-definitions" style="max-height:24rem;overflow:auto;white-space:pre-wrap"></pre></details><pre id="node-server-configuration" aria-label="조회한 서버 배치 구성" style="max-height:16rem;overflow:auto"></pre><button type="button" id="nodes-reapply">서버 구성 확인 후 초안 재적용</button><button type="button" id="nodes-recall-reviewed">서버 구성 확인 후 배치 회수</button>';document.getElementById('screen').prepend(root);
   panel=tools.createNodeWorkPanel({root,store,editorTools,now,timers:{set:host.setTimeout.bind(host),clear:host.clearTimeout.bind(host)},createFormationId:id,readDisplay,viewport:()=>({width:host.innerWidth,height:host.innerHeight}),scrollTarget:host,geometryFor,linksFor:()=>optical.snapshot(),verifyLinkSnapshot:optical.verifyLinkSnapshot,oislPresentation:oisl,modelFor,modelReadinessFor:node=>readiness.get(node.id)??null,models,onModelChange:key=>resolveModel({model_key:key}),confirmClear:()=>host.confirm('작업 세트의 모든 노드를 삭제할까요?'),onDefinitionsChanged:syncDefinitions,onResetTerminals:optical.resetHistories,onSelected:select,onFocus:focus,onError:report,
    readScene:()=>({ready:globe.nodeRendererState().phase==='ready',cameraReady:globe.cameraState?.().ready===true,lighting:solar?.state().enabled,zoom:globe.cameraState?.().zoom??null,tracks,links,models:modelsVisible}),actions:{...clockActions,setLighting:value=>!dead&&(solar?.setEnabled(value)??false),home:()=>!dead&&globe.home?.(),zoomBy:value=>!dead&&globe.zoomBy?.(value),setZoom:value=>!dead&&globe.setZoom?.(value),untrack:options=>!dead&&globe.releaseSatelliteModel(options),toggleTracks:()=>{tracks=!tracks;scene?.update(display?.utc??null);refreshPanel();},setLinksVisible:value=>{links=value;scene?.setLinksVisible(value);refreshPanel();},setModelsVisible:value=>{modelsVisible=value;scene?.setModelsVisible(value);refreshPose();refreshPanel();}}});
   for(const [key,action]of [['nodes-deploy',()=>deployment.deploy()],['nodes-recall',()=>deployment.recall()],['nodes-reapply',()=>deployment.deploy()],['nodes-recall-reviewed',()=>deployment.recall()]]){const button=root.querySelector('#'+key),handler=()=>{if(dead||button.disabled)return;error='';void action().catch(report);};button.addEventListener('click',handler);removers.push(()=>button.removeEventListener('click',handler));}
   const restore=root.querySelector('#nodes-restore');if(restore){const handler=()=>{if(dead||restore.disabled)return;void retryRestore();};restore.addEventListener('click',handler);removers.push(()=>restore.removeEventListener('click',handler));}
   const retry=root.querySelector('#nodes-retry');if(retry){const handler=()=>{if(dead||retry.disabled)return;error='';optical.resetHistories();void timeline.retry().then(()=>optical.update()).catch(report);};retry.addEventListener('click',handler);removers.push(()=>retry.removeEventListener('click',handler));}
  }
  root.hidden=false;refreshPanel();
 }
 function retryRestore(){
  if(dead)return Promise.resolve(null);if(restorePromise)return restorePromise;
  restorePromise=Promise.resolve().then(async()=>{
   if(dead)return null;error='';
   try{if(!store.loaded)store.load();syncDefinitions();if(!dead)await (deployment.state.server===null?deployment.initialize():deployment.refresh());}catch(value){report(value);}
   return dead?null:deployment.state;
  }).finally(()=>{restorePromise=null;refreshPanel();});refreshPanel();return restorePromise;
 }
 return Object.freeze({
  async start(){if(dead||started)return;started=true;return retryRestore();},retryRestore,
  show,refresh:refreshPanel,refreshModels,sceneSnapshot,snapshot:()=>({display:display?structuredClone(display):null,timeline:timeline.snapshot(),deployment:deployment.state,error}),
  destroy(){if(dead)return;dead=true;try{onHover(null);}catch{/* Scoped presentation cleanup. */}for(const remove of removers.splice(0))remove();removeStore();removeDisplay();removeStatus();removeView();removeLighting();removeCamera();removeInteraction();removeRenderer();host.removeEventListener('storage',external);panel?.destroy();root?.remove();optical.destroy();timeline.destroy();deployment.destroy();if(activeSelection)globe.clearSatelliteModel();scene=null;panel=null;root=null;},
 });
}
