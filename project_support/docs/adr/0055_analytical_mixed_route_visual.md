# ADR0055 Captured analytical route의 별도 3D 시각 강조

상태: 구현 전 설계. N018 남은 실제 원본 기능이며 optical-only 또는 analytical table로 완료하지 않는다.

## 원본과 잔여

Pinned 1a1e002 communication.js sendSnapshot accepted answer마다 selected route를 다시 요청하고 network_scene.js setRoute/applyEmphasis가 같은 NetworkScene의 OISL 및 ground 링크에 purple #a78bfa/4.5 route width,4 selected,2 base를 적용한다. 현재 exact-current ADR0053 route 강조는 연결되었으나 자연 catalog 진행 중 ADR0054 analytical receipt/route를 exact setNetworkScene에 넣을 수 없다. 그 권한 경계는 보존하고 별도 등록된 historical visual projection을 연결한다.

## 단일 결과 소유자와 최소 ports

기존 fabric_exchange analyticalPresentation()에 accepted record의 full frozen native_snapshot을 포함한다. native_snapshot은 token.snapshot의 analytical data copy이며 raw token이나 command capability가 아니다. receipt/route/native_snapshot/analysis_utc/source/current_analysis:false를 같이 제공하며 verifyAnalyticalPresentation(view)가 actual registered raw command/current whole accepted deployment/continuity/endpoint/module guard를 검증한다. 사본/재동결 사본은 거부한다. 같은 accepted record/route object에 대한 bounded immutable view reuse를 허용해 RAF240 full copies를 방지하되 public copies와 wire/action API는 유지한다.

기존 mixed_route_emphasis owner에 optional complete pair readAnalyticalFabric()/verifyAnalyticalFabric(view), differenceUtc를 주입한다. 별도 readAnalytical({utc})/verifyAnalytical(value,{utc,nodes})는 borrowed actual fabric registered view를 검증한 뒤 current display와 captured full native/hash/station/fault/source/module proof를 검증한다. 원본 route 전체 path/hop_list의 id/kind/from/to/endpoints를 captured native roster에 대조한 뒤 OISL/ground routed_ids를 projection한다. available route 없는 상태는 route 성공을 만들지 않는다. native_snapshot 자체는 exact current native approval가 아니며 current view ownership과 full accepted definitions/continuity는 actual fabric verifier에서 유지한다.

Frozen marker MIXED_ROUTE_ANALYTICAL_UI_V1 필드: analysis_utc (original route/network calculation UTC), display_utc (actual current frame), age_seconds (canonical codec difference), current_analysis:boolean (UTC equality only; action authority 아님), native_snapshot full native metadata, node_definitions/full definition_hashes, routed_ids, oisl_links/ground_links ID+endpoints, source:'captured_native_analysis', availability/reason. Private registration/current input epoch를 검증하며 failed/clear/hide/control/dispose token은 복귀로 되살아나지 않는다. 기존 MIXED_ROUTE_EMPHASIS_UI_V1/read/verify exact 경로는 바꾸지 않는다.

## 기존 renderer에서 표시만 변경

NodeScene routeEmphasis optional sampled/analytical branch는 actual display_utc===frame UTC, full ordered definitions/hashes, current native endpoint geometry와 owner proof를 전후 검증한다. NativeNetworkScene도 같은 analyticalRouteEmphasis read/verify pair를 optional로 받아 기존 현재 검증된 exact 또는 NETWORK_SAMPLED_UI_V1 collection에 있는 ground link만 스타일링한다. 두 renderer는 routed ID가 현재 collection에 없으면 생성하지 않는다. old analytical route를 기존 exact snapshot/fabric usability/network routing input으로 승격하지 않는다. native lines 자체의 현재 분석 source/age/incomplete-current 표시는 그대로 유지하고 route 분석 UTC/age를 별도로 표시한다.

Material flow time과 originalMaterial을 보존하고 source purple/width만 override한다. selected-only는 원본 표시 선택으로 route 승인과 분리한다. route failure/pending/conflict/unknown/current source/control/definition/fault/site/endpoint/module 변화, missing current native geometry, morph/hide/Viewer 교체, callback 재진입 시 기존 기본 스타일을 복구한다. before/post endpoint/getter/material/publication callback owner proof와 callback-free private binding fences를 사용하며 무한 검증 loop를 만들지 않는다. 동일 Viewer/line/primitive만 쓰고 새로운 clock/physics/query/store/DTN/route result owner는 없다.

## 검증 및 상태

T166 RED: moving catalog liveUTC != immutable analysisUTC의 full mixed path가 실제 registered analytical fabric 결과로만 표시; copied/forged/endpoint/module/fullscope/source/hop/lease 변경 거부. T167 renderer RED: sameViewer existing OISL+ground source purple4.5/selected4/base2/material/time 보존, current full240 hashes/endpoints, no missing link creation, sameUTC control revocation/clear/hide→reshow/late callback/Viewer/morph failure 복구. T168 실제 guarded module/native/Rust/current input/두 해상도 UI proof와 source periodic accepted answer→selected route→same shared 3D display chain 및 성능 검증. 설계 또는 unit PASS로 T077/N018/T032 완료라고 하지 않는다.

## 원본 SVG 및 선택 상세에도 같은 historical 경계

현재 ground_network.renderDiagram의 sampled 경로는 receipt/nodeStates/routeLinkIds를 전달하지 않고 별도 renderAnalyticalFabric 표만 제공한다. 따라서 원본 selected-route SVG 강조/accepted quality 색과 custody badge, 선택 node/link의 module verdict를 아직 모두 연결한 것은 아니다. 동일 privately registered analytical fabric view를 SVG/detail readonly path에 빌려 별도 분석 UTC/age/historical 상태를 명시한 후 원본 pure diagramMarkup/nodeStates/link verdict 계산을 재사용한다. current geometry/link roster에 없는 captured ID는 만들지 않으며 full identity/scope/proof를 전후 검증한다. Diagram에서 routed_ids는 route 전구간 native 검증 이후만 쓰고 sampled native layout가 module wire approval로 승격되지 않는다. 현재 exact renderDiagram/detail은 그대로다. T168 acceptance에는 SVG/상세/table/같은Viewer OISL+ground 모두 포함한다.
