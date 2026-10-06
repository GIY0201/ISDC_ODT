# ADR0020: 브라우저 초안 복원 오류와 식별자 생성

2026-10-06. T151 실제 노드 작업창 조립 과정에서 추가한다.

초안 복원 실패가 작업창 시작 Promise를 거절하면 사용자에게 복원 오류와
재시도 경로를 제공할 수 없다. 저장소 객체 접근 자체도 거부될 수 있다.
또한 randomUUID 메서드가 없는 브라우저 환경에서 기존 요청과 편집 ID
생성이 실패한다. 궤도 계산, 서버 수락 의미와 저장된 자료는 유지한다.

ConstellationStore의 기존 loaded 상태를 읽기 전용 getter로 공개한다.
WorkspaceNodes.start는 복원 오류를 화면에 표시하고 작업창을 연다.
명시적 retryRestore는 한 번의 진행 중 Promise를 공유하며, 복원되지 않은
초안만 load한다. 복원된 편집 초안을 다시 load하거나 폐기하지 않는다.
그 뒤 기존 배치 client의 GET initialize/refresh만 호출한다. 배치와 회수는
명시적 버튼만 실행한다. 복원 전에는 두 버튼을 비활성화한다. 저장소
proxy는 실제 접근 실패를 기존 store 오류로 전달하고 이후 재시도를 허용한다.
손상된 bytes를 자동 삭제하거나 빈 초안으로 덮어쓰지 않는다.

browser_identity.js는 상태 없는 공용 createBrowserId를 제공한다. 원래
randomUUID가 있으면 같은 수신 객체로 호출한다. 없으면 getRandomValues의
16 bytes에 UUIDv4 version/variant bits를 적용해 같은 형식의 ID를 만든다.
암호학적 난수도 없으면 명시적으로 실패한다. Math.random과 시각 조합으로
대체하지 않는다. 기존 요청/편집/배치 correlation ID 용도이며 인증 수단이
아니다. 외부 HTTP 요청의 schema, 의미, revision 또는 계산은 변경하지 않는다.

노드/equipment/formation와 저장궤도/카탈로그/태양/지상관측/RF 요청의
기본 ID 공급자가 이 함수를 재사용한다. 테스트에 주입된 공급자는 유지한다.
순수 module import에서 ID, 시계, 네트워크 또는 서버를 생성하지 않는다.

동시 창의 실제 CAS(N001), 원격 브라우저 접속 성공, 실제8891/GPU 복원,
노드 장면 composer 및 전체 T075-T084 완료를 주장하지 않는다.
근거: validation/t151_node_recovery.md.
