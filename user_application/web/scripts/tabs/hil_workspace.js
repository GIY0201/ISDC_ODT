const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions=['connect','disconnect','sync','loopback'],sequences=['preflight','closed_loop','fault_recovery'];
const text=v=>typeof v==='string'&&v.length>0;
const finite=(v,min=0,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
function devices(list){
 if(!Array.isArray(list)||new Set(list.map(d=>d?.id)).size!==list.length||list.some(d=>!d||!['id','name','role','protocol','clock_state'].every(k=>text(d[k]))||d.mode!=='MOCK'||typeof d.connected!=='boolean'||!finite(d.health,0,100)||!finite(d.latency_ms)||!Number.isInteger(d.channels)||d.channels<0||!['clock_offset_us','jitter_us'].every(k=>d[k]===null||finite(d[k]))))throw Error('모의 장비 응답 오류');
 return copy(list);
}
function frame(value){
 const r=value?.runtime;
 if(!r||r.mode!=='SIM'||!text(r.run_id)||!text(r.scenario_id)||typeof r.recording!=='boolean'||!finite(r.elapsed_seconds)||!Number.isInteger(r.sequence)||r.sequence<0||!Array.isArray(value.events)||value.events.some(e=>!e||!text(e.type)||typeof e.message!=='string'||!finite(e.simulation_time)))throw Error('MOCK-HIL 상태 응답 오류');
 if(value.telemetry&&!finite(value.telemetry.throughput_mbps))throw Error('모의 처리량 응답 오류');
 return {runtime:copy(r),devices:devices(value.devices),events:copy(value.events),telemetry:copy(value.telemetry||null)};
}
const signature=f=>JSON.stringify([f.runtime.run_id,f.runtime.recording,f.devices]);
function preflight(value,run){
 if(!value||value.mode!=='MOCK-HIL'||value.run_id!==run||typeof value.passed!=='boolean'||value.status!==(value.passed?'READY':'BLOCKED')||!text(value.evaluated_at)||!finite(Date.parse(value.evaluated_at),-Infinity)||!Array.isArray(value.checks)||!value.checks.length||new Set(value.checks.map(c=>c?.id)).size!==value.checks.length||value.checks.some(c=>!c||!text(c.id)||!text(c.name)||typeof c.passed!=='boolean'||typeof c.value!=='string')||value.passed!==value.checks.every(c=>c.passed))throw Error('사전 점검 응답 오류');
 return copy(value);
}
function sequenceResult(value,kind,run){
 if(!value||value.run_id!==run||value.sequence_id!==kind||!['completed','failed'].includes(value.status)||!Array.isArray(value.steps)||value.steps.length!==(kind==='fault_recovery'?5:4)||value.steps.some((s,i)=>!s||s.id!==`S${i+1}`||!text(s.name)||!['passed','failed'].includes(s.status))||value.status!==(value.steps.every(s=>s.status==='passed')?'completed':'failed'))throw Error('시퀀스 응답 오류');
 const p=preflight(value.preflight,run);if(p.passed!==(value.steps[0].status==='passed'))throw Error('시퀀스 사전 점검 응답 오류');return copy(value);
}

export function createHilWorkspace(api,changed=()=>{}){
 let state={runtime:null,devices:[],events:[],telemetry:null,selected:'',sequence:'closed_loop',preflight:null,result:null,busy:false,stale:true,connection:'idle',status:'MOCK-HIL 서버 조회 대기',error:'',logs:[],history:[],hiddenEvents:[]};
 let ended=false,abort=null,barrier=null;
 function log(message){state.logs.unshift({time:new Date().toISOString(),message});state.logs=state.logs.slice(0,60);}
 function install(f){const changedContext=!state.runtime||signature(f)!==signature(state);if(changedContext)state.preflight=null;if(state.runtime?.run_id!==f.runtime.run_id){state.history=[];state.hiddenEvents=[];}Object.assign(state,f);if(!state.devices.some(d=>d.id===state.selected))state.selected=state.devices[0]?.id||'';}
 async function request(work,label,mutation=false){
  if(ended||state.busy)return;state.busy=true;state.error='';abort=new AbortController();const options={signal:abort.signal};changed();
  try{await work(options);if(ended)return;state.status=label;log(label);}
  catch(error){if(!ended){state.stale=true;state.error=`${error.message}${mutation?' · 적용 여부를 새로고침으로 확인하세요.':''}`;state.status='요청 실패';log(state.error);}}
  finally{if(!ended){state.busy=false;changed();}}
 }
 async function refresh(options,mutation=false,validate=()=>{}){
  const b=await api.bootstrap(options);if(ended)return;const f=frame(b);validate(f);
  const p=await api.hilPreflight(options);if(ended)return;const checked=preflight(p,f.runtime.run_id);install(f);state.preflight=checked;state.stale=true;barrier=mutation?signature(f):null;
 }
 function selected(){const d=state.devices.find(d=>d.id===state.selected);if(!d)throw Error('서버 모의 장비를 선택하세요.');return d;}
 async function deviceCommand(d,action,options){
  if(!actions.includes(action)||!state.devices.some(x=>x.id===d.id)||['sync','loopback'].includes(action)&&!d.connected)throw Error('먼저 모의 장비를 연결하세요.');
  const result=await api.deviceAction(d.id,action,options);if(ended)return;
  const checked=devices([result])[0];if(checked.id!==d.id||action==='connect'&&!checked.connected||action==='disconnect'&&checked.connected)throw Error('장비 명령 응답 오류');return checked;
 }
 const controller={snapshot:()=>copy(state),
  load:()=>request(o=>refresh(o),'MOCK-HIL 조회 · 스트림 동기화 대기'),
  select(id){if(ended||state.busy||!state.devices.some(d=>d.id===id))return;state.selected=id;changed();},
  editSequence(id){if(ended||state.busy||!sequences.includes(id))return;state.sequence=id;changed();},
  action(action){return request(async o=>{const d=selected(),result=await deviceCommand(d,action,o);if(ended)return;await refresh(o,true,f=>{if(JSON.stringify(f.devices.find(x=>x.id===d.id))!==JSON.stringify(result))throw Error('장비 상태 동기화 응답 오류');});},`MOCK ${action} 응답 · 동기화 대기`,true);},
  all(action){return request(async o=>{if(!['sync','loopback'].includes(action))throw Error('일괄 동작 오류');const targets=state.devices.filter(d=>d.connected);if(!targets.length)throw Error('연결된 모의 장비 없음');let done=0;try{for(const d of targets){await deviceCommand(d,action,o);if(ended)return;done++;log(`${d.id} ${action} 완료`);}await refresh(o,true);}catch(error){throw Error(`${action} ${done}/${targets.length} 성공 후 중단: ${error.message}`);}},`연결 모의 장비 ${action} 응답`,true);},
  preflight:()=>request(o=>refresh(o),'서버 사전 점검 응답'),
  sequence(){return request(async o=>{if(!state.runtime)throw Error('서버 상태를 먼저 조회하세요.');const run=state.runtime.run_id,kind=state.sequence;const raw=await api.hilSequence(kind,o);if(ended)return;const result=sequenceResult(raw,kind,run);await refresh(o,true,f=>{if(f.runtime.run_id!==run)throw Error('실행이 변경되었습니다.');});if(!ended)state.result=result;},'MOCK-HIL 시퀀스 판정 응답',true);},
  recording(){return request(async o=>{if(!state.runtime)throw Error('서버 상태를 먼저 조회하세요.');const enabled=!state.runtime.recording,run=state.runtime.run_id;const r=await api.recording(enabled,o);if(ended)return;if(r?.run_id!==run||r.recording!==enabled)throw Error('기록 플래그 응답 오류');await refresh(o,true,f=>{if(f.runtime.run_id!==run||f.runtime.recording!==enabled)throw Error('기록 플래그 동기화 응답 오류');});},'SIM 기록 플래그 응답',true);},
  receive(value){if(ended||state.busy)return;try{const f=frame(value);if(barrier&&signature(f)!==barrier)return;if(!barrier&&f.runtime.run_id===state.runtime?.run_id&&f.runtime.sequence<state.runtime.sequence)return;install(f);barrier=null;state.stale=false;if(f.telemetry){state.history.push(f.telemetry.throughput_mbps);state.history=state.history.slice(-300);}if(!state.error)state.status='MOCK-HIL 모의 상태 스트림';changed();}catch(error){state.stale=true;state.error=error.message;changed();}},
  connection(status){if(ended)return;state.connection=status;state.stale=true;changed();},
  clear(){if(ended)return;state.logs=[];state.hiddenEvents=state.events.map(e=>JSON.stringify(e));changed();},
  destroy(){if(ended)return;ended=true;abort?.abort();}
 };return controller;
}

export function createHilPanel(api,topology=()=>'',drawChart=()=>{}){
 let view=null,loaded=false;const controller=createHilWorkspace(api,draw),visible=()=>view==='em';
 const unknown=v=>v==null?'미확인':String(v);
 function draw(){if(!visible())return;const screen=document.getElementById('screen');let panel=document.getElementById('hil-workspace');if(!panel){screen.innerHTML='';panel=document.createElement('section');panel.id='hil-workspace';panel.className='panel';screen.prepend(panel);}
  if(!panel.querySelector('#hil-controls')){
   panel.innerHTML=`<header><h2>모의 장비 시험</h2></header><div class="body"><p class="hil-simulation-notice" role="note"><span>MOCK-HIL</span> 실제 장비 연결·계측 없음</p><div id="hil-controls"><div class="actions"><button class="button" id="hil-refresh">서버 장비 새로고침</button><button class="button" id="hil-preflight">사전 점검</button><button class="button" id="hil-recording">기록 플래그</button></div><label class="form">모의 장비<select id="hil-device"></select></label><div class="actions"><button class="button" id="hil-connect">모의 연결</button><button class="button" id="hil-disconnect">모의 분리</button><button class="button" id="hil-sync">모의 동기화</button><button class="button" id="hil-loopback">모의 loopback</button><button class="button" id="hil-sync-all">연결 장비 모두 동기화</button><button class="button" id="hil-loopback-all">연결 장비 모두 loopback</button></div><label class="form">시험 시퀀스<select id="hil-sequence"><option value="preflight">preflight · 기존 4단계 판정</option><option value="closed_loop">closed_loop · 기존 4단계 판정</option><option value="fault_recovery">fault_recovery · 기존 5단계 판정</option></select></label><button class="button" id="hil-run">모의 시퀀스 판정</button></div><p id="hil-feedback" role="status"></p><p id="hil-context"></p><div id="hil-devices" class="cp-table"></div><div id="hil-detail"></div><div id="hil-topology"></div><div id="hil-checks"></div><div id="hil-result"></div><div id="hil-metrics"></div><canvas id="hil-chart" width="600" height="120" style="width:100%;height:120px" aria-label="수신 SIM 처리량 세션 차트"></canvas><button class="button" id="hil-clear">표시 로그 비우기</button><div id="hil-logs"></div><p>모든 장비 상태·건전도·시각·전송률은 기존 MOCK/SIM 값입니다. 실제 EM 명령이나 실측이 아닙니다. 기록은 플래그이며 파일 저장의 증거가 아닙니다. 시험 시퀀스는 현재 상태 판정이며 동기화·loopback 명령을 자동 실행하지 않습니다.</p><p>원본 사전 점검은 오프셋 0을 미확인 값으로 처리합니다. 일괄 동작은 연결된 장비만 순차 요청하고 실패하면 중단합니다. 명령 적용 여부가 불명확하면 새로고침으로 확인하세요. 장비/기록/실행이 바뀌면 이전 점검은 다시 해야 합니다.</p></div>`;
   const bind=(id,event,fn)=>panel.querySelector('#'+id)?.addEventListener(event,fn);
   bind('hil-refresh','click',()=>controller.load());bind('hil-preflight','click',()=>controller.preflight());bind('hil-recording','click',()=>controller.recording());bind('hil-run','click',()=>controller.sequence());bind('hil-clear','click',()=>controller.clear());
   for(const action of actions)bind('hil-'+action,'click',()=>controller.action(action));for(const action of ['sync','loopback'])bind('hil-'+action+'-all','click',()=>controller.all(action));
   bind('hil-device','change',e=>controller.select(e.target.value));bind('hil-sequence','change',e=>controller.editSequence(e.target.value));
  }
  const s=controller.snapshot(),node=id=>panel.querySelector('#'+id),put=(id,value)=>{node(id).textContent=value;},r=s.runtime,d=s.devices.find(d=>d.id===s.selected);
  const markup=s.devices.map(d=>`<option value="${esc(d.id)}">${esc(d.name)} · ${esc(d.id)}</option>`).join('');if(node('hil-device').innerHTML!==markup)node('hil-device').innerHTML=markup;node('hil-device').value=s.selected;node('hil-sequence').value=s.sequence;
  for(const id of ['refresh','preflight','recording','run','device','sequence','sync-all','loopback-all',...actions])node('hil-'+id).disabled=s.busy||!r&&id!=='refresh';
  node('hil-connect').disabled=s.busy||!d||d.connected;node('hil-disconnect').disabled=s.busy||!d||!d.connected;for(const action of ['sync','loopback'])node('hil-'+action).disabled=s.busy||!d||!d.connected;
  put('hil-recording',`SIM 기록 플래그 ${r?.recording?'ON':'OFF'} 전환`);put('hil-feedback',`${s.status} ${s.error}`);put('hil-context',r?`${r.run_id} · ${r.scenario_id} · SIM ${r.elapsed_seconds}s · 연결 ${s.connection} · ${s.stale?'미동기화/마지막 자료':'수신 정상'}`:'서버 자료 없음');
  node('hil-devices').innerHTML=`<table><thead><tr><th>모의 장비</th><th>연결</th><th>건전도 %</th><th>지연 ms</th><th>시각 / 오프셋 µs / jitter µs</th></tr></thead><tbody>${s.devices.map(d=>`<tr><td>${esc(d.id)} · ${esc(d.name)}</td><td>${d.connected?'ONLINE':'OFFLINE'}</td><td>${d.health}</td><td>${d.latency_ms}</td><td>${esc(d.clock_state)} / ${unknown(d.clock_offset_us)} / ${unknown(d.jitter_us)}</td></tr>`).join('')}</tbody></table>`;
  node('hil-detail').innerHTML=d?`<h3>${esc(d.name)}</h3><p>${esc(d.id)} · ${esc(d.role)} · ${esc(d.protocol)} (모의 표기) · ${esc(d.mode)} · ${d.channels} channels</p>`:'';node('hil-topology').innerHTML=topology(s.devices,s.selected);
  node('hil-topology').querySelectorAll('[data-hil-device]').forEach(el=>{el.addEventListener('click',()=>controller.select(el.dataset.hilDevice));el.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();controller.select(el.dataset.hilDevice);}});});
  node('hil-checks').innerHTML=s.preflight?`<h3>${esc(s.preflight.status)} · MOCK-HIL 사전 점검</h3><p>${esc(s.preflight.run_id)} · ${esc(s.preflight.evaluated_at)}</p><ul>${s.preflight.checks.map(c=>`<li>${c.passed?'PASS':'FAIL'} · ${esc(c.name)} · ${esc(c.value)}</li>`).join('')}</ul>`:'<p>현재 장비/기록 상태의 사전 점검 없음 · 다시 점검하세요.</p>';
  const result=s.result;node('hil-result').innerHTML=result?`<h3>마지막 시퀀스 ${esc(result.status)} · 원본 결과 고정</h3><p>${esc(result.run_id)} · ${esc(result.sequence_id)} · ${esc(result.preflight.evaluated_at)} · 현재 상태와 다를 수 있음</p><ul>${result.steps.map(x=>`<li>${esc(x.id)} · ${esc(x.name)} · ${esc(x.status)}</li>`).join('')}</ul>`:'';
  const online=s.devices.filter(d=>d.connected),offsets=online.map(d=>d.clock_offset_us),jitters=online.map(d=>d.jitter_us);const maximum=list=>list.length&&list.every(Number.isFinite)?Math.max(...list):null;
  node('hil-metrics').innerHTML=`<h3>기존 모의 장비 표시 통계</h3><p>연결 ${online.length}/${s.devices.length} · channels ${s.devices.reduce((n,d)=>n+d.channels,0)} · 평균 연결장비 지연 ${online.length?(online.reduce((n,d)=>n+d.latency_ms,0)/online.length).toFixed(1):'미확인'} ms · 시각 ${online.length&&online.every(d=>d.clock_state==='LOCKED')?'LOCKED':online.some(d=>d.clock_state==='LOCKING')?'LOCKING':'UNSYNC'} · 최대 오프셋 ${unknown(maximum(offsets))} µs · 최대 jitter ${unknown(maximum(jitters))} µs</p><p>기존 UI 합성 I/O 예시: ingest ${s.telemetry?(3.8+s.telemetry.throughput_mbps/100).toFixed(1):'미확인'}k/s · command ${r?30+r.sequence%17:'미확인'}/s · offline ${s.devices.filter(d=>!d.connected).length} (실제 오류 계측 아님)</p><p>아래 차트는 수신 SIM throughput_mbps · 세션 ${s.history.length}/300표본 · 영구 기록 아님</p>`;
  if(s.history.length)drawChart(node('hil-chart'),s.history,'#2d7ff9');else{const canvas=node('hil-chart');canvas.getContext?.('2d')?.clearRect(0,0,canvas.width,canvas.height);}
  const logs=[...s.logs.map(l=>`${l.time} · ${l.message}`),...s.events.filter(e=>(e.type.startsWith('hil.')||e.type.startsWith('recording.'))&&!s.hiddenEvents.includes(JSON.stringify(e))).map(e=>`${e.simulation_time}s · ${e.type} · ${e.message}`)].slice(0,30);node('hil-logs').innerHTML=`<h3>표시 작업/서버 모의 사건</h3><ul>${logs.map(l=>`<li>${esc(l)}</li>`).join('')}</ul><p>표시 비우기는 서버 사건을 삭제하지 않습니다.</p>`;
 }
 return {controller,show(next){view=next;if(visible()){draw();if(!loaded){loaded=true;controller.load();}}},update:draw,receive:v=>controller.receive(v),connection:s=>controller.connection(s),applyDraft(items){for(const x of items){if(x.id==='hil-device')controller.select(x.value);if(x.id==='hil-sequence')controller.editSequence(x.value);}},destroy:()=>controller.destroy()};
}
