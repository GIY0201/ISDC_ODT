const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const results=['PASS','FAIL','INVALID'];
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

function analytics(value,runtime){
  const p=value?.provenance;
  if(!value||typeof value.run_id!=='string'||!value.run_id||value.run_id!==runtime.run_id||value.scenario_id!==runtime.scenario_id||!validDate(value.generated_at)||!Number.isFinite(value.overall)||value.overall<0||value.overall>100||!results.includes(value.verdict)||p?.mode!=='SIM'||p.is_simulation!==true||typeof p.rule_set!=='string'||typeof p.data_quality!=='string'||typeof p.recording!=='boolean'||!Array.isArray(value.kpis)||!value.kpis.length||!Array.isArray(value.requirements))throw Error('KPI 응답 오류');
  const ids=new Set();
  for(const k of value.kpis){if(!k||typeof k.id!=='string'||!k.id||ids.has(k.id)||typeof k.name!=='string'||typeof k.unit!=='string'||typeof k.formula!=='string'||typeof k.source!=='string'||typeof k.inverse!=='boolean'||!['pass','fail','invalid'].includes(k.status)||['value','target','delta','missing_percent'].some(key=>!Number.isFinite(k[key]))||!Number.isInteger(k.samples)||k.samples<1||k.missing_percent<0||k.missing_percent>100)throw Error('KPI 행 응답 오류');ids.add(k.id);}
  const requirements=new Set();
  for(const r of value.requirements){const k=value.kpis.find(k=>k.id===r?.kpi_id);if(!r||typeof r.id!=='string'||requirements.has(r.id)||typeof r.name!=='string'||typeof r.test!=='string'||!k||r.result!==k.status.toUpperCase()||r.evidence!==value.run_id)throw Error('요구 추적 응답 오류');requirements.add(r.id);}
  return copy(value);
}
function frame(value,stream=false){
  const r=value?.runtime;
  if(!r||r.mode!=='SIM'||typeof r.run_id!=='string'||typeof r.scenario_id!=='string'||!Number.isFinite(r.elapsed_seconds)||r.elapsed_seconds<0||!Number.isInteger(r.sequence)||r.sequence<0||!Array.isArray(value.events)||value.events.some(e=>!e||typeof e.type!=='string'||typeof e.message!=='string'||!Number.isFinite(e.simulation_time)))throw Error('분석 상태 응답 오류');
  if(stream&&(value.type!=='telemetry'||value.data_quality?.mode!=='SIM'||value.data_quality.source!=='deterministic-sim'||!validDate(value.wall_time)||!Number.isFinite(value.telemetry?.delay_ms)))throw Error('분석 스트림 응답 오류');
  return {runtime:copy(r),analytics:analytics(value.analytics,r),events:copy(value.events),telemetry:copy(value.telemetry||{}),wall_time:value.wall_time||''};
}

export function parseCsvReport(text){
  text=text.replace(/^\ufeff/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
  const cell=()=>{row.push(field);field='';closed=false;};
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
    if(ch===','){cell();continue;}
    if(ch==='\r'||ch==='\n'){cell();rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;continue;}
    if(closed)throw Error('CSV 닫힌 따옴표 뒤 형식 오류');
    if(ch==='"'){if(field)throw Error('CSV 따옴표 형식 오류');quoted=true;}else field+=ch;
  }
  if(quoted)throw Error('CSV 따옴표 응답 오류');if(field||row.length||closed){cell();rows.push(row);}
  if(JSON.stringify(rows.shift())!==JSON.stringify(['KPI','Name','Value','Target','Unit','Status'])||!rows.length)throw Error('CSV 열 응답 오류');
  const ids=new Set();for(const r of rows){if(r.length!==6||!r[0]||ids.has(r[0])||!r[2].trim()||!r[3].trim()||!Number.isFinite(Number(r[2]))||!Number.isFinite(Number(r[3]))||!['pass','fail','invalid'].includes(r[5]))throw Error('CSV 행 응답 오류');ids.add(r[0]);}
  return rows;
}

export function createKpiWorkspace(api,changed=()=>{},download=()=>{},timers={setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id)}){
  let state={display:null,latest:null,history:[],mode:'live',index:0,playing:false,selectedKpi:'',filters:Object.fromEntries(results.map(x=>[x,true])),csv:[],report:null,busy:false,stale:true,connection:'idle',status:'서버 SIM 분석 조회 대기',error:''};
  let ended=false,abort=null,timer=null;
  function install(value){state.display=value;const ids=value.analytics.kpis.map(k=>k.id);if(!ids.includes(state.selectedKpi))state.selectedKpi=ids[0];}
  function stop(){state.playing=false;timers.clearTimer(timer);timer=null;}
  function scrub(index){if(ended||!Number.isInteger(index)||index<0||index>=state.history.length)return;state.mode='history';state.index=index;install(copy(state.history[index]));changed();}
  function schedule(){timer=timers.setTimer(()=>{if(ended||!state.playing)return;scrub((state.index+1)%state.history.length);schedule();},220);timer?.unref?.();}
  async function request(work){if(ended||state.busy)return;state.busy=true;state.error='';abort=new AbortController();changed();
    try{await work(abort.signal);}
    catch(error){if(!ended){state.error=error.message;state.status='보고서/조회 실패';state.stale=true;}}
    finally{if(!ended){state.busy=false;changed();}}
  }
  const controller={
    snapshot:()=>copy(state),
    load(){return request(async signal=>{const response=await api.bootstrap({signal});if(ended)return;const f=frame(response);stop();state.latest=f;state.mode='live';if(state.history.at(-1)?.runtime.run_id!==f.runtime.run_id)state.history=[];install(f);state.stale=true;state.status='서버 분석 조회 · 실시간 수신 대기';});},
    receive(value){if(ended||state.busy)return;try{const f=frame(value,true),latest=state.latest;
      if(f.runtime.run_id===latest?.runtime.run_id&&f.runtime.sequence<latest.runtime.sequence)return;
      if(state.history.length&&state.history.at(-1).runtime.run_id!==f.runtime.run_id){state.history=[];stop();if(state.mode==='history')state.mode='live';}
      state.latest=f;state.history.push(copy(f));if(state.history.length>300){state.history.shift();if(state.mode==='history'){if(state.index>0)state.index--;else{install(copy(state.history[0]));state.status='선택 표본 만료 · 가장 오래된 보존 표본 표시';}}}
      if(state.mode==='live')install(f);state.stale=false;if(!state.error)state.status='SIM 분석 스트림 수신';changed('stream');
    }catch(error){state.error=error.message;state.stale=true;changed('stream');}},
    connection(value){if(ended)return;state.connection=value;state.stale=true;changed('stream');},
    selectKpi(id){if(ended||!state.display?.analytics.kpis.some(k=>k.id===id))return;state.selectedKpi=id;changed('selection');},
    filter(result,checked){if(ended||!results.includes(result))return;state.filters[result]=!!checked;changed('filter');},
    scrub(index){stop();scrub(index);},
    play(){if(ended||state.history.length<2)return;if(state.playing){stop();changed();return;}if(state.mode!=='history')scrub(0);state.playing=true;schedule();changed();},
    live(){if(ended)return;stop();state.mode='live';if(state.latest)install(copy(state.latest));changed();},
    export(kind){return request(async signal=>{
      if(!['json','csv'].includes(kind))throw Error('보고서 형식 오류');const r=await api.report(kind,{signal});if(ended)return;
      if(r?.kind!==kind||!(r.bytes instanceof Uint8Array)||!r.bytes.byteLength||r.bytes.byteLength>2*1024*1024||r.filename!==(kind==='json'?'spacetwin-snapshot.json':'spacetwin-report.csv')||r.mediaType!==(kind==='json'?'application/json':'text/csv'))throw Error('보고서 파일 응답 오류');
      const bytes=copy(r.bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let displayed,csv;
      if(kind==='json'){const value=JSON.parse(text);if(!validDate(value.generated_at))throw Error('JSON 생성 시각 응답 오류');displayed=frame(value);}
      else csv=parseCsvReport(text);
      const file={...r,bytes};await download(copy(file));if(ended)return;
      if(displayed){stop();state.mode='json';install(displayed);}if(csv)state.csv=csv;
      state.report={kind,filename:r.filename,byteLength:bytes.byteLength,generated_at:kind==='json'?JSON.parse(text).generated_at:null};state.status=`${kind.toUpperCase()} 원본 파일 내려받기 요청 · 동일 응답 미리보기`;
    });},
    destroy(){if(ended)return;ended=true;stop();abort?.abort();}
  };
  return controller;
}

export function createKpiPanel(api,drawChart=()=>{},providedDownload){
  let view=null,loaded=false;const urls=new Map();
  function save(file){const blob=new Blob([file.bytes],{type:file.mediaType});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=file.filename;document.body.prepend(anchor);anchor.click();anchor.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);urls.set(url,timer);}
  const controller=createKpiWorkspace(api,draw,providedDownload||save);
  const visible=()=>['data','compare'].includes(view);
  function draw(){if(!visible())return;const screen=document.getElementById('screen');let panel=document.getElementById('kpi-workspace');
    if(!panel){if(view==='data')screen.innerHTML='';panel=document.createElement('section');panel.id='kpi-workspace';panel.className='panel';screen.prepend(panel);}
    const s=controller.snapshot(),f=s.display,a=f?.analytics;
    if(!panel.querySelector('#kpi-controls')){
      panel.innerHTML=`<header><h2>KPI 분석과 결과 내보내기 · 기존 SIM</h2><small>SIM 요구 판정 / 전체 제품·실측 검증 아님</small></header><div class="body"><div id="kpi-controls"><div class="actions"><button class="button" id="kpi-refresh">분석 새로고침</button><button class="button" id="kpi-live">실시간 표시</button><button class="button" id="kpi-csv">CSV 내려받기</button><button class="button" id="kpi-json">JSON 내려받기</button></div><label class="form">KPI 상세<select id="kpi-select"></select></label><div class="actions">${results.map(x=>`<label><input id="kpi-filter-${x}" type="checkbox" checked> ${x}</label>`).join('')}</div><div class="actions"><button class="button" id="kpi-play">세션 이력 재생</button><label>수신 이력 <input id="kpi-history" type="range" min="0" max="0" value="0"></label></div></div>
      <p id="kpi-feedback" role="status"></p><p id="kpi-summary"></p><p id="kpi-context"></p><div id="kpi-values" class="cp-table"></div><div id="kpi-detail"></div><div id="kpi-requirements" class="cp-table"></div><div id="kpi-history-context"></div><canvas id="kpi-chart" width="600" height="180" style="width:100%;height:180px" aria-label="세션 SIM 지연 이력 차트"></canvas><p>파란색: SIM delay_ms · 초록색: 서버 KPI-02 기준 · 주황색: 기존 차트 참고선 60ms (판정 규칙 아님)</p><div id="kpi-events"></div><div id="kpi-export"></div>
      <p class="small muted">전체 점수는 KPI 통과 비율입니다. ‘평균 링크 지연’은 원본의 현재 캐시 지연값이며 평균 실측이 아닙니다. ‘활성 장애 경과’는 복구 실측이 아니며 인증·무결성은 모의 auth_percent입니다. 표본은 sequence 기반 표시값, 결측률은 원본 표시값이고 독립 계측 통계가 아닙니다.</p><p class="small muted">이력은 이 페이지에서 받은 최대 300개 표본입니다. 재생은 표시만 바꾸며 서버 SIM 시간이나 궤도 UTC를 바꾸지 않습니다. recording 플래그는 영구 기록의 증거가 아닙니다. CSV에는 실행·시나리오·시각·출처가 없으므로 문맥이 필요하면 JSON을 사용하세요. 각각의 다운로드는 서버를 새로 조회합니다.</p></div>`;
      const bind=(id,event,fn)=>panel.querySelector('#'+id)?.addEventListener(event,fn);
      bind('kpi-refresh','click',()=>controller.load());bind('kpi-live','click',()=>controller.live());bind('kpi-csv','click',()=>controller.export('csv'));bind('kpi-json','click',()=>controller.export('json'));
      bind('kpi-select','change',e=>controller.selectKpi(e.target.value));bind('kpi-play','click',()=>controller.play());bind('kpi-history','input',e=>controller.scrub(Number(e.target.value)));
      for(const x of results)bind('kpi-filter-'+x,'change',e=>controller.filter(x,e.target.checked));
    }
    const node=id=>panel.querySelector('#'+id);const put=(id,text)=>{node(id).textContent=text;};
    put('kpi-feedback',`${s.status} ${s.error}`);put('kpi-summary',a?`${a.verdict} · KPI 통과 비율 ${a.overall}% · ${s.mode==='json'?'내려받은 JSON 고정':s.mode==='history'?'세션 이력 표본':'실시간/조회 표본'}`:'분석 자료 없음');
    put('kpi-context',a?`${a.run_id} · ${a.scenario_id} · SIM ${f.runtime.elapsed_seconds}s · ${a.generated_at} · ${a.provenance.rule_set} · 품질 ${a.provenance.data_quality} · 연결 ${s.connection} · ${s.stale?'지연/미동기화':'수신 정상'}`:`연결 ${s.connection} · 서버 자료 대기`);
    for(const x of results)node('kpi-filter-'+x).checked=s.filters[x];
    const select=node('kpi-select'),options=(a?.kpis||[]).map(k=>`<option value="${esc(k.id)}">${esc(k.id)} · ${esc(k.name)}</option>`).join('');if(select.innerHTML!==options)select.innerHTML=options;select.value=s.selectedKpi;
    for(const id of ['refresh','csv','json'])node('kpi-'+id).disabled=s.busy;
    const k=a?.kpis.find(k=>k.id===s.selectedKpi);
    node('kpi-values').innerHTML=a?`<table><thead><tr><th>KPI</th><th>현재 값</th><th>기준</th><th>판정</th></tr></thead><tbody>${a.kpis.map(k=>`<tr><td>${esc(k.id)} · ${esc(k.name)}</td><td>${k.value} ${esc(k.unit)}</td><td>${k.inverse?'≤':'≥'} ${k.target} ${esc(k.unit)}</td><td>${esc(k.status.toUpperCase())}</td></tr>`).join('')}</tbody></table>`:'';
    node('kpi-detail').innerHTML=k?`<h3>${esc(k.id)} · ${esc(k.name)}</h3><p>현재/기준 ${k.value} ${esc(k.unit)} / ${k.target} ${esc(k.unit)} · Δ ${k.delta} · ${esc(k.status.toUpperCase())}</p><dl><dt>원본 공식</dt><dd>${esc(k.formula)}</dd><dt>원천</dt><dd>${esc(k.source)}</dd><dt>원본 표본 표시값</dt><dd>${k.samples}</dd><dt>원본 결측 표시값</dt><dd>${k.missing_percent}%</dd></dl>`:'';
    const reqs=(a?.requirements||[]).filter(r=>s.filters[r.result]);node('kpi-requirements').innerHTML=reqs.length?`<h3>원본 SIM 요구 추적</h3><table><thead><tr><th>요구</th><th>시험</th><th>판정</th><th>실행 증적 / KPI 상세</th></tr></thead><tbody>${reqs.map((r,i)=>`<tr><td>${esc(r.id)} · ${esc(r.name)}</td><td>${esc(r.test)}</td><td>${esc(r.result)}</td><td><button class="button" id="kpi-req-${i}">${esc(r.evidence)} / ${esc(r.kpi_id)}</button></td></tr>`).join('')}</tbody></table>`:'<p>조건에 맞는 요구사항 없음</p>';
    reqs.forEach((r,i)=>node('kpi-req-'+i)?.addEventListener('click',()=>controller.selectKpi(r.kpi_id)));
    const range=node('kpi-history');range.max=String(Math.max(0,s.history.length-1));range.disabled=!s.history.length;if(document.activeElement!==range)range.value=String(s.mode==='history'?s.index:Math.max(0,s.history.length-1));node('kpi-play').textContent=s.playing?'이력 재생 정지':'세션 이력 재생';node('kpi-play').disabled=s.history.length<2;
    put('kpi-history-context',`보존 표본 ${s.history.length}/300 · 표시 ${f?.runtime.elapsed_seconds??'없음'} SIM s · 수신 시각 ${f?.wall_time||'스트림 표본 아님'} · 영구 기록/복구 이력 아님`);
    const history=s.mode==='history'?s.history.slice(0,s.index+1):s.mode==='json'?[]:s.history;
    if(history.length){const actual=history.map(h=>h.telemetry.delay_ms),target=history.map(h=>h.analytics.kpis.find(k=>k.id==='KPI-02')?.target).filter(Number.isFinite);drawChart(node('kpi-chart'),target.length===actual.length?[actual,target,Array(actual.length).fill(60)]:[actual]);}else{const canvas=node('kpi-chart');canvas.getContext?.('2d')?.clearRect(0,0,canvas.width,canvas.height);}
    node('kpi-events').innerHTML=`<h3>표시 표본의 최근 SIM 사건</h3><ul>${(f?.events||[]).slice(0,12).map(e=>`<li>${e.simulation_time}s · ${esc(e.type)} · ${esc(e.message)}</li>`).join('')}</ul>`;
    const r=s.report;node('kpi-export').innerHTML=r?`<h3>마지막 내려받기 원본</h3><p>${esc(r.filename)} · ${r.byteLength} bytes · ${r.generated_at?esc(r.generated_at):'CSV에는 생성 시각/실행/출처가 없습니다.'}</p>${r.kind==='csv'?`<div class="cp-table"><table><thead><tr>${['KPI','Name','Value','Target','Unit','Status'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${s.csv.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p>현재 표시는 이 JSON 응답의 분석입니다. 실시간 표시 버튼으로 복귀하세요.</p>'}`:'';
  }
  return {show(next){view=next;if(visible()){draw();if(!loaded){loaded=true;controller.load();}}},update:draw,receive:value=>controller.receive(value),connection:value=>controller.connection(value),applyDraft(items){for(const item of items){if(item.id==='kpi-select'&&typeof item.value==='string')controller.selectKpi(item.value);}},destroy(){controller.destroy();for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();},controller};
}
