# W06 기존 KPI/내보내기 검증

2026-10-04 / FR-016, SC-014 / T063–T066. 기존 W05 PR20 위 독립 Draft 변경. 전체 제품 완료나 실제 통신 판정이 아니다.

## 원본과 변경
기존 verification/kpis.py, data/exports.py, communication/http/reports.py, visualization/charts.js는 diff 0. 기존 서버 공식/요구 추적/CSV BOM 및 열/JSON 문맥과 파일명을 재사용한다. 브라우저에서 KPI를 재계산하지 않는다. 데이터·산출물/비교 패널에 상세, 판정 필터, 요구 추적, 사건, 지연 차트 및 페이지 수신 이력 최대300개를 연결했다. W05 socket 하나의 관찰자만 공유한다. 이력 재생은 서버 시간과 궤도 UTC를 변경하지 않는다.

CSV는 원본 바이트를 다운로드에 전달하고 같은 응답의 실제 행을 별도 표시한다. JSON은 내려받기 요청 후 같은 응답을 고정 표시한다. CSV에는 원래 실행/시각/출처가 없으며 JSON을 통해 확인한다. 각각 새 서버 조회이므로 두 파일의 원자적 동일 시점은 보장하지 않는다.

## 검증
- Python baseline 2 PASS 및 전체 `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/kpi_workspace/pytest_full_01`: **374 PASS, 126.12s**, 기존 Starlette 경고1. 최초 import경로 오류 수정 후 다시 수행했다.
- 새 controller/transport/assembly 모듈 부재 RED 후 전체 `node --test project_support/tests/browser/*.test.mjs`: **150 PASS, 527.8934ms**. PASS/FAIL/INVALID 원본 기준, 파일/읽기 전용, strict응답, 원본bytes/BOM, malformed CSV, 취소/늦은 응답, 오류보존, history/run분리, 단일socket/Viewer, 입력복원 시험.
- 실제 IAB `http://127.0.0.1:8891/?validation=t066#data`, 1280×720 및1920×1080. 상세KPI02, PASS필터 empty/복귀, history Home/재생/실시간, CSV/JSON 버튼, JSON고정, 최소화/복원 확인. 새 console error0. 자동시험의 두해상도 조립검증과 실제 화면을 함께 확인했다.
- 실제 CSV HTTP200 응답 4행과 `#kpi-export` 4행의 모든 셀 일치. JSON HTTP200 응답과 `#kpi-values`의 값98/34.4/0/99.8, 기준90/50/60/99, 단위/판정 일치. 실행 RUN-CC8E4A98BBB2/시나리오 OISL_STRESS/SIM33.625s/규칙SIM-VNV-0.2 일치. 궤도UTC2020-07-12T21:16:01.000416000Z 보존.
- 원자료/로그/스크린샷은 ignored `data/workspace/validation/kpi_workspace`: pytest_full_01.log/node_01.log, csv_response.txt/json_response.json, kpi_1280.png/kpi_1920.png.

## 한계와 실패 기록
IAB download 완료 이벤트를 기다리는 도구가30초 timeout/reset됐고, CDP 관찰 호출도 한 번 크게 지연됐다. 이후 실제 버튼의 Fetch응답을 CDP로 읽어 화면과 대조했다. 네이티브 anchor 다운로드 요청/원본bytes 전달은 검증했으나 사용자 Downloads 폴더에 저장 완료한 파일은 확인하지 못했다. CSV CDP text는 BOM을 제거하므로 BOM보존 근거는 Python/Node bytes 시험이다. 파일시스템 저장 완료 시험은 미확인으로 남긴다.

평균지연 이름은 원본 현재캐시값, 장애경과는 복구실측이 아니다. samples/결측률/인증은 원본 SIM표시값이며 독립계측이 아니다. 이력은 페이지 세션 표본, recording은 플래그다. T032 성능 수용시험 대체가 아니다. 최종 소스검토에서 새 추가 결함0. 후속 W07 MOCK-HIL/catalog/교차화면 및 F001/F002/F004–F006/T032/실제 AeroDT 연결은 미완료 유지. 자동병합 없음.
