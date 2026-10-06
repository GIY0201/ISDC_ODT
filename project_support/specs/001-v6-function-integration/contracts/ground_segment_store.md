# 지상국 설정 포트

createGroundSegmentStore({model, storage})는 기존 ground_stations 모델과 브라우저 저장소를 주입받는다. 별도 시계·전파·Viewer·서버 현재 상태를 만들지 않는다. STATIONS_KEY는 spacetwin-ground-stations-v1, 최대 지상국은24개다.

load/add/update/setEnabled/remove/select/reset/find/stations/enabled/selectedId/selected/availablePresets/subscribe는 원본의 정상 의미를 유지한다. load는 성공 boolean, ready는 읽기 수용 여부, error는 오류 문자열 또는 null, persistence는 browser_storage 또는 memory_only다. destroy 후 수정은 거부된다. 사본의 외부 편집은 내부 설정을 바꾸지 않는다.

원본 이벤트 load/add/update/remove/select/reset과 실패 error를 제공한다. 입력 오류 update는 배열, 추가 입력 오류는 TypeError, 한도는 RangeError, 저장 실패는 예외다. UI는 오류를 표시하고 실패 시 편집 폼을 보존해야 한다. ready=false에서는 계산기가 마지막 목록을 정상 입력으로 취급하지 않아야 한다.

저장 schema1/sequence/selectedId/stations 전체를 검증한다. 일부만 복원하거나24개로 조용히 자르지 않는다. 명시적 load는 다른 창이 저장한 설정을 쓰기 없이 다시 읽지만 편집 충돌 해결 자체를 제공하지 않는다. 실제 조립의 충돌/late/error 처리와8891 웹 검증은 T077/N008에 남는다. ADR0024 참조.

2026-10-06: last loaded/written storage token is checked before writes; other-window changes reject the candidate and set ready=false, retaining old in-memory values and other-window bytes until explicit load. Actual V6 editor preserves pending fields on reconstruction and storage events; source markup body remains exact. This guard cannot provide atomic compare-and-set across simultaneous localStorage writers; full multiwindow acceptance stays open. See validation/t077_ground_network_panel.md.
