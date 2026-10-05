/** Copied render preferences only; no orbit/runtime commands. */
export function createGlobeViewPanel(globe){
  let view=null,disposed=false,boundPanel=null,bindings=[];
  function unbind(){for(const [node,fn]of bindings)node.removeEventListener('change',fn);bindings=[];boundPanel=null;}
  const names={blue_marble:'NASA Blue Marble',satellite:'ArcGIS 위성 영상',osm:'OpenStreetMap',natural:'Natural Earth'};
  function draw(){
    if(disposed||!['satellite','ground'].includes(view))return;
    let panel=document.getElementById('globe-view');
    if(!panel){
      panel=document.createElement('section');panel.id='globe-view';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML='<header><h2>공용 지구 표시 설정</h2></header><div class="body"><label>표시 방식 <select id="globe-mode"><option value="3d">3D 지구</option><option value="2d">2D 지도</option></select></label> <label>지도 <select id="globe-imagery"><option value="blue_marble">NASA Blue Marble</option><option value="satellite">ArcGIS 위성 영상</option><option value="osm">OpenStreetMap</option><option value="natural">Natural Earth</option></select></label> <label>지도 테마 <select id="globe-theme"><option value="dark">어두움</option><option value="light">밝음</option></select></label> <label><input id="globe-emphasis" type="checkbox"> 위성 강조</label><p id="globe-view-status" role="status"></p><small>공용 지구의 표시 설정입니다. 궤도 입력·UTC·SIM은 바뀌지 않습니다. 태양 방향과 일조 표시는 후속 연결 예정입니다.</small></div>';
    }
    if(panel!==boundPanel){unbind();boundPanel=panel;for(const field of ['mode','imagery','theme','emphasis']){const node=panel.querySelector('#globe-'+field),fn=event=>globe.changeView({[field]:field==='emphasis'?event.target.checked:event.target.value});node.addEventListener('change',fn);bindings.push([node,fn]);}}
    const {choice,imagery,mode,available}=globe.viewState(),node=id=>panel.querySelector('#'+id);
    for(const field of ['mode','imagery','theme'])node('globe-'+field).value=choice[field];
    node('globe-emphasis').checked=choice.emphasis;node('globe-emphasis').value=String(choice.emphasis);
    const map=imagery.phase==='pending'?`지도 준비 중: ${names[imagery.requestedImagery]}`:imagery.phase==='fallback'?`지도 대체: ${names[imagery.requestedImagery]} → ${names[imagery.displayedImagery]}`:imagery.phase==='error'?`지도 오류 · 유지한 지도: ${names[imagery.displayedImagery]||'없음'}`:`표시 지도: ${names[imagery.displayedImagery]||'없음'}`;
    node('globe-view-status').textContent=`${available?'':'지구 준비 중 또는 사용 불가 · '}${mode.phase==='pending'?'2D/3D 전환 중 · ':mode.error?mode.error+' · ':''}${map}${imagery.error?' · '+imagery.error:''}`;
  }
  const remove=globe.observeView(draw);
  return{show(next){view=next;draw();},update:draw,
    applyDraft(items){const patch={};for(const item of items){if(!item||typeof item.value!=='string')continue;const field={'globe-mode':'mode','globe-imagery':'imagery','globe-theme':'theme','globe-emphasis':'emphasis'}[item.id];if(!field)continue;if(field==='emphasis'){if(['true','false'].includes(item.value))patch.emphasis=item.value==='true';}else patch[field]=item.value;}if(Object.keys(patch).length)globe.changeView(patch);draw();},
    destroy(){if(disposed)return;disposed=true;remove();unbind();view=null;},
  };
}
