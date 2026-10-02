# ISDC_ODT

독립 실행하는 ISDC 궤도 디지털 트윈 개발 저장소입니다. 선배의 ISDC-ODT 기능을 채택 V6 UI에 단계적으로 연결하며, 향후 AeroDT 연계를 위해 계층과 파일 생성 규칙을 유지합니다.



현재 JavaScript UI, Python FastAPI와 Rust SGP4 계산 기반을 사용합니다. 기존 프로토타입 콘솔은 `/legacy`에서 사용할 수 있습니다. V6 위성 작업창에서 저장 궤도 입력을 선택하고 계산하거나 재생하면 공용 Cesium 지구에 표시 UTC의 ITRF 위치가 나타납니다. 재생·정지, 0.1/1/10/60배 속도, 지정 UTC 적용과 epoch 복귀를 지원합니다. 재생 데이터는 1초 간격으로 미리 받으며 자료 밖에서는 위치를 표시하지 않습니다. 지구 영상은 보존한 NASA Blue Marble이며 Cesium 1.143 라이브러리는 공식 CDN에서 읽습니다. 다른 운용 카드는 아직 예시입니다. 실측, 실제 통신, HIL로 해석하지 않습니다.

## 실행

```powershell
python -m venv project_support/.venv
project_support/.venv/Scripts/python -m pip install -r requirements.txt
project_support/.venv/Scripts/python -m uvicorn user_application.web.application:create_app --factory --host 127.0.0.1 --port 8765
```

저장 입력과 Rust 계산 profile 준비 및 검증 절차는 `project_support/specs/001-v6-function-integration/quickstart.md`를 참고합니다. 실행 데이터, 환경 및 빌드 결과는 Git에 포함하지 않습니다.

## 작업 기록과 검증

`project_support/specs/001-v6-function-integration/workflow-progress.md`가 전체 요구, 확정 사항, 단계별 결과와 미완료 사항을 추적합니다. 현재 T001~T023 구현·검증 완료이며 PR 리뷰와 병합은 별도입니다. 지상국·통신 창에서 가상 지점과 타원체 높이·최소 고도각·조회 UTC를 설정하고 모든 기하학적 구간과 접점·잘림·없음·오류를 확인할 수 있습니다. 다음 단계는 작업창 시험(T024)입니다. 하루 조회 성능 목표는 아직 통과하지 않았습니다. 실제 통신 조건 확인(F001)과 전체 프로토타입 기능 연결(F002)은 계속 추적합니다.

```powershell
project_support/.venv/Scripts/python -m pytest -q
node --test project_support/tests/browser/orbit_api.test.mjs
```

선배 프로그램의 기존 소개는 `project_support/docs/prototype_readme.md`에 보존했습니다.
