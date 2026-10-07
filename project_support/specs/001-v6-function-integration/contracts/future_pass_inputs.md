# 미래 통과 표시 입력 계약

ADR0051의 optional workspace port:

- captureFuturePassInputs(stationId=null): 준비되지 않았으면 null. 현재 실제 수락
  whole deployed 명부, 선택한 enabled 운영 지상국과 표시 분석 UTC의 불변 등록 값.
- verifyFuturePassInputs(value): 같은 owner의 등록 값만 검증한다. 실패는 해당
  값의 영구 철회이며 복사본/가짜 JSON은 항상 false.
- beginFuturePassControl(): 실제 control-entry 조립 callback. 이전 epoch 철회,
  pending depth 증가와 idempotent release. 대기 중 입력 승인 금지. release는
  깊이만 정리하며 이전 token을 복원하지 않는다.

값은 FUTURE_PASS_INPUT_V1, analysis_utc, nodes, station, deployment 필드를 가진다.
native hash/geometry나 mission accepted_context 또는 action 승인 receipt가 아니다.
임무 승인 검증에는 절대 사용하지 않는다. 공개 metadata만으로 권한을 복구하지
않으며 HTTP나 모듈 조회 없이 기존 owners를 확인한다.

enabled station 없거나 명시 ID가 없으면 null. stationId null만 첫 enabled
fallback을 허용한다. full actual server receipt와 저장 수락 정의, dirty/loading/
busy/error/external conflict/activeground guards를 유지한다. 원본240범위의 명부를
선택 위성/일부 샘플로 줄이지 않는다.

정지 표시 source는 같은 UTC와 source 및 실제 readClock.running===false를
요구한다. 자연 catalog source는 기존 실제 opaque continuity capability의
동일성/검증을 요구하며 분석 UTC는 고정하고 표시 UTC 이동만 허용한다.
projected SIM, unsupported/leap UTC, source 교체와 명시 제어는 거부한다.
store/config/visibility/continuity/clear/dispose epoch 및 콜백 전후 검증을 적용한다.
관찰 포트는 실제 owner의 현재 사본·증명만 반환한다. 허용된 owner 변경은
기존 철회 이벤트 또는 beginFuturePassControl을 통과해야 한다. 실제 이벤트
재진입과 변경된 반환값을 거부하며, 통지 없이 다른 비공개 owner 상태를
변경하는 임의 getter의 조합을 보장하는 계약은 아니다.
source 비교는 UTC를 제외한 실제 display context 전체 provenance이다.
workspace_orbit은 begin callback을 기존 stored/SIM/scenario owner의 optional
onControl/observers.control 포트에 주입한다. 실제 상태 반영/실패 처리까지
pending을 유지하고 finally release한다. 저장 select, SIM command 및 기존
scenario runtime adapter의 refreshRuntime까지 감싼다. 동일 UTC 알림 생략이나
사후 readClock 값만으로 완료된 제어를 추정하지 않는다. 원본 요청 payload와
수, 동기 throw/실패/반환을 보존하며 GET 조회를 제어로 취급하지 않는다.
API 응답 도착과 controller adoption 사이의 microtask에도 입력을 승인하지 않는다.
시나리오의 기존 injectFault와 dataManagementRequest 명령도 같은 scope에서
입력을 보수적으로 철회한다. GET bootstrap 조회는 추가 scope를 취득하지 않는다.
고정3시간 조회, 위성별3/첫12표시와 strict>60000ms 갱신은 후속 owner/화면
계약이며 이 입력 포트 구현만으로 전체 N017을 완료하지 않는다.
