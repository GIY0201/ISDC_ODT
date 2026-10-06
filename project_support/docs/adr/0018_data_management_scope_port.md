# ADR0018 원본 데이터 관리 모듈의 계층 이식

2026-10-06. T079/C005/FR-008/FR-016 및 T076 배치 수락 의존성. 원본1a1e002의 operations_software/data_management 모듈을 현재 ISDC_ODT 계층 안에서 사용한다.

원본5파일의 정책 값과 카탈로그·복제·복구·서비스 계산을 보존한다. policy.py는 digital_twin/model_library/data_management_policy.py, catalog.py/placement.py는 digital_twin/simulation/data_management, stand_in.py/scopes.py는 digital_twin/runtime/data_management로 이식한다. simulation package의 현재 사용되는 profile exports를 통해 runtime의 기존 의존성 규칙을 유지한다. 새로운 operations_software 최상위 폴더나 미래 placeholder를 만들지 않는다. 실제 앱은 참조 저장소를 import하지 않는다.

모듈은 수락한 ICD 메시지의 storage roster, objects/jobs/events를 소유하며 twin orbit/selection/telemetry나 독립 시계를 만들지 않는다. 시간은 전달된 sim_elapsed_s만 사용하고 wall 문자열은 echo만 한다. ScopedDataManagement는 원본isolated-v1/RLock/범위별state를 유지한다. 범위 전환은 다른범위 삭제가 아니다. 초기scope에는 예제노드/제품이 없고 score는unevaluated다.

구조 변경 후 RED에서 중첩reason입력 alias가 확인됐다. 계산 변경과 분리하여 record.reason 저장·node report reason·event report를deepcopy로 보완한다. 정상메시지의 기존 결과/순서/정책은 동일하다. AST대조는 import 경로 및 정확히 이3copy보완만 제외하고 원본의 모든 계산/상수/문서문자열을 비교한다. 원문CRLF를Windows text writer에 그대로 넘겨 이중줄바꿈이 생긴 문제는 AST gate에서 검출하고 LF정규화 후 원문문자열을 복원했다.

이 모듈의 checksum은ref/size/version에서 만든모의값이며 random-seeded integrity events/latency/capacity도 대표모델이다. 실제파일저장·네트워크전송·실측무결성을 보장하지 않는다. 원본stand-in의 invalid command가_clock 후검증될수있는 의미와 MAX_STEP_S6h는 유지되며 strict message schemas/candidate activation/rollback은 다음경계에서 검증한다. HTTP adapter와 runtime 배치 수락/생성제품 동기화, 실제8891 UI 및원격설정은 아직 미연결이다.


2026-10-06 accepted-equipment production: reuse source model_library/data_deployment constants and simulation/data_deployment calculation. Only used _fraction/products_between/MAX_PRODUCTS_PER_CALL code from data_products is ported; fixed-ground operational snapshot helper is excluded because SDC generation must come from accepted equipment. Sourcevalid profiles/slot/ref/size/priority/order/per-node-hour partition preserved. Structural port nominal24PASS followed by3nonfinite RED; separate boundary repair adds one shared finite-number interval validator and a no-progress check on coarsehour iteration. This rejects NaN/Infinity/boolean/non-numeric/overflow and large finite clocks unable to represent a3600second advance; normal calculations/inputs unchanged. Caller still owns strict accepted identities/activation/production delivery and backfill prevention; no product HTTP route is mounted by this change.


2026-10-06 delivery capability component: original internal Protocol/error identities and HTTP remote adapter are reused. Shared exceptions live in foundation and are reexported from contracts to preserve external-layer dependencies. The serialized delivery cursor/2000-product chunks remain, with injected wall stamp, independent payload/receipt copies, exact isolated-v1 scope/roster/product acknowledgements and six-hour source clock catch-up before cursor publication. Same-scope reverse time is rejected before writes; accepted-start fences prevent backfill. Remote handshake requires reachable isolated-v1; redirects/nonobject JSON fail explicitly; injected/shared clients are caller-owned. Normal adapter wire trace is source-executed and compared in validation/t149_data_delivery.md. Actual RuntimeState acceptance/HTTP assembly and full T079 remain pending.
