# T193 전체 카탈로그 장면 시간 연결 계약

상태: ADR0064에 따른 구현 전 계약 제안. 독립 검토와 회귀시험 후에만 구현한다.

## 범위와 기존 포트

`user_application/web/scripts/workspace_orbit.js`에서 기존 시간원천을 `catalog_scene.js::observe(utc)`에 연결한다. 위치의 최종 소유자는 기존 Rust native 전체 장면 계산과 검증된 표시 snapshot이다. 새 시계, UTC 저장소, timer/RAF, GP 계산 또는 API를 만들지 않는다.

기존 후보 포트는 `catalog_timeline.js`의 실제 UTC callback, `workspace_playback.js`의 기존 `showFrame(snapshot,row,utc,error)` callback 및 실제 scenario follow의 검증된 `bindScenarioRuntime/displayProjection` UTC다. 저장 원천은 `orbit_selection.js`가 실제로 수락한 server selection state와 기존 `projectUtc()` 투영을 사용한다. 저장 위치 row나 지상국 관측 결과를 전체 장면 시간원천의 필수조건으로 만들지 않는다. scenario는 기존 current run/sequence/receipt 및 stale guard를 통과해야 한다. 선택 catalogue는 기존 같은-group follow 정책을 보존한다.

원본 `OrbitClock`의 선택 독립 live 진행을 현재 selected/observer601 경로와 혼동하지 않는다. `/api/catalog/scene`에는 관측소나 선택 위성 필드가 없다. 원본 독립 wall-current live 정책을 완전히 복원할지는 별도 미해결 결정이며, 이 연결만으로 원본 전체 기능 완료를 선언하지 않는다.

## 원천 선택과 초기 요청

- 기존 명시 follow/선택 또는 실제 서버가 수락하여 복원한 저장 원천만 사용할 수 있다. 우선순위는 실제 SIM/scenario follow, 같은-group의 유효한 선택 catalogue follow, 명시 follow가 없을 때 실제 선택된 저장 서버 cursor다. 첫 GP, 첫 관측소, 임의 runtime을 자동 선정하거나 원래 source 선택 상태를 변경하지 않는다.
- 유효한 원천이 있으면 초기 전체 ON 요청 UTC는 그 원천에서 읽은 canonical UTC다. 원천이 paused이면 전체 장면도 정지한다. 이미 playing이면 기존 callback의 진행 UTC를 받아 갱신한다.
- 원천이 없으면 기존 panel의 `requestUtc()` 초안으로 한 번 snapshot을 계산하고 진행 시간원천 미준비를 표시한다. wall UTC나 playing을 합성하지 않는다.
- ON/OFF는 server play/seek/start/reset, 위성/관측소 선택, 배치 변경을 실행하지 않는다. 재생·정지·배속·현재시각 이동은 기존 위성 화면의 명시 제어에 남긴다. 벽면에는 3D/2D와 ON/OFF 외의 새 입력 폼을 추가하지 않는다.

## 분리된 identity와 full native 검증

연결은 시간원천 identity와 scene cohort identity를 별도로 확인한다. stored input/hash/revision, scenario run/sequence 및 catalogue 선택 source identity를 장면 GP identity로 승격하지 않는다. scene의 `group/query/orbit/scene_sha256` 및 응답 EOP/LEAP/frame/profile/units/count/full rows 검증을 그대로 유지한다. 기존 `client_request_id`, 요청 UTC와 응답 UTC 일치, 전체 normalized GP hash, 중복 ID, 실패 행 및 hash409 충돌 처리는 변하지 않는다. 시간원천 EOP/hash로 장면의 EOP/hash를 대체하지 않는다.

이 표시는 GP/native 모델 위치이며 실제 원격측정·통신·RF·명령 승인 증거가 아니다. 과거 cursor의 1× 재생을 실제 현재시각으로 부르지 않는다. 기존 source/analysis UTC와 snapshot UTC 표시를 유지한다.

## 수명, 제어와 취소

전체 활성화 scope는 원천과 scene context를 묶되 자체 UTC 이력을 소유하지 않는다. 현재 입력/revision/run, 실제 follow, pending/control depth, error/stale 및 owner disposal을 원래 소유자 계약으로 검사한다. 원천 또는 scene 변경/실패 시 scope를 영구 취소한다. 같은 UTC/identity 문자열로 복귀해도 old callback/lease는 수락하지 않는다. 활성 상태에서 새 실제 owner 수락 또는 명시 제어 settlement가 끝나면 fresh scope로 재준비할 수 있다.

외부 owner 조회/callback 전후에 실제 source currentness와 scene scope를 확인하고 최종 callback 이후 내부 active/generation/dead guard를 검사한다. query/proof DI는 관측 포트이며 알림 없는 임의 상호 owner mutation을 보장한다고 주장하지 않는다. 실제 제어/원천 events의 재진입과 바뀐 반환값은 반드시 failclosed로 처리한다.

OFF/clear/destroy는 연결 구독을 해제하고 scene의 기존 취소 경로로 진행/예약 요청을 무효화한다. server state나 저장 입력은 보존한다. scene의 기존 최소 1000ms 요청 시작 간격, single-flight, 최신 desired UTC coalescing 및 큰 full-row 준비 yield를 유지한다. 프레임마다 query/cancel을 반복하지 않는다. 늦은 HTTP 응답은 기존 generation/provenance guard를 통과할 수 없다.

scene 실패/GP hash409 충돌은 terminal로 취급한다. natural tick이나 원천 회복 알림만으로 자동 재조회하지 않으며 기존 사용자 조회/전체 ON 명시 재시도 후에만 다시 준비한다.

다른 기기의 stored paused→play 발견은 기존 paused-skip 5초 GET 관측 조건을 수정하는 아래 구현 필수 조건에 포함된다. UI 초안 BroadcastChannel이나 postMessage만으로 다중 기기 authoritative 시간 동기화를 선언하지 않는다.

## 표시와 제어 포트의 구현 필수 조건

현재 `workspace_globe.js` scenario paint와 replica renderSnapshot의 scene 억제를 그대로 두고 UTC만 연결하는 구현은 불완전하다. 기존 scene owner가 full native 검증을 마친 snapshot과 요청시 캡처한 실제 시간원천 scope를 묶은 등록된 읽기 전용 표시 포트를 제공한다. 외국 객체/사본은 권한이 아니며 기존 snapshot/epoch 외에 새 상태 이력이나 시간을 저장하지 않는다. natural progress 동안의 마지막 수락 위치는 native analysis UTC와 live display UTC를 분리하여 표시한다. paused source에는 exact UTC를 요구하고 stale/control/input/run/revision/source 변경에는 즉시 폐기한다. source UTC를 위치에 재태깅하지 않는다.

globe scenario paint 및 replica는 이 포트의 현재 owner proof를 callback 전후/최종 경계에서 검증한 scene만 소비한다. SIM display identity/GMST/engineering quality는 기존 계약으로 유지하고 scene의 ITRF/EOP/hash는 독립 native 분석 증거다. generic scene은 기존 scenario 억제를 유지하며 원천 없는 자료를 허용하지 않는다.

`nodes/clock_controls.js`에 optional 현재 binding source resolver를 조립하여 기존 satellite 시간 제어가 `scene:` 표시 중에도 실제 원천에 위임할 수 있게 한다. resolver는 등록된 실제 owner proof를 확인하고 기존 stored/catalog/scenario commands만 사용한다. scene identity를 원천으로 바꾸거나 unknown running을 합성하지 않는다. callback/control-entry/settlement reentry와 late proof는 failclosed다. 옵션 없는 기존 호출자 동작을 보존한다.

기존 5초 GET의 paused-skip 때문에 다른 기기가 원격 play를 발견하지 못하는 흐름은 T192/T193의 구현 필수 회귀다. 기존 조회 생명주기의 bounded server-state 관측으로 해소하며 busy/revision/dirty draft 및 hidden/destroy 정리를 유지한다. 이 조건을 미해결 설명으로만 남기거나 UI channel로 해결됐다고 주장하지 않는다.

## 구현 전 RED와 수락 증거

실제 owner 조립 시험으로 다음을 먼저 실패시킨 뒤 구현한다.

1. station/selected catalogue 없이 준비된 stored cursor의 초기 및 진행 UTC가 전체 scene query에 전달된다. 전체 GP cohort와 표시 개수는 보존되고 추가 server command는 없다.
2. paused, speed, seek/control entry, revision/source/run 변경, stale/error 및 disposed 상태에서 이전 연결이 취소된다. fresh 수락 이후의 새 연결만 재개된다. 같은UTC/늦은 callback으로 부활하지 않는다.
3. 원천 없는 fresh ON은 기존 draft의 한 번 snapshot만 생성한다. OFF/destroy 뒤 예약/진행/늦은 요청이 새 위치를 표시하지 못한다.
4. 기존 fullhash/count/partial/failed-row/409 검증, catalogue same-group follow와 observer601 샘플 경로, scenario/mission/action 승인 guard 및 public copy 계약이 보존된다.
5. 실제 scenario 원천의 registered native scene이 primary/replica 양쪽에서 표시되고 generic/foreign scene은 계속 거부된다. scene-key satellite controls는 optional actual-source resolver가 있을 때만 실제 owner 명령으로 위임한다. 원격 paused→play는 기존 server GET을 통해 수락되고 초안/서버 명령을 추가하지 않는다.

두 실제 화면에서 변화하는 위치·UTC·원천 표시와 정지/재개를 확인해야 한다. 조립 시험은 GPU/FPS 또는 실측 통신의 성공 증거가 아니다. 원본 독립 live 정책과 whole-goal 수락은 계속 열린 상태다.
