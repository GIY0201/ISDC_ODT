# N017 미래 통과, 지상국 선택과 경로 강조 연결 조사

## 조사 상태와 범위

2026-10-07 소스를 읽어 확인한 후속 설계의 사전 조사이다. 구현 허가나 완료 증거가 아니며 N017의 미완료 범위와 전체 이식 수용 조건을 닫지 않는다. 이 문서 작성으로 제품 코드, API, 계산, 시계와 시험을 변경하지 않았다. 실제 브라우저 성능과 GPU 수용 여부도 입증하지 않는다.

원본 기준은 ISDC-ODT 커밋 `1a1e00297a0301637455b0ef2cf48b2e74576b07`이다. 별도 읽기 전용 checkout에서 원본을 대조했으며 아래 원본과 현재 저장소 상대 경로를 구분한다. 참조 checkout에서 실행 코드를 import하지 않는다.

## 미래 통과 원본 동작

원본 `user_application/web/scripts/tabs/communication.js`의 `computePasses()`는 선택한 지상국 또는 첫 enabled 지상국을 대상으로 기존 `clock.now()`부터 3시간을 조회한다. `satellites()` 전체를 순회해 각 노드의 `predictPasses()`에 지상국의 최소 고도각 마스크와 `maxPasses: 3`을 전달하고, 결과를 AOS 순으로 합친다. 원본 계산기는 `digital_twin/simulation/browser/orbit.js`의 `predictPasses()`이다.

원본 `PASS_STALE_MS`는 60000이다. 갱신 조건은 `Math.abs(date.getTime() - passes.computedAt) > PASS_STALE_MS`로, 분석 UTC 차이가 **엄격하게 60000ms를 초과**할 때이다. 정확히 60초에서는 이 조건으로 갱신하지 않으며 뒤로 이동한 시각도 절대 차이에 포함된다. 벽시계 60초 polling, UTC 반올림 또는 정수 분 추정으로 대체하면 원본 의미가 달라진다. 지상국 변경과 명시적 새로고침은 별도 조회를 일으킨다.

원본 `renderPasses()`의 `passes.items.slice(0, 12)`는 계산 후 첫 12구간을 표시하는 제한이다. 전체 위성 입력이나 위성별 계산을 12개로 제한하지 않는다. UI 확장 시 페이지 표시를 추가할 수 있지만 원본의 계산 범위와 표시 제한을 혼동하지 않아야 한다.

## 현재 임무 승인 경계와 시각화 전용 조회

현재 `user_application/web/scripts/workspace_nodes.js`의 `missionInputs()`는 로드, 배치 확인, 비어 있지 않은 전체 deployed 명부, 오류 없음, server 일치, 동기화 및 busy 상태, dirty 여부를 확인한 뒤 **정지된 공용 표시 시계**를 요구한다. 이 정지 조건은 유지한다.

`user_application/web/scripts/missions/mission_services.js`의 `context()`, `requestWindows()`, `queryContactWindows()`와 `verifyContactWindows()`는 모듈 상태와 현재 수락된 임무 입력을 검증한다. `requestWindows()`는 `api.nodeMissionContext()`로 입력을 수락하고, `X-ISDC-Mission-Context`를 포함한 `api.nodeMissionWindows()`를 호출한다. 응답의 `accepted_context`와 전체 정의 해시를 확인한다. 이 경로를 자연 재생 중 자동 통과 표시에 맞춰 느슨하게 만들지 않는다.

별도 시각화 조회를 만들 수 있는 기존 경계는 `communication/browser/api.js`의 `missionWindowRequest()`와 `communication/http/mission_windows.py`의 `/api/nodes/mission-windows`이다. 해당 endpoint는 현재 context header가 없으면 임무 수락 context를 쓰거나 반환하지 않고, native sampled geometry와 `communication_status: 'unknown'`을 반환한다. 이를 활용하는 시각화 조회는 임무 context 수락, 모듈 polling, 계획 또는 commit 명령을 실행하지 않는다. 응답은 임무 승인 receipt가 아니며 기존 `verifyContactWindows()`와 임무 builder에 통과시키지 않는다.

최소 내부 포트는 기존 workspace owner가 전체 실제 수락 deployed 명부와 deployment identity를 읽기 전용으로 캡처하고 검증하는 것이다. **잠정 정책은 dirty draft일 때 failclosed**이며 기존 수락 입력의 로드, 확인, 오류, 서버 일치 및 동기화 조건을 유지한다. 새 포트는 시계 정지 요구만 시각화 목적에서 별도로 다루고 `missionInputs()`를 변경하지 않는다. 현재 drafts를 수락 명부 대신 사용하거나 UI에 별도 현재 상태를 만들지 않는다. 불변의 privately registered 캡처 또는 사본을 제공하고, 콜백 전후와 비동기 반환 후 기존 owner에 대해 재검증한다. 공개 JSON에 표시된 identity만으로 수락을 추정하지 않는다.

최초 자연 재생 지원은 실제 catalog display-continuity capability에 한정하는 것이 안전하다. 전체 roster, 선택 지상국 및 native 정의 입력을 캡처하고 기존 표시 UTC를 분석 시작 UTC로 사용한다. 자연 시각 이동은 동일한 실제 capability에서만 완료된 시각화 결과를 보존할 수 있으며 분석 UTC, 표시 UTC와 결과 나이를 표시한다. 명시적 seek, pause, source/config 변경, 지상국 변경, 수락 배치 교체, 실패와 dispose는 즉시 시각화 권한을 철회한다. 저장 재생과 SIM까지 지원했다고 일반화하지 않는다. 별도 시계, timer 기반 UTC 또는 시간 차이로 만든 source 권한을 추가하지 않는다.

## 검증 재사용과 native 비용

현재 `mission_services.js`의 `validateContacts()`는 geometry 검증과 임무 `accepted_context` 검증을 한 함수에서 수행한다. 재사용하려면 전체 native geometry 검증만 작은 공유 함수로 분리하고, 기존 임무 경로의 수락 context와 정지 상태 검증은 그대로 감싼다. 공통 부분은 schema, metadata, 전체 정의와 해시 명부, 정확한 site와 마스크, 시작 및 끝 UTC, sampling coverage, 모든 pass의 유한 값, UTC 범위와 순서, 중복 ID와 용량 제한을 포함해야 한다.

`user_application/web/scripts/missions/window_records.js`의 내부 `verified()`는 단일 노드와 하나의 definition hash를 전제로 한다. 전체 240노드 보고서에 그대로 적용할 수 없다. 시각화의 위성별 첫 3구간 제한은 **전체 native 응답을 완전히 검증한 뒤** 적용한다. 표시되지 않는 네 번째 구간의 오류를 무시하지 않는다. 선택 지상국에 대한 전체 수락 노드, 고정 3시간, station 마스크를 조회하고 위성별 AOS 순 첫 3개를 합쳐 다시 AOS 순으로 표시한다. 이는 원본의 계산 목적을 현재 native geometry로 투영하는 것이며 실측 RF 또는 연결 성공 판정이 아니다.

`user_application/mission_window_batch.py`의 `MissionWindowQuery.calculate()`는 contact reports뿐 아니라 항상 eclipse report도 계산한다. 선택 지상국 하나만 요청해도 이 추가 비용은 발생한다. 기존 endpoint를 그대로 재사용하는 설계에서는 이 비용과 기존 응답 계약을 보존한다. contact-only 최적화가 필요하면 별도 계약과 근거를 먼저 설계하며 필수 응답 필드를 조용히 생략하지 않는다. `user_application/native_passes.py`와 `user_application/mission_windows.py`의 native 입력 및 샘플 검증을 우회하지 않는다.

## 지상국 선택과 초점 연결

원본 `digital_twin/visualization/network_scene.js`의 `stationAt()`와 `communication.js`의 `select()`는 station single click으로 선택하고 double click 또는 명시적 focus로 카메라를 이동한다. 원본 operator station focus는 모델 추적을 해제한 뒤 station 경도와 위도, 높이 2400000m, duration 1.4s를 사용한다.

현재 `digital_twin/visualization/native_network_scene.js`의 `stationAt()`는 pick 결과의 `properties.stationId`를 읽지만 실제 owned station entity 일치를 확인하지 않는다. 그대로 클릭에 연결하면 임의 객체의 같은 ID를 신뢰하게 된다. 해당 renderer의 현재 owned entity 또는 coverage identity, 현재 station 정의, 표시 상태와 Viewer, morph, dispose 및 callback 경계를 확인해야 한다.

`user_application/web/scripts/workspace_globe.js`의 `stations()`, `selectStation()`와 `focusStation()`는 GP 관측 기준 지점을 관리한다. 편집 가능한 운영 지상국의 sourceGround owner와 다르므로 raw operator station ID를 이 포트로 전달하지 않는다. 최소 연결은 기존 `digital_twin/visualization/orbit_globe.js`의 pick handler와 기존 scoped node interaction 방식에 운영 지상국용 bounded binding을 더하고, 선택은 실제 기존 지상국 저장소로 전달하는 것이다. 명시적 focus만 기존 globe camera owner를 통해 요청한다. 새 Viewer, pick handler, clock 또는 station store를 만들지 않는다.

## OISL 및 지상 경로 강조

원본 `NetworkScene.applyEmphasis()`는 inherited OISL links와 groundLinks를 함께 강조한다. 경로 색은 `#a78bfa`, 경로 굵기는 4.5, 선택 링크는 4, 기본은 2이다. flow material의 time 위상을 보존하고, 경로 또는 선택이 바뀌면 나머지 링크의 기본 스타일을 복구한다.

현재 `NativeNetworkScene.applyEmphasis()`는 groundLinks만 처리한다. OISL을 소유한 `digital_twin/visualization/node_scene.js`에는 route 또는 selected-link 강조 포트가 없다. 현재 `ground_network.js`의 diagram은 검증된 fabric receipt와 available route의 hop link IDs를 두 종류의 링크에 이미 적용한다. 3D 연결도 같은 exact receipt 및 route 검증 경계를 재사용하고 별도 route/current-state cache를 만들지 않는다.

OISL ID 대응은 현재 `digital_twin/simulation/browser/network_snapshot.js`에서 사용하는 `ground_links.js`의 `pairId()`와 `user_application/web/scripts/nodes/links.js`의 `pairKey()`가 모두 문자열 endpoint를 정렬한 뒤 `|`로 연결하므로 동일하다. 전체 검증된 network 명부에 포함된 mixed OISL 및 ground hop의 `link_id`를 기존 분리 renderer에 투영할 수 있다. NodeScene에 최소 optional presentation emphasis 포트를 추가하더라도 exact fabric currentness, UTC, hash, endpoint, module instance 및 receipt를 유지하고 pending, 실패, 교체 또는 철회 시 강조를 정리한다. sampled geometry와 optical sampled view는 route 승인으로 사용하지 않는다. 선택 강조는 별도의 화면 표현이며 현재 통신 권한을 뜻하지 않는다.

## 후속 RED 회귀시험 제안

- 실제 catalog owner의 재생 중 전체 240개 수락 정의와 선택 지상국이 유지되는지, 3시간 및 위성별 최대 3구간 투영 전에 전체 native 응답을 검증하는지 확인한다. 표시되지 않는 구간의 오류와 잘못된 해시도 거부한다.
- 정확히 60000ms와 이를 초과한 분석 UTC, 뒤로 이동한 UTC, 자연 재생 중 느린 응답, 명시적 제어 및 같은 UTC에서의 source 권한 철회를 구분한다. ignored abort의 늦은 응답과 dispose는 게시하지 않는다.
- dirty draft, 배치 교체와 실패는 시각화 조회를 막고, 시각화 receipt가 기존 정지 임무 검증 또는 action 승인을 통과하지 못하는지 확인한다. 기존 임무 검증 시험을 유지한다.
- 실제 owned station single click은 선택만, double click과 focus 버튼은 명시적 카메라 이동만 수행한다. foreign entity, 가짜 같은 stationId, 삭제 또는 변경된 station, hidden, morph, Viewer 교체, nested callback과 dispose를 거부하고 GP 기준 지점과 공용 UTC 및 서버 상태를 변경하지 않는다.
- 전체 명부의 OISL 및 ground mixed route 강조, 이전 강조 정리, 원본 선 굵기와 색, flow material time 위상 보존을 확인한다. sampled-only 링크와 stale receipt는 경로 강조 승인에 사용할 수 없다. geometry 조회 또는 native 계산을 강조 때문에 추가하지 않는다.

이 목록은 후속 구현을 위한 시험 설계이며 실행 결과가 아니다. 내부 포트가 확정되면 ADR과 Spec Kit 계약을 검토한 뒤 제한된 파일 소유권 아래에서 RED부터 진행한다.

2026-10-07 후속 상태: 위의 stationAt/raw stationId 및 운영 선택·초점 누락은
N017c–e에서 소유자 등록 증명과 기존 handler의 연결로 수정했다. 세부 시험과
실제 화면 수용 범위는 validation/operator_station_connection.md에 기록한다.
이 문서의 다른 미래 통과/경로 누락까지 해결됐다는 뜻은 아니다.

다음 최소 단계는 workspace owner의 전체 수락 배치와 실제 선택 지상국을
캡처/검증하는 읽기 전용 future-pass 포트의 계약이다. 기존 missionInputs의
정지·수락 경계를 유지하고, 그 다음 native geometry-only 검증을 기존 임무
승인 검증과 공유한다. 마지막 UI 단계에서 지상국 변경 즉시 갱신, 분석
시각 차이 strict >60000ms 갱신, 위성별3개/전체 첫12개/현재 통과 표시를
연결한다. 기존 승인 통과 조회를 자연 재생용 결과로 재해석하지 않는다.
