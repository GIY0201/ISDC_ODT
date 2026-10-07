# 혼합 경로 UI 투영 계약

ADR0053, N017. createMixedRouteEmphasis({readNetwork,verifyNetwork,readFabric,
readDisplay})는 실제 기존 소유자만 읽는다. capture({snapshot,receipt,route,
selectedLinkId})는 full exact current native snapshot 검증과 actual fabric receipt/
route 증명 뒤 등록된 깊은 불변 MIXED_ROUTE_EMPHASIS_UI_V1을 만들며 실패는 null이다.
read({utc})는 해당 정확 UTC의 투영 또는 null, verify(view,{utc,nodes})는 등록된
동일 객체와 actual whole scope/current source/fabric 증명이 일치할 때만 true다.
clear/destroy는 등록을 철회하며 실패한 view와 사본은 다시 승인되지 않는다.

필드: presentation_kind,analysis_utc,node_definitions,definition_hashes,
oisl_links[{id,a,b}],routed_ids[string],selected_id:string|null. 명부 축소 금지.
available route의 전체 hop scope를 검증한 뒤 OISL ID만 routed_ids에 투영한다.
지상 강조는 기존 NativeNetworkScene이 동일 fabric 결과로 처리한다. 선택은
현재 native OISL 링크 표시 선택이며 통신 수락 또는 전달 성공이 아니다.

NodeScene optional routeEmphasis:{read({utc}),verify(view,{utc,nodes})}는 읽은
동일 등록 객체를 전후 검증한다. 원본 #a78bfa/4.5/4/2와 material/time 보존,
현재 endpoint/frame/Viewer/visibility/morph 및 callback 경계 검증을 유지한다.
무효는 기본 스타일로 복구하며 링크를 생성하거나 부활시키지 않는다.
sampled visual proof/action receipt/JSON을 서로 대체하지 않는다. 정상 경로가
없는 프레임은 full getter를 호출하지 않고 UTC mismatch는 먼저 거부한다.

원본 communication.js 매초 exchange와 DTN/selected-route 재조회는 N018의
별도 계약이다. 본 계약에 timer, clock, fabric 명령 또는 새 현재 상태는 없다.
