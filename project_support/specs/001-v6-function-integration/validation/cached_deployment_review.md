# 재접속 배치 재확인: 현재 근거와 미완료

2026-10-07 12:13 KST, N022/ADR0059/T177–T178. 아직 제품 구현 및 실제
버튼 검증이 완료되지 않았다. 전체 T075–T084 수용 게이트는 열려 있다.

## 실제 문제 확인

Aside542에서 일반 기존 노드 통신망 조회는 43개 노드/183개 링크를 표시했다.
543에서 명시적 미래 통과 조회는 수락 배치 미확인으로 거부했다. 통신 전송은
누르지 않았다. 이 결과는 기하 표시만의 근거이며 native 미래 구간이나 통신
수락의 성공 증거가 아니다.

547은 격리 화면의 공개 정의 전체를 비교했다. 초안40/배치40의 ID 순서와 전체
정의 직렬화 값이 동일했고 차이는0개였다. node-server-configuration은 비어
있고 숨겨져 있었다. 전체 정의 일치 자체를 수락 승인으로 사용하지 않았다.
독립 GET 비교에서 기존524의 저장 전체 receipt는 실제 서버 응답과 정확히
일치했다. 현재 격리 화면의 receipt는 기존 owner 검증 동작으로 따로 검증해야
하며, 공개 정의 값이나 서버 명부만으로 추정하지 않는다.

540은 기존 저장 ISS2020 입력을 적용하지 않고 공개 ISS25544를 선택해 별도
native IERS-A 경로가 표시되는 것을 기록했다. 저장ISS/local/session bytes가
보존됐다. Root는544 실제1440×900 pixels를 확인했지만 ISS 상세 재질/부속품이
충분히 판별되지 않아 전체 모델 수용 성공으로 기록하지 않는다.

근거 사본: data/workspace/validation/live_N022_precode_20261007_1213.
원본 완료 PoC RUN-904CE008D00B는12:13:38KST 실제 GET health에서 stopped,
SIM/speed5/elapsed884.681/SDC_POC_01/faults[]/recordingtrue였다.

## 설계 검토

독립 사전 검토 HIGH0/CRITICAL0. 기존 scenario_cached_deployment와
data_deployment 관련29개 시험 통과. 기존 restore는 GET 전후 전체 저장
receipt/배치 및 서버 기록을 확인하고 private restore 승인만 복구한다.

현재 workspace capability는 updated_at을 포함한 전체 draft/deployed 일치를
요구하지만 isDirty는 timestamp를 무시한다. 새 명시적 버튼과 진행 중 확인은
전체 canonical 일치를 사용해야 한다. 그 차이를 GET 중 변경했을 때도 거짓
확인 상태가 발행되지 않도록 실제 owner 회귀시험을 먼저 추가한다.

제품 구현, 독립 최종 검토, 전체 회귀, 실제 새로고침/명시적 버튼/후속 native
흐름 검증은 진행 중이다. 이 문서는 그 결과를 대체하지 않는다.

## 구현 체크포인트

기존 workspace_nodes에 저장 배치 재확인 버튼을 연결했다. 기존 store와
data_deployment 함수는 그대로 사용한다. 진행 중 요청에 한정된 workspace
restore 검증은 owner의 승인 소비 시점에 입력 및 마운트 수명을 다시 확인한다.
정상 시나리오의 restore 검증은 이 명시적 요청이 없으면 기존 경로를 유지한다.
버튼 표시 조건은 기존 contextPresentation을 사용하고 receipt 존재 여부만
store 알림마다 폐기하는 캐시로 읽어 매 프레임 전체240개 정의를 복사하지 않는다.

작성자 시험: missing button8 RED, 최초 연결 뒤 timestamp-only GET 중 변경과
재마운트2 RED(거짓 deploymentConfirmed=true) 재현 후 수정. 최종 신규12 PASS,
workspace_nodes/data_deployment와 묶은120 PASS/0 FAIL/10454.3843ms exit0.
실제 owner의 정상 GET-only 복구, 실행/revision/equipment 차이, 조회 전/중
timestamp 차이, 종료/재마운트, 중복 클릭, 가시 오류, 변경 후 원복의 영구
철회를 포함한다. 작성자는 수정을 멈췄고 독립 최종 검토 중이다.

전체 Python 시험 handle46848 진행 중. 전체 JavaScript 및 실제 버튼 검증은
아직 완료되지 않았다. whole goal 또는 T178 완료를 주장하지 않는다.

독립 최종 검토 CLEAN: 신규/배치/어댑터34 PASS1043.6703ms, 기존 scenario_resume
53 PASS1221.3164ms. 제품 편집을 멈춘 뒤 전체 Node1943 PASS/0 FAIL/0 SKIP/
27616.8538ms, handle59088 exit0. 로그 full_N022_node.log. Python46848과 실제
버튼/후속 native 수용 검증은 진행 중이며 T178은 열린 상태다.

## 전체 회귀 및 실제 명시적 복구

전체 Python967 PASS/1 SKIP/8 warnings/314.65s, handle46848 exit0. 경고는
Starlette TestClient의 httpx 사용 deprecated 안내와 ERFA 경계 연도 안내다.
로그 full_N022_python.log. 전체 JS1943 PASS 결과와 같은 안정된 제품 코드다.

Actual554: 기존 격리 화면을 한 번 새로고침한 뒤 새 버튼이 활성화되고 배치는
미확인 상태였다. 이전 전체 정의/local/session/저장ISS는 byte-exact였다.
Actual555: 버튼을 정확히 한 번 눌렀고 summary가 서버 수락 확인으로 바뀌었다.
전체 공개 초안/배치 정의 및 session/저장ISS는 그대로였다. local storage의
spacetwin-nodes-deployed-v1만 바뀌었으며 root가 구조 비교해 local record의
revision9→10만 변경됐음을 확인했다. 서버 receipt 또는 물리 입력의 변경이
아니며 기존 store 정상 확인 기록 갱신이다. 전체 local byte-exact로 표현하지 않는다.

555의 request callback 및 시각-filter resource 목록은 비어 있어 실제 브라우저
GET method 직접 계측 성공이라고 주장하지 않는다. GET-only는 변경하지 않은
기존 owner 코드, 실제 owner 회귀시험, 실제 복구 UI 결과의 조합 근거다.
후속 공개 resource 관측 및 native 미래 통과/통신 흐름은 별도 확인 중이다.
Root 실제 GET health12:22:07KST: 기존 RUN-904CE008D00B/SIM/stopped/speed5/
elapsed884.681/SDC_POC_01/faults[]/recordingtrue 보존. T178/whole gates OPEN.
