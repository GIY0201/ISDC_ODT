import {runtimeSummary} from '../operator_summary.js?v=u016';
const copy = value => structuredClone(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds = ['link_loss','power_drop','thermal_spike','storage_pressure','latency_spike'];
const severities = ['low','medium','high'];
const metricLabels = {power:'전력 SIM %',temperature:'온도 · 원본 값 (단위 미확인)',attitude_error:'자세 오차 · 원본 값 (단위 미확인)',storage:'저장 SIM %',link_quality:'링크 품질 SIM %',delay_ms:'지연 ms',loss_percent:'손실 %',throughput_mbps:'처리량 Mbps',ber:'BER (무차원)',auth_percent:'인증 성공률 SIM %'};
function runtime(value) {
  if (!value || value.mode !== 'SIM' || typeof value.running !== 'boolean' || !Number.isFinite(value.speed) || value.speed < .1 || value.speed > 128 || !Number.isFinite(value.elapsed_seconds) || value.elapsed_seconds < 0 || !Number.isInteger(value.sequence) || value.sequence < 0 || typeof value.run_id !== 'string' || !value.run_id || typeof value.scenario_id !== 'string' || !Array.isArray(value.active_faults)) throw Error('SIM 상태 응답 오류');
  for (const f of value.active_faults) if (!f || typeof f.id !== 'string' || !kinds.includes(f.kind) || typeof f.target !== 'string' || !Number.isFinite(f.expires_at)) throw Error('장애 응답 오류');
  return copy(value);
}
function events(value) {
  if (!Array.isArray(value) || value.some(e => !e || typeof e.type !== 'string' || typeof e.message !== 'string' || !Number.isFinite(e.simulation_time))) throw Error('사건 응답 오류');
  return copy(value);
}
function number(value, low, high, integer=false) {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Number(value)) || Number(value)<low || Number(value)>high || integer && !Number.isInteger(Number(value))) throw Error(`숫자 범위 ${low}~${high}를 확인하세요.`);
  return Number(value);
}

export function createSimWorkspace(api, connector, changed=()=>{}, onMissions=()=>{}, timers={setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id)}, observers={}) {
  let state={runtime:null,scenarios:[],events:[],metrics:null,wallTime:'',busy:false,stale:true,connection:'idle',status:'서버 SIM 연결 대기',error:'',draft:{speed:'',scenario_id:'',target:'',kind:'link_loss',severity:'medium',duration_seconds:'60'}};
  let ended=false,close=null,connected=false,timer=null,barrier=null,received=0,initialized=false,receivedAtMs=null;
  let controlEntering=false;const controlReleases=new Set();
  function beginControl(){controlEntering=true;let cleanup;try{cleanup=observers.control?.();}finally{controlEntering=false;}let released=false;const release=()=>{if(released)return;released=true;controlReleases.delete(release);try{cleanup?.();}catch{/* Cleanup cannot replace command results. */}};controlReleases.add(release);if(ended)release();return release;}
  const receiptNow=typeof timers.now==='function'?timers.now:Date.now;
  function watch() { timers.clearTimer(timer); timer=timers.setTimer(()=>{if(!ended){state.stale=true;observers.status?.('stale');changed('stream');}},3500);timer?.unref?.(); }
  function installBootstrap(value, keepStream=false) {
    const r=runtime(value?.runtime), list=value.scenarios;
    if (!Array.isArray(list) || list.some(s=>!s || typeof s.id!=='string' || !s.id || typeof s.name!=='string') || new Set(list.map(s=>s.id)).size!==list.length || !Array.isArray(value.missions)) throw Error('SIM 목록 응답 오류');
    const e=events(value.events);
    state.scenarios=copy(list);
    if(!keepStream){if(state.runtime?.run_id!==r.run_id || state.runtime?.scenario_id!==r.scenario_id){state.metrics=null;state.wallTime='';state.stale=true;}state.runtime=r;state.events=e;receivedAtMs=null;onMissions(copy(value.missions));}
    if(!initialized){state.draft.speed=String(r.speed);state.draft.scenario_id=r.scenario_id;initialized=true;}
    return r;
  }
  function receive(value) {
    if(ended || state.busy)return;
    try {
      const r=runtime(value?.runtime);
      if(value.type!=='telemetry' || value.data_quality?.source!=='deterministic-sim' || value.data_quality.mode!=='SIM' || !Array.isArray(value.missions) || typeof value.wall_time!=='string' || !Number.isFinite(Date.parse(value.wall_time)) || Object.keys(metricLabels).some(k=>!Number.isFinite(value.telemetry?.[k]))) throw Error('텔레메트리 응답 오류');
      const e=events(value.events);
      if(barrier){const b=barrier.runtime;
        if(r.run_id!==b.run_id || r.scenario_id!==b.scenario_id || r.running!==b.running || r.speed!==b.speed || r.sequence<b.sequence || r.elapsed_seconds<b.elapsed_seconds)return;
        const f=barrier.fault;if(f && !r.active_faults.some(x=>x.id===f.id) && r.elapsed_seconds<f.expires_at)return;
      }else if(r.run_id===state.runtime?.run_id && r.sequence<state.runtime.sequence)return;
      onMissions(copy(value.missions));
      state.runtime=r;state.events=e;state.metrics=copy(value.telemetry);state.wallTime=value.wall_time;
      state.stale=false;if(!state.error)state.status='서버 SIM 스트림 수신';barrier=null;received++;receivedAtMs=receiptNow();watch();changed('stream');
      observers.frame?.(copy(value));
    } catch(error) {state.stale=true;state.error=error.message;observers.status?.('invalid');changed('stream');}
  }
  async function command(work,label) {
    if(ended || state.busy||controlEntering)return;
    const release=beginControl();if(ended){release();return;}
    try{
    state.busy=true;state.error='';changed('controls');
    try {
      const result=await work();if(ended)return;
      const fault=result?.id ? copy(result) : null;
      if(fault){if(typeof fault.id!=='string' || !Number.isFinite(fault.expires_at))throw Error('장애 응답 오류');}else runtime(result);
      const boot=await api.bootstrap();if(ended)return;
      const r=installBootstrap(boot);barrier={runtime:r,fault};state.metrics=null;state.wallTime='';state.stale=true;state.status=label+' · 스트림 동기화 대기';watch();
    } catch(error) {if(!ended){state.stale=true;state.error=`${error.message} · 명령 적용 여부는 서버 새로고침으로 확인하세요.`;state.status='요청 실패';}}
    finally {if(!ended){state.busy=false;changed('controls');}}
    }finally{release();}
  }
  const controller={
    snapshot:()=>copy(state),
    displayReceipt(){return !ended&&!state.stale&&!state.error&&!state.busy&&Number.isFinite(receivedAtMs)?{received_at_ms:receivedAtMs,run_id:state.runtime.run_id,sequence:state.runtime.sequence,elapsed_seconds:state.runtime.elapsed_seconds,running:state.runtime.running,speed:state.runtime.speed}:null;},
    connect(){if(ended || connected)return;connected=true;watch();close=connector(receive,status=>{if(!ended){state.connection=status;state.stale=true;observers.status?.(status);changed('stream');}});},
    async load(){if(ended || state.busy)return;state.busy=true;state.error='';changed('controls');const start=received;
      try{const value=await api.bootstrap();if(!ended){installBootstrap(value,received!==start);barrier=null;state.status='서버 상태 조회 · 지표는 스트림 표본';}}
      catch(error){if(!ended)state.error=error.message;}
      finally{if(!ended){state.busy=false;changed('controls');}}
    },
    edit(values){if(ended||state.busy)return;for(const key of Object.keys(state.draft))if(key in values)state.draft[key]=String(values[key]??'');changed('draft');},
    control(action){return command(()=>{if(!['start','pause','reset','step'].includes(action))throw Error('SIM 동작 오류');return api.runtimeControl(action);},`SIM ${action} 응답`);},
    speed(){return command(()=>api.runtimeSpeed(number(state.draft.speed,.1,128)),'배속 응답');},
    scenario(){return command(()=>{const id=state.draft.scenario_id;if(!state.scenarios.some(s=>s.id===id))throw Error('서버 시나리오를 선택하세요.');return api.selectScenario(id);},'시나리오 응답');},
    fault(){return command(()=>{const d=state.draft,target=d.target.trim();if(!target || [...target].length>80 || !kinds.includes(d.kind) || !severities.includes(d.severity))throw Error('장애 대상·유형·심각도를 확인하세요.');return api.injectFault({target,kind:d.kind,severity:d.severity,duration_seconds:number(d.duration_seconds,1,3600,true)});},'장애 주입 응답');},
    destroy(){if(ended)return;ended=true;receivedAtMs=null;for(const release of [...controlReleases])release();timers.clearTimer(timer);close?.();}
  };
  return controller;
}

export function createSimPanel(api, connector, onMissions, observers={}) {
  const document=globalThis.document;
  let view=null,loaded=false;
  const visible=()=>view==='run';
  const controller=createSimWorkspace(api,connector,draw,onMissions,undefined,observers);
  function draw(reason) {
    if(!visible())return;
    const screen=document.getElementById('screen');let panel=document.getElementById('sim-workspace');
    if(!panel){if(['operations','run'].includes(view))screen.innerHTML='';panel=document.createElement('section');panel.id='sim-workspace';panel.className='panel';screen.prepend(panel);}
    const s=controller.snapshot(),d=s.draft;
    if(!panel.querySelector('#sim-controls')){
      const opts=values=>values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      panel.innerHTML=`<header><h2>실행 제어 · 기존 SIM</h2><small>결정론적 모의 지표 / 실측 아님</small></header><div class="body"><div id="sim-controls">
        <div class="sim-control-group" role="group" aria-label="실행 제어"><h3>실행 제어</h3><div class="actions"><button class="button" id="sim-refresh">서버 새로고침</button>${['start','pause','step','reset'].map((x,i)=>`<button class="button" id="sim-${x}">${['시작','일시정지','한 스텝','SIM 리셋'][i]}</button>`).join('')}</div></div>
        <div class="sim-control-group sim-configuration" role="group" aria-label="배속과 시나리오"><h3>배속과 시나리오</h3><div class="sim-configuration-fields"><div class="form pair"><label>배속 0.1~128<input id="sim-speed" type="number" step="any"></label><button class="button" id="sim-apply-speed">배속 적용</button></div>
        <div class="form pair"><label>서버 시나리오<select id="sim-scenario_id"></select></label><button class="button" id="sim-apply-scenario">시나리오 적용</button></div></div></div>
        <form id="sim-fault-form" class="form sim-control-group" aria-label="SIM 장애 주입"><h3>장애 주입</h3><div class="pair"><label>장애 대상 기록명<input id="sim-target" maxlength="80"></label><label>장애 유형<select id="sim-kind">${opts(kinds)}</select></label></div><div class="pair"><label>심각도 기록<select id="sim-severity">${opts(severities)}</select></label><label>기간 SIM 초 1~3600<input id="sim-duration_seconds" type="number" min="1" max="3600" step="1"></label></div><button class="button" id="sim-inject" type="submit">SIM 장애 주입</button></form></div>
        <p id="sim-feedback" role="status"></p><div id="sim-summary"></div><div id="sim-stream"></div><div id="sim-metrics"></div><div id="sim-faults"></div><div id="sim-events"></div>
        <details class="sim-guidance"><summary>SIM 시간·장애 동작 설명</summary><p class="small muted">이 SIM 시간은 궤도 조회 UTC와 별개입니다. 한 스텝은 max(배속, 1)초 전진 후 정지합니다. 리셋은 시간·장애만 초기화하고 임무·사건·배속·시나리오는 유지합니다. 시나리오 적용은 시간·장애를 초기화하되 실행 여부를 유지합니다.</p>
        <p class="small muted">장애 대상과 심각도는 기록 정보입니다. 기존 지표 계산은 장애 유형을 전체에 반영합니다. 장애는 SIM 시간으로 만료합니다. 정지 중 주입·해제 후 활성 장애와 지표 캐시가 다를 수 있으므로 다음 스텝/재개에서 확인하세요. HIL 이름의 시나리오도 현재 SIM입니다. auth_percent는 실제 인증 증거가 아닙니다.</p></details></div>`;
      const bind=(id,event,fn)=>panel.querySelector('#'+id)?.addEventListener(event,fn);
      bind('sim-refresh','click',()=>controller.load());
      for(const action of ['start','pause','step','reset'])bind('sim-'+action,'click',()=>controller.control(action));
      bind('sim-apply-speed','click',()=>controller.speed());bind('sim-apply-scenario','click',()=>controller.scenario());
      bind('sim-fault-form','submit',e=>{e.preventDefault();return controller.fault();});
      for(const key of Object.keys(d))bind('sim-'+key,['kind','severity','scenario_id'].includes(key)?'change':'input',e=>controller.edit({[key]:e.target.value}));
      reason='controls';
    }
    if(reason==='draft')return;
    if(reason!=='stream'){
      const select=panel.querySelector('#sim-scenario_id'),markup=s.scenarios.map(x=>`<option value="${esc(x.id)}">${esc(x.id)} · ${esc(x.name)}</option>`).join('');
      if(select.innerHTML!==markup)select.innerHTML=markup;
      for(const key of Object.keys(d)){const field=panel.querySelector('#sim-'+key);if(field){field.disabled=s.busy;if(document.activeElement!==field)field.value=d[key];}}
      for(const id of ['refresh','start','pause','step','reset','apply-speed','apply-scenario','inject']){const b=panel.querySelector('#sim-'+id);if(b)b.disabled=s.busy;}
    }
    panel.querySelector('#sim-feedback').textContent=s.error||'';panel.querySelector('#sim-feedback').hidden=!s.error;
    const r=s.runtime;
    panel.querySelector('#sim-summary').innerHTML=runtimeSummary(r);
    panel.querySelector('#sim-stream').innerHTML=`<span class="status-chip" data-tone="${s.stale?'waiting':'active'}">${s.stale?'수신 지연':'수신 정상'}</span><details><summary>수신 정보</summary><p>연결 ${esc(s.connection)} / 수신 UTC ${esc(s.wallTime||'없음')}</p></details>`;
    panel.querySelector('#sim-metrics').innerHTML=s.metrics?`<h3>수신 SIM 지표</h3><small>색상: 비율 및 여유 변화 / 운용 경보 기준 아님</small><dl class="sim-metric-grid">${Object.entries(metricLabels).map(([key,label])=>`<div class="sim-metric-card" ${["power","storage","link_quality","auth_percent","loss_percent"].includes(key)&&Number.isFinite(s.metrics[key])?`style="--resource-hue:${200-(["power","link_quality","auth_percent"].includes(key)?100-Math.min(100,Math.max(0,s.metrics[key])):Math.min(100,Math.max(0,s.metrics[key])))*1.8}" title="비율 색상, 경보 판정 아님"`:""}><dt>${label}</dt><dd title="${esc(s.metrics[key])}">${esc(key==='ber'&&Number.isFinite(s.metrics[key])&&s.metrics[key]!==0?s.metrics[key].toExponential(3):s.metrics[key])}</dd>${["power","storage","link_quality","auth_percent","loss_percent"].includes(key)&&Number.isFinite(s.metrics[key])?`<progress max="100" value="${Math.min(100,Math.max(0,s.metrics[key]))}" aria-label="${label}"></progress>`:""}</div>`).join('')}</dl>`:'<p>동기화된 지표 표본 없음</p>';
    panel.querySelector('#sim-faults').innerHTML=`<h3>활성 SIM 장애 ${(r?.active_faults||[]).length}개</h3><ul>${(r?.active_faults||[]).map(f=>`<li>${esc(f.id)} · ${esc(f.target)} · ${esc(f.kind)} · ${esc(f.severity)} · 만료 ${f.expires_at} SIM s</li>`).join('')}</ul>`;
    panel.querySelector('#sim-events').innerHTML=`<h3>서버 최근 사건 (SIM)</h3><div class="sim-event-table"><table><thead><tr><th scope="col">SIM 시각 (s)</th><th scope="col">유형</th><th scope="col">내용</th></tr></thead><tbody>${s.events.slice(0,12).map(e=>`<tr><td>${esc(e.simulation_time)}</td><td>${esc(e.type)}</td><td>${esc(e.message)}</td></tr>`).join('')||'<tr><td colspan="3">수신한 사건 없음</td></tr>'}</tbody></table></div>`;
  }
  return {show(next){view=next;if(visible()||['mission','data','compare','em'].includes(view))controller.connect();if(visible()){draw('controls');if(!loaded){loaded=true;controller.load();}}},update:()=>draw('stream'),applyDraft(items){for(const item of items){if(typeof item?.value!=='string'||!item.id?.startsWith('sim-'))continue;const key=item.id.slice(4);if(Object.keys(controller.snapshot().draft).includes(key)){controller.edit({[key]:item.value});const field=document.getElementById(item.id);if(field&&!controller.snapshot().busy)field.value=item.value;}}},destroy:()=>controller.destroy(),controller};
}
