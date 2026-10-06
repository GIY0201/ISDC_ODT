# ADR 0038: 기존 runtime의 native 임무 입력 승인

기존 장비 명부 배치 API는 그대로 둔다. 별도 명시 조회/수락 경로에서 실제 runtime의 run/revision/명부/장애와 전체 위성 정의, 활성 지상국, 공통 UTC, 선택 GP/EOP/윤초, 군집 모듈 instance/sequence를 대조한다. 기존 native point/window 계산과 original source scheduler를 사용한다. runtime은 불변 입력 사본 하나만 보유하고 움직이는 시계·위치·optical history를 중복 저장하지 않는다.

선택적인 window header는 계산 전후 같은 승인 입력인지 검증한다. production guarded 계획·확정은 현재 수락 hash와 원래 분석 UTC를 요구한다. 취소는 물리 입력이 달라져도 기존 guarded 모듈의 승인 증거로 예약을 해제할 수 있다. 기존 legacy API는 호환용으로 유지한다.

해시는 native 입력 범위 증거다. source window/mesh/capabilities 전체를 서버가 다시 계산하여 증명하는 계약이나 실제 RF·장비 운용 승인은 아니다. 시간표는 source UTC 코드 원본을 보존하며 실제 장비 상태와 모의 계획을 혼동하지 않는다. 이후 full window/optical evidence와 계획 복원·원격 모듈·성능·다중 창 수락 검증을 완료해야 한다.
