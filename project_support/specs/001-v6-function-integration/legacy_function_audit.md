# 선배 기능 ↔ V6 연결 대조 (2026-10-05)

## 결론
최초 목적 R003/F002는 **부분 완료**다. 지금까지 연결한 핵심 계산과 기본 서버 기능은 유효하지만, 최신 선배 프로그램의 노드·데이터·보안·군집 배정·시나리오 재생 모듈은 아직 옮겨지지 않았다. 남은 범위를 W08 화면 조립만으로 설명할 수 없다. 기존 결정/완료task/실행코드 보존; 이번 요청은 대조·후속목록 작성이며 새기능 구현은 하지 않았다.

## 대조 기준과 한계
- 선배 GitHub main과 로컬참조본 HEAD 일치: `1a1e00297a0301637455b0ef2cf48b2e74576b07`; GitHub REST ref를 이번에 조회했다. 원본: https://github.com/HyeonJun9138/ISDC-ODT/tree/1a1e00297a0301637455b0ef2cf48b2e74576b07
- 현재 제품 기준: PR23의 `89b18ea81a10ed996194a089b414346ca899bb90`.
- 선배 communication/http 선언53개(HTTP52+WS1), 현재31개(HTTP30+WS1), 동일 method/path23개, 선배에만30개, 현재추가8개(저장궤도7+ISS부분프로파일1). prefix를 합친 AST 목록과 실제8891 /openapi.json의30개HTTP등록을 대조했다. API개수는 기능 완료율이 아니며 동일경로는 동일의미/회귀통과의 증거도 아니다.
- 선배만의30개: data_fabric3/data_management15/orchestration3/security5/scenarios2/scenario advance1/integration probe1. Browser-only 기능은 이30개에 포함되지 않으므로 별도 확인했다.
- 현재 제품에 operations_software가 없으며 관련 router/클라이언트/탭도 없다. 전체 원본 vendoring은 하지 않는다. 선배의 operations_software는 타기관SW의 임시 구현이므로 향후 communication adapter/버전계약과 AeroDT허용계층 배치를 상세설계에서 결정한다. Rust선정이나 계층 규칙을 이식 때문에 폐기하지 않는다.
- 이번은 정적 소스/문서·실제읽기전용API등록 대조. 선배 모든코드를 실행해 실측 성능/수치 동등성을 다시 검증한 것이 아니다. 기존검증은 각validation 문서의 당시범위·제품버전 증거로만 사용한다.

## 연결된 범위
| 묶음 | V6 실제 연결 | 범위/제한 | 기존 증거 |
|---|---|---|---|
| 저장 ISS 전파/UTC/고도각/가시성/거리·도플러 | satellite/ground + 공용Viewer | 저장자료/Rust모델, 전체카탈로그·현재실측아님 | t023/t031/t049/t054 |
| RF 계산/공식ISS부분조건/기본경로·접촉 | ground | 원본RF와정적시나리오망, 장비미선정/통신unknown | t036/t040/t044 |
| 기존단순임무 작업/action/validate/replan | mission | 최신서비스등록/ICD-03군집계획은별개 | t058 |
| 기본SIM control/speed/select/fault/WS | operations/run/initial/exception | PoC단계runner와다름, GPUTC분리 | t062 |
| 기존SIM KPI/CSV/JSON/세션이력 | data/compare | 데이터센터운영/PoC구간비교와다름, 디스크저장미확인 | t066 |
| MOCK-HIL action/preflight/sequence/recording | em | 모의이며영구기록/실제HIL아님 | t070 |
| 카탈로그검색/그룹/페이지/필터/상세 | satellite | 선택은상세만, 목록위치/노드미연결 | t074 |

## 확인된 누락과 후속 작업
| ID | 유형 | 중요도 | 기능 | 현재 차이 | 작업 |
|---|---|---|---|---|---|
| C001 | partial | HIGH | 위성 카탈로그 선택과 공용 지구/지상국 표시 | 카탈로그 상세/epoch 정밀 위치(T085–89)와 29지상국 목록·선택·카메라(T090–94) 연결; 다중위성/재생/동적지상국기하/3D·일조 미연결 | T075 |
| C002 | missing | HIGH | 위성 노드 편집·배치·편대 | 원본실행91golden 준비(T138); 제품 편집/버스/장비/전력/모드/편대와초안·배치기록 미연결. 실제버튼은data-management/deployment 서버수락 후 로컬사본갱신이므로 T079 의존성도필수 | T076/T139, T079 |
| C003 | partial | HIGH | OISL·데이터 패브릭·지상 구간 | 기존 RF/route/contact는 연결; data-fabric 3 API와 OISL 포착/지향/경로/DTN·지상국 운용 설정 없음 | T077 |
| C004 | partial | HIGH | 서비스 임무 등록·군집 작업 배정 | 현재 단순시나리오 missions API4만연결; 최신 선배 UI의서비스임무등록/계획/위성별UTC일정·군집배정·확정 없음 | T078 |
| C005 | partial | HIGH | 데이터 수명주기·복제·복구 | KPI/CSV/JSON과별개인 data-management 15 API 및 객체/복제/정합성/복구/재균형/정책/서비스 없음 | T079 |
| C006 | missing | HIGH | 보안 운용 상태 | security 5 API와 인증률규칙판정/전환이력/ICD-08 dashboard 없음; V6security는예시 | T080 |
| C007 | partial | HIGH | PoC 시나리오 단계 실행·KPI | 단순 SIM control/scenario select/fault만연결; scenario catalogue2+advance1 API 및40기초기화/장애·복구/서비스·임무배정/KPI구간비교 runner 없음 | T081 |
| C009 | partial | HIGH | V6 공용 맥락·화면 간 인계 | 패널 일부연결; wall/normal/scene/composer/initial/exception의 SAT-A/M-204/D-731/SCN및기한·사건·기록카드는예시로남음 | T082 |
| C008 | missing | MEDIUM | 모듈 연결 설정·ICD 점검 | integration/probe1 API와내외부연결 topology/transport/endpoint/heartbeat/timeout/ICD목록 없음; HIL구성도와다른기능 | T083 |
| C010 | partial | MEDIUM | 내보내기 디스크 저장 완료 검증 | 원본bytes/미리보기는검증됐지만 브라우저download완료가timeout이라 디스크저장완료 미확인 | T084 |

## 소스 근거와 계약 진입점

### C001: 위성 카탈로그 선택과 공용 지구/지상국 표시
요구 연결: FR-008, FR-018; plan: US10/W01/W02. 원본 저장소 상대경로: `user_application/web/scripts/tabs/orbit.js; orbit/station_card.js; digital_twin/visualization/globe.js`. 후속: T075. source/epoch/계산가능범위·카탈로그모델과저장GP상태를분리한계약부터작성하고 기존전파/지상국/카메라 표시를 단일Viewer에 단계별 연결·회귀검증.

### C002: 위성 노드 편집·배치·편대
요구 연결: FR-008; plan: W01/W08 satellite/scene/composer. 원본 저장소 상대경로: `user_application/web/scripts/tabs/nodes.js; nodes/editor.js; nodes/constellation.js; digital_twin/model_library/browser/satellite_nodes.js`. 후속: T076. 기존노드정의/검증/배치/프리셋과Kepler+J2 모델을 재사용하고 UI설정과runtime 권위상태 소유권을 명시해 scene/composer에 연결·회귀검증.

### C003: OISL·데이터 패브릭·지상 구간
요구 연결: FR-008; plan: W03. 원본 저장소 상대경로: `user_application/web/scripts/tabs/communication.js; communication/network_twin.js; communication/ground_segment.js; communication/http/data_fabric.py; operations_software/data_fabric`. 후속: T077. 기존네트워크snapshot/OISL/지상국설정과ICD-02 계산을 재사용해 통신 화면에 연결; 현재 RF와별개로 모의/unknown/경로·장애·단위 회귀검증.

### C004: 서비스 임무 등록·군집 작업 배정
요구 연결: FR-008, FR-014; plan: W04. 원본 저장소 상대경로: `user_application/web/scripts/missions/mission_store.js:49; missions/planner.js; missions/planner_client.js; communication/http/orchestration.py; operations_software/orchestration`. 후속: T078. 기존 missionStore와planner/ICD-03 계획·확정/일정표를 재사용하고 현재 단순임무API와구분해 mission/normal에 연결; 실패·재편성·규칙기반 결과 회귀검증.

### C005: 데이터 수명주기·복제·복구
요구 연결: FR-008, FR-016; plan: W06/W08 data. 원본 저장소 상대경로: `user_application/web/scripts/tabs/data_management.js; communication/http/data_management.py; operations_software/data_management`. 후속: T079. 기존ICD-01 임시구현/계약/외부adapter와카탈로그·복제·무결성·복구·정책·서비스를 재사용하여 data에 연결; KPIexport와구분/미확인·실패·사본·읽기불변 회귀검증.

### C006: 보안 운용 상태
요구 연결: FR-008; plan: W08 security. 원본 저장소 상대경로: `user_application/web/scripts/tabs/security.js; security/view_model.js; communication/http/security.py; operations_software/security`. 후속: T080. 기존보안관측·규칙판정·상태·이력을 ICD-08 어댑터와함께 security에 연결; 실제보안관제/인증구현과구분하고 판정/전환/미확인 회귀검증.

### C007: PoC 시나리오 단계 실행·KPI
요구 연결: FR-008, FR-015; plan: W05/W08 run/composer/compare. 원본 저장소 상대경로: `user_application/web/scripts/scenario/runner.js; scenario/clock.js; scenario/console.js; communication/http/scenarios.py; user_application/configs/scenarios`. 후속: T081. 기존PoC정의/runner/공유SIM시계/단계동작/KPI결과를 재사용하여 run/composer/compare에 연결; C002~6후의존성/명시실행/중복명령·복원·GPUTC분리 회귀검증.

### C009: V6 공용 맥락·화면 간 인계
요구 연결: FR-008; plan: W08 all V6 screens. 원본 저장소 상대경로: `current user_application/web/scripts/workspace.js; workspace_orbit.js; tabs/*_workspace.js`. 후속: T082. 기존확인된source/selected IDs/SIM상태/임무/통신/데이터 결과를 주입하는 화면간계약을작성하고 예시와실값을구분해 공유맥락·인계·실패·원격초안·Viewer1 검증; source없는시설모델은발명하지않음.

### C008: 모듈 연결 설정·ICD 점검
요구 연결: FR-008; plan: W08/W09 settings. 원본 저장소 상대경로: `user_application/web/scripts/tabs/settings.js; settings/topology.js; communication/http/integration.py`. 후속: T083. 기존모듈설정/ICD목록/probe를 communication외부경계에가두어 설정흐름에 연결; TCPconnect/UDP주소해석/내장생존 의미구분, 임의엔드포인트자동probe없이명시조회·오류 회귀검증.

### C010: 내보내기 디스크 저장 완료 검증
요구 연결: SC-014; T066/plan: W06. 원본 저장소 상대경로: `current validation/t066_kpi_workspace.md; tabs/kpi_workspace.js`. 후속: T084. 기존CSV/JSON다운로드를 실제브라우저에서 끝까지 확인하고 저장한파일bytes/단위/출처를 서버응답과대조; 완료확인불가면미확인유지.

## 이전 설명 정정과 보존
W04에서 “새 임무 생성 기능은 원본에 없음”이라고 한 것은 현재처럼 전체선배기능을 설명하는 근거로 사용할 수 없다. 이번 확인본 mission_store.js:49의 add와 README의서비스임무등록/ICD-03편성 설명이 반증한다. 기존단순 missions API 작업연결 성과는 유지하지만 최신 service mission 생성/군집planning은 C004로 남긴다. 기존 security/facility를 함께 “별도기능없는카드”라고 한 설명 역시 분리해야 한다: 보안모듈은 실제로 존재(C006), 시설전용운영모듈은 확인하지 못했다. 원본보안도 규칙기반대표값/임시구현이며 실제보안시스템이 아니다.

## Converge 결과와 다음 순서
`tasks_appended`: missing3/partial7, HIGH8/MEDIUM2, CRITICAL0/contradicts0/unrequested0. 집중추적 FR008/014/015/016/018, SC012/013/014/016, fullplan W01~W09 및 constitution5원칙. 기존74tasks의완료/보류와validation26개 연결을 확인했고 T032는기존사용자보류라중복task로추가하지 않았다. T075~84 10개는 기능 묶음 수준의후속task로, 상세 구현task개수나 전체완료율이 아니다.
추천: 위성우선지시를따라 T075(카탈로그선택↔공용지구·지상국)→T076(노드배치)부터 상세설계와원본golden을진행한후 통신/임무/데이터/보안/시나리오/설정/화면조립 확장. 자동으로모든기능을한번에이식하지않는다. F001/F004~6/T032/W06저장미확인과독립repo/향후AerODT연계/8891고정은보존.

US11 증거 갱신: validation/t089_catalog_position.md. C001은 일부 위치 표시만 추가되었으며 partial을 유지한다. 이전 API counts는 PR23 audit 시점의 값으로 현재 route는 ADR0010 하나 추가되었다.

US12 증거: validation/t094_ground_stations.md. C00129지상국 목록/시각선택 연결추가; partial유지(다중/재생/동적기하/모델). 원본 프리셋 높이/장비의 실제값검증은 F001에남는다.

US13: validation/t098_station_observer.md connects explicit station preset lat/lon/mask to existing saved-GP observer apply/elevation/range/visibility. Original browser observer h0 assumption is not imported as verified altitude. C001 partial remains for catalog dynamic observer geometry/playback/multiple/3D. Real conditionsF001 and othergap bundles unchanged.


US14: validation/t103_catalog_time.md connects selected catalog UTC observation/local playback, native range/azimuth/elevation and station draft. C001 remains partial for original multiple-satellite/3D/sun functions. T075–T084 full goal unchanged. HTTP counts above are historical audit values; ADR0013 adds samples independently.


## 2026-10-05 original model audit correction
The earlier US15 statement excluding actualGLB assets was a source-review error and is superseded by catalog_view_source_audit.md:50GLB/37,202,844bytes,56manifest mappings, actual SatelliteModelLayer glTF rendering/follow and mapping-quality/thumbnail/credits. Preserve originalfunction scope, including those functions. The historical statement is retained as superseded evidence, not a design decision or an exclusion. Next specify/plan/tasks owner must cover GLBmodel lifecycle plus scene/sun/imagery/labels/camera; runtime unchanged at this audit.
US19 T133 evidence: validation/t133_solar_renderer.md. Original projection and lighting policy ported into standalone renderer with explicit precision-input boundary; workspace/solar buffer/live acceptance pending. Original generic solar indicator CSS is not applied by original index and screen CSS hides the elements; upcoming V6 assembly must record this presentation difference. C001/T075 remains partial; no whole-goal closure.
US19 T134 evidence: validation/t134_solar_timeline.md. Native precise solar query feeds bounded601-row display cache with shared SI/leap codec; original presentation awaits T135 and actual browser acceptanceT136. Native→actualJS interpolation9604samples pass1e-6rad consistency; no independently measured solar accuracy. C001/T075 remains partial and other macro gaps unchanged.
US19 T135 evidence: validation/t135_workspace_solar.md. Original generic solar overlay visual and lighting preference connected via existing singleViewer/displayUTC priority; original source index hiding differs explicitly. Solar geometry remains native ITRF/EOP, no synthetic fallback/new clock. Actual T136 two-resolution acceptance and T137 Draft remain pending; C001/T075 partial and all macro gaps retained.

## 2026-10-05 US19 solar acceptance update
Original solar indicator/lighting now connected to shared display owner and validated through T136: pure source/model framing,readonly601 sampling,existingclockbuffer,originalCSS/preferences and actualtwores sign/visible/occlusion/morph/owner/60x/error/retry/restore/twowindow. Evidence validation/t137_solar_display.md. This closes only the solar portion of C001/T075; US18/Terra/all50 and macroT076–84 remain open. T137 review publication pending. Originalindexmissingclass/display:none difference and independentastronomy limits are recorded. Existing paused catalog label/draft restoration clarity is carried to T082; no telemetry/geometry invented.


## 2026-10-06 T077 original optical equations component
Original pure oisl.js text ported unchanged (only line endings), no clock/timed JS propagation/network/state owner. Hash-pinned source offline capture twice565246bytes/SHA c63dc5daeb8852034594c2d5796a8837535de0e4268a38e9dbba660af59ceaf3, elevenepochstates/1071exactserializedgeometry-selection-pair-history-label cases. Original9testbodies preserved with captured state inputs; missingmoduleRED and JSONnegativezero10PASS1FAIL corrected solely by matching capture serialization. FullPython645PASS8existingERFAwarnings166.50s(session73019exit0)/Node570PASS2985.9988ms; focused11PASS95.562ms; syntax and fullsource-text/original9test-body equality. Evidence validation/t077_oisl_equations.md. Original nodes/links.js resolver/scoped histories/commonexactUTC/verifiedsnapshot; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Source100kmatmospheremargin/ratedrangequality/acquisition remain engineering assumptions, no actual optical/RF success. Actual8891/native0.2.0/userbrowser/remotePR/merge unchanged; fullgoalactive.


## 2026-10-06 T077 original node link resolver component
Previous turn progressedca6d7b9; clean tree/controller/ledger/prerequisites and existing8/8requirements/noextensions gates reused. Original links.js body83a119b3… unchanged; inject existing library/oisl through createNodeLinkResolver, no private clock/propagation/state owner. Offline source VM captures18scenarios/59instants twicegzip476646bytes/SHA9324208901708676cd8710b49fc56aebad1e03588dcd3b4e52aa60fbac7d7ee6 (JSON8107723bytes/SHA7138afa16224bfaf93f319285e644957d72e719813d71428ad74520697cf54a7). Full terminal/pair/history trace matches source, product carries history across steps without changing previous inputs. Missingmodule RED repaired; FullPython645PASS8existingERFAwarnings164.45s(session94379exit0)/Node591PASS3125.7256ms; target21PASS343.9717ms; source resolver body/syntax/whitespace checks. Evidence validation/t077_node_link_resolution.md. N004 OPEN: original network_twin primes at -120/-60 seconds; existing first-forward native window omits past instants. Owner T077 native calculation/US20 assembly; trigger before production snapshot/T148/T151 acceptance. Supply actual historical native receipts through existing serial query owner; no current-basis substitution, invented tracking or reduced future grid. N004 actual -120/-60second native history priming/common UTC/scoped verified producer; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Actual8891/native0.2.0/userbrowser/remotePR/merge unchanged; fullgoalactive.


## 2026-10-06 T077/N004 native historical and exact point inputs
Previous turn progressedf97505b; fullgoal/validfeature/controller/checklists8of8/noextensions preserved. Add requestCommunicationStates to existing shared serial owner with full current scope/exact native reuse orcount1pointquery; preserve601futuregrid/121paths, no clock/UTC adoption/interpolation/partial success. Definition/seek/retry/clear/dispose/caller abort and ignored-abort lane fences verified. Missingmethod8FAIL RED repaired; source20-node -120/-60/current receipt→realdecoder→carried source resolver complete equality. Extended existing isolatedwheel test computes actual60Rust rows and forwards exact checked bytes through production native adapter/NodeGeometryQuery and actual JS point queue/decoder/resolver. First target1FAIL2PASS found -180/+180 periodic-equivalent azimuth; only comparison corrected, no production math changed. FullPython645PASS8existingERFAwarnings179.06s(session54094exit0)/Node601PASS3590.8315ms; focused44PASS1873.0067ms; actual clean-venv Rust60rows→adapter/query→JS decoder→source resolver maxnumeric5.4569682106375694e-12/time0ms. Fresh isolated_call receipt data/workspace/validation/install/d31b5659b2e643b58187415ce6a1e462/isolated_call.json inspected; wheel d6a62057… unchanged, actual runtime package reverified0.2.0. N004 historical delivery component now locally verified; source production history owner/verified snapshot stillrequired before T148/T151. N004 production source history/Unix-ms priming/dedup/scope/snapshot verifier; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Actual8891/browser/remotePR/merge unchanged; fullgoalactive. Evidence validation/t077_native_communication_requests.md.

## 2026-10-06 T077/N004 optical history and verified consumers
Preserve full T075–T084 goal. Resume existing feature/controller and 8/8 checklist/no-extension gates. Original checkout externally switched to codex/catalog-display-context-local-20261005; preserve it and use the separate isdc_odt_node_worktree on codex/satellite-node-integration. Add createNodeOpticalTimeline with source -120/-60/current Unix-ms priming, unchanged resolver, shared native point queue, per-owner history retention, exact full-definition/hash/UTC guards, atomic commit, dedup, reset/prune/reversal/disposal and every-field snapshot verifier. Extract shared native input guard without changing axes/equations. Real NodeScene/statusPresentation composition consumes actual computed verification, rejects mutation/stale/reset and preserves unknown power. Focused14PASS768.425ms; fullNode615PASS3933.1313ms. First Python run484PASS/161setupERROR/8warnings130.56s due missing basetemp parent; preserved log, created parent, no product change/test exclusion. Fresh absolute basetemp/cache fullPython645PASS8existingERFAwarnings165.31s(session23515exit0). Actual isolated0.3.0 Rust60rows→production adapter/query→JS decoder/serial owner→actual producer/verifier matches source: maxnumeric5.4569682106375694e-12/time0ms, verified_snapshot=true. Receipt install/55478612fbbd404cb529a2c55508054e/isolated_call.json; wheel d6a62057... unchanged; original runtime native0.2.0 reverified. N004 source history/verified producer prerequisite locally repaired; actual app/8891 proof remains T151/T152. Next implement T151 with shared display/node owners and one Viewer, preserve GP/catalog/stations/solar/SIM and capture before-state before owned8891 restart/native installation. WholeT148/T077/T076/T079/T075–84, Terra/all50/N001/T137auth/T032/equipment/RF/HIL/download/review remain open. No live8891/browser/native-install/remotePR/merge change. Evidence validation/t077_optical_history.md.
