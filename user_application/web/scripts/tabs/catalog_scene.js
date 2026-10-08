/** Explicit whole-group query controls; copied drafts never execute requests. */
export function createCatalogScenePanel(controller,getTimeline=()=>null,hooks={}){
 let view,current=true,follow=false,dirty=false,toggleGeneration=0,togglePending=false,toggleError='',draft=new Date().toISOString();
 const visible=()=>view==='settings';
 function draw(){
  if(!visible())return;let panel=document.getElementById('catalog-scene');
  if(!panel){panel=document.createElement('section');panel.id='catalog-scene';panel.className='display-whole-switch';document.getElementById('screen').prepend(panel);
   panel.innerHTML='<div class="body"><label><input id="scene-toggle" type="checkbox"> 전체 위성 표시</label><p id="scene-toggle-status" role="status"></p><div id="scene-advanced" hidden><p>적용된 카탈로그 검색 결과 전체의 정밀 좌표를 계산합니다. 목록의 100개 페이지와 지구 표시 개수는 별개입니다. GP 모델이며 실측이 아닙니다.</p><label><input id="scene-current" type="checkbox" checked> 현재 시각 실시간 추적 (기본)</label><br><label>지정 UTC <input id="scene-utc" type="text"></label> <label><input id="scene-follow" type="checkbox"> 선택 위성의 분석 시각 따라가기</label><br><button id="scene-load" class="button">전체 위성 계산·표시</button> <button id="scene-clear" class="button">전체 표시 해제</button><label><input id="scene-labels" type="checkbox"> 위성 이름 표시 (선택 GP·전체 카탈로그)</label><p id="scene-label-status"></p><p id="scene-status" role="status"></p><p id="scene-context"></p><p id="scene-source"></p><details><summary>전체 위치 자료의 SHA-256</summary><pre id="scene-hashes"></pre></details></div></div>';
   const node=id=>panel.querySelector('#'+id);
   node('scene-toggle').addEventListener('change',async e=>{const ticket=++toggleGeneration;toggleError='';if(!e.target.checked){togglePending=false;controller.clear();draw();return;}togglePending=true;current=true;follow=false;hooks.onFollowChange?.();draw();try{await hooks.prepare?.();if(ticket!==toggleGeneration)return;await controller.load(new Date().toISOString());}catch(error){if(ticket===toggleGeneration)toggleError=String(error.message||error);}finally{if(ticket===toggleGeneration){togglePending=false;draw();}}});
   node('scene-utc').value=draft;node('scene-follow').checked=follow;
   node('scene-utc').addEventListener('input',e=>{draft=e.target.value;dirty=true;current=false;follow=false;hooks.onFollowChange?.();draw();});
   node('scene-current').addEventListener('change',e=>{current=e.target.checked;if(current){follow=false;hooks.onCurrent?.();}hooks.onFollowChange?.();draw();});
   node('scene-follow').addEventListener('change',e=>{follow=e.target.checked;if(follow)current=false;hooks.onFollowChange?.();draw();});
   node('scene-load').addEventListener('click',()=>controller.load(current?new Date().toISOString():follow&&getTimeline()?.utc||draft));
   node('scene-clear').addEventListener('click',()=>controller.clear());
   node('scene-labels').addEventListener('change',e=>{hooks.setLabelsVisible?.(e.target.checked);draw();});
  }
  const node=id=>panel.querySelector('#'+id),s=controller.snapshot(),r=s.result;
  node('scene-toggle').checked=togglePending||s.enabled===true;node('scene-toggle-status').textContent=toggleError||s.error||((togglePending||s.pending)&&!r?'위성 표시 준비 중…':'');
  node('scene-toggle-status').hidden=!node('scene-toggle-status').textContent;
  if(!dirty&&s.desiredUtc){draft=s.desiredUtc;node('scene-utc').value=draft;}
  const labels=hooks.labelsVisible?.();node('scene-labels').checked=labels===true;node('scene-labels').disabled=typeof labels!=='boolean'||typeof hooks.setLabelsVisible!=='function';
  node('scene-label-status').textContent=typeof labels==='boolean'?`위성 이름 ${labels?'표시':'숨김'} · 지상국·노드 이름은 별도입니다. 대량 카탈로그는 성능 보호 기준에 따라 이름 표시가 제한됩니다.`:'위성 이름 표시 제어 미연결';
  node('scene-current').checked=current;node('scene-current').value=String(current);node('scene-utc').disabled=current||follow;
  node('scene-follow').checked=follow;
  node('scene-follow').value=String(follow);
  node('scene-load').disabled=s.pending||!s.context;
  node('scene-status').textContent=`${current?'현재 시각 실시간 추적':follow?'선택 위성 분석 시각':'지정 시각 조회'} · GP 궤도 계산 / 실제 위치 수신 아님 · ${s.pending?'전체 위치 조회 중 · 마지막 snapshot UTC를 구분해 표시합니다. ':''}${s.error?'위치 미표시: '+s.error:r?`전체 ${r.count}개 / 성공 ${r.valid_count} / 실패 ${r.error_count} · 지구 snapshot UTC ${r.utc}`:'전체 지구 위치 없음'}${s.desiredUtc?' · 요청할 최신 UTC '+s.desiredUtc:''}`;
  node('scene-context').textContent=s.context?`적용 조건: ${s.context.group} / ${s.context.query||'검색어 없음'} / ${s.context.orbit} · 지구 위성을 선택하면 같은 GP 자료의 상세정보로 연결합니다.`:'위성 카탈로그에서 조회 조건을 먼저 적용하세요.';
  node('scene-source').textContent=r?`${r.source} · 획득 시각 ${r.fetched_at} · ${r.stale?'오래된 캐시 · ':''}${r.warning||''} · IERS-A UT1 ${r.eop_quality.ut1} / 극운동 ${r.eop_quality.polar_motion} · ITRF m · 실제 통신 미확인`:'';
  if(s.timings&&r){panel.dataset.maxPreparationSliceMilliseconds=String(s.timings.max_preparation_slice_ms);panel.dataset.httpMilliseconds=String(s.timings.http_ms);panel.dataset.validationMilliseconds=String(s.timings.validation_and_copy_ms);panel.dataset.displayMilliseconds=String(s.timings.display_callback_ms);}
  node('scene-hashes').textContent=r?`전체 GP: ${r.scene_sha256}\nEOP: ${r.eop_sha256}\nUTC 윤초: ${r.leap_sha256}`:'자료 없음';
 }
 return{show(next){view=next;draw();},update:draw,followsCurrent:()=>current,followsTimeline:()=>follow,requestUtc:()=>current?new Date().toISOString():follow&&getTimeline()?.utc||draft,
  applyDraft(items){for(const item of items){if(item.id==='scene-utc'&&typeof item.value==='string'){draft=item.value;dirty=true;}if(item.id==='scene-current'&&['true','false'].includes(item.value)){current=item.value==='true';if(current)follow=false;}if(item.id==='scene-follow'&&['true','false'].includes(item.value)){follow=item.value==='true';if(follow)current=false;}}draw();const field=document.getElementById('scene-utc');if(visible()&&field)field.value=draft;},destroy(){toggleGeneration++;view=null;}};
}
