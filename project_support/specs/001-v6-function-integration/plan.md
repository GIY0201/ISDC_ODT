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

## W03-B ISS 공식 수신 조건 부분 연결
FR010/SC008, US2, R006/R007. 기존 Python/FastAPI/JS와 RF 계산 재사용. Phase0 공식 ARISS 상태/일반 안내 및 역사적 패킷 자료 확인, 읽기 전용 재사용 검토 완료. 장비 미선정은 unknown 조건으로 확정, 상세 계약 contracts/iss_receive_profile.md.
Phase1 실제 사용하는 model_library/packages/iss_aprs_receive_v1의 버전 JSON/manifest와 rf_receive_profile.py loader를 추가한다. TwinQueries로 readonly callback을 주입하며 새 GET을 communication/http에 둔다. 고정 모델 읽기는 요청 시 수행하고 import IO/runtime 복제 없음. JS rf_receive_profile.js가 화면용 출처 사본과 abort/generation을 소유, rf_link_budget.js가 기존 입력/결과 controller와 조립한다. 기존 RF 서버 함수/schema AST 보존.
공식 주파수만 채우며 어떤 장비값도 보충하지 않는다. 새 패키지/API 형식 ADR0007, Python 앱은 소스 checkout으로 실행하며 이 JSON을 소스에 포함한다. 기존 wheel은 Rust 계산 모듈 전용으로 유지한다. source 날짜/확인 UTC/공지 나이 표시, GP epoch와 연결하지 않는다. 창 draft의 provenance는 공식 권위로 전달하지 않는다. 새 Viewer 없음.
Constitution: 독립계층/단일권위상태/실측구분/V6보존/TDD 충돌0. T037→T038→T039→T040. 분석과 RED를 통과한 뒤 구현. 전체pytest/Node 및 실제 두해상도 제품 확인 후 stacked Draft PR. 이 묶음 완료는 F001 전체 완료가 아니다.

## W03-C 선배 시나리오 경로/접촉 계획 V6 연결
FR011/SC009,US2,R002/R003/R004/R007. 기존JS/Python/FastAPI/서버계산/schema 보존. Phase0 재사용 검토: bootstrap.communication의 실제 시나리오 그래프와 route/contacts endpoint를 그대로 호출한다. contact_plan은 벽시계/링크index/quality로 만든 예시 일정이며 hours 안으로 end를 엄밀히 제한하지 않는다. 표시에서 시간 파라미터와 생성 시각/실제기하·수신미확인을 구분하며 임의보정/필터없음. 신규 장비기본값/예시망→ISS 대체없음.
Phase1 contracts/communication_planning.md, data-model/quickstart. user_application/web/scripts/tabs/communication_planning.js의 표시사본/controller와workspace_orbit.js 조립, transport는communication/browser/api.js의기존bootstrap/route/contacts에optionalAbort signal추가(기존인자호환). server/domain는변경하지않는다. API·model format변경없으므로 신규ADR불필요. 노드와link는API사본에서조회하고UI상수로하드코딩하지않는다. 네트워크명시조회→사용자선택→독립route/contacts조회, 입력별무효화, 취소/종료/역순generation. 창보존/원격draft재조회필요.
T041 RED→T042 controller/transport→T043 실제V6조립→T044 전체회귀/실제두해상도/로그/stacked Draft PR. Constitution 독립계층/현재상태단일소유/선배보존/V6/검증5원칙 충돌0.8891 고정, 현재서버변경없으면재시작불필요. 기존T032보류/F001/F002전체미완료유지.

## W03-D 저장 ISS 거리·도플러
동일 JS/Python/Rust stack, native Nx6 속도를 버리지 않고 scalar TEME→ITRF 함수의 속도 인자를 사용한다. 기존 빠른 samples/visibility 실행 경로는 변경하지 않는다. orbit_calculation의 선택적 radio calculator, typed OrbitRadioCalculation/OrbitRadioQueryResult, runtime의 기존 잠금·bounded executor를 재사용한 read-only 조회를 추가한다. wire는 /api/orbit/radio-geometry 단일 UTC/양수 주파수Hz, 기존 endpoint unchanged. ADR0008에 추가 계약과 근사 한계를 기록한다.
선배 optical pointingTo의 range/range_rate 내적식을 Python 순수 계산에 필요한 만큼만 옮긴다. optical LOS100km/포인팅/renderer는 복사하지 않는다. deltaf=-f0*range_rate/c, 양수rate는이탈/음수shift, ITRF지상속도0. LOD0/polar rate무시/lighttime·relativity·media·oscillator무시를표시한다. 모델계산이며수신확인아님.
V6 위성panel은 UTC와MHz draft, 서버UTC 가져오기/명시조회/취소. 기존 공식프로파일 controller를재사용해명시주파수적용, 수동·원격값은가정으로표시. 입력선택/revision/provenance 변경·재조회·편집·취소·종료에세대무효화. 창복원은사본보존. queriedUTC와displayUTC별도이며재생이자동재계산하지않음. Viewer추가없음,8891고정.
T045 RED→T046 geometry/assembly/runtime→T047 wire→T048 V6→T049 전체검증/원본비교/실제두해상도/로그/DraftPR. Constitution5원칙 충돌0,계층추가없음. F001전체/F002/T032보류유지.

## W03-E 구간 radio series 설계
기존 JavaScript/Python/Rust stack과 기존 radio_geometry 식·teme_to_itrf 속도 변환을 유지한다. user_application/orbit_calculation.py에 radio_series batch callable 주입: native propagate_instants 1회, EOP at_many, 기존 변환/순수 상대속도 함수 적용. runtime/orbit.py가 잠금 안에서 selection을 캡처하고 기존 bounded executor 1회 실행, 모든 행을 기존 단일행과 같은 엄격한 검증 후 stale 확인한다. 검증 함수의 공통 추출은 동작 보존 변경이며 회귀시험으로 검증한다.
신규 POST /api/orbit/radio-series: 기존 RadioGeometryRequest의 request/revision/input/frequency 및 start/end UTC. 0<SI duration<=86400초, count=min(601,ceil(duration)+1), 시작/종료 포함 균등 SI 간격. 클라이언트는 기존 가시결과 사본에서 interval 선택, 서버는 해당 범위의 기하 계산만하며 가시 경계를 재확정하지 않는다. 실제수신 unknown. 일부 native 오류는 numeric null 행 보존/partial, 전부 오류 error. graph gaps와 전체 요약 미확인으로 표시한다.
contracts/orbit.py에 immutable series/query typed 계약. communication/http/orbit_schemas.py+orbit.py와communication/browser/api.js의 신규 명시 경로; 기존 wire 보존, ADR0009. user_application/web/scripts/tabs/orbit_radio_series.js controller/panel을 workspace_orbit.js에 조립. ground_visibility.js는 optional onInterval callback으로 실제 조회 결과와 선택행 사본을 전달, 기존 단독 호출 호환. panel은 ground/satellite에서 보이며 raw 가시결과 provenance를 검사, 재조회/편집은 구간 선택과 결과 폐기. 공식 주파수 controller 재사용/직접 MHz 적용. visualization/orbit_radio_series.js는 주입 데이터의 SVG 3개와 표본요약만 표현하며 API/runtime 소유 없음. 그래프 시간축 SI초와 양끝 UTC, 단위별 독립축, 실패행 gaps. 모든 실제값 escape.
단일UTC/series 모두 같은 성능 제한 executor를 사용한다. UI no timers/replay/continuous polling, 최대601 SVG표본. import IO없음/native wheel변경없음/독립계층 지킴. Constitution gate I~V PASS. 검증은 Python batch/scalar equality+native1회/경계/윤초/partial/readonly/stale/기존wire, Node source/UTC/formula/abort/창/원격/graph gaps, 실제8891두해상도. PR17 위 별도stacked Draft 리뷰, 자동병합없음.


## W04 임무 연결 설계
FR-014/SC-012 → R003/R004/R007/R010 → T055~T058. JS/Cesium/Python 기존 환경, 새 의존성 없음. MissionRuntime/HTTP/schema/API 계산은 변경하지 않는다.
user_application/web/scripts/tabs/mission_workspace.js는 주입 API와 화면용 사본/선택/편집 초안/현재 검증/변경 제안을 관리한다. API bootstrap에서 실제 임무 목록을 읽고 기존 missionAction/missionTask/validateMission/replanMission을 호출한다. 요청은 직렬화하고 pending 중 변경·선택을 막는다. 실패는 명시하며 명령을 자동 재시도하지 않는다. 성공 응답과 새로고침은 서버 사본만 반영하고 결과가 다른 임무를 가리키면 거부한다.
V6 workspace_orbit 조립이 임무 panel을 show/destroy/applyDraft한다. mission 보기의 기존 예시 카드를 실제 연결 패널로 대체한다. 입력 초안은 화면 전환/복원에도 보존한다. 별도 창에서 전송된 입력은 초안만 반영하고 명령/검증/적용을 자동 실행하지 않는다. 서버 상태는 runtime 단독 소유; UI는 사본. WS/SIM제어 상세는 W05에서 연결하며 이번 화면에는 서버 새로고침을 제공한다.
Constitution I~V: 기존 계층/명명, 상태 소유권, 계산 보존, V6/SIM 표시, RED→PASS 및 전체 Python/Node/실제 8891 두해상도 게이트 모두 유지. 기존 ignore와 hooks 없음 확인.
검증: test_mission_workspace.py에 기존 API 정상/실패/preview 의미/사본 회귀, browser mission_workspace 및 V6 assembly 시험을 먼저 작성. 최종 전체 시험과 실제 UI, 원본 파일 diff 보존 확인.


W04 후검토: 원격 임무 초안에는 mission_id/task_id scope를 붙여 같은 임무/작업에만 적용한다. native 입력 노드를 편집 중 교체하지 않고 기존 V6 button/form/table 스타일을 사용한다. 실제 서버/API 변경 없음. validation/t058_mission_workspace.md에 최종 게이트 결과와 원본 한계를 기록했다.

## W05 설계
contracts/sim_workspace.md를 따른다. 기존 backend 보존, tabs/sim_workspace.js를 workspace_orbit에 조립하고 mission_workspace의 사본 갱신 연결. Constitution I~V PASS, 새 의존성/원본 계산 변경 없음. T059→T060→T061→T062. 필수 전체 회귀/실제 UI/Draft 리뷰.

## W06 기존 KPI/report 설계
FR016/SC014→US8/R002,R003,R004,R007,R010→T063~66. contracts/kpi_workspace.md에 파일 시점/CSV 출처없음/JSON동일원본/기존지표 한계와 history를 정의한다. backend/protocol/계산 보존, 새 의존성 없음. communication/browser/api.js 원본 report adapter; tabs/kpi_workspace.js 사본/검증/필터/선택/300세션이력/220ms표시재생/다운로드; W05 observer로 기존 소켓 공유, workspace_orbit 조립, 기존 drawMultiLine 재사용. Constitution I~V PASS. 검증은 RED부터 전체pytest/Node/실제8891 두해상도/파일 일치, PR20 위 Draft.

## W07 MOCK-HIL implementation
FR017/SC015→US9/T067~T070. Same JS/FastAPI stack, existing hil endpoints/runtime/mock_hil/models unchanged. communication/browser/api.js optional signals; tabs/hil_workspace.js owns only display copies/selection/serial pending/local logs. Pure visualization/hil_topology.js adapts existing six-node geometry. Existing drawSparkline renders real received SIM throughput. workspace_orbit fans the one W05 socket to KPI/HIL; sim panel connects lazily for em. Drafts select only device/sequence. No changes to clocks or runtime state ownership. contracts/hil_workspace.md contains errors/legacy semantics/barrier. Constitution I–V passed pre/post-design; no new dependencies/public wire contract/ADR. Whole regression and actual8891 preserve current0.0.0.0 binding.

## US10 Catalog 구현 계획
기존 communication/http/catalog.py → data/catalog/access.py/records.py/cache.py → CelesTrakSource 흐름은 변경하지 않는다. communication/browser/api.js에 optional AbortSignal만 더한다. tabs/catalog_workspace.js controller/panel을 workspace_orbit의 satellite에 조립한다. 기존 대량목록+virtualization 대신 서버지원100개 페이지로 DOM/전송량을 제한한다. 검색은 명시 조회 버튼으로 적용하여 초안과 조회 조건을 구분한다. 응답 generation과 AbortController로 역순을 차단하고 상세도 별도 generation으로 막는다. 원격 초안은 조회를 실행하지 않는다. API 실패는 유지한 마지막 결과와 오류를 함께 표시하며 다른 조건의 결과임을 표시한다. 카탈로그는 조회이며 저장 궤도/브라우저 전체 위성 SGP4/접촉계산 연결은 이 단계의 신규 범위가 아니다. 전체 카탈로그 globe/legacy 선택 흐름은 W08 대조에 남긴다.

## US11 상세설계
사용자정밀좌표선택승인. 기존data/orbit_inputs parsing을 bytes진입점으로추출하고 기존path진입점을보존한다. data/earth_orientation에명시IERS-A loader/UT1및극운동quality 조회를더하며 기존Bloader와동일scalar/vector계산보존. catalog_geometry snapshot은별도manifest/hash고정, 기존stored manifest불변. user_application/catalog_geometry query는기존CatalogReader에서해당그룹/번호를조회해normalizedOMM 사본/Rust native/create_orbit_calculation 재사용; shared boundedexecutor, runtime변경없음. HTTPstrictPOST /api/catalog/position은server보존epoch한시점만계산(다른UTC입력은이번범위제외),source/fetched_at/GPepoch/hash/EOPquality와ITRFm 반환. browser/catalog_geometry.js 늦은결과검증, 기존catalog선택hook, workspaceglobe 단일Viewer 표시모드전환. 새로운globe/newSGP4/합성fallback 없음. T085~89 상세화, T075완료로닫지않는다.

## US12 station list/globe integration
Use original model data in digital_twin/model_library/browser/station_presets.js (only used STATION_PRESETS excerpt) and ground_station_sites.js (relative import only). Reuse stationOptionMarkup/coordinateLabel/stationCardModel in user_application/web/scripts/orbit/station_card.js; display facts only, not uncomputed live rows. New tabs/station_workspace.js owns a presentation selection copy, injected sites/callbacks, no API/runtime writes. Existing workspace_globe/OrbitGlobe accept sites/selection callback, own29 entities and one Cesium pick handler; selection highlights and camera uses original regional focus scale. Virtual point and satellite entities remain separate. Composition mounts only model_library/browser static assets. No stack/native/formula/API change. All source provenance recorded in ADR0011 and fixture original_station_sites.json. T090–94 depend in order; real two-size verification required; no new research agents needed for already verified source decisions.

## US13 station observer input
FR021/SC019→R003,R005,R007,R010→T095–T098. Same JS/Python/Rust stack. station_workspace exposes a copied selected preset through explicit use callback; workspace_orbit stages groundPanel draft then opens ground role. ground_visibility.stageStation validates finite lat/lon/mask, retains height and UTC range, cancels old visibility/series and never commands server. Existing run/setGround with preserveUtc and samples then visibility/radio are reused without formula/API changes. Pending selection/application rejects staging; invalid presets leave draft intact. Source height has unknown datum: not converted/copied. Ground form labels representative coordinates as assumptions. No new runtime state or timers. Constitution I–V pass; no hooks or new checklist needed (existing quality8/8 reviewed).

## US14 catalog time observation
FR022/SC020→T099–103. Existing CatalogGeometryQuery factor GP acquisition preserving position output; additive readonly POST /api/catalog/samples pins normalized_gp_sha256 from epoch response, strict virtualGroundPoint and UTC/step1/count≤601. Native calculation batch reused, vector range/azimuth added to existing geometry domain, no browser SGP4/fallback. Count/step/UTC/hash/unit/frame/profile/EOP errors fail explicitly, per-native-row failure null metrics. UI uses existing nanosecond codec and 1-second sample buffer for local display clock, no server-state ownership. Header shows GPepoch vs displayUTC; selected reference station is an assumption with user height. GP update hash conflict forces explicit reselect. No large wholecatalog propagation/extraViewer. ADR0013 records new wire contract. GateI–V pass, existingchecklist8/8, hooksabsent; fullPython/Node/actual8891required.


## US15 whole-group precise positions
Reuse Catalog.get_satellites(limit=0) and original full-group semantics, never table paging. CatalogGeometryQuery adds snapshot preparation cached per current group/filter content hash and immutable validated OMM+epoch; cache is data/query optimization, not current runtime state. Source metadata from each catalog fetch remains fresh independently. New Rust propagate_omm_many(payloads,minutes) performs at most50000 aligned rows per native call; larger full snapshots process multiple bounded chunks, never truncate. SharedUTC/EOP read once; shared rotation for successful TEME vectors. Existing scalar exports/MAX_BATCH_ROWS/profile kept. Frozen payload/row metadata carries perGP hash/epoch and whole-snapshot hash. HTTP POST /api/catalog/scene strict schema accepts group/query/orbit/canonicalUTC/requestid/optional expected snapshot hash. Use existing bounded executor; perrow malformed/constants/native errors null wireposition; group-wide EOP/provenance failure422/503, changed snapshot409.
Frontend full-scene controller uses same applied search conditions, independent request generation/abort and owned snapshot; displays native snapshot UTC/count/source/quality. Whole-scene updates coalesce selected timeline changes, at mostone pending query and one refresh per wallclocksecond, request currentlatestUTC aftercompletion, no duplicate timers/runtimewrites. PointPrimitiveCollection reuses original color/point-size/depth-occlusion semantics and one Viewer. Labels onsmallgroups and selectedpoint; selection feeds originalprofile/selectedGPtimequery pinned perrowhash. Update primitive rows only onscene response; selectedmarker may move between whole-snapshot refreshes and must be labeled with its own UTC. Scene errors do not show fabricatedpoints; catalog hash conflicts clear scene/time buffers.
Constitution gate: unchanged1.2.0, userapp composition→data/native/simulation/contracts, renderer injectedcoordinates, native holds no clock/EOP/runtime. Product Rust wheel gets new export and0.2.0 version, no new dependencies, build actual product/repaired licensedDLLs; clean isolated install before projectvenv update and exact8891lifecycle. T075 remains partial until all originaldisplayfunctions complete; T076–84 untouched.

### T110 response preparation repair
Measured UI validation/copy stalls require bounded response preparation. Retain full-count/row/hash/UTC/epoch validation and independent owned snapshots. Prepare at most512 rows per chunk, yielding a browser task between chunks; publish only one fully validated complete response after the generation fence. Clear/context change during preparation discards staged rows without display or retry. Small replies keep synchronous preparation. Renderer callback remains atomic and separately measured; this does not assert frame/performance acceptance. RED responsiveness/cancel/late-invalid-row tests precede implementation. No wire/schema/native/runtime or user scope change.

### T110 renderer style reuse
Reuse immutable color and distance-scale option values per visual class; keep independent positions/primitive IDs and atomic synchronous response application. Cache parsed GP epoch by exact GP hash and epoch text within the active scene, clear on scene replacement/destruction. Refresh age opacity as UTC crosses the original72h threshold and returns; same GP hash does not imply same age. RED allocation and epoch parsing regressions→PASS. No new renderer lifecycle/API/native/runtime authority; FR023/SC021/T110 and original styles preserved. Current gates unchanged; actual measurement and whole regressions required before any performance claim.

## US16 selected track/visibility
FR024/FR025/SC022→T111–116; originalsource1a1e002 unchanged. CatalogGeometryQuery.track reuses _input/load/native/preciseEOP in bounded executor. Sorted sourceperiod offsets feed existingcalculate once, independent UTC/source/quality and masked perrowfailure. CatalogGeometryQuery.visibility reuses search_visibility and calculate.evaluate_times with immutable selectedGP and same readonly observer contract. Add two strict HTTP/browser functions/ADR0015, oldposition/samples/scene unchanged. No new stack, runtime store, nativeexport or referenceimports. Frontend selected track and pass controllers consume existing catalogTimeline callbacks; renderer takes injected segmented ITRF arrays and originalpolyline width3/ArcType.NONE. Pass AOSseek uses timeline.seek+calculate only. Whole16k scene preserved, old selectedtrack invalidated onselection/hash, UTC/observer resultgeneration checked. Full regression/twores/DraftPR29base required. Constitution1.2.0/checklist8of8/hooksabsent valid. Phase0 known product/native/EOP/visibility contracts and verifiedoriginal code resolve technical choices; no new research agents or external facts needed.

## US17 view controls
FR026/SC023 -> T117–121, original1a1e002 globe.js742–879 and existing Blue Marble. Same JS/FastAPI/Rust/Cesium stack. digital_twin/visualization/globe_view.js is an injected single-Viewer renderer helper for morph/style/imagery generation, no propagation/transport/runtime authority. OrbitGlobe delegates display controls and repaints current colors without changing coordinates, hashes or UTC. user_application/web/scripts/tabs/globe_view.js controls the user flow; workspace_globe retains choices before boot and returns view status; workspace_orbit composes the existing globe controls and display drafts. No new Viewer, timer or web API. Default3D/dark/emphasistrue/BlueMarble preserved. Provider construction is injected at application boundary. ArcGIS, OSM and NaturalEarth original endpoints; provider readiness precedes atomic owned-layer replacement; generation fences and provider tile error callback dispose explicitly. On external failure use original NaturalEarth with visible error/fallback metadata; if fallback fails retain last valid layer. No synthetic sunlight enabled by theme; explicit solar model is a separate pending T075 owner. Morph1.5s/revision/completeMorph/cancelFlight/identity/north-up, 2Dminzoom1000 vs3D100000. Palette/styles original golden. Constitution1.2.0 I–V pre/postdesign pass. RED -> renderer -> application -> full and actual8891 -> Draftabove30. T075 remains partial until originalGLB/camera/solar also verified.


## US18 selected GLB model/camera/hover integration
FR027/FR028/SC024 -> R003/R007/R010 -> T122–129. Same original source1a1e002 and JS/FastAPI/Rust/Cesium1.143 stack; no model engine/framework/wheel change. Contract contracts/satellite_display.md defines static schema/dependency/geometry/camera/UI gates. Constitution1.2.0 I–V pre/postdesign PASS: only needed display definitions/assets extracted into model_library/packages/satellite_display/v1, no wholesale reference import; renderer injected native geometry and UTC, model_library pure mapping, runtime unchanged, UI and transport constructed in user_application. No new bus/current state owner. Source rights, derivative asset integrity and actual GPU readiness are gates, not assumed from manifest hashes.

Phase0 decisions: pure ordered resolver is ported from original satellite_models.js into digital_twin/model_library/browser/satellite_models.js; source schema2 loader validation prevents broken path/rule/provider metadata while legacy pure-function fixtures retain original behavior. Human-readable metadata repair uses intact source titles and records raw/derived values. package validator and deterministic Terra PNG embedding/GLB repair tooling live in project_support/tooling, runtime package stays static. Missing source textures are explicit asset acceptance failures; keep source evidence and point fallback, continue independent mapping/camera/other assets without claiming asset-complete. An authoritative alternate texture asset requires provenance and dependency verification before use.

Renderer digital_twin/visualization/satellite_model.js and camera_motion.js retain source loading token/primitive/camera algorithms. Change only position boundary to native ITRF Cartesian3 and injected sampleAt/advanceUtc/timeSource string callbacks; no original JS orbit propagator or Date/default wall-clock. Model orientation uses native-buffer +1s finite difference or explicit ENU fallback. Existing catalog_timeline exposes read-only sampleAt/advanceUtc from existing buffer; no new timer or duplicate state. A renderer-owned preUpdate listener uses the existing display UTC for pose and monotonic time only for easing, requests render while motion/model requires it, and disposes on clear. Model async completion is fenced and repositions at current UTC before visibility; ready/error subscriptions are owned.

Application tabs/satellite_model.js and orbit/satellite_model_description.js port current selection/resolver/match description/thumbnail/credits. communication/browser/api.js adds only a static-manifest fetch with optional AbortSignal, no web API schema. workspace_orbit composes selection/profile/time callbacks, workspace_globe boot/morph/status/model callbacks and the existing one OrbitGlobe. Mount only versioned package through application.py; preserve original static files and current public API allowlist. Server mount change requires exact owned8891 restart/state capture/restore, explicit SIM-memory impact record; never choose another port. No automatic model-close focus. Camera model actions are explicit, update existing interaction/morph handlers with proper restoration and no double wheel zoom. Hover card uses current picked native ITRF/UTC and Cartographic WGS84 height, no per-frame whole16k geodetic work or browser propagation.

Independent US18 acceptance: mapping/selected model/thumbnail/quality/camera/hover in existing Viewer with whole-group/stations/track preservation and original source comparison. Original50 assets must all have dependency/actual-render proof before final T123/T129 closure. Terra remains incomplete if official textures unavailable; no excluded model or narrower completion. Camera pure tests30/60/144Hz do not prove game performance. Solar sampling/lighting remains separate owner within T075, T076–84 full scope and all previous tasks/deferred requirements preserved. Implementation starts only after scoped readonly analyze; regression-first, whole Python/Node and actual8891twores, Draftabove31/unmerged.

T128 composition detail: `orbit/satellite_model_selection.js` holds copied presentation inputs and the injected original resolver/validator, with asynchronous manifest generation fencing and descriptor deduplication. It does not select or calculate or own a clock. Current item/profile/native identity come from existing controllers; equivalent OMM UTC epoch text is compared using the existing timeline leap codec. Manifest transport status is separate from render readiness in workspace_globe/model panel. Actual workspace/static mount and live acceptance remain T128/T129 gates.

## US19 solar geometry and original indicator
FR029/SC025 -> T130–137; contracts/solar_display.md. Same existing Astropy/ERFA/Python/JS/Cesium stack. Pre/post design constitution1.2.0: injected readonly EOP/time, runtime unchanged, hierarchy preserved, source/model labels required, regression first/full checks/live proof. Pure solar_geometry.py produces immutable fixed-frame unit vectors; user_application/solar_geometry.py assembles hashchecked EOP/SI UTC batches, communication/http/solar_geometry.py defines additive readonly API, ADR0016. Renderer solar_display.js ports original indicator/occlusion/projection/CSS behaviour with injected vectors and emitted-light opposite sign. UI solar_timeline.js reuses existing leap codec,601one-second samples and normalized interpolation,120second lookahead/coalesced generation fences, no per-frame request or new playback clock. Existing workspace_globe/workspace_orbit reconcile the actual display owner, inject existing Viewer, status panel and preference lifecycle. Full test and actual fixed8891 evidence; exact owned server restart captures/restores stored state and records SIM-memory impact. Missing Terra does not block this independent solar story or close its original requirement. No new feature/bootstrap or overwritten plan.
T135 assembly detail: user_application/web/scripts/workspace_solar.js composes existing timeline/render adapters and owns original browser lighting preference/listener cleanup. workspace_globe emits a small copied valid display context and supplies its existing Viewer; globe_view panel owns controls/status. No new wire/clock/runtime boundary. Actual two-resolution verification remains T136.

## T076 preparation / C002 original execution evidence
FR-008/T076→T138 original goldens→T139 scoped node contract/coverage before product implementation. capture_original_nodes.mjs is offline project_support evidence tooling, hash-pinned source VM and explicit epoch, not a product propagation dependency. Preserve preset/formation/power and approximate original frame outputs with provenance; fixture-only tests do not prove V6 integration. Additional original tabs/nodes.js→deployment_client.js→data_deployment.js connects GET/POST data-management/deployment acceptance to local deployed copies, creating a required T076/T079 dependency. Local store-only deployment cannot close original source scope. Native model/frame/time and product task decomposition remain T139 design prerequisites; don't implement against this unfinished design or change GP Rust/native geometry. Existing constitution1.2.0, whole T075–84 and all previous acceptance gates remain intact.

## US20 node integration design (FR030/FR031/SC026)

contracts/satellite_nodes.md resolves node time/frame/native and deployment boundaries; T139→T140–T153. Same JS/FastAPI/Rust/PyO3/Cesium stack. No new framework/toolchain or physics engine. Source-defined Kepler+J2 equations use node_dynamics.rs in existing orbit_propagation crate, additive node export/versioned wheel, unchanged SGP4 profile. Pure browser static orbit-definition/summary helper is injected into model library; no browser propagation or concrete simulation dependency in model_library. Explicit epoch/ID/storage/native/executor/Viewer/model resolver/UTC-owner injection removes original global singleton/wall-clock fallback. Runtime owns server accepted configuration; draft/deployed display records belong to application. No duplicate current state, EventBus or runtime pointer in renderer.

Preserve original GMST/UTC engineering approximation as EARTH_FIXED_GMST_UTC_APPROX and SOURCE_MEAN_EQUATOR_EQUINOX_APPROX, never ITRF/TEME. Original model time is tagged unix_ms_utc_approx, while public sample grids use existing SI/UTC formatting. A leap epoch/row unsupported by source convention returns an explicit error; no silent UTC collapse. Precise GP/Solar transformations are unchanged. Native batches max50000 rows; full240×601 is chunked <=83nodes with atomic generation assembly. Track sampling120/30second display-time refresh and source model cap64/point fallback remain. Source instant power and cylindrical shadow are engineering assumptions, no SOC or communications success. Error/missing values cannot reach renderer as numeric rows. Geometry API remains readonly; accepted data deployment is a separate command/activation transaction.

Source data-management/deployment schemas/runtime transaction are reused through injected activation and the T079 verified isolated-v1 adapter/module; absent module returns unavailable, never unconditional acceptance. Server commit follows successful activation under runtime lock. Shared client keeps15second timeout/serial queue/retry-ID/409/read-only refresh/receipt validation and changes local copies only after acknowledgment. Original initialize auto-restore POST is intentionally changed to GET only, compatible with product no-command-on-restore. This behavior change is documented separately in ADR0017 before implementation. Original OISL resolver/acquisition visualization is T077-owned and injected into NodeScene/power, not simulated by unrelated RF success flags.

Needed paths: model_library/browser/satellite_nodes.js; simulation/browser/node_orbit_definition.js; simulation/orbit_propagation/src/node_dynamics.rs; communication/native/node_adapter.py; contracts/satellite_nodes.py; user_application/node_geometry.py; communication/http/node_geometry.py; web/scripts/nodes/{constellation,editor,data_deployment,node_timeline}.js and tabs/satellite_nodes.js; visualization/node_scene.js; existing workspace_globe/workspace_orbit/application.py. Only create files when used. Source behavior goldens/store/model/renderer/controller/runtime/API regressions precede edits. Full native build/install/old-exports and twores actual8891 gates plus draft review. Exact owned restart only after state capture/native installation, with SIM-memory effects recorded, fixed8891.

Constitution1.2.0 pre/postdesign I–V PASS: same approved stack/source fidelity, explicit approximation labels, runtime single authority, injected boundaries, no new product reference import, regression/full/live gates. Phase0 choices derive from directly read source and existing native/time/runtime contracts; no new external library selection or unresolved technical preference requires research delegation. T079 module implementation is an explicit integration dependency, not an unknown replaced by a stub. T075/Terra/all50/T137auth/T077–84/T032/actualRF/HIL/AeroDT remain open.


### T143 query preparation refinement

Source track endpoints need different121-element UTC grids per node and the source rounded two-body period before native propagation. Extend the native adapter with propagate_node_grids(prepared, grids), retaining shared-grid propagate_nodes as a delegating wrapper. One bounded native call preserves all nodes/indices, including leap errors; no per-node transport/clock or truncation. Add the pure static period helper in digital_twin/simulation/node_geometry.py, reusing the existing source-identical EARTH_RADIUS_KM/MU constants from orbital_elements without calling its wall-clock derive_orbit. The helper ports positive Math.round(periodMinutes*1000)/1000 semantics, validates the source domain, and performs no timed propagation or epoch-age calculation. This is source static request preparation, not a new model/engine.

NodeGeometryQuery snapshots the complete supplied records, prepares/hashes once and uses injected calculation/executor ports. SI samples reuse foundation UTC/TimeDelta; source tracks use Gregorian Unix-ms center,120intervals121inclusive vertices and per-vertex truncation tointeger milliseconds before UTC conversion. A leap center cannot form a source track and is explicitly unsupported; sample leap rows/epochs remain aligned errors. Native result frame/profile/time/identity/hash/UTC/shape checks precede fresh DTOs; one invalid track vertex sets whole-path visibility false. DTOs preserve explicit inertial_velocity_km_s and fixed position_m source approximation. HTTP/browser/application mounting and actual wheel/server acceptance remain existing later T143/T144/T151 gates.

T143 HTTP preparation refinement: the unchanged finite schema/identity/orbit/epoch/full-definition-hash preparation belongs to the shared satellite_nodes contract and is reused by native adapter and strict HTTP schema, preserving native re-export callers. HTTP depends only on contract/foundation; route-local safe validation excludes nonfinite input/context from error JSON. Query DTO model_profile matches the public design. Source-node editor equipment semantics and accepted deployment remain separate owning tasks; no new runtime authority or existing-route handler change.
