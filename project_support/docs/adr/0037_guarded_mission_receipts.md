# ADR 0037: 군집 운용 승인 기록과 실행 제어

기존 source ICD-03와 greedy scheduler는 보존한다. 기존 MissionPlanningExchange가 승인한 계획과 결정의 사본을 status의 accepted_plans와 accepted_decisions에 추가한다. 동일 lock 안에서 조회하며 기존 source 상태 필드는 바꾸지 않는다. source 모듈 내부 계산과 legacy API는 그대로다. legacy 수정 시 해당 guarded 증거를 무효화한다.

UI는 저장된 committed 문자열이나 단순 입력 digest를 승인 증거로 삼지 않는다. 실행 전 module instance/sequence, 계획 버전, 전체 승인 작업 목록과 현재 계산 context를 대조한다. 확정은 승인 작업의 모든 필드와 원래 분석 UTC를 그대로 보낸다. 중단은 물리 context가 바뀌어도 서버가 보관한 승인 기록을 사용한다.

응답 유실은 승인 여부 미확인이다. 새 request_id로 같은 명령을 반복하지 않는다. 동일 body/header/id retry 또는 status의 정확한 승인 receipt로 확인한다. status에 증거가 없다는 사실만으로 미승인이라 주장하지 않는다. 신규 요청의 명시적409는 거절로 표시한다. 승인 후 context 변경은 승인 사실과 현재 입력 불일치를 함께 표시한다.

이 변경은 실행 제어 계약이다. 현재 native/배치 승인 proof 제공자와 실제 V6 조립은 남았다. 실행 환경의 승인 권위자가 없는 경우 기본 true verifier를 만들지 않는다. 창 재시작 후 로컬 계획만으로 재승인하지 않는다. 실제 장비 작업을 제어한다는 의미가 아니다.
