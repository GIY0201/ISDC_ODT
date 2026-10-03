# Implementation Plan: V6 첫 위성 및 가상 지점 연결

2026-10-01 설계, 2026-10-03 상태 갱신. 기존 feature 001-v6-function-integration 유지.
상태: 첫 구현 묶음 실행·설치·계측 수행. 합의된 수치/구조 설계는 유지하며 SC-006 성능 미달은 T032 후속으로 남긴다. validation/t030_review.md 및 workflow-progress.md가 현재 제품 증거다. 아래 Phase0 연구 성능은 제품 UI 성능을 대신하지 않는다.

## Summary
독립 ISDC ODT의 확정 V6 공용 지구와 위성/지상 작업 창에 저장된 ISS 자료, UTC 조작, 위치, 고도각 및 가시 구간을 연결한다. 첫 기능을 완성한 뒤 선배 통신/임무/분석/내보내기/MOCK-HIL/SIM 기능을 단계별 검토해 확장한다. 원래 목적과 AeroDT 계층 규칙을 유지한다.

## Technical Context
JavaScript ES modules/HTML/CSS 및 CesiumJS1.143 기존 기준선, Python3.14/기존 FastAPI API, Rust sgp4 2.4.0(WGS72/AFSPC) 전파와 PyO3 0.29.2/maturin1.15.0 연결을 첫 로컬 구현안으로 한다. Python 좌표/고도각은 Astropy8.0.1/pyerfa2.0.1.5/numpy2.5.3 및 고정 IERS snapshot을 사용한다. satellite.js 기존 경로는 기존 기능 회귀용으로 보존하며 첫 기능의 주 계산 또는 fallback으로 사용하지 않는다. TS/React/Vite는 보류한다.

확장17/Rust연결9/회귀35 시험 및 coordinate_probe_results.md를 근거로 한다. 연구 wheel은 제품 패키지 자체가 아니다. Windows CPython3.14용 설치 산출물을 별도로 빌드하고 외부 DLL 출처/라이선스 및 지원 범위를 확인한다. 다른PC 배포는 별도 검증 전 지원 완료로 주장하지 않는다.

원본 궤도 입력과 EOP는 data가 읽고 immutable 입력을 전달한다. data/workspace는 설치/조회/실행 생성물이며 HTTP static mount 대상이 아니다. 재현 기준 자료 manifest와 공개 fixture는 project_support/tests/fixtures/orbit 아래의 작은 시험 자료로 관리한다. 대용량 원본/EOP snapshot은 workspace에 보관하고 manifest의 hash 검증을 요구한다. Python import 시 네트워크/서버/시계 시작 금지.

## Constitution Check
독립 실행: AeroDT 설치/개인 절대경로 실행 의존성 없음. 단일 상태: runtime owns current selection/time. 기존 API/계산 보존: 새 /api/orbit prefix, 기존 SIM/WS 경로 회귀. V6: 원본 snapshot hash/업무창 역할 보존. 검증: 제품 시험을 먼저 작성하고 연구 시험을 제품 통과 증거로 대체하지 않음. 구조와 동작 변경을 단계별 분리. 공개 계약 ADR 작성. 미래 빈 계층/bus/모호한 manager 없음. 사후 문서 점검도 동일 원칙 통과; 실제 코드 적합성은 구현 후 확인.

## Phase 0 outcome
공식 위치fixture 차이1.33cm, Rust→Python 변환 위치차이6.78e-6m, 고도각차이1.89e-11도, 경계차이0.018초. 하루 탐색/경계보정 p95 약103ms(연구도구). UTC-JD 전파 규약, 고정 EOP/윤초, 범위 밖 거절, 극값 보완/접점 분리가 설계 입력이다. 공유ERFA/극값 가정 한계는 유지한다. 실제ISS 위치/실통신/게임UI 달성 증거 아님. 연구의 부분 미실행 기록은 최종 결과 문서를 기준으로 갱신한다.

## File placement and dependency
| 파일 | 책임 |
|---|---|
| foundation/orbit_time.py | UTC 파싱, 정밀 jd1/jd2, SI 재생시간→UTC→SGP4 UTC-JD 변환. 상태 없음 |
| digital_twin/contracts/orbit.py | immutable 입력/결과 및 계산 호출 계약. Python 웹/native 형식 없음 |
| digital_twin/simulation/orbit_propagation/Cargo.toml, src/lib.rs | 실제 Rust SGP4 전파 및 소유 버퍼/행별 오류. build target은 project_support 아래 |
| communication/native/orbit_adapter.py | native 호출/메모리/오류를 typed 계약에 맞춤. runtime에서 구체 adapter import 금지 |
| digital_twin/simulation/orbit_geometry.py, visibility.py | 주어진 TEME/EOP/지점의 위치/ENU 고도각 및 경계 탐색. HTTP/파일/runtime 수정 없음 |
| data/orbit_inputs.py, earth_orientation.py | 원문/manifest/hash 검증과 immutable 입력 조회. 실행 네트워크 자동갱신 없음 |
| digital_twin/runtime/orbit.py, state.py | 현재 선택/UTC/revision의 소유. 기존 RuntimeState의 구성 요소로 배치, 두 번째 StateStore 금지 |
| communication/http/orbit.py, orbit_schemas.py | wire 입력/출력 검증 및 주입된 typed runtime/query 호출 |
| communication/browser/api.js | 새 HTTP 호출과 요청 토큰/AbortSignal 전달. 기존 API 유지 |
| user_application/web/application.py | data/native/계산/runtime/http 조립, 제한된 executor 주입 |
| user_application/configs/orbit.py | snapshot 위치, 조회 상한, 계산 worker와 EOP 정책 등 운용 구성 |
| user_application/web/index.html, styles/workspace.css, scripts/workspace.js | V6 업무공간, 작업 창과 공용 지구 수명 관리 |
| user_application/web/scripts/tabs/orbit.js, ground_visibility.js | 입력 흐름, 처리/오류/이전결과 표시와 수치 패널 |
| digital_twin/visualization/globe.js | 주입된 지구고정 좌표/선택시각 표시. 계산라이브러리/runtime 직접참조 새로 추가하지 않음 |
| project_support/docs/adr/*, tests/*, tooling/* | 계약결정, 제품시험, 빌드/검증도구 |

새 폴더는 해당 파일 구현 시만 생성한다. Rust 코드를 AeroDT의 C++ 경로에 복제하지 않는다. 향후 AeroDT 연결은 typed 계약과 native/protocol adapter 경계로 검토한다.

## State and response flow
application이 immutable 입력 공급과 계산함수를 주입한다. runtime의 orbit 구성 요소가 input_id/관측점/임계값/UTC/재생 여부·속도/revision을 소유한다. 기존 SIM elapsed_seconds와 orbit UTC는 서로 바꾸지 않는다. 계산 입력은 snapshot, 계산 결과는 사본이다. 브라우저 store는 표시와 창 위치, provisional UTC와 요청토큰만 가지며 권위 있는 현재상태로 쓰지 않는다.

선택 변경은 expected_revision 비교 후 갱신하고 충돌은409로 돌려준다. browser client_request_id와 server revision/input hash를 결과에 함께 넣는다. 오래된 결과는 최신 선택을 덮어쓰지 않는다. 입력 시 UI 피드백은 즉시, 위치는 해당 result UTC와 함께 표시해 새 선택 시각에 이전 위치를 정상값처럼 붙이지 않는다.

재생은 runtime UTC anchor와 단조 증가 시간으로 진행, 브라우저는 timestamped snapshot의 표시 투영만 한다. 근거리 위치 batch를 미리 받아 프레임마다 새 HTTP 계산을 하지 않는다. 위치 보간은 수치 기준 시험을 통과한 간격/속도 범위에만 허용하고 자료가 없으면 처리중 표시. 선택값이 같으면 자료 hash/EOP hash/profile/UTC도 같아 재현된다. 한 Cesium Viewer를 작업 창 사이에서 재생성하지 않는다.

## Input and visibility policies
첫 검토 기본값: 제주 가상33.4996N/126.5312E/WGS84 타원체0m, 최소10도, 저장 ISS epoch부터24시간. 실제 시설/해발 높이로 주장하지 않는다. 사용자 조절 가능. 자료 age는 선택UTC와epoch 차이로 표시하고 임의 폐기기간을 사실로 만들지 않는다. 유효EOP범위밖은 오류, 운영 중 silent extrapolation/UTC=UT1/합성위치 fallback 없음.

TLE 또는 OMM의 실제 원문과 형식defaults/epoch/확보시각/hash를 보존한다. 같은시각조회 TLE/OMM을 같은요소라고 단정하지 않음. 제품 Rust OMM 입력과 row error 계약은 별도 시험 후 적용한다.

24h 기본 상한, position batch 최대3601행, 동시 계산 worker2/대기2는 첫 로컬 운용 제안이며 configs에 둔다. 초과는 명시적 오류, 임의 잘라 성공반환 금지. 하루 가시 탐색 내부 샘플은 wire 행수 상한과 별개. 과부하503, cancellation은 대기/후속batch 작업중단과 늦은응답폐기를 검증하며 실행중 native 호출 즉시중단을 보장하지 않는다.

1초 조밀 탐색 + 매끄러운 고립 극값 bracket 보정으로 짧은 구간을 보완하고 접점을 별도 반환한다. bisection bracket<=0.01초. 일반함수 완전탐지 보장 없음, 지원 첫ISS/24h/임계값범위 내 수치oracle/극값/범위경계 시험을 완료 게이트로 둔다. touch를 양의 시간 구간으로 합치지 않는다. 시작/끝 잘림, 없음, 부분/전체실패를 구분한다. 굴절/지형/안테나/RF 조건 미포함.

## Validation and delivery gates
SC001~006: 출처/UTC재현, 위치10m/고도각0.01도/경계1초, 오류와 없음/잘림, 창유지/두해상도, 예측/가상/기하표시, 프레임p95<=16.7ms/피드백50ms/시간결과100ms/하루1초/늦은덮어쓰기0. 연구시간은 서버·UI 시간을 대체하지 않는다. 공식crate33입력668상태 시험도 유지한다. readonly snapshot/행별오류/OMM/TLE/wheel설치/자료범위/윤초/short-pass/공유kernel외부fixture, regression 및 실제브라우저 측정을 각각 기록한다.

단계1 저장입력과 계산API, 단계2 V6에서 위치/UTC, 단계3 지점/가시구간, 단계4 작업창과게임UX 검증. 각 단계 제품시험 완료 후 다음 단위로 진행한다. 후속 통신은 F001의 공식서비스/장비/링크조건 조사·적용과 함께 진행, 나머지기능순서는 F002 공동검토. 실제HIL/실측/영구replay F004, 실제위치F005, 다른PC·배포범위F006은 미완료로 추적한다.

## Phase 1 artifacts
[data-model.md](data-model.md), [contracts/orbit_api.md](contracts/orbit_api.md), [contracts/workspace.md](contracts/workspace.md), [quickstart.md](quickstart.md), architecture/technology_selection.md 갱신. 다음 tasks를 이 계획에 연결하고 analyze는 tasks 작성 뒤 read-only로 수행한다. 리뷰 종료 전 제품소스 변경 없음.

### T020 계산 경계 보완
visibility.py는 immutable OrbitCalculation 반환 함수를 주입받고 VisibilityResult를 반환한다. query별 자료 identity/오류 검증과 1초 SI grid/극값/경계 보정을 맡고 runtime/API/파일을 호출하지 않는다. 내부 typed VisibilityInterval/Contact/Error/Result는 contracts/orbit.py에 둔다. 첫/마지막cell 보완과 접점 수치 허용치/부분 실패 한계는 ADR0003 및 validation/t020_visibility.md를 따른다. API/UI와 성능 목표는 후속이다.

## 전체 설계와의 관계 및 V6 보존 보완
전체 요청 범위는 full_integration_plan.md의W00~W09와V6전영역표를기준으로한다. 이 plan은W01/W02와W00의첫상세계획이다. 전체요청의절반/전체구현설계완료라고표현하지않는다.
V6 별도창 기능을 first workspace 보존 범위에 포함한다. Viewer는문서당1개이며별도브라우저문서는별도Viewer를가질수있다. 같은origin의선택/입력전달과runtime snapshot동기화,동시편집revision충돌표시를T031에서검증한다. 원래문서의Viewer를다시만들지않는다. W03~W08은전체계획에근거/책임/완료게이트를기록했지만파일수준상세계약은각묶음전검토에서확장한다.

### T015 구현 경로 보완
기존 콘솔을 보존하기 위해 V6 입력/응답 수명은 scripts/orbit_selection.js, 패널은 scripts/workspace_orbit.js에 둔다. state.js/tabs/orbit.js는 기존 콘솔 책임을 유지한다. API와 서버 runtime 계약은 변경하지 않는다.

### T016 구현 경로 보완
legacy globe.js/tabs/orbit.js는 보존한다. 새 GP 위치 렌더러는 digital_twin/visualization/orbit_globe.js, 서버 snapshot 검증과 문서당 Viewer 조립은 user_application/web/scripts/workspace_globe.js로 연결했다. 표시 사본만 가지며 UTC 재생과 지점/가시성은 후속 T017~T023이다. 상세 검증은 validation/t016_globe.md에 기록했다.

### T018 구현 경계 보완
orbit_playback.js/ orbit_utc.js/ workspace_playback.js가 서버 UTC snapshot의 표시 투영 및 제한된 버퍼를 맡는다. 1초/601행/300초 전 refill, 5초 state 동기화 및 고정 윤초 hash codec를 사용한다. HTTP/계산/runtime 소유권은 변경하지 않는다. ADR0002 및 validation/t018_playback.md를 근거로 하고 게임 성능/가시 구간은 후속이다.

### T023 구현 경로 보완
지점 및 visibility 표시사본은 scripts/tabs/ground_visibility.js에 둔다. 설정은 기존 orbit_selection.js, wire 조회는 communication/browser/api.js를 사용한다. 단일Viewer 지점표시는 orbit_globe.js/workspace_globe.js이며 legacy 합성 globe.js를 보존한다. 계산/API 의미 변경 없음. query와 위치버퍼 수명은 분리하고 같은 서버 revision/입력/자료/지점을 검증한다. validation/t023_ground_visibility.md 참조.

## W03-A 편집 가능한 RF 계산기 상세 계획
2026-10-03 사용자 A 선택. FR009/SC007, R002/R003/R004/R007. T032 프레임 항목은 독립 후속으로 보류한다. RF 상세 계약은 contracts/rf_workspace.md를 따른다.
- 기술: 기존 JS/Python/FastAPI 및 RF-Friis-v1 그대로. 새 Rust/라이브러리/API/default 변경 없음. legacy 보존.
- Phase0: rf_workspace_review.md 및 독립 읽기 전용 연구에서 모든11입력/정확한 범위/반올림전status/HTTP422/시나리오contacts 위험 확인. A 범위의 미결 설계값 없음. 실제 서비스 입력은 F001 후속으로 명시적 분리.
- Phase1: RF draft/응답 모델은 data-model.md, 기존 HTTP와UI 수명은 contracts/rf_workspace.md, 실행 검증은 quickstart.md에 추가. 서버 권위상태를 새 저장소에 복제하지 않는다.
- 경계: user_application/web/scripts/tabs/rf_link_budget.js의 입력 검증/읽기 전용 query controller/패널, workspace_orbit.js의 조립, communication/browser/api.js의 RF 전용 오류 해석과 abort 신호. 기존 simulation/API/schema는 수정하지 않는다.
- UI: V6 ground에 독립 패널, 시작값은 모두 빈칸. 링크 이름과10개수치 전부 편집. 단위/요청 입력/모델 분류/가정을 표시하며 실제통신미확인/거리직접입력 의미 유지. 생성 문자열은 escape, 오류/status는textContent. 새로운 Viewer 없음.
- 검증: JS controller/transport/window 보존 및 Python 기존endpoint 수치/경계/상태불변. RED 후 구현, 전체pytest/Node, 실제브라우저1280/1920 정상/오류/창입력보존. 이번 묶음은 프레임성능이나 실제RF수신 완료 게이트가 아니다.
- Constitution check: 독립 계층/단일상태/V6/기존계산 보존/검증 원칙5개 충돌 없음. 체크리스트8/8 유지. 기존모델의3dB는물리적상수로오인하지않고출처미확인판정기준이라고표시한다.
