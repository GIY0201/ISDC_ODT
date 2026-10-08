import {createUtcCodec} from '../orbit_utc.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeLabel=utc=>String(utc).replace('T',' ').slice(0,19)+' UTC';
export function createCatalogPassPanel(track,passes,getTimeline,hooks={}){
 let active=false,panel=null,signature=null,stationId='',message='';
 const node=id=>panel?.querySelector('#'+id);
 function draw(){
  if(!active)return;
  if(!panel?.isConnected){panel=document.createElement('section');panel.id='catalog-passes';panel.className='panel';document.getElementById('screen').prepend(panel);panel.innerHTML='<header><h2>선택 위성의 지상국 가시 시간</h2></header><div class="body"><p>선택한 위성이 지상국의 최소 고도각 위에 나타나는 시간을 확인합니다.</p><p id="cat-pass-basis"></p><label>관측 지상국 <select id="cat-pass-station"></select></label><div hidden><label><input id="cat-track-show" type="checkbox" checked> 선택 위성의 한 주기 궤적 표시</label> <button id="cat-track-refresh" class="button">궤적 다시 계산</button><p id="cat-track-status" role="status"></p></div><button id="cat-pass-query" class="button">선택 시각부터 24시간 조회</button><p id="cat-pass-status" role="status"></p><div id="cat-pass-results"></div><details><summary>가시 시간 계산 안내</summary><p>선택한 위성의 분석 시각부터 계산합니다. 현재 시각과 다를 수 있습니다. 등록 지상국의 위치와 최소 고도각을 사용하며 SGP4와 IERS-A 모델로 계산한 기하학적 가시 시간입니다. 실제 교신 성공 여부는 장비와 전파 조건을 별도로 확인해야 합니다.</p></details></div>';signature=null;
   node('cat-track-show').addEventListener('change',e=>{track.enabled(e.target.checked);if(e.target.checked)track.observe(getTimeline().utc);draw();});
   node('cat-track-refresh').addEventListener('click',()=>track.refresh(getTimeline().utc));node('cat-pass-station').addEventListener('change',e=>{stationId=e.target.value;message='';draw();});node('cat-pass-query').addEventListener('click',async()=>{try{message='';if(hooks.applyStation)hooks.applyStation(stationId);await passes.query();}catch(error){message=String(error.message||error);}draw();});
  }
  const t=getTimeline(),a=track.snapshot(),s=passes.snapshot(),r=s.result;
  const stations=hooks.stations?.()??[];node('cat-pass-station').innerHTML='<option value="">지상국 선택</option>'+stations.filter(x=>x.enabled).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');node('cat-pass-station').value=stationId;
  node('cat-pass-basis').textContent=t.selected&&t.utc?`${t.selected.name||t.selected.catalog_number} · 조회 시작 ${timeLabel(t.utc)}`:'조회 시작 시각은 위성을 선택하면 표시됩니다.';
  node('cat-track-show').checked=a.enabled;node('cat-track-show').value=String(a.enabled);
  node('cat-track-refresh').disabled=!t.selected||!a.enabled||a.pending;
  node('cat-track-status').textContent=a.pending?`궤적 조회 중${a.result?' · 표시 궤적 기준 UTC '+a.result.reference_utc:' · 표시할 이전 궤적 없음'}`:a.error||(!a.enabled?'궤적 숨김':a.result?`궤적 기준 UTC ${a.result.reference_utc} · ${a.result.valid_count}/${a.result.count}개 성공 · 실패 ${a.result.error_count} · ${a.result.period_seconds.toFixed(3)}초 주기 · ${a.result.source}`:'표시할 궤적 없음');
  const needsStation=hooks.applyStation?!stationId:!t.observer;
  node('cat-pass-query').disabled=!t.selected||needsStation||s.pending;
  node('cat-pass-status').textContent=message|| (s.pending?'24시간 가시 구간 계산 중…':s.error||(!r?(!t.selected?'위성을 먼저 선택한 뒤 관측 지상국을 선택하세요.':needsStation?'관측 지상국을 선택하세요.':'조회할 준비가 되었습니다.'):`${r.status==='partial'?'일부 계산 실패 · 알려진 구간만 표시':r.status==='none'?'가시 구간·접점 없음':r.status==='error'?'계산 실패 · 가시 여부 판정 불가':'전체 범위 계산 완료'} · 구간 ${r.intervals.length}개 / 접점 ${r.contacts.length}개 / 실패 ${r.errors.length}개`));
  const next=JSON.stringify(r);if(next===signature)return;signature=next;
  if(!r){node('cat-pass-results').innerHTML='';return;}
  // One UTC scale for the original table/timeline; geometry is never computed here.
  const codec=createUtcCodec(r.leap_sha256),duration=codec.difference(r.query_end_utc,r.query_start_utc),ratio=utc=>Math.max(0,Math.min(100,codec.difference(utc,r.query_start_utc)/duration*100));
  const bars=r.intervals.map((x,i)=>`<rect x="${ratio(x.start_utc)}" y="3" width="${Math.max(.08,ratio(x.end_utc)-ratio(x.start_utc))}" height="14" fill="#5ee277"><title>${esc(x.start_utc)} ~ ${esc(x.end_utc)} / ${x.max_elevation_deg.toFixed(4)}°</title></rect>`).join('');
  node('cat-pass-results').innerHTML=`<p>조회 범위 ${esc(timeLabel(r.query_start_utc))} ~ ${esc(timeLabel(r.query_end_utc))}</p><details><summary>계산 기준</summary><p>자료 출처 ${esc(r.source)} · 궤도 자료 기준 시각 ${esc(r.epoch_utc)} · 최소 고도각 ${r.minimum_elevation_deg}° · 타원체 높이 ${r.ground_point.ellipsoid_height_m} m 가정</p></details><svg viewBox="0 0 100 20" role="img" aria-label="24시간 기하학적 가시 구간 시간표" style="width:100%;height:48px;background:#14283b">${bars}</svg><p>왼쪽: 조회 시작 / 오른쪽: 24시간 후 · 아래 시작 시각 버튼으로 이동</p><div class="visibility-table"><table><caption>기하학적 가시 구간 · UTC</caption><thead><tr><th>시작 · 시각 이동</th><th>종료</th><th>최대 시각 / 고도각</th><th>조회 경계</th></tr></thead><tbody>${r.intervals.map((x,i)=>`<tr><td><button class="button" id="cat-pass-aos-${i}">${esc(x.start_utc)}</button></td><td>${esc(x.end_utc)}</td><td>${esc(x.peak_utc)}<br>${x.max_elevation_deg.toFixed(4)}°</td><td>${x.start_clipped?'시작 잘림 ':''}${x.end_clipped?'종료 잘림':''}${!x.start_clipped&&!x.end_clipped?'양쪽 경계 확인':''}</td></tr>`).join('')}</tbody></table></div>${r.contacts.length?`<p>지속 시간 0초 접점: ${r.contacts.map(x=>esc(x.utc)).join(', ')}</p>`:''}${r.errors.length?`<details><summary>계산 실패 ${r.errors.length}개 · 실패 시각은 판정 미확인</summary><ul>${r.errors.map(x=>`<li>${esc(x.utc)} / ${esc(x.error_code)}</li>`).join('')}</ul></details>`:''}<details><summary>계산 자료 SHA-256</summary><pre>GP ${esc(r.normalized_gp_sha256)}\nEOP ${esc(r.eop_sha256)}\n윤초 ${esc(r.leap_sha256)}</pre></details>`;
  for(const [i]of r.intervals.entries())node('cat-pass-aos-'+i)?.addEventListener('click',()=>passes.seek(i));
 }
 return{show(view){active=view==='ground';if(!active){panel?.remove();panel=null;return;}draw();},update:draw,applyDraft(items){for(const item of items)if(item.id==='cat-track-show'&&['true','false'].includes(item.value)){track.enabled(item.value==='true');if(item.value==='true')track.observe(getTimeline().utc);}draw();},destroy(){active=false;}};
}
