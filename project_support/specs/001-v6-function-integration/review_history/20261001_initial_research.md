# Research

## UI 기준
Decision: 참조 채팅과 2026-09-30 V6 결정 문서를 현재 기준으로 채택.
Rationale: V5 이전 기억보다 최신 사용자 결정이 우선한다.
Alternatives: V5 유지 또는 새 시안 제작은 채택 결정과 맞지 않는다.

## 원본 기능
Decision: upstream commit 1a1e00297a0301637455b0ef2cf48b2e74576b07을 별도 비교하고 로컬 기능을 보존.
Rationale: 로컬 폴더는 Git 없는 추출본이므로 원격 일치 확인을 분리해야 한다.
Alternatives: 개발 폴더에 clone 덮어쓰기는 기존 작업 손상 가능성이 있다.

## 창과 기능 연결
Decision: 기존 DOM/기능 모듈을 재사용하고 전역 지구를 이동한다. 작업 선택은 hash, 물리 상태는 기존 서버 API/WS로 전달한다.
Rationale: API/계산 수정 없이 V6에 기능을 연결한다.
Alternatives: 새 UI에서 계산을 다시 구현하면 결과 의미와 상태 소유권이 달라진다.

## 별도 창
Decision: 각 창은 같은 서버에 접속한다. 모의 run은 공유하고 입력/대상 선택은 창별이다.
Rationale: V6 mock의 BroadcastChannel last-writer-wins 복제는 운용 명령 계약이 아니다.
Alternatives: 전역 입력 복제는 충돌 정책 없이 도입하지 않는다.

## 접근성
Decision: 드래그에 키보드와 이동/크기 버튼 대안을 제공한다.
Rationale: ui-ux-pro-max의 dragging movements/keyboard 결과가 이 상호작용에 직접 대응한다.
Alternatives: 드래그만 제공하는 조작은 제외.

Clarify: 10개 범주 검토, material ambiguity 없음. 기존 구현 연결 및 실장비 제외를 spec 전제로 기록.
Hooks: extensions.yml 없음.
