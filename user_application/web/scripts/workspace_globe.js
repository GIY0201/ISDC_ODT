import {OrbitGlobe} from '/static/visualization/orbit_globe.js';

/** Render-only copy, never a clock/selection authority. One controller per document. */
export function createWorkspaceGlobe(container,status,focusButton,host=window){
  let globe=null,latest=null,groundPoint=null,disposed=false,failed=false,removeError=null,focused=false;
  const describe=message=>{status.textContent=message;};
  function paint(){
    focusButton.disabled=true;
    if(!globe){if(!failed)describe('Cesium 준비 중 · 계산 위치는 아직 표시하지 않습니다.');return;}
    try{
      const shown=globe.update(latest);
      globe.setGroundPoint(groundPoint);
      container.dataset.orbitVisible=String(shown);
      if(shown){
        if(!focused){globe.focus();focused=true;}
        focusButton.disabled=false;
        describe(`ISS · GP 예측 / 실측 아님 | 표시 UTC ${latest.utc} | ITRF m ${latest.position_m.map(v=>v.toFixed(2)).join(', ')} | 고도각 ${latest.elevation_deg?.toFixed(4)??'미확인'}° | revision ${latest.revision} | 실제 통신 미확인`);
      }else describe('표시할 현재 UTC 계산 결과가 없습니다. 위성 창에서 저장 입력을 선택하고 계산하세요.');
    }catch{fail();}
  }
  function fail(){
    failed=true;focusButton.disabled=true;container.dataset.orbitVisible='false';
    removeError?.();removeError=null;globe?.destroy();globe=null;
    describe('지구 렌더링을 사용할 수 없습니다. 위성 창의 수치 결과를 확인하세요. 합성 위치는 표시하지 않습니다.');
  }
  function boot(){
    if(disposed||globe||failed)return;
    if(!host.Cesium){fail();return;}
    try{
      globe=new OrbitGlobe(host.Cesium,container);
      removeError=globe.viewer.scene.renderError.addEventListener(fail);
      host.Cesium.SingleTileImageryProvider.fromUrl('/static/assets/nasa_blue_marble_september.jpg',{credit:'NASA Blue Marble'}).then(provider=>{
        if(!disposed&&globe)globe.setImagery(provider);
      }).catch(()=>{container.dataset.imagery='unavailable';});
      paint();
    }catch{fail();}
  }
  const timer=host.setTimeout(boot,12000);
  if(host.Cesium)boot();else host.addEventListener('load',boot,{once:true});
  const focus=()=>globe?.focus();focusButton.addEventListener('click',focus);
  return {
    update(snapshot,display,displayUtc){
      if(disposed)return;
      const {state,result,status:phase}=snapshot;
      groundPoint=state?.ground_point?structuredClone(state.ground_point):null;
      const row=display===undefined?result?.rows?.[0]:display;
      const matchingUtc=display===undefined?row?.utc===state?.current_utc:row?.utc===displayUtc;
      const valid=phase==='ready'&&!result?.stale&&row?.status==='valid'&&matchingUtc&&result.input_id===state?.input_id&&result.revision===state?.revision&&result.input_hash===state?.input_hash;
      latest=valid?structuredClone({...row,frame:result.frame,revision:result.revision}):null;
      paint();
      if(!latest&&globe&&(displayUtc||snapshot.error))describe(`표시 UTC ${displayUtc||'미제공'} · ${snapshot.error||'해당 시각 데이터 준비 중 / 자료 없으면 위치 미표시'} · 실제 통신 미확인`);
    },
    destroy(){if(disposed)return;disposed=true;host.clearTimeout(timer);host.removeEventListener('load',boot);focusButton.removeEventListener('click',focus);removeError?.();globe?.destroy();globe=null;latest=null;},
  };
}
