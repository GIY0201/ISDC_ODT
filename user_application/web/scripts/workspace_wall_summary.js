// Pure display over readWorkspaceContext; no source queries, commands or time owner.
const esc=value=>String(value??'미확인').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const card=(id,title,lines,view,label)=>`<section class="wall-summary-card" id="wall-summary-${id}" aria-label="${title}"><h3>${title}</h3>${lines.map(line=>`<p>${esc(line)}</p>`).join('')}<button type="button" class="button" data-view="${view}">${label}</button></section>`;
export function wallSummaryMarkup(context={}){
 const c=context??{},deployment=c.deployment,run=c.run,mission=c.mission,communication=c.communication,data=c.data;
 const count=deployment?.status==='accepted'&&Number.isSafeInteger(deployment.count)&&deployment.count>=0?`수락 노드 ${deployment.count}개`:'배치 수락 미확인';
 const runtime=run?.status==='source_sim'&&typeof run.running==='boolean';
 const missionStatus={module_committed:'모듈 실행 등록',module_accepted_plan:'모듈 수락 계획',draft_or_previous_plan:'초안 또는 이전 계획',unavailable:'현재 임무 자료 없음'}[mission?.status]??'현재 임무 자료 없음';
 const currentPlan=['module_committed','module_accepted_plan'].includes(mission?.status);
 const queriedCommunication=communication?.status==='last_verified_query',queriedData=data?.status==='last_verified_query';
 const objectCount=Array.isArray(data?.objects)?data.objects.length:Number.isSafeInteger(data?.objects)&&data.objects>=0?data.objects:null;
 const runtimeLines=runtime?[run.id,`SIM ${run.running?'실행 중':'정지'}`,Number.isFinite(run.elapsed_seconds)?`경과 ${run.elapsed_seconds} s`:'경과 시각 미확인']:['현재 SIM 상태 미확인'];
 const missionLines=[mission?.id?`임무 ${mission.id}`:'선택 임무 없음',missionStatus,currentPlan&&typeof mission.feasible==='boolean'?`모듈 분석: ${mission.feasible?'실행 가능':'실행 불가'}`:'현재 실행 가능성 미확인','임무 영향 미산출'];
 const contactLines=queriedCommunication?['최근 검증 조회',`분석 UTC ${communication.utc??'미확인'}`,Number.isSafeInteger(communication.sequence)?`sequence ${communication.sequence}`:'모듈 sequence 미확인','다음 접촉 구간은 통신 창에서 확인']:['검증된 접촉 자료 없음','예정 패스와 링크 조건은 통신 창에서 확인'];
 const dataLines=queriedData?['최근 검증 조회',objectCount!==null?`조회한 객체 ${objectCount}개`:'객체 개수 미확인',data.implementation?`모듈 ${data.implementation}`:'모듈 구현 미확인']:['현재 데이터 조회 근거 없음'];
 return `<div class="wall-summary-grid" aria-label="현재 운용 요약">${card('selection','위성·배치',[c.text?.satellite??'현재 위성 미선택',count,c.utc?.value?`분석 UTC ${c.utc.value}`:'분석 UTC 미확인'],'satellite','위성 상태·궤도')}${card('runtime','실행 상태',runtimeLines,'run','실행·기록')}${card('mission','임무·영향',missionLines,'mission','임무·결과')}${card('incident','사건',['실제 경보 미연동','사건 영향과 우선순위 판정 미확인'],'operations','운용 확인')}${card('contact','접촉·통신',[...contactLines,'실제 RF·수신 미확인'],'ground','지상국·통신')}${card('data','데이터',dataLines,'data','데이터·산출물')}</div>`;
}
