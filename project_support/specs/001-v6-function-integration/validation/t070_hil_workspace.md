# W07 기존 MOCK-HIL 검증

2026-10-05 / FR-017, SC-015 / US9 / T067–T070. PR21 위 독립 Draft. 실제 장비 시험이나 전체 제품 완료가 아니다.

## 원본 보존과 연결
기존 communication/http/hil.py/schemas.py, digital_twin/runtime/state.py, simulation/mock_hil.py, model_library/devices.py diff0. 기존 장비 connect/disconnect/sync/loopback, preflight, preflight/closed_loop/fault_recovery 세 시퀀스, recording API 그대로 호출. API 브라우저 어댑터에 선택적 AbortSignal만 추가했다.

V6 em 작업 창에 장비 목록/상세/기존 6노드 구성도, 개별/연결장비 일괄 동작, 점검 근거/시퀀스 결과/기록 플래그, 기존 모의 통계와 명시적 합성 I/O 예시/수신 SIM 처리량 차트, 표시 로그를 연결했다. 구성도 선택은 클릭/키보드를 지원한다. 기존 drawSparkline을 재사용한다. W05 한 socket에 observer만 추가했고 서버 현재 상태는 runtime이 소유한다. 시퀀스 결과는 해당 run/시각의 불변 표시 사본이다.

명령 직렬화/부분 실패/중복 차단/취소/늦은 결과 방어, malformed응답/오류 보존/동기화 barrier, 장비·기록·run 변경 시 이전 점검 무효화와 창·native선택 복원을 구현했다. 명령 version/CAS 없는 원본 한계는 그대로 표시하고 명시적 새로고침으로 복구한다.

## 시험 증거
- Python 기존 의미 golden2 PASS0.73s. 전체 `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/hil_workspace/pytest_full_01`: **376 PASS135.64s**, 기존 Starlette 경고1.
- RED: API signal 미전달/신규 controller 부재, V6 panel 부재, 구성도 선택 attribute 부재를 각각 확인. 전체 `node --test project_support/tests/browser/*.test.mjs`: **159 PASS583.0478ms**. 원본 sync26.2/21.18/5.07, 0offset한계, sequence4/5단계, 기록OFF실패, 오류/부분batch/취소/상태사본/점검무효화/명령barrier/입력복원/단일socket+Viewer/XSS escaping.
- 실제 `http://127.0.0.1:8891/?validation=t070#em`, 1280×720 및1920×1080. KRS-HIL OFFLINE→sync비활성화, closed_loop failed(S1/S2), 모의연결/동기화/loopback, 연결장비 모두sync/loopback 후READY. 세시퀀스 completed(4/4/5단계), recording OFF→BLOCKED/시퀀스failed, ON→READY/completed 확인. 구성도 클릭선택 KRS-HIL, minimize/restore 후device/sequence 유지, 표시로그 비우기(서버사건삭제없음), disconnect→BLOCKED 확인. 새 console error0. 초기 navigation 도구timeout/reset 후 이미 열린 탭을 다시 바인딩하여 검증했다. UI의 실패는 점검 조건에 따른 정상 결과다.
- 테스트 중 일시정지 SIM1119.868s/sequence4869/runRUN-5336E3FD125D/scenarioLEO_STANDARD/배속1을 모든 HIL 조작 동안 보존. HIL 조작으로 GP 선택/UTC 명령0(조립 회귀), 실제 지구는 입력미선택/결과없음 상태를 유지. 장비 행동 이후 SIM 실행을 원래 running=true로 복원, recording=true/KRS연결false 원래 플래그를 복원했다. sync/loopback으로 달라진 모의 장비 수치는 실제 시험 상태로 남아 있으며 완전 초기값 복원이라고 주장하지 않는다. before_browser.json/after_browser_paused.json에 보존.
- 변경 후에도 서버 PID41536, `0.0.0.0:8891` LISTEN 유지. 서버 코드 변경 없음/재시작 없음. 실제 외부 기기 테스트 대체가 아니다.

ignored `data/workspace/validation/hil_workspace`에 RED/Node/Python로그, before/after서버사본 및 hil_1280.png/hil_1920.png 보관. 최종 readonly 원본비교/수용기준검토 추가결함0.

## 남은 경계
실제 HIL/실측/영구 기록이 아니다. recording플래그 및 합성 I/O는 명시적으로 구분한다. 원본 preflight는 offset0을 미확인으로 처리한다. 시퀀스는 현재 상태 판정이지 실제 장비 동작 수행이 아니다. session chart최대300/local operation log최대60은 durable replay가 아니다. W06 디스크 다운로드 완료 미확인/F001/F002/F004–6/T032/카탈로그·교차화면/다른PC·AerODT 재통합 유지. 자동병합 없음.
