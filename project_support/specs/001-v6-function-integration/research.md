# Phase 0 Research: 첫 위성/지상 지점 검증

Status: 아래 내용은 2026-10-01부터의 연구 결정 이력이다. 이후 Rust 채택·좌표 계약·제품 구현 결과는 plan.md/workflow-progress.md 및 validation/t030_review.md를 따른다. 초기 Python 권고를 현재 Rust 결정으로 오해하지 않는다. 현재 제품 설치 검증은 완료했지만 SC-006 성능 및 전체 후속 기능은 미완료다. 이전 조사/대안은 삭제하지 않는다.

## Decision: 계산 주 구현
권고: Python sgp4 순수 계산을 주 구현으로 사용, 앱이 생성/종료하는 제한된 실행기로 요청을 처리한다. JS/Cesium은 입력/표시를 맡는다. runtime의 현재 상태와 읽기 전용 탐색 결과는 분리한다. 대기열을 제한하고 최신 요청 ID를 적용한다. 실행기만으로 GIL/응답시간 목표 달성을 보장하지 않는다.
Rationale: 입력/단위/오차 기준을 한곳에서 검증하고 renderer와 계산 경계를 유지한다.
Alternatives: JS worker는 브라우저 부하 격리 가능하지만 runtime과 클라이언트 계산의 두 구현 유지가 필요; 처음부터 C++/Rust는 측정된 병목 근거 없음. Worker의 역할은 MDN 공식 문서 확인.

## Decision: 기존 코드 재사용 범위
FastAPI 조립/정적 경로/runtime 종료와 Cesium 카메라 조작은 재사용 후보. 기존 orbit.js의 순수 함수 분리 패턴은 참고한다. synthetic fallback, 음수 고도 clamp, 구면 고도각, 고정 5도/45초/최대 3구간 경로는 새 수치 검증 기준을 충족하는 계산으로 채택하지 않는다. 기존 경로는 회귀시험과 함께 보존한다.
Rationale: 초기 10도 설정, 하루 전체 구간, 높이 반영과 1초 경계 목표에 기존 의미가 맞지 않는다.

## Decision: 검증 계층
SGP4 TEME 원시 위치 -> 지구고정/지상좌표 변환 -> 고도각 -> 패스 경계 -> 웹 결과 일치 -> 성능을 분리한다. Python/JS 두 구현은 계보를 공유할 수 있어 서로의 일치만을 독립 검증으로 삼지 않는다. 공식 Vallado fixture를 기준으로 삼는다.
WGS72 중력상수와 WGS84 지점 타원체는 용도가 다르다. TEME를 J2000 좌표로 취급하지 않는다. UTC/UT1/극운동 적용 여부와 지점 높이 기준을 계약에 명시한다.

## Decision: 입력/가시 구간
저장 원문, 출처, 조회시각, epoch, SHA256 및 형식 defaults를 보존. 같은 시각에 받은 TLE/OMM이라고 무조건 동일 요소로 판단하지 않는다. CelesTrak OMM JSON의 EARTH/TEME/UTC/SGP4 defaults를 명시한다.
거친 탐색과 경계 보정을 분리하고 짧은 구간/접점/잘림/없음/실패를 별도 시험한다. 최초 3개만 반환하지 않는다. 실제 통신 상태는 미확인으로 유지한다.

## 구현 전 미해결 게이트
- Python sgp4 선택 버전과 Python3.14 Windows 설치/가속 지원 검증. 기존 환경 실험을 배포 환경 승인으로 간주하지 않는다.
- 공식 fixture와 원시 입력/출력/변환 기준 자료의 실제 확보, 버전/해시 기록.
- UTC/UT1/극운동을 포함할지 또는 명시된 근사 계약을 채택할지 검증 근거로 결정.
- 제주 가상 좌표는 기존 33.4996N/126.5312E 재사용 후보, 높이는 실제 시설이 아닌 가정값으로 선정/공개. 아직 확정 아님.
- 설치 후 계산/왕복/화면 실측. JS 7.0.1 동등 계산 모드/상수는 별도 확인.

## 공식 근거
- https://celestrak.org/publications/AIAA/2006-6753/ : 코어 코드/검증 자료.
- https://celestrak.org/publications/AIAA/2006-6753/faq.php : TEME/ECEF 및 지상국 절차.
- https://pypi.org/project/sgp4/ : Python 패키지의 출력/상수/형식 설명.
- https://celestrak.org/NORAD/documentation/gp-data-formats.php : OMM defaults/GP 형식.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers : background thread와 DOM 제한.
- https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html : 단일 viewer 구성.

조사 담당의 읽기 전용 확인 및 로컬 코드 정적 검토를 근거로 한다. 설치/수치 시험/실제 웹 실행은 하지 않았다. 자료의 존재 확인과 실제 기준 파일 검증은 구분한다.

## Rust 후보 재검토
사용자 동의로 Rust 우선 후보 조사 진행. rust_core_review.md에 sgp4 2.4.0/MIT/배포/계산 기본값 차이 및 C++ baseline 비교 절차를 기록했다. Python 주 계산 추천은 비교 대안으로 내려놓고 Rust core + PyO3 + Python API + JS UI를 우선 설계 후보로 삼는다. 실제 build/benchmark 미실행이므로 최종 선정 게이트 미해결.

## 실제 Rust/C++ 비교
rust_cpp_comparison_results.md에 동일 ISS historical/WGS72/AFSPC 1,440/86,400 시각 비교 증거 기록. 86,400 Rust18.1175ms/C++batch18.2558ms/C++scalar113.4258ms 중앙값. 최대 위치 차이6.874e-6m. 계산 성능은 동급, batch 경계 중요. Rust 우선 후보 유지. PyO3/좌표변환/API/UI 검증 미완료, Phase0 게이트 전체 완료로 표시하지 않음.

## PyO3 연결 연구 실측
rust_python_probe_results.md: CPython3.14 Windows wheel build/repair/별도venv 설치/9tests 통과. 버퍼 반환 총20.01ms(86400시각), C++20.08ms. batch+소유buffer 반환을 우선 설계. 변환/time/independent fixture 및 실제API/웹 연구 게이트는 남음.

## 고정 자료 수치 시험 후속
coordinate_probe_results.md: 저장된 IERS B 및 윤초 자료 해시 확인 후 재실행 통과. Phase0 공개 위치fixture/고도각/경계 부분 증거 확보. 일반 날짜/윤초/EOP 범위/짧은구간/속도 및 Rust 변환 통합은 미완료. 연구 문서의 이전 미실행 상태는 해당 범위만 이번 증거로 갱신한다.

## 계산연구 검증 게이트 결과
coordinate_probe_results.md 최종 묶음 참조. 확장17시험+Rust연결9+기존회귀35 통과. 공개fixture/윤초UTCJD/자료범위/짧은구간·접점·공백/속도0LOD/전범위배치 및 하루가시탐색 성능 확인. 계산연구 실행게이트는 해당조합 내 완료, 제품구현 및 UI 검증과 배포설계는 별개. 다음은 Phase1 문서의 stale 입력을 수정한다.

## Phase1 설계 정리
plan/data-model/contracts/orbit_api 및workspace/quickstart를 현재검증조합으로갱신했다. 기술문서의미합의TS/Vite권고는backup보존후JS/Rust전파+Python좌표조합으로수정했다. 공개route는별도prefix/ADR, currentstate는runtime기존구성요소, artifact버전은plan참조. 연구gate의배포/UI미검증은제품task에서검증하는사항으로명확히분리. 제품source변경없음.

## W03-A 재사용 결정
Decision: 기존RF-Friis-v1 계산/POST API와모든11입력을편집하는새V6패널. 사용자A승인. Rationale: 선배기능을작은단위로연결하고기존계산/legacy회귀를보존하며숨겨진장비기본값을배제한다. Alternatives: legacy패널복사(숨은고정값존재), ISS전용프로파일우선(서비스/장비미선정), 새RustRF계산(실측병목근거없음).
독립연구검토: 반올림전margin으로status결정, HTTP422배열의필드별오류표시, 정확한exclusive/inclusive경계, 전체요청echo/유한결과검증, generation/abort/사본필수. 공식ITU/ARISS는rf_workspace_review.md 조사출발점이며실조건확정자료가아니다. A구현연구게이트완료, F001실조건/모델충족구간은계속열림.

## 2026-10-04 ISS APRS 부분 프로파일 조사
ARISS https://www.ariss.org/current-status-of-iss-stations.html 확인 UTC2026-10-03T17:12:27Z, 공지 기준2026-09-25: Zvezda/RS0ISS APRS437.825MHz와 troubleshooting/testing. SSTV437.550MHz Oct2~6 공지도 공존하므로 현재 APRS 운용을 자동 확정하지 않는다. https://www.ariss.org/contact-the-iss.html 의 일반 최대 전력은 이 운용의 실제 전력 근거가 아니다. https://www.ariss.org/uploads/1/9/6/8/19681527/k9jkm_2012_symposium_ver2.pdf 의1200baud는2012년 설명이며 현재 장비 조건으로 적용하지 않는다.
읽기 전용 연구/원본1a1e00297a0301637455b0ef2cf48b2e74576b07 검토: 기존 RF 함수/API 재사용, S/X/Ka 대표 접시/잡음 모델을 UHF 장비로 적용하지 않는다. 사용자 장비 없음에 따라 주파수 외 numeric 값은 모두 사용자 가정/unknown. 네트워크 live 조회 대신 출처를 가진 버전 snapshot을 제공, 고정 source 시점을 표시한다. 나중 장비 선정/도플러/복조/실제 수신 증거는 F001 후속.

## W03-C 재사용 결정
사용자는 거리/도플러 대신 선배 경로·접촉 계획을 선택했다. 원본 rf_network.py calculate_route/contact_plan 및 HTTP route/contacts, network.communication은 기존시나리오기능으로재사용한다. 읽기전용연구는정적graph/quality/장애제외와벽시계합성일정의의미를확인했다. 대안: ISS 지상거리/도플러는공식자료와현재위치·속도계약추가검증이필요하므로F001후속. oisl.js는별도원본의위성간LVLH전제라그대로UHF지상수신으로이식하지않는다. actual ISS/GP2020시간과시나리오계획2026벽시계분리. source runtime복제없이결과사본만표시한다.

## W03-D 재사용 및 근사 결정
Decision: 기존 Rust native 위치·속도 및 scalar TEME→ITRF를 재사용하고 원본 oisl.js pointingTo의 range_rate=dot(relativeVelocity,displacement)/range를 순수Python으로 이식한다. Rationale: 기존본체에 지상링크 Doppler API는 없으므로 optical 전체모듈 복사·renderer접속은 맞지않으며 검증된 기하/계산 경계를 유지한다. Alternative: 브라우저 새SGP4/finite-difference만으로속도생성/기존sample wire변경은 거절. 공식profile는 기존 controller검증을재사용하며 기존신호프로파일을 현시점운용으로해석하지않는다.

독립 research agent read-only 확인: ITRF 지상속도0/회전속도 ω×r 차감/단방향 계수1/received−transmitted 부호 타당. 근거 https://celestrak.org/publications/AIAA/2006-6753/faq.php 와 https://ipnpr.jpl.nasa.gov/progress_report/42-121/121B.pdf (후자는counter측정량부호를우리Δf와혼동하지않음). 검증은analytic 및Astropy별도변환(공유이론/ERFA),거리central difference h=1/.1/.01초. 측정정확도증거아님. 미결과학설계0.

## W03-E research
읽기 전용 연구 agent 검토: native propagate_instants 1회 Nx6, SI TAI TimeDelta 균등grid+UTC9digits/endpoints, 기존 속도 변환/내적식 재사용. 대안 601 HTTP 또는 scalar601회는 경계비용 때문에 제외. 결정 count=min(601,ceil(duration)+1), 요청 count 없음/서버통제. 오류 행은 변환에서 제외/gap, 부분실패 전체 요약 없음으로 보수 표시. 동률 가장 이른 표본, abs최대는 부호/UTC도 표시. clip은 조회잘림이고 radio 서버는 가시 경계 재확정 안함. 기존 물리 근사 및 단일 모델 그대로, 외부 신규 이론/라이브러리 도입 없음. 조사만이며 성능/통신정확도 근거 아님. NEEDS CLARIFICATION0.


## W04 기존 코드 조사
Decision: communication/http/missions.py의 네 경로와 MissionRuntime을 그대로 호출한다. API를 새로 만들거나 legacy store 전체를 V6에 복제하지 않는다. bootstrap의 missions 사본을 사용한다.
근거: 기존 tabs/mission.js는 고정 selector와 legacy global store에 결합되어 있으므로 화면 흐름만 독립 패널로 연결하고 서버 로직을 재사용한다. 작업 predecessor는 null이면 보존되지만 빈 문자열이면 해제 가능하다. 미리보기는 diff만 반환하며 mission.tasks와 validation은 현재 계획이고 이벤트는 생성한다. 적용은 현재 계획 재계산으로 exact preview CAS가 없다. 표시로 의미를 구분하며 계산 변경은 이번 범위 밖이다.
Alternatives rejected: 새로운 재계획 알고리즘/AI, 서버 현재 상태 중복, 원본 UI 전체 이식, 기존 퍼센트 축을 분으로 변환. 모두 사용자 재사용 목적과 맞지 않는다.

W05: runtime.py/telemetry.py/state.py/browser/api.js 기존 경로 확인. 계산은 fault kind만 전역 반영, target/severity는 metadata. reset/scenario는 임무 보존, step=max(speed,1). wire command revision 없으므로 HTTP 확인 뒤 stream matching barrier와 명시 재조회 사용.

W06: reports.py는 별도 GET마다 새 snapshot evaluate를 호출한다. CSV UTF8 BOM/6열에 provenance가 없음. JSON은 generated_at/runtime/analytics/events. 따라서 CSV원문미리보기, JSON동일응답표시·freeze 후 원본바이트저장. 기존 KPI02는현재 delay cache, KPI03활성장애경과, KPI04모의auth. samples/missing은원본seq/상수, 실측아님. analysis.js에 filters/detail/trace/recentevents/300 history/220ms재생과 chart50/60이 있으므로 기능 연결에 포함하고 reference60은표시용으로설명.

## W07 source review
Sources read: communication/http/hil.py/schemas.py, digital_twin/runtime/state.py183~215, simulation/mock_hil.py, model_library/devices.py, legacy tabs/hil.js. Reuse original connect health>=88, sync factors .84/.55/.65 and LOCKED, loopback +1 cap100, preflight50µs/recording/allconnected, sequence S1–4 (+S5 fault_recovery). preflight named sequence also runs4steps. Recording onlyflag; zero-offset fallback originallimitation; no actual command sequence. UI-only legacy IO estimates 3.8+throughput/100 and30+sequence%17 explicitly synthetic. No tech unknown requiring research agents or external browsing; no new dependency.

## US10 기존 구현 근거
communication/http/catalog.py의 group/q/orbit/offset/limit 및 data/catalog/access.py의 2h GP/24h SATCAT 캐시와 stale/demo-fallback/upstream-unavailable 확인. records.py의 필터/페이지/derive_orbit와 legacy tabs/orbit.js 상세 재사용 근거 확인. cache source를 사실로 표시하고 derived 궤도 수치는 서버값이며 MEAN_MOTION 부재 때 생성되는 0은 UI 미확인으로 처리한다. GP fallback fetched_at은 상세 응답시각이며 원본GP획득시각으로 표기하지 않는다. 새 stack/계산/API/schema 필요없음.

US10 validation clarified: successful SATCAT responses use24h cache; GP fallback is not inserted into successful profile cache and retries SATCAT on subsequent detail query. Golden test retains original3 HTTP calls for GP1+SATCAT2.

## US11 사전검증
실제기존Rust에카탈로그ISS OMM(epoch2026-10-04T01:53:16.268928000Z)주입/native성공. 기존IERS-B끝MJD61273, installedIERS-A끝61673;현재epochUT1/극운동status2(예측). 공식Astropy IERS docs https://docs.astropy.org/en/stable/utils/iers.html 및 IERS API 의 FROM_IERS_A_PREDICTION 구분확인. noauto-download/기존Bhash보존/별도Ahash로정밀계산 가능;실측위치의증거아님.

## US12 decisions
Original HEAD1a1e002: ground_station_sites.js supplies29 upper-case keys/5groups; imports12STATION_PRESETS and17 extra sites. Extract only used preset data, preserve sites/group functions. Original station_card.js option/coordinate/card functions reused; visibleSatelliteCount unused and excluded. Existing renderer addGroundStations/styleStations/flyToStation/pick semantics retained within render-only OrbitGlobe, without original synthetic propagation or station link claim. Selection is visual, existing manual virtual-point controls unchanged. User approved list/shared-globe connection; routine choice defaults no selected station. Prototype metadata is not current facility evidence and requires F001 verification before RF application.

US13 decision: reuse createGroundPanel run + createOrbitSelection.setGround (preserveUtc), orbitRadio and visibility APIs. Senior preset lat/lon/mask are reference assumptions; height datum unknown, so preserve editable WGS84 height rather than reinterpret altitudeKm. Alternative automatic apply rejected because selection is presentation state and would silently overwrite runtime. Catalog stateless geometry does not become stored orbit input; this increment uses existing saved GP calculation.

US14 decision: nativebatch/timecodec/samplebufferreuse. Source orbit.js renders observerazimuth/elevation/range with h0 assumption and clockreplay; originalglobesatellite.js replacedbyalreadyapprovedRust/preciseITRFpath. ExpectedGP hash pins each buffer toselectedsource. Range/azimuth are sameENU geometry, geometricconstraintonly; actualRFunknown. ReusingstoredselectioncommandsrejectedbecauseitwouldmutatestoredGP/UTC.


US15 Phase0 research (read-only agent catalog_batch_research): Catalog.get_satellites(limit=0) already returns fullcopiedgroup; currentnative only oneorbit×manytimes. Add manyOMM×offsets export with Python doubleJD/leap semantics; no newRustUTCauthority/dependency. Native callbound50000, largerfullgroupchunked ratherthantruncated. Cache Python validation/epochs bycontent hash and sharedEOP/UTC lookup/rotation. Bounded100microprobe: nativeOMM1row100calls0.0001674s, Pythonloadinput100calls0.0413915s, historicalorbit/noEOP/HTTP/render; not16k-performance evidence. Alternatives: 100page loop rejects originalfullscope; JSpropagation violates chosenRustprecision; perrowfullgeometry repeatsUTC/EOPwork. Actual build product tooling/build_orbit_wheel.ps1, maturin1.15.0/cp314Windows64/receipt+DLLlicensing; clean install before servervenv. All design unknowns resolved; actuallargebenchmark is verification pending. Original3Dmeans Cesiumscene mode plus type-basedrepresentativeSVG in legacy.html, not exact GLBasset. All originalview/track/pass/sun functions retained as T075 subsequent scope.

US16 decision: originalglobe.rebuildPath uses period1440/mean_motion minutes, coarse120 steps, dense±45s/.1s (actual constants override stale one-second comment). Preserve same known GP geometry using Rust/preciseITRF, explicitly add offset0 ifveryshortperiod sampling doesn't hit it. Original24h passes use30s sampling/peak/bisection and partial-boundary labels; reuse alreadyverified product1s/refinedsearch instead of duplicating JSpropagation. Sourceplot/table/timeline/AOSseek and complete/missing distinctions retained. ReferenceHEAD1a1e002verified using per-command safe.directory, no globalconfig change. Alternatives: reenableJS SGP4 violates chosenprecision; drive storedorbit visibility mutates unrelatedinput;601seconds playback buffer cannot cover onefullperiod/dense.1s or24h visibility, so add readonlyselectedquery contracts. No new external research or dependencies.


## 2026-10-05 original model audit correction
The earlier US15 statement excluding actualGLB assets was a source-review error and is superseded by catalog_view_source_audit.md:50GLB/37,202,844bytes,56manifest mappings, actual SatelliteModelLayer glTF rendering/follow and mapping-quality/thumbnail/credits. Preserve originalfunction scope, including those functions. The historical statement is retained as superseded evidence, not a design decision or an exclusion. Next specify/plan/tasks owner must cover GLBmodel lifecycle plus scene/sun/imagery/labels/camera; runtime unchanged at this audit.

## US17 display research, 2026-10-05
Decision: reuse original 2D/3D, provider selection and exact map style/palettes in the existing oneViewer, retain current NASA BlueMarble default. Rationale: faithful source function integration and existing saved-state/clock boundaries; provider-ready atomic replacement fixes removal-before-load without changing original options. Alternatives: extraViewer, automatic propagated position, new framework rejected as duplicate ownership/unneeded scope. No unresolved US17 technical choice.
Read-only research agents completed original model and solar audits (no downloads/edits). GLB50/manifest56 are actual source assets, not SVG-only; 44Draco/10WebP need codecs; Terra has two used missing external TGA textures, so header/hash validity is not renderability. Future model owner must verify source textures, convert/embed PNG with derivative provenance and actual render, preserving originals; absent textures remain explicit faithful-acceptance gap, not silently excluded.
Solar owner: current Astropy get_sun GCRS + ERFA c2t06a using injected TT/UT1/xp/yp and frozen leap/EOP; same immutable direction for light and indicator; disable fabricated trigonometric fallback. No implicit IERS/download. Preserve original occlusion/offscreen/2D/preferences/lifecycle. Exact UTC on seeks and accelerated sample/interpolation contract remains to design before solar implementation. This research does not prove model/solar completion or close T075–84.


## US18 model/camera decisions
Decision: reuse original model resolver, SatelliteModelLayer and camera_motion mechanics with the established native position/UTC boundary. Rationale: faithful user-requested original behavior and oneViewer/state ownership. Alternatives rejected: another Viewer, original browser propagator, drawing only SVG or generic ISS for all satellites, creating new attitude measurements. Existing native sample buffer provides +1s geometry when valid; ENU fallback is explicitly a display approximation. Exact epoch without buffer supports point/model position only, not invented velocity.
Decision: preserve source raw assets/manifest and produce a separate validated runtime package with dependency receipts and explicit derivatives. Rationale: GLB headers/hash alone missed active Terra TGA dependencies; source labels contain garbled text. Trusted intact titles and documented metadata changes avoid fabricated attribution. Alternatives rejected: drop Terra mapping, map it to another generic asset, pretend untextured render is faithful completion. Pinned NASA source tree and official Terra FBX/GLB distribution checks are consolidated in model_solar_source_research.md; missing authoritative textures remain an implementation acceptance gap, not an alternate success definition. Package repair task must preserve this gate.
Decision: port original wheel/focus/follow/morph mechanics into existing owned handler, inject monotonic easing ticks and sampled UTC. Rationale: original camera movement is tested and independent from runtime. Default Cesium zoom and model zoom cannot both consume a handled wheel. New API/physics/rate timer is unnecessary. Original selected shape state and source quality are reused in application panel, while actual GPU readiness/errors are separate.


## 2026-10-05 metadata encoding correction
Direct UTF-8 byte/JSON inspection of original manifestSHA7a88f531 found0 U+FFFD characters; runtime validator reports0 presentation repairs. Prior descriptions of garbled source labels/providers were based on terminal decoding artifacts and are superseded. Original intact Korean labels/credits remain unchanged; defensive corrupted-input repair tests remain appropriate. This corrects source evidence without narrowing model/quality/credit requirements or removing any tasks. Actual package dependency/Pillow pixel check49models/76embeddedimages/50thumbnails passes; Terra active2externalTGA dependencies remain unresolved.

## US19 sampling decision (2026-10-05)
Decision:601samples at1SI-second cadence, normalized adjacent interpolation, exact requested start, no extrapolation,120SI-second prefetch and latest-context fence; existing display owner priority catalog→stored→scene. Pure get_sun GCRS/c2t06a with injected EOP, local leap initialization already owned by snapshot loader.
Rationale: aligns with existing buffers/leap-aware UTC and keeps60x playback away from per-frame HTTP; 1e-6rad model consistency is an explicit test gate, not assumed accurate ephemeris. Sources Astropy get_sun and ERFA c2t06a checked2026-10-05; original source885–969 actual read. Alternatives rejected: original minute-hold direction drifts with accelerated UTC; wall-clock Cesium light violates display UTC; TEME fallback has wrong frame; browser propagator/new engine violates chosen native geometry boundaries. Pending verification: precise sample accuracy and current-state owner assembly, not a remaining user preference question.
# US20 decisions, 2026-10-05

Decision: retain source Kepler+J2/GMST/low-precision Sun/cylindrical shadow through additive Rust node kernel in the existing crate; preserve GP SGP4 exports and precision contracts. Evidence: directly read source model/dynamics/node_scene/editor/store/deployment/API/runtime and original91golden, current native crate/time helpers. Rationale: source-faithful calculations with chosen native environment, explicit approximation tags instead of pretending source pseudo-inertial is TEME. Alternative precise TEME/EOP conversion rejected for this pseudo-frame; a separately defined upgraded model needs its own future accuracy contract and cannot silently replace original.

Decision: static orbital validation/summary helper stays pure JS and is injected into node library, while time-dependent propagation is Rust. This preserves responsive editing and avoids concrete simulation/runtime/HTTP dependencies in model_library. Explicit epochs/IDs/storage replace original singleton/Date.now defaults. Copy/finite/uniqueness validation repairs are recorded separately; do not add unrelated abstractions.

Decision: source Unix-ms elapsed convention remains tagged unix_ms_utc_approx; product request grid uses existing SI/UTC owner. Unsupported leap epoch/row is explicit failure, no collapsed timestamp or fallback. Retain source120 path samples/30second refresh/64models,240nodes and max50000 native rows. Full601-grid240-node queries are chunked <=83nodes and assembled atomically; measure overhead and keep game frame failure visible. These are design budgets, not new performance evidence.

Decision: original shared data deployment client/server transaction is required, including T079 isolated-v1 module activation. Local display-only deploy is incomplete. Source initialize automatic restore POST is replaced with readonly GET to preserve product restore semantics; explicit deployment retains serial/revision/idempotency/receipt/rollback rules. When module is unavailable,503 is required, no stub acceptance. Source files/source gaps and T079 dependency recorded in validation/t076_source_boundaries.md. T139 design is additive to current feature, all earlier requirements/tasks preserved.


2026-10-06 N004 original OISL priming discovery: source communication/network_twin.js PRIME_STEPS_S=[120,60] executes historical source states before current tick; source resolver is not equivalent to starting with empty history at current time. Existing shared native sample coordinator has one601-row forward/reverse window; forward first-start omits historical prime instants. Preserve source priming via actual native common-time receipts coordinated with existing sample/track query ownership. Retain no-new-clock/JS-propagation/full-node/future-grid/explicit-failure constraints. Verified snapshot producer remains pending until this prerequisite is implemented and tested. Source resolveLinks component evidence validation/t077_node_link_resolution.md.

## N016 original ground network cadence

Readonly pinned senior communication.js165-180/909-916 computes networkTwin.tick
and sends source snapshot at1000ms; onFrame876 onlysyncsgeometry. Current exact
V6 network owner/manualground panel is already connected but exactUTC expires
on naturalframe, hidesgroundlines/coverage. Preserve captured analysisUTC and full
native input via existing network owner; compose behind same optical1000ms request,
registered readonly NETWORK_SAMPLED_UI_V1 and current native visualendpoints.
Remaining source status30s/passes>=60s/quality48/OISLroute/3Dstation/periodicfabric
are separatelytrackedN017/N018. Automaticexchange must use exactnative/module
context ratherthan sampled visuals. ADR0048 declares the boundary; no newphysics.
