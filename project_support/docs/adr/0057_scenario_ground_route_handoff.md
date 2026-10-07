# ADR0057 시나리오 경로 선택값의 기존 지상 화면 인계

상태: 사전 독립 분석 HIGH0/CRITICAL0, 실패 회귀 이후 구현한다.

Pinned 원본 runner.js:423은 scenario:route에 routeSpec을 보내고
communication.js:927–932가 지상 화면의 출발/목적/목표와 routeRequest를 갱신한다.
현재 runner.js:448도 이벤트를 보내지만 workspace_adapter의 emit은 이름/내용을
버린 채 onChange만 호출한다. 실제 시나리오 경로 계산은 이미 연결되어 있다.

기존 어댑터에 optional onRouteSpec 포트를 추가하고 정확히 scenario:route에서
복사된 source/target/objective만 전달한다. root는 기존 ground panel의
adoptRouteDraft에 연결한다. 패널은 현재 전체 노드/활성 지상국 명부와 서로 다른
끝점, 기존 세 objective를 검증하여 기존 routeChoice/드롭다운만 갱신한다.
이 이벤트는 실제 module 경로 수락 이전에도 발생하므로 수락 결과나 통신 승인으로
표시하지 않는다. 기존 명시 경로 버튼/등록된 주기 교환이 기존 검증 후 계산한다.
새 HTTP/명령/clock/owner/계산식 또는 자동 승인은 추가하지 않는다.

오래된 runner callback, dispose/입력 교체/명부 변경/중첩 paint를 거부한다.
미저장 지상국 편집 내용과 다른 입력, 기존 실행/배치/시각을 보존한다.
실패 회귀: 정확한 이벤트 payload, 잘못된 ID/동일 끝점/목표, 두 해상도 기존
드롭다운 및 편집 보존, 추가 POST 없음, 다음 기존 tick의 선택값 사용.

원본 objective 변경 즉시 조회와 현재 명시 조회/다음 periodic tick의 차이는
선언된 command 정책 차이로 기록한다. 이 작은 인계는 그 정책을 변경하지 않는다.
전체 live/GPU/모델/성능/PR 수용을 별도로 유지한다.

사전 분석 MEDIUM 보완: 어댑터는 dead/prepared 및 실제 run/scenario/현재
runner routeSpec을 확인하고 stop/dispose/run 또는 동일ID 입력 교체 이후의
오래된 async 이벤트를 거부한다. 명부 ID만으로 입력 교체를 판단하지 않는다.
패널은 숨겨진 상태에서도 선택값만 보존하며 마운트나 편집기를 생성하지 않는다.
정상 readonly native 명부의 ready/external/error와 정의 정체성을 전후로 확인한다.
선택값 인계 거부나 observer 예외가 기존 성공한 시나리오 경로 계산의 step
판정을 실패로 바꾸지 않는다. optional 포트가 없을 때 기존 emit/onChange 순서를
유지하고 인계 오류는 표시용 초안 거부로만 처리한다.
