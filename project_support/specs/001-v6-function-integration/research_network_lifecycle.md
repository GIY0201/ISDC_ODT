# N017 구현 전 원본 대조

읽기 전용 조사이며 구현 완료가 아니다. 기준 커밋
1a1e00297a0301637455b0ef2cf48b2e74576b07의 communication.js에서 32–34행은
통과 결과 60초, 모듈 조회 30초, 품질 이력 48개를 정의한다. 180행의 통과
갱신은 벽시계가 아니라 분석 시각 차이의 절댓값이 60초를 넘을 때이다.
835행의 지상국 변경은 즉시 다시 계산하며 활성 화면에서만 타이머를 둔다.

현재 fabric.refresh는 명시적 미확인 요청 검토이며 review/error를 해제한다.
자동 조회에서 이 함수를 그대로 호출하지 않는다. 같은 fabric 소유자의
읽기 전용 pollStatus가 필요하다. 실행 중 요청은 건너뛰고 미확인 명령과
검토 상태를 유지하며 endpoint, instance, sequence, hash 변경은 기존 수락과
경로를 무효화한다. 결과를 새 명령 승인으로 채택하거나 재전송하지 않는다.

기존 queryContactWindows는 일시정지와 임무 승인 계약을 유지한다. 재생 중
통과 표시에는 기존 nodeMissionWindows API의 승인 헤더 없는 읽기 전용
native 경로를 사용할 수 있다. 새 endpoint나 전파기는 필요하지 않다.
조립 소유자는 전체 수락 배치와 서버/run, 순서가 같은 정의, 모든 지상국,
장애, 분석 UTC와 불투명 표시 권한을 함께 캡처하는 표시 전용 포트를
설계해야 한다. 결과는 등록된 미래 기하 표시로만 제공하고 기존 임무
verifyContactWindows 또는 통신 전송 검증에 통과시키지 않는다.
동일 권한의 자연 재생만 늦은 결과를 유지한다. 같은 UTC seek, 입력 변경,
권한 철회와 source 변경은 거부한다. 활성 요청 하나와 최신 의도 하나만
유지하며 무시된 abort도 기존 전송 경계에서 완료를 기다린다.

품질 이력은 원본 drawSparkline을 재사용하고 실제 수락된 모듈 링크의
48개 과거 값만 보관한다. 알려진 usable과 유한 quality, 알려진 unusable의
원본 0을 구분하며 미확인은 임의 0으로 만들지 않는다. 수락 receipt의
instance/sequence/hash/request/link ID로 중복을 제거한다. 기존 전역
pushHistory에는 삭제 계약이 없어 scope가 섞일 수 있으므로 소유된 작은
과거 배열을 drawSparkline에 전달한다. 현재 상태 소유자는 추가하지 않는다.

검증 설계: 활성/숨김/종료 30초 주기와 중복 요청; 미확인 명령의 review
보존; 외부 instance/hash/endpoint와 늦은 응답; 전체240노드/24지상국 및
3시간 native 범위와 원본 결과; 임무 승인 헤더와 update 호출 없음;
60초 경계와 역방향 UTC, 지상국 변경; 같은 UTC 권한 철회; 49개 결과의
48개 제한과 중복 렌더링; 미확인 품질, scope와 instance 변경 시 이력 정리.

권장 구현 순서: 상태 조회와 품질 이력, 표시 전용 미래 통과 소유자,
기존 3D 지상국 선택/초점과 OISL·ground 경로 강조. N018의 주기적 guarded
 교환/DTN은 정확 권한 계약을 별도로 설계한다. 전체 T077을 완료로 닫지 않는다.

## 반복 취소 문제의 Context7 확인

설치된 Context7 CLI로 /mdn/content의 공식 AbortSignal 및 Fetch 문서를 조회했다.
이미 취소된 신호의 초기 확인, await 경계의 취소 확인, fetch 완료 뒤 본문
소비 전 취소가 별도 실패 경계임을 대조했다. 현재 signal.aborted 판정과
AbortController 연결은 이 의미와 일치한다. 페이지/endpoint의 현재 소유권은
애플리케이션 계약이므로 추가 ticket/endpoint 검증을 유지한다. 문서 조회만으로
source 권한의 재진입 문제가 해결됐거나 실제 운용 검증됐다고 주장하지 않는다.
참고: https://github.com/mdn/content/blob/main/files/en-us/web/api/abortsignal/index.md
및 https://github.com/mdn/content/blob/main/files/en-us/web/api/fetch_api/using_fetch/index.md.

추가 원본 직접 대조: communication.js 64행의 satellites()는
constellation.deployed를 사용한다. 263행 computePasses는 선택 지상국, 현재
분석 UTC, 3시간과 node별 maxPasses:3을 사용한다. 표시 전용 future port도
전체 수락 배치를 유지하며 node별 첫3구간의 원본 표시 제한을 대조한다.
현재 초안의 임의 일부나 카탈로그 선택만으로 배치 명부를 대체하지 않는다.

추가 취소 회귀에서 abort 이벤트의 외부 리스너가 조회를 다시 시작하는
경우를 확인했다. Context7의 MDN AbortSignal abort-event 문서를 다시 대조했고,
취소 중 새 조회의 시작을 막는 애플리케이션 경계와 종료 후 소유권 확인을
함께 검증한다. 문서가 보장하는 취소 이벤트와 실제 제품의 상태 소유권을
구분한다. 공식 참고:
https://github.com/mdn/content/blob/main/files/en-us/web/api/abortsignal/abort_event/index.md.

N017 지상국 연결에서도 Context7의 Cesium 공식 ref-doc을 조회했다. 질의는
`ScreenSpaceEventHandler LEFT_CLICK LEFT_DOUBLE_CLICK Scene pick Entity show
CustomDataSource lifecycle requestRender`이다. Scene.pick, 단일 canvas handler,
CustomDataSource.entities와 Entity.show의 소유/표시 의미를 대조한다. 현재
Cesium 버전을 임의로 올리지 않고 기존 handler와 datasource 경계를 재사용한다.
이 문서는 애플리케이션의 exact/sampled 증명이나 편집 충돌 권한을 보장하지
않으므로 해당 경계는 실제 소유자 회귀시험과 별도 UI 증거로 검증한다.
공식 참고: https://cesium.com/learn/cesiumjs/ref-doc/Scene.html,
https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html,
https://cesium.com/learn/cesiumjs/ref-doc/CustomDataSource.html,
https://cesium.com/learn/cesiumjs/ref-doc/Entity.html.
