/** Copied render preferences only; no orbit/runtime commands. */
export function createGlobeViewPanel(globe,solar=null){
  let view=null,disposed=false,boundPanel=null,bindings=[];
  function unbind(){for(const [node,fn,event='change']of bindings)node.removeEventListener(event,fn);bindings=[];boundPanel=null;}
  const names={blue_marble:'NASA Blue Marble',satellite:'ArcGIS 위성 영상',osm:'OpenStreetMap',natural:'Natural Earth'};
  function draw(){
    if(disposed||!['satellite','ground','settings'].includes(view))return;
    let panel=document.getElementById('globe-view');
    if(!panel){
      panel=document.createElement('section');panel.id='globe-view';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML='<header><h2>공용 지구 표시 설정</h2></header><div class="body"><label>표시 방식 <select id="globe-mode"><option value="3d">3D 지구</option><option value="2d">2D 지도</option></select></label> <label>지도 <select id="globe-imagery"><option value="blue_marble">NASA Blue Marble</option><option value="satellite">ArcGIS 위성 영상</option><option value="osm">OpenStreetMap</option><option value="natural">Natural Earth</option></select></label> <label>지도 테마 <select id="globe-theme"><option value="dark">어두움</option><option value="light">밝음</option></select></label> <label><input id="globe-emphasis" type="checkbox"> 위성 강조</label><p id="globe-view-status" role="status"></p><label><input id="globe-lighting" type="checkbox"> 태양 방향 음영</label><button id="globe-solar-retry" type="button">태양 자료 다시 받기</button><p id="globe-solar-status" role="status"></p><small>공용 지구의 표시 설정입니다. 궤도 입력·UTC·SIM은 바뀌지 않습니다. 태양 방향은 표시 UTC의 계산 모델이며 실측·일식·발전량 판정이 아닙니다.</small></div>';
    }
    if(panel!==boundPanel){unbind();boundPanel=panel;for(const field of ['mode','imagery','theme','emphasis']){const node=panel.querySelector('#globe-'+field),fn=event=>globe.changeView({[field]:field==='emphasis'?event.target.checked:event.target.value});node.addEventListener('change',fn);bindings.push([node,fn]);}if(solar){const checkbox=panel.querySelector('#globe-lighting'),button=panel.querySelector('#globe-solar-retry'),change=event=>solar.setEnabled(event.target.checked),retry=()=>solar.retry();checkbox.addEventListener('change',change);button.addEventListener('click',retry);bindings.push([checkbox,change,'change'],[button,retry,'click']);}}
    const {choice,imagery,mode,available}=globe.viewState(),node=id=>panel.querySelector('#'+id);
    for(const field of ['mode','imagery','theme'])node('globe-'+field).value=choice[field];
    node('globe-emphasis').checked=choice.emphasis;node('globe-emphasis').value=String(choice.emphasis);
    if(solar){
      const s=solar.state(),indicator={visible:'표식 표시',offscreen:'화면 밖','behind-camera':'카메라 뒤','earth-occluded':'지구에 가림','2d':'2D에서 표식 숨김',unavailable:'자료 미제공'}[s.renderer.indicator]||s.renderer.indicator;
      node('globe-lighting').checked=s.enabled;node('globe-lighting').value=String(s.enabled);
      node('globe-solar-retry').disabled=!s.context||s.timeline.pending;
      const source=s.context?.key?.startsWith('catalog:')?'선택 카탈로그':s.context?.key?.startsWith('stored:')?'저장 궤도':'전체 위성 화면';
      const quality=s.timeline.eop_sha256?` | EOP ${s.timeline.eop_sha256.slice(0,12)}`:'';
      const rowQuality=s.geometry?.eop_quality?` | UT1 ${s.geometry.eop_quality.ut1} / 극운동 ${s.geometry.eop_quality.polar_motion}`:'';
      const error=s.timeline.error||(s.renderer.reason==='projection_failed'?'태양 표식 투영 실패':'');
      node('globe-solar-status').textContent=s.context?`${source} UTC ${s.context.utc} | ${s.timeline.pending?'태양 자료 준비 중':error?'태양 계산 오류: '+error:indicator}${quality}${rowQuality}${s.theme==='light'?' | 밝은 테마: 음영 꺼짐':''} | ERFA 모델 / 실측 아님`:'태양 표시 기준 UTC가 없습니다. 계산 위치 또는 전체 위성 자료를 먼저 표시하세요.';
    }
    const map=imagery.phase==='pending'?`지도 준비 중: ${names[imagery.requestedImagery]}`:imagery.phase==='fallback'?`지도 대체: ${names[imagery.requestedImagery]} → ${names[imagery.displayedImagery]}`:imagery.phase==='error'?`지도 오류 · 유지한 지도: ${names[imagery.displayedImagery]||'없음'}`:`표시 지도: ${names[imagery.displayedImagery]||'없음'}`;
    node('globe-view-status').textContent=`${available?'':'지구 준비 중 또는 사용 불가 · '}${mode.phase==='pending'?'2D/3D 전환 중 · ':mode.error?mode.error+' · ':''}${map}${imagery.error?' · '+imagery.error:''}`;
  }
  const remove=globe.observeView(draw),removeSolar=solar?.observe(draw)??(()=>{});
  return{show(next){view=next;draw();},update:draw,
    applyDraft(items){const patch={};for(const item of items){if(!item||typeof item.value!=='string')continue;const field={'globe-mode':'mode','globe-imagery':'imagery','globe-theme':'theme','globe-emphasis':'emphasis'}[item.id];if(!field)continue;if(field==='emphasis'){if(['true','false'].includes(item.value))patch.emphasis=item.value==='true';}else patch[field]=item.value;}if(Object.keys(patch).length)globe.changeView(patch);draw();},
    destroy(){if(disposed)return;disposed=true;remove();removeSolar();unbind();view=null;},
  };
}
