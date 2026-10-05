# Tasks: V6 첫 위성 및 가상 지점 연결

입력: 같은 feature의 spec/plan/data-model/contracts/quickstart/research. 현재 T001~T027 및 T031 완료(시험 준비 task 포함), T026 실패는 T027에서 해소, T028~T030 미완료. PR 리뷰/병합은 별도다. 저장소 규칙과 명세에 따라 제품 시험을 먼저 작성하고 실패를 확인한 뒤 구현한다. 연구도구의 PASS를 아래 checkbox 완료로 옮기지 않는다.

## Phase 1: 준비
- [x] T001 V6 원본 해시, 기존 API/WS/화면 기준과 새로운 공개 계약 및 상태 분리 결정을 project_support/docs/adr/0001_orbit_workspace.md에 기록하고 data/development_log/CURRENT.md에 기준선 명령을 남긴다. R001/R002/R010.
- [x] T002 기존 Python/FastAPI 버전 receipt 및 새 계산 의존성을 requirements.txt와 project_support/tooling/build_orbit_wheel.ps1에서 고정하고 buildtarget/venv를 project_support 아래에 둔다. 실험 환경은 보존한다. R008.

## Phase 2: 공통 입력 및 계산 경계
- [x] T003 project_support/tests/test_orbit_inputs.py와 test_orbit_time.py에 TLE/OMM/hash/defaults/UTC-JD/윤초/손상 및 EOP범위밖 거절 회귀시험을 먼저 작성한다. R005/R007.
- [x] T004 foundation/orbit_time.py, digital_twin/contracts/orbit.py, data/orbit_inputs.py, data/earth_orientation.py와 user_application/configs/orbit.py에 immutable 입력과 UTC/좌표단위/자료범위 계약을 구현한다. T003 뒤.
- [x] T005 digital_twin/simulation/orbit_propagation/tests/propagation.rs와 project_support/tests/test_orbit_native.py에 공식33입력668상태, OMM/TLE 일치조건, 행별오류/소유버퍼/잘못된입력 시험을 먼저 작성한다. 기존 fixture 출처/hash를 project_support/tests/fixtures/orbit/manifest.json에 기록한다.
- [x] T006 digital_twin/simulation/orbit_propagation/Cargo.toml 및 src/lib.rs, communication/native/orbit_adapter.py에 Rust SGP4 WGS72/AFSPC와 Python typed 경계를 구현하고 T005를 통과시킨다. probe를 runtime import하지 않는다.
- [x] T007 project_support/tests/test_orbit_geometry.py에 공개 Vallado fixture, WGS84 지점/높이, TEME→ITRF→ENU, 위/지평선/아래와 고도각0.01도 시험을 먼저 작성한다. 속도 공개시 회전항/LOD도 명시한다.
- [x] T008 digital_twin/simulation/orbit_geometry.py에 주입된 EOP를 사용한 batch 변환/고도각을 구현하고 T007을 통과시킨다. 파일/네트워크/runtime 수정 없음.
- [x] T009 project_support/tests/test_orbit_runtime.py에 단일 선택/UTC 소유, 기존SIM시각과 분리, revision충돌, snapshot수정불가, 재생/정지와 bounded계산 시험을 먼저 작성한다.
- [x] T010 digital_twin/runtime/orbit.py 및 state.py, user_application/web/application.py에 입력/계산/adapter 주입과 단일orbit상태, 비동기 실행 경계를 조립하여 T009를 통과시킨다. 기존SIM API/WS는 변경하지 않는다.

Checkpoint: T001~010 완료 후 입력/계산 API 기반을 독립적으로 확인. 새 layer 폴더는 실제 파일 구현 때만 생성.

## Phase 3: US1 위성 위치와 UTC (P1)
목표: 출처 있는 저장ISS를 열고 UTC를 이동/정지/재생하며 공용지구와 수치의 시각이 맞는다.
독립검증: 같은UTC복귀 결과재현, 손상자료오류, TLE/OMM, 입력출처 표시 및 위치10m. 작은 첫 시연은 이 단계까지.
- [x] T011 [P] [US1] project_support/tests/test_orbit_api.py에 inputs/state/selection/samples, UTC누락/좌표/상한/404/409 및 자료출처 시험을 먼저 작성한다.
- [x] T012 [US1] project_support/tests/fixtures/orbit/manifest.json과 user_application/configs/orbit.py에 실제ISS 저장입력/EOP 확보 절차와 가상제주/10도/24h 기본값을 선언하고 출처/hash를 검증한다. 원본 생성물은 data/workspace/inputs/orbit에 저장한다.
- [x] T013 [US1] communication/http/orbit.py, orbit_schemas.py 및 communication/browser/api.js에 /api/orbit/inputs,state,selection,samples 계약을 구현하여 T011을 통과시킨다. 기존 endpoint 회귀 유지.
- [x] T014 [US1] user_application/web/index.html, styles/workspace.css, scripts/workspace.js에 채택 V6의 공용지구/역할 목록/작업창 구조를 이식한다. 원본 snapshot 해시를 기록하고 기존 기능을 삭제하지 않는다. 계산 변경은 이 task에 넣지 않는다.
- [x] T015 [US1] user_application/web/scripts/orbit_selection.js 및 workspace_orbit.js에 저장입력선택/출처/epoch/age/UTC와 pending·error·stale 결과 흐름을 구현한다. 선택변경명령 직렬화, client_request_id/revision/hash 비교. 권위상태를 browser에 새로 만들지 않는다.
- [x] T016 [US1] digital_twin/visualization/orbit_globe.js와 user_application/web/scripts/workspace_globe.js 및 workspace_orbit.js에 ITRF m/표시UTC 주입과 단일Viewer 수명 관리를 연결한다. 기존 globe.js/tabs/orbit.js는 legacy 합성 경로를 보존하므로 새 GP 표시는 전용 모듈에 둔다. synthetic fallback 사용 없음. 검증: validation/t016_globe.md.
- [x] T017 [P] [US1] project_support/tests/browser/orbit_playback.test.mjs와 project_support/tests/test_orbit_interpolation.py에 정지/재생/복귀와 sample 중간시각 보간10m/고도각0.01도 게이트를 먼저 작성했다. 자료밖/버퍼없음/오류/과도한 간격도 포함한다. Python 수치 게이트 PASS, 시험 준비 당시 T018 모듈 누락 RED를 확인했고, T018 구현 후 실제 assertion PASS로 재검증했다. validation/t017_playback_gate.md 참조.
- [x] T018 [US1] user_application/web/scripts/orbit_playback.js, orbit_utc.js 및 workspace_playback.js에 UTC snapshot anchor 기반 표시 투영과 1초 batch prefetch/보간을 구현했다. 매frame API 호출 없음. T017 시험 및 실제 브라우저 재생/정지/UTC 복귀/60배 버퍼 전환/범위 밖 오류를 확인했다. validation/t018_playback.md 참조.

## Phase 4: US2 지점과 가시 구간 (P1)
목표: 가상지점/높이/최소각과 지정범위의 모든 지원 구간, 접점, 잘림/없음을 확인.
독립검증: UI 없이 visibility API와 고정oracle로 고도각0.01도/경계1초, UI에서10도변경과 통신미확인 표시. US1과 공통계약은 재사용.
- [x] T019 [P] [US2] project_support/tests/test_visibility.py에 35개 수용 시험과 1초dense 기준을 작성했다. 짧은pass/gap/접점/잘림/없음/부분실패/임계값범위/경계1초/윤초/자료계약을 포함한다. 기준 준비1 PASS, T020 모듈 누락34 ERROR의 RED 확인. 시험 준비 완료이며 계산 기능 완료가 아니다. 극값 가정/한계와 결과는 validation/t019_visibility_tests.md 참조.
- [x] T020 [US2] digital_twin/simulation/visibility.py에 1초 조밀탐색/극값·조회edge 보완/경계보정/접점분리와 상태/provenance를 구현했다. T019 및 추가 회귀38개 PASS, 전체 Python160 PASS/Node31 PASS. 처음3개 제한 및 기존45초5도 경로는 새 계산에 쓰지 않았다. validation/t020_visibility.md 참조. API/UI/성능은 후속이다.
- [x] T021 [P] [US2] project_support/tests/test_visibility_api.py에 /api/orbit/visibility 범위/설정/revision 및 정상/없음/부분·전체실패/통신unknown 계약42개 시험을 작성했다. 당시selection 준비1 PASS/41 FAIL(미구현405 40개/도우미오류1개), T022에서 도우미를 수정한 뒤42 PASS로 실제 재검증했다. validation/t021_visibility_api_tests.md와 validation/t022_visibility_api.md 참조.
- [x] T022 [US2] communication/http/orbit.py와 orbit_schemas.py, runtime/orbit.py에 visibility 조회를 연결했다. start/end/peak/clipped/contacts/자료hash와 immutable query context를 반환한다. API42 PASS, 전체Python202 PASS/Node31 PASS 및 실제TCP HTTP구간1개/409/선택UTC보존 확인. validation/t022_visibility_api.md 참조. 화면은T023이다.
- [x] T023 [US2] scripts/tabs/ground_visibility.js와 실제GP용 orbit_globe.js/workspace_globe.js에 지점/타원체높이/가상/임계값/조회범위/모든구간·접점·없음·오류를 연결했다. legacy globe.js 보존, 단일Viewer/서버소유설정/늦은응답폐기. Node40 PASS/Python202 PASS, 실제IAB24h4구간/설정·잘림·없음·오류·취소·두해상도 확인. validation/t023_ground_visibility.md 참조. 게임성능/실제통신 미완료.

## Phase 5: US3 작업 창과 응답 유지 (P2)
목표: 지구/창 조작 중 입력·결과가 유지되고 오래된 응답이 새 선택을 덮어쓰지 않음.
독립검증: 1280x720/1920x1080 최소화/복원·지구조작 후 위성/지점/시각 유지. 오류·처리중에도 조작가능.
- [x] T024 [P] [US3] project_support/tests/browser/workspace.test.mjs에 geometry clamp/최소화/복원/선택보존/구독해제/Viewer1개 시험10개 작성. 5 PASS/5 FAIL, 전체Node45 PASS/5 FAIL/Python202 PASS. 실제IAB 최소화 중 해상도 축소 후 복원 경계 이탈 확인. 시험 준비이며 제품 수정 완료가 아니다. validation/t024_workspace_tests.md 참조.
- [x] T025 [US3] workspace.js에서 크기·위치 clamp/복원 재검증 및 최종pagehide channel/gesture 정리를 구현. 기존state.js/legacy/CSS 보존. 작업창10 PASS/전체Node50 PASS/Python202 PASS, 실제IAB 두해상도 일반축소/최소화복원/확장복원 및 입력·결과/canvas1 확인. validation/t025_workspace.md 참조.
- [x] T026 [P] [US3] orbit_requests.test.mjs 및 test_orbit_concurrency.py에 역순응답/동시선택409/실제큐포화503/취소/렌더실패 시험 추가. 초기Node5 PASS/3 FAIL 및 조립종료1 FAIL 확인 후 T027에서 해소. Python새5 PASS. validation/t026_t027_requests.md 참조.
- [x] T027 [US3] V6 orbit_selection.js/workspace_orbit.js/workspace_globe.js에서 취소상태 정리/문서종료 요청폐기/후속prefetch중단/focus 렌더실패 안내를 보완. 기존API transport/application.py/legacy 보존. Node61 PASS/Python207 PASS, 실제IAB계산/지구이동/재생·정지/epoch복귀 확인. 실행중native/visibility job 강제중단 보장 없음. validation/t026_t027_requests.md 참조.

- [x] T031 [US3] project_support/tests/browser/workspace_popout.test.mjs에 V6별도창의 현재업무·입력전달/수정동기화/409충돌/팝업차단/닫기·channel해제/문서당Viewer1개 시험을 먼저 작성하고 user_application/web/scripts/workspace.js에 구현한다. T025,T027 뒤, T028 이전. Node74/Python207 PASS 및 실제 Chrome 부모·자식 편집/충돌/선택/종료 검증. validation/t031_popout.md 참조.

## Phase 6: 제품 검증과 기록
- [x] T028 project_support/tests/validation/orbit_workspace.md 및 tooling/measure_orbit_ui.mjs에서 두해상도 실제브라우저/frame/input/result/24h 계측과 역순덮어쓰기 시험을 수행했다. p95/p99/max,환경/GPU/전원/자료hash/trace/screenshot을 보존하고 전체Python224/Node77/native1 PASS. 계측 작업 완료이며 **SC-006 FAIL**이다. 3회 개선 후 하루p95 2.27/2.20초, frame/피드백 대리지표 미달을 T032로 남긴다. validation/t028_performance.md 참조.
- [x] T029 제품wheel을 새venv에 오프라인설치하고 프로젝트밖 -I native호출, 외부DLL hash/출처/LICENSE 및cp314-win_amd64 태그를 확인했다. 초기LICENSE누락/잘못된PATH DLL을 수정한 뒤2 PASS. validation/t029_install.md 참조. 다른PC/ABI/OS/실제AeroDT 연결 미검증.
- [x] T030 workflow-progress.md/CURRENT.md/HISTORY.jsonl과 validation/t030_review.md에 FR/SC/R별 실제증거 및 SC006실패/후속을 연결했다. F001실제통신/F002전체기능 및 다른PC·실측 후속을 닫지 않았다. 현재31개 수행 기록이며 수용기준 전체통과나 전체제품완료가 아니다.

## Dependencies
T001→T002. 공통시험 T003/T005/T007/T009는 설계문서준비 후 작성 가능하나 각각 구현 T004/T006/T008/T010 이전 실패 확인. T004+T006+T008→T010. 공통완료→US1(T011~018)→첫시연→US2(T019~023)→US3(T024~027,T031)→T028~030. UI구조 T014는 계산식변경과 분리.
US2계산/API는공통입력만으로독립시험가능, 실제UI시연은US1 공용지구가필요. US3는완성선택흐름을사용한다. userstory독립시험과기반재사용을혼동하지않음.

## Parallel examples
US1: T011 API시험 파일과 T017 playback/interpolation시험 파일은 서로 다른 파일이므로 병렬작성가능. US2: T019 계산시험과 T021 API시험 병렬작성가능. US3: T024 창시험과 T026 race/동시성시험 병렬작성가능. 실제공유파일편집은순차진행. [P]는작업가능성이지자동agent사용지시가아니다.

## Implementation strategy
먼저US1의출처/UTC/위치흐름만시연하고검증결과로다음단위를진행한다. 그다음US2,US3로첫기능을완성하고T028전체게임UX검증을한다. 연구성과로기존UI전체를한번에교체하지않는다. 실제통신/임무/분석/MOCK-HIL/SIM은현재checkbox밖의필수후속검토다. 배포/게시/GitHub issue생성은이번목록범위아님.

전체범위와단계관계는 full_integration_plan.md 참조. 이목록은전체제품의완료율분모가아니다. 새T031은기존ID를바꾸지않고V6원본보존공백을보완한다. US3 총5개, 전체31개.

## Requirement coverage
R001:T001,T004,T010,T029. R002:T014,T016,T024,T025,T031. R003:T030(후속기능,이번단계완료아님). R004:T018,T023,T030. R005:T003~023. R006:T023,T030(표시및F001유지,실제통신구현후속). R007:T003,T005,T007,T011,T017,T019,T021,T026,T028,T029. R008:T002,T006,T008,T029. R009:T018,T024~028. R010:T001,T030.

## Phase 7: Convergence

- [ ] T032 user_application/orbit_calculation.py와 digital_twin/simulation/visibility.py의 실제 병목을 profile로 확인하고 1초dense/극값/경계/윤초/오류·provenance 정확도를 유지한 채 하루결과p95≤1000ms를 달성한다. user_application/web/scripts/orbit_ui_measurement.js 및 project_support/tooling/measure_orbit_ui.mjs에서 실제전경60Hz이상 GPU프레임제출/입력Event Timing 또는 동등한 표시증거를 보완하고, 두해상도30초완료trial3회/다른UTC100회/다른24h범위20회로 frame p95≤16.7ms/피드백≤50ms/UTC완료≤100ms 및역순덮어쓰기0을 재검증한다. 중단trial·최댓값·실패·환경/trace/hash를 보존하며 T028의미달을 PASS로재분류하지않는다. 검증보고서와전체회귀를갱신한다 per SC-006,FR-006,plan: Validation and delivery gates (partial). HIGH; F001실통신/F002전체기능은 별도후속으로유지한다.

T032 2026-10-03 부분 수행: 최종 하루 p95543.1/547.3ms와 UTC32.0/32.1ms는통과, 실제presentation18.578/18.552ms는미달. 두해상도30초완료3trial/다른UTC100회/다른24h20회 및GPU/관측EventTiming/최댓값·실패원문보존. 최종Python242/Node82/native1/actualTCP PASS. validation/t032_performance.md. 남은frame16.7ms/60Hz표시전제 때문에checkbox유지하며전체제품완료로처리하지않는다.

추가 승인 후 계산 없는 RAF/Canvas 대조군에서도 약18ms로 미달을 확인했다. 제품 소스/환경 설정/목표 변경 없음, round3 미사용. 진단 도구와 실패 기록, 전체 Python242/Node82 재검증을 보고서에 추가했으며 실제 표시 경로 확인 및 재측정은 남는다.

## Phase 8: W03-A RF 계산기 (US2 확장)
- [x] T033 [P] [US2] project_support/tests/test_rf_link_budget_api.py와 project_support/tests/browser/rf_link_budget.test.mjs에 기존POST 수치/반올림전status/모든필드경계/상태불변 및11입력/늦은응답/변경/잘못된응답 시험을 작성한다. JS 새모듈 미존재 RED 확인. FR009/SC007.
- [x] T034 [US2] user_application/web/scripts/tabs/rf_link_budget.js에 빈초기입력, contracts/rf_workspace.md의필수11개/정확한범위/유한성, 입력echo와8유한결과/model/status/가정검증,사본/generation/abort controller를구현하고 communication/browser/api.js의RF422필드별오류와signal을검증한다. 기존wire/default/계산식보존.
- [x] T035 [US2] user_application/web/scripts/workspace_orbit.js와tabs/rf_link_budget.js 및styles/workspace.css에 RF패널을조립한다. 모든입력편집/8출력단위/요청입력/가정/실제통신미확인,창복원/화면재구성/별도창draft와종료를 project_support/tests/browser/workspace_rf.test.mjs에서검증한다. 기존GP/UTC/Viewer와legacy보존.
- [x] T036 project_support/specs/001-v6-function-integration/validation/t036_rf_workspace.md에 전체Python/Node/실제웹두해상도/정상·실패·입력보존 증거를기록하고 workflow-progress.md 및data/development_log를갱신한다. FR009/SC007 완료와F001/T032미완료를구분하고별도PR로리뷰한다.

W03-A 의존성: T033→T034→T035→T036. T033의Python/Node시험은별도파일병렬가능. 기존T032는사용자승인으로deferred이며A의선행게이트가아니다. 승인범위는이번4개task이며F001/F002및W03전체완료가아니다.

## W03-B / User Story 2 — ISS APRS 공식 부분 조건 (P1)
독립 기준: 공식 공지 주파수만 적용, 나머지는 가정/unknown, 실제 통신 미확인 및 GP 보존. 기존 완료 작업 보존.
- [x] T037 [US2] 프로파일 변환/손상/읽기 불변 및 비동기 출처 회귀 RED를 project_support/tests/test_iss_receive_profile.py와 project_support/tests/browser/rf_receive_profile.test.mjs에 추가한다.
- [x] T038 [US2] schema_version=1 / communication_status=unknown / equipment_status=not_selected / known_inputs 주파수만 계약을 digital_twin/model_library/packages/iss_aprs_receive_v1와 rf_receive_profile.py, digital_twin/contracts/queries.py, communication/http/rf_network.py, user_application/web/application.py에 구현하고 project_support/docs/adr/0007_iss_receive_profile.md에 기록한다.
- [x] T039 [US2] communication/browser/api.js와 user_application/web/scripts/tabs/rf_receive_profile.js 및 rf_link_budget.js에 명시 조회/주파수만 적용/원산지 표시/같은 값 무효화/창 유지 구현, project_support/tests/browser/workspace_rf_profile.test.mjs로 검증한다.
- [x] T040 전체 pytest/Node, 실제 두해상도 UI, 기존 RF AST/GP 불변, Git 소스 배포에 모델 JSON 포함 확인 후 validation/t040_iss_receive_profile.md 및 data/development_log/CURRENT.md/HISTORY.jsonl을 기록하고 Draft PR 리뷰로 게시한다.
의존성 T036→T037→T038→T039→T040. Python/JS RED와 공식 근거 검토는 다른 파일에서 병렬 가능, 제품 조립은 순차. MVP는 공식 주파수 부분 연결이며 장비 선정/운용 확인/도플러/복조/실제 수신은 F001 후속.

## W03-C / US2 시나리오 통신 경로·접촉 계획
- [x] T041 [US2] project_support/tests/test_communication_planning_api.py와project_support/tests/browser/communication_planning.test.mjs에 기존경로수치/장애제외/접촉provenance/상태불변 및UI역순/오류/경계 RED시험 추가.
- [x] T042 [US2] user_application/web/scripts/tabs/communication_planning.js controller와communication/browser/api.js optional signal구현. source/target는조회graph ID,objective latency/reliability/balanced,hours정수1~72. 기존server계산/schema보존.
- [x] T043 [US2] user_application/web/scripts/workspace_orbit.js와workspace.js 및styles/workspace.css에 실제panel/입력/결과/시나리오의미/창·원격보존을조립하고project_support/tests/browser/workspace_communication_planning.test.mjs 검증.
- [x] T044 validation/t044_communication_planning.md에전체Python/Node/실제두해상도8891/AST/GP·RF불변 및한계를기록하고 workflow-progress.md/data/development_log를갱신후stacked Draft PR 리뷰.
의존성T040→T041→T042→T043→T044. 서로독립Python/Node시험과읽기전용자료검토는병렬가능. MVP는기존시나리오2기능UI연결,현재ISS통신가능/예약/HIL로표현하지않는다.

## W03-D / US1 저장 ISS 거리·도플러
- [x] T045 [US1] project_support/tests/test_orbit_radio.py와tests/browser/orbit_radio.test.mjs에 analytic/기존원본식/속도oracle/미분/실패/readonly/stale/transport/controller RED시험 작성.
- [x] T046 [US1] digital_twin/simulation/orbit_radio.py, contracts/orbit.py, user_application/orbit_calculation.py 및runtime/orbit.py에 순수기하/typed조회/기존 bounded 실행 연결. samples/visibility 변경없음.
- [x] T047 [US1] communication/http/orbit_schemas.py와orbit.py 및browser/api.js에 신규radio-geometry계약 추가, ADR0008/compatibility/422/503 검증.
- [x] T048 [US1] user_application/web/scripts/tabs/orbit_radio.js를workspace_orbit.js/workspace.js/index.html에조립하고 browser/workspace_orbit_radio.test.mjs에 실제assembly RED→복원/원격/GP·RF보존시험.
- [x] T049 전체Python/Node/독립속도·원본대조/실제8891두해상도/정상·오류·출처/자신의서버재시작/로그를 validation/t049_orbit_radio.md에기록하고 stacked Draft PR 리뷰.
의존성T044→T045→T046→T047→T048→T049. 초기단일시점모델계산이며F001전체/F002/T032보류미완료유지.

## W03-E / US1 가시 구간 거리·도플러 변화
- [x] T050 [US1] project_support/tests/test_orbit_radio_series.py와tests/browser/orbit_radio_series.test.mjs에 batch/scalar/native1회/구간/윤초/실패/stale/graph/controller RED시험 작성.
- [x] T051 [US1] user_application/orbit_calculation.py와digital_twin/contracts/orbit.py/runtime/orbit.py/simulation/orbit_radio.py에 immutable series/601 bound/strict shared row validation/기존계산 batch 재사용 구현.
- [x] T052 [US1] communication/http/orbit_schemas.py/orbit.py/browser/api.js와docs/adr/0009_orbit_radio_series.md에 신규strict endpoint/compatibility 구현.
- [x] T053 [US1] user_application/web/scripts/tabs/orbit_radio_series.js와ground_visibility.js/workspace_orbit.js 및digital_twin/visualization/orbit_radio_series.js에 interval선택/3그래프/표본요약/출처/gap/취소 조립, tests/browser/workspace_orbit_radio_series.test.mjs RED→PASS검증.
- [x] T054 validation/t054_orbit_radio_series.md에전체pytest/Node/실제8891두해상도/정상·오류·보존·readonlyreview 증거 기록, workflow-progress.md 및data/development_log 갱신/PR17 위Draft PR리뷰.
의존성T049→T050→T051→T052→T053→T054. Python/Node시험과읽기전용research는다른파일병렬가능. 승인MVP는이5task,전체F001/F002/T032보류보존.


## W04 / US6 임무 관리 (FR-014/SC-012)
- [x] T055 [US6] project_support/tests/test_mission_workspace.py와 project_support/tests/browser/mission_workspace.test.mjs에 기존 서버 의미/실패/사본 및 새 UI 컨트롤러 RED 회귀를 작성한다.
- [x] T056 [US6] user_application/web/scripts/tabs/mission_workspace.js에서 기존 API 호출과 서버 사본/편집/검증/미리보기/적용을 연결한다. T055 뒤 수행.
- [x] T057 [US6] user_application/web/scripts/workspace_orbit.js와 workspace.js에 V6 show/destroy/초안 복원을 조립하고 project_support/tests/browser/workspace_mission.test.mjs에서 두해상도/복원/입력보존을 검증한다. T056 뒤 수행.
- [x] T058 전체 Python/Node와 실제 8891 두해상도 화면을 확인하고 validation/t058_mission_workspace.md, data/development_log/CURRENT.md 및 HISTORY.jsonl에 기록한다. 기존 API/계산 보존과 Draft PR 리뷰. T057 뒤 수행.
의존성: T055 → T056 → T057 → T058. 기존 T032 보류 유지. 새 스택과 병렬 파일 수정을 도입하지 않는다. US6 독립 시험은 기존 SIM 임무/편집/검증/재계획 흐름이며 전체 기능 완료가 아니다.

## W05 / US7 기존 SIM 제어와 텔레메트리 (FR-015/SC-013)
- [x] T059 기존 서버 의미와 새 SIM controller RED 회귀를 test_sim_workspace.py/browser/sim_workspace.test.mjs에 작성한다.
- [x] T060 tabs/sim_workspace.js에 기존 API/직렬 명령/스트림 사본/지연·역순/정리를 연결한다.
- [x] T061 workspace_orbit/workspace/mission_workspace에 패널/원격 초안/읽기 전용 임무 갱신을 조립하고 두해상도 assembly 검증한다.
- [x] T062 전체 Python/Node/실제 8891 두해상도 및 원본 보존 확인, validation/t062_sim_workspace.md/ledger/dev log 갱신과 PR19 위 Draft 리뷰. 자동 병합 없음.

## W06 / US8 기존 KPI/내보내기 (FR-016/SC-014)
- [x] T063 [US8] project_support/tests/test_kpi_workspace.py 및 browser/kpi_workspace.test.mjs/kpi_report_api.test.mjs/workspace_kpi.test.mjs에 원본기준/파일/컨트롤러·조립 RED 작성.
- [x] T064 [US8] communication/browser/api.js 원본 report bytes adapter와 tabs/kpi_workspace.js의 서버사본/필터·상세/세션이력·재생/JSONfreeze/CSVpreview/검증·정리 구현. T063 뒤.
- [x] T065 [US8] tabs/sim_workspace.js optional observer로 기존 stream을공유하고 workspace_orbit/workspace에 panel/draft/dispose 조립, 기존 drawMultiLine 재사용. T064 뒤.
- [x] T066 전체Python/Node/실제8891두해상도/다운로드동일값·원본보존 확인, validation/t066_kpi_workspace.md/ledger/dev logs/전체plan 갱신과 PR20 위 Draft 리뷰. T065 뒤. 기존 T032/F001/F002 보류 유지.

## W07 / US9 MOCK-HIL (FR-017/SC-015)
- [x] T067 [US9] project_support/tests/test_hil_workspace.py and browser/hil_workspace.test.mjs/hil_api.test.mjs/workspace_hil.test.mjs golden/RED tests.
- [x] T068 [US9] communication/browser/api.js optional signals, tabs/hil_workspace.js controller/panel and visualization/hil_topology.js existing geometry; server calls and semantic evidence only. T067 first.
- [x] T069 [US9] workspace_orbit/workspace/sim_workspace fanout/show/draft/dispose and browser fixture two resolutions shared stream/retention. T068 first.
- [x] T070 whole Python/Node/actual8891 two resolutions success/failure/readonly preservation, validation/t070_hil_workspace.md/ledger/dev logs/full plan and PR21 stacked Draft. T069 first.
Dependency T066→T067→T068→T069→T070. No new agents or parallel edits; independent read/test may batch. F001/F002/F004~6/T032/W06 disk save unknown preserved.

## US10 Catalog (FR-018/SC-016)
- [x] T071 [US10] tests/test_catalog_workspace.py와 browser/catalog_workspace.test.mjs에 기존 필터/캐시/상세 및 late/error/unknown RED 회귀 작성.
- [x] T072 [US10] communication/browser/api.js optional signals와 tabs/catalog_workspace.js의 읽기 전용 controller/panel 구현. T071 뒤.
- [x] T073 [US10] workspace_orbit/workspace 및 browser fixture에 show/dispose/초안/단일Viewer 보존 조립. T072 뒤.
- [x] T074 [US10] 전체Python/Node/실제8891두해상도/원본보존, validation/t074_catalog_workspace.md/ledger/dev log와 PR22 위 Draft 리뷰. T073 뒤.
Dependency T070→T071→T072→T073→T074. W08/F001/F002/F004~6/T032/W06 저장완료 미확인 보존.

## Phase 9: Convergence — 전체 선배 기능 대조 (2026-10-05)

- [ ] T075 [HIGH] source/epoch/계산가능범위·카탈로그모델과저장GP상태를분리한계약부터작성하고 기존전파/지상국/카메라 표시를 단일Viewer에 단계별 연결·회귀검증 — FR-008, FR-018; plan: US10/W01/W02 (partial; C001). 근거: legacy_function_audit.md.
- [ ] T076 [HIGH] 기존노드정의/검증/배치/프리셋과Kepler+J2 모델을 재사용하고 UI설정과runtime 권위상태 소유권을 명시해 scene/composer에 연결·회귀검증 — FR-008; plan: W01/W08 satellite/scene/composer (missing; C002). 근거: legacy_function_audit.md.
- [ ] T077 [HIGH] 기존네트워크snapshot/OISL/지상국설정과ICD-02 계산을 재사용해 통신 화면에 연결; 현재 RF와별개로 모의/unknown/경로·장애·단위 회귀검증 — FR-008; plan: W03 (partial; C003). 근거: legacy_function_audit.md.
- [ ] T078 [HIGH] 기존 missionStore와planner/ICD-03 계획·확정/일정표를 재사용하고 현재 단순임무API와구분해 mission/normal에 연결; 실패·재편성·규칙기반 결과 회귀검증 — FR-008, FR-014; plan: W04 (partial; C004). 근거: legacy_function_audit.md.
- [ ] T079 [HIGH] 기존ICD-01 임시구현/계약/외부adapter와카탈로그·복제·무결성·복구·정책·서비스를 재사용하여 data에 연결; KPIexport와구분/미확인·실패·사본·읽기불변 회귀검증 — FR-008, FR-016; plan: W06/W08 data (partial; C005). 근거: legacy_function_audit.md.
- [ ] T080 [HIGH] 기존보안관측·규칙판정·상태·이력을 ICD-08 어댑터와함께 security에 연결; 실제보안관제/인증구현과구분하고 판정/전환/미확인 회귀검증 — FR-008; plan: W08 security (missing; C006). 근거: legacy_function_audit.md.
- [ ] T081 [HIGH] 기존PoC정의/runner/공유SIM시계/단계동작/KPI결과를 재사용하여 run/composer/compare에 연결; C002~6후의존성/명시실행/중복명령·복원·GPUTC분리 회귀검증 — FR-008, FR-015; plan: W05/W08 run/composer/compare (partial; C007). 근거: legacy_function_audit.md.
- [ ] T082 [HIGH] 기존확인된source/selected IDs/SIM상태/임무/통신/데이터 결과를 주입하는 화면간계약을작성하고 예시와실값을구분해 공유맥락·인계·실패·원격초안·Viewer1 검증; source없는시설모델은발명하지않음 — FR-008; plan: W08 all V6 screens (partial; C009). 근거: legacy_function_audit.md.
- [ ] T083 [MEDIUM] 기존모듈설정/ICD목록/probe를 communication외부경계에가두어 설정흐름에 연결; TCPconnect/UDP주소해석/내장생존 의미구분, 임의엔드포인트자동probe없이명시조회·오류 회귀검증 — FR-008; plan: W08/W09 settings (missing; C008). 근거: legacy_function_audit.md.
- [ ] T084 [MEDIUM] 기존CSV/JSON다운로드를 실제브라우저에서 끝까지 확인하고 저장한파일bytes/단위/출처를 서버응답과대조; 완료확인불가면미확인유지 — SC-014; T066/plan: W06 (partial; C010). 근거: legacy_function_audit.md.

위 목록은 구현 완료가 아닌 확인된 gap이다. 기존T001~T074 및 보류T032를 고치거나 다시번호붙이지않는다. 각묶음은 원본golden→상세계약/spec/plan/tasks→V6조립→전체회귀/실제두해상도→Draft리뷰로 세분화 후 진행한다. 추천 첫범위 T075 위성카탈로그↔공용지구, 이어 T076 위성노드. T077은노드/지상국계약,T078은노드/통신,T079는배치/데이터모듈,T080은보안계약,T081은이들모듈후,T082는완료기능부터순차,T083·T084는독립가능. 새구현은이번대조작업에서시작하지않는다.

## US11 / T075 첫 묶음: selected catalog position
- [x] T085 원본OMM bytes/기존Rustgolden 및IERS-Aquality/APIreadonly/late controller RED 회귀를 tests/test_catalog_position.py와 browser/catalog_geometry.test.mjs에작성.
- [x] T086 data/orbit_inputs bytes parser, earth_orientation explicitA/quality, data/catalog/geometry_snapshot.py 및 tooling/prepare_catalog_geometry.py/configs/catalog_geometry.py에별도hash고정 준비.
- [x] T087 contracts/catalog_geometry.py/user_application/catalog_geometry.py/http/catalog_geometry.py/application.py/browserapi 및ADR0010로bounded readonly Rustquery연결.
- [x] T088 browser/catalog_geometry.js/catalog_workspace/workspace_orbit/workspace_globe/orbit_globe에선택hook/단일Viewer/표시해제/latefence 조립, 실제assembly시험.
- [x] T089 전체Python/Node/실제8891두해상도/원본계산·storedGP불변과validation/t089_catalog_position.md/ledger/log/DraftPR리뷰.
Dependency T085→T086→T087→T088→T089. T075partial유지;원본전체범위/재생/지상국목록/모델/성능T032보존. 새agent없음.

## US12 / T075 ground station list and selection
- [x] T090 [US12] Add RED sourcegolden/selection/renderer/canvas ownership and real assembly tests in project_support/tests/browser/station_workspace.test.mjs and station_globe.test.mjs; original fixture project_support/tests/fixtures/original_station_sites.json.
- [x] T091 [US12] Extract used original preset data and sites/groups in digital_twin/model_library/browser/station_presets.js and ground_station_sites.js; reuse card helpers user_application/web/scripts/orbit/station_card.js, static mount application.py and ADR0011.
- [x] T092 [US12] Implement presentation selection/list/detail in user_application/web/scripts/tabs/station_workspace.js with no runtime commands; source metadata disclosure and null/error ownership.
- [x] T093 [US12] Inject shared station display/select/focus callbacks through workspace_orbit.js/workspace_globe.js to digital_twin/visualization/orbit_globe.js; add one pick handler and stable29 markers; keep satellite and virtual point.
- [x] T094 [US12] Complete full Python/Node and actual8891 two-resolution selection/click/clear/restore/readonly checks; validation/t094_ground_stations.md, audit/ledger/logs and stacked Draft review abovePR25.
Dependency T090→91→92→93→94; T075 remains partial for catalogue playback/multi-satellite/3D-sun and dynamic station geometry. T032/F001/F002/F004–6/W06disk unknown preserved.

## US13 station observer input
- [x] T095 [US13] Add RED explicit station draft and real assembly acceptance in project_support/tests/browser/station_observer.test.mjs; preserve height/range/state and busy/error boundaries.
- [x] T096 [US13] Add validated stageStation in user_application/web/scripts/tabs/ground_visibility.js; retain height/range and invalidate old queries, reuse existing apply/run.
- [x] T097 [US13] Add explicit use button in tabs/station_workspace.js and workspace_orbit.js role handoff; explain saved GP/catalog distinction, no auto apply.
- [x] T098 [US13] Run full Python/Node, real8891 two-resolution apply/visibility/radio/restore checks; validation/t098_station_observer.md, audit/ledger/log and stacked Draft PR.
Dependency T095→96→97→98. T075 remains partial for catalog live geometry/playback/multiple/3D. Other F001/F002/F004–6/T032/W06disk gaps unchanged.

## US14 catalog time observation
- [x] T099 [US14] Add RED native/readonly/hashpin/leap/partial/error/schema tests in project_support/tests/test_catalog_samples.py and geometry boundaries in test_catalog_observation.py.
- [x] T100 [US14] Implement additive CatalogGeometryQuery.samples, strict HTTP request, ENU observation helper and communication/browser/api.js adapter; ADR0013, retain position API semantics.
- [x] T101 [US14] Add tested catalog-time local UTC/playback/observer draft controller in user_application/web/scripts/catalog_timeline.js and catalog time controls using existing codec/samplebuffer; late/hash/height/clock errors.
- [x] T102 [US14] Connect selected catalog observer/display time to shared globe and existing station selection in workspace_orbit/workspace_globe; preserve stored/SIM/Viewer and render errors.
- [x] T103 [US14] Full Python/Node and actual8891twores/epoch equality/replay/observer/errors/restore/readonly; validation/t103_catalog_time.md, audit/ledger/log and Draft PR27base.
Dependency T099→100→101→102→103. T075 remains open until remaining original multi/3D/sun also connected. Goal T075–T084 unchanged.


## US15 whole-group precise display (T075)
- [x] T104 [US15] Add RED many-orbit Rust/export/adapter and full-scene tests in digital_twin/simulation/orbit_propagation/tests/catalog.rs, project_support/tests/test_catalog_scene.py and browser/catalog_scene.test.mjs; scalarofficial33/668/full16633/alignment/hash/readonly.
- [x] T105 [US15] Implement propagate_omm_many with aligned finite offsets and max50000 percall/rowfailure in digital_twin/simulation/orbit_propagation/src/lib.rs, retain oldexports and build+cleaninstall product0.2.0 via project_support/tooling/build_orbit_wheel.ps1.
- [x] T106 [US15] Add immutable preparedcatalog/epochhash cache, many-orbit adapter and sharedUTC/EOP transform in user_application/catalog_geometry.py, communication/native/orbit_adapter.py and digital_twin/simulation/orbit_geometry.py; wholegroup limit0/chunk50000/no truncation. Evidence: validation/t107_catalog_scene_api.md.
- [x] T107 [US15] Add strict sceneHTTP/API contract in communication/http/catalog_geometry.py and communication/browser/api.js, ADR0014/profile/hash/errors/units/source/failurecounts/readonly. Evidence: validation/t107_catalog_scene_api.md.
- [x] T108 [US15] Add full scene controller/panel and sharedselection handoff in user_application/web/scripts/catalog_scene.js, tabs/catalog_workspace.js and workspace_orbit.js; latestUTCcoalescing/late/context/clear/ownedcopies/wholecounts.
- [x] T109 [US15] Connect original pointprimitive/color/size/pick/label semantics to singleviewer in digital_twin/visualization/orbit_globe.js and user_application/web/scripts/workspace_globe.js; selectedGPpin/ownUTC/no16kframecopy.
- [x] T110 [US15] Run full Python/Node/native/wheel and actual8891twores/fullactive16633/readonly/filter/pick/restore/error; record cold/warm/HTTP/render in validation/t110_catalog_scene.md, ledger/audit/log and DraftPR28base.
Dependency: T104 native RED→T105; T104 backend RED→T106→T107; T104 browser RED→T108→T109→T110. T104 aggregate RED categories complete; evidence validation/t109_catalog_scene_ui.md. WholeT075 remains open for selectedtrack/pass/sun/modes/imagery/representativeSVG, wholeT075–T084 unchanged.

## US16 selected catalog track and visibility (T075)
- [x] T111 [US16] Add RED originalperiod/densegrid/scalar/rowfailure/GPconflict/visibilityreadonly and HTTP/browser/controller/renderer coverage in project_support/tests/test_catalog_track_passes.py and browser/catalog_track_passes.test.mjs.
- [x] T112 [US16] Implement CatalogGeometryQuery.track/visibility using _input/precise native/VisibilityResult/search_visibility/evaluate_times without runtime mutation; units/quality/identity/count/error verification.
- [x] T113 [US16] Add strict readonly /api/catalog/track and /api/catalog/visibility, browser transport and CatalogGeometryPort; ADR0015/schema compatibility allowlist.
- [x] T114 [US16] Connect selectedGP/time/observer controllers, track controls,24h pass table/timeline/AOSseek, error/clip/contact/source/hash/late/clear/draft and replay renewal in V6.
- [x] T115 [US16] Add injected segmented track polyline to OrbitGlobe, original width3/ArcType.NONE/toggle/no failurebridge/oneViewer; fullcatalog/stations/selection preserved.
- [x] T116 [US16] WholePython/Node/scalar/native evidence/actual8891twores/readonly/pick/passseek/replay/toggle/restore and Draft abovePR29; validation/t116_catalog_track_passes.md/ledger/log/audit.
Dependency111→112→113→114→115→116. OriginalT075 sun/2D3D/imagery/labels/representativeSVG andT076–84 remain open; T032/SC006/F001/F004–6/diskunknown preserved.

## US17 / T075 globe view controls
- [ ] T117 [US17] Add RED source style/mode/provider ordering/failure/disposal tests in project_support/tests/browser/globe_view.test.mjs and application assembly coverage in project_support/tests/browser/workspace_globe_view.test.mjs; FR026/SC023.
- [ ] T118 [US17] Implement injected morph/style/owned imagery lifecycle in digital_twin/visualization/globe_view.js and delegate from digital_twin/visualization/orbit_globe.js; exact enums/defaults and original navigation/style values per contracts/globe_view.md.
- [ ] T119 [US17] Inject provider construction and preboot/late/status handling in user_application/web/scripts/workspace_globe.js; preserve other layers/UTC/state and repaint native catalog palette/labels/track in digital_twin/visualization/orbit_globe.js.
- [ ] T120 [US17] Add accessible choice panel/drafts/dispose in user_application/web/scripts/tabs/globe_view.js and compose in user_application/web/scripts/workspace_orbit.js; retain source errors and state across window restore.
- [ ] T121 [US17] Run full Python/Node/actual8891twores/mode-map-style-fallback-restore/oneViewer/readonly, record project_support/specs/001-v6-function-integration/validation/t121_globe_view.md and publish reviewed Draft abovePR30.
Dependency117 rendererRED->118;117applicationRED->119->120->121. Sixteen prior stories unchanged. Scoped independently testable choices with shared native scene; no delegated edits. T075 GLB/camera/solar and allT076–84 remain tracked, no overall completion claim.
