import {showWorkspaceOrbit,applyWorkspaceDraft,bindWorkspaceView,readWorkspaceContext,observeWorkspaceContext,observeWorkspaceModel,setWorkspaceWallScope,setWorkspaceWallMode,mountWorkspaceWall,detachWorkspaceWall,resizeWorkspaceGlobe,readWorkspaceClock,observeWorkspaceClock,workspaceClockActions} from './workspace_orbit.js?v=t151-r1';
import {createWorkWindowLayout} from './work_window_layout.js';
import {wallSummaryMarkup} from './workspace_wall_summary.js';
import {createWorkspaceTimeDock} from './workspace_time_dock.js';
(() => {
  const screen = document.getElementById('screen');
  const timeDock=createWorkspaceTimeDock({document,root:document.getElementById('workspace-time-dock'),read:readWorkspaceClock,observe:observeWorkspaceClock,actions:workspaceClockActions});window.addEventListener('pagehide',event=>{if(!event.persisted)timeDock.destroy();});
  const workLayout=createWorkWindowLayout({screen,navigation:document.getElementById('work-section-nav'),windowElement:document.getElementById('work-window'),host:window,onResize:resizeWorkspaceGlobe});
  window.addEventListener('pagehide',event=>{if(!event.persisted)workLayout.destroy();});
  let failedThumbnail=null,activeThumbnail=null;
  const thumbnail=document.getElementById('desktop-sat-thumbnail'),hideThumbnail=()=>{failedThumbnail=activeThumbnail;if(thumbnail){thumbnail.hidden=true;thumbnail.removeAttribute('src');}};thumbnail?.addEventListener('error',hideThumbnail);
  const removeThumbnail=observeWorkspaceModel(value=>{const image=document.getElementById('desktop-sat-thumbnail');if(!image)return;const preview=value.selected&&value.match?.thumbnail;activeThumbnail=preview||null;if(!preview)failedThumbnail=null;image.hidden=!preview||failedThumbnail===preview;if(!image.hidden){image.src=preview;image.alt='선택 위성에 연결된 3D 모델의 미리보기';}else image.removeAttribute('src');});window.addEventListener('pagehide',event=>{if(!event.persisted){removeThumbnail();thumbnail?.removeEventListener('error',hideThumbnail);}});
  function restoreGlobeSurface(){detachWorkspaceWall();}
  function applySharedContext(value=readWorkspaceContext()){const summary=document.getElementById('wall-summary');if(summary){const markup=wallSummaryMarkup(value);if(summary.innerHTML!==markup)summary.innerHTML=markup;}const t=value.text;for(const [id,text] of Object.entries({'desktop-scene-credit':('NASA Blue Marble / Cesium WGS84 · '+t.satellite+' · '+t.clock+' · 모델 계산 / 실제 RF 미확인'),'current-mode':t.mode,'desktop-event':t.event,'desktop-data-utc':t.clock,'quick-sat':t.satellite,'quick-pass':t.next,'quick-event':t.event,'desktop-sat-name':t.satellite,'desktop-sat-status':t.status,'desktop-next':t.next,'context-id':t.contextId,'context-rel':t.contextRelated,'alert-text':t.alert})){const el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;}}
  const stopSharedContext=observeWorkspaceContext(applySharedContext);window.addEventListener('pagehide',event=>{if(!event.persisted)stopSharedContext();});
  const groups = [
    ['공용', [['wall','공용 상황판'],['normal','정상 임무 흐름'],['initial','초기 운용 흐름'],['exception','장애·복구 흐름']]],
    ['운용자', [['mission','임무·결과'],['operations','지상 운용'],['satellite','위성 상태·궤도'],['ground','지상국·통신'],['data','데이터·산출물'],['security','보안·사고'],['facility','지상 IT·시설'],['em','EM·통합검증']]],
    ['DT', [['integration','모듈 연결 설정과 ICD'],['scene','장면 구성'],['composer','시나리오 작성'],['run','실행·기록 설계'],['compare','비교·검증']]]
  ];
  const names = {settings:'환경 설정',...Object.fromEntries(groups.flatMap(([,views]) => views))};
  const state = {view:'wall',sat:'',follow:false,case:'X-GS01',step:0,normalPoint:0,orbit:'LEO',station:'제주 후보',insertion:6,satLat:0,satLon:0,gsLat:33.5,gsLon:126.5,scenario:'',events:[],editIndex:-1,injected:false,run:'RUN-P01',mode:'기준'};
  const isPopout=new URLSearchParams(location.search).get('popout')==='1';
  const windowId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let applyingRemote=false,pendingWorkspaceDraft=[],pendingWorkspaceDraftRemote=false;
  const childWindows=new Map();
  let awaitingInitial=isPopout&&Boolean(window.opener);
  const syncChannel='BroadcastChannel' in window?new BroadcastChannel('isdc-odt-v6-mock'):null;
  const cases = {
    'X-GS01':['지상국 예약 충돌','지상국·통신','예약 원장과 가시·RF 조건','대체국/대체 시각','실제 수신·무결성'],
    'X-DQ01':['데이터 품질·무결성','데이터·산출물','원본·복제·체크섬','재처리/재전송','품질·이용자 수신'],
    'X-SEC01':['명령 권한 충돌','보안·사고','요청 역할·정책·감사','보류/격리/재검토','승인·ACK·효과·감사'],
    'X-EM01':['모델–EM 계측 불일치','EM·통합검증','시계·단위·ICD·모델 버전','재대조/재시험','동일 입력의 계측·오차'],
    'X-IT01':['지상 IT·시설 장애','지상 IT·시설','전력·망·저장 계측','백업/복구','시설·RF·수신·무결성']
  };
  const roles = {
    mission:{sys:'SYS-01',title:'임무 요청·결과',question:'M-204의 요청 조건과 D-731의 이용자 수신 근거가 확인됐는가?',facts:[['요청','M-204 · USER-01'],['목표/대상','AOI-07 · 시연 입력'],['기한','04:15 UTC · 예시'],['관측','SAT-B · 실행 자료 없음'],['전달','D-731 · 수신 미확인'],['이용자','USER-02 · 수락 근거 없음']],evidence:['접수·수락/변경 이유','산출물 품질·전달 증거','이용자 수신/거절 기록'],handoff:'요청자 → 지상 운용 → 데이터 → 결과 이용자',dt:'접촉 지연 때 결과 기한은 지킬 수 있는가?',next:'normal'},
    operations:{sys:'SYS-02',title:'지상 운용·교대',question:'E-014의 영향과 결정 기한을 어떤 근거로 판단·인계할 것인가?',facts:[['사건','E-014 · 링크 저하 예시'],['위성','SAT-A'],['임무','M-204 · 영향 미판정'],['다음 접촉','GS-02 · 03:24 계획'],['절차','제안 → 검토 → 승인 미정'],['실행','송신·ACK·효과 없음']],evidence:['링크/접촉 실측','우선순위·기한 근거','승인권·교대 미종결 항목'],handoff:'통신 근거 → 운용 판단 → 위성/데이터 확인',dt:'접촉 우회·지연 가정의 임무 영향은?',next:'exception'},
    satellite:{sys:'SYS-03',title:'위성 상태·궤도',question:'SAT-A 자원과 초기 궤도 상태는 접촉·탑재 작업을 허용하는가?',facts:[['플랫폼','전력·열·자세 미연동'],['탑재체','작업 상태 미연동'],['저장','사용량·여유 미연동'],['궤도','초기 결정/오차 없음'],['투입','분리 후 +6분 DT 입력'],['첫 접촉','GS-02 계획 예시']],evidence:['분리 신호·상태 벡터','궤도결정·불확실성','실측 원격측정·안전 제약'],handoff:'비행역학/플랫폼 → 지상국·지상 운용',dt:'투입 시각·궤도 조건을 바꾸면 첫 접촉은?',next:'initial'},
    ground:{sys:'SYS-05',title:'지상국·통신',question:'GS-02의 예정 패스에서 실제 신호·데이터를 확인할 수 있는가?',facts:[['계획 접촉','GS-02 · 03:24 UTC'],['예약','원장 미연동'],['AOS/RF','실측 없음'],['전송 큐','D-731 · 상태 없음'],['대체국','GS-01 · 가시 미산출'],['시설','망·전력 계측 없음']],evidence:['안테나/RF·예약·가시 근거','실제 신호 획득·전송 로그','수신 데이터 무결성'],handoff:'통신 → 데이터·지상 운용',dt:'가상 제주/사천 후보와 대체 접촉은?',next:'scene'},
    data:{sys:'SYS-04',title:'데이터·산출물',question:'D-731의 위치·품질·무결성과 이용자 전달 상태는?',facts:[['생성','상태 미연동'],['처리/선별','OS-01 기록 없음'],['복제','저장 위치 미확인'],['품질','체크섬·판정 없음'],['전송','GS-02 계획'],['이용자','USER-02 수신 미확인']],evidence:['원본·복제 계보','품질/무결성 검사','지상·이용자 수신 확인'],handoff:'위성/처리 → 통신 → 결과 제공',dt:'재처리·재전송 조건의 지연은?',next:'normal'},
    security:{sys:'SYS-06',title:'보안·사고',question:'명령 요청을 보류·격리·복귀할 근거와 권한이 있는가?',facts:[['사례','X-SEC01 · 연구 가정'],['요청자','역할·정책 미정'],['명령','준비/승인/송신 없음'],['격리','실제 집행 없음'],['감사','접근·조치 기록 없음'],['복귀','효과 확인 없음']],evidence:['요청 역할/정책/승인권','증거 보존·감사 로그','송신·ACK·효과'],handoff:'보안 검토 → 운용 승인 주체 → 위성 효과 확인',dt:'격리 가정이 M-204에 미치는 영향은?',next:'exception'},
    facility:{sys:'SYS-09',title:'지상 IT·시설',question:'시설 장애가 어느 관제 서비스·접촉·임무를 중단시키는가?',facts:[['사례','X-IT01 · 연구 가정'],['전력/냉각','계측 없음'],['컴퓨팅/저장','가용성 없음'],['지상망','경로·용량 없음'],['대체','백업 상태 없음'],['복구','실측·수신 확인 없음']],evidence:['시설 계측·변경 이력','서비스→GS→임무 영향','복구 후 RF/자료 수신'],handoff:'시설 → 통신·데이터 → 지상 운용',dt:'복구 지연과 백업 경로가 기한에 미치는 영향은?',next:'exception'},
    em:{sys:'SYS-08',title:'EM·통합검증',question:'모델–EM 차이가 시계·단위·ICD·계측 중 어디서 생겼는가?',facts:[['연결','EM 미연동'],['계약','State/Event/Command/Data/Time'],['시계','동기화 계측 없음'],['ICD/단위','버전·매핑 미정'],['명령','잠금·실행 없음'],['재시험','기록·판정 없음']],evidence:['동일 입력/시간 정렬','모델·ICD/장비 버전','계측 오차·유효 범위'],handoff:'EM/검증 → DT 분석 → 지상 운용',dt:'동일 입력에서 모델과 장비의 차이는?',next:'compare'}
  };
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const panel=(title,meta,body,cls='')=>`<section class="panel ${cls}"><header><h2>${title}</h2><small>${meta}</small></header><div class="body">${body}</div></section>`;
  const rows=items=>items.map(([a,b])=>`<div class="row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
  const head=(title,sub,extra='')=>`<div class="headrow"><div><h1>${title}</h1><p>${sub}</p></div><div class="actions">${extra}</div></div>`;
  const btn=(label,view,cl='')=>`<button type="button" class="button ${cl}" data-view="${view}">${label}</button>`;
  const globe=()=>`<div class="globe ${state.follow?'follow':''}" aria-label="지구와 위성 위치의 개념 시안"><div class="orbit"></div><div class="orbit secondary"></div><div class="earth" aria-hidden="true"></div><button class="sat a" data-sat="SAT-A" aria-pressed="${state.sat==='SAT-A'}">SAT-A</button><button class="sat b" data-sat="SAT-B" aria-pressed="${state.sat==='SAT-B'}">SAT-B</button><button class="sat c" data-sat="SAT-C" aria-pressed="${state.sat==='SAT-C'}" style="left:${Math.max(8,Math.min(78,50+state.satLon/5))}%;top:${Math.max(10,Math.min(78,50-state.satLat/3))}%;right:auto;bottom:auto">SAT-C</button><span class="ground-pin one">GS-01</span><span class="ground-pin two">GS-02</span><span class="ground-pin virtual" style="left:${Math.max(8,Math.min(82,50+state.gsLon/5))}%;top:${Math.max(12,Math.min(80,50-state.gsLat/3))}%">가상 ${esc(state.station)}</span><div class="globe-caption"><span>NASA Blue Marble · 마커는 좌표 입력의 2D 개념 위치</span><span>실제 3D 투영·가시 계산 없음</span></div></div>`;
  function wall(){
    screen.innerHTML=`<div class="view wall-live" aria-label="공용 상황판">${panel('군집 공간 상황','현재 계산 자료 · 실측 아님',`<div class="wall-scope-controls"><label>표시 방식 <select id="wall-mode"><option value="3d">3D 지구</option><option value="2d">2D 지도</option></select></label><button type="button" id="wall-whole" class="button" data-wall-scope="toggle">전체 위성 OFF</button></div><p id="wall-scope-status" role="status"></p><div id="wall-globe-slot" aria-label="상황판 Cesium 지구"><div id="wall-globe" style="position:absolute;inset:0"></div><div id="wall-solar-overlay" class="space-sun" hidden aria-hidden="true"></div><p id="wall-globe-caption" hidden></p></div>`,'wall-globe-panel')}<div id="wall-summary" aria-label="운용 요약">${wallSummaryMarkup(readWorkspaceContext())}</div></div>`;
    mountWorkspaceWall(document.getElementById('wall-globe'),document.getElementById('wall-globe-caption'));document.getElementById('wall-mode').addEventListener('change',event=>setWorkspaceWallMode(event.target.value));
  }
  function normal(){
    const steps=[['요청 접수','SYS-01 · 요청자','조건·기한·수신처','접수·수락 이유'],['계획·배정','SYS-02 · 운용','위성/탑재/접촉','계획·승인 상태'],['관측·선별','SYS-03 · 위성','관측·처리 결과','기록·메타데이터'],['복제·품질','SYS-04 · 데이터','저장·무결성','복제·체크섬'],['지상 수신','SYS-05 · 통신','RF/지상 수신','수신·무결성 로그'],['이용자 확인','SYS-01 · 이용자','결과 수락/거절','수신·품질 확인']];
    const cards=steps.map(([a,b,c,d],i)=>`<div class="step ${state.normalPoint===i?'active':''}"><b>0${i+1} ${a}</b><strong>${b}</strong><small>인계: ${c}</small><em>증거: ${d} 없음</em></div>`).join('');
    screen.innerHTML=`<div class="view flow">${head('정상 임무 · 요청부터 결과 확인','M-204 / SAT-B / D-731 / GS-02 / USER-02 · E-014와 다른 정상 기준 시연',btn('임무 담당 화면','mission'))}${panel('여섯 업무 단계','모두 펼침 · 실제 단계 완료 아님',`<div class="step-grid">${cards}</div>`,'steps')}${panel('요청·결과 계약','SYS-01',rows([['목표','AOI-07 관측 예시'],['결과 기한','04:15 UTC 예시'],['수신처','USER-02'],['수락/변경','근거 없음']]))}${panel('시연 지점','표시만 변경',`<div class="actions"><button class="choice" data-normal="0" aria-pressed="${state.normalPoint===0}">접촉 전</button><button class="choice" data-normal="4" aria-pressed="${state.normalPoint===4}">지상 수신 예시</button><button class="choice" data-normal="5" aria-pressed="${state.normalPoint===5}">이용자 확인 예시</button></div><div class="note" style="margin-top:9px">선택은 화면 강조만 바꿉니다. 실제 접수·품질·수신 기록이 생기지 않습니다.</div>`) }${panel('DT 영향 질문','모델 미실행',rows([['변경 조건','GS-02 접촉 지연 가정'],['M-204 기한 차이','미산출'],['D-731 수신 증거','없음'],['실측 대조','없음']])+`<div class="actions" style="margin-top:8px">${btn('시나리오 작성','composer','alt')}</div>`)}</div>`;
  }
  function initial(){
    const steps=[['분리 입력','위성 플랫폼','분리 신호/식별','비행역학'],['초기 궤도','비행역학','상태 벡터/오차','지상국·운용'],['첫 접촉 준비','지상국·통신','예약/가시/RF','관제'],['신호·원격측정','통신·위성','AOS/건전성','지상 운용'],['초기 인계','운용·DT 분석','실측/모델 차이','다음 교대']];
    screen.innerHTML=`<div class="view flow">${head('분리부터 첫 접촉까지','SCN-01 연구 장면 · 위성·지상국·투입 시각은 DT 입력',btn('장면 편집','scene','alt'))}${panel('다섯 업무 인계','입력과 실측 구분',`<div class="step-grid" style="grid-template-columns:repeat(5,minmax(0,1fr))">${steps.map(([a,b,c,d],i)=>`<div class="step"><b>0${i+1} ${a}</b><strong>${b}</strong><small>필요: ${c}</small><em>다음: ${d}</em></div>`).join('')}</div>`,'steps')}${panel('DT 투입 입력','계산 전',rows([['궤도 종류',state.orbit],['투입 시각',`분리 후 +${state.insertion}분`],['후보 지상국',state.station],['첫 접촉','미산출']]))}${panel('운용 확인','실측 없음',rows([['분리 신호','미확인'],['궤도결정','없음'],['AOS/원격측정','없음'],['모델–실측 차이','미산출']]))}${panel('인계 경계','임의 완료 금지',`<div class="note">후보 마커의 근접은 가시성이나 신호 획득 판정이 아닙니다.</div><div class="actions" style="margin-top:9px">${btn('위성 담당','satellite')}${btn('통신 담당','ground')}</div>`)}</div>`;
  }
  function exception(){
    const c=cases[state.case];
    const labels=['탐지','원인·범위','임무·데이터 영향','DT 비교','사람의 판단·인계','회복 증거'];
    const evidence=[`${c[2]} 확인 전`,`실제 사건 범위 없음`,'M-204 / D-731 영향 미판정',`${c[3]} 결과 미산출`,'권한/담당 미정',`${c[4]} 없음`];
    screen.innerHTML=`<div class="view exception">${head('장애·복구 흐름','다섯 사례는 서로 독립된 연구 가정 · 동시 사건 우선순위 미판정',btn('DT 비교','compare','alt'))}<div class="case-list">${Object.entries(cases).map(([id,v])=>`<button class="choice" data-case="${id}" aria-pressed="${state.case===id}">${id}<br>${v[0]}</button>`).join('')}</div>${panel(`${state.case} · ${c[0]}`,'탐지 → 회복 증거',`<div class="step-grid">${labels.map((label,i)=>`<div class="step"><b>0${i+1} ${label}</b><strong>${i===0?c[1]:i===3?'DT 분석':i===4?'지상 운용':i===5?c[1]:'담당 업무'}</strong><small>${evidence[i]}</small><em>${i===5?'종결 보류':'다음 인계 필요'}</em></div>`).join('')}</div>`,'steps')}<div class="lower">${panel('시작 질문',c[1],`<div class="question">${c[2]}이 실제로 확인됐는가?</div><div class="actions" style="margin-top:8px">${btn('담당 화면',state.case==='X-GS01'?'ground':state.case==='X-DQ01'?'data':state.case==='X-SEC01'?'security':state.case==='X-EM01'?'em':'facility')}</div>`)}${panel('대안·재시도','DT 가정',rows([['검토 대안',c[3]],['기한/품질 영향','미산출'],['실제 실행','없음'],['복구 시각','미확인']]))}${panel('종결에 필요한 근거','운용 예시와 분리',`<div class="note">${c[4]}가 없으므로 완료·복귀로 표시하지 않습니다.</div><div class="actions" style="margin-top:8px">${btn('정상 흐름 대조','normal')}</div>`)}</div></div>`;
  }
  function role(key){
    const r=roles[key];
    screen.innerHTML=`<div class="view role">${head(r.title,`${r.sys} · 2026-09-23 03:18 UTC 고정 예시`,btn('관련 흐름',r.next))}${panel('지금 판단할 일','업무 질문',`<div class="question">${r.question}</div><div class="note" style="margin-top:10px">실제 자료·권한·절차가 없어 판단은 보류합니다.</div><div class="actions" style="margin-top:10px">${btn('공용 상황판','wall')}</div>`)}${panel('현재 자료와 업무 상태','출처/미연동 표시',`<div class="tiles">${r.facts.map(([a,b])=>`<div class="tile"><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('')}</div>`)}${panel('증거 · 인계','집행 없음',`<strong class="cyan">필요한 근거</strong>${r.evidence.map(x=>`<div class="row"><span>${esc(x)}</span><strong class="amber">없음</strong></div>`).join('')}<p><strong class="cyan">다음 인계</strong><br>${r.handoff}</p>`)}<div class="bottom">${panel('계획','예정',`<strong>GS-02 03:24 UTC</strong><br><span class="small muted">접촉 계획 예시</span>`)}${panel('관측/실측','없음',`<strong class="amber">원격측정·수신·EM 없음</strong>`)}${panel('DT 질문','별도 연구',`<span class="small">${r.dt}</span>`)}${panel('결과 확인','종결 보류',`<strong>승인·ACK·수신 근거 필요</strong>`)}</div></div>`;
  }
  function scene(){
    screen.innerHTML=`<div class="view studio">${head('DT · 장면 구성','F01/F02/F08/F11 · 가상 위성·궤도·지상국·투입 시각',btn('초기 운용 흐름','initial'))}${panel('장면 입력','SCN-01 연구 설정',`<form id="scene-form" class="form"><label>시나리오 이름<input id="scene-name" maxlength="32" value="${esc(state.scenario)}" placeholder="예: 제주 지상국 접촉 연구"></label><div class="pair"><label>궤도 종류<select id="scene-orbit"><option ${state.orbit==='LEO'?'selected':''}>LEO</option><option ${state.orbit==='MEO'?'selected':''}>MEO</option><option ${state.orbit==='GEO'?'selected':''}>GEO</option></select></label><label>후보 지상국<select id="scene-station"><option ${state.station==='제주 후보'?'selected':''}>제주 후보</option><option ${state.station==='사천 후보'?'selected':''}>사천 후보</option><option ${state.station==='GS-01'?'selected':''}>GS-01</option><option ${state.station==='GS-02'?'selected':''}>GS-02</option></select></label></div><div class="pair"><label>가상 위성 위도<input id="sat-lat" type="number" min="-90" max="90" step="0.1" value="${state.satLat}"></label><label>경도<input id="sat-lon" type="number" min="-180" max="180" step="0.1" value="${state.satLon}" aria-label="가상 위성 경도"></label></div><div class="pair"><label>후보국 위도<input id="gs-lat" type="number" min="-90" max="90" step="0.1" value="${state.gsLat}"></label><label>경도<input id="gs-lon" type="number" min="-180" max="180" step="0.1" value="${state.gsLon}" aria-label="후보국 경도"></label></div><label>분리 후 투입 시각 (0~180분)<input id="scene-minute" type="number" min="0" max="180" value="${state.insertion}"></label><div class="actions"><button class="button alt" type="submit">장면 입력 적용</button>${btn('사건 작성','composer')}</div><div id="scene-feedback" class="small amber" role="status">좌표는 2D 개념 마커를 옮깁니다. 실제 궤도·접촉 계산 없음.</div></form>`)}${panel('위성·지상국 공간 맥락','가시/RF·적합도 미산출',globe(),'globe-panel')}${panel('검증 질문','현 시안의 공백',rows([['위성 좌표',state.satLat+'° / '+state.satLon+'°'],['후보국 입력 좌표',state.gsLat+'° / '+state.gsLon+'°'],['안테나/RF·예약','미연동'],['첫 접촉 창','미산출'],['기준 자료/모델','없음'],['EM 상태','변경 없음']])+`<div class="note violet-note" style="margin-top:7px">LEO/MEO/GEO 선택은 적합성 판정이 아닙니다.</div>`)}${panel('분리 → 투입 → 첫 접촉 시간축','DT 입력과 계획/관측 분리',`<div class="mini-timeline"><div><b>분리 기준</b><span>입력 시각</span></div><div><b>투입 +${state.insertion}분</b><span>${state.orbit} 가정</span></div><div><b>첫 접촉</b><span>${state.station} · 미산출</span></div><div><b>실제 AOS</b><span>계측 없음</span></div></div>`,'bottom')}</div>`;
    document.getElementById('scene-form').addEventListener('submit',e=>{e.preventDefault();const n=Number(document.getElementById('scene-minute').value);const name=document.getElementById('scene-name').value.trim();const coords=['sat-lat','sat-lon','gs-lat','gs-lon'].map(id=>Number(document.getElementById(id).value));if(!name||!Number.isFinite(n)||n<0||n>180||coords.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>(i%2===0?90:180))){const f=document.getElementById('scene-feedback');f.textContent='이름·투입 0~180분·위도 ±90/경도 ±180을 확인하세요.';f.className='small red';return}state.scenario=name;state.orbit=document.getElementById('scene-orbit').value;state.station=document.getElementById('scene-station').value;state.insertion=n;[state.satLat,state.satLon,state.gsLat,state.gsLon]=coords;render();document.getElementById('scene-feedback').textContent='좌표 마커를 갱신했습니다. 궤도·접촉 계산은 수행하지 않았습니다.';document.getElementById('scene-name').focus()});
  }
  function composer(){
    screen.innerHTML=`<div class="view studio">${head('DT · 시나리오 작성','F05/F11 · 빈 초안부터 복수 사건·순서·수정·해제까지',btn('장면 구성','scene'))}${panel('새 시나리오·사건 입력','연구 초안',`<form id="event-form" class="form"><label>시나리오 이름<input id="composer-name" maxlength="32" value="${esc(state.scenario)}" placeholder="새 시나리오 이름"></label><div class="pair"><label>사건 대상<select id="event-target"><option>SAT-A</option><option>SAT-B</option><option>GS-02</option><option>D-731</option><option>EM</option></select></label><label>사건 종류<select id="event-kind"><option>링크 품질 저하</option><option>접촉 지연</option><option>데이터 품질 실패</option><option>시설 장애</option><option>EM 불일치</option></select></label></div><label>기준 시각에서 +분<input id="event-minute" type="number" min="0" max="180" value="8"></label><div class="actions"><button class="button alt" type="submit">사건 추가</button><button type="button" class="button" data-clear-events>초안 비우기</button></div><div id="event-feedback" class="small amber" role="status">초안을 만들고 사건을 시간순으로 추가하세요.</div></form>`)}${panel('사건 순서·의존성','화면 세션 초안',`<div class="event-list">${state.events.length?state.events.map((e,i)=>`<div class="event-chip"><span>${i+1}. +${e.minute}분 · ${esc(e.target)} · ${esc(e.kind)}</span><button type="button" data-edit="${i}" aria-label="${i+1}번 사건 수정">수정</button><button type="button" data-remove="${i}" aria-label="${i+1}번 사건 삭제">삭제</button></div>`).join(''):'<p class="muted">아직 사건이 없습니다. 왼쪽에서 첫 사건을 추가하세요.</p>'}</div><div class="note violet-note" style="margin-top:8px">사건은 입력 시각 순으로 표시합니다. 의존성·충돌 검사는 미구현입니다.</div>`)}${panel('주입 표시·영향 질문','실제 실행 없음',rows([['기준 장면','SCN-01 연구 예시'],['사건 수',`${state.events.length}건`],['화면 주입',state.injected?'표시 중':'해제'],['실제 runtime','미연동'],['운용 E-014','변경 없음']])+`<div class="actions" style="margin-top:8px"><button type="button" class="button alt" data-inject>주입 표시</button><button type="button" class="button" data-uninject>표시 해제</button></div>`)}${panel('변경과 결과의 경계','실제 운용 영향 아님',`<div class="comparison"><div class="tile"><small>기준</small><strong>SCN-01</strong></div><div class="tile"><small>변경</small><strong>${state.events.length}개 사건</strong></div><div class="tile"><small>영향</small><strong>미산출</strong></div></div><p class="small muted">E-014/M-204의 실제 사건·임무·EM 상태는 바뀌지 않습니다.</p>`,'bottom')}</div>`;
    document.getElementById('event-form').addEventListener('submit',e=>{e.preventDefault();const name=document.getElementById('composer-name').value.trim();const minute=Number(document.getElementById('event-minute').value);if(!name||!Number.isFinite(minute)||minute<0||minute>180){const f=document.getElementById('event-feedback');f.textContent='시나리오 이름과 0~180분 사건 시각을 입력하세요.';f.className='small red';return}state.scenario=name;const item={minute,target:document.getElementById('event-target').value,kind:document.getElementById('event-kind').value};if(state.editIndex>=0)state.events[state.editIndex]=item;else state.events.push(item);state.editIndex=-1;state.events.sort((a,b)=>a.minute-b.minute);state.injected=false;render();document.getElementById('composer-name').focus()});
  }
  function run(){
    screen.innerHTML=`<div class="view studio">${head('DT · 실행·기록·재생 설계','F03/F06/F07/F10 · 조작·상태·근거의 화면 자리',btn('비교·검증','compare'))}${panel('실행 계약','모델/규칙 미연동',rows([['장면',state.scenario||'SCN-01 예시'],['사건',`${state.events.length}개 화면 초안`],['규칙/모듈','버전 미선택'],['시계','시뮬레이션 시계 없음'],['run ID','실제 발급 없음'],['EM','연결·명령 없음']]))}${panel('실행 제어 자리','기능 미연동',`<div class="tiles"><div class="tile"><small>준비</small><strong>입력 검토 / 모델 버전</strong></div><div class="tile"><small>시작·일시정지</small><strong>실행 상태 전이 필요</strong></div><div class="tile"><small>사건 주입</small><strong>실제 적용/취소 기록 필요</strong></div><div class="tile"><small>중단·재시도</small><strong>오류·복구 근거 필요</strong></div></div><div class="actions" style="margin-top:9px"><button class="button" disabled title="실제 실행 기능 없음">실행 미연동</button><button class="button" disabled title="실제 기록 기능 없음">기록 미연동</button><button class="button" disabled title="실제 재생 기능 없음">재생 미연동</button></div>`)}${panel('기록·재생 근거','실제 데이터 없음',rows([['run 기록','없음'],['입력/모델 버전','없음'],['상태 스냅샷','없음'],['재생 시각','없음'],['EM 계측','없음']])+`<div class="note violet-note" style="margin-top:8px">화면상의 SCN 초안은 실행 기록이 아닙니다.</div>`)}${panel('필요한 제어 경계','제품 구현 별도',`<div class="mini-timeline"><div><b>01 입력 검토</b><span>장면·사건·모듈</span></div><div><b>02 실행</b><span>상태·오류</span></div><div><b>03 기록</b><span>run·스냅샷</span></div><div><b>04 재생</b><span>출처·시각</span></div></div>`,'bottom')}</div>`;
  }
  function compare(){
    screen.innerHTML=`<div class="view studio">${head('DT · 운용자 비교·검증','SYS-07 · F04/F09/F10 · 기준/후보/실측의 차이와 인계',btn('EM 검증','em'))}${panel('비교 기준','동일 시각 필요',`<div class="actions"><button class="choice" data-run="RUN-P01" aria-pressed="${state.run==='RUN-P01'}">RUN-P01 기준 예시</button><button class="choice" data-run="RUN-P02" aria-pressed="${state.run==='RUN-P02'}">RUN-P02 후보 예시</button></div>${rows([['기준 시각','03:18 UTC 예시'],['선택 run',state.run],['동일 입력 검증','없음'],['실제 실행','없음']])}`)}${panel('업무 영향 비교','미산출',`<div class="comparison"><div class="tile"><small>기준</small><strong>접촉·기한 미산출</strong></div><div class="tile"><small>후보</small><strong>사건 ${state.events.length}건 · 결과 없음</strong></div><div class="tile"><small>차이</small><strong>판정 보류</strong></div></div><div class="tiles" style="margin-top:8px"><div class="tile"><small>M-204 결과 기한</small><strong>영향 미판정</strong></div><div class="tile"><small>D-731 품질/수신</small><strong>실측·모델 없음</strong></div></div>`)}${panel('신뢰도·인계','운용 판단 전',rows([['모델/자료 버전','없음'],['적용 범위','미정'],['불확실성','미산정'],['EM/실측 대조','없음'],['운용 권고','없음']])+`<div class="note violet-note" style="margin-top:8px">DT 가정을 관측 상태나 승인된 조치로 읽지 않습니다.</div>`)}${panel('운용자에게 전달할 근거 묶음','현재 모두 비어 있음',`<div class="mini-timeline"><div><b>기준</b><span>스냅샷·UTC</span></div><div><b>변경</b><span>입력·사건·모델</span></div><div><b>차이</b><span>임무·데이터·접촉</span></div><div><b>한계</b><span>검증·불확실성</span></div></div>`,'bottom')}</div>`;
  }
  function render(){
    restoreGlobeSurface();
    if(!pendingWorkspaceDraft.length)pendingWorkspaceDraft=draftValues();
    queueMicrotask(()=>{
      showWorkspaceOrbit(state.view);
      workLayout.setView(state.view);
      if(pendingWorkspaceDraft.length){
        applyWorkspaceDraft(pendingWorkspaceDraft,pendingWorkspaceDraftRemote);
        for(const item of pendingWorkspaceDraft){if(item.id.startsWith('st-')||(item.id.startsWith('cat-')||item.id.startsWith('kpi-')||item.id.startsWith('hil-'))||item.id.startsWith('sim-')||item.id.startsWith('mw-')||item.id.startsWith('series-')||item.id.startsWith('radio-')||item.id.startsWith('cp-')||item.id.startsWith('rf-')||item.id.startsWith('ground-')||item.id.startsWith('visibility-')||item.id==='orbit-utc'||['orbit-input','orbit-rate'].includes(item.id))continue;const field=document.getElementById(item.id);if(field&&'value' in field)field.value=item.value;}
        pendingWorkspaceDraft=[];pendingWorkspaceDraftRemote=false;
      }
    });
    const v=state.view;
    if(v==='wall')wall(); else if(v==='normal')normal(); else if(v==='initial')initial(); else if(v==='exception')exception(); else if(roles[v])role(v); else if(v==='scene')scene(); else if(v==='composer')composer(); else if(v==='run')run(); else if(['settings','integration'].includes(v))screen.innerHTML=''; else compare();
    document.querySelectorAll('#nav button').forEach(b=>b.dataset.view===v?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
    document.getElementById('window-title').textContent=names[v];
    document.getElementById('desktop-sat-name').textContent=state.sat||'SAT-A';
    document.getElementById('desktop-next').textContent=state.sat==='SAT-B'?'GS-01 · 03:41 UTC 계획':'GS-02 · 03:24 UTC 계획';
    document.querySelectorAll('.desktop-sat').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sat===state.sat)));
    document.getElementById('context-id').textContent=v==='exception'?state.case:['initial','scene','composer','run','compare'].includes(v)?(state.scenario||'SCN-01'):v==='normal'?'M-204':v==='em'?'X-EM01':'E-014';
    document.getElementById('context-rel').textContent=['initial','scene','composer','run','compare'].includes(v)?`${state.orbit} / ${state.station} / 분리 +${state.insertion}분 · DT 연구`:v==='normal'?'SAT-B / D-731 / GS-02 / USER-02 · 정상 기준 예시':'SAT-A / M-204 / GS-02 / D-731';
    document.getElementById('alert-text').textContent=v==='exception'?`${state.case} ${cases[state.case][0]} · 독립 연구 가정, 실제 경보 아님`:['initial','scene','composer','run','compare'].includes(v)?'DT 가정 화면 · E-014 운용 사건/EM 상태와 동기화되지 않음':'E-014 링크 품질 저하 · 실제 경보·우선순위 판정 없음';
    applySharedContext();
    if(!applyingRemote&&!awaitingInitial)syncChannel?.postMessage({type:'state',sender:windowId,state:{...state}});
  }
  const workWindow=document.getElementById('work-window'),launcher=document.getElementById('launcher'),nav=document.getElementById('nav'),shelf=document.getElementById('shelf-restore'),shelfContainer=document.getElementById('window-shelf');
  const showShelf=value=>{shelf.hidden=!value;if(shelfContainer)shelfContainer.hidden=!value;};
  showShelf(false);
  const groupLabels=['관제','운용','DT'];
  const railGroups=document.getElementById('rail-groups');if(!railGroups.querySelector('button[data-group]'))railGroups.innerHTML=groups.map(([g],i)=>`<button type="button" data-group="${i}" aria-label="${g} 작업 목록 열기">${groupLabels[i]}</button>`).join('');
  function showGroup(index){const [label,views]=groups[index];document.getElementById('launcher-title').textContent=label+' 작업공간';nav.innerHTML=views.map(([id,n])=>`<button type="button" data-view="${id}">${n}</button>`).join('');launcher.hidden=false;document.querySelectorAll('#rail-groups button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.group)===index)));nav.querySelector('button')?.focus()}
  function openView(view){if(!names[view])return;state.view=view;workWindow.hidden=false;fitWindow();showShelf(false);launcher.hidden=true;render();location.hash=view;screen.focus()}
  bindWorkspaceView(openView);
  function isDraftField(id){return !id.startsWith('ms-')&&!['kpi-history','kpi-filter-PASS','kpi-filter-FAIL','kpi-filter-INVALID','mw-mission','mw-task','ground-input','orbit-input','orbit-rate'].includes(id);}
  function draftScope(id){if(id.startsWith('st-'))return {settings_link:document.getElementById('st-link')?.value};return id.startsWith('mw-')?{mission_id:document.getElementById('mw-mission')?.value,task_id:document.getElementById('mw-task')?.value}:{};}
  function draftChecked(field){return ['st-enabled','st-reconnect'].includes(field.id)?{checked:!!field.checked}:{};}
  function draftValues(){return [...screen.querySelectorAll('input[id],select[id],textarea[id]')].filter(el=>isDraftField(el.id)).map(el=>({id:el.id,value:el.value,...draftChecked(el),...draftScope(el.id)}));}
  function transferSnapshot(target=state.view){return {type:'isdc-v6-snapshot',state:{...state,view:target},view:target,draft:target===state.view?draftValues():[]};}
  function applySnapshot(data){
    if(!data||!names[data.view]||!data.state)return;
    applyingRemote=true;Object.assign(state,data.state,{view:data.view});
    pendingWorkspaceDraftRemote=true;
    pendingWorkspaceDraft=Array.isArray(data.draft)?data.draft.filter(item=>typeof item?.id==='string'&&isDraftField(item.id)&&typeof item.value==='string'):[];
    openView(data.view);applyingRemote=false;awaitingInitial=false;
  }
  syncChannel?.addEventListener('message',event=>{const data=event.data;if(data?.sender===windowId||awaitingInitial)return;
    if(data?.type==='draft'&&data.view===state.view&&isDraftField(data.id)){const field=document.getElementById(data.id);if(field&&typeof data.value==='string'&&'value' in field){const scope=draftScope(data.id);if(data.id.startsWith('mw-')&&(scope.mission_id!==data.mission_id||scope.task_id!==data.task_id))return;if(field===document.activeElement&&(field.value!==data.value||(['st-enabled','st-reconnect'].includes(data.id)&&field.checked!==data.checked))){const feedback=document.getElementById('popout-feedback');feedback.hidden=false;feedback.textContent='다른 창에서도 이 항목을 수정했습니다. 현재 편집값을 유지합니다.';}else{applyWorkspaceDraft([{id:data.id,value:data.value,mission_id:data.mission_id,task_id:data.task_id,settings_link:data.settings_link,checked:data.checked}],true);if(!data.id.startsWith('st-'))field.value=data.value;}}return;}
    if(data?.type!=='state'||!data.state)return;
    applyingRemote=true;const currentView=state.view;Object.assign(state,data.state,{view:currentView});render();applyingRemote=false;
  });
  screen.addEventListener('input',event=>{const field=event.target;if(!applyingRemote&&field.id&&isDraftField(field.id)&&'value' in field)syncChannel?.postMessage({type:'draft',sender:windowId,view:state.view,id:field.id,value:field.value,...draftChecked(field),...draftScope(field.id)});});
  screen.addEventListener('change',event=>{const field=event.target;if(!applyingRemote&&field.id&&isDraftField(field.id)&&'value' in field)syncChannel?.postMessage({type:'draft',sender:windowId,view:state.view,id:field.id,value:field.value,...draftChecked(field),...draftScope(field.id)});});
  window.addEventListener('message',event=>{if(ended||event.origin!==location.origin)return;const data=event.data;if(data?.type==='isdc-v6-ready'&&childWindows.has(event.source)){if(event.source.closed){childWindows.delete(event.source);return;}event.source.postMessage(transferSnapshot(childWindows.get(event.source)),event.origin);}else if(data?.type==='isdc-v6-snapshot'&&isPopout&&event.source===window.opener){applySnapshot(data);}});
  if(isPopout){document.body.classList.add('popup-mode');workWindow.classList.add('expanded');window.addEventListener('load',()=>window.opener?.postMessage({type:'isdc-v6-ready'},location.origin));}
  let savedRect=null;
  function expand(){const button=document.getElementById('window-expand');if(!workWindow.classList.contains('expanded')){savedRect={left:workWindow.style.left,top:workWindow.style.top,width:workWindow.style.width,height:workWindow.style.height};workWindow.classList.add('expanded');fitExpandedWindow();button.setAttribute('aria-label','작업 창 작은 크기로 복원');button.title='작은 크기로 복원'}else{workWindow.classList.remove('expanded');Object.assign(workWindow.style,savedRect||{left:'',top:'',width:'',height:''});button.setAttribute('aria-label','작업 창 확장');button.title='확장';fitWindow()}document.getElementById('window-title').focus()}
  document.getElementById('window-expand').addEventListener('click',expand);
  function openTaskWindow(target){
    if(ended||!Object.hasOwn(names,target))return;
    const url=new URL(location.href);url.searchParams.set('popout','1');url.hash=target;
    const feedback=document.getElementById('popout-feedback');
    let child=null;
    for(const [candidate,view]of childWindows){if(candidate.closed)childWindows.delete(candidate);else if(view===target)child=candidate;}
    try{child??=window.open(url.href,`isdc-odt-v6-${target}`,'popup=yes,width=1280,height=800,resizable=yes,scrollbars=no');}catch{}
    if(ended)return;
    if(!child){feedback.hidden=false;feedback.textContent='브라우저에서 별도 창 열기가 차단되었습니다.';return;}
    childWindows.set(child,target);feedback.hidden=true;try{child.focus();}catch{}
    if(ended)return;
    // A fresh window requests its snapshot after loading; an existing named window receives it here.
    try{if(child.location.origin===location.origin&&child.document.readyState==='complete')child.postMessage(transferSnapshot(target),location.origin);}catch{}
  }
  document.getElementById('window-popout').addEventListener('click',()=>openTaskWindow(state.view));
  document.getElementById('window-minimize').addEventListener('click',()=>{workWindow.hidden=true;restoreGlobeSurface();resizeWorkspaceGlobe();showShelf(true);shelf.textContent=`${names[state.view]} 창 다시 열기`;shelf.focus()});
  document.getElementById('window-close').addEventListener('click',()=>{if(isPopout){window.close();return;}workWindow.hidden=true;restoreGlobeSurface();resizeWorkspaceGlobe();showShelf(false);document.querySelector('#rail-groups button')?.focus()});
  shelf.addEventListener('click',()=>{workWindow.hidden=false;if(state.view==='wall')mountWorkspaceWall(document.getElementById('wall-globe'),document.getElementById('wall-globe-caption'));resizeWorkspaceGlobe();fitWindow();showShelf(false);document.getElementById('window-title').focus()});
  document.getElementById('launcher-close').addEventListener('click',()=>{launcher.hidden=true;document.querySelector('#rail-groups button[aria-pressed=true]')?.focus()});
  const dragTarget=document.getElementById('window-titlebar'),resizeTarget=document.getElementById('resize-handle');
  // Keep the entire window between the navigation rail, header and footer.
  function fitExpandedWindow(){if(isPopout)return;const area=document.getElementById('desktop').getBoundingClientRect();Object.assign(workWindow.style,{left:area.left+'px',top:area.top+'px',width:area.width+'px',height:area.height+'px'});}
  const desktopSizeObserver=window.ResizeObserver?new window.ResizeObserver(()=>{if(!workWindow.hidden&&workWindow.classList.contains('expanded'))fitExpandedWindow();}):null;desktopSizeObserver?.observe(document.getElementById('desktop'));window.addEventListener('pagehide',event=>{if(!event.persisted)desktopSizeObserver?.disconnect();});
  function fitWindow(){
    if(workWindow.hidden)return;if(workWindow.classList.contains('expanded')){fitExpandedWindow();return;}
    const rect=workWindow.getBoundingClientRect();
    const width=Math.min(rect.width,Math.max(0,innerWidth-88));
    const height=Math.min(rect.height,Math.max(0,innerHeight-145));
    Object.assign(workWindow.style,{width:width+'px',height:height+'px'});
    const b=bounds();
    workWindow.style.left=Math.max(b.minX,Math.min(b.maxX,rect.left))+'px';
    workWindow.style.top=Math.max(b.minY,Math.min(b.maxY,rect.top))+'px';
  }
  function bounds(){return {minX:80,maxX:innerWidth-workWindow.offsetWidth-8,minY:116,maxY:innerHeight-workWindow.offsetHeight-29}}
  let finishGesture=null;
  function beginPointer(event,resize){
    if(event.button!==0||workWindow.classList.contains('expanded')||(!resize&&event.target.closest('button')))return;
    event.preventDefault();finishGesture?.();fitWindow();
    const target=resize?resizeTarget:dragTarget,targetRect=workWindow.getBoundingClientRect(),startX=event.clientX,startY=event.clientY;
    target.setPointerCapture(event.pointerId);
    const move=e=>{
      if(e.pointerId!==event.pointerId)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;
      if(resize){
        workWindow.style.width=Math.max(460,Math.min(innerWidth-targetRect.left-8,targetRect.width+dx))+'px';
        workWindow.style.height=Math.max(360,Math.min(innerHeight-targetRect.top-29,targetRect.height+dy))+'px';
      }else{
        const b=bounds();
        workWindow.style.left=Math.max(b.minX,Math.min(b.maxX,targetRect.left+dx))+'px';
        workWindow.style.top=Math.max(b.minY,Math.min(b.maxY,targetRect.top+dy))+'px';
      }
      fitWindow();
    };
    const finish=()=>{
      target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',finish);target.removeEventListener('pointercancel',finish);
      try{target.releasePointerCapture(event.pointerId)}catch{}
      if(finishGesture===finish)finishGesture=null;
    };
    finishGesture=finish;
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);
  }
  let ended=false;
  window.addEventListener('pagehide',event=>{
    if(event.persisted||ended)return;
    ended=true;finishGesture?.();syncChannel?.close();childWindows.clear();
  });
  dragTarget.addEventListener('pointerdown',e=>beginPointer(e,false));resizeTarget.addEventListener('pointerdown',e=>beginPointer(e,true));
  document.getElementById('window-title').addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d||workWindow.classList.contains('expanded'))return;e.preventDefault();const b=bounds(),rect=workWindow.getBoundingClientRect(),step=e.shiftKey?32:8;workWindow.style.left=Math.max(b.minX,Math.min(b.maxX,rect.left+d[0]*step))+'px';workWindow.style.top=Math.max(b.minY,Math.min(b.maxY,rect.top+d[1]*step))+'px'});
  resizeTarget.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d||workWindow.classList.contains('expanded'))return;e.preventDefault();const rect=workWindow.getBoundingClientRect(),step=e.shiftKey?32:8;workWindow.style.width=Math.max(460,Math.min(innerWidth-rect.left-8,rect.width+d[0]*step))+'px';workWindow.style.height=Math.max(360,Math.min(innerHeight-rect.top-29,rect.height+d[1]*step))+'px';fitWindow()});
  window.addEventListener('resize',()=>{finishGesture?.();fitWindow()});
  document.addEventListener('click',e=>{const t=e.target.closest('[data-wall-scope],[data-view],[data-sat],[data-follow],[data-reset],[data-case],[data-normal],[data-remove],[data-edit],[data-clear-events],[data-inject],[data-uninject],[data-run]');if(!t)return;
    if(t.dataset.wallScope){setWorkspaceWallScope(t.dataset.wallScope)}
    else if(t.dataset.view){let parent=t,linked=false;while(parent){if(parent===screen){linked=true;break;}parent=parent.parentElement;}if(linked){e.preventDefault();openTaskWindow(t.dataset.view);}else openView(t.dataset.view)}
    else if(t.dataset.sat){state.sat=t.dataset.sat;state.follow=false;openView('satellite')}
    else if(t.hasAttribute('data-follow')){state.follow=!state.follow;render()}
    else if(t.hasAttribute('data-reset')){state.sat='';state.follow=false;render()}
    else if(t.dataset.case){state.case=t.dataset.case;render()}
    else if(t.dataset.normal){state.normalPoint=Number(t.dataset.normal);render()}
    else if(t.dataset.edit){state.editIndex=Number(t.dataset.edit);const item=state.events[state.editIndex];document.getElementById('event-target').value=item.target;document.getElementById('event-kind').value=item.kind;document.getElementById('event-minute').value=item.minute;document.getElementById('event-feedback').textContent=`${state.editIndex+1}번 사건 수정 중 · 값을 바꾼 뒤 저장하세요.`;document.querySelector('#event-form button[type=submit]').textContent='사건 수정 저장';document.getElementById('event-minute').focus()}else if(t.dataset.remove){state.events.splice(Number(t.dataset.remove),1);state.editIndex=-1;state.injected=false;render()}
    else if(t.hasAttribute('data-clear-events')){state.events=[];state.editIndex=-1;state.injected=false;render()}
    else if(t.hasAttribute('data-inject')){state.injected=state.events.length>0;render()}
    else if(t.hasAttribute('data-uninject')){state.injected=false;render()}
    else if(t.dataset.run){state.run=t.dataset.run;render()}
  });
  document.getElementById('rail-groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b)showGroup(Number(b.dataset.group))});
  document.getElementById('alert-open').addEventListener('click',()=>openView('operations'));
  window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(names[v]&&(v!==state.view||workWindow.hidden))openView(v)});
  // A main document starts on its background even when its URL retains the last task.
  // Only an explicitly requested popout opens its initial role window.
  workWindow.hidden=true;
  const initialView=location.hash.slice(1);if(isPopout&&names[initialView])openView(initialView);else{showGroup(0);launcher.hidden=true}
})();
