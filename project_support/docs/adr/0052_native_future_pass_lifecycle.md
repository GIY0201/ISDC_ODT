# ADR0052 native 미래 통과 조회와 원본 표시 수명

상태: 구현 전 설계. N017g/h와 전체 N017 수용은 아직 미완료다.

선배 communication.js의 전체 deployed, 선택 또는 첫 enabled 지상국,
3시간, 위성별 첫3구간, AOS 안정 정렬 후 첫12구간 및 AOS<=now<=LOS의
현재 통과 판정을 유지한다. 지상국 변경과 명시 새로고침은 즉시 조회하고
시각 이동은 Date.parse 기준 절대차가 엄격히60000ms를 초과할 때 갱신한다.
정확히60초와 반대 방향의 경계도 시험한다. 별도 시계나 wall timer를 만들지 않는다.

## 기존 계산과 검증 경계

api.nodeMissionWindows(payload,{signal})와 기존 /api/nodes/mission-windows를
재사용한다. contextHash 옵션과 X-ISDC-Mission-Context 헤더를 생략한다.
nodeMissionContext, module status, fabric send/route, 임무 plan/commit과 SIM
명령을 호출하지 않는다. 실제 N017f 전체 수락 입력으로 nodes, 단일sites,
분석 UTC부터 정확히3시간의 start/end, target/external/max_external_range_km:null을
보낸다. 계산은 기존 MissionWindowQuery의 native contact와 eclipse 경로이며
eclipse 비용은 유지한다. 새 물리 계산이나 wire 변경이 없다.

missions/native_contact_bundle.js에 순수 검증 함수를 추출해 현재
mission_services의 contact geometry와 새 표시 조회에서 재사용한다.
기존 accepted_context/display_context/currentness 및24시간·전체지상국
승인은 기존 서비스가 계속 소유한다. builder의 access/crosslink 계산은
변경하지 않는다. 기존 승인 서비스에 새 eclipse 필수 조건을 붙이지 않는다.

표시 조회는 전체 bundle의 request id, fullnode echo, 완전한64hex hash 명부,
정확한 조건과 단일site, sampled/unknown, native source/profile/frame/time/quality,
contact report/site/mask 및30초/0.1초peak/1초boundary 탐색을 검증한다.
보이지 않는 네 번째 이후 구간과 다른 위성까지 모든 행의 ID/중복/위성,
canonical9자리UTC, horizon/start<=peak<=end, 고각/flags와 contact 보고서 합계20000개 한계를
검증한다. eclipse는 원본처럼 schema_version 없는 보고서의 metadata,
60초/1초 탐색과 모든 windows 및 contact와 별도의 eclipse20000개 한계를 검증한다. target/external 보고서는 null,
accepted_context는 없어야 한다. 보고서 hash는 전체 echo와 보고서 간
일관성 증명이며 독립 실측 또는 물리적 진실의 암호학적 증거라고 부르지 않는다.
원본 정밀도 코덱으로 먼저 검증하고 표시 duration은 검증된 start/end에서
유도한다. 사용하지 않는 raw duration으로 임무 승인 요구를 강화하지 않는다.

## 표시 결과 owner와 갱신

nodes/future_passes.js의 createFuturePasses는 기존 api, N017f inputs,
표시 context 관찰, UTC codec와 request-id를 주입받는다. runtime의 현재
상태를 복제하지 않고 현재 조회와 불변 표시 결과만 소유한다. setActive,
selectStation, refresh, observe, presentation/verifyPresentation, snapshot,
cancel/destroy 포트를 제공한다. 승인용 값이나 저장소를 생성하지 않는다.

전체 검증 뒤 원본 명부 순으로 각 위성의 AOS 정렬된 첫3구간을 모아 안정
AOS 정렬한 첫12개를 투영한다. 등록된 FUTURE_PASSES_UI_V1은 분석 UTC,
실제 표시 UTC/분석 경과, 전체 위성 수, 지상국·mask, coverage, 현재 통과
flags와 unknown communication을 가진다. 공개 JSON이나 사본은 승인되지 않는다.
UI 게시 전후 실제 input token과 표시 context를 재검증하고 마지막에는
private generation/current/active/dead fences만 사용한다. 관찰 포트는
ADR0051의 실제 owner 사본·등록 증명과 기존 무효화 이벤트 계약을 따른다.

자연 catalog 연속성에서만 기존 결과를 유지할 수 있다. 같은 입력의 갱신
대기 중에는 이전 검증 결과를 분석 시각·나이·갱신 중으로 표시할 수 있으나
현재 통신/임무 승인으로 사용하지 않는다. 지상국/구성/source/control/배치
철회, leave와 dispose는 즉시 취소·숨김한다. 실패는 미확인으로 공개하며
같은 실패 시각에서 자동 무한 재시도하지 않는다. 자연 진행 중 조회가
대기하면 추가 병렬 native 조회를 생성하지 않고 최신 필요 시각을 기존
직렬 조회가 끝난 뒤 다시 관찰한다. abort를 무시한 이전 응답·오류·finally와
cancel 이벤트 재진입은 새 결과를 덮을 수 없다. Fetch 취소가 서버의 계산
중단까지 보장한다고 주장하지 않는다.

## V6 연결

ground_network의 기존 pass-* 임무 승인 영역과50개 페이지는 유지한다.
별도 future-pass-* 영역에 활성 지상국 선택, 새로고침, 상태와 첫12구간을
연결한다. 새 결과는 OISL/network receipt의 유효성과 별도로 검증한다.
기존 공용 display 및 workspace 입력 변경 관찰에서 observe를 호출한다.
패널의 renderer/getter는 native 요청을 직접 만들지 않는다. 새 timer,
Viewer, clock, module 조회나 SIM 명령은 없다. leave/remount/dispose,
원본 편집값·GP·UTC·SIM 상태와 다른 창을 보존한다.

## 검증

코드 전 shared validator·query owner·panel/root의 의미 있는 RED를 작성한다.
전체 실제240명부, canonical9자리UTC, 숨겨진 malformed row, source metadata,
headerless actual API, approved receipt 경계, pernode3/12 및 equal-AOS 명부 순서,
60초 경계/역진행, 지상국 즉시 조회, pending 직렬화, 동기·await·callback 취소,
late/reentry/failure/leave/dispose를 시험한다. 실제1920x1080/2560x1440
조립과 HTTP route→생산 native bundle→브라우저 owner를 연결한다.
full Node/Python 및 독립 검토를 기록하고 실제8891 화면 수용은 별도로 확인한다.
전체 N017 mixed route/N018/T075–T084/T032/GPU/성능/장비·RF/PR은 유지한다.
