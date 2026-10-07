# 저장 배치 재확인 UI 계약

ADR0059와 T177–T178의 기존 node workspace 동작이다. 별도 API나 상태 소유자를
만들지 않는다. 사용자가 명시적으로 요청한 경우 기존 store.snapshot()의 receipt와
전체 deployed 사본을 기존 deployment.reacceptCachedDeployment에 전달한다.

초안과 배치 정의는 updated_at을 포함해 전체 canonical 값이 같아야 한다.
저장 receipt 부재, 미로드, 오류, 작업 중, 폐기, 서버 동기화 필요 또는 전체 정의
차이는 확인 불가다. 개수 또는 ID만 같다는 이유로 확인을 허용하지 않는다.
기존 GET 전후 검증은 cache/receipt/서버 전체 기록을 다시 확인하며 기존 private
restore authorization만 발행한다. 새 receipt 생성, POST/PUT, 재배치, 시나리오
실행, SIM/UTC 변경, 미래 통과 또는 통신 전송 권한의 직접 발행은 하지 않는다.

실패는 미확인 상태와 오류로 표시한다. 진행 중 중복 클릭은 같은 요청으로
처리하며 폐기/재마운트 이후 이전 UI에 결과를 쓰지 않는다. 전체 배치 확인은
실제 RF 수신이나 임무 승인 증거가 아니다.

검증: actual workspace 재접속 정상 GET 복구, 전체 서버 기록 불일치,
timestamp-only 초안 차이, GET 중 입력 변경, 중복 클릭, 폐기/재마운트.
독립 검토 후 전체 회귀와 실제 8891 화면을 별도로 확인한다.
