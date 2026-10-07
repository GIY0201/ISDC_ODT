## 2026-10-07 N019 분석 경로·지상국 상세·선택 링크 RF 연결 회귀 통과

원본 통신 모듈의 등록된 과거 분석을 기존 SVG/공용3D 실제 링크에 연결하고,
분석/표시 UTC를 구분했다. 전체240 native 정의/hash/전체hop 검사와 철회 가드를
유지한다. 지상국 상세 초점·편집, 원본 선택 지상 링크의11필드→기존 RF 계산기
명시 초안 전달을 보완했다. RF/OISL/모듈 계산식은 재작성하지 않았다.

모든 작성자 수정 중지 후 전체 병렬 회귀: Node1878PASS0FAIL0SKIP26050.4651ms
exit0(19218), Python967PASS1기존PillowSKIP8기존ERFAwarnings272.95s exit0(24920).
로그 data/workspace/validation/full_N019_node.log 및 full_N019_python.log.
실제 ASGI/Rust0.3.0/720행→JS→원본 모듈→helper 시험도 전체 Python에 포함됐다.
독립 helper/renderer/ground/RF 조립 검토는 추가 차단 결함 없이 통과했다.

실제 화면에서는 보존된2020 ISS GP/current2026UTC의 확정B EOP범위가
2026-08-21까지여서 samples422다. 별도 현재 catalogA는 예측 자료를 지원한다.
기존GP/UTC/SIM/40수락배치/8891을 임의 변경하지 않았다. 실제 두해상도/
모든모델/GPU/게임성능/전체75–84/T032/PR은 미완료다. 최종 원본 대조에서
scenario:route의 지상 화면 선택값 인계 누락을 확인해 ADR0057로 남겼다.
원본 objective 즉시 조회와 현재 명시/periodic 조회는 선언된 정책 차이다.
Git HTTPS 인증 부재는 유지되며 이력 재생성/강제 push/브랜치 삭제는 하지 않는다.

## 2026-10-07 N018 주기 통신 연결 변경 묶음 회귀 통과

기존 raw 분석 owner/수락 배치/통신 command lane에서 원본1초·MIN900·동일UTC
새 sequence 교환과 수락 후 선택 경로 갱신을 연결했다. UI는 분석 UTC를
보존하는 등록된 결과로 전체 DTN/품질/custody/경로 상세를 표시하며 exact
현재 승인으로 승격하지 않는다. 지상국과 위성 상세 초점·편집·링크 A/B,
보안 자동 관측도 기존 owner에 연결했다. 독립 발견 callback/오류 복귀/
불확실한 전송/교차-origin 반환 문제는 회귀 RED 후 수정했다.

최종 전체 Node1767PASS0FAIL0SKIP23203.4191ms(exit0,99750), 전체 Python966PASS
1기존PillowSKIP8기존ERFAwarnings249.33s(exit0,39805). Python 이후 변경은JS이다.
validation/periodic_native_fabric_exchange.md와 실제 전체 로그 참조.

움직이는 시각의 SVG·3D mixed route/품질/보관 표시가 아직 원본과 다르므로
ADR0055/T166–T168로 연결한다. 실제8891/모든모델/두해상도/GPU/게임성능,
전체T075–T084/T032 및 PR 미완료. 서버GET health는 기존RUN-904CE008D00B/
paused/SDC_POC_01을 확인했다. 서버상태/8891/수락배치/브랜치를 보존했다.
## 2026-10-07 N017 native 미래 통과 연결 및 병렬 이식 검증

선배의 전체 수락 목록/선택 지상국/3시간/위성별 첫3/안정 AOS 정렬 첫12와
엄격한 UTC 차이>60초 갱신을 기존 native 조회 및 ground UI에 연결했다.
전체 응답 검증과 승인 경계는 유지한다. 실제 기본 Rust0.3.0/생산 API/
JS owner 240개→135개 원시 통과 검증1PASS22.88초, 조회 전후 궤도 상태 동일.
전체 Node1624PASS0FAIL0SKIP22504.7643ms, 전체 Python966PASS1기존PillowSKIP
8기존ERFAwarnings270.32s exit0. 첫 Python의164setupERROR는 basetemp 상위
폴더 부재로 재현했으며 원본 실패 로그와 수정 후 전체 로그를 함께 보존했다.
validation/native_future_passes_connection.md 및 data/workspace/validation 참조.

추가 연결: custody 전체 행 보존, 경로 출발·도착 선택과 3D 혼합 경로 강조는
독립 검증 중이다. 경로 강조 최종 callback 이후 실제 Viewer/UTC/owner 변경
문제를 발견해 회귀 수정 중이다. 변경 후 전체 회귀는 아직 수행 전이다.
불변 네트워크 구조 검사 최적화는 CPU 증거이며 GPU 성능 통과를 뜻하지 않는다.
N018 주기 통신 교환과 보안 live 관찰 연결, 실제 두 해상도/모델/GPU/성능,
전체 T075–T084/T032와 PR은 미완료다. 정오 완료 목표로 병렬 진행한다.
Git push dry-run은 비대화형 HTTPS 인증 부재로 실패했다. 변경/로컬 이력과
기존 브랜치/8891/SIM/수락 배치를 보존하고 인증 우회나 이력 재생성을 하지 않았다.
## 2026-10-07 N017f 미래 통과 입력 경계

기존 workspace owner에서 실제 전체 수락 명부·활성 지상국·분석 UTC를
등록된 불변 값으로 읽고 검증하는 포트를 연결했다. 저장/SIM/시나리오
제어 진입부터 실제 상태 반영과 정리까지 scope를 유지한다. 기존 정지
임무 승인 조건과 서버/SIM/배치/8891/브랜치를 유지하며 새 HTTP·계산·시계를
추가하지 않았다. Context7 공식 MDN 비동기 정리 문서를 대조했다.

입력15개/관찰5개/rootDI/invalidstation RED 후 수정, workspace87PASS,
독립 최종27PASS 및 invalidstation1PASS. 전체 Node1565PASS0FAIL0SKIP
23841.0923ms exit0, Python965PASS1기존PillowSKIP8기존ERFAwarnings233.65s exit0.
Python은 마지막 JavaScript validator 반환 수정 전 실행했고 Python 변경은
없다. whitespace 통과. 증거 validation/future_pass_inputs_connection.md와
data/workspace/validation/full_migration_{node,python}_N017_future_inputs.log.

입력 포트는 실제 owner의 관찰 사본·증명 및 기존 무효화 이벤트를 요구한다.
미래 통과 native 조회/UI3h/max3/12/>60s/current 표시와 mixed route/N018,
실제두해상도/GPU/성능/T075–T084/T032 및 PR은 계속 미완료다.

## 2026-10-06 T151 shared node renderer binding partial
Continue T075–T084 on the same codex/satellite-node-integration branch. Add explicit bindNodeRenderer/readonly status observer to the existing workspace globe; bind the existing Viewer and preRender event, read its common canonical display UTC, and use monotonic performance only for qualitative animation phase. Missing common UTC passes null and hides actual NodeScene points. No Viewer, analysis clock, native query, background timer, storage or server command is created by this binding. Preserve GP/catalog/stations/solar owners. Rebinding, preboot, factory/frame errors, reentrant replacement, queued callbacks, global render failure and disposal release only owned node listeners/resources. Focused10PASS172.2181ms including actual NodeScene/source-captured metre positions/common UTC/foreign primitive preservation, rather than only accepting a permissive renderer callback. Initial4missingmethod RED; test doubles repaired to include the existing globe focus and canonical source-time input; product UTC guard unchanged. FullNode622PASS4001.0294ms; fullPython649PASS8existingwarnings164.41s(session94084exit0); syntax/whitespace PASS. Evidence validation/t151_node_renderer.md. No live8891/native installation/browser/remotePR/merge/branch change.
N005 OPEN: existing SatelliteModelLayer.nativeAt requires ITRF/catalog_number/normalized_gp_sha256, while source NodeScene suppresses its selected fleet model and delegates the selected model to that layer. Native source node geometry has EARTH_FIXED_GMST_UTC_APPROX/node_id/definition_hash. A direct sampler connection would be rejected; relabeling native coordinates as precise ITRF is forbidden. Owner T151 selected model/pose composition; trigger before selecting node/focus/full UI assembly. Add explicitly validated source-node pose/domain support to the same selected-model/camera lifecycle, preserve all original GP checks, current complete definitions/hash/UTC/profile/frame/source/quality and display-orientation approximation, then verify native and GP cases. No second selected-model renderer or copied pose authority. Keep N005 open until that actual implementation/verification exists.
Next: N005 selected model domain support and workspace node panel/store/native timeline/optical producer/client/scene-composer assembly, controlled native installation and before-state capture/restore/owned8891 restart. T151/T152/T153 and wholeT148/T076/T077/T079/T075–84/Terra/all50/N001/T032/T137auth/equipment/RF/HIL/file bytes remain open.

## 2026-10-06 T151 server composition partial
Continue the full T075–T084 goal on the existing codex/satellite-node-integration branch. Mount original node sample/track and deployment routes in the real create_app; default node query shares the existing bounded orbit executor. Per-app source isolated-v1 data module/bridge accept explicit deployment under runtime transaction; startup/GET do not activate scopes, backfill products or mutate configuration. New application tests RED4 failures, then target48PASS1warning1.88s; contract/architecture8PASS1warning3.84s. First full Python648PASS1OpenAPI allowlist FAIL8warnings162.29s; add precisely approved3paths/5schemas, original baseline unchanged. Actual isolated wheel3PASS1warning8.83s now forwards Rust bytes through default application/ASGI/shared executor/adapter/query→JS timeline/producer/verifier. Second full648PASS1catalog-scene readonly FAIL8warnings179.45s: normal200ms running SIM tick changed time/sequence. Isolated unchanged probe1PASS; test pause before baseline retains exact whole-state comparison, product clock untouched. Repair target19PASS1warning18.15s. Final fullPython649PASS8existingwarnings176.45s(session74585exit0), fullNode615PASS3900.9173ms, whitespace checks PASS. Final receipt install/9690d8cd11a04dd0aafb47f0c4cf5e0b/isolated_call.json: native_application_requests3/Rust60rows/maxnumeric5.4569682106375694e-12/time0ms/verified_snapshot=true/wheelSHA unchanged. Original root remains clean, native0.2.0 reverified. Readonly8891 preflight: ownedISDC PID37724, healthok, SIM/ISS playing; no restart or installation. T151 stays unchecked: actual panel/store/timeline/NodeScene/model/client/common Viewer/display owners/scene-composer assembly plus controlled native installation and before-state capture/restore/owned8891 restart remain. T152 live matrix/T153review and wholeT148/T076/T077/T079/T075–84/Terra/all50/N001/T032/T137auth/equipment/RF/HIL/file bytes remain open. Evidence validation/t151_node_application.md.
Branch steering: user questioned excessive GitHub branches. Existing local refs include per-feature PR and local validation/preservation branches; local main alone is marked merged, which is not current GitHub PR evidence. Keep incremental fixes/tests on one feature-review branch, create new branches only for distinct review units when needed. Do not automatically delete unmerged work or merge PRs. No branch created/deleted/pushed this turn.

## 2026-10-06 T077/N004 optical history and verified consumers
Preserve full T075–T084 goal. Resume existing feature/controller and 8/8 checklist/no-extension gates. Original checkout externally switched to codex/catalog-display-context-local-20261005; preserve it and use the separate isdc_odt_node_worktree on codex/satellite-node-integration. Add createNodeOpticalTimeline with source -120/-60/current Unix-ms priming, unchanged resolver, shared native point queue, per-owner history retention, exact full-definition/hash/UTC guards, atomic commit, dedup, reset/prune/reversal/disposal and every-field snapshot verifier. Extract shared native input guard without changing axes/equations. Real NodeScene/statusPresentation composition consumes actual computed verification, rejects mutation/stale/reset and preserves unknown power. Focused14PASS768.425ms; fullNode615PASS3933.1313ms. First Python run484PASS/161setupERROR/8warnings130.56s due missing basetemp parent; preserved log, created parent, no product change/test exclusion. Fresh absolute basetemp/cache fullPython645PASS8existingERFAwarnings165.31s(session23515exit0). Actual isolated0.3.0 Rust60rows→production adapter/query→JS decoder/serial owner→actual producer/verifier matches source: maxnumeric5.4569682106375694e-12/time0ms, verified_snapshot=true. Receipt install/55478612fbbd404cb529a2c55508054e/isolated_call.json; wheel d6a62057... unchanged; original runtime native0.2.0 reverified. N004 source history/verified producer prerequisite locally repaired; actual app/8891 proof remains T151/T152. Next implement T151 with shared display/node owners and one Viewer, preserve GP/catalog/stations/solar/SIM and capture before-state before owned8891 restart/native installation. WholeT148/T077/T076/T079/T075–84, Terra/all50/N001/T137auth/T032/equipment/RF/HIL/download/review remain open. No live8891/browser/native-install/remotePR/merge change. Evidence validation/t077_optical_history.md.

## 2026-10-06 N003 / T077 통신 계산 입력 부분 연결
- 변경: 기존native31열 r0:3/LVLH12:21을sample/track DTO에사본·오류null로노출. readonly communicationStateFor는정확한UTC/현재정의/hash/source frame/unit/basis만제공하고공용owner로전달. 표시용보간값·새궤도계산·사설clock/HTTP/축재구성없음. source norm(v)속도표시만기존벡터에서보존.
- 검증: DTO누락PythonRED/JS3missingmethodRED;source20state전체vector/basis/geodetic/copies와fractional/error/잘못된축/changeddefinitionfailclosed. query→실제JSbuffer/공용ownerreadonly 구성시험. targetPython55PASS2.01s/Node30PASS1452.6804ms. 최종Python645PASS8기존warnings163.79s(session83838exit0)/Node559PASS3084.8885ms/syntax/stageddiff PASS. validation/n003_communication_inputs.md.
- 남음: T077원본oisl.js+nodes/links.js 계산·history/commonexactUTC·snapshot검증→T148/T151조립/T152실제검증/T153리뷰. 전체T079/T076/T075–84/Terra/all50/N001/T137인증/T032/장비·RF·HIL/다운로드 유지. N003 DTO누락만해결; 통신성공/실제native·GPU·8891검증아님. 실제서버/native0.2.0/사용자화면/원격PR·병합변경없음.

## 2026-10-06 T150 배치 브라우저 클라이언트 구성요소 완료
- 변경: 원본직렬요청/15s제한/minimal장비 projection/signature/같은명령재시도/409조회후명시재적용 이식. GET-only복원/실제T145store ephemeral receipt 검증/보낸fullsnapshot보존/저장실패retry/관찰자사본·종료·늦은응답차단.
- 검증: missingmodule RED,12PASS2FAIL timeout·dispose보완 후target15PASS131.369ms. 원본client 두14095bytes/SHAd1f1c545… 동일 및제품wire/events/state exact. 실제JS client/store→Python ASGI/runtime/module IPC1PASS0.46s; lost-success reply retry/외부변경409/명시재적용/회수. 최종Python643PASS8기존warnings161.11s(session89311exit0)/Node555PASS3138.1009ms/syntax/stageddiff PASS. validation/t150_data_client.md.
- 남음: T148필수T077검증계산 producer/N003→T151조립/native설치/owned8891재시작→T152실제브라우저→T153리뷰. 전체T079/T076/T075–84/N001/Terra/all50/T137인증/T032/장비·RF·HIL/다운로드 유지. IPC/주입타이머는실제TCP·UI·성능증거아님. 실제서버/native/사용자화면/원격PR·병합 변경없음.

## 2026-10-06 T149 배치 수락 구성요소 완료
- 변경: 원본strict schema/RuntimeState 배치 버전·idempotency·candidate scope·async잠금/GET–POST 이식. 실제module가 수락한 scope/명부/시간/no-backfill receipt 검증 후만 배치commit. 입력명령 사본과candidate ID보존; 실패·취소/초기화·시나리오 범위 분리.
- 검증: missingroute RED→target49PASS1기존warning18.32s; 원본four-method state trace 두10764bytes/SHAda127f4626… 동일 및제품 exact, schema fullAST동일. 최종Python642PASS8기존warnings160.97s(session43194exit0)/Node540PASS3144.5469ms/architecture/stageddiff PASS. validation/t149_node_deployment.md. ASGI 구성요소·실제내장module 증거이며8891브라우저/전체원본app 증거아님.
- 남음: T150원본browser client→T151조립/native설치/owned8891재시작→T152실제검증→T153리뷰. 전체T079/T076/T075–84/T148T077producer/N001/N003/Terra/all50/T137인증/T032/장비·RF·HIL/다운로드 유지. 실제서버/native/사용자화면/원격PR·병합 변경없음.

## 2026-10-06 T079 / T149 전달 수락 및 원격 어댑터 부분 이식
- 변경: 원본 Protocol/오류와 HTTP 어댑터 재사용. isolated-v1 범위·명부·시간·제품ref 수락 확인 후 전달cursor 반영, source6h clock catch-up/2000chunk/부분실패 retry 보존. 역행시간은 쓰기 전 차단, shared/injected HTTP client 소유권 보존.
- 검증: initial missingmodule RED 및 malformedref/역행catalogue reset19PASS2FAIL 후수정. target22PASS0.49s; 원본HTTP class 두capture5522bytes/SHAcb1e8bc0… 동일 및wire full 비교. 최종Python618PASS8기존warnings159.84s(session66449exit0)/Node540PASS3004.0646ms/syntax/stageddiff PASS. validation/t149_data_delivery.md.
- 남음: T149 schema/RuntimeState candidate activation·revision·idempotency·rollback·HTTP assembly, T150–153/전체T079/T075–84/T032/실장비·RF·HIL/다운로드. 시험은 내장module 및MockTransport 구성요소 증거; 실제원격연결/8891화면 아님. 서버8891/native설치/사용자화면/원격PR·병합 변경없음.

# 현재 개발 상태

## 2026-09-07: 프레임워크 기반 구조 개편

사용자가 승인한 구조안을 적용했다. 현재 실행 소스는 communication, data, digital_twin, user_application에 있으며 문서, 테스트 및 참조 자료는 project_support에 있다. 루트 main.py는 CLI 진입점만 호출한다. D:\AeroDT는 읽기 전용으로 참고했으며 수정하지 않았다.

## 주요 변경

- RuntimeState 전역 singleton을 없애고 application factory마다 독립 상태와 시계를 생성한다.
- 현재 상태와 임무 상태 변경, 순수 텔레메트리 계산, 모의 장비 계산을 분리했다. 잠금과 기존 계산 순서는 유지했다.
- 외부 CelesTrak HTTP adapter, 카탈로그 조회 정책, gzip 저장, 궤도요소 계산을 각각 분리했다.
- REST와 WebSocket을 기능별 router로 나눴다. 내부 runtime 계약, snapshot 및 stateless query 계약으로 연결했다.
- 브라우저 API client, 웹 화면, 시각화와 궤도 전파 계산을 분리했다.
- 캐시, 기존 로그, 참조 자료 및 테스트를 새 위치로 이동했다. 구 소스는 실행 경로에서 제외하고 읽기 전용 참조 영역에 보존했다.
- 공동 작업 규칙, 계층 의존성, 확장 조건과 이전 파일 대응표를 문서화했다.

## 검증 증거

| 검사 | 실행 및 결과 |
|---|---|
| 변경 전 기준선 | 원본 `python -m pytest -q`: 10 passed |
| 원본 보존 | ZIP 내 92개 파일을 SHA-256 manifest 및 ZIP CRC로 검증 |
| 최종 Python 회귀시험 | `python -m pytest -q`: 35 passed |
| JavaScript 계산 시험 | `node --test project_support/tests/browser/orbit.test.mjs`: 4 passed |
| JavaScript 문법 | 실행 JS 11개 파일을 각각 `node --check`로 검사, 모두 종료 코드 0 |
| REST 계약 | 원본 ZIP의 소스를 임시 별도 Python 프로세스에서 읽은 OpenAPI와 전체 동등 비교. 22 paths와 14 schemas 동일 |
| 내부 경계 | AST import 검사, 계산 입력 사본, 앱 간 상태 격리 및 시계 종료 시험 통과 |
| 외부 연동과 저장 | 실제 카탈로그 정책과 gzip 코드를 사용하고 HTTP transport만 대체. live/cache/stale/그룹별 fallback, 상세정보와 손상 캐시 시험 통과 |
| 웹 경로 | HTML부터 모든 로컬 ES import와 CSS를 따라가 HTTP 200 및 콘텐츠 유형 검사. Python/캐시 비노출 시험 통과 |
| 실행기 | 임의 cwd에서 main을 별도 프로세스로 시작하여 health 및 JS 제공 확인. 점유 포트에서 실패 종료하고 기존 점유자 유지 확인 |
| 실제 브라우저 | 127.0.0.1:18765에서 5개 탭을 전환하고 스크린샷으로 확인. 16,511개 GP 위성, Cesium 3D, SGP4 위치/패스, 통신망, 임무 일정, KPI 차트, MOCK-HIL 화면 표시. WebSocket 갱신 및 콘솔 error 0개 확인 |
| 별도 코드 리뷰 | 계산 입력 원본 노출 및 손상 캐시 timestamp 오류를 지적받아 재현 시험 후 수정 |

검증용 브라우저 탭과 포트 18765의 서버만 종료했다. 기존 사용자 프로세스는 종료하지 않았다. 테스트가 생성하는 임시 서버도 종료한다. Node 24 및 현재 설치된 Python/FastAPI 환경에서 검증했으며 모든 Python 버전 또는 모든 브라우저 조합을 시험한 것은 아니다.

## 변경 전부터 존재한 한계

현재 HIL은 실제 하드웨어 연동이 아니며 recording은 메모리 플래그다. KPI는 SIM 규칙이고 임무 재계획은 AI가 아니다. 메모리 이벤트와 UI history가 영구 운용 이력이나 replay 기능은 아니다. 기존 고정 UI 시나리오 표시와 단순 접속창/재계획 알고리즘을 이번 구조 개편에서 변경하지 않았다. CDN이 차단된 실제 브라우저 세션은 이번 시각 검증에 포함하지 않았으며 대체 궤도 계산은 독립 JavaScript 시험으로 확인했다.

백업: D:\ICDCDT_before_framework_20260907.zip. Git 저장소가 아니므로 commit, branch, merge는 수행하지 않았다.


## 2026-09-07: Git 저장소 초기 등록

사용자의 별도 요청으로 Git을 초기화하고 origin을 https://github.com/HyeonJun9138/ISDC-ODT.git 으로 지정했다. 원격 저장소가 비어 있음을 확인했다. 실행 코드와 자산, 개발 문서 및 테스트 97개 파일을 등록 대상으로 삼고 로컬 도구 설정, 실행 데이터, 기획 자료와 원본 백업은 제외했다. 등록 대상 스냅샷을 임시 폴더에 복원하여 Python 35개 및 JavaScript 4개 시험을 통과했다. 주요 비밀키 패턴 검사에서 발견 항목이 없었다. 원격 반영 여부는 `git status -sb`와 `git ls-remote origin refs/heads/main`으로 확인한다.


## 2026-10-06 T077 original optical equations component
Original pure oisl.js text ported unchanged (only line endings), no clock/timed JS propagation/network/state owner. Hash-pinned source offline capture twice565246bytes/SHA c63dc5daeb8852034594c2d5796a8837535de0e4268a38e9dbba660af59ceaf3, elevenepochstates/1071exactserializedgeometry-selection-pair-history-label cases. Original9testbodies preserved with captured state inputs; missingmoduleRED and JSONnegativezero10PASS1FAIL corrected solely by matching capture serialization. FullPython645PASS8existingERFAwarnings166.50s(session73019exit0)/Node570PASS2985.9988ms; focused11PASS95.562ms; syntax and fullsource-text/original9test-body equality. Evidence validation/t077_oisl_equations.md. Original nodes/links.js resolver/scoped histories/commonexactUTC/verifiedsnapshot; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Source100kmatmospheremargin/ratedrangequality/acquisition remain engineering assumptions, no actual optical/RF success. Actual8891/native0.2.0/userbrowser/remotePR/merge unchanged; fullgoalactive.


## 2026-10-06 T077 original node link resolver component
Previous turn progressedca6d7b9; clean tree/controller/ledger/prerequisites and existing8/8requirements/noextensions gates reused. Original links.js body83a119b3… unchanged; inject existing library/oisl through createNodeLinkResolver, no private clock/propagation/state owner. Offline source VM captures18scenarios/59instants twicegzip476646bytes/SHA9324208901708676cd8710b49fc56aebad1e03588dcd3b4e52aa60fbac7d7ee6 (JSON8107723bytes/SHA7138afa16224bfaf93f319285e644957d72e719813d71428ad74520697cf54a7). Full terminal/pair/history trace matches source, product carries history across steps without changing previous inputs. Missingmodule RED repaired; FullPython645PASS8existingERFAwarnings164.45s(session94379exit0)/Node591PASS3125.7256ms; target21PASS343.9717ms; source resolver body/syntax/whitespace checks. Evidence validation/t077_node_link_resolution.md. N004 OPEN: original network_twin primes at -120/-60 seconds; existing first-forward native window omits past instants. Owner T077 native calculation/US20 assembly; trigger before production snapshot/T148/T151 acceptance. Supply actual historical native receipts through existing serial query owner; no current-basis substitution, invented tracking or reduced future grid. N004 actual -120/-60second native history priming/common UTC/scoped verified producer; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Actual8891/native0.2.0/userbrowser/remotePR/merge unchanged; fullgoalactive.


## 2026-10-06 T077/N004 native historical and exact point inputs
Previous turn progressedf97505b; fullgoal/validfeature/controller/checklists8of8/noextensions preserved. Add requestCommunicationStates to existing shared serial owner with full current scope/exact native reuse orcount1pointquery; preserve601futuregrid/121paths, no clock/UTC adoption/interpolation/partial success. Definition/seek/retry/clear/dispose/caller abort and ignored-abort lane fences verified. Missingmethod8FAIL RED repaired; source20-node -120/-60/current receipt→realdecoder→carried source resolver complete equality. Extended existing isolatedwheel test computes actual60Rust rows and forwards exact checked bytes through production native adapter/NodeGeometryQuery and actual JS point queue/decoder/resolver. First target1FAIL2PASS found -180/+180 periodic-equivalent azimuth; only comparison corrected, no production math changed. FullPython645PASS8existingERFAwarnings179.06s(session54094exit0)/Node601PASS3590.8315ms; focused44PASS1873.0067ms; actual clean-venv Rust60rows→adapter/query→JS decoder→source resolver maxnumeric5.4569682106375694e-12/time0ms. Fresh isolated_call receipt data/workspace/validation/install/d31b5659b2e643b58187415ce6a1e462/isolated_call.json inspected; wheel d6a62057… unchanged, actual runtime package reverified0.2.0. N004 historical delivery component now locally verified; source production history owner/verified snapshot stillrequired before T148/T151. N004 production source history/Unix-ms priming/dedup/scope/snapshot verifier; T148/T151-153; fullT075-84/Terra/all50/T032/equipment/HIL/download/review. Actual8891/browser/remotePR/merge unchanged; fullgoalactive. Evidence validation/t077_native_communication_requests.md.


## 2026-10-06 T151 selected native node pose prerequisite
Existing shared SatelliteModelLayer accepts an explicit pose_source source_node/full copied definition/accepted native hash. Preserve GP ITRF/catalog/hash guards; check native profile/frame/inertial frame/time model/source commit/quality, canonical UTC/current full finite definition/hash/valid row/null error/finite metre position; return copied tagged pose. Domain/full-definition/hash load identity fences stale same-ID/url models and queued focus. Workspace selected records distinguish node ID from NORAD; stale node status identity/hash rejected. No second renderer/clock/propagator/query/state owner. Initial model RED2 and workspace identity RED1; focused15PASS104.1407ms. FullNode626PASS3737.2041ms; fullPython649PASS8existingERFAwarnings153.53s(session9235exit0). Actual clean-venv Rust60rows through default app/ASGI/native adapter/query/JS sample buffer validate all60selected_node_poses; original optical comparison maxnumeric5.4569682106375694e-12/time0ms/source equal/verifiertrue. Receipt data/workspace/validation/install/d141562caeb647ca809dbfcdeaa5df0f/isolated_call.json; unchanged wheel SHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. ADR0019 and validation/t151_selected_node_pose.md. N005 component repaired; keep N005 open until actual panel/selection/focus/picking integration and browser evidence. T151/T152/T153 and fullT075–T084 remain open, including Terra/allassets/N001/T032/T137auth/real equipment/file bytes. No new branch, remoteGit, installed-native change or live8891/browser/server restart. Next actual workspace node panel/store/display/optical/model/deployment/scene composition with shared Viewer/common UTC, then controlled installation/capture/restore/restart8891 and full live acceptance.


## 2026-10-06 T151 actual V6 node workspace composition partial
Actual workspace_orbit now constructs and mounts source node library/editor/work-panel/store + existing native sample/track timeline + optical producer + NodeScene/shared Viewer/display UTC + serialized deployment client. Shared original model manifest resolver copied accessors replace a duplicate manifest load. Restore GET-only; deployment/recall explicit buttons; native errors/unknown UTC/status/retry visible; current definitions fence selected sampler; source selection and explicit focus separate; panel/store/native/renderer/history lifecycle cleanup. Source panel/CSS mounted in satellite view; actual V6 DOM/Cesium/HTTP boundary fixture tests original panel/add editor and readonly initialization. Added tests beforecode (module/accessor missing RED); stopped test27751 after accidental optical status-triggered retry loop, repaired scheduling to display/definition changes or explicit retry. Older VM/isolation fixtures repaired for new actual composition imports and transport/host capabilities without changing original assertions. Final fullNode631PASS4512.8276ms; fullPython649PASS8existingERFAwarnings154.79s(session86704exit0). Actual native receipt install/d2591b07529342e98224dca3ba8d95b6/isolated_call.json:60selected/nativeposes/source maxnumeric5.4569682106375694e-12/time0ms/verifiertrue. Evidence validation/t151_workspace_nodes.md. No live8891/native install/remoteGit/newbranch change. T151 unchecked: picking/hover/common clock commands/view+zoom/scene-composer/storage/HTTPcrypto behavior/full restore+controlled native installation/capture/restore/8891 restart; N005 actual interaction/modelbrowser proof and T152/T153 remain. Full T075–T084 unchanged, Terra/allassets/N001/T032/T137auth/equipment/RF/HIL/filebytes remain. Next complete these actual composition interactions then controlled owned8891 restart and browser matrix; do not equate current boundary tests with live success.


## 2026-10-06 T151 node common-clock commands partial
Actual V6 node work panel now routes stored/catalog play/pause/speed/UTC step/live through existing displayed owners, matching exact source identity/canonical UTC/leap provenance. No fallback clock/timer/propagation/automatic command. Stored uses existing server client/application command wrapper; catalog uses existing catalogTimeline and its calculate path. Support existing0.1/1/10/60 rates only; catalog play requires buffer; disposal rejects held callbacks. Existing render/catalog status callbacks refresh clock capabilities without a new loop. Beforecode missingmodule RED; routing/readonly copies/invalid stale context/unsupported speed/disposal pass. Real V6 panel clock assertion first failed because older fixture omitted actual sample receipt leap SHA; fixture metadata repaired, production guard unchanged. FinalfullNode636PASS3653.6844ms (added SI leap-second stepping proof); fullPython649PASS8existingERFAwarnings153.96s(session96205exit0); syntax/whitespace checks. Evidence validation/t151_node_clock.md. Actual app/8891 commands remain unverified; T151/T152 unchecked. Next source picking/hover/shared camera/view/zoom/scene-composer/failure/storage/HTTPcrypto then controlled native install/owned8891 capture/restart/restore and live acceptance. FullT075–T084/Terra/allassets/N001/N005/T032/T137auth/equipment/RF/HIL/filebytes/review remain. Same branch, no new branch/remoteGit/live-server/native installation change.


## 2026-10-06 T151 source node picking and hover highlight partial
Reuse existing OrbitGlobe one-handler click/hover path via scoped injected ownership port; tag node records explicitly, check actual primitive and current full-definition accepted native buffer/common UTC/renderer scope. Shared selected GLB additionally requires own visible primitive and real SatelliteModelLayer.nativeAt validation; no relabeling source frame. Foreign/hidden/invalid tagged picks cannot become catalog selections. Actual workspaceNodes binds store selection separately from focus and NodeScene.setHovered source styles. Source fleet metadata adds nodeId alongside satelliteId; immutable original capture comparison excludes exactly declared additive field. New missing methods/tag/appbinding RED failures; reentrant cleanup test RED repaired by ownership-before-cleanup/current binding fence. Boot/rebind/old removers/disposal/foreign/hash/frame/unknown UTC cases pass with real modules/native buffers and Cesium/DOM boundary doubles. Final fullNode642PASS3704.5978ms; fullPython649PASS8existingERFAwarnings157.12s(session34156exit0). Actual receipt install/48420fb9a16545b1953f99e9c27e88bf/isolated_call.json:60native/selectedposes/source delta5.4569682106375694e-12/time0ms/verifiertrue. Evidence validation/t151_node_picking.md. Node hover facts card stillpending; N005 actual GPU/8891 model/camera proof open. Next shared camera/view/zoom/lighting/scene-composer/storage/HTTPcrypto/failures then controlled native install and owned8891 capture/restart/restore, T152 browser matrix/T153review. T151/T075–T084/Terra/allassets/N001/T032/T137auth/equipment/RF/HIL/filebytes remain open. Same branch, no newbranch/remoteGit/installednative/liveserver/userbrowser change.


## 2026-10-06 T151 shared node camera controls partial
Actual source work panel zoom buttons/slider/home route to existing shared camera/model owner. Preserve source logarithmic formula/map+Earth limits/size-based tracking minimum and existing model range release policy, viewport-fit Earth home and map flyHome. Existing preRender/view-status notifications publish copied camera state; refreshScene updates controls only without reconstructing editor/fleet. Queued/physical morph/missing camera/disposal guard commands and unavailable home disables before untrack. Escape aimAtEarth options preserved. Beforecode RED missing methods/routing/home capability repaired. FullNode649PASS4272.0592ms, fullPython649PASS8existingERFAwarnings198.53s(session65719exit0); syntax/whitespacepass. Actual isolated receipt install/e1768ada6f794f1db263ea66e021783e/isolated_call.json:60native/selectedposes/source numeric5.4569682106375694e-12/time0ms/equality+verifiertrue. Evidence validation/t151_node_camera.md. Actual GPU/8891/N005/T151/T152 remain open. Next shared lighting/view/hover facts/scene-composer/storage/HTTPcrypto/failures then controlled native install and owned8891 capture/restart/restore/browser matrix. FullT075-T084/Terra/allassets/N001/T032/T137auth/equipment/RF/HIL/filebytes/review unchanged. Same branch, no newbranch/remoteGit/installednative/liveserver/userbrowser change.


## 2026-10-06 T151 node lighting and shared view partial
Actual workspace injects existing WorkspaceSolar into source node panel; lighting preference/state/commands/notifications shared with common globe checkbox and original storage/event owner. No duplicate state/query/renderer. Existing view owner provides current theme and queued mode guard; NodeScene receives copied source-compatible palette, setTheme/update without regenerated definitions. Pinned source comparison verifies eight color keys both themes. Actual V6 assembly boundary tests1280x720/1920x1080 cover lighting sync/light-theme preference/2D3D/oneViewer/noorbitSIMcommands/cleanup. Shared fixture now has preRender for real node attachment; older catalog test primitive index assertion repaired to explicit25544/16633 identity without weakening row assertions. Beforecode missinglighting/ports/palette RED repaired. FinalfullNode654PASS4785.9543ms/fullPython649PASS8existingERFAwarnings193.28s(session92082exit0), syntax/whitespacepass. Actual native receipt install/fd2f28262715492a8077df0f2785eac6/isolated_call.json:60native/selectedposes/source numeric5.4569682106375694e-12/time0ms/equality+verifiertrue. Evidence validation/t151_node_view.md. ActualGPU/8891/N005/T151/T152/T153/fullT075-T084 remain open. Next hover facts/scene composer/storage/HTTPcrypto/failures then controlled native install and owned8891 capture/restart/restore/live matrix. Terra/allassets/N001/T032/T137auth/equipment/RF/HIL/filebytes/review unchanged. Same branch, no newbranch/remoteGit/liveserver/installednative/userbrowser change.


## 2026-10-06 T151 startup restoration and browser identity partial
Actual node startup catches damaged/denied storage and mounts source panel with error and explicit restore/server-GET retry. Store loaded getter is readonly; lazy storage access can recover after denied property. Retry single-flight, keeps current edited drafts, never replaces damaged bytes or deploys passively; buttons gate loaded/server readiness. Pure browser_identity nativeUUID/cryptographic-byte UUIDv4 helper shared by existing request/equipment/formation defaults, injected IDs untouched, explicit missing-capability error, no time/Math.random fallback or auth claim. Beforecode RED missing readiness/start rejection/helper repaired. Twores actual V6 assembly boundary tests damaged bytes/error/same-control retry/no-write/noPOST and getRandomValues-only equipment/node add/edit. DataURL import fixtures adapted to real helper resolution without weakened assertions. FinalfullNode663PASS4574.3132ms/fullPython649PASS8existingERFAwarnings211.99s(session77831exit0); syntax/whitespacepass. Actual native receipt install/2935f60dbf35453e8aecdaf7f92432aa/isolated_call.json:60native/selectedposes/source numeric5.4569682106375694e-12/time0ms/equality+verifiertrue. ADR0020/evidence validation/t151_node_recovery.md. T151/T152/T153/N005/fullT075-T084 stillopen. Next native hover facts/scenecomposer/full restore then controlled owned8891 capture/nativeinstall/restart/restore/live matrix. Terra/allassets/N001multiwindowCAS/T032/T137auth/equipment/RF/HIL/filebytes/review unchanged. Same branch/no newbranch/remoteGit/liveserver/native-root installation change.

## 2026-10-06 T151 native node hover facts partial
The actual node workspace publishes a copied source_node payload from current owned geometry and screen coordinates into the existing satellite hover card. Names use literal bounded text; source height_km is displayed directly with canonical UTC, Kepler+J2 simulation, GMST/UTC approximate frame and unverified communications labels. Existing GP ITRF/WGS84 behavior remains separate. Domain-scoped clear avoids erasing the other domain card. The existing mouse handler and node preRender refresh current ownership/geometry; invalid definitions, hidden/foreign primitives, unavailable UTC, morph and disposal hide the card. No additional Viewer, handler, clock, timer, query or command is added to the hover path.
Regression RED preceded implementation. Actual V6 assembly boundary tests at1280x720 and1920x1080 verify one Viewer/handler/card, current source altitude/UTC/quality and morph hide without hover-triggered queries. The fixture now exposes real timer injection for calculation yields, canvas/style, client dimensions and owned collection removal; initial assembly failures were missing adapter capabilities, not weakened production guards. DOM/Cesium/HTTP adapters do not establish actual GPU/browser acceptance.
Final fullNode669PASS5044.4594ms; fullPython649PASS8existingERFAwarnings228.94s(session65406exit0); whitespace check passes. Evidence validation/t151_node_hover.md. T151/T152/T153/N005 and fullT075–T084 remain open. Next scene-composer/snapshot/full restoration assembly, then controlled native0.3 installation and owned8891 capture/restart/restore plus live matrix. Terra/allassets/N001multiwindowCAS/T032/T137auth/equipment/RF/HIL/file bytes/review remain. Same branch; live8891/native-root installation/remote Git unchanged.
## 2026-10-06 T151 shared scene/composer node snapshots partial
Existing source node work panel/editor/store now mounts in satellite, scene and composer views. No second definition owner or clock. readonly sceneSnapshot copies source drafts/local accepted deployment/selected identity/revision/persistence/common UTC/server receipt/calculation/model status; null after disposal. Passive GET restore does not imply deployment acceptance. The summary separates drafts/accepted batch/confirmation/UTC; collapsed literal-text definition review renders only on store revision or remount. Existing scenario mock inputs/events remain independent; this is not event injection/runtime completion.
Added tests beforecode: missing mounted panel/snapshot RED. Focused23PASS709.7355ms; actual V6 scene/composer editing plus twores1280x720/1920x1080 stored-source restore and real hashchange reconstruction preserve complete definitions/selection with GET-only/noorbitSIMcommands/oneViewer. FullNode674PASS4515.7432ms/fullPython649PASS8existingERFAwarnings212.26s(session48503exit0); whitespacepass. Evidence validation/t151_scene_snapshot.md. T151/T152/T153/N005/fullT075–T084 remain open. Next full failure/accepted-deployment restore and controlled native0.3 installation/owned8891 capture/restart/restore/live matrix. Terra/allassets/N001/T032/T137auth/scenario events/equipment/RF/HIL/file bytes/review remain. Same branch, no remoteGit/live restart/native-root installation change.
## 2026-10-06 T151 actual deployment conflict/retry/restoration partial
Found actual assembly gap: source client rereads409 server configuration but normal deploy/recall remain disabled while syncRequired, leaving no explicit recovery action. Mount readonly validated server configuration and explicit reviewed reapply/recall buttons gated by loaded/server-known/notbusy/syncRequired and nonempty requested/server nodes respectively. Reuse unchanged original client/revision/ID/receipt authorization; no passive overwrite or new server API. Normal controls remain blocked until mismatch resolved.
Tests beforecode RED missing reviewed controls. Actual V6 boundary twores1280x720/1920x1080 covers409→GET→reviewedPOST/current revision/unchanged complete drafts and local acceptance only after verified receipt; lost accepted reply repeats identical payload/ID; new composer restoration copies original drafts/accepted batch via GET only with confirmation false. Server-only deployment explicit recall works with empty local drafts. Owned listeners dispose. Fixture exact controls updated; initial dynamic-DOM adapter failure preserved and markup follows existing binding lifecycle. Final fullNode679PASS4711.3867ms/fullPython649PASS8existingERFAwarnings234.03s(session83514exit0); whitespacepass. Evidence validation/t151_deployment_restore.md. Readonly preflight PID37724 remains0.0.0.0:8891; no restart/install/remoteGit/newbranch. T151/T152/T153/N005/fullT075–T084 remain open. Next activation/timeout/late/local persistence failure recovery then controlled native0.3 installation/immediate capture/owned8891 restart/restore/live matrix. Terra/allassets/N001/T032/T137auth/scenario runtime/equipment/RF/HIL/file bytes/review remain.
## 2026-10-06 T151 failure matrix and independent runtime preparation partial
Existing production code passes new actual V6 twores accepted-receipt/local-store-denial retry with unchanged drafts/deployed bytes and identical reviewed payload/ID. Actual timeout callback/source15000ms abort policy and pagehide disposal reject transport-ignored-abort late accepted receipts; timers released, retry same request succeeds. Focused32PASS1198.7425ms; fullNode683PASS4968.2472ms/fullPython649PASS8existingERFAwarnings237.12s(session34431exit0), whitespacepass. No source behavior changed this turn.
Prepared ignored isdc_odt_node_worktree/project_support/.venv CPython3.14.6/pinned requirements/native0.3.0, wheelSHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. pipcheckPASS; native import/current factory/OpenAPI approved pathsPASS. New environment target108PASS: nodeapp/http/deployment48/1existingdeprecationwarning2.21s, officialSGP4golden4/0.91s, nodegeometry/samples56/1.41s. Native originalenv0.2.0 rechecked unchanged. Corrected readonly FastAPI route probe from .path assumption to OpenAPI; no product repair. Runtime receipt/logs ignored data/workspace/validation/ground_stations/t151_runtime_environment*. Evidence validation/t151_failure_runtime.md.
T151/T152/T153/fullT075–T084 remain OPEN. Next immediate before-state storedGP/observer/UTC/SIM-memory capture, exact restore/rollback, controlled owned8891 replacement using separate newenv/current branch, live twores/browser matrix. Runtime preparation is not live acceptance. Full activation failure, Terra/allassets/N001/N005/T032/T137auth/scenario/equipment/RF/HIL/file bytes/review remain. Same branch; no originalenv native installation/remoteGit/live restart.

## 2026-10-06 T151 live native runtime and cache/period repair partial
Owned0.0.0.0:8891 now runs the independent node worktree environment/native0.3.0 (listener48084), preserving the original environment0.2.0. Immediate captures and two restore receipts are retained under ignored data/workspace/validation/t151_live. Stored input hashes/observer/minimum angle/leap/EOP/play rate and exact paused UTC were verified before resuming playback. Existing SIM settings were recreated; historical elapsed time/events/sequence remain archived, not restored or merged into the new run. Original approximately19h SIM memory was explicitly reported before restart.
Normal browser reload exposed cached old catalog modules (observeSelection missing). HTML and mutable static JS/CSS/JSON now revalidate with Cache-Control:no-cache; ETag304 remains supported, binary GLB/API caching unchanged. Regression RED missing header preceded fix. Actual HTTP headers and ordinary browser reload pass without cache-disable override.
Live source node track failed identity/hash/period validation although positions/models rendered. Server source contract rounds n0 period to three decimal minutes, but application supplied unrounded static elements. Fix rounds the injected application period identically; strict buffer identity/hash/121vertex/UTC grid guards remain unchanged. New mounted regression reproduced mismatch before fix; transport fixture now models real rounded contract. Focused41PASS, fullNode684PASS6442.0669ms. First newenv fullPython649PASS/1FAIL270.23s: temporary preflight script incorrectly located under data/workspace imported application. Moved the three temporary scripts to ignored project_support/tooling/validation_runs/t151_live without weakening architecture checks. Focused architecture/cache4PASS; full newenvPython650PASS8warnings274.79s(session33689exit0).
Actual browser ordinary reload/add-edit restored one validation draft NODE-0001, current native position and selected OneWeb-type GLB model focus observed at1280x720/1920x1080, no new console errors; screenshots node_1280.jpg/node_1920.jpg retained. Restore/store/server queries were readonly; no deployment POST performed by this live test. Temporary pause completed; stored GP resumed1x and HTTP verified playing=true. Viewport override reset; validation draft remains visible. This is bounded live evidence, not all50 assets, all240 nodes, hover/morph/GPU performance/full failure matrix proof.
T151/T152/T153 and fullT075–T084 remain OPEN. Next expand actual model/clock/hover/camera/shared screens and formation/equipment/deployment matrix; Terra/allassets/N001 multiwindow/T032 performance/T137 auth/physicalRF/HIL/scenario/file bytes/review remain. No new branch/remote Git/originalenv modification. Evidence validation/t151_live_runtime.md.


## 2026-10-06 T152 formation input and live equipment/shared views partial
Live8891 prefix/2plane×3 count input followed by explicit generate used old default4×10/ODT because raw edits awaited change/blur. Added input drafts, protected them from other control publication, commit through original validation on explicit generate/add, cancel120ms live work while any draft remains. Pending blank input blocks old-value generation; changed preset/formation clears staged edits. No physics/native/schema/store-authority change. Regression40!==6 RED and pending-live1!==0 RED preceded fixes; fullNode687PASS5004.2388ms/fullPython650PASS8warnings252.54s(session65808exit0).
Actual ordinary reload now generates exactly6nodes/2planes with requested prefix alongside unchanged originalNODE-0001. Added DTN equipment to one test member, stored safe mode, confirmed its detachment and source inactiveOISL/DTN vs activeTT&C/GNSS behavior; five remaining members retain original formation. Actual satellite/scene/composer transitions preserve complete definition JSON and singleCesiumcanvas. Screenshots1280/1920 and receipts in ignored t151_live; viewport reset, GP1xplaying restored, no console errors/new deploymentPOST. Initial erroneous test40node group archived then removed via original formation-remove control; final7validation drafts retained and original1unchanged. Evidence validation/t152_formation_inputs.md. Editor mode label association remains to investigate.
T151/T152/T153 and fullT075–T084 remain OPEN. Four presets/all equipment/240nodes/GPUperformance/hover/morph/clock/full deployment failure matrix/allassets/source modules and filebytes/review remain; N001/T032/T137auth/physicalRF/HIL unchanged. Same branch, no newbranch/remoteGit/serverrestart/originalenv change.


## 2026-10-06 T152 live presets/capacity and bounded-copy name partial
Actual single/train/Walkerstar/Walkerdelta presets,192member formation and240total copies verified on8891;241st duplicate rejected with identical JSON. Found valid40codepoint copy name failure; expose same readonly model limit and bound store-generated copy name without changing source clone/dynamics/goldens. Node688PASS5655.8677ms/Python650PASS8warnings295.01s(session54487exit0). ActualHTTP240valid identity/UTC/frame receipts; twores count screenshots. Removed exact46testcopies, returned5member train/full7drafts; protected2definitionsJSONequal,1xplaying/viewport restored.50GLB+50thumbnail HTTPbytes/SHA match, Terra missing textures/allGPU remain unverified. Evidence validation/t152_presets_capacity.md/ADR0022. T151/T152/T153/fullT075–T084 remainOPEN; next source communication snapshot and actual model failure/shared clock gates. Other fullmatrix/modules/performance/multiwindow/auth/RF/HIL/filebytes/review unchanged. Samebranch/no remoteGit/restart/originalenv change.


## 2026-10-06 T077 original ground-station model partial
Reused original constructors/normalizer/validator/band constants/antenna gain/G-T/surface distance/coverage radius in digital_twin/model_library/browser/ground_stations.js, importing/reexporting existing station_presets.js instead of duplicating twelve site definitions. Original source body exact apart from this declaration replacement. Hash-pinned offline original capture is reproducible byte-for-byte (fixture SHA2fdc031bb8ed0e989e9d6c6e30501946d7bfe642b12504739030017c1f6aa217); no runtime reference import/clock/storage/transport/propagation/UI assembly. Missingmodule RED before code, focused4PASS; fullNode692PASS4716.4477ms. Final fullPython650PASS9warnings232.37s(session86800exit0; eight existing warnings plus sandbox cache-write warning, no test errors). First run488PASS/161temp-permissionERROR/1missing-wheelFAIL177.32s, second interrupted by execution-environment transition at44percent (handle missing and actual pytest process absent), final uses project-owned basetemp/cache and hash-verified original0.3.0 wheel via existing ISDC_ORBIT_INSTALL_WHEEL option. No test exclusion/product workaround.
N006 OPEN, owner T077 ground-link geometry; trigger before original ground-link/snapshot acceptance. Actual source execution shows altitude_km station height ignored by lookAnglesAt's altitudeKm: Daejeon70m overhead550km gives550km rather than549.93km. Keep original golden and separate correction regression/ADR. Future snapshot producer reuses existing native exact-UTC request queue and sole optical-history owner, never creates a second JS propagator/history or reports unverified link success. Contract contracts/ground_station_model.md; evidence validation/t077_ground_station_model.md. T077/fullT075-T084/T151/T152/T153 remainOPEN; fabric/routes/status/groundUI/other source modules/Terra/fullGPU/performance/multiwindow/auth/physicalRF/HIL/filebytes/review unchanged. Samebranch; no remoteGit/newbranch/serverrestart/nativeinstallation/originalenv change.


## 2026-10-06 T077 source network snapshot and ground height repair partial
Reused source ground_links/network_snapshot bodies with injected node/station/optical models and extracted original pure WGS84 ENU geometry, without importing JS propagation or creating clock/history/state/transport/Viewer. Hash-pinned eight-source offline capture preserves eight original and deliberately height-corrected snapshots plus twelve original geometry vectors; recapture SHAe6bf23c1d0e76bddb6b1cbf2a4fbddc898e59ae016308cb3320e990511920f0e. Original OISL pair acquisition is executed offline; independent ground unit-test vectors do not prove a physically consistent native snapshot. Missingmodule RED; structural original compatibilityPASS then height550!=549.9RED. ADR0023 maps only validated station.altitude_km to source geometry.altitudeKm; missing/nonfinite geometry remains unavailable, source node/OISL/mesh records unchanged. Station dependency-port RED777!=41.716... repaired by explicit stationModel injection instead of a filesystem-only browser import. Focused13PASS126.6727ms; finalNode705PASS5605.4995ms; fullPython650PASS8warnings231.61s(session93152exit0). Syntax/source-body/whitespacePASS; no liveUI/API/native runtime change.
N006 calculation locally repaired; live ground acceptance stays T077. N007 OPEN, owner T077 application/native snapshot producer; trigger before fabric/UI acceptance. Join exact native receipt and existing verified optical snapshot with complete roster/hash/UTC/ground-config/fault fences, existing serial point query and sole optical-history owner; no unavailable-row omission disguised as complete success. Preserve readonly caller copies, stale/disposal/seek/edit guards and explicit retry. Then original ICD-02 stand-in/adapter/exchange/routes/status and groundUI, cross-window ownership and actual8891 evidence. Contract contracts/network_snapshot_model.md; evidence validation/t077_network_snapshot_model.md. T077/fullT075-T084/T151/T152/T153 remainOPEN; other source modules/Terra/fullGPU/performance/multiwindow/auth/physicalRF/HIL/filebytes/review unchanged. Samebranch/no remoteGit/newbranch/serverrestart/nativeinstallation/originalenv change.


## 2026-10-06 T077 native/optical network input join partial
Added createNodeNetworkTimeline with explicit node/station/fault/display model inputs, existing serial native point port and sole optical-history owner. Full copied context/roster/hash/UTC/axes/geodetic/optical proof checked before atomic source-network publication and every snapshot/verify. Same-context dedup, input-edit/clear/dispose/ignoredabort fences, unknown/error instead of partial success, source provenance/independent copies/observer isolation and empty ground mesh. Source validator coercion let raw latitude null yield valid-with-missing-geometry RED; strict consumer numeric/name typing repaired it, source constructor/validator unchanged. Missingmodule RED before implementation. Focused16PASS1404.6549ms, finalNode721PASS4904.9404ms, fullPython650PASS8warnings230.87s(session78191exit0); syntax/whitespacePASS.
Actual clean-venv0.3.0 Rust60rows -> production adapter/query/default application/shared executor/ASGI3points -> real JS serial timeline/optical join/network verifies20current rows/3representative stations/89links; source maxnumeric5.4569682106375694e-12/time0ms and60selectedposes preserved. Fourth JS query reuses captured current native receipt, not a fourth Rust execution. Updated fixture rerun on same actual IPC payload after stronger all-record comparison/final typing guard proves network_records_match_source=true; final receipt data/workspace/validation/t077_network_timeline_native_final.json; original install/b2dbda865ffb4c8286cc8b6cfc2982f3/isolated_call.json. Runtime/deployment/displayUTC readonly assertions retained; shared optical owner/proof survives join disposal.
N007 producer locally verified; actual workspace acceptance stays OPEN. N008 OPEN owner T077 ground/config/application; trigger before communication workspace acceptance. Reuse original ground_segment editor/config/storage with copied independent values and visible restore/write errors, compose join with actual existing workspace node/display/optical owners, render source network results and then explicit original ICD-02 fabric exchange/routes/status with cross-window/late/failure/full8891 evidence. No live8891/browser/API/nativeinstallation/runtime/originalenv change. Contract contracts/network_timeline.md, evidence validation/t077_network_timeline.md. T077/fullT075-T084/T151/T152/T153 remainOPEN; Terra/allGPU/performance/multiwindow/auth/physicalRF/HIL/source modules/filebytes/review unchanged. Samebranch/no remoteGit/newbranch.

## 2026-10-06 T077 original ground configuration prerequisite
Source ground_segment normal operations/schema/key/max24/sequence reused with explicit existing model injection. Hash-pinned offline original trace matches product results/rosters/events/saved JSON; recapture SHA3cb8e42e1ca695356facacb3c78b0e698b0df23374a935ec39764db9a67261b4 identical. ADR0024 records copies, strict typed/full restore, missing-only defaults, visible read/write errors, write-before-accept atomicity, observer/disposal behavior. Original custom-add name-empty request preserved after dedicated RED. Missingmodule RED first; focused8PASS107.9053ms/fullNode729PASS5075.6417ms/fullPython650PASS8existingwarnings189.80s(session80596exit0). Source capture wrong directory corrected; no hash relaxation/test exclusion. Contract contracts/ground_segment_store.md; evidence validation/t077_ground_segment_store.md.
N008 still OPEN: reuse original editor/list/actions and actual native/optical/network workspace assembly, ready/error inputs/editor preservation/storage conflict handling/actual8891, then original ICD-02 fabric/routes/status. T077/fullT075-T084/T151/T152/T153/Terra/allGPU/performance/multiwindow/auth/physicalRF/HIL/filebytes/review remainOPEN. No liveUI/8891/server/nativeinstallation/remoteGit/newbranch/originalenv change. Continue same branch and full goal.

## 2026-10-06 T077 existing workspace network owner port prerequisite
Actual createWorkspaceNodes optionally composes network join through its existing serial native/optical history/current draft/commonUTC owners. Copied update/snapshot/verify/clear ports, definition/actualUTC/disposal fences, no mutable owner exposure or new clock/renderer/transport. Three missing-method RED repaired; sameUTC repeated-event unavailable!=valid RED repaired to preserve stable proof. FinalNode732PASS4557.316ms/fullPython650PASS8existingwarnings186.79s(session71283exit0). Extended actual clean-venv defaultapp/ASGI Rust60row fixture through workspace proves20current nodes/3stations/89links all source records equal, maxnumeric5.4569682106375694e-12/time0ms/60poses. Four workspace reads reuse captured native bytes, not new Rust calls. Fresh install/df0a83b161bc41738038f7fc82272bac/isolated_call.json and updated fixture rerun t077_workspace_network_native_final.json after final sameUTC correction.
N008 remainsOPEN: workspace_orbit has no networkInputs yet; next original ground editor/list/actions + validated ready/SIMfault readers (unknown runtime must not default to[]) + verified results/pending edits/storage conflict + actual8891, then original ICD-02 fabric/routes/status. Evidence validation/t077_workspace_network_port.md; contract contracts/workspace_network_port.md. FullT075-T084/T077/T151/T152/T153/Terra/allGPU/performance/multiwindow/auth/RF/HIL/filebytes/review remainOPEN. No liveUI/server/nativeinstallation/remoteGit/newbranch/originalenv change; samebranch/fullgoal.


## 2026-10-06 T077 ground editor and workspace network partial
Reused hash-captured original stationEditorMarkup body with injected original ground model; only control IDs added. Mounted actual V6 original ground CRUD/config and verified network display through existing node/native/optical/common UTC owners. SIM faults must come from successful existing controller GET; unavailable runtime is explicit failure, never empty faults. Result links paginated at50 with source geometry/quality and actual RF/fabric unverified disclosure. Storage token detects missed cross-window writes before commit; external events retain pending editor and block stale computation. Pending text/blank numeric/band/enabled edits survive actual screen reconstruction without persisting or issuing runtime commands. DOM fixture now scopes querySelector to descendants including detached subtrees, matching real browser semantics.
Regression before repair: stale storage write RED; missing panel RED; reconstruction RED (hidden editor). FullNode740PASS4377.8381ms; fullPython650PASS8existingERFAwarnings163.11s session87856exit0; no tests excluded. Original editor exact captured function body plus unchanged markup after removing added IDs verified. Earlier Node738 first run failed isolated import loader; repaired loader, kept assertions. Earlier Python650PASS171.76s. Evidence validation/t077_ground_network_panel.md.
Actual8891 stored profile/native0.3.0 showed protected7source drafts + default3stations,30links at2020-07-12T21:16:01.000416000Z in preceding live check. This turn verified source custom add GS-SITE_1, unsaved name/blank latitude/unchecked X after satellite→ground, blank-number rejection, save35/127 and edit35/128 disabled. Original three defaults visibly unchanged. DELETE click timed out, getJsDialog/CDP/screenshot timed out and CUA kernel reset: exact temporary GS-SITE_1 cleanup, fresh screenshot and final persisted/protected JSON equality are UNVERIFIED. Do not delete user stations or claim cleanup completed. Browser recovery is next live prerequisite.
No existing8891 process at earlier preflight; started this worktree's test server, corrected create_app to create_stored_orbit_app after capturing bootstrap. Automatic approval rejected termination of unverified launcher22412; only verified server34444 was later terminated and stored profile server29720 started0.0.0.0:8891. Original project/environment unchanged; old memory runtime was unavailable and not claimed restored. Retain server logs under data/workspace/validation/t077_ground_panel_live.
N008/T077 and fullT075-T084 remainOPEN: recover live browser/cleanup/screenshot, actual two-resolution ground and paging/late/storage failure matrix, cross-window ownership, source ICD-02 fabric/exchange/routes/status/DTN and all other source modules, Terra/allGPU/T032/N001/T137auth/physicalRF-HIL/file bytes/review. Same branch, no new branch/push/merge.


## 2026-10-06 T077 original ICD-02 module prerequisite
Ported original link_metrics/routing/bundles with unchanged algorithms to simulation/data_fabric and original DataFabricStandIn to runtime/data_fabric/stand_in, changing only three imports. Original and normalized port hashes recorded in fixtures/original_data_fabric_source.json; exact normalized port test passes. Original four source tests preserve link quality/objective paths/ground connectivity/DTN storage-drain/backward time/malformed inputs. New DataFabricExchange owns serialized module memory and commits a copied candidate only after successful finite JSON report; no twin current state, renderer, clock, transport or server command introduced.
Missing module/exchange RED verified before code. Focused10PASS0.37s. Initial hash failure was Windows doubled CRLF during copy; normalize before writing, original expected hashes unchanged. Initial failed atomicity fixture used source-tolerant range_km; use actual strict extra_delay_ms failure after backward-time reset. Accumulate4.5MB, reject failed past update preserving whole status, then valid10second step delivers5.25MB; accepted backwards update retains source reset semantics. Twenty-four concurrent updates yield exact1..24sequence; independent request/result copies and NaN/Inf rejection preserve last state. FullPython660PASS8existingERFAwarnings161.02s(session42514exit0); architecture checks included; whitespace PASS. Evidence validation/t077_data_fabric_source.md; ADR0025; contract contracts/data_fabric.md.
Internal module prerequisite only: HTTP schemas/adapter/per-app composition/remote unavailable/explicit browser exchange/receipt freshness/idempotency and actual V6 route/DTN rendering remain required. N008/T077/fullT075-T084/T151/T152/T153 remainOPEN. Next original ICD-02 HTTP and browser client assembly with existing verified network proof and explicit state-changing exchange, source remote adapter/status; no automatic upload or hidden empty-state success. Other source modules/Terra/allGPU/T032/N001/T137auth/physicalRF-HIL/filebytes/review preserved. Browser pending temporary GS-SITE_1 cleanup/screenshot from preceding turn remains unverified; inventory revalidated existingIABtab1 but no completed deletion evidence. No live server/native/UI/remoteGit/newbranch/originalenv change in this turn.


## 2026-10-06 T077 ICD-02 HTTP and remote adapter partial
Mount original network/route/status endpoint shapes and original four schemas in existing create_app with per-app default DataFabricExchange or injected DataFabricLink. Foundation unavailable error preserves transport/contract dependency boundaries. Original remote HTTP forwarding retained; transport/5xx/malformedJSON/non-object/redirect cannot masquerade as valid module replies (503/unreachable); invalid source requests remain400/422. Safe validation-error serialization for /api/data-fabric prevents non-finite request echo becoming500. Original OpenAPI baseline unchanged with explicit3paths/4schemas. Source browser network_twin.tick was inspected and is NOT copied because it would duplicate existing native propagation/optical history.
MissingAPI/module RED7 failures before implementation. First target3 malformed-remote fixtures returned400 because injected httpx client lacked base_url; fix fixture client, keep503 assertions and product parser guards. Focused API/contract/architecture11PASS10.57s. FullPython667PASS8existingERFAwarnings163.02s session25713exit0; whitespacePASS. No JS code changes or new Node suite claimed. Evidence validation/t077_data_fabric_api.md.
Actual owned8891 process29720 commandline reverified; immediate bootstrap/orbit/deployment captured. Terminate only that exact server; current stored-profile native0.3 server36112 on0.0.0.0:8891 (launcher42416). Restore same stored input/hash/EOP/leap/virtual point/minimum angle/play rate/exact pausedUTC2020-07-12T21:16:01.000416000Z through existing PUT selection. Verify SIM running/speed/scenario/mode/recording/seed match captured settings and faults empty/deploymentrevision0. Previous SIM elapsed/events/sequence/run archived, NOT restored; user informed before restart. New app fabric startssequence0 and only explicit source test-network POST changes it. Actual TCP3usablelinks/pathS1>S2>S3>G1, GP UTC unchanged. Receipt live_api_receipt.json is TEST-ONLY4node/3link source fixture, not protected native7node UI proof. Current fabric last-network is that test fixture; V6 exchange has not been enabled.
N009 OPEN before UI acceptance: stable exchange command identity/idempotent retry and route sequence/context fences across other windows; use existing verified native network/workspace owner, not source JS tick/clock/history. N008/T077/fullT075-T084/T151/T152/T153 stayOPEN; next guarded explicit browser exchange and actual V6 paths/DTN rendering, browser cleanup/screenshot/twores/multiwindow/full failures, other source modules/Terra/allGPU/T032/N001/T137auth/physicalRF-HIL/filebytes/review. TemporaryGS-SITE_1 deletion/browser confirmation remains unverified. Original environment/project preserved; samebranch/no remoteGit/newbranch/merge.


## 2026-10-06 T077/N009 guarded ICD-02 server prerequisite
Added guarded-v1 optional header/port semantics around unchanged source equations. Module instance plus observed sequence gates new exchange/route; bounded64-client monotonic high-water identity and single current receipt prevent duplicate/backwards old-command replay without per-message full history. Accepted identical current-command retry returns independent receipt; superseded/retired/reused-different commands conflict409. Capacity rejects rather than evicts identities; old instance rejects after restart. Legacy shapes remain available. Remote capability check blocks unsupported/unreachable endpoints beforePOST, forwards guards, checks receipt identity/sequence and preserves409; false reachability is not overwritten true.
Missing conflict/guard methods RED; guarded HTTP ignored headers RED2 before wiring; later malformed-sequence replay/false-remote-status RED5 repaired. Target36PASS13.46s before extra two concurrency cases; final dedicated17PASS1.03s includes24 same-command calls -> single source commit and24 different-window same-base calls -> one accept, atomic failures/copies/retries/stale context/capacity. FullPython684PASS8existingERFAwarnings164.30s session90403exit0; original source hashes/equations/OpenAPI/architecture remain verified; whitespacePASS. Evidence validation/t077_data_fabric_guards.md. No JS code changes/new Node proof claimed.
Actual8891 old ownedserver36112 commandline reverified and bootstrap/orbit/deployment/fabric captured (only previous test-only4node3link sequence1, no deployment/fault change). Current stored-profile server26364 on0.0.0.0:8891, launcher41632. Existing GP hash/virtual observer/minimum angle/rate/exact pausedUTC/EOP/leap restored; SIM running/speed/scenario/mode/recording/seed verified, old elapsed/events/sequence/run archived not restored and restart explained before action. Actual TCP retry remainssequence1, windowB acceptsequence2, stale route409, current routehash matches; GP UTC unchanged. data/workspace/validation/t077_fabric_guards_live/live_receipt.json is TEST-ONLY source fixture, not native/V6 geometry proof.
Browser recovery tried a temporary fresh IABtab2: actual screenshot/DOM showed GS-SITE_1 test station still present disabled35/128 alongside original3. Edit/native and semantic DOM clicks caused no editor change; no current dialog object exposed. Temporary agenttab closed, existing usertab1 preserved. Cleanup/screenshot-final/protected fullJSON remain unverified; this is a browser action/control issue with no deletion success claim.
N009 server prerequisite verified but remainsOPEN for original browser-client reuse, explicit exchange through existing verified native workspace port, complete context/UTC/roster/hash/fault/station fences, in-flight/retry/late/disposal/remote and real V6 route/DTN display. N008/T077/fullT075-T084/T151/T152/T153 remainOPEN; all other source modules/Terra/allGPU/T032/N001/T137auth/physicalRF-HIL/filebytes/review preserved. Samebranch/no remoteGit/newbranch/merge/originalenv change. Next connect guarded browser exchange/report to existing workspace owners and mount actual V6 route/DTN controls.


## 2026-10-07 T078 native 입력 승인과 V6 군집 서비스 화면

기존 RuntimeState가 수락 배치 명부와 현재 장애를 대조한 뒤 전체 위성 정의, 활성 지상국, 공통 UTC, 선택한 외부 GP/EOP/윤초, 실제 군집 모듈 instance/sequence를 확인한다. 설치된 native point receipt를 검증하고 불변 분석 입력 사본을 수락한다. 새 /api/nodes/mission-context와 선택적인 X-ISDC-Mission-Context 헤더는 계산 전후 입력 변경을 거부한다. 기존 API 형태는 유지하며 원래 orchestration 라우터를 실제 factory에 조립했다. 승인 해시는 입력 범위 확인이며 물리적 통신 성공이나 caller가 보낸 전체 window/mesh의 독립 검증 증거는 아니다.

V6의 기존 SIM 임무 화면을 보존하면서 다섯 군집 서비스 요청, source 저장소, original scheduler ICD-03 클라이언트, native request builder와 execution controller를 연결했다. 선배의 UTC timeline 파일은 고정 commit 원본과 byte-identical로 복사했고 원래 처리량/전송률/계획 창/장애·busy 투영을 재사용한다. 위성·지상국 목록 선택, 관측 지점 preset, 카탈로그 외부 위성 선택을 사용한다. 원본 node/optical/common-clock/ground/SIM owner가 현재 입력을 제공한다. 계획·확정·취소는 명시 버튼이며 확정 작업 전체와 최초 분석 UTC를 보낸다. 서버가 보유한 다른 창의 예약도 busy 입력에 반영한다. 편집값·잘못된 입력·저장 오류를 보존하며 외부 storage 변경 후 재조회 전 명령을 막는다. 대기 취소와 동일 요청 재시도/서버 증거 조회를 제공한다.

현재 source module/transport/timeline missing RED 후 구현. 입력 승인 일부 provisional class는 factory integration RED 전에 작성한 상태였으며 전체 과정을 test-first라고 주장하지 않는다. 초기 fullNode832PASS1FAIL은 기존 orbit select 격리 fixture에 신규 import 대체가 없었던 오류이며 기존 assertions를 유지하고 fixture만 수정했다. 설치된 native + actual ASGI factory의 실제 data deployment acceptance, 2h window, source compute3-task feasible plan→exact commit→abort를 검증했다. 수정된 작업409, 빈 approval header409, 잘못된 bands422, late 배치/모듈/장애 결과 거부를 확인했다. 실행 포트/브라우저 전체 동작 증거는 별도로 기록한다.

Chrome의 실제8891에서 군집 서비스 화면은 표시됐다. 실행 중인 이전 server factory에는 신규 module route가 없으므로 조회 오류가 표시됨을 확인했다. 현재 SIM/run/elapsed/events/missions/devices와 GP 선택을 먼저 캡처했다. unconfigured SIM, active fault 없음, 빈 deployment만 복원 가능한 개발 전환 method/factory를 추가하고 atomic rejection/복사/설정·이벤트 보존을 검증했다. 정상 factory의 자동 복원이나 새 공개 명령 API는 만들지 않았다. accepted deployment/hardware/module work 복원으로 확대하지 않는다.

T078/N010/N011과 전체 T075–T084는 미완료 유지. 실제8891 새 factory 적용과 live lifecycle, 모든5종 native feasibility/failure, 재시작 후 계획 adoption/reconciliation, multiwindow/성능/원격 module/통신 window·mesh 독립 증거, 나머지 영역·Terra/모든GPU/T032/N001/N008/N009/T137인증/실장비RF-HIL/다운로드 bytes/리뷰가 남았다. 같은 codex/satellite-node-integration 브랜치를 유지하고 remote push/merge/신규 branch는 수행하지 않았다. 사용자 시한은 한국시간10월7일01:00이다.

최종 코드 검증: fullPython821PASS, 기존 ERFA warning8개,207.20s(session69135 exit0). fullNode838PASS,4895.2763ms이며 이후 복제·초안삭제 버튼 추가는 source panel4PASS로 확인했다. 전체 시험에서 제외한 항목은 없다. 실제 factory 설치 native/수락 deployment/3task lifecycle를 포함한 focused10PASS도 확인했다. 현재 live8891 backend 적용은 다음 단계다.


## 2026-10-07 실제 Chrome 연결 보완

8891을 새 factory로 전환하고 같은 SIM run, 증가하는 elapsed, missions/devices/events와 GP 입력/UTC를 캡처·대조했다. 새 모듈 instance의 상태 조회와 다섯 서비스 폼은 실제 Chrome에서 확인했다. 이전 테스트 Fabric 상태는 별도 캡처하며 새 instance의 승인으로 가져오지 않았다.

실화면에서 드러난 연결 결함을 수정했다. 첫째, public status의 millisecond 반올림을 내부 data delivery 시각으로 사용하면서 배치 시작이 미래로 판정됐다. 기존 RuntimeState 내부 context는 소유자의 원래 precision을 유지하고 public display는 그대로 둔다. 반올림 양쪽 경계 RED 후 배치/후속 delivery48PASS, fullPython823PASS8existingERFAwarnings207.31s를 확인했다. 둘째, V6 node owner에 missionInputs/기존 optical update·verification port가 빠져 있었다. 실제 owner와 수락 배치/초안 변경/paused UTC/복사/종료 및 실제 optical proof를 대조하는 RED 후 연결했고 fullNode840PASS4618.513ms를 확인했다. 이전 검증 문서의 node port 연결 설명은 이 실제 수정으로 충족됐으며, 대체 port를 쓴 단위 시험만으로 전체 구성 검증을 완료했다고 보지 않는다.

실제 Chrome의 1-node/10MB/0.1 output compute 요청은 installed native approval+windows+original scheduler로 feasible3-task 계획과 UTC timeline을 표시했고 abort도 서버에서 수락됐다. commit은 Python float(4.0)와 JS JSON number(4)의 문자열 차이로409였음을 기록한다. 실제 factory/native lifecycle 시험에 browser numeric representation을 추가해 RED를 재현하고, exact numeric value를 비교하되 bool/type/key/order/값 차이를 구분하는 구조 비교로 수정했다. 관련22PASS를 확인했고 최종 fullPython 및 live commit 확인은 별도 추가 기록한다.

확정 계획·실제 통신·5종 전체 lifecycle 및 모든 T075–T084의 완료를 주장하지 않는다. 같은 브랜치,8891/0.0.0.0,기존 native0.3.0과 사용자 원본을 유지한다. 검증용 Chrome 작업만 생성했으며 원래 IAB 저장소를 수정하지 않았다.


최종 실화면 확인: 새8891 factory의 원본 계획 v2가 feasible3-task로 계산됐고 Chrome에서 commit 수락, 서버 held tasks3개를 확인했다. 이어 abort 수락/서버 committed 빈 명부, 검증용 배치 회수 revision4/빈 노드를 확인했다. 캡처 t078_final_live_committed.json / t078_final_live_cleanup.json / t078_source_mission_chrome.jpg. 사용자 원래 SIM missions/devices/events/run과 GP UTC는 서버 전환 캡처로 보존 대조했다. 검증용 Chrome 초안과 aborted 요청은 검증용 이름으로 남겼다.

최종 fullPython824PASS8existingERFAwarnings210.27s(exit0), fullNode840PASS4873.2648ms(exit0). 실제 compute lifecycle만 이 증거로 수락하며 나머지4종 전체 live lifecycle, 전체 T075–T084/N010/N011/T078, 다중 창/성능/모듈 복원 및 실제 통신 장비 검증은 미완료다. 고정8891 서버는 계속 실행한다. 같은 브랜치의 로컬 커밋으로 남기며 remote push/merge는 수행하지 않는다.
## 2026-10-07 지상 통신망 분석 표시 연결

기존 광통신과 통신망 소유자를 같은 1초 스케줄러에 순서대로 연결했다.
전체 노드와 지상국, native hash와 원본 계산 규칙을 유지하며 분석 시각과
현재 표시 시각을 구분한다. 이전 기하 결과는 현재 통신 품질이나 명령
승인이 아니다. 화면 이탈, 같은 UTC 권한 철회, 늦은 콜백과 Viewer 교체를
실패 시험으로 재현하고 수정했다. 원본 연결도 기본 출력 10가지는 변경 전
Git 출력 해시와 일치한다. 장애 입력 변경은 기존 스케줄러로만 갱신한다.

전체 Node1426PASS0FAIL0SKIP23280.4358ms, Python965PASS1기존PillowSKIP
8기존ERFA경고230.58s(exit0). 실제 카탈로그 소유자와 전체240노드의 두 해상도
조립2PASS13334.9982ms. 별도 화면21/renderer25/분석소유자72시험과 독립 검토.
Context7 공식 Cesium 이벤트·primitive 수명 규칙 대조는
validation/sampled_optical_connection.md에 기록했다. 실제 GPU 성능이나
운용 통신 검증으로 주장하지 않는다. N016 실제 화면/GPU, N017 읽기 전용
조회/통과/품질 이력, N018 정확 권한의 교환, 전체 T075–T084는 계속 열려 있다.
고정8891 서버, 사용자 실행과 초안, 원본 참조, 같은 Git 브랜치를 보존했다.
검증 문서: project_support/specs/001-v6-function-integration/validation/sampled_network_connection.md.

## 2026-10-07 통신 모듈 조회와 과거 품질 이력 연결

선배의 활성 화면 30초 조회와 48개 품질 이력을 기존 fabric 소유자와
지상 UI에 연결했다. GET 조회는 미확인 요청의 검토 상태를 해제하거나
전송하지 않는다. 실제 수락된 링크 품질만 원본 drawSparkline으로 표시하며
분석 UTC와 과거 출처를 남긴다. 이력이 없으면 미확인이다.

조회 취소, 명령 시작, 종료, endpoint 확인 중 native 입력 변경과 abort
콜백 재진입을 실패 시험으로 재현하고 수정했다. 독립 소유자 검토35개와
관련 조립 시험58개 통과. 전체 Node1465PASS0FAIL0SKIP25136.1955ms,
Python965PASS1기존PillowSKIP8기존ERFA경고237.35s. Context7의 공식 MDN
AbortSignal/fetch/abort-event 문서를 조회해 취소 의미를 대조했다.

실제 8891 화면 검증은 기존 Aside 세션에서 병렬 진행 중이다. 고정 포트,
서버, 사용자 SIM 실행과 원본 입력은 이 코드 변경으로 재시작하거나
초기화하지 않았다. N017 전체 미래 통과/3D 선택/경로와 N018, 실제 화면,
GPU 및 전체 T075–T084 수용은 미완료이다. 다음 원본 조사 결과는
research_future_pass_connection.md에 보존했다. 연결 증거:
project_support/specs/001-v6-function-integration/validation/network_status_history_connection.md.

## 2026-10-07 운영 지상국 선택·초점 연결 검증

선배의 단일 클릭 선택과 명시 초점을 기존 sourceGround, renderer와 하나의
globe handler에 연결했다. 카메라는 원본 높이2400000m/duration1.4s를 사용한다.
숨김·변경·검증 실패·편집 충돌·종료는 선택 증명을 철회한다. 기존 GP/UTC/SIM
입력은 선택이나 초점 때문에 바꾸지 않는다. active 소비자와 sampled 지원을
구분하고 유효한 현재 exact geometry를 유지한다.

실제 조립에서 sampled 미확인 조회가 정상 exact 결과를 삭제하는 null permit
문제를 RED로 재현하고 수정했다. 실제 화면 품질 빈칸도 원인을 명시하는
미확인 설명으로 바꿨다. Context7의 Cesium 공식 docs로 handler/pick/entity/
datasource 의미를 대조했고 의존성을 임의 업그레이드하지 않았다.

명령 `node --test project_support/tests/browser/*.test.mjs`: 1529PASS0FAIL0SKIP,
23850.9712ms exit0. 동일 native evidence/wheel 환경의 `python -m pytest -q`:
965PASS1기존PillowSKIP8기존ERFA경고239.50s exit0. 독립 renderer38/globe29/
최종36 focused PASS, 실제 workspace 조립 두 해상도 PASS. 어댑터 조립 시험은
실제 GPU 증거와 구분한다. 실제1440×900 Aside DOM receipt357에서 새 미확인
설명과 전송 비활성을 확인했으나 screenshot/두 해상도/실제 station 초점은
진행 중이다. 기존8891 서버와 사용자 SIM 실행/원본 입력은 보존했다.

다음 연결은 전체 수락 배치의 미래 통과 표시용 포트, native 조회와 원본
지상국 변경/분석시각 >60초 갱신/위성별3개/첫12개 표시이다. N017e 실제 화면,
미래 통과·mixed route·N018·GPU 및 전체T075–T084 수용은 계속 열려 있다.
증거: project_support/specs/001-v6-function-integration/validation/operator_station_connection.md.
