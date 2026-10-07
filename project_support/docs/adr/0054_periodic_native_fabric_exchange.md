# ADR0054 원본 주기적 통신망 교환과 captured native analysis 계약

상태: 구현 전 설계. N018 전체 원본 이식은 아직 완료하지 않았다.

## 원본과 현재 차이

Pinned 1a1e002 communication.js tick(165-180)/sendSnapshot(185-205)는 활성 통신 화면의 1000ms 분석 tick마다 기존 networkTwin.exchange를 시도하고 수락 결과로 DTN/link/node 보고를 표시하며 선택된 routeRequest를 다시 요청한다. communication/network_twin.js의 MIN_EXCHANGE_INTERVAL_MS=900 및 in-flight는 같은 UTC 반복도 새 교환으로 처리하고 중복 요청은 막는다. 현재 V6 명시적 exact send만으로 이 동작을 완료했다고 하지 않는다.

## 단일 원본 분석 소유자

기존 optical_timeline/network_timeline 안에 optional captureRawAnalysis()/verifyRawAnalysis(token)를 더한다. 두 factory의 기존 exact update/snapshot/verifiers와 sampled UI는 그대로다. token은 privately registered deep frozen {kind:'OPTICAL_RAW_ANALYSIS_V1'|'NETWORK_RAW_ANALYSIS_V1',analysis_utc,snapshot}. snapshot은 기존 소유자가 완전히 검증하여 이미 수락한 RAW 분석 결과의 복사이며 sampledPresentation wrapper나 UI receipt를 command로 전환하지 않는다. optical snapshot은 기존 full native optical value/proof를 포함한 공개 snapshot-equivalent data; network snapshot은 기존 full network envelope equivalent다. analysis_utc와 network.time은 실제 계산한 UTC 그대로 유지한다.

현재 실제 opaque catalog continuity/full source GP/EOP/leap/key, full ordered node definitions/hashes/stations/faults 및 source config가 동일한 경우 자연적인 display UTC 진행과 다음 성공한 분석 수락은 이전 token을 무효화하지 않는다. 별도 private revocation epoch/WeakMap registration은 explicit cancel/reset/prune/control/continuity gap/native failure/dispose에서 철회되며 이전 조건 복귀로 되살아나지 않는다. 정지/stored/SIM/missing capability는 기존 exact-current 분석 경계만 허용한다. network raw token은 당시 optical raw token을 보유하고 그 verifier를 다시 사용한다. 현재 sampled optical view가 다음 분석으로 바뀌었다는 이유만으로 raw command를 취소하지 않는다. 한 history owner/active lane/native query/physics/clock/Viewer를 보존한다.

## 기존 fabric 단일 command lane

createFabricExchange에 optional network.captureRawAnalysis/verifyRawAnalysis를 주입한다. sendAnalytical(token)과 routeAnalytical(source,target,objective) 및 analyticalPresentation()/verifyAnalyticalPresentation(view)는 기존 active/command/accepted/routeResult에 origin discriminator를 부여해 처리한다. 별도 현재 상태 store를 만들지 않는다. 기존 snapshot/send/route exact receipt는 captured-analysis origin을 현재 UTC exact approval로 공개하거나 재사용하지 않는다. captured UTC와 현재 display UTC를 별도로 표시한다. 보내기 전/각 await 후 raw registered proof, 전체 accepted deployed roster/server readiness, stations/faults, actual clock-control epoch/continuity, endpoint/module instance/sequence/request/hash를 재검증한다. native body나 wire timestamp를 current UTC로 재라벨링하지 않는다.

같은 analysis UTC에도 주기적 반복은 status handshake의 최신 module sequence와 새 request_id로 실제 guardedUpdate를 수행한다. 응답 instance/sequence/hash/request 검증과 기존 retry/uncertain/conflict/review 정책을 유지한다. 모호한 이전 요청은 주기적으로 새 요청으로 대체하지 않으며 명시적 검토 전 자동 전송을 중단한다. 기존 explicit command 및 readonly poll과 한 flight를 공유하고 취소가 무시된 transport는 terminal까지 drain한다. 각 accepted answer 후 선택 route만 동일 accepted instance/sequence/hash로 guardedRoute를 한 번 요청한다. unavailable/late route는 성공 강조가 되지 않는다. exact/sampled renderer 및 fabric approval 경계는 그대로다.

## 원본 cadence와 실제 조립

별도 분석 timer가 아닌 기존 1000ms optical→network sampled scheduler의 완료 callback에서 accepted raw capture 후 전달한다. 활성 ground consumer에 한정된 source original active-tab lifetime, MIN900ms wall throttle, 한 flight+bounded latest signal, explicit source/config/time action의 즉시 분석을 유지한다. 전체 실제 accepted deployed roster가 없거나 draft dirty/server busy/conflict면 자동 command는 차단하고 이유를 표시한다. paused exact 입력도 원본처럼 반복할 수 있다. stored/SIM은 실제 exact proof가 있을 때만 보내며 자연 카탈로그 진행은 raw registered command capability로 처리한다. sampled UI는 자동 전송 권한이 아니다.

## 검증과 남은 gate

RED: 자연 UTC 진행 중 guarded exchange 성공/full240 body/time 보존, 다음 분석으로 raw token 유지, explicit sameUTC seek/controls/foreign source/hash/station/fault/endpoint/instance 철회, ignored abort/no overlapping/new sequence repeatedsameUTC, uncertain/review automatic stop, selected route request 재사용, UI exact proof 비승격 및 command provenance 복사 위조 거부. 전체 source contracts/실제 Rust API/모듈/두 해상도/live cadence/UI/성능 gate는 각각 입증해야 한다. 설계만으로 T077/N018/T032를 완료하지 않는다.

단일 flight는 mutating exact/analytical update 및 route command lane을 뜻한다. 기존 readonly status GET은 독립적으로 취소되며 명시 command가 먼저 시작될 때 preempt한다. ignored-abort readonly GET이 물리적으로 drain되는 동안에도 기존 command 시작 정책을 보존한다. mutating retired lane은 terminal까지 모든 새 mutating command를 차단한다.

## 2026-10-07 consumer 구현과 scoped 근거

기존 tabs/fabric_exchange.js의 same active/command/accepted/routeResult 안에서 captured_analysis origin을 처리한다. 기존 exact snapshot은 captured receipt/route를 공개하지 않고 cross-origin send dedupe는 neutral null로 lane만 차단한다. 동일 origin만 실제 promise를 공유한다. sendAnalytical token은 actual raw registration 검증에 더해 workspace_nodes wrapper가 매 await마다 full accepted deployment/server/stations/control authority를 검증한다. controller invalidation entry에서 별도 control epoch를 철회하며 posted analytical command의 unknown outcome은 explicit refresh 전 review를 유지한다. ignored-abort mutating active는 terminal까지 drain한다.

nodes/periodic_fabric_exchange.js는 계산/receipt owner가 아니라 existing fabric 호출 cadence만 조립한다. nodes/optical_display_scheduler.js의 optional onAnalysisTick은 기존 단일 1000ms timer와 successful analytical completion에서만 호출한다. paused native cache 재사용의 heartbeat와 natural catalog analysis 완료를 같은 owner에 조립한다. hidden/clear/dispose는 deactivation하며 늦은 결과/route는 publish하지 않는다.

새 consumer RED: missing methods 5 FAIL; cross-origin 반환 receipt, canceled POST unknown review loss, endpoint getter setup invalidate, rejected sampled callback를 각각 재현했다. GREEN 마지막 scoped command: node --test fabric_analytical_exchange/fabric_exchange/fabric_exchange_observation/periodic_fabric_exchange/periodic_analysis_scheduler/node_optical_display_scheduler/workspace_nodes test files, 149 PASS 7949.896ms. 이 증거는 fake transport 및 실제 JS/native-owner 조립의 local regression이다. 실제 installed Rust/module/live8891/full240/two-resolution source cadence 및 DTN presentation/route/render/성능 전체 acceptance의 대체가 아니다. 원본 migration task 전체 완료는 별도 gate다.
