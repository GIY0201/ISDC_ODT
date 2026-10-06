import {OrbitGlobe} from '/static/visualization/orbit_globe.js?v=t136-r1';

/** Render-only copy, never a clock/selection authority. One controller per document. */
export function createWorkspaceGlobe(container,status,focusButton,host=window){
  let globe=null,latest=null,catalog=null,sceneInput=null,sceneMetadata=null,trackInput=null,onCatalogSelect=()=>{},groundPoint=null,disposed=false,failed=false,removeError=null,focused=false,stations=[],selectedStation=null,onStationSelect=()=>{};
  let choice={mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery={requestedImagery:'blue_marble',displayedImagery:null,phase:'pending',error:null},mode={phase:'ready',error:null},modeRevision=0;
  const viewObservers=new Set();
  const displayObservers=new Set();let displayKey=null,solarFactory=null,solarRenderer=null;
  const cameraObservers=new Set();let cameraKey=null;
  const cameraState=()=>!disposed&&!failed&&globe?globe.cameraState?.()??{ready:false,zoom:null}:{ready:false,zoom:null};
  function notifyCamera(){const value=cameraState(),key=JSON.stringify(value);if(key===cameraKey)return;cameraKey=key;for(const fn of cameraObservers){try{fn({...value});}catch{/* Readonly camera observer. */}}}
  let nodeBinding=null;const nodeObservers=new Set();
  let nodeInteractionBinding=null;
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
  const validPosition=value=>value?.frame==='ITRF'&&value.status!=='error'&&!value.error_code&&typeof value.utc==='string'&&value.utc.endsWith('Z')&&Array.isArray(value.position_m)&&value.position_m.length===3&&value.position_m.every(Number.isFinite);
  function displayContext(){
    if(!globe||failed||disposed)return null;
    if(validPosition(catalog)&&catalog.status==='valid')return{key:`catalog:${catalog.catalog_number}:${catalog.normalized_gp_sha256}`,utc:catalog.utc,leap_sha256:catalog.leap_sha256,eop_sha256:catalog.eop_sha256};
    if(validPosition(latest)&&latest.status==='valid')return{key:`stored:${latest.input_id}:${latest.input_hash}`,utc:latest.utc,leap_sha256:latest.leap_sha256,eop_sha256:null};
    if(sceneMetadata?.frame==='ITRF'&&sceneMetadata.valid_count>0)return{key:`scene:${sceneMetadata.scene_sha256}`,utc:sceneMetadata.utc,leap_sha256:sceneMetadata.leap_sha256,eop_sha256:sceneMetadata.eop_sha256};
    return null;
  }
  function notifyDisplay(){const value=displayContext(),key=JSON.stringify(value);if(key===displayKey)return;displayKey=key;for(const fn of displayObservers)fn(value?structuredClone(value):null);}
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
      const display=validPosition(catalog)?catalog:latest;
      const shown=globe.update(display);
      globe.setGroundPoint(groundPoint);
      container.dataset.orbitVisible=String(shown);
      if(shown){
        if(!focused){globe.focus();focused=true;}
        focusButton.disabled=false;
        const whole=sceneMetadata?` | 전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · 전체 snapshot UTC ${sceneMetadata.utc}`:'';
        if(display===catalog){describe(`카탈로그 ${catalog.name} (${catalog.catalog_number}) · 시간 탐색 모델/실측 아님 | 선택 위성 UTC ${catalog.utc}${whole} | ITRF m ${catalog.position_m.map(x=>x.toFixed(2)).join(', ')} | IERS-A UT1 ${catalog.eop_quality.ut1} / 극운동 ${catalog.eop_quality.polar_motion} | 실제 통신 미확인`);return;}
        describe(`ISS · GP 예측 / 실측 아님 | 표시 UTC ${latest.utc}${whole} | ITRF m ${latest.position_m.map(v=>v.toFixed(2)).join(', ')} | 고도각 ${latest.elevation_deg?.toFixed(4)??'미확인'}° | revision ${latest.revision} | 실제 통신 미확인`);
      }else describe(sceneMetadata?`전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · snapshot UTC ${sceneMetadata.utc} · GP 모델/실측 아님 · 지구 위성을 선택하세요.`:'표시할 현재 UTC 계산 결과가 없습니다. 위성 창에서 저장 입력을 선택하고 계산하세요.');
    }catch{fail();}
  }
  function fail(){
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
      globe=new OrbitGlobe(C,container,{createProvider,onSatelliteHover:notifyHover,onStatus:value=>{if(disposed)return;imagery=structuredClone(value);container.dataset.imagery=imagery.displayedImagery||'unavailable';notifyView();}});
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
    }catch{fail();}
  }
  const timer=host.setTimeout(boot,12000);
  if(host.Cesium)boot();else host.addEventListener('load',boot,{once:true});
  const focus=()=>{try{globe?.focus();}catch{fail();}};focusButton.addEventListener('click',focus);
  return {
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
    catalogScene(value,onSelect){
      if(disposed)return;onCatalogSelect=onSelect;
      if(value){const {rows,...metadata}=value;sceneMetadata=structuredClone(metadata);}else sceneMetadata=null;
      sceneInput=globe?null:value?structuredClone(value):null;
      try{globe?.setCatalogScene(value,onSelect);container.dataset.catalogCount=String(value?.valid_count??0);paint();}catch{fail();}
    },
    catalogTrack(value){if(disposed)return;trackInput=value?structuredClone(value):null;try{globe?.setCatalogTrack(trackInput);container.dataset.trackSegmentCount=String(value?.segments?.length??0);}catch{fail();}},
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
      if(!catalog&&!latest&&!sceneMetadata&&globe&&(displayUtc||snapshot.error))describe(`표시 UTC ${displayUtc||'미제공'} · ${snapshot.error||'해당 시각 데이터 준비 중 / 자료 없으면 위치 미표시'} · 실제 통신 미확인`);
    },
    destroy(){if(disposed)return;disposed=true;cameraObservers.clear();nodeInteractionBinding=null;nodeObservers.clear();detachNodes();nodeBinding=null;solarRenderer?.destroy();solarRenderer=null;solarFactory=null;displayObservers.clear();hoverObservers.clear();viewObservers.clear();modelObservers.clear();++modelRevision;modelDescription=null;modelSource=null;++modeRevision;host.clearTimeout(timer);host.removeEventListener('load',boot);focusButton.removeEventListener('click',focus);removeError?.();globe?.destroy();globe=null;latest=null;sceneInput=null;sceneMetadata=null;trackInput=null;},
  };
}
