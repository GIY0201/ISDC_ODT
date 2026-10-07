import {OrbitGlobe} from '/static/visualization/orbit_globe.js?v=t136-r1';
import {LEAP_SHA256,createUtcCodec} from './orbit_utc.js';

/** Render-only copy, never a clock/selection authority. One controller per document. */
export function createWorkspaceGlobe(container,status,focusButton,host=window){
  let globe=null,latest=null,catalog=null,sceneInput=null,sceneMetadata=null,trackInput=null,onCatalogSelect=()=>{},groundPoint=null,disposed=false,failed=false,removeError=null,focused=false,stations=[],selectedStation=null,onStationSelect=()=>{};
  let displayVisibility={catalog:true,selected:true};
  const displayReplicas=new Set(),renderProofs=new WeakMap(),renderCopies=new WeakMap();let replicaProvider=null,renderCache=null;
  const freezeRender=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeRender(child);Object.freeze(value);}return value;};
  function renderProjection(){
    const context=displayContext(),key=JSON.stringify(context),refs=[latest,catalog,sceneCopy,trackInput,stations,selectedStation,groundPoint,modelDescription,modelSource,scenarioContext];
    if(renderCache&&renderCache.key===key&&refs.every((value,index)=>value===renderCache.refs[index]))return renderCache.value;
    const borrow=item=>{if(!item||typeof item!=='object')return item;let value=renderCopies.get(item);if(!value){value=freezeRender(structuredClone(item));renderCopies.set(item,value);}return value;};
    const value=freezeRender({context:borrow(context),selected:borrow(scenarioContext?null:validPosition(catalog)?catalog:latest),scene:borrow(scenarioContext?null:sceneCopy),track:borrow(scenarioContext?null:trackInput),stations:borrow(stations),selectedStation,groundPoint:borrow(groundPoint),model:borrow(modelDescription)});
    const runtime=context?.projected?JSON.stringify(scenarioBinding.readRuntime()):null;
    renderCache={key,refs,value};renderProofs.set(value,{key,refs,runtime,binding:scenarioBinding});return value;
  }
  function verifyRenderProjection(value){const proof=renderProofs.get(value);if(!proof)return false;const reject=()=>{renderProofs.delete(value);if(renderCache?.value===value)renderCache=null;return false;};if(disposed||failed||!globe)return reject();try{
    const context=displayContext();if(!context)return reject();
    const scope=item=>{if(!item)return null;const{utc,projection_age_ms,...rest}=item;return rest;};
    const timeCurrent=value.context?.projected?Boolean(context?.projected)&&context.projection_age_ms>=value.context.projection_age_ms&&JSON.stringify(scope(context))===JSON.stringify(scope(value.context))&&proof.binding===scenarioBinding&&JSON.stringify(scenarioBinding.readRuntime())===proof.runtime:JSON.stringify(context)===proof.key;
    return timeCurrent&&[latest,catalog,sceneCopy,trackInput,stations,selectedStation,groundPoint,modelDescription,modelSource,scenarioContext].every((item,index)=>item===proof.refs[index])&&!disposed&&!failed&&!!globe&&proof.binding===scenarioBinding||reject();
  }catch{return reject();}}
  function syncDisplayReplicas(){for(const replica of [...displayReplicas])replica.sync();}
  let catalogLabelsVisible=true,attributionBinding=null;
  let choice={mode:'3d',imagery:'blue_marble',theme:'light',emphasis:true},imagery={requestedImagery:'blue_marble',displayedImagery:null,phase:'pending',error:null},mode={phase:'ready',error:null},modeRevision=0;
  const viewObservers=new Set();
  const displayObservers=new Set();let displayKey=null,solarFactory=null,solarRenderer=null;
  let catalogContinuity=null,continuityCache=null,continuityEpoch=0,continuitySourceKey=null;
  const continuityProofs=new WeakMap(),continuityObservers=new Set();
  const sameCatalogIdentity=(a,b)=>Boolean(a&&b)&&['catalog_number','normalized_gp_sha256','leap_sha256','eop_sha256'].every(key=>a[key]===b[key]);
  function catalogIdentity(){
    const current=displayContext();
    if(!current||scenarioContext||!validPosition(catalog)||catalog.status!=='valid'||current.key!==`catalog:${catalog.catalog_number}:${catalog.normalized_gp_sha256}`)return null;
    return {catalog_number:catalog.catalog_number,normalized_gp_sha256:catalog.normalized_gp_sha256,leap_sha256:catalog.leap_sha256,eop_sha256:catalog.eop_sha256};
  }
  function notifyContinuity(event){
    if(disposed)return;
    if(!event||!['invalidated','settled','availability'].includes(event.phase)||typeof event.reason!=='string')return;
    if(event.phase!=='settled')continuityEpoch++;
    continuityCache=null;
    for(const fn of continuityObservers){try{fn({phase:event.phase,reason:event.reason});}catch{/* A readonly observer cannot own clock control. */}}
  }
  function verifyDisplayContinuity(value){
    if(disposed||failed)return false;
    const proof=continuityProofs.get(value),binding=catalogContinuity;
    if(!proof||proof.binding!==binding||proof.epoch!==continuityEpoch)return false;
    try{
      const before=catalogIdentity();
      if(!sameCatalogIdentity(before,proof.identity)||binding.port.isCurrent(proof.lease,{...before})!==true)return false;
      const after=catalogIdentity();
      return !disposed&&!failed&&catalogContinuity===binding&&proof.epoch===continuityEpoch&&sameCatalogIdentity(after,before)&&binding.port.isCurrent(proof.lease,{...after})===true&&sameCatalogIdentity(catalogIdentity(),after)&&catalogContinuity===binding&&proof.epoch===continuityEpoch&&!disposed&&!failed;
    }catch{return false;}
  }
  function captureDisplayContinuity(){
    if(disposed||failed||!catalogContinuity)return null;
    const binding=catalogContinuity,epoch=continuityEpoch,before=catalogIdentity();if(!before||epoch!==continuityEpoch)return null;
    try{
      const lease=binding.port.capture();
      if(!lease||epoch!==continuityEpoch||catalogContinuity!==binding||!sameCatalogIdentity(catalogIdentity(),before)||epoch!==continuityEpoch||binding.port.isCurrent(lease,{...before})!==true||epoch!==continuityEpoch||catalogContinuity!==binding)return null;
      if(continuityCache?.binding===binding&&continuityCache.lease===lease&&sameCatalogIdentity(continuityCache.identity,before)&&verifyDisplayContinuity(continuityCache.value))return continuityCache.value;
      if(epoch!==continuityEpoch||catalogContinuity!==binding)return null;
      const value=Object.freeze({}),proof={binding,lease,identity:before,value,epoch};continuityProofs.set(value,proof);
      if(!verifyDisplayContinuity(value))return null;
      continuityCache=proof;return value;
    }catch{return null;}
  }
  const cameraObservers=new Set();let cameraKey=null;
  const cameraState=()=>!disposed&&!failed&&globe?globe.cameraState?.()??{ready:false,zoom:null}:{ready:false,zoom:null};
  function notifyCamera(){const value=cameraState(),key=JSON.stringify(value);if(key===cameraKey)return;cameraKey=key;for(const fn of cameraObservers){try{fn({...value});}catch{/* Readonly camera observer. */}}}
  let nodeBinding=null;const nodeObservers=new Set();
  let nodeInteractionBinding=null;
  let groundInteractionBinding=null;
  function attachGroundInteraction(){
    const binding=groundInteractionBinding,owner=globe;if(!owner||disposed||failed)return;
    if(!binding){owner.setGroundNetworkInteraction?.(null);return;}
    const viewer=owner.viewer;
    const current=()=>!disposed&&!failed&&mode.phase==='ready'&&groundInteractionBinding===binding&&globe===owner&&owner.viewer===viewer;
    owner.setGroundNetworkInteraction?.({
      read:picked=>{if(!current())return null;const value=binding.interaction.read(picked);return current()?value:null;},
      verify:value=>current()&&binding.interaction.verify(value)===true&&current(),
      onSelect:value=>{if(current()&&binding.interaction.verify(value)===true&&current())binding.interaction.onSelect?.(value);},
      onFocus:value=>{if(current()&&binding.interaction.verify(value)===true&&current())binding.interaction.onFocus?.(value);},
    });
  }
  function attachNodeInteraction(){
    const binding=nodeInteractionBinding,owner=globe;if(!owner||disposed)return;
    if(!binding){owner.setNodeInteraction?.(null);return;}
    const current=()=>!disposed&&!failed&&nodeInteractionBinding===binding&&globe===owner;
    owner.setNodeInteraction({owns:(...args)=>current()&&binding.interaction.owns(...args)===true,onSelect:id=>{if(current())binding.interaction.onSelect?.(id);},onHover:(id,screen)=>{if(current())binding.interaction.onHover?.(id,screen?{...screen}:null);}});
  }
  const nodeRendererState=()=>({phase:disposed?'unavailable':nodeBinding?.phase??'unavailable',error:nodeBinding?.error??null});
  function notifyNodes(){globe?.refreshNodeHover?.();for(const fn of nodeObservers){try{fn(structuredClone(nodeRendererState()));}catch{/* A display observer cannot own renderer resources. */}}}
  function detachNodes(binding=nodeBinding){
    if(!binding)return;
    const remove=binding.removeFrame,renderer=binding.renderer;binding.removeFrame=null;binding.renderer=null;
    try{remove?.();}catch{/* The shared scene may already be unavailable. */}
    try{renderer?.destroy();}catch{/* Release other owners even when optional node cleanup fails. */}
  }
  function attachNodes(){
    const binding=nodeBinding,owner=globe;
    if(!binding||binding.renderer||disposed)return;
    if(failed){binding.phase='unavailable';notifyNodes();return;}
    if(!owner)return;
    let renderer;
    try{
      renderer=binding.factory(host.Cesium,owner.viewer);
      if(typeof renderer?.syncFrame!=='function'||typeof renderer?.destroy!=='function')throw new TypeError('node renderer lifecycle required');
      if(nodeBinding!==binding||disposed||failed||owner!==globe){const stale=renderer;renderer=null;try{stale.destroy();}catch{/* Stale renderer cleanup cannot own its replacement. */}return;}
      binding.renderer=renderer;
      const frames=owner.viewer.scene.preRender;
      if(typeof frames?.addEventListener!=='function')throw new Error('shared node render frame unavailable');
      const frame=()=>{
        if(nodeBinding!==binding||binding.renderer!==renderer||disposed||failed||owner!==globe)return;
        try{
          const phase=host.performance?.now?.();
          notifyDisplay();
          renderer.syncFrame(displayContext()?.utc??null,Number.isFinite(phase)?phase:0);
          owner.refreshNodeHover?.();
          notifyCamera();
        }catch(error){binding.phase='error';binding.error=String(error?.message||error);detachNodes(binding);notifyNodes();}
      };
      binding.removeFrame=frames.addEventListener(frame);binding.phase='ready';binding.error=null;notifyNodes();
    }catch(error){
      if(binding.renderer)detachNodes(binding);else try{renderer?.destroy?.();}catch{/* Invalid factory resource. */}
      if(nodeBinding===binding&&!disposed){binding.phase='error';binding.error=String(error?.message||error);notifyNodes();}
    }
  }
  let scenarioBinding=null,scenarioContext=null,sceneCopy=null;const scenarioUtcCodec=createUtcCodec(LEAP_SHA256);
  function validScenarioContext(candidate=scenarioContext){
    if(!candidate||!scenarioBinding||candidate.leap_sha256!==LEAP_SHA256||typeof candidate.run_id!=='string'||!candidate.run_id||typeof candidate.utc!=='string')return null;
    try{
      if(scenarioUtcCodec.advance(candidate.utc,0)!==candidate.utc)return null;
      const runtime=scenarioBinding.readRuntime();if(!runtime||runtime.run_id!==candidate.run_id)return null;
      const exactUtc=scenarioBinding.utcOfRuntime(runtime);
      if(runtime.running===false){if(typeof scenarioBinding.projectDisplay!=='function'&&exactUtc!==candidate.utc)return null;const pausedUtc=typeof scenarioBinding.projectDisplay==='function'?exactUtc:candidate.utc;if(scenarioUtcCodec.advance(pausedUtc,0)!==pausedUtc)return null;return{key:`sim:${candidate.run_id}`,utc:pausedUtc,leap_sha256:LEAP_SHA256,eop_sha256:null,source:'sim'};}
      const projected=scenarioBinding.projectDisplay?.(runtime);
      if(runtime.running!==true||!Number.isFinite(runtime.speed)||runtime.speed<.1||runtime.speed>128||!Number.isFinite(runtime.elapsed_seconds)||!Number.isSafeInteger(runtime.sequence)||!projected||projected.run_id!==runtime.run_id||projected.sequence!==runtime.sequence||projected.elapsed_seconds!==runtime.elapsed_seconds||projected.projected!==true||!Number.isFinite(projected.age_ms)||projected.age_ms<0||projected.age_ms>3500||scenarioUtcCodec.advance(projected.utc,0)!==projected.utc)return null;
      const delta=scenarioUtcCodec.difference(projected.utc,exactUtc);
      if(!Number.isFinite(delta)||delta<0||Math.abs(delta-projected.age_ms/1000*runtime.speed)>.002)return null;
      return{key:`sim:${candidate.run_id}`,utc:projected.utc,leap_sha256:LEAP_SHA256,eop_sha256:null,source:'sim',projected:true,runtime_sequence:runtime.sequence,runtime_elapsed_seconds:runtime.elapsed_seconds,projection_age_ms:projected.age_ms,quality:'engineering_assumption',time_model:'unix_ms_utc_approx',frame:'EARTH_FIXED_GMST_UTC_APPROX'};
    }catch{return null;}
  }
  const validPosition=value=>value?.frame==='ITRF'&&value.status!=='error'&&!value.error_code&&typeof value.utc==='string'&&value.utc.endsWith('Z')&&Array.isArray(value.position_m)&&value.position_m.length===3&&value.position_m.every(Number.isFinite);
  function displayContext(){
    if(!globe||failed||disposed)return null;
    if(scenarioContext)return validScenarioContext();
    if(validPosition(catalog)&&catalog.status==='valid')return{key:`catalog:${catalog.catalog_number}:${catalog.normalized_gp_sha256}`,utc:catalog.utc,leap_sha256:catalog.leap_sha256,eop_sha256:catalog.eop_sha256};
    if(validPosition(latest)&&latest.status==='valid')return{key:`stored:${latest.input_id}:${latest.input_hash}`,utc:latest.utc,leap_sha256:latest.leap_sha256,eop_sha256:null};
    if(sceneMetadata?.frame==='ITRF'&&sceneMetadata.valid_count>0)return{key:`scene:${sceneMetadata.scene_sha256}`,utc:sceneMetadata.utc,leap_sha256:sceneMetadata.leap_sha256,eop_sha256:sceneMetadata.eop_sha256};
    return null;
  }
  function notifyDisplay(){const value=displayContext(),key=JSON.stringify(value),sourceKey=JSON.stringify(value?[value.key,value.leap_sha256,value.eop_sha256]:null);if(sourceKey!==continuitySourceKey){continuitySourceKey=sourceKey;notifyContinuity({phase:'availability',reason:'display-source-changed'});}if(key===displayKey)return;displayKey=key;for(const fn of displayObservers)fn(value?structuredClone(value):null);}
  function attachSolar(){solarRenderer?.destroy();solarRenderer=globe&&solarFactory?solarFactory(host.Cesium,globe.viewer):null;}
  const hoverObservers=new Set();
  const notifyHover=value=>{if(!disposed)for(const fn of hoverObservers)fn(value?structuredClone(value):null,host.Cesium);};
  let modelDescription=null,modelSource=null,modelRevision=0,modelStatus={phase:'unassigned'},modelManifest={phase:'pending',error:null};
  const modelObservers=new Set();
  const modelState=()=>structuredClone({selected:modelDescription?(modelDescription.pose_source?.kind==='source_node'?{node_id:modelDescription.pose_source.node_definition?.id,definition_hash:modelDescription.pose_source.definition_hash}:{catalog_number:modelDescription.satelliteId,normalized_gp_sha256:modelDescription.normalized_gp_sha256}):null,match:modelDescription?.url?modelDescription:null,status:modelStatus,manifest:modelManifest,tracking:Boolean(globe?.modelLayer?.tracking)});
  const notifyModel=()=>{if(!disposed)for(const fn of modelObservers)fn(modelState());};
  function applyModel(){
    if(!globe||disposed||!modelDescription||!modelSource)return;
    const revision=modelRevision,description=structuredClone(modelDescription);
    const report=value=>{
      if(disposed||revision!==modelRevision)return;
      if(value.node_id!=null&&value.node_id!==description.pose_source?.node_definition?.id)return;
      if(value.definition_hash!=null&&value.definition_hash!==description.pose_source?.definition_hash)return;
      if(value.satelliteId!=null&&String(value.satelliteId)!==String(description.satelliteId))return;
      modelStatus=structuredClone(value);notifyModel();
    };
    try{
      Promise.resolve(globe.setSatelliteModel(description,{...modelSource,onStatus:report,onTrackingChange:()=>{if(!disposed&&revision===modelRevision)notifyModel();}})).then(()=>{if(!disposed&&revision===modelRevision)notifyModel();}).catch(error=>report({phase:'error',errorKind:'renderer',error:String(error?.message||error),satelliteId:description.satelliteId}));
    }catch(error){report({phase:'error',errorKind:'renderer',error:String(error?.message||error),satelliteId:description.satelliteId});}
  }
  const viewState=()=>structuredClone({choice,imagery,mode,available:Boolean(globe)&&!failed&&!disposed});
  const notifyView=()=>{if(!disposed)for(const fn of viewObservers)fn(viewState());notifyCamera();};
  function applyView(fields){
    if(!globe||disposed)return;
    if(fields.includes('theme')||fields.includes('emphasis'))globe.setViewStyle(choice.theme,choice.emphasis);
    if(fields.includes('imagery'))void globe.setViewImagery(choice.imagery);
    if(fields.includes('mode')){
      const revision=++modeRevision;mode={phase:'pending',error:null};notifyView();
      globe.setViewMode(choice.mode).then(ok=>{if(disposed||revision!==modeRevision)return;mode={phase:ok?'ready':'error',error:ok?null:'지구 전환이 완료되지 않았습니다.'};notifyView();}).catch(error=>{if(disposed||revision!==modeRevision)return;mode={phase:'error',error:String(error?.message||error)};notifyView();});
    }
  }
  const describe=message=>{status.textContent=message;};
  function paint(){
    notifyDisplay();
    focusButton.disabled=true;
    if(!globe){if(!failed)describe('Cesium 준비 중 · 계산 위치는 아직 표시하지 않습니다.');return;}
    try{
      if(scenarioContext){globe.update(null);globe.setCatalogScene(null,onCatalogSelect);globe.setCatalogTrack(null);container.dataset.orbitVisible='false';const sim=validScenarioContext();describe(sim?`SIM ${sim.projected?'보간 표시':'정지 표시'} UTC ${sim.utc} · 실제 수신/실측 아님 · GP 위치는 이 UTC로 재표시하지 않습니다.`:'현재 SIM 실행과 일치하는 신선한 표시 UTC가 없습니다.');return;}
      const display=validPosition(catalog)?catalog:latest;
      const shown=globe.update(display);
      globe.setCatalogObservationLine?.(display===catalog?catalog:null);
      globe.setGroundPoint(groundPoint);
      globe.setDisplayVisibility?.(displayVisibility);
      container.dataset.orbitVisible=String(shown);
      syncDisplayReplicas();
      if(shown){
        if(!focused){globe.focus();focused=true;}
        focusButton.disabled=false;
        const whole=sceneMetadata?` | 전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · 전체 snapshot UTC ${sceneMetadata.utc}`:'';
        if(display===catalog){describe(`카탈로그 ${catalog.name} (${catalog.catalog_number}) · 시간 탐색 모델/실측 아님 | 선택 위성 UTC ${catalog.utc}${whole} | ITRF m ${catalog.position_m.map(x=>x.toFixed(2)).join(', ')} | IERS-A UT1 ${catalog.eop_quality.ut1} / 극운동 ${catalog.eop_quality.polar_motion} | 실제 통신 미확인`);return;}
        describe(`ISS · GP 예측 / 실측 아님 | 표시 UTC ${latest.utc}${whole} | ITRF m ${latest.position_m.map(v=>v.toFixed(2)).join(', ')} | 고도각 ${latest.elevation_deg?.toFixed(4)??'미확인'}° | revision ${latest.revision} | 실제 통신 미확인`);
      }else describe(sceneMetadata?`전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · snapshot UTC ${sceneMetadata.utc} · GP 모델/실측 아님 · 지구 위성을 선택하세요.`:'표시할 현재 UTC 계산 결과가 없습니다. 위성 창에서 저장 입력을 선택하고 계산하세요.');
    }catch{fail();}
  }
  function fail(){for(const replica of [...displayReplicas])replica.destroy();
    failed=true;focusButton.disabled=true;container.dataset.orbitVisible='false';
    if(nodeBinding){nodeBinding.phase='unavailable';detachNodes();notifyNodes();}
    removeError?.();removeError=null;solarRenderer?.destroy();solarRenderer=null;globe?.destroy();globe=null;notifyDisplay();
    describe('지구 렌더링을 사용할 수 없습니다. 위성 창의 수치 결과를 확인하세요. 합성 위치는 표시하지 않습니다.');
    notifyView();
  }
  function boot(){
    if(disposed||globe||failed)return;
    if(!host.Cesium){fail();return;}
    try{
      const C=host.Cesium;
      const createProvider=async name=>{
        if(name==='blue_marble')return C.SingleTileImageryProvider.fromUrl('/static/assets/nasa_blue_marble_september.jpg',{credit:'NASA Blue Marble'});
        if(name==='satellite')return C.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',{enablePickFeatures:false});
        if(name==='osm')return new C.OpenStreetMapImageryProvider({url:'https://tile.openstreetmap.org/'});
        if(name==='natural')return C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl('Assets/Textures/NaturalEarthII'));
        throw Error('지원하지 않는 지도입니다.');
      };
      replicaProvider=createProvider;globe=new OrbitGlobe(C,container,{createProvider,onSatelliteHover:notifyHover,onStatus:value=>{if(disposed)return;imagery=structuredClone(value);container.dataset.imagery=imagery.displayedImagery||'unavailable';notifyView();}});
      globe.setCatalogLabels?.(catalogLabelsVisible);
      if(stations.length){globe.setStations(stations,onStationSelect);globe.selectStation(selectedStation);}
      if(sceneInput){globe.setCatalogScene(sceneInput,onCatalogSelect);sceneInput=null;}
      if(trackInput)globe.setCatalogTrack(trackInput);
      removeError=globe.viewer.scene.renderError.addEventListener(fail);
      applyView(['theme','emphasis','imagery',...(choice.mode==='2d'?['mode']:[])]);
      notifyView();
      paint();
      applyModel();
      attachSolar();
      attachNodes();
      attachNodeInteraction();
      attachGroundInteraction();
      globe.setDisplayVisibility?.(displayVisibility);
      if(attributionBinding)globe.setAttributionAccess(true);
    }catch{fail();}
  }
  const timer=host.setTimeout(boot,12000);
  if(host.Cesium)boot();else host.addEventListener('load',boot,{once:true});
  const focus=()=>{try{globe?.focus();}catch{fail();}};focusButton.addEventListener('click',focus);
  return {
    displayContext,
    createDisplayReplica(target,caption){
      if(disposed||failed||!globe||!host.Cesium||!target||!caption)return null;
      let owner;try{owner=new OrbitGlobe(host.Cesium,target,{createProvider:replicaProvider});}catch(error){caption.textContent='상황판 지구 사용 불가: '+String(error.message||error);return null;}const binding={dead:false,last:null,model:null,source:null,nodeRenderer:null,solarRenderer:null,frame:null,removeFrame:null,mode:'3d',visible:true,catalogVisible:false};
      const current=()=>!binding.dead&&!owner.destroyed&&!disposed&&!failed&&displayReplicas.has(binding)&&!!globe;
      const hide=()=>{binding.last=null;binding.model=null;binding.source=null;owner.update(null);owner.setCatalogScene(null);owner.setCatalogTrack(null);owner.setStations([],()=>{});owner.setGroundPoint(null);owner.clearSatelliteModel();binding.solarRenderer?.clear?.();try{binding.nodeRenderer?.syncFrame(null,0);}catch{try{binding.nodeRenderer?.destroy();}finally{binding.nodeRenderer=null;}}caption.textContent='위성 위치 자료가 아직 준비되지 않았습니다. 지도 배경과 2D/3D 전환은 별도로 사용할 수 있습니다.';};
      binding.sync=()=>{
        if(!current()){if(!binding.dead)hide();return false;}
        try{
          // Geographic imagery does not require a satellite time or native position receipt.
          const style={theme:choice.theme,emphasis:choice.emphasis,imagery:choice.imagery},styleKey=JSON.stringify(style);
          if(binding.styleKey!==styleKey){owner.setViewStyle(style.theme,style.emphasis);if(!current())return false;if(binding.imagery!==style.imagery){binding.imagery=style.imagery;void owner.setViewImagery(style.imagery);}if(!current())return false;binding.styleKey=styleKey;}
          const value=renderProjection();if(!verifyRenderProjection(value)||!current()){hide();return false;}binding.frame=value;
          if(binding.last!==value){owner.setCatalogScene(value.scene,number=>{if(current()&&verifyRenderProjection(value))onCatalogSelect(number);});owner.setCatalogTrack(value.track);owner.setStations(value.stations,key=>{if(current()&&verifyRenderProjection(value))onStationSelect(key);});owner.selectStation(value.selectedStation);owner.setGroundPoint(value.groundPoint);binding.last=value;}
          owner.update(value.selected);const selectedNode=value.model?.pose_source?.kind==='source_node'?value.model.pose_source.node_definition?.id:null;owner.setDisplayVisibility({catalog:binding.visible&&binding.catalogVisible,selected:binding.visible&&(binding.catalogVisible||!!selectedNode&&binding.nodeRenderer?.isNodeDisplayed?.(selectedNode)===true)});
          if(binding.model!==modelDescription||binding.source!==modelSource){binding.model=modelDescription;binding.source=modelSource;const source=modelSource,description=value.model;if(description&&source){const live=()=>current()&&binding.model===modelDescription&&source===modelSource;void owner.setSatelliteModel(description,{timeSource:()=>live()?(binding.frame?.context?.utc??displayContext()?.utc??null):null,advanceUtc:source.advanceUtc,sampleAt:utc=>{if(!live())return null;const sample=source.sampleAt(utc);return live()?sample:null;}});}else owner.clearSatelliteModel();}
          if(!verifyRenderProjection(value)||!current()){hide();return false;}binding.nodeRenderer?.syncFrame(value.context?.utc??null,host.performance?.now?.()??0);binding.solarRenderer?.syncFrame(value.context?.utc??null);if(!verifyRenderProjection(value)||!current()){hide();return false;}
          caption.textContent=value.context?`원본 표시 UTC ${value.context.utc} · ${value.context.key} · 모델 계산 / 실측 아님`:'현재 원본 UTC 위치 미표시';return true;
        }catch(error){hide();caption.textContent='상황판 표시 오류: '+String(error.message||error);return false;}finally{binding.frame=null;}
      };
      binding.destroy=()=>{if(binding.dead)return;binding.dead=true;displayReplicas.delete(binding);binding.removeFrame?.();binding.nodeRenderer?.destroy();binding.solarRenderer?.destroy();owner.destroy();};displayReplicas.add(binding);
      try{binding.removeFrame=owner.viewer.scene.preRender.addEventListener(binding.sync);binding.sync();}catch{binding.destroy();return null;}
      return {readProjection:()=>current()?renderProjection():null,verifyProjection:value=>current()&&verifyRenderProjection(value),readDisplayUtc:()=>current()?(binding.frame?.context?.utc??displayContext()?.utc??null):null,
        bindSolar(factory){if(!current()||binding.solarRenderer)return false;const renderer=factory(host.Cesium,owner.viewer,{readContext:()=>current()?(binding.frame?.context??displayContext()):null,verifySource:()=>current()&&verifyRenderProjection(binding.frame??renderProjection())});if(!current()){renderer?.destroy();return false;}binding.solarRenderer=renderer;binding.sync();return true;},
        bindNodes(factory){if(!current()||binding.nodeRenderer)return false;const renderer=factory(host.Cesium,owner.viewer,{isTransitioning:()=>Boolean(owner.viewControls.cancelMorph),readDisplayUtc:()=>current()?(binding.frame?.context?.utc??displayContext()?.utc??null):null,verifySource:()=>current()&&verifyRenderProjection(binding.frame??renderProjection())});if(!current()){renderer?.destroy();return false;}binding.nodeRenderer=renderer;if(renderer.interaction)owner.setNodeInteraction({owns:(...args)=>current()&&renderer.interaction.owns(...args)===true&&current(),onSelect:id=>{if(current())renderer.interaction.onSelect(id);}});if(renderer.groundInteraction)owner.setGroundNetworkInteraction({read:picked=>current()?renderer.groundInteraction.read(picked):null,verify:value=>current()&&renderer.groundInteraction.verify(value)===true&&current(),onSelect:value=>{if(current())renderer.groundInteraction.onSelect(value);},onFocus:value=>{if(current())owner.focusGroundNetworkStation(value.station,{verify:()=>current()&&renderer.groundInteraction.verify(value)===true&&current()});}});binding.sync();return true;},
        setVisible(value){binding.visible=value!==false;binding.sync();},setCatalogVisible(value){binding.catalogVisible=value===true;binding.sync();},
        setMode(value){if(!current()||!['2d','3d'].includes(value))return false;binding.mode=value;void owner.setViewMode(value).then(()=>{if(current())binding.sync();}).catch(error=>{if(current())caption.textContent='상황판 표시 방식 오류: '+String(error.message||error);});return true;},mode:()=>binding.mode,
        resize(){if(current()){owner.viewer.resize?.();owner.viewer.scene.requestRender();}},sync:binding.sync,destroy:binding.destroy};
    },
    setDisplayVisibility(value){if(disposed||failed||!value||typeof value.catalog!=='boolean'||typeof value.selected!=='boolean')return false;displayVisibility={catalog:value.catalog,selected:value.selected};globe?.setDisplayVisibility?.(displayVisibility);return true;},
    resize(){if(disposed||failed)return false;globe?.viewer?.resize?.();globe?.viewer?.scene?.requestRender?.();return true;},
    canShowAttribution(){const available=!disposed&&!failed&&(globe?.attributionAvailable()??false);if(available&&attributionBinding)globe.setAttributionAccess(true);return available;},
    showAttribution(){return !disposed&&!failed&&(globe?.showAttribution()??false);},
    bindAttributionAccess(){
      if(disposed||failed)return()=>{};
      const binding={};attributionBinding=binding;globe?.setAttributionAccess(true);
      return()=>{if(attributionBinding!==binding)return;attributionBinding=null;globe?.setAttributionAccess(false);};
    },
    captureDisplayContinuity,verifyDisplayContinuity,
    observeDisplayContinuity(fn){if(typeof fn!=='function')throw new TypeError('display continuity observer required');if(disposed)return()=>{};continuityObservers.add(fn);return()=>continuityObservers.delete(fn);},
    bindCatalogDisplayContinuity(port){
      if(!port||['capture','isCurrent','observe'].some(key=>typeof port[key]!=='function'))throw new TypeError('actual catalog continuity owner required');
      if(disposed)return()=>{};
      const previous=catalogContinuity,binding={port,remove:null};catalogContinuity=binding;continuityCache=null;
      try{
        previous?.remove?.();
        const remove=port.observe(event=>{if(catalogContinuity===binding&&!disposed)notifyContinuity(event);});
        if(typeof remove!=='function')throw new TypeError('catalog continuity observer cleanup required');
        if(catalogContinuity!==binding||disposed){remove();return()=>{};}binding.remove=remove;
      }catch(error){if(catalogContinuity===binding){catalogContinuity=null;notifyContinuity({phase:'invalidated',reason:'catalog-owner-binding-failed'});}throw error;}
      return()=>{if(catalogContinuity!==binding)return;catalogContinuity=null;continuityCache=null;try{binding.remove?.();}finally{notifyContinuity({phase:'invalidated',reason:'catalog-owner-unbound'});}};
    },
    bindScenarioRuntime(readRuntime,utcOfRuntime,{projectDisplay=null}={}){
      if(typeof readRuntime!=='function'||typeof utcOfRuntime!=='function')throw new TypeError('actual SIM runtime and canonical UTC accessors required');
      if(disposed)return()=>{};const binding={readRuntime,utcOfRuntime,projectDisplay};scenarioBinding=binding;notifyDisplay();
      return()=>{if(scenarioBinding!==binding)return;scenarioBinding=null;notifyDisplay();};
    },
    setScenarioDisplayContext(value){if(disposed)return false;if(!validScenarioContext(value)){if(scenarioContext)paint();return false;}scenarioContext=structuredClone({run_id:value.run_id,utc:value.utc,leap_sha256:value.leap_sha256});paint();return true;},
    clearScenarioDisplayContext(run_id){if(disposed||!scenarioContext||scenarioContext.run_id!==run_id)return false;scenarioContext=null;try{globe?.setCatalogScene(sceneCopy,onCatalogSelect);globe?.setCatalogTrack(trackInput);paint();}catch{fail();}return true;},
    palette(theme){return !disposed&&!failed?globe?.palette?.(theme)??{}:{};},
    cameraState,
    observeCamera(fn){if(disposed)return()=>{};cameraObservers.add(fn);fn({...cameraState()});return()=>cameraObservers.delete(fn);},
    zoomBy(value){return !disposed&&!failed?globe?.zoomBy?.(value)??false:false;},
    setZoom(value){return !disposed&&!failed?globe?.setZoom?.(value)??false:false;},
    home(){return !disposed&&!failed?globe?.home?.()??false:false;},
    nodeRendererState,
    observeNodeRenderer(fn){if(disposed)return()=>{};nodeObservers.add(fn);try{fn(structuredClone(nodeRendererState()));}catch{/* Readonly observer. */}return()=>nodeObservers.delete(fn);},
    bindNodeRenderer(factory){
      if(typeof factory!=='function')throw new TypeError('node renderer factory required');
      if(disposed)return()=>{};
      const previous=nodeBinding,binding={factory,renderer:null,removeFrame:null,phase:'pending',error:null};nodeBinding=binding;detachNodes(previous);attachNodes();notifyNodes();
      return()=>{if(nodeBinding!==binding)return;nodeBinding=null;detachNodes(binding);notifyNodes();};
    },
    bindNodeInteraction(interaction){
      if(typeof interaction?.owns!=='function')throw new TypeError('node primitive ownership verifier required');
      if(disposed)return()=>{};
      const previous=nodeInteractionBinding,binding={interaction:{...interaction}};nodeInteractionBinding=binding;
      try{previous?.interaction.onHover?.(null);}catch{/* Scoped cleanup. */}
      if(nodeInteractionBinding===binding)attachNodeInteraction();
      return()=>{if(nodeInteractionBinding!==binding)return;nodeInteractionBinding=null;try{binding.interaction.onHover?.(null);}catch{/* Scoped cleanup. */}if(nodeInteractionBinding===null)attachNodeInteraction();};
    },
    bindGroundNetworkInteraction(interaction){
      if(['read','verify'].some(key=>typeof interaction?.[key]!=='function')||['onSelect','onFocus'].some(key=>interaction[key]!=null&&typeof interaction[key]!=='function'))throw new TypeError('verified ground station interaction ports required');
      if(disposed||failed)return()=>{};
      const binding={interaction:Object.freeze({...interaction})};groundInteractionBinding=binding;attachGroundInteraction();
      return()=>{if(groundInteractionBinding!==binding)return;groundInteractionBinding=null;attachGroundInteraction();};
    },
    observeDisplayContext(fn){if(disposed)return()=>{};displayObservers.add(fn);fn(displayContext());return()=>displayObservers.delete(fn);},
    bindSolarRenderer(factory){if(disposed)return()=>{};solarFactory=factory;attachSolar();return()=>{if(solarFactory!==factory)return;solarRenderer?.destroy();solarRenderer=null;solarFactory=null;};},
    observeSatelliteHover(fn){if(disposed)return()=>{};hoverObservers.add(fn);return()=>hoverObservers.delete(fn);},
    modelState,
    modelManifestStatus(value){if(disposed)return;modelManifest=structuredClone(value);notifyModel();},
    observeModel(fn){if(disposed)return()=>{};modelObservers.add(fn);fn(modelState());return()=>modelObservers.delete(fn);},
    setSatelliteModel(description,source){
      if(disposed)return;
      ++modelRevision;modelDescription=description?structuredClone(description):null;modelSource=source?{...source}:null;
      modelStatus={phase:description?.url?'loading':'unassigned'};
      if(!description){globe?.clearSatelliteModel();notifyModel();return;}
      applyModel();notifyModel();
    },
    clearSatelliteModel(){if(disposed)return;++modelRevision;modelDescription=null;modelSource=null;modelStatus={phase:'unassigned'};globe?.clearSatelliteModel();notifyModel();},
    focusSatelliteModel(options={}){if(disposed||!modelDescription)return false;const result=globe?.focusSatelliteModel(options)??false;notifyModel();return result;},
    releaseSatelliteModel(options){if(disposed)return;globe?.releaseSatelliteModel(options);notifyModel();},
    retrySatelliteModel(){if(disposed)return Promise.resolve(null);return Promise.resolve(globe?.retrySatelliteModel()).finally(notifyModel);},
    viewState,
    // Read the same authoritative phase as viewState without copying UI state.
    isTransitioning:()=>mode.phase!=='ready',
    observeView(fn){if(disposed)return()=>{};viewObservers.add(fn);fn(viewState());return()=>viewObservers.delete(fn);},
    changeView(patch){
      if(disposed||!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!['mode','imagery','theme','emphasis'].includes(key)))return false;
      const next={...choice,...patch};
      if(!['2d','3d'].includes(next.mode)||!['blue_marble','satellite','osm','natural'].includes(next.imagery)||!['dark','light'].includes(next.theme)||typeof next.emphasis!=='boolean')return false;
      const changed=Object.keys(patch).filter(key=>next[key]!==choice[key]);choice=next;
      try{applyView(changed);}catch(error){mode={phase:'error',error:String(error?.message||error)};}
      notifyView();return true;
    },
    stations(values,onSelect){stations=structuredClone(values);onStationSelect=onSelect;globe?.setStations(stations,onStationSelect);},
    selectStation(key){selectedStation=key;globe?.selectStation(key);},
    focusStation(key){if(globe?.focusStation(key)){focused=true;return true;}return false;},
    focusGroundNetworkStation(station,{verify}={}){
      const binding=groundInteractionBinding,owner=globe,viewer=owner?.viewer;
      const current=()=>!disposed&&!failed&&mode.phase==='ready'&&!!binding&&groundInteractionBinding===binding&&globe===owner&&owner?.viewer===viewer;
      if(typeof verify!=='function'||!current())return false;
      const proof=value=>current()&&verify(value)===true&&current();
      try{if(!proof(station))return false;const result=owner.focusGroundNetworkStation?.(station,{verify:proof})===true;if(result&&proof(station)){focused=true;return true;}return false;}catch{return false;}
    },
    catalogScene(value,onSelect){
      if(disposed)return;onCatalogSelect=onSelect;
      if(value){const {rows,...metadata}=value;sceneMetadata=structuredClone(metadata);}else sceneMetadata=null;
      sceneCopy=value?structuredClone(value):null;
      sceneInput=globe?null:sceneCopy;
      try{globe?.setCatalogScene(scenarioContext?null:value,onSelect);container.dataset.catalogCount=String(value?.valid_count??0);paint();}catch{fail();}
    },
    setCatalogLabels(value){if(disposed)return false;catalogLabelsVisible=Boolean(value);try{globe?.setCatalogLabels(catalogLabelsVisible);}catch{fail();}return catalogLabelsVisible;},
    catalogLabelsVisible(){return catalogLabelsVisible;},
    catalogTrack(value){if(disposed)return;trackInput=value?structuredClone(value):null;try{globe?.setCatalogTrack(scenarioContext?null:trackInput);globe?.setDisplayVisibility?.(displayVisibility);container.dataset.trackSegmentCount=String(value?.segments?.length??0);}catch{fail();}},
    catalog(sample){if(disposed)return;const changed=catalog?.catalog_number!==sample?.catalog_number||catalog?.normalized_gp_sha256!==sample?.normalized_gp_sha256;catalog=sample?structuredClone(sample):null;if(changed)focused=false;paint();},
    update(snapshot,display,displayUtc){
      if(disposed)return;
      const {state,result,status:phase}=snapshot;
      groundPoint=state?.ground_point?structuredClone(state.ground_point):null;
      const row=display===undefined?result?.rows?.[0]:display;
      const matchingUtc=display===undefined?row?.utc===state?.current_utc:row?.utc===displayUtc;
      const valid=phase==='ready'&&!result?.stale&&row?.status==='valid'&&matchingUtc&&result.input_id===state?.input_id&&result.revision===state?.revision&&result.input_hash===state?.input_hash;
      latest=valid?structuredClone({...row,frame:result.frame,revision:result.revision,leap_sha256:result.leap_sha256,input_id:result.input_id,input_hash:result.input_hash}):null;
      paint();
      if(!scenarioContext&&!catalog&&!latest&&!sceneMetadata&&globe&&(displayUtc||snapshot.error))describe(`표시 UTC ${displayUtc||'미제공'} · ${snapshot.error||'해당 시각 데이터 준비 중 / 자료 없으면 위치 미표시'} · 실제 통신 미확인`);
    },
    destroy(){if(disposed)return;disposed=true;for(const replica of [...displayReplicas])replica.destroy();renderCache=null;groundInteractionBinding=null;globe?.setGroundNetworkInteraction?.(null);const continuity=catalogContinuity;catalogContinuity=null;continuityCache=null;continuityObservers.clear();try{continuity?.remove?.();}catch{/* Release other renderer owners. */}scenarioBinding=null;scenarioContext=null;sceneCopy=null;cameraObservers.clear();nodeInteractionBinding=null;nodeObservers.clear();detachNodes();nodeBinding=null;solarRenderer?.destroy();solarRenderer=null;solarFactory=null;displayObservers.clear();hoverObservers.clear();viewObservers.clear();modelObservers.clear();++modelRevision;modelDescription=null;modelSource=null;++modeRevision;host.clearTimeout(timer);host.removeEventListener('load',boot);focusButton.removeEventListener('click',focus);removeError?.();globe?.destroy();globe=null;latest=null;sceneInput=null;sceneMetadata=null;trackInput=null;},
  };
}
