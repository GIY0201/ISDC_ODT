# Data model

TaskDefinition: id (V6 업무 식별자), group (공용/운용자/DT), label, tab (기존 다섯 기능 또는 null), scope (기능 의미/한계).
WindowGeometry: x/y/w/h CSS pixel, 화면 안으로 clamp. 화면보다 큰 최소 크기를 강제하지 않는다.
WorkspaceSelection: task, minimized, expanded, geometry. application UI의 값이며 runtime 상태가 아니다.
RuntimeSnapshot: 기존 API/WS 계약 유지. running, speed, elapsed_seconds, run_id, mode와 provenance를 서버 사본에서 읽는다.
Transitions: 공용 -> 작업 열기 -> 최소화 -> 복원; 확장 <-> 복원; 닫기 -> 공용. 작업 이동 시 DOM 재생성 없음.
Popout: 같은 origin과 서버, 선택은 독립. window.open null이면 오류 안내.
