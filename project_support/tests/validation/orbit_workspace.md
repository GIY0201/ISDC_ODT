# 실제 V6 성능 및 작업공간 검증

합의된 기준은 `project_support/specs/001-v6-function-integration/spec.md` SC-006이다. 계측 실행 완료와 목표 통과를 구분한다. 실제 결과는 같은 feature의 `validation/t028_performance.md`, 설치는 `validation/t029_install.md`, 요구 검토는 `validation/t030_review.md`를 따른다.

## 실행 절차

저장 자료를 준비하고 제품 venv에서 `uvicorn user_application.web.application:create_stored_orbit_app --factory --host 127.0.0.1 --port <전용 포트>`를 실행한다. 공유 서버를 재시작하지 않는다. `/?validation=t032#satellite` 또는 기존t028을 열면 계측 패널이 나타난다. 일반 URL에서는 계측 모듈을 로드하지 않는다.

1. 1280×720 및 1920×1080 각각 초기 로딩과 계산을 완료한다. 입력/EOP/윤초 해시, 브라우저/OS/GPU/전원/DPR/해상도/전경·포커스 상태를 기록한다.
2. 해상도별 30초 프레임 시험을 3회 완료한다. UTC 변경/재생/창·지구 조작/조회가 포함되도록 한다. 진행 중 시작 버튼은 비활성화되며 완료 이벤트를 확인한다. 종료로 중단된 trial도 원자료에 남긴다.
3. 서로 다른 UTC 이동 100회와 서로 다른 시작 시각의 정확한 24시간 조회 20회를 실행한다. 같은 결과를 반복하거나 캐시로 대체하지 않는다. 완료된 표시가 나타난 후 다음 입력으로 이동한다.
4. 결과 기록 버튼의 JSON을 `data/workspace/validation/performance`에 저장한다. 화면, trace와 실패 표본을 보존한다. 임시 viewport를 해제한다.
5. `node project_support/tooling/measure_orbit_ui.mjs <raw.json> [summary.json] [trace.json]`으로 nearest-rank p95/p99/max를 재현한다. 빈 표본은 PASS가 아니다. User Timing trial start/end를 포함한 완전한 Chrome ReturnAsStream trace를 보존하고 동일 renderer의 presentation 이벤트를 완료30초 구간에서 분석한다. GPU 이벤트와 실제 모니터 인증을 구분한다. Event Timing의 interactionId별 최대 duration과16ms threshold/8ms 반올림을 함께 보고한다.

RAF 간격은 전경 스케줄링 지표이며 실제 GPU 렌더·프레임 제출을 증명하지 않는다. 입력 피드백은 click 후 두 RAF까지의 보수적 대리지표이며 Event Timing이 아니다. 키보드/드래그 동작 확인과 click 지연 표본을 혼동하지 않는다. OS 보고 주사율만으로 60Hz 실제 표시 경로를 확정하지 않는다. UI 완료 지연은 요청부터 현재 맥락에 맞는 결과 DOM/지구 표시까지다. backend-only 계산 시간과 분리한다.

역순 응답/409/큐 포화/취소/렌더 오류는 `orbit_requests.test.mjs`, `test_orbit_concurrency.py` 및 작업창 조립 시험으로 강제 재현한다. 정상 브라우저 반복에서 오류가 없었다는 사실을 고장 주입 증거로 대체하지 않는다. 문서당 Viewer 1개, 처리 중 조작 가능, 상태 소유권과 가상/실제통신 미확인 표시는 유지한다.

## 회귀 및 계산 재현

```powershell
project_support/.venv/Scripts/python -m pytest -q --tb=short -o cache_dir=data/workspace/validation/workspace/pytest_cache
node --test project_support/tests/browser/*.test.mjs
project_support/.venv/Scripts/python project_support/tooling/validate_orbit_http.py
project_support/.venv/Scripts/python project_support/tooling/measure_orbit_calculation.py --help
```

네이티브 Cargo 시험은 제품 `digital_twin/simulation/orbit_propagation/Cargo.toml`과 고정 toolchain을 사용한다. 원본 fixture/기준 계산 오차와 1초 dense 탐색, 0.01초 경계 보정 및 극값 정밀도를 성능 때문에 낮추지 않는다. 설치 시험은 제품 wheel을 새 venv에 오프라인 설치하고 프로젝트 밖 `python -I`에서 실제 native 호출을 수행한다.
