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
