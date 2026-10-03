# T036 RF 계산기 연결 검증

2026-10-03. 승인 A / FR009 / SC007. W03 전체 또는 실제 통신 완료 보고가 아니다.

## 구현과 재사용
V6 지상국·통신 창에 11개 편집 입력과 8개 출력, 모델/가정/사용 입력 표시를 연결했다. 초기값은 전부 빈 값이며 API의 숨겨진 기본값에 의존하지 않는다. 기존 POST /api/communication/link-budget가 RF-Friis-v1을 계산한다. scalar 거리를 직접 입력하며 GP 가시 구간과 자동 연결하지 않는다. 서버의 반올림 전 status를 보존하고 실제 통신 미확인으로 표시한다. Shannon 용량은 이론값이다.

원본 참조 HEAD 1a1e00297a0301637455b0ef2cf48b2e74576b07 대비 ast.dump(include_attributes=False) 비교7개 동일: digital_twin/simulation/rf_network.py의 calculate_link_budget/calculate_route/contact_plan, communication/http/rf_network.py의 link_budget/communication_route/communication_contacts, communication/http/schemas.py의 LinkBudgetRequest. 이 서버 파일들은 이번 diff에서 변경되지 않았다. 전체 원본 저장소가 동일하다는 주장은 아니다.

## 자동 시험
- T033 Node RED: rf_link_budget.js 미존재로 ERR_MODULE_NOT_FOUND. T035 assembly RED: RF 입력 미존재로4개 실패.
- API62개: 실제 ASGI endpoint, 모든 입력/수치8개 독립 식, margin0/3dB 경계의 반올림전 분류, 숫자 범위50개/id/기본값, runtime 및 궤도 선택 불변. 최초 시험 fixture의 observed_monotonic_s 비교 오류 수정 후 통과; 제품 결함으로 분류하지 않았다.
- Node9개 RF controller/transport: 11개/빈입력/정확범위/유한성/echo/model/status/가정/사본/늦은응답/취소/종료/네트워크실패/422/HTML escape.
- 실제 assembly DOM 어댑터4개: 두 해상도 창 복원/역할 전환/입력 및 결과 유지/서버명령 없음/Viewer1개, 원격 draft 변경 시 결과 폐기, 별도 창11개 전달/자식 결과 미생성. 다른 브라우저/OS 창을 실제 실행한 증거와 구분한다.
- 전체 Python304 PASS108.66초, 기존 StarletteDeprecationWarning1. 명령: project_support/.venv/Scripts/python -m pytest -q --tb=short --basetemp=data/workspace/validation/rf/full_20261003_a -o cache_dir=data/workspace/validation/rf/cache
- 전체 Node95 PASS317.33ms. 명령: node --test project_support/tests/browser/*.test.mjs
- git diff --check PASS. Rust/제품wheel 변경 없음; 이번 native/wheel 재실행 없음.

## 실제 화면 및 HTTP
기존8879 서버를 재시작하거나 다른 작업을 종료하지 않고 IAB에서1280×720/1920×1080 검증했다. 첫 navigation 타임아웃 후 현재 DOM 확인으로 페이지가 정상 도착한 것을 확인했다. RF11개 빈 초기값, 빈 이름 오류, 명시 입력→기존 HTTP 계산 정상, 거리1km 배제/이전 결과 삭제, 재계산, 최소화/복원, 위성↔지상 역할 전환, 확장/스크롤에서 입력·결과 유지. 임시 viewport는 원상 복귀했다.

합성 입력 SYNTHETIC-RF,26GHz,1200km,20W,송신32dBi,수신34dBi,손실3dB,20MHz,10Mbps,290K,요구7dB → EIRP45.01dBW/FSPL182.333dB/수신-106.323dBW/잡음-130.965dBW/CN24.642dB/EbN027.652dB/여유20.652dB/이론용량163.817Mbps. pass는 실제 통신 성공이 아니다.

전력0.02W/거리100000km만 바꾼 합성 조건 → margin-47.764dB/이론용량0.001Mbps, 기존 모델 여유 부족 및 실제 통신 미확인. 입력은 실제 ISS/장비 프로파일이 아니다. 네트워크 고장과 역순 응답은 자동 어댑터 시험 근거이며 실제 브라우저 고장 주입으로 주장하지 않는다. 실제 화면의 기존 지점/조회 UTC 입력과 단일 Cesium canvas도 확인했다. 서버 불변성은 ASGI/assembly 시험 근거다.

원자료는 ignored data/workspace/validation/rf의 pytest.log, node_full.log, browser_evidence.json, rf_1280.png, rf_1920.png에 보존했다. 소스에 대용량 화면·로그를 커밋하지 않는다.

## 남은 일
FR009/SC007과 이번 T033~T036 연결·검증은 완료. Draft PR 리뷰/병합은 별도다. 실제 통신 조건 출처/서비스/장비 조사 및 적용 F001은 필수 후속이다. 기존3/0dB 분류를 실제 운용 판정으로 채택하지 않았다. 전체 프로토타입 통합 F002와 보류된 T032/SC006 프레임16.7ms 기준은 미완료이며 이번 시험으로 종료하지 않는다.


## 2026-10-04 최종 검토 보완
읽기 전용 검토에서 링크 이름의 Unicode 길이 차이를 확인했다. 서버는 code point40자, JS text.length/HTML maxlength는 UTF-16 단위를 세므로 emoji21~40자를 과도하게 거부했다. emoji40/41 경계 시험 RED 확인 후 [...text].length와 maxlength 제거로 서버 계약에 맞췄다. 실제 V6→기존 API에서도40자 정상/41자 오류 확인했다. 계산/API/schema는 그대로다. 수정 후 전체 Python304 PASS103.50초/기존경고1, Node95 PASS313.47ms. 최신 원자료 pytest_final.log/node_full_final.log/unicode_red.log. 이미 기록한 이전 검증은 이력으로 보존한다. 실제 통신 F001과 보류T032는 미완료 유지.
