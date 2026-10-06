# ISDC_ODT

독립 실행하는 ISDC 궤도 디지털 트윈 개발 저장소입니다. 선배의 ISDC-ODT 기능을 채택 V6 UI에 단계적으로 연결하며, 향후 AeroDT 연계를 위해 계층과 파일 생성 규칙을 유지합니다.



현재 JavaScript UI, Python FastAPI와 Rust SGP4 계산 기반을 사용합니다. 기존 프로토타입 콘솔은 `/legacy`에서 사용할 수 있습니다. V6 위성 작업창에서 저장 궤도 입력을 선택하고 계산하거나 재생하면 공용 Cesium 지구에 표시 UTC의 ITRF 위치가 나타납니다. 재생·정지, 0.1/1/10/60배 속도, 지정 UTC 적용과 epoch 복귀를 지원합니다. 재생 데이터는 1초 간격으로 미리 받으며 자료 밖에서는 위치를 표시하지 않습니다. 지구 영상은 보존한 NASA Blue Marble이며 Cesium 1.143 라이브러리는 공식 CDN에서 읽습니다. 다른 운용 카드는 아직 예시입니다. 실측, 실제 통신, HIL로 해석하지 않습니다.

## 실행

2026-10-07 현재 V6에 원본 노드 편집·배치, 통신망·경로, 다섯 임무 계획, 데이터·보안 모의 모듈, 설정과 PoC 재생기를 연결했습니다. 카탈로그 계산과 원본 노드의 시간·좌표계·상태 소유권을 구분합니다. 최신 회귀 검증은 Python 960개 및 브라우저 JavaScript 1,081개 통과이며, 실제 화면의 전체 복구·파일 저장·GPU·성능·다중창 수용 검증은 진행 중입니다. 요구별 남은 범위는 [현재 이식 감사](project_support/specs/001-v6-function-integration/validation/t075_t083_current_requirement_audit.md)와 [실제 실행 기록](project_support/specs/001-v6-function-integration/validation/t081_live_continuation_20261007.md)에 기록합니다. 선배 원본에도 없는 Terra 텍스처 두 개와 실제 수신 장비 조건은 미확인 상태로 보존합니다.

```powershell
python -m venv project_support/.venv
project_support/.venv/Scripts/python -m pip install -r requirements.txt
project_support/.venv/Scripts/python -m uvicorn user_application.web.application:create_app --factory --host 0.0.0.0 --port 8891
```

저장 입력과 Rust 계산 profile 준비 및 검증 절차는 `project_support/specs/001-v6-function-integration/quickstart.md`를 참고합니다. 실행 데이터, 환경 및 빌드 결과는 Git에 포함하지 않습니다.

## 작업 기록과 검증

`project_support/specs/001-v6-function-integration/workflow-progress.md`가 전체 요구, 확정 사항, 단계별 결과와 미완료 사항을 추적합니다. 지상국·통신 창에서 가상 지점과 타원체 높이·최소 고도각·조회 UTC를 설정하고 모든 기하학적 구간과 접점·잘림·없음·오류를 확인할 수 있습니다. 별도 창의 입력 보존·편집 충돌 안내와 서버 선택 동기화도 지원합니다. 첫 묶음31개 작업을 수행했고 최종 Python224/Node77/native1 시험 및 로컬 제품wheel 격리 설치를 통과했습니다. PR 리뷰와 병합은 별도입니다.

**프레임 성능 수용 기준은 아직 미달입니다.** T032에서 최종 하루 결과 p95를 두해상도543.1/547.3ms로 개선했고 UTC 결과32.0/32.1ms도 통과했습니다. 실제 페이지 presentation p95는18.578/18.552ms로16.7ms 목표를 넘습니다. 관측 Event Timing p95는48ms이며16ms 미만 표본 검열/8ms 반올림을 명시합니다. 최종 Python242/Node82/native1 및 실제TCP 회귀는 통과했지만 SC-006/T032는 부분 완료입니다. 현재 근거는 feature의 `validation/t032_performance.md`, 이전 실패는 `validation/t028_performance.md`, 설치 범위는 `validation/t029_install.md`입니다. 실제 통신 조건 확인·적용(F001)과 전체 프로토타입 기능 연결(F002)은 계속 추적하며 첫 묶음을 전체 제품 완료로 해석하지 않습니다.

```powershell
project_support/.venv/Scripts/python -m pytest -q
node --test project_support/tests/browser/*.test.mjs
```

선배 프로그램의 기존 소개는 `project_support/docs/prototype_readme.md`에 보존했습니다.

V6 지상국·통신 창의 RF 계산기는 선배 프로토타입의 기존 RF-Friis-v1 API를 사용합니다. 11개 조건을 직접 입력하면 8개 결과와 가정을 표시합니다. 이번 연결은 Python304/Node95 및 실제 두해상도 UI 검증을 통과했습니다. 근거는 `project_support/specs/001-v6-function-integration/validation/t036_rf_workspace.md`이며 실제 통신 조건 조사·적용과 프레임 기준은 계속 남습니다.

ISS APRS 수신의 공식 주파수 부분 조건을 불러오고 적용할 수 있습니다. 출처와 공지 시점/확인 UTC를 표시하며 장비가 필요한 조건은 사용자 가정 또는 미확인입니다. 실제 수신 검증은 남아 있습니다. 근거: `project_support/specs/001-v6-function-integration/validation/t040_iss_receive_profile.md` (Python313/Node103 및 실제 두해상도 UI).

V6 지상국·통신 창에 노드 통신망의 명시적 전송, 모듈 상태 조회, 모의 경로와 DTN 결과 표시를 연결했습니다. 선배의 ICD-02 계산과 클라이언트를 재사용하며 검증된 현재 입력만 전송합니다. JavaScript758/Python684 시험은 통과했지만 실제 브라우저의 버튼 실행과 native 통신망 결과 수용 검증은 아직 미완료입니다. 근거: `project_support/specs/001-v6-function-integration/validation/t077_fabric_workspace.md`.
