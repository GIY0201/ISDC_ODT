import {OrbitGlobe} from '/static/visualization/orbit_globe.js?v=t119-r1';

/** Render-only copy, never a clock/selection authority. One controller per document. */
export function createWorkspaceGlobe(container,status,focusButton,host=window){
  let globe=null,latest=null,catalog=null,sceneInput=null,sceneMetadata=null,trackInput=null,onCatalogSelect=()=>{},groundPoint=null,disposed=false,failed=false,removeError=null,focused=false,stations=[],selectedStation=null,onStationSelect=()=>{};
  let choice={mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery={requestedImagery:'blue_marble',displayedImagery:null,phase:'pending',error:null},mode={phase:'ready',error:null},modeRevision=0;
  const viewObservers=new Set();
  let modelDescription=null,modelSource=null,modelRevision=0,modelStatus={phase:'unassigned'};
  const modelObservers=new Set();
  const modelState=()=>structuredClone({selected:modelDescription?{catalog_number:modelDescription.satelliteId,normalized_gp_sha256:modelDescription.normalized_gp_sha256}:null,match:modelDescription?.url?modelDescription:null,status:modelStatus,tracking:Boolean(globe?.modelLayer?.tracking)});
  const notifyModel=()=>{if(!disposed)for(const fn of modelObservers)fn(modelState());};
  function applyModel(){
    if(!globe||disposed||!modelDescription||!modelSource)return;
    const revision=modelRevision,description=structuredClone(modelDescription);
    const report=value=>{
      if(disposed||revision!==modelRevision)return;
      if(value.satelliteId!=null&&String(value.satelliteId)!==String(description.satelliteId))return;
      modelStatus=structuredClone(value);notifyModel();
    };
    try{
      Promise.resolve(globe.setSatelliteModel(description,{...modelSource,onStatus:report})).then(()=>{if(!disposed&&revision===modelRevision)notifyModel();}).catch(error=>report({phase:'error',errorKind:'renderer',error:String(error?.message||error),satelliteId:description.satelliteId}));
    }catch(error){report({phase:'error',errorKind:'renderer',error:String(error?.message||error),satelliteId:description.satelliteId});}
  }
  const viewState=()=>structuredClone({choice,imagery,mode,available:Boolean(globe)&&!failed&&!disposed});
  const notifyView=()=>{if(!disposed)for(const fn of viewObservers)fn(viewState());};
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
    focusButton.disabled=true;
    if(!globe){if(!failed)describe('Cesium 준비 중 · 계산 위치는 아직 표시하지 않습니다.');return;}
    try{
      const display=catalog??latest;
      const shown=globe.update(display);
      globe.setGroundPoint(groundPoint);
      container.dataset.orbitVisible=String(shown);
      if(shown){
        if(!focused){globe.focus();focused=true;}
        focusButton.disabled=false;
        const whole=sceneMetadata?` | 전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · 전체 snapshot UTC ${sceneMetadata.utc}`:'';
        if(catalog){describe(`카탈로그 ${catalog.name} (${catalog.catalog_number}) · 시간 탐색 모델/실측 아님 | 선택 위성 UTC ${catalog.utc}${whole} | ITRF m ${catalog.position_m.map(x=>x.toFixed(2)).join(', ')} | IERS-A UT1 ${catalog.eop_quality.ut1} / 극운동 ${catalog.eop_quality.polar_motion} | 실제 통신 미확인`);return;}
        describe(`ISS · GP 예측 / 실측 아님 | 표시 UTC ${latest.utc}${whole} | ITRF m ${latest.position_m.map(v=>v.toFixed(2)).join(', ')} | 고도각 ${latest.elevation_deg?.toFixed(4)??'미확인'}° | revision ${latest.revision} | 실제 통신 미확인`);
      }else describe(sceneMetadata?`전체 ${sceneMetadata.count}개 / 성공 ${sceneMetadata.valid_count} / 실패 ${sceneMetadata.error_count} · snapshot UTC ${sceneMetadata.utc} · GP 모델/실측 아님 · 지구 위성을 선택하세요.`:'표시할 현재 UTC 계산 결과가 없습니다. 위성 창에서 저장 입력을 선택하고 계산하세요.');
    }catch{fail();}
  }
  function fail(){
    failed=true;focusButton.disabled=true;container.dataset.orbitVisible='false';
    removeError?.();removeError=null;globe?.destroy();globe=null;
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
      globe=new OrbitGlobe(C,container,{createProvider,onStatus:value=>{if(disposed)return;imagery=structuredClone(value);container.dataset.imagery=imagery.displayedImagery||'unavailable';notifyView();}});
      if(stations.length){globe.setStations(stations,onStationSelect);globe.selectStation(selectedStation);}
      if(sceneInput){globe.setCatalogScene(sceneInput,onCatalogSelect);sceneInput=null;}
      if(trackInput)globe.setCatalogTrack(trackInput);
      removeError=globe.viewer.scene.renderError.addEventListener(fail);
      applyView(['theme','emphasis','imagery',...(choice.mode==='2d'?['mode']:[])]);
      notifyView();
      paint();
      applyModel();
    }catch{fail();}
  }
  const timer=host.setTimeout(boot,12000);
  if(host.Cesium)boot();else host.addEventListener('load',boot,{once:true});
  const focus=()=>{try{globe?.focus();}catch{fail();}};focusButton.addEventListener('click',focus);
  return {
    modelState,
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
    releaseSatelliteModel(){if(disposed)return;globe?.releaseSatelliteModel();notifyModel();},
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
      latest=valid?structuredClone({...row,frame:result.frame,revision:result.revision}):null;
      paint();
      if(!catalog&&!latest&&!sceneMetadata&&globe&&(displayUtc||snapshot.error))describe(`표시 UTC ${displayUtc||'미제공'} · ${snapshot.error||'해당 시각 데이터 준비 중 / 자료 없으면 위치 미표시'} · 실제 통신 미확인`);
    },
    destroy(){if(disposed)return;disposed=true;viewObservers.clear();modelObservers.clear();++modelRevision;modelDescription=null;modelSource=null;++modeRevision;host.clearTimeout(timer);host.removeEventListener('load',boot);focusButton.removeEventListener('click',focus);removeError?.();globe?.destroy();globe=null;latest=null;sceneInput=null;sceneMetadata=null;trackInput=null;},
  };
}
