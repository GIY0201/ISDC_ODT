import {createHilPanel} from './tabs/hil_workspace.js?v=t069-r2';
import {hilTopology} from '/static/visualization/hil_topology.js';
import {createWorkspaceRevisionSync} from './workspace_revision_sync.js';
import {api,telemetrySocket} from '/static/communication/api.js';
import {createKpiPanel} from './tabs/kpi_workspace.js?v=t069-r2';
import {drawMultiLine,drawSparkline} from '/static/visualization/charts.js';
import {createSimPanel} from './tabs/sim_workspace.js?v=t069-r2';
import {createMissionPanel} from './tabs/mission_workspace.js?v=t069-r2';
import {createOrbitSelection} from './orbit_selection.js?v=t031-r1';
import {createWorkspaceGlobe} from './workspace_globe.js?v=t028-r1';
import {createWorkspacePlayback} from './workspace_playback.js';
import {createGroundPanel} from './tabs/ground_visibility.js?v=t053-r1';
import {createRadioSeriesPanel} from './tabs/orbit_radio_series.js?v=t053-r1';
import {createOrbitRadioPanel} from './tabs/orbit_radio.js?v=t048-r3';
import {createCommunicationPlanningPanel} from './tabs/communication_planning.js?v=t043-r1';
import {createRfPanel} from './tabs/rf_link_budget.js?v=t039-r1';

const escape=value=>String(value??'미확인').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view=null,displayUtc=null,displayElevation='자료 준비 중';
const globe=createWorkspaceGlobe(document.getElementById('stored-orbit-globe'),document.getElementById('orbit-globe-status'),document.getElementById('orbit-globe-focus'));
const client=createOrbitSelection(api,render);
const revisionSync=createWorkspaceRevisionSync(client);
const seriesPanel=createRadioSeriesPanel(client,api);
const groundPanel=createGroundPanel(client,api,{onInterval:(source,index)=>seriesPanel.choose(source,index),onInvalidate:()=>seriesPanel.clearInterval()});
const rfPanel=createRfPanel(api);
const planningPanel=createCommunicationPlanningPanel(api);
const radioPanel=createOrbitRadioPanel(client,api);
const missionPanel=createMissionPanel(api);
const kpiPanel=createKpiPanel(api,drawMultiLine);
const hilPanel=createHilPanel(api,hilTopology,drawSparkline);
const simPanel=createSimPanel(api,telemetrySocket,values=>missionPanel.controller.receiveMissions(values),{frame:value=>{kpiPanel.receive(value);hilPanel.receive(value);},status:value=>{kpiPanel.connection(value);hilPanel.connection(value);}});
const playback=createWorkspacePlayback(client,(snapshot,row,utc,error)=>{
  displayUtc=utc;displayElevation=row?`${row.elevation_deg.toFixed(4)}°`:'자료 준비 중 / 위치 미표시';globe.update(error?{...snapshot,status:'error',error}:snapshot,row,utc);
  const clock=document.getElementById('orbit-display-utc');if(clock)clock.textContent=utc||'미선택';
  const elevation=document.getElementById('orbit-display-elevation');if(elevation)elevation.textContent=displayElevation;
});
let disposed=false;
window.addEventListener('pagehide',event=>{if(!event.persisted&&!disposed){disposed=true;revisionSync.destroy();client.destroy();groundPanel.destroy();rfPanel.destroy();planningPanel.destroy();radioPanel.destroy();seriesPanel.destroy();missionPanel.destroy();simPanel.destroy();kpiPanel.destroy();hilPanel.destroy();playback.destroy();globe.destroy();}});
async function command(work){await work();const current=client.snapshot();if(current.status==='ready'&&!current.state?.playing)await client.samples({stepSeconds:1,count:3});}
function render(){
  revisionSync.observe(client.snapshot());
  playback.update(client.snapshot());
  groundPanel.update();
  rfPanel.update();
  planningPanel.update();
  radioPanel.update();
  seriesPanel.update();
  missionPanel.update();
  simPanel.update();
  kpiPanel.update();
  hilPanel.update();
  if(view!=='satellite')return;
  const screen=document.getElementById('screen');let panel=document.getElementById('stored-orbit');
  if(!panel){panel=document.createElement('section');panel.id='stored-orbit';panel.className='panel';screen.prepend(panel);}
  const {inputs,state,result,status,error}=client.snapshot();
  const record=inputs.find(item=>item.input_id===state?.input_id);
  const oldUtc=document.getElementById('orbit-utc');const draft=oldUtc?.dataset?.dirty?oldUtc.value:null;
  const disabled=!record||status==='pending';
  const controls=`<div class="orbit-playback-controls"><button id="orbit-play" type="button" ${disabled||state?.playing?'disabled':''}>재생</button><button id="orbit-pause" type="button" ${disabled||!state?.playing?'disabled':''}>정지</button><label>속도 <select id="orbit-rate" ${disabled?'disabled':''}>${[.1,1,10,60].map(rate=>`<option value="${rate}" ${rate===state?.play_rate?'selected':''}>${rate}×</option>`).join('')}</select></label><label>UTC <input id="orbit-utc" ${draft!==null?'data-dirty="true"':''} type="text" value="${escape(draft??state?.current_utc??'')}" placeholder="YYYY-MM-DDTHH:mm:ss.sssssssssZ" ${disabled?'disabled':''}></label><button id="orbit-seek" type="button" ${disabled?'disabled':''}>UTC 적용·정지</button><button id="orbit-epoch" type="button" ${disabled?'disabled':''}>입력 epoch 복귀</button><p>표시 UTC <output id="orbit-display-utc">${escape(displayUtc||'미선택')}</output><br>표시 고도각 <output id="orbit-display-elevation">${escape(displayElevation)}</output></p><small>1초 샘플만 보간합니다. 자료 밖에서는 위치를 표시하지 않습니다.</small></div>`;
  const age=record&&state?((Date.parse(state.current_utc)-Date.parse(record.epoch_utc))/3600000):NaN;
  panel.innerHTML=`<header><h2>저장 궤도 입력 · 실제 계산</h2><small>SGP4 모델 결과 / 실측 아님</small></header><div class="body">${controls}<p role="status">${escape(status)} ${escape(error||'')}</p><label>저장 입력 <select id="orbit-input"><option value="">입력 선택</option>${inputs.map(item=>`<option value="${escape(item.input_id)}" ${item.input_id===state?.input_id?'selected':''}>${escape(item.satellite_id)} / ${escape(item.format)}</option>`).join('')}</select></label><p>입력 epoch에서 시작합니다. OMM은 공개 TLE에서 파생한 동등 형식이며 현재 ISS 관측 자료가 아닙니다.</p>${record?`<dl><dt>출처</dt><dd>${escape(record.source)}</dd><dt>epoch UTC</dt><dd>${escape(record.epoch_utc)}</dd><dt>보존 UTC</dt><dd>${escape(record.fetched_utc)}</dd><dt>서버 UTC</dt><dd>${escape(state.current_utc)}</dd><dt>epoch 대비 경과</dt><dd>${Number.isFinite(age)?age.toFixed(3)+' h':'UTC 윤초 포함 시 단순 날짜 차이는 미표시'}</dd><dt>입력 SHA256</dt><dd style="overflow-wrap:anywhere">${escape(record.raw_sha256)}</dd></dl><button type="button" id="orbit-calculate" ${status==='pending'?'disabled':''}>${state.playing?"재생 버퍼 다시 계산":"현재 UTC부터 3개 샘플 계산"}</button>`:''}${status==='empty'?'<p>저장 입력이 없습니다. quickstart의 저장 입력 profile로 실행하세요.</p>':''}${result?`<p>ITRF 위치 m / 선택 가상 지점 고도각 ° · 실제 통신 조건 미확인</p><ul>${result.rows.slice(0,3).map(row=>`<li>${escape(row.utc)} / ${row.position_m?row.position_m.map(x=>Number(x).toFixed(2)).join(', '):'위치 계산 실패'} / ${row.elevation_deg==null?'고도각 없음':Number(row.elevation_deg).toFixed(4)+'°'} / ${escape(row.status)}</li>`).join('')}</ul><p>총 ${result.rows.length}행 / 앞 3행 미리보기 · revision ${escape(result.revision)} / ${escape(result.status)}</p>`:''}</div>`;
  panel.querySelector('#orbit-input').addEventListener('change',event=>{if(event.target.value)client.select(event.target.value);else event.target.value=state?.input_id||'';});
  panel.querySelector('#orbit-calculate')?.addEventListener('click',()=>client.samples({startUtc:displayUtc||state.current_utc,stepSeconds:1,count:state.playing?601:3}));
  panel.querySelector('#orbit-play').addEventListener('click',()=>command(()=>client.control('play')));
  panel.querySelector('#orbit-pause').addEventListener('click',()=>command(()=>client.control('pause')));
  panel.querySelector('#orbit-rate').addEventListener('change',event=>command(()=>client.control('speed',Number(event.target.value))));
  panel.querySelector('#orbit-utc').addEventListener('input',event=>{event.target.dataset.dirty='true';});
  panel.querySelector('#orbit-seek').addEventListener('click',()=>{const field=panel.querySelector('#orbit-utc'),utc=field.value.trim();delete field.dataset.dirty;command(()=>client.seek(utc));});
  panel.querySelector('#orbit-epoch').addEventListener('click',()=>{delete panel.querySelector('#orbit-utc').dataset.dirty;command(()=>client.seek(record.epoch_utc));});
}
export function showWorkspaceOrbit(currentView){view=currentView;groundPanel.show(view);rfPanel.show(view);planningPanel.show(view);radioPanel.show(view);seriesPanel.show(view);missionPanel.show(view);simPanel.show(view);kpiPanel.show(view);hilPanel.show(view);render();}
client.load();

export function applyWorkspaceDraft(items,remote=false){
  missionPanel.applyDraft(items,remote);
  simPanel.applyDraft(items);
  kpiPanel.applyDraft(items);
  hilPanel.applyDraft(items);
  groundPanel.applyDraft(items);
  rfPanel.applyDraft(items,remote);
  planningPanel.applyDraft(items,remote);
  radioPanel.applyDraft(items,remote);
  seriesPanel.applyDraft(items,remote);
  for(const item of items){if(item.id!=='orbit-utc'||typeof item.value!=='string')continue;const field=document.getElementById(item.id);if(field){field.value=item.value;field.dataset.dirty='true';}}
}
