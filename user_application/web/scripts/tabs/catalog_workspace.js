const copy=v=>structuredClone(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=v=>Number.isInteger(v)&&v>0&&v<=999999999;
const sources=['celestrak-live','celestrak-cache','celestrak-stale','demo-fallback','upstream-unavailable'];
const sourceLabels={'celestrak-live':'CelesTrak 새 조회','celestrak-cache':'CelesTrak 캐시','celestrak-stale':'오래된 CelesTrak 캐시','demo-fallback':'예제 데이터 · 실제 현재 궤도 아님','upstream-unavailable':'원본 조회 불가','celestrak-satcat':'CelesTrak SATCAT','gp-cache':'GP 기반 제한된 상세 · SATCAT 미확인'};
const known=v=>v===null||v===undefined||v===''?'미확인':v;
function validPage(v,p){
 if(!v||!sources.includes(v.source)||v.group!==p.group||v.limit!==100||v.offset!==p.offset||!Array.isArray(v.items)||v.items.length>100||v.count!==v.items.length||!['total','filtered_total','count'].every(k=>Number.isInteger(v[k])&&v[k]>=0)||v.filtered_total>v.total||v.count>v.filtered_total||v.items.some(x=>!id(x?.NORAD_CAT_ID))||new Set(v.items.map(x=>x.NORAD_CAT_ID)).size!==v.count)throw Error('카탈로그 응답 오류');
 return copy(v);
}
export function profileRows(item,profile){
 const catalog=profile?.catalog??{},gp=profile?.gp??item??{},hasOrbit=Number.isFinite(gp.MEAN_MOTION)&&gp.MEAN_MOTION>0;
 return [['NORAD',known(catalog.NORAD_CAT_ID??item?.NORAD_CAT_ID)],['COSPAR',known(catalog.OBJECT_ID??item?.OBJECT_ID)],['소유 기관',known(catalog.OWNER)],['객체 종류 · 원본 코드',known(catalog.OBJECT_TYPE)],['운용 상태 · 원본 코드',known(catalog.OPS_STATUS_CODE)],['발사일',known(catalog.LAUNCH_DATE)],['발사 장소',known(catalog.LAUNCH_SITE)],['소멸일',known(catalog.DECAY_DATE)],['RCS m²',known(catalog.RCS)],['공개 분류 · 원본 코드',known(gp.CLASSIFICATION_TYPE)],['궤도 분류 · 서버 모델',hasOrbit?known(gp.ORBIT_REGIME):'미확인'],['주기 min',hasOrbit?known(gp.PERIOD_MINUTES):'미확인'],['경사각 °',known(gp.INCLINATION)],['이심률',known(gp.ECCENTRICITY)],['근지점 km · 서버 모델',hasOrbit?known(gp.PERIGEE_KM):'미확인'],['원지점 km · 서버 모델',hasOrbit?known(gp.APOGEE_KM):'미확인'],['GP epoch · 원본',known(gp.EPOCH)],['캐시 생성 당시 epoch 경과 h',known(gp.EPOCH_AGE_HOURS)]];
}
export function createCatalogWorkspace(api,notify=()=>{},hooks={}){
 let dead=false,listToken=0,detailToken=0,listAbort,detailAbort;
 const state={groups:[],draft:{group:'active',query:'',orbit:'all'},applied:null,result:null,selected:null,profile:null,pending:false,detailPending:false,error:'',detailError:'',status:'조회 전'};
 const emit=()=>{if(!dead)notify();};
 const clearDetail=()=>{detailToken++;detailAbort?.abort();state.selected=null;state.profile=null;state.detailPending=false;state.detailError='';hooks.clear?.();};
 async function search(offset=0){
  if(dead||!state.groups.length)return;
  const p={...state.draft,query:state.draft.query.trim(),limit:100,offset};
  const token=++listToken;listAbort?.abort();listAbort=new AbortController();clearDetail();state.pending=true;state.error='';state.status='조회 중';emit();
  try{const v=validPage(await api.satellites(p,{signal:listAbort.signal}),p);if(dead||token!==listToken)return;state.result=v;state.applied=copy(p);state.status=v.source==='upstream-unavailable'?'원본 조회 불가':v.count?'조회 완료':'검색 결과 없음';}
  catch(e){if(dead||token!==listToken)return;state.error=String(e.message||e);state.status='조회 실패 · 마지막 성공 결과 유지';}
  finally{if(!dead&&token===listToken){state.pending=false;emit();}}
 }
 async function load(){
  if(dead)return;
  try{const v=await api.satelliteGroups();if(dead)return;if(!Array.isArray(v?.items)||!v.items.length||v.items.some(g=>!g||typeof g.id!=='string'||!g.id||typeof g.label!=='string')||new Set(v.items.map(g=>g.id)).size!==v.items.length)throw Error('그룹 응답 오류');state.groups=copy(v.items);if(!state.groups.some(g=>g.id===state.draft.group))state.draft.group=state.groups[0].id;await search();}
  catch(e){if(!dead){state.error=String(e.message||e);state.status='그룹 조회 실패';emit();}}
 }
 function edit(key,value){if(dead)return;if(key==='group'&&state.groups.some(g=>g.id===value)||key==='orbit'&&['all','LEO','MEO','GEO','HEO'].includes(value)||key==='query'&&typeof value==='string'&&[...value].length<=100){state.draft[key]=value;emit();}}
 async function select(number){
  const item=state.result?.items.find(x=>x.NORAD_CAT_ID===number);if(dead||state.pending||!item)return;
  clearDetail();state.selected=number;state.detailPending=true;detailAbort=new AbortController();const token=++detailToken;hooks.select?.(number,state.applied.group);emit();
  try{const v=await api.satelliteProfile(number,{signal:detailAbort.signal});if(dead||token!==detailToken)return;if(!['celestrak-satcat','gp-cache'].includes(v?.source)||v.catalog?.NORAD_CAT_ID!==number||v.gp&&v.gp.NORAD_CAT_ID!==number)throw Error('상세 응답 오류');state.profile=copy(v);}
  catch(e){if(!dead&&token===detailToken)state.detailError=String(e.message||e);}
  finally{if(!dead&&token===detailToken){state.detailPending=false;emit();}}
 }
 function page(delta){const p=state.applied,r=state.result;if(!p||!r||state.pending||['group','query','orbit'].some(k=>state.draft[k]!==p[k]))return;const offset=p.offset+delta*100;if(offset<0||offset>=r.filtered_total)return;state.draft={group:p.group,query:p.query,orbit:p.orbit};return search(offset);}
 return {snapshot:()=>copy(state),load,search:()=>search(0),edit,select,next:()=>page(1),previous:()=>page(-1),destroy(){dead=true;listToken++;detailToken++;listAbort?.abort();detailAbort?.abort();}};
}
export function createCatalogPanel(api,geometry){
 let view,loaded=false;const visible=()=>view==='satellite';
 const controller=createCatalogWorkspace(api,draw,{select:(number,group)=>geometry?.select(number,group),clear:()=>geometry?.clear()});
 function draw(){
  if(!visible())return;let panel=document.getElementById('catalog-workspace');if(!panel){panel=document.createElement('section');panel.id='catalog-workspace';panel.className='panel';document.getElementById('screen').prepend(panel);panel.innerHTML=`<header><h2>위성 카탈로그 · 기존 조회</h2></header><div class="body"><p>공개 GP/SATCAT 조회입니다. 선택은 상세 보기이며 저장 궤도 입력·UTC를 변경하지 않습니다.</p><div class="catalog-controls"><label>그룹 <select id="cat-group"></select></label><label>검색 <input id="cat-query" maxlength="100" placeholder="위성 이름 · COSPAR · NORAD"></label><label>궤도 <select id="cat-orbit">${['all','LEO','MEO','GEO','HEO'].map(x=>`<option value="${x}">${x==='all'?'전체 궤도':x}</option>`).join('')}</select></label><button id="cat-search" class="button">조건 적용·조회</button></div><p id="cat-status" role="status"></p><p id="cat-source"></p><p id="cat-applied"></p><div class="cp-table" id="cat-list"></div><button id="cat-prev" class="button">이전 100개</button> <button id="cat-next" class="button">다음 100개</button><p id="cat-detail-status" role="status"></p><p id="cat-position" role="status"></p><details><summary>좌표 자료의 SHA-256</summary><pre id="cat-position-hashes"></pre></details><button id="cat-position-clear" class="button">카탈로그 지구 표시 해제</button><div id="cat-detail"></div></div>`;
   const node=x=>panel.querySelector('#'+x);
   for(const key of ['group','query','orbit'])node('cat-'+key).addEventListener(key==='query'?'input':'change',e=>controller.edit(key,e.target.value));
   node('cat-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();controller.search();}});
   node('cat-position-clear').addEventListener('click',()=>geometry?.clear());
   node('cat-search').addEventListener('click',()=>controller.snapshot().groups.length?controller.search():controller.load());node('cat-prev').addEventListener('click',()=>controller.previous());node('cat-next').addEventListener('click',()=>controller.next());
  }
  const s=controller.snapshot(),r=s.result,p=s.applied,node=x=>panel.querySelector('#'+x);
  const options=s.groups.map(g=>`<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('');if(node('cat-group').innerHTML!==options)node('cat-group').innerHTML=options;
  for(const key of ['group','query','orbit'])if(node('cat-'+key).value!==s.draft[key])node('cat-'+key).value=s.draft[key];
  node('cat-status').textContent=`${s.status} ${s.error} · 편집한 조건은 조회 버튼으로 적용됩니다.`;
  node('cat-source').textContent=r?`${sourceLabels[r.source]} · 목록 획득 시각 ${known(r.fetched_at)} · ${r.stale?'stale · ':''}${r.warning||''}`:'목록 자료 없음';
  node('cat-applied').textContent=p?`표시된 결과 조건: ${p.group} / ${p.query||'검색어 없음'} / ${p.orbit} · 전체 ${r.total} / 필터 ${r.filtered_total} · ${r.count?p.offset+1:0}–${p.offset+r.count}번째`:'적용 조건 없음';
  const html=r?.count?`<table><thead><tr><th>위성</th><th>NORAD</th><th>궤도 · 모델</th></tr></thead><tbody>${r.items.map(x=>`<tr><td><button id="cat-sat-${x.NORAD_CAT_ID}" class="button" ${s.pending?'disabled':''}>${esc(x.OBJECT_NAME||'미확인')}</button></td><td>${x.NORAD_CAT_ID}</td><td>${Number.isFinite(x.MEAN_MOTION)&&x.MEAN_MOTION>0?esc(known(x.ORBIT_REGIME)):'미확인'}</td></tr>`).join('')}</tbody></table>`:'<p>표시할 위성이 없습니다.</p>';
  if(node('cat-list').innerHTML!==html){node('cat-list').innerHTML=html;r?.items.forEach(x=>node('cat-sat-'+x.NORAD_CAT_ID)?.addEventListener('click',()=>controller.select(x.NORAD_CAT_ID)));}
  const edited=p&&['group','query','orbit'].some(k=>s.draft[k]!==p[k]);node('cat-prev').disabled=s.pending||edited||!p||p.offset===0;node('cat-next').disabled=s.pending||edited||!p||p.offset+100>=r.filtered_total;
  node('cat-detail-status').textContent=`${s.detailPending?'상세 조회 중':''} ${s.detailError}`;
  const position=geometry?.snapshot();const pos=position?.result;const quality={final_b:'확정 B',observed_a:'관측 A',predicted_a:'예측 A'};
  node('cat-position').textContent=position?.pending?'Rust 카탈로그 위치 계산 중':position?.error?`카탈로그 위치 미표시: ${position.error}`:pos?`선택 GP 기준 위치: ${pos.name} (${pos.catalog_number}) · epoch UTC ${pos.utc} · ITRF m ${pos.position_m.map(x=>x.toFixed(2)).join(', ')} · IERS-A UT1 ${quality[pos.eop_quality.ut1]} / 극운동 ${quality[pos.eop_quality.polar_motion]} · ${pos.source} ${pos.stale?'오래된 캐시':''} · epoch 모델 위치/실측 아님 · 현재 표시 시각은 시간 탐색 패널에서 확인`:'카탈로그 지구 표시 없음 · 선택하면 GP epoch 위치를 계산합니다. 저장 궤도 입력과 UTC는 바뀌지 않습니다.';
  node('cat-position-hashes').textContent=pos?`정규화 GP: ${pos.normalized_gp_sha256}\nEOP: ${pos.eop_sha256}\nUTC 윤초: ${pos.leap_sha256}`:'표시 자료 없음';
  const item=r?.items.find(x=>x.NORAD_CAT_ID===s.selected),d=s.profile;
  node('cat-detail').innerHTML=item?`<h3>${esc(d?.catalog?.OBJECT_NAME||item.OBJECT_NAME)} · ${s.selected}</h3><p>${d?esc(sourceLabels[d.source]):'SATCAT 상세 아직 없음'} · 상세 응답 시각 ${esc(known(d?.fetched_at))} · ${esc(d?.warning||'')}</p><dl>${profileRows(item,d).map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl><p>원본 코드와 서버 파생 궤도값입니다. 실제 통신 상태는 미확인입니다.</p>`:'';
 }
 return {controller,show(next){view=next;if(visible()){draw();if(!loaded){loaded=true;controller.load();}}},update:draw,applyDraft(items){for(const x of items){if(x.id.startsWith('cat-'))controller.edit(x.id.slice(4),x.value);}},destroy:()=>controller.destroy()};
}
