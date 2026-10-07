# Quickstart: 구현 후 검증 절차
2026-10-01 설계, 2026-10-03 상태 갱신. 첫 제품 시나리오 구현·실제 브라우저/격리 설치 검증을 수행했다. SC-006 성능은 미달이며 validation/t028_performance.md, t029_install.md, t030_review.md에 현재 증거를 기록했다. 아래 연구 재현 명령/35PASS는 초기 이력으로 현재 전체224PASS와 구분한다.

## 연구 증거 재현
- project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe project_support/tooling/coordinate_probe/validate_extended.py (17PASS 이력, 고정snapshot/hash필요)
- 같은Python으로 -m unittest discover -s project_support/tooling/sgp4_python_probe -p test_probe.py (9PASS 이력)
- project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/orbit_tests/pytest_temp --tb=short (35PASS 기준선)
- Node관련시험은기존실행환경으로 node --test project_support/tests/browser/*.test.mjs. 새로운시험은tasks에서작성하며이번문서작성에서실행하지않음.

## 제품설치/기동 게이트
project_support 아래격리venv와Rusttoolchain/buildtarget 사용. 고정requirements 및Cargo.lock, wheel명/해시/native DLL출처·license receipt기록. 검증자료/EOP download는명시적준비도구에서만실행. startup은저장hash/날짜범위검증, network자동갱신금지. 첫wheel CPython3.14/Windowsx64지원,다른환경미검증표시.
main.py --host127.0.0.1 --port8776 --no-browser 기존CLI형식에맞춰실행. import만으로서버/시계/네트워크가시작하지않아야함. orbitprefix추가전후기존API/WS시험통과. 최초실행실패는원인표시,synthetic위치fallback금지.

## 독립 시나리오
US1: 저장ISS TLE와OMM각각선택→출처/epoch/age확인→UTC앞뒤이동/재생·정지→같은UTC복귀→ITRF표시와패널시각/자료hash일치. 잘못된입력/EOP범위밖오류. interpolation중간시각도기준좌표10m안확인.
US2: 가상제주좌표/타원체높이/10도확인→threshold변경→모든구간/접점/peak/잘림/없음확인. 24h와짧은구간/공백/접점/자료실패시나리오. 가시성문구는실통신성공아님.
US3: globe드래그/창이동·크기·최소화·복원→입력과결과유지. 늦은응답을의도적으로반대로도착시켜덮어쓰기0확인. 자원실패/계산중/오류후에도주요조작가능.

## 실제브라우저 측정
1280x720/1920x1080,첫위성1/지점1,60Hz이상전경탭,warmup후. browser/GPU/전원/해상도/입력부터render까지marker기록. 프레임p95<=16.7ms,화면피드백<=50ms,시간동일결과<=100ms,24h구간<=1초,p99/max및run원문기록. 연구단순batch시간을브라우저시간으로대체하지않음. screenshot/trace/수치조건을검증manifest에보존. 두해상도에서실제최소화/복원·지구조작을실행하고마지막결과공개.

## 후속
F001 실제서비스/장비/RF조건은공식근거로확인후반영. F002 선배나머지기능은현재단계검토후순서선정. 실제ISS 위치/다른PC설치/실제HIL·replay는별도증거가필요. 이번feature완료로전체목적을닫지않는다.



### 제품 native 빌드 및 설치 (현재 Windows x64 CPython3.14)
빌드 Python에 project_support/tooling/orbit_build_requirements.txt를 설치하고 use_rust_environment.ps1 환경을 사용한다. build_orbit_wheel.ps1의 -PythonPath로 빌드 환경 interpreter를 명시한다. 현재 준비된 빌드 환경은 project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe이며 제품은 이 환경의 probe를 import하지 않는다.
```powershell
project_support/tooling/build_orbit_wheel.ps1 -PythonPath project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe
project_support/.venv/Scripts/python.exe -m pip install --no-index --no-deps project_support/tooling/orbit_wheels/isdc_orbit_propagation-0.1.0-cp314-cp314-win_amd64.whl
. project_support/tooling/use_rust_environment.ps1
cargo test --release --locked --offline --manifest-path digital_twin/simulation/orbit_propagation/Cargo.toml
```
아직 API/UI 연결 전이다. 빌드에 포함되는 DLL 출처/license 및 별도 격리환경 설치 검증은 T029에서 완료한다.


### 저장 ISS Orbit API 실행 profile (2026-10-02)
프로젝트root에서실행한다. 최초한번만prepare명령으로공개과거ISS예제와설치된고정EOP를보존한다. 이미manifest가있으면생성도구는덮어쓰기를거절하므로기존자료를보존한다. native wheel 설치는위절차가필요하다.
```powershell
project_support/.venv/Scripts/python.exe project_support/tooling/prepare_orbit_inputs.py
project_support/.venv/Scripts/python.exe -m uvicorn user_application.web.application:create_stored_orbit_app --factory --host 127.0.0.1 --port 8891
```
GET /api/orbit/inputs의input_id/epoch_utc로selection을PUT하고그revision으로samples를POST한다. 기존CLI/defaultcreate_app과달리이profile이localmanifest를lifespan에서읽는다. V6 위성 창에서 저장 입력 선택과 샘플 계산을 수행하면 공용 Cesium 지구에 첫 행의 UTC/ITRF 위치가 표시된다. UTC 재생은 후속 단계다. 과거epoch2020-07-12이며확보시각은로컬보존시각이다.현재telemetry/현재ISS예측으로사용하지않는다.
검증명령:
```powershell
node --test project_support/tests/browser/orbit_api.test.mjs
project_support/.venv/Scripts/python.exe project_support/tooling/validate_orbit_http.py
```
HTTP검증도구는임시localhost서버를실제로기동하고자신이만든프로세스만종료한다. API목록·선택·위치3행과기존health를확인한다. UI검증은포함하지않는다.

## W03-A RF 계산기 확인
V6 지상국 창에서 RF 패널을 연다. 모든 필드가 빈칸이며 실제통신미확인 안내가 있는지 확인한다. 합성 시험용 링크 이름과10개수치를직접입력해모델계산한다. 출력8개단위,반환status,입력사본,가정이표시되어야한다. 요구Eb/N0를높여모델여유부족을확인하고빈값/범위위반은서버조회전에오류로표시되어야한다.
계산후입력편집은이전결과를지워야하며작업창최소화/복원과다른업무전환후입력/같은결과를유지해야한다. 별도창전달값변경은재계산안내. 기존기하학적가시결과의실제통신미확인표시는유지한다. 두해상도에서패널내스크롤로모든항목과계산버튼접근을확인한다. 서버장비연결/실수신/프레임성능통과를주장하지않는다.

## ISS 프로파일 검증 T037~T040
새 프로파일 API/모듈 미존재에서 RED 확인 후 focused Python/Node 시험. 전체 pytest와 browser/*.test.mjs 실행. fresh stored-orbit server에서 ground RF 패널의 공식 조건 불러오기/주파수 적용, 다른 입력 보존, 재적용 결과 폐기, 편집 출처 강등 및 창 복원을1280x720/1920x1080 확인한다. GP epoch/UTC/기하 판정은 보존하며 실제 수신은 미확인이다. F001/T032 전체 완료로 표시하지 않는다.

## W03-C 검증
기존서버8891의ground에서시나리오통신망불러오기→출발/도착/목적선택→경로조회, 시간파라미터1~72→접촉일정조회. 실제ISS/예약/가시성아닌예시표시와조회UTC를확인한다. 입력변경후결과폐기/취소/오류/복원, 두해상도접근, RF/GP 보존. 전체pytest및Node,원본AST대조. 새서버포트생성금지.

## W03-D 검증
8891 satellite에서 저장 ISS 입력 선택. 서버UTC 가져오기, 주파수MHz 직접입력 또는 ISS 공식프로파일 명시적용 후 거리·도플러 계산. 출력UTC/거리km/거리변화율m/s/DopplerHz/예측수신MHz/고도각/근사조건/실제수신미확인을 확인. 주파수빈값/0/윤초/변경/revision/취소/복원을시험하고RF·GP불변을확인. 전용 project_support/.venv/Scripts/python.exe -m pytest -q 및node --test project_support/tests/browser/*.test.mjs.

## W03-E 검증
8891 저장orbit app에서 지상국 창→24h 가시 구간 조회→구간 선택→MHz 직접 입력 또는 공식프로파일 명시 적용→구간 거리·도플러 계산. 그래프3개/표본간격/접근·이탈/표본최근접/절대최대shift/clip 표시 확인. 취소·주파수0·선택변경·창복원/RF보존도 확인. 전체pytest 및 node --test project_support/tests/browser/*.test.mjs. 생성 근거는 ignored data/workspace/validation/radio_series, 소스 보고서 validation/t054_orbit_radio_series.md.


## W04 임무 화면
8891/#mission에서 서버 임무를 불러온다. 작업 선택→편집/추가/삭제, 충돌 검사, 재계획 미리보기→최신 계획에 재계산·적용, 상태 변경을 확인한다. 실패 시 오류를 읽고 서버 새로고침으로 적용 여부를 확인한다. SIM, 기존 계획 축, 현재 충돌과 미리보기의 구분을 확인하고 satellite/ground 입력이 보존되는지 점검한다.

W05: 8891 #operations 또는 #run에서 서버 새로고침/정지/배속/스텝/시나리오 적용/장애 주입. 장애는 SIM 시간 만료이며 target별 물리 계산이 아님. #mission 상태는 같은 stream으로 갱신. reset은 임무를 삭제하지 않음.

W06: 8891 #data에서 KPI/요구 filter/detail, 세션이력 scrub/replay/live복귀, CSV/JSON 내려받기. 파일 조회는 새 서버시점. CSV는파일행만 표시하며 run/출처없음, JSON다운로드의 동일응답을화면에고정. 세션이력은최대300 수신표본, 실제기록/재생아님.

## W07 checks
8891#em: select disconnected KRS-HIL, verify sync disabled; connect→sync→loopback, preflight BLOCKED→READY after all connected/synced and recording on. Test all three sequences; recording off makes preflight/sequence fail. Restore initial states after demonstration, preserve elapsed/orbit UTC. Verify two resolutions/minimize/restore/native selection, single socket/Viewer. No actual equipment or durable recording. Run test_hil_workspace.py then whole pytest with a new workspace basetemp and whole browser Node tests.

## Catalog V6
Keep fixed0.0.0.0:8891, open /?validation=t074#satellite. Edit group/search/orbit then 조건 적용·조회 button; search name/COSPAR/NORAD, navigate100row pages, click satellite for SATCAT details. Catalog selection does not select stored orbit or change UTC. Source/timestamp/warnings and missing values are shown.

## US12 ground station validation
Use8891 V6 satellite or ground view. Confirm29 total and5 regional groups; chooseDAEJEON orSVALBARD, verify original representative coordinates/details and highlighted marker; globe marker click updates same selector. Clear/minimize/restore/switch views preserve stored GP/UTC/virtual point and satellite. No automatic calculation or RF application. Verify no console errors/duplicate Viewer at1280x720/1920x1080. Node browser suite and full pytest remain required; no extra runtime download/profile needed for static station display.

US13: at8891 select DAEJEON, use coordinates in calculation draft; verify lat36.3742/lon127.3567/mask5 and previous height/range retained. Confirm height; choose saved ISS input; apply and calculate short UTC window with existing buttons. Satellite role distance/radio uses same applied ground point. SVALBARD staging mask3 must retain height. Selection/clear alone must not apply. Catalog ISS remains separate.

US14 verification: selectcatalogISS→GPepochposition/hash→setUTC and assumedvirtualsiteheight→samples→play/pause/speed/seek; compareepochpositiontoequality and originalstoredGP/UTC unchanged. OutsideEOP hidesposition/error,GPchangedrequiresreselect,601one-secondrowsboundandnoperframeHTTP. Actual8891twores/oneViewer.


US15 validation: cargo product release --locked --offline tests including scalarofficial33/668 and manyOMM equivalence/failurealignment/limits. Build actual product wheel via project_support/tooling/build_orbit_wheel.ps1; install exactwheel into clean ignoredvalidationvenv and run old/new native exports. Then wholePython/Node + live8891fullactivegroup at twores: compare entirecount, selectedscene position vsposition/samples sameUTC, inputstateunchanged, groupfilter/pick/late/errors/restore/singlecanvas. Measure coldvalidation vswarmnative/transform vsserializedHTTP vsactualrender separately; no inferred16kperformance frommicroprobe.

US16 validation: on8891 select catalog GP and displayUTC, confirm fullperiod track withdense region/UTC/source andtoggle. Selectrepresentative station withuserheight/mask, query24h, inspect allknown intervals/contacts/clipped/errors andclickAOS toseekselectedcatalog. CheckstoredGP/UTC/observer/SIM unchanged, fullscene/stations preserved and Viewer1. InvalidUTC/EOP/GPconflict removesoldresults; partialnativefailure neverbridgespath. Repeattwores/replay/windowrestore, fullPython/Node andcomparison withexistingprecisioncontracts; recordtimings withoutclaimingSC006.

## US17 validation
Run Node globe_view tests then full existing Node suite and projectvenv python -m pytest -q. At8891 in1280x720/1920x1080 switch3D->2D->3D quickly; inspect north-up and navigation limits; select BlueMarble/ArcGIS/OSM/NaturalEarth, dark/light/emphasis, selected point/track and small-group labels. Verify errors and explicit fallback, onecanvas, window restore, savedGP/UTC/observer unchanged. Dispose/reopen without duplicate callbacks/layers. Source palette golden and status contracts: contracts/globe_view.md. Do not close T075/model/solar/performance from this pass.


## US18 model/camera acceptance procedure (pending implementation)
1. Run `project_support/.venv/Scripts/python project_support/tooling/validate_satellite_display.py digital_twin/model_library/packages/satellite_display/v1` after tooling exists. Expect a receipt for all56 mappings/50 assets, image/GLB dependency closure, provenance/derivative hashes and no silent Terra exclusion. Missing texture means failure, not acceptance.
2. Run `node --test project_support/tests/browser/satellite_models.test.mjs project_support/tests/browser/satellite_model_layer.test.mjs project_support/tests/browser/camera_motion.test.mjs project_support/tests/browser/satellite_hover.test.mjs project_support/tests/browser/workspace_satellite_model.test.mjs` and whole browser suite. Run whole Python with a fresh project basetemp and retain output; new asset/static tests and architecture must pass.
3. On8891 preserve saved-state fields/current report before owned server restart needed for new static mount; document SIM-memory reset and restore GP/UTC/observer. Keep binding/port unchanged. At1280×720 and1920×1080 choose ISS/known exact/series/representative/debris; prove source labels/thumbnail/actualready/error, oneViewer with whole16633/selectedtrack/29stations. Near-model focus, keep-range follow, zoom, drag/Escape release, behind-Earth flight and2D north-up must work; no camera move merely from selecting/reopening.
4. Exercise fast changes, manifest/model/texture failures and explicit retry; compare latest selected native ITRF with primitive matrix. Pause/seek/60x playback must use current display UTC; failure/missing samples hide model and stop follow. Hover whole/selected points displays correct respective UTC/name/NORAD/regime/WGS84 height with safe bounded card, leaves without commands.
5. Sequentially render/decode all50 model assets and thumbnails in the same existing Viewer; store load/error/readiness/provenance receipts and screenshots, including Draco/WebP/Terra. Source-header checks alone cannot replace actualrender evidence. Record full regression/readonly state and source comparisons in validation/t129_satellite_display.md and publish Draftabove31. Missing case remains pending. This does not close solar/T076–84/T032/real RF/HIL/download gaps.

## US19 solar validation (pending implementation)
Run regression tests test_solar_geometry.py, test_solar_samples.py and browser/solar_display.test.mjs, solar_timeline.test.mjs, workspace_solar.test.mjs followed by whole pytest/Node. Against8891 capture stored orbit/SIM state, obtain exact selected UTC samples, compare oracle and1e-6rad interpolation bound. In1280×720 and1920×1080 use actual selection/time seek/60x playback/2D/3D/light preference; verify sun/subsolar light sign, unavailable labels, onecanvas and state unchanged, then restore settings. Save actual screenshots and logs in data/workspace and acceptance in validation/t137_solar_display.md. No live solar assertion until endpoint and workspace are connected.
# US20 node validation guide (planned product integration)

contracts/satellite_nodes.md defines the future product interface; T140–153 are not implemented by this guide. Existing8891 server stays unchanged until the corresponding assembly task.

Offline source evidence can be reproduced now: `node --experimental-vm-modules project_support/tooling/capture_original_nodes.mjs --source-root <approved-reference-checkout> --output data/workspace/validation/ground_stations/t076_original_nodes_repeat.json`. Compare file bytes/hash with project_support/tests/fixtures/original_satellite_nodes.json; do not copy original code into runtime or alter source values to make tests pass.

After product tasks: run full Python/Node, locked/offline Rust product tests and additive wheel installation in a clean validation venv, verifying old GP exports before using the new node export. Use fixed8891 with captured GP/SIM state and documented owned restart. At1280×720/1920×1080, create all4formation presets, switch3modes, edit9equipment kinds/power/orbit/model, save detached member, regenerate formation, test240-bound/error, inspect distinct GP precise-vs-node approximate provenance, replay/seek/reverse60x/2D3D/restore/clear with oneViewer. No automatic server deploy on opening/restoring a window.

With the verified T079 module present, issue explicit node deploy/recall and compare server accepted roster/revision/run/scope plus local sent snapshot. Exercise409/timeout/same-ID retry/activation failure; drafts and accepted state must survive failure. If module is unavailable, observe503 and keep server-deployment acceptance unverified. Real OISL/RF/physical battery behavior is not implied. Measure game frame/UI/API/bytes costs and keep existing T032 gate. Final acceptance needs source comparison/full regression/live evidence and attached Draft; preserve wholeT075–84 and earlier limitations.


### Windows node validation temporary paths (T143)

Full pytest includes a clean-venv wheel installation. A deeply nested basetemp plus the test name and installed DLL/package names can exceed Windows path limits. Use a fresh short directory under ignored data/workspace/v; preserve failed logs and do not change system settings or skip installation validation.

```powershell
New-Item -ItemType Directory -Force data/workspace/v | Out-Null
$validationPath = Join-Path 'data/workspace/v' ('check_' + [guid]::NewGuid().ToString('N').Substring(0,8))
if (Test-Path -LiteralPath $validationPath) { throw 'Validation path must be fresh' }
project_support/.venv/Scripts/python.exe -m pytest -q --basetemp $validationPath
```

Node adapter preparation/row validation is tested with pinned original source rows. Actual new export installation is still gated by T144; a passing old-wheel test does not establish new-node native installation or UI/server acceptance.

### T144 additive wheel verified in isolation

Product0.3.0 adds propagate_nodes while preserving WGS72_AFSPC TLE/OMM/catalog exports. Actual isolated calls match62source states and668official SGP4 states; metadata/owned rows/errors/50000boundary are recorded in validation/t144_node_native.md. Current server environment remains0.2.0 until T151's owned8891 integration/restore gate. Isolated package validation is not actual UI/accepted deployment or another platform's installation proof.

Runtime .venv intentionally has no build tooling. Use the established separate pinned builder for product builds:

```powershell
& project_support/tooling/build_orbit_wheel.ps1 -PythonPath (Join-Path (Get-Location) 'project_support/.venv_orbit_build_t029/Scripts/python.exe')
```

Set ISDC_ORBIT_INSTALL_WHEEL to the exact produced product wheel and run test_orbit_install.py with a fresh short basetemp as described above. The test creates its own isolated environment; it does not install into the running application environment. Inspect build_receipt.json and isolated_call.json before claiming an installation gate. Build and other-platform distributions remain explicit workflows rather than startup actions.

T146 verification cache note: if the existing project_support/.pytest_cache/v/cache is inaccessible, preserve its ACL/files and pass -o cache_dir=<absolute fresh unique directory under data/workspace/v> to pytest. A fresh cache target run wrote its actual nodeids record (2 tests) without cache warnings. Continue using a separate fresh short --basetemp; neither directory is source or a reason to skip tests. Full545PASS remains recorded with its original ninth cache warning.

### N016 forthcoming source network display verification

Afterimplementation, focusedtests must showcaptured optical/native exactanalysis
UTC, full240nodes/24stations/fault/hash, naturalcurrentendpoint animationwithout
RAFanalyticalqueries, visibleUTC/age/unknownfabricquality, sameUTCpause/seek/source/
config/failure/disposal revocation, and unchanged exactsend/route/action rejection.
RunfullNode andpytest plus actual8891tworesolution/GPUchecks; no source reset or
clock/Viewer/nativeinstall/portchange. At this designcheckpoint N016 is notready
forlive successclaims, and N017/N018 remainexplicit sourcefunction residuals.
N017 status/history validation: test active-only30second timers, duplicate status
dedupe, hidden/late/endpoint/command/disposal cancellation and uncertain-review
preservation. Compare49 verified quality receipts→48 samples, unknown vs unusable,
natural UTC historical retention and foreigninstance scope pruning. Confirm source
sparkline/labels and exact action buttons in two resolutions. Fullfuturepass and
station/route/GPU gates remain separate. See contracts/network_lifecycle.md.
For N017c–e, open the existing8891 ground view with verified native/sampled ground
geometry. Click an owned operator station: only its existing editor selection
changes. Double-click or use explicit focus: camera releases model tracking and
flies to source2400000m/1.4s. GP reference selection, display UTC and runtime remain.
Hidden/removed/changed station, fake properties IDs, morph and external edit conflict
must not select/fly. Repeat both resolutions; preserve original parent/SIM inputs.
Run station interaction focused Node tests, full Node and full Python before review.

N017f input port validation requires a clean actually accepted full deployment and
enabled station. Capture while paused, then check same source/UTC validity and
copy rejection. On actual catalog continuity, natural UTC movement preserves the
original analysisUTC; pause/seek/source/config/dirty/clear/hide/disposal revoke it.
Verify missionInputs still rejects playing clocks. No new HTTP or SIM commands
should occur from capture/verify. Run the new actualowner RED/green coverage and
whole Node/Python; future query/12row/growth/real screen evidence remains later.

Complete a sameUTC stored seek/pause between two verifications: the old token must
remain revoked even though the displayed context is identical. Exercise actual
SIM/scenario API-entry pending, nested requests, error/synchronous throw and late
finally release; no capture while pending and no resurrection afterwards. Normal
GET/telemetry must not introduce a synthetic control. Optional actual owner
observers preserve existing request arguments, result/error and request count.
Attempt capture after HTTP resolution before controller adoption/cleanup; pending
must still reject it. No timeout/microtask delay guesses may replace owner scope.
At terminal callbacks exercise actual owner control/store/display invalidation
and changed returned running/readiness/lease values. Readers must remain
observational; do not replace production ownership with secretly mutated raw
arrays in a getter or claim finite reads prove all such unrelated mutations.
