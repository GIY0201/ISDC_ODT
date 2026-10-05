import {createUtcCodec} from '../orbit_utc.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createCatalogPassPanel(track,passes,getTimeline){
 let active=false,panel=null,signature=null;
 const node=id=>panel?.querySelector('#'+id);
 function draw(){
  if(!active)return;
  if(!panel?.isConnected){panel=document.createElement('section');panel.id='catalog-passes';panel.className='panel';document.getElementById('screen').prepend(panel);panel.innerHTML='<header><h2>선택 위성 궤적 · 24시간 가시 구간</h2></header><div class="body"><p>Rust SGP4·IERS-A 기하학 모델입니다. 관측 지상국과 최소 고도각은 시간 탐색에서 적용합니다. 실제 통신 가능 여부는 미확인입니다.</p><label><input id="cat-track-show" type="checkbox" checked> 선택 위성의 한 주기 궤적 표시</label> <button id="cat-track-refresh" class="button">궤적 다시 계산</button><p id="cat-track-status" role="status"></p><button id="cat-pass-query" class="button">현재 카탈로그 UTC부터 24시간 조회</button><p id="cat-pass-status" role="status"></p><div id="cat-pass-results"></div></div>';signature=null;
   node('cat-track-show').addEventListener('change',e=>{track.enabled(e.target.checked);if(e.target.checked)track.observe(getTimeline().utc);draw();});
   node('cat-track-refresh').addEventListener('click',()=>track.refresh(getTimeline().utc));node('cat-pass-query').addEventListener('click',()=>passes.query());
  }
  const t=getTimeline(),a=track.snapshot(),s=passes.snapshot(),r=s.result;
  node('cat-track-show').checked=a.enabled;node('cat-track-show').value=String(a.enabled);
  node('cat-track-refresh').disabled=!t.selected||!a.enabled||a.pending;
  node('cat-track-status').textContent=a.pending?`궤적 조회 중${a.result?' · 표시 궤적 기준 UTC '+a.result.reference_utc:' · 표시할 이전 궤적 없음'}`:a.error||(!a.enabled?'궤적 숨김':a.result?`궤적 기준 UTC ${a.result.reference_utc} · ${a.result.valid_count}/${a.result.count}개 성공 · 실패 ${a.result.error_count} · ${a.result.period_seconds.toFixed(3)}초 주기 · ${a.result.source}`:'표시할 궤적 없음');
  node('cat-pass-query').disabled=!t.selected||!t.observer||s.pending;
  node('cat-pass-status').textContent=s.pending?'24시간 정밀 가시 구간 계산 중…':s.error||(!r?'선택 위성과 관측 조건을 적용한 뒤 명시적으로 조회하세요.':`${r.status==='partial'?'일부 계산 실패 · 알려진 구간만 표시':r.status==='none'?'가시 구간·접점 없음':r.status==='error'?'계산 실패 · 가시 여부 판정 불가':'전체 범위 계산 완료'} · 구간 ${r.intervals.length}개 / 접점 ${r.contacts.length}개 / 실패 ${r.errors.length}개`);
  const next=JSON.stringify(r);if(next===signature)return;signature=next;
  if(!r){node('cat-pass-results').innerHTML='';return;}
  // One UTC scale for the original table/timeline; geometry is never computed here.
  const codec=createUtcCodec(r.leap_sha256),duration=codec.difference(r.query_end_utc,r.query_start_utc),ratio=utc=>Math.max(0,Math.min(100,codec.difference(utc,r.query_start_utc)/duration*100));
  const bars=r.intervals.map((x,i)=>`<rect x="${ratio(x.start_utc)}" y="3" width="${Math.max(.08,ratio(x.end_utc)-ratio(x.start_utc))}" height="14" fill="#5ee277"><title>${esc(x.start_utc)} ~ ${esc(x.end_utc)} / ${x.max_elevation_deg.toFixed(4)}°</title></rect>`).join('');
  node('cat-pass-results').innerHTML=`<p>조회 UTC ${esc(r.query_start_utc)} ~ ${esc(r.query_end_utc)}<br>${esc(r.source)} · GP epoch ${esc(r.epoch_utc)} · 최소 고도각 ${r.minimum_elevation_deg}° · 타원체 높이 ${r.ground_point.ellipsoid_height_m} m 가정</p><svg viewBox="0 0 100 20" role="img" aria-label="24시간 기하학적 가시 구간 시간표" style="width:100%;height:48px;background:#14283b">${bars}</svg><p>왼쪽: 조회 시작 / 오른쪽: 24시간 후 · 아래 시작 시각 버튼으로 이동</p><div class="visibility-table"><table><caption>기하학적 가시 구간 · UTC</caption><thead><tr><th>시작 · 시각 이동</th><th>종료</th><th>최대 시각 / 고도각</th><th>조회 경계</th></tr></thead><tbody>${r.intervals.map((x,i)=>`<tr><td><button class="button" id="cat-pass-aos-${i}">${esc(x.start_utc)}</button></td><td>${esc(x.end_utc)}</td><td>${esc(x.peak_utc)}<br>${x.max_elevation_deg.toFixed(4)}°</td><td>${x.start_clipped?'시작 잘림 ':''}${x.end_clipped?'종료 잘림':''}${!x.start_clipped&&!x.end_clipped?'양쪽 경계 확인':''}</td></tr>`).join('')}</tbody></table></div>${r.contacts.length?`<p>지속 시간 0초 접점: ${r.contacts.map(x=>esc(x.utc)).join(', ')}</p>`:''}${r.errors.length?`<details><summary>계산 실패 ${r.errors.length}개 · 실패 시각은 판정 미확인</summary><ul>${r.errors.map(x=>`<li>${esc(x.utc)} / ${esc(x.error_code)}</li>`).join('')}</ul></details>`:''}<details><summary>계산 자료 SHA-256</summary><pre>GP ${esc(r.normalized_gp_sha256)}\nEOP ${esc(r.eop_sha256)}\n윤초 ${esc(r.leap_sha256)}</pre></details>`;
  for(const [i]of r.intervals.entries())node('cat-pass-aos-'+i)?.addEventListener('click',()=>passes.seek(i));
 }
 return{show(view){active=view==='satellite';draw();},update:draw,applyDraft(items){for(const item of items)if(item.id==='cat-track-show'&&['true','false'].includes(item.value)){track.enabled(item.value==='true');if(item.value==='true')track.observe(getTimeline().utc);}draw();},destroy(){active=false;}};
}
