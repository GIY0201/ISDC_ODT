# T058 임무 관리 V6 연결 검증
2026-10-04. W04/US6 FR-014/SC-012, R003/R004/R007/R010, T055~T058.

## 변경과 재사용
기존 bootstrap/missionAction/missionTask/validateMission/replanMission을 V6 임무 창에서 호출한다. MissionRuntime, HTTP missions, schemas, browser api는 PR18 기준과 diff 0으로 보존했다. 새 임무 생성 기능은 원본에 없어 추가하지 않았다. 서버 임무 ID와 SIM 상태를 표시하며 예시 M-204와 동일시하지 않는다.
작업 생성·수정·삭제, 상태 변경, 현재 충돌, 재계획 변경 제안 및 최신 계획 재계산·적용을 연결했다. 직렬 요청과 중복 제출 방지, 응답 임무 ID 검사, 파괴 후 늦은 결과 무시, 초안 사본·복원, scoped remote draft로 다른 임무/작업 입력 섞임 방지를 검증했다. 입력 중 native node를 보존하여 소수 키 입력이 유지된다.

## 실제 시험
- UI 구현 전 Node MODULE_NOT_FOUND 실패: data/workspace/validation/mission_workspace/node_red.log.
- V6 조립 전 두해상도 mission panel 부재 실패: assembly_red.log.
- 기존 Python API 회귀 2개 통과. 최종 전체 Python: 371 passed, 1 existing warning, 125.76s. 명령: project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/mission_workspace/pytest_tmp_02. pytest_full02.log.
- 최초 기본 pytest 실행: 223 passed / 148 setup errors / 126.24s. 원인은 기본 Temp pytest-of-gwakinyong 디렉터리 WinError5 접근 권한. 제품 코드나 시험 기준을 완화하지 않고 프로젝트 내부 새 basetemp로 재실행해 모두 통과. pytest_full01.log 보존.
- 최종 Node 전체: 134 passed / 0 failed, 457.4237ms. node --test project_support/tests/browser/*.test.mjs, node_full04.log.
- 문서 분석: FR-014/SC-012→T055~58 coverage100%, 추가 미연결/모호/충돌/constitution 위반0. 기존 체크리스트8/8은 문서 품질이며 제품 시험과 구분.
- git diff --check 통과, 기존 계층/정적 모듈 경로/API baseline 검사는 전체 pytest에 포함.

## 실제 8891 화면
1280x720과1920x1080. 기존 ODIN 임무 선택, 작업 A/B 생성→겹침 충돌1건→미리보기 T-02 시작5→11→적용 충돌0건, 수정·삭제, pause/start/abort/재시작 거절/complete, duration0 거절을 확인했다.
최종 코드에서 0.75 키 입력과1.25 기간 저장, 창 최소화/복원, 업무 전환 초안 보존과 서버 새로고침을 확인했다. 지상·RF·조회 입력18개 동일/canvas1/최종 예상치 못한 console error0. 실제 UI 증거: ignored ui_proof.json, mission_1280.png, mission_1920.png.
다른 임무/작업의 원격 초안 거부와 같은 scope 초안 반영은 실제 소스의 Node assembly 시험 증거다. 실제 OS 별도창 테스트를 이번 묶음에서 수행했다고 주장하지 않는다.

## 원본 한계와 남은 범위
계획 축0~100은 원본에 물리 시간 단위가 없다. 미리보기는 현재 validation과diff를 반환하고 이벤트를 남기며, 적용은 최신 계획을 재계산한다. 원자적 preview 적용이나 CAS는 기존 API에 없다. 규칙 재계획은 lane 겹침 조정이며 선행 의존/자원 충돌을 모두 해소하지 않는다. ODIN-01의 dependency 충돌1건/변경0개가 그대로 표시됨을 확인했다.
이번 UI 서버 상태 갱신은 명시적 새로고침이며 WS/SIM 제어는 다음 W05. 실제 명령/AI/실측/실제 HIL로 주장하지 않는다. F001 실제 통신, T032 보류, 전체 F002 및 W05~W09 후속 유지.
PR18 위 codex/mission-workspace Draft PR로 리뷰, 자동 병합 없음.
