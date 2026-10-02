import {api} from '/static/communication/api.js';
import {createOrbitSelection} from './orbit_selection.js';

const escape=value=>String(value??'미확인').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view=null;
const client=createOrbitSelection(api,render);
function render(){
  if(view!=='satellite')return;
  const screen=document.getElementById('screen');let panel=document.getElementById('stored-orbit');
  if(!panel){panel=document.createElement('section');panel.id='stored-orbit';panel.className='panel';screen.prepend(panel);}
  const {inputs,state,result,status,error}=client.snapshot();
  const record=inputs.find(item=>item.input_id===state?.input_id);
  const age=record&&state?((Date.parse(state.current_utc)-Date.parse(record.epoch_utc))/3600000):NaN;
  panel.innerHTML=`<header><h2>저장 궤도 입력 · 실제 계산</h2><small>SGP4 모델 결과 / 실측 아님</small></header><div class="body"><p role="status">${escape(status)} ${escape(error||'')}</p><label>저장 입력 <select id="orbit-input"><option value="">입력 선택</option>${inputs.map(item=>`<option value="${escape(item.input_id)}" ${item.input_id===state?.input_id?'selected':''}>${escape(item.satellite_id)} / ${escape(item.format)}</option>`).join('')}</select></label><p>입력 epoch에서 시작합니다. OMM은 공개 TLE에서 파생한 동등 형식이며 현재 ISS 관측 자료가 아닙니다.</p>${record?`<dl><dt>출처</dt><dd>${escape(record.source)}</dd><dt>epoch UTC</dt><dd>${escape(record.epoch_utc)}</dd><dt>보존 UTC</dt><dd>${escape(record.fetched_utc)}</dd><dt>서버 UTC</dt><dd>${escape(state.current_utc)}</dd><dt>epoch 대비 경과</dt><dd>${Number.isFinite(age)?age.toFixed(3)+' h':'UTC 윤초 포함 시 단순 날짜 차이는 미표시'}</dd><dt>입력 SHA256</dt><dd style="overflow-wrap:anywhere">${escape(record.raw_sha256)}</dd></dl><button type="button" id="orbit-calculate" ${status==='pending'?'disabled':''}>현재 UTC부터 3개 샘플 계산</button>`:''}${status==='empty'?'<p>저장 입력이 없습니다. quickstart의 저장 입력 profile로 실행하세요.</p>':''}${result?`<p>ITRF 위치 m / 제주 가상 지점 고도각 ° · 실제 통신 조건 미확인</p><ul>${result.rows.map(row=>`<li>${escape(row.utc)} / ${row.position_m?row.position_m.map(x=>Number(x).toFixed(2)).join(', '):'위치 계산 실패'} / ${row.elevation_deg==null?'고도각 없음':Number(row.elevation_deg).toFixed(4)+'°'} / ${escape(row.status)}</li>`).join('')}</ul><p>revision ${escape(result.revision)} / ${escape(result.status)}</p>`:''}</div>`;
  panel.querySelector('#orbit-input').addEventListener('change',event=>{if(event.target.value)client.select(event.target.value);});
  panel.querySelector('#orbit-calculate')?.addEventListener('click',()=>client.samples());
}
export function showWorkspaceOrbit(currentView){view=currentView;render();}
client.load();
