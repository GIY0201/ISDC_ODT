# ADR0051 전체 수락 배치의 미래 통과 표시 입력

상태: N017f 내부 포트 설계. 전체 미래 통과 연결 완료가 아니다.

원본 communication.js의 computePasses는 전체 deployed 위성과 선택한 enabled
지상국을 사용한다. 지상국 변경 즉시 조회, 기존 분석 UTC와 절대차 >60000ms
갱신, 고정3시간, 위성별3구간과 합친 첫12구간 표시를 보존해야 한다.
현재 missionInputs는 정지한 표시 시계와 수락 임무 입력을 요구한다. 자연
재생의 표시용 통과를 연결하기 위해 이 승인 경계를 느슨하게 만들지 않는다.

기존 workspace_nodes에 captureFuturePassInputs(stationId=null)와
verifyFuturePassInputs(value)를 추가한다. 반환 값은 deeply-frozen
{presentation_kind:'FUTURE_PASS_INPUT_V1',analysis_utc,nodes,station,deployment}
이며 기존 owner의 WeakMap에 등록된다. stationId가 없으면 원본처럼 첫 enabled
지상국을 사용하고, 명시 ID가 없거나 비활성이면 거부한다. 임의 JSON/사본은
검증되지 않는다. 이 단계에는 HTTP, native 계산, 별도 시계/상태 store,
UI polling 또는 통과 결과 게시가 없다.

기존 store의 loaded/confirmed/nonempty whole deployed <=240/dirty/error 및
deployment의 실제 server 일치/syncRequired/busy/error/disposed를 확인한다.
full receipt는 기존 deployment.matchesServer와 저장 receipt의 일치로 확인하며
ID나 revision 일부만으로 승인하지 않는다. 현재 drafts나 선택한 위성만으로
전체 수락 명부를 대체하지 않는다. actual enabled station 정의와 설정 준비,
편집 충돌, ground 활성 상태도 확인한다.

표시 입력은 기존 globe의 실제 display context를 쓴다. projected SIM은 거부한다.
정지 source는 같은 UTC/source와 readClock.running===false가 필요하다. 자연
catalog 재생은 기존 captureDisplayContinuity/verifyDisplayContinuity의 실제
capability가 있을 때만 가능하며 같은 capability/source에서 UTC 이동을 허용한다.
analysis_utc는 최초 시각으로 고정한다. pause/seek/source 변경, store 알림,
station/config clear, ground 비활성, observed invalid continuity와 dispose는
epoch를 철회한다. 검증에서 실패한 등록 값도 영구 철회하며 회복해도 재사용할
수 없다. 평범한 자연 UTC 이동은 같은 capability에서 입력을 유지한다.

같은 UTC의 정지 source 제어는 동일 display JSON 알림으로 관찰할 수 없다.
따라서 workspace_nodes.beginFuturePassControl()은 제어 진입에서 epoch를
철회하고 pending depth를 증가시키며 idempotent release를 반환한다. 대기 중
capture/verify는 거부하며 release가 오래된 token을 되살리지 않는다.
workspace_orbit은 이 begin callback을 기존 실제 controller의 optional 관찰
포트에 주입한다. createOrbitSelection의 추가 optional onControl은 select의
pending 진입부터 실제 state adopt/실패 통지 후 finally까지 유지한다.
createSimWorkspace의 observers.control은 command 진입부터 bootstrap 반영과
busy=false/changed 처리 후까지 유지한다. createWorkspaceScenario의 optional
onControl은 기존 sourceApi 및 beginTick/endTick의 실제 runtime command와
refreshRuntime 검증 전체를 감싼다. HTTP 응답의 finally에서 너무 일찍 해제하여
controller 반영 전 오래된 정지 상태가 새 입력으로 캡처되는 틈을 만들지 않는다.
새 요청·계산·wire schema·clock/runtime 상태를 추가하지 않는다. GET 조회와
자연 telemetry는 제어 진입이 아니다. catalog는 기존 실제 control/continuity
이벤트도 유지한다. source 비교는 UTC를 제외한 실제 display context 전체이다.
기존 scenario injectFault와 dataManagementRequest의 명령 scope도 보수적으로
철회한다. 후자는 UTC 변경을 주장하는 경계가 아닌 기존 명령의 입력 보호이다.

외부 readClock/readStations/readiness/continuity callbacks는 재진입할 수 있다.
이 포트는 실제 owner의 현재 사본이나 등록 증명을 반환하는 관찰 함수이다.
허용된 제어·구성 변경은 기존 owner의 control/display/config/store/continuity
철회 이벤트를 발행해야 한다. 다른 owner의 비공개 상태를 통지 없이 바꾸는
getter는 이 계약에 포함되지 않는다. 서로를 몰래 변경하는 getter 전체를
유한한 반복 조회로 검증할 수 있다고 주장하지 않는다. 실제 owner 이벤트를
통한 terminal 재진입과 변경된 반환 mode/readiness/source/lease를 검증한다.
호출 전후 실제 상태/epoch/전체 정의·receipt·station·display source를 확인하며
최종 owner proof 뒤에는 내부 identity fence만 둔다. 오래된 값이 등록됐다는
이유만으로 현재 권한을 추정하지 않는다. missionInputs와 기존 임무 승인
DTO, fabric/배치 전송·해제, GP/UTC/SIM 상태는 변경하지 않는다.

N017f RED는 실제 store와 배치 어댑터를 사용해 full240/선택 지상국,
copy/fake/dirty/server mismatched/unknown/loading/busy/error, 같은UTC pause/seek,
callback 철회/clear/dispose와 정지 임무 경계 보존을 확인한다. 독립 설계 분석
후 구현하고 전체 Node/Python 검증을 기록한다. N017g geometry-only native 조회,
N017h 원본 갱신/표시와 실제 두 해상도/GPU 수용은 별도 후속 작업이다.

조립 RED에는 같은 UTC stored seek/pause가 verification 사이에 완료된 경우,
SIM/scenario 직접 제어, pending 중 새 capture, nested pending, 실패/동기throw/
늦은 release/dispose와 실제 원본 API payload/요청 수 보존을 포함한다.
