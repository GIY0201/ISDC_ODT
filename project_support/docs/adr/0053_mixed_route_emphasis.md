# ADR0053 원본 OISL 및 지상 혼합 경로 강조

상태: 구현 전 설계. N017의 이 항목과 N018은 아직 미완료다.

기준은 선배 pinned 1a1e002의 digital_twin/visualization/network_scene.js
applyEmphasis/setRoute/setSelectedLink이다. 하나의 NetworkScene이 상속된 OISL과
지상 링크 모두에 경로 색 #a78bfa, 경로 폭4.5, 선택 폭4, 기본 폭2를 적용한다.
기존 flow material과 time uniform을 유지하고 색만 변경한다. 현재 V6의 SVG와
NativeNetworkScene 지상 강조는 연결되어 있으나 NodeScene OISL 강조는 없다.

## 최소 소유권 경계

nodes/mixed_route_emphasis.js의 createMixedRouteEmphasis는 기존 network와 fabric
소유자 읽기/검증 및 실제 display 읽기를 주입받는다. capture({snapshot,receipt,
route,selectedLinkId}), read({utc}), verify(view,{utc,nodes}), clear/destroy를 제공한다.
현재 runtime/clock/Viewer/경로/DTN 또는 물리 계산을 만들지 않고 하나의 불변
UI 투영만 보관한다. 경로의 유일한 결과 소유자는 기존 fabric_exchange이다.

capture는 현재 정확 UTC의 완전한 native network와 모든 node/hash/station/fault
증명을 검증한다. 입력 snapshot은 actual network snapshot과 같아야 하며
verifyNetworkSnapshot이 참이어야 한다. NETWORK_SAMPLED_UI_V1은 거부한다.
route 강조는 actual fabric status accepted, pending false, 오류/refresh_required 없음,
정확한 receipt 및 route 일치와 현재 instance/sequence/hash를 요구한다. hop의 link ID,
종류 및 양끝 노드는 native 명부에 존재해야 한다. 선택 링크는 현재 native 명부에
있는 OISL ID만 투영하고 전송 또는 경로 성공을 주장하지 않는다.

등록된 깊은 불변 MIXED_ROUTE_EMPHASIS_UI_V1은 analysis_utc, full node_definitions,
definition_hashes, OISL link ID/endpoints, routed_ids, selected_id만 가지며 action
receipt로 사용할 수 없다. JSON/사본/가짜 view는 거부한다. read 및 verify는 전후
actual display/full network/fabric 소유자 검증 후 마지막 private epoch/dead fence를
적용한다. 실패한 등록은 철회되어 동일 UTC 복귀로 되살아나지 않는다. 관찰 포트는
실제 소유자의 사본/검증 함수이며 재진입 변경은 기존 소유자 알림을 따른다.

## 렌더 연결

NodeScene optional routeEmphasis:{read,verify}는 같은 OISL primitives 위에만 원본
스타일을 적용한다. current native endpoints와 기존 exact 또는 registered sampled
visual 링크 placement는 변경하지 않는다. 강조는 정확 현재 network/fabric 증명이
있을 때만 허용한다. 과거 sampled link의 존재 자체는 경로 승인이나 강조 근거가
아니다. invalidation/UTC/source/모드/Viewer/명부/clear/dispose는 원래 색과 폭으로
복구한다. material/time 유지, 숨겨진 링크 부활 금지, callback 이후 최종 proof와
callback 없는 내부 frame/binding 검증을 요구한다.

workspace_nodes의 기존 setNetworkScene/clear와 composite renderer 조립에 연결한다.
ground_network, workspace_orbit, NativeNetworkScene의 기존 ground/SVG behavior는
이번 범위에서 변경하지 않는다. 외부 포트가 없으면 기존 NodeScene 동작을 유지한다.
경로를 사용하지 않는 프레임은 full native/fabric getter를 읽지 않으며 UTC mismatch는
cheap precheck로 거부한다. 실제 경로가 활성인 프레임의 전체 증명 비용은 성능 검증에서
측정해야 하며 game acceptance 기준을 낮추지 않는다.

## 검증과 후속 작업

코드 전에 mixed OISL+ground route, 원본 색/폭/flow 보존, selected link,
clone/fake/sampled 거부, 전체240/hash/station/fault/endpoint/instance/sequence 변경,
pending/error/review/late/reentrant/UTC-away-back/clear/dispose를 RED로 검증한다.
기존 NodeScene exact/sampled 회귀와 실제 workspace 조립에서 source 대응을 확인한다.
독립 analyze 이후 구현하며 full Node/Python/실제8891 두 해상도/GPU/성능/PR/T032
수용은 별도 유지한다. N018의 원본 매초 exchange/MIN900/DTN/selected-route 갱신은
별도 command authority 설계가 필요하며 이 UI 투영에서 자동 전송하지 않는다.
