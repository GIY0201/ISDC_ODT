# Tasks: V6 첫 위성 및 가상 지점 연결

입력: 같은 feature의 spec/plan/data-model/contracts/quickstart/research. 2026-10-01 실행 목록. 현재 T001~T013 입력/계산/runtime 및 첫 Orbit API 구현 완료, 나머지 task 미완료. 저장소 규칙과 명세에 따라 제품 시험을 먼저 작성하고 실패를 확인한 뒤 구현한다. 연구도구의 PASS를 아래 checkbox 완료로 옮기지 않는다.

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
- [ ] T014 [US1] user_application/web/index.html, styles/workspace.css, scripts/workspace.js에 채택 V6의 공용지구/역할 목록/작업창 구조를 이식한다. 원본 snapshot 해시를 기록하고 기존 기능을 삭제하지 않는다. 계산 변경은 이 task에 넣지 않는다.
- [ ] T015 [US1] user_application/web/scripts/state.js 및 tabs/orbit.js에 저장입력선택/출처/epoch/age/UTC와 pending·error·stale 결과 흐름을 구현한다. 선택변경명령 직렬화, client_request_id/revision/hash 비교. 권위상태를 browser에 새로 만들지 않는다.
- [ ] T016 [US1] digital_twin/visualization/globe.js와 tabs/orbit.js에 ITRF m/표시UTC 주입과 단일Viewer 수명 관리를 연결한다. 기존 synthetic fallback 경로는 새 기능 결과로 사용하지 않는다.
- [ ] T017 [P] [US1] project_support/tests/browser/orbit_playback.test.mjs와 project_support/tests/test_orbit_interpolation.py에 정지/재생/복귀와 sample 중간시각 보간10m/고도각0.01도 게이트를 먼저 작성한다. 자료밖/버퍼없음 처리도 확인한다.
- [ ] T018 [US1] user_application/web/scripts/orbit_playback.js에 UTC snapshot anchor 기반 표시 투영과 허용범위 batch prefetch/보간을 구현한다. 매frame API호출금지. T017 후 US1을 실제브라우저로 시연한다.

## Phase 4: US2 지점과 가시 구간 (P1)
목표: 가상지점/높이/최소각과 지정범위의 모든 지원 구간, 접점, 잘림/없음을 확인.
독립검증: UI 없이 visibility API와 고정oracle로 고도각0.01도/경계1초, UI에서10도변경과 통신미확인 표시. US1과 공통계약은 재사용.
- [ ] T019 [P] [US2] project_support/tests/test_visibility.py에 1초dense 기준, 짧은pass/gap/접점/잘림/없음/부분실패/임계값범위 및 경계1초 시험을 먼저 작성한다. 극값 탐색 가정과 한계를 명시한다.
- [ ] T020 [US2] digital_twin/simulation/visibility.py에 조밀탐색/극값보완/경계보정/접점분리와 query 상태/provenance를 구현하여 T019를 통과시킨다. 처음3개 제한 및 기존45초5도 경로를 새 계산에 쓰지 않는다.
- [ ] T021 [P] [US2] project_support/tests/test_visibility_api.py에 /api/orbit/visibility 범위/설정/revision 검증, 전체/없음/실패/통신unknown 계약을 먼저 작성한다.
- [ ] T022 [US2] communication/http/orbit.py와 orbit_schemas.py에 visibility 계약을 구현하여 T021을 통과시킨다. start/end/peak/clipped/contacts/자료hash 포함.
- [ ] T023 [US2] user_application/web/scripts/tabs/ground_visibility.js와 digital_twin/visualization/globe.js에 지점/타원체높이/가상/고도각/구간 UI를 연결하고 통신미확인과 결과시각을 표시한다. 단일globe 유지. US2 실제시연.

## Phase 5: US3 작업 창과 응답 유지 (P2)
목표: 지구/창 조작 중 입력·결과가 유지되고 오래된 응답이 새 선택을 덮어쓰지 않음.
독립검증: 1280x720/1920x1080 최소화/복원·지구조작 후 위성/지점/시각 유지. 오류·처리중에도 조작가능.
- [ ] T024 [P] [US3] project_support/tests/browser/workspace.test.mjs에 geometry clamp/최소화/복원/선택보존/구독해제/Viewer1개 시험을 먼저 작성한다.
- [ ] T025 [US3] user_application/web/scripts/workspace.js, state.js 및 styles/workspace.css에 창이동/크기/최소화/복원과 입력보존을 완성하여 T024를 통과시킨다.
- [ ] T026 [P] [US3] project_support/tests/browser/orbit_requests.test.mjs와 project_support/tests/test_orbit_concurrency.py에 역순응답/동시선택409/큐가득503/취소/렌더자원실패 시험을 먼저 작성한다.
- [ ] T027 [US3] communication/browser/api.js, user_application/web/scripts/tabs/orbit.js 및 application.py에 취소/과부하/후속chunk중단/늦은응답폐기/렌더실패 안내를 완성해 T026을 통과시킨다. 실행중 native call 즉시중단을 주장하지 않는다.

- [ ] T031 [US3] project_support/tests/browser/workspace_popout.test.mjs에 V6별도창의 현재업무·입력전달/수정동기화/409충돌/팝업차단/닫기·channel해제/문서당Viewer1개 시험을 먼저 작성하고 user_application/web/scripts/workspace.js에 구현한다. T025,T027 뒤, T028 이전.

## Phase 6: 제품 검증과 기록
- [ ] T028 project_support/tests/validation/orbit_workspace.md 및 tooling/measure_orbit_ui.mjs에서 두해상도의 실제브라우저/frame/input/result/24h 계측과 역순덮어쓰기0을 검증한다. p95/p99/max,환경/GPU/전원/자료hash/trace/screenshot을 data/workspace/validation에 기록하고 전체pytest/Node/native시험 실행.
- [ ] T029 project_support/tooling/build_orbit_wheel.ps1 및 tests/test_orbit_install.py로 제품wheel 격리venv 설치/호출, 외부DLL출처와license, cp314지원범위를 확인한다. 미검증다른PC를지원완료로표시하지않는다.
- [ ] T030 project_support/specs/001-v6-function-integration/workflow-progress.md와 data/development_log/CURRENT.md,HISTORY.jsonl에 요구별 제품증거/실패/후속필수를 연결하고 공동검토용 결과를 보고한다. F001실제통신과 F002후속기능순서를 닫지 않는다.

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


