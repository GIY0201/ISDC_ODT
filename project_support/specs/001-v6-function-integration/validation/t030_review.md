# T030 첫 구현 묶음 최종 검토

2026-10-03. 원래 목표는 확정 V6 UI에 선배 프로그램 기능을 단계별로 연결하는 독립 ISDC ODT다. 이번 첫 묶음의 궤도/지점/가시구간/작업창 구현과 설치·검증 기록을 검토했으며 전체 제품 완료가 아니다. **SC-006 FAIL로 fully verified 완료를 선언하지 않는다.** 최초31개 작업의 수행 기록과 남은 수용 기준 T032를 분리한다. PR 리뷰/병합은 별도다.

## 최종 실행 증거

| 검증 | 결과 | 경계 |
|---|---|---|
|제품 Python 전체 `pytest -q --tb=short -o cache_dir=data/workspace/validation/workspace/pytest_cache`|224 PASS,107.80초,기존Starlette경고1|skip/xfail로 실패 은폐 없음, 최종 코드에서 재실행|
|`node --test project_support/tests/browser/*.test.mjs`|77 PASS,256.24ms|DOM/Cesium/HTTP adapter 회귀; 실제GPU 제출 시험 아님|
|제품 `cargo test --release --locked --offline`|integration1 PASS,unit/doc0|공식33입력668상태 assertion, 제품Rust 변경 없음|
|`validate_orbit_http.py`|PASS|실제TCP inputs2/samples3/가시구간1/409/선택UTC보존/health, 자신의서버만종료|
|제품 wheel 새venv 오프라인설치/`python -I`|2 PASS, 전체pytest에도 포함|로컬cp314-win_amd64, 프로젝트밖 실제native 호출|
|실제 IAB 두해상도|UTC각100회/하루각20회/30초각3회완료|1920 중단trial은 보충하고 원자료 유지, t028_performance 참조|

수치 기준은 기존 공개fixture/고정EOP/윤초, 실제 전파 및 독립변환/denseoracle 회귀로 확인한다. batch 수정 전후4구간 경계·peak 차이0초/0도. 같은 native 전후 비교 자체를 독립 oracle이나 실제 ISS 오차 증거로 주장하지 않는다. 실제 브라우저의 오류로그0/canvas1과 역순응답·409·큐포화 강제시험 증거를 분리한다.

## 요구 및 수용 기준 연결

| 기준 | 결과 / 근거 |
|---|---|
|FR-001,FR-002 / R005,R007|저장TLE/OMM·출처·epoch·hash·UTC/행오류; T003~T016 및 inputs/time/native/API 시험 PASS|
|FR-003 / R005,R009|재생·정지·배율·복귀·좌표/UTC 일치, 보간10m/0.01도; T017/T018 및 실제브라우저 PASS|
|FR-004 / R005|WGS84높이/임계값/모든기하구간·접점·잘림·없음, 실제하루4구간; T019~T023/새batch15시험 PASS|
|FR-005 / R006,R007|기하/가상/GP모델/실제통신미확인 표시 PASS; 실제통신조건 적용은 F001 미완료|
|FR-006 / R002,R009|창/입력유지/처리·오류·stale/취소/다중창충돌 T024~T027,T031 PASS; 성능SC006 미달|
|FR-007 / R001|AeroDT 설치 없이 실행/계층·명명·단일runtime/격리native 설치 PASS; 실제AeroDT 재통합은 미검증|
|FR-008 / R003,R004,R010|전체 W00~W09 계획, 기존합의·초안·legacy·V6원본 보존, 단계별검증·PR 유지; F001/F002 닫지 않음|
|SC-001|저장ISS/가상제주/UTC/위치/고도각/하루구간 흐름 PASS|
|SC-002|위치10m/고도각0.01도/경계1초의 기존fixture·보간·dense시험 PASS, 실제ISS 오차F005와 구분|
|SC-003|손상입력/잘못된UTC/없음/잘림 및 부분실패 회귀 PASS|
|SC-004|두해상도 최소화·복원/창 clamp/위성·지점·시각 유지 및 별도창 PASS|
|SC-005|GP예측·가상·기하·실제통신미확인 표시 PASS|
|SC-006 / R009|**FAIL**: UTC p95 44.0/43.6ms PASS, 하루p95 2266.0/2197.8ms FAIL. RAF/두RAF 피드백도미달, 실제GPU60Hz 경로 미입증. T032 필요|

R008의 JS/Cesium/Python/FastAPI/Rust 합의와 고정버전은 유지했다. R010 보호파일/기존API exact회귀/수치계약을 유지했고 성능을 위해 탐색간격/정확도/목표를 낮추지 않았다. 새공개wire 없음, native내부 경계와wheel 생성 변경은 ADR0005에 기록했다.

## 열린 필수 후속과 판단

- F001: 서비스/장비 선정, 공식 출처의 주파수·대역폭·안테나/링크·도플러·손실/여유/가시 제약 조사와 실제 적용이 필수다. 제주/10도와 기하 구간을 실제 통신 성공으로 바꾸지 않는다.
- F002: 선배 통신/임무/분석·내보내기/MOCK-HIL/SIM제어 및 V6 전체업무 연결의 순서·범위를 함께 검토해야 한다. 첫 묶음31개는 전체제품 완료율 분모가 아니다.
- F003: 현대화·성능 목표는 합의됐으나 R009 성능 달성은 T032 미완료다.
- F004: 실장비HIL/실측/영구기록·재생은 범위와 증거를 별도 정의한다.
- F005: 실제ISS 위치 오차는 관측 참값이 필요하며 이번 수치구현 검증으로 닫지 않는다.
- F006: 로컬wheel/DLL 출처·LICENSE 확인은 완료, 다른PC/ABI/OS/VC runtime 배포 및 자체crate 대외배포 license 선택은 미검증이다. 실제AeroDT host 연결도 후속이다.

자동 개선3회 후에도 SC006 미달이므로 SpecKit verify는 running/미달 상태다. convergence는 남은작업을 기록하며 목표나 명세를 완화하지 않는다. 원문 성능자료·화면·profile/trace·wheel receipt는 ignored workspace에 있고 도구·검증요약은 Git에서 리뷰한다. 다음은 T032 성능 보완이며 통신·전체기능 후속을 폐기하지 않는다.
