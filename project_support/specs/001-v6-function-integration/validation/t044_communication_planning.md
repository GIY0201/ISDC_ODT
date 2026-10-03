# T044 선배 통신 경로·접촉 계획 연결 검증

2026-10-04. FR011/SC009, R002/R003/R004/R007. 사용자 선택에 따라 기존 시나리오 경로와 접촉 계획을 V6 지상국 창에 연결했다. Python 계산/API/schema는 변경하지 않았다.

## 자동 검증
- T041 JS 신규 모듈 미존재 RED, T043 실제 조립 버튼 미존재 RED 이후 구현. 기존 API 회귀 11 PASS.
- 전체 Python **325 PASS / 113.65초**, 기존 Starlette 경고 1. `project_support/.venv/Scripts/python.exe -m pytest -q --tb=short --basetemp=data/workspace/validation/planning/full_t044_venv -o cache_dir=data/workspace/validation/planning/cache`.
- 전체 Node **114 PASS / 362.4772ms**. `node --test project_support/tests/browser/*.test.mjs`.
- 기본 PATH의 Anaconda Python으로 처음 실행했을 때 프로젝트 의존성이 없어 collection 17 errors. 제품 결함으로 분류하지 않으며 프로젝트 전용 venv로 재실행했다. 최초 로그 pytest_full.log 보존, 최종 pytest_full_venv.log.
- 경로 목적 3종의 독립 수치, 활성 SIM 장애 제외, runtime snapshot 불변, hours1/12/72 정상과0/73/문자/소수422. UI echo/graph/link/UTC/count/provenance 검증, 독립 세대/abort/취소/reload/종료/늦은 응답 폐기, 0-hop/빈 결과/네트워크 오류/HTML escaping/전체30행 보존. 실제 assembly 두해상도 복원·역할전환·동일값 원격 편집·RF/GP/Viewer 불변.
- 원본 checkout commit `1a1e00297a0301637455b0ef2cf48b2e74576b07` 대조: calculate_link_budget/_link_cost/calculate_route/contact_plan 및 기존 HTTP3 함수 + LinkBudgetRequest/RouteRequest **9개 AST 동일**. 읽기 전용 리뷰 제품 결함0. 원본 checkout 깨끗함, 글로벌 설정 수정 없음.
- git diff --check PASS. 기존 호출은 호환되며 browser transport에 optional signal만 추가했다.

## 실제 브라우저
8891 기존 서버를 사용했다. IAB1280x720에서 bootstrap10nodes/10links → SAT-01→GS-02 balanced: SAT-01→SAT-04→GS-02, L03/L06,2hop,cost66.64. 12h 접촉20행 전체 표시. 최소화/복원 결과 동일, hours0은 오류와 이전 접촉결과 폐기.
1920x1080에서1h 접촉20행 정상, latency 같은 경로 cost63.6, 확장 창 정상. RF11개와GP7개 입력 전후 동일, Cesium canvas1, console error0. viewport override reset. UI 근거 ui_proof.json/t044_1280.png/t044_1920.png는 ignored data/workspace/validation/planning에 보존. 결과 조작 또는 앱 내부 상태 주입 없이 실제 UI를 통해 조회했다. DOM adapter의 원격창 시험은 실제 OS 별도창 시험으로 주장하지 않는다.

## 의미와 남은 범위
노드 선택지는 기존 bootstrap에서 조회하며 고정 복제하지 않는다. 경로는 예시 품질·SIM 장애·목적함수로 계산한 시나리오 결과다. contact_plan은 서버 현재 시각으로 합성한 scenario-contact-plan-v1 일정이며 시간 입력이 종료 시각을 엄밀히 자르지 않는 원본 동작을 유지하고 설명했다. GP 기하 가시 구간과 독립이다. 실제 ISS 통신·예약·수신·HIL로 표현하지 않는다.
T041~44 묶음 완료. F001 실제 조건 전체, F002, F004~6 및 사용자 보류T032는 미완료로 보존한다. 도플러는 이후 선택 범위. 8891 고정 포트 변경도 PR15 위의 이번 stacked Draft PR에 포함한다. 자동병합 없음.
