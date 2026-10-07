# ADR0059 재접속 후 저장 배치의 명시적 재확인

실제 화면은 서버 revision6/40개 명부 조회가 성공해도 배치 수락 미확인으로 남는다.
현재 private 배치 capability는 재접속으로 소멸하는 것이 맞으며, 개수/명부만으로
복원하면 안 된다. 기존 data_deployment.reacceptCachedDeployment는 actualGET의
전체 수락 기록과 저장 receipt/전체 deployed 정의를 대조하고 현재 draft의
isDirty()가 false일 때만 private restore authorization을 사용한다. 이 함수의
isDirty()는 timestamp를 무시하므로 아래의 workspace 전체 일치 가드가 필요하다.
현재 호출은 시나리오 재개/완료 검증에
한정되어 일반 위성 작업 화면에는 독립 재확인 동작이 없다.

기존 workspace_nodes에 명시적인 저장 배치 재확인 버튼/동작만 연결한다.
저장 snapshot.receipt/deployed를 복사해 기존 reacceptCachedDeployment에 전달한다.
dirty/error/unloaded/dead/진행중/입력변경을 거부하고 늦은 UI 갱신을 차단한다.
추가 POST/PUT/배치 재적용/시나리오 제어/receipt 생성/검증 완화는 금지한다.
서버 전체 기록이 다르면 오류와 미확인을 유지하며 수락으로 승격하지 않는다.
일치할 때만 기존 owner의 restore 경로가 확인 상태를 갱신한다. 원본 프로세스,
SIM/held missions/전체 서버 배치와 다른 입력을 보존한다.

명시 버튼은 실제 저장 기록이 있고 현재 draft가 동일한 경우에만 제공한다.
동일성은 updated_at을 포함한 전체 canonical 정의 비교다. isDirty()가
timestamp를 무시하므로 그 값만으로 버튼을 활성화하지 않는다. 이 기준은
기존 workspace_context capability와 동일하며 기존 restore 함수를 완화하지 않는다.
이 확인은 노드 배치 계약만의 확인이며 실제 통신/임무 승인/현재 native 계산/
전체 완료 승인이 아니다. 기존 미래 접촉/통신 입력 가드는 변경하지 않는다.

사전 독립 분석→의미 있는 actualworkspace RED→기존 restore 연결→독립 검토/
변경 JS 전체 검증→실제 isolated 화면 재확인/readonly native 흐름 검증을 요구한다.
기존 owner 검증과 시나리오 호출을 보존한다. 전체75–84/모델/두해상도/GPU/PR은
별도 수용 게이트다.
