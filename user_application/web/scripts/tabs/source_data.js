// V6 presentation over the original ICD-01 module and source view projections.
// Only the server's accepted deployment authorizes actions; no local catalogue owner.
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSourceDataPanel({api,model,document,host,drawSparkline=null,onContextChange=()=>{}}={}) {
 if(!api||!model||!document||!host)throw TypeError('data presentation dependencies required');
 let root=null,dead=false,view=null,busy=false,report=null,error='',result=null,selected=null,abort=null,epoch=0,timer=null;
 let draft={},events=[],samples=[];const removers=[];
 const notifyContext=()=>{try{onContextChange();}catch{/* Presentation observer cannot change request outcome. */}};
 const stopPoll=()=>{if(timer!==null){host.clearInterval(timer);timer=null;}};
 const startPoll=()=>{if(timer!==null||typeof host.setInterval!=='function'||typeof host.clearInterval!=='function')return;timer=host.setInterval(()=>action(refresh),3000);void action(refresh);};
 const progressCell=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?`<progress max="1" value="${value}" aria-label="원본 모듈 작업 진행">${(value*100).toFixed(0)}%</progress> ${(value*100).toFixed(0)}%`:'미확인';
 const policyAction=value=>['set_replication','set_filter'].includes(value);
 const allowed=(state,kind)=>policyAction(kind)?state.canConfigure:state.canOperate;
 const field=id=>root?.querySelector('#dm-'+id);
 const draftIds=['class','search','node','action','replication','filter','destination','node-kind','event-severity'];
 function capture(){if(root)draft=Object.fromEntries(draftIds.map(id=>[id,field(id)?.value??'']));}
 function rows(headers,values){return `<table><thead><tr>${headers.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${values.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
 function render(){
  if(!root||dead||view!=='data')return;
  const state=model.deploymentView(report,error);
  field('status').textContent=[busy?'조회·처리 중':model.moduleBadge(report?.module).label,state.message,error].filter(Boolean).join(' / ');
  field('refresh').disabled=busy;
  field('action-submit').disabled=busy||!allowed(state,field('action').value);
  field('request-submit').disabled=busy||!state.canOperate;
  field('cancel').disabled=!busy;
  field('summary').innerHTML=report?.overview?rows(['지표','값'],model.tileRows(report.overview).map(v=>[v.label,v.value])):'<p>데이터 관리 모듈을 조회하세요. KPI 보고서와 별개의 데이터 객체 상태입니다.</p>';
  field('module').innerHTML=report?rows(['모듈 보고','값'],[['구현',`${report.module?.implementation??'미확인'} v${report.module?.version??'미확인'}`],['메시지 순번',report.module?.sequence],['모듈 SIM 시각',model.elapsedLabel(report.module?.sim_elapsed_s)],['현재 런타임 SIM 시각',model.elapsedLabel(report.runtime?.elapsed_seconds)],['마지막 동기화',report.sync?`${report.sync.nodes}개 노드 / 제품 ${report.sync.products}건`:'미확인'],['배치 범위',report.deployment?.scope_id]]):'';
  field('pipeline').innerHTML=report?.overview?rows(['처리 단계','건수','설명'],model.stageRows(report.overview).map(v=>[v.label,v.count,v.note])):'';
  const trendLabels={ingest_mbps:['수집 처리율','Mbps'],mean_sync_lag_s:['평균 동기화 지연','s'],mean_latency_ms:['평균 서비스 지연','ms']};
  field('trends').textContent=report?.overview?`모듈 SIM ${report.overview.sim_elapsed_s} s / 현재 배치의 조회 표본 ${samples.length}개 (최대 60) / `+Object.entries(trendLabels).map(([key,[name,unit]])=>`${name} ${Number.isFinite(report.overview.metrics?.[key])?report.overview.metrics[key]:'미확인'} ${unit}`).join(' / '):'데이터 관리 모듈을 조회하면 현재 배치의 유효한 SIM 표본만 표시합니다.';
  if(typeof drawSparkline==='function')for(const key of Object.keys(trendLabels))drawSparkline(field('spark-'+key),samples.map(s=>s[key]).filter(Number.isFinite),'#39c9b0');
  field('jobs').innerHTML=`<table><thead><tr>${['작업 ID','종류','상태','시작 SIM s','완료 예상 SIM s','내용','진행'].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(report?.overview?.jobs??[]).map(j=>`<tr>${[j.id,j.kind,j.status,j.started_s,j.eta_s,j.detail].map(v=>`<td>${esc(v)}</td>`).join('')}<td>${progressCell(j.progress)}</td></tr>`).join('')}</tbody></table>`;
  field('requests').innerHTML=rows(['요청 ID','객체','상태','제공 저장소','목적지','지연 ms','실패 사유'],(report?.overview?.requests??[]).map(r=>[r.id,r.object_id,r.status,r.served_from,r.destination,r.latency_ms,r.reason]));
  field('stability').innerHTML=report?.overview?rows(['평가','값'],[[model.gradeOf(report.overview.stability).label,model.gradeOf(report.overview.stability).score??'평가 대기'],...model.componentRows(report.overview.stability).map(v=>[v.label,model.percent(v.fraction,1)])]):'';
  field('nodes').innerHTML=rows(['저장소','종류','사용','용량','가용성','사유'],(report?.nodes??[]).filter(n=>!field('node-kind').value||n.kind===field('node-kind').value).map(n=>{const v=model.nodeRow(n);return [v.name,v.kind,v.used,v.capacity,v.available?'가용':'불가',v.reason];}));
  const objects=report?.objects?.items??[];
  field('objects').innerHTML=rows(['객체','종류','출처','크기','사본','무결성','계층','상태','등록 SIM 시각'],objects.map(o=>{const v=model.objectRow(o,report?.overview?.policy?.replication?.[o.class]);return [v.id,v.classLabel,v.source,v.size,v.replicas,v.integrity,v.tier,v.statusLabel,v.created];}));
  field('object').innerHTML='<option value="">종류별 최신 객체</option>'+objects.map(o=>`<option value="${esc(o.id)}" ${o.id===selected?'selected':''}>${esc(o.label||o.id)}</option>`).join('');
  const object=objects.find(o=>o.id===selected);
  field('detail').innerHTML=object?rows(['객체 정보','값'],[['출처',object.source],['제품 참조',object.ref],['버전',object.version],['객체 체크섬 (SIM)',object.checksum],['계층',model.objectRow(object).tier],['보존 일',object.retention_days],['마지막 검증 SIM 시각',model.elapsedLabel(object.last_verified_s)],['서비스 횟수',object.requests]])+rows(['사본 위치','상태','동기화 지연 s','예상 완료 SIM 시각','검증 SIM 시각'],(object.replicas??[]).map(r=>[report.nodes.find(n=>n.id===r.node)?.name??r.node,model.REPLICA_LABELS[r.state]??r.state,r.lag_s,r.ready_s==null?'—':model.elapsedLabel(r.ready_s),r.verified_s==null?'—':model.elapsedLabel(r.verified_s)])):'<p>객체를 선택하면 복제본 위치와 정합성을 표시합니다.</p>';
  field('policy').textContent=report?.overview?JSON.stringify(report.overview.policy??{},null,2):'정책 미확인';
  field('events').innerHTML=rows(['SIM 시각','종류','심각도','내용'],events.filter(e=>!field('event-severity').value||e.severity===field('event-severity').value).map(e=>{const v=model.eventRow(e);return [v.time,v.kind,v.severity,v.message];}));
  field('result').textContent=result?JSON.stringify(result,null,2):'';
  const destination=field('destination').value,available=(report?.nodes??[]).filter(n=>n.available!==false&&n.capacity_gb>0);field('destination').innerHTML='<option value="">가용 저장소를 선택하세요.</option>'+available.map(n=>`<option value="${esc(n.id)}">${esc(n.name??n.id)} (${esc(n.id)})</option>`).join('');field('destination').value=available.some(n=>n.id===destination)?destination:'';
 }
 function verify(value,deployment){
  if(!model.acceptsDeploymentReport(value,deployment,deployment.run_id)||value.deployment.scope_id!==deployment.scope_id||value.deployment.revision!==deployment.revision||JSON.stringify(value.deployment.nodes)!==JSON.stringify(deployment.nodes))throw Error('현재 배치와 다른 데이터 응답입니다. 다시 조회하세요.');
  if(value.module?.reachable!==true)throw Error(value.module?.detail||'데이터 모듈 응답 미확인');
  for(const part of [value.module,value.overview,value.objects,value.events])if(!part||part.scope_id!==deployment.scope_id||part.scope_contract!=='isolated-v1')throw Error('데이터 응답의 배치 범위를 확인할 수 없습니다.');
 }
 async function refresh(options){
  const generation=epoch;
  const query={limit:200,after:0,class:field('class').value,query:field('search').value,node:field('node').value};
  const deployment=await api.dataDeploymentState(options);
  if(dead||generation!==epoch||view!=='data')return;
  const value=await api.dataManagementDashboard(query,options);
  const current=await api.dataDeploymentState(options);
  if(dead||generation!==epoch||view!=='data')return;
  if(JSON.stringify(current)!==JSON.stringify(deployment))throw Error('조회 중 배치가 변경됐습니다. 다시 조회하세요.');
  verify(value,current);
  if(value.deployment.scope_id!==report?.deployment?.scope_id){result=null;samples=[];}
  const at=value.overview?.sim_elapsed_s;
  if(Number.isFinite(at)&&samples.at(-1)?.at!==at){samples.push({at,ingest_mbps:value.overview.metrics?.ingest_mbps,mean_sync_lag_s:value.overview.metrics?.mean_sync_lag_s,mean_latency_ms:value.overview.metrics?.mean_latency_ms});samples=samples.slice(-60);}
  events=value.deployment.scope_id===report?.deployment?.scope_id?model.mergeEvents(events,value.events.items):model.mergeEvents([],value.events.items);
  report=value;error='';
  if(selected&&!value.objects.items.some(o=>o.id===selected))selected=null;
 }
 async function action(work){
  if(dead||busy||view!=='data')return;const priorError=error,generation=epoch;busy=true;abort=new AbortController();render();notifyContext();
  try{await work({signal:abort.signal},priorError);}catch(e){if(!dead&&generation===epoch&&view==='data')error=e.name==='AbortError'?'요청 대기를 취소했습니다. 보낸 명령 결과는 다시 조회해 확인하세요.':String(e.message);}
  finally{busy=false;abort=null;if(!dead){render();notifyContext();}}
 }
 async function operate(kind,options,priorError=''){
  if(!report||priorError)throw Error(priorError||'현재 데이터 배치를 먼저 조회하세요.');
  const generation=epoch;
  // Capture the user's complete command intent before any asynchronous authority
  // read. Editable form values belong to the next command after this point.
  const input={kind,object_id:selected,class:field('class').value,action:field('action').value,replication:field('replication').value,filter:field('filter').value,destination:field('destination').value};
  const operation=input.kind==='action'?input.action:'request';
  if(!allowed(model.deploymentView(report,priorError),operation))throw Error(policyAction(operation)?'사용 가능한 현재 저장소를 먼저 확인하세요.':'현재 배치에 운영할 데이터 객체가 없습니다. 상태를 다시 조회하세요.');
  const scope=report.deployment.scope_id,revision=report.deployment.revision;
  const body={scope_id:scope};if(input.object_id)body.object_id=input.object_id;else if(input.class)body.class=input.class;
  if(input.kind==='action'){
   body.action=input.action;
   if(body.action==='set_replication'){body.class=input.class||report.objects.items.find(o=>o.id===input.object_id)?.class;if(!model.CLASS_LABELS[body.class])throw Error('복제 정책을 적용할 데이터 종류나 객체를 선택하세요.');delete body.object_id;const n=Number(input.replication);if(!input.replication.trim()||!Number.isInteger(n)||n<1||n>5)throw Error('복제 계수는 1~5 정수입니다.');body.replication=n;}
   if(body.action==='set_filter'){body.filter=JSON.parse(input.filter);if(!body.filter||Array.isArray(body.filter)||typeof body.filter!=='object')throw Error('필터는 JSON 객체입니다.');}
  }else{if(!body.object_id&&!body.class)throw Error('서비스할 객체나 데이터 종류를 선택하세요.');body.destination=input.destination.trim();if(!report.nodes.some(n=>n.id===body.destination&&n.available!==false&&n.capacity_gb>0))throw Error('서비스 목적지는 현재 배치의 가용 저장소를 선택하세요.');}
  const current=await api.dataDeploymentState(options);
  if(dead||generation!==epoch||view!=='data')return;
  if(current.scope_id!==scope||current.revision!==revision)throw Error('현재 배치가 변경됐습니다. 새로 조회하세요.');
  const receipt=await api[input.kind==='action'?'dataManagementAction':'dataManagementRequest'](body,options);
  if(dead||generation!==epoch||view!=='data')return;
  if(receipt?.scope_id!==scope||receipt?.scope_contract!=='isolated-v1')throw Error('명령 결과의 배치 범위 미확인. 상태를 다시 조회하세요.');
  await refresh(options);
  if(dead||generation!==epoch||view!=='data')return;
  if(report?.deployment?.scope_id!==scope||report?.deployment?.revision!==revision)throw Error('명령 처리 중 배치가 변경됐습니다. 이전 결과를 현재 배치에 표시하지 않습니다.');
  result=receipt;
 }

 function show(next){
  if(root)capture();view=next;if(dead)return;
  if(next!=='data'){stopPoll();epoch++;abort?.abort();if(root)root.hidden=true;return;}
  if(root&&!document.getElementById('source-data-services')){stopPoll();epoch++;abort?.abort();for(const r of removers.splice(0))r();root=null;}
  if(!root){
   root=document.createElement('section');root.id='source-data-services';root.className='panel source-data';
   root.innerHTML=`<header><h2>SDC 데이터 관리 · ICD-01</h2><small>데이터 관리 모듈 · SIM 데이터 수명주기</small></header><div class="body"><p>명시적으로 배치한 저장소의 객체·복제·무결성·복구·서비스를 조회합니다. 실제 파일 저장·실제 장비 보안은 검증하지 않은 모의 결과입니다.</p><button id="dm-refresh" type="button">데이터 상태 조회</button><button id="dm-cancel" type="button">현재 요청 대기 취소</button><p role="status" id="dm-status"></p><div id="dm-summary"></div><div id="dm-module"></div><h3>안정성</h3><div id="dm-stability"></div><h3>처리 단계</h3><div id="dm-pipeline"></div><h3>데이터 관리 추세</h3><p id="dm-trends"></p><label>수집 처리율 Mbps<canvas id="dm-spark-ingest_mbps" height="60" width="300" aria-label="데이터 수집 처리율 추세"></canvas></label><label>평균 동기화 지연 s<canvas id="dm-spark-mean_sync_lag_s" height="60" width="300" aria-label="복제 동기화 지연 추세"></canvas></label><label>평균 서비스 지연 ms<canvas id="dm-spark-mean_latency_ms" height="60" width="300" aria-label="데이터 서비스 지연 추세"></canvas></label><h3>저장 노드</h3><label>저장소 종류<select id="dm-node-kind"><option value="">전체</option><option value="core">중앙 저장소</option><option value="edge">엣지 저장소</option><option value="onboard">탑재 저장소</option></select></label><div id="dm-nodes" style="overflow-x:auto"></div><label>종류<select id="dm-class"><option value="">전체</option>${Object.entries(model.CLASS_LABELS).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label><label>검색<input id="dm-search"></label><label>저장 노드 ID<input id="dm-node"></label><h3>데이터 카탈로그</h3><div id="dm-objects" style="overflow-x:auto"></div><label>객체<select id="dm-object"></select></label><div id="dm-detail"></div><h3>운영 조치</h3><label>조치<select id="dm-action"><option value="verify">무결성 검사</option><option value="heal">복구</option><option value="rebalance">재균형</option><option value="purge_expired">만료 정리</option><option value="set_replication">복제 계수 변경</option><option value="set_filter">수집 필터 변경</option></select></label><label>복제 계수<input id="dm-replication" type="number" min="1" max="5" value="3"></label><label>수집 필터 JSON<textarea id="dm-filter">{}</textarea></label><button id="dm-action-submit" type="button">운영 조치 실행</button><h3>데이터 서비스</h3><label>목적지<select id="dm-destination"></select></label><button id="dm-request-submit" type="button">선택 객체·종류 서비스 요청</button><pre id="dm-result"></pre><h3>최근 작업</h3><div id="dm-jobs" style="overflow-x:auto"></div><h3>최근 서비스 이력</h3><div id="dm-requests" style="overflow-x:auto"></div><h3>현재 정책</h3><pre id="dm-policy"></pre><h3>운영 이벤트</h3><label>심각도<select id="dm-event-severity"><option value="">전체</option><option value="info">정보</option><option value="warning">주의</option><option value="danger">위험</option></select></label><div id="dm-events" style="overflow-x:auto"></div></div>`;
   document.getElementById('screen').prepend(root);
   const listen=(id,event,fn)=>{field(id).addEventListener(event,fn);removers.push(()=>field(id)?.removeEventListener(event,fn));};
   listen('action','change',render);listen('node-kind','change',render);listen('event-severity','change',render);listen('refresh','click',()=>action(refresh));listen('action-submit','click',()=>action((options,priorError)=>operate('action',options,priorError)));listen('request-submit','click',()=>action((options,priorError)=>operate('request',options,priorError)));listen('cancel','click',()=>abort?.abort());listen('object','change',()=>{selected=field('object').value||null;render();notifyContext();});
   for(const [id,value] of Object.entries(draft))if(field(id))field(id).value=value;
  }
  root.hidden=false;render();startPoll();
 }
 return Object.freeze({show,update:render,snapshot:()=>report?structuredClone(report):null,contextSnapshot:()=>({report:report?structuredClone({runtime:report.runtime,deployment:report.deployment,module:report.module}):null,error,busy,selected_id:selected}),destroy(){if(dead)return;dead=true;epoch++;stopPoll();abort?.abort();for(const r of removers.splice(0))r();root?.remove();}});
}
