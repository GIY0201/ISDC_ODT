# T078 임무 요청 조립 검증

선배의 OR-01 임무 요청에 기존 Rust 계산 묶음과 기존 광링크 담당 객체의 검증된 결과를 연결했다. source missionTypes, constraints와 ground records를 주입해 능력, 전력, 접촉률, 관측 대상, busy, 장애, mesh와 제외 대상을 조립한다. 단독 전파기나 시계, 광링크 이력, 지속 계산 캐시는 추가하지 않는다.

## 검증

- 구현 전 builder와 browser API 메서드 부재로 실패하는 시험 확인.
- JavaScript 전체 **816 통과 / 0 실패 / 0 제외**, 4778.6178ms.
- Python 전체 **810 통과 / 8 기존 ERFA 경고**, 202.07s. 기존 native 0.3.0 wheel과 프로젝트 내부 시험 임시 경로 사용.
- 실제 설치된 Rust와 실제 FastAPI factory에서 두 개의 완전한 source 위성을 2시간 조회: 접촉 1개, 식 3개. 궤도 선택 상태 불변.
- native sample buffer와 실제 기존 optical resolver/timeline을 거쳐 조회 결과의 전체 정의 해시와 임무 요청을 연결. native fixture를 재생성해 정확히 일치 확인.
- 전체 입력, 임무, 설정, 모듈, UTC의 계산 중 변경과 취소·폐기·잘못된 계산 응답을 거절. 장애 지상국/광링크 필터, 총 locked 수와 기존 busy 규칙, 관측·pickup 조건 확인.

로그: data/workspace/validation/t078_request_node_final.log, t078_request_python.log. 재현 자료: project_support/tests/fixtures/native_mission_request.json. 재생성: PYTHONPATH=. 설정 후 project_support/.venv/Scripts/python project_support/tooling/capture_native_mission_request.py <입력 자료> <출력 자료>.

## 남은 수용 조건

현재 입력을 검증하는 콜백은 필수 주입이며 실제 서버 승인 배치와 모듈 상태를 확인하는 조립은 남았다. DataDeploymentCommand의 승인 목록은 id/name/mode/equipment만 갖고 있어 전체 궤도·bus·power 정의와 연결해야 한다. 저장된 committed 표시를 승인 증거로 쓰면 안 된다. 재계획, 정확한 승인 task 확정·중단, V6 일정표·버튼 연결, 실제8891 실행 및 성능·다중 창 검증이 남는다. 계속 재생 중인 UTC의 요청 무효화도 실제 UI에서 검증해야 한다.

이 결과는 오프라인 native/ASGI 조립 증거다. 현재8891 서버에는 해당 계획 UI를 연결하지 않았으며 활성 SIM/GP를 변경하지 않았다. T078/N010/N011 및 T075–T084 전체 목표는 미완료다. 실제 통신/HIL 검증으로 해석하지 않는다.
