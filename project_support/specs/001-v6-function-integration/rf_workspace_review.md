# W03 첫 구현 범위 검토

2026-10-03. 기존 feature의 R003/R004/R006/R007/R010과 F001/F002에 연결되는 조사 기록이다. 사용자 A 승인 후 RF 계산기 연결을 구현·검증했다. 아래 초기 조사 기록은 이력이며 현재 상태는 마지막 절과 t036_rf_workspace.md를 따른다.

## 재사용 근거

- 선배 참조 구현과 현재 `digital_twin/simulation/rf_network.py`의 `calculate_link_budget`를 비교했다. EIRP, 자유공간 손실, 수신 전력, 열잡음, C/N, Eb/N0, 링크 여유 및 Shannon 이론 용량을 계산한다. 실제 수신 로그를 사용하는 함수는 아니다.
- 현재 `communication/http/rf_network.py`의 `/api/communication/link-budget`와 `communication/browser/api.js`의 `linkBudget`는 이미 존재한다. 새 UI에서 같은 계산을 재구현하거나 언어를 바꿀 필요는 아직 확인되지 않았다.
- 기존 `/legacy`의 링크 계산 UI는 일부 입력만 편집 가능하다. 손실, 데이터율, 잡음온도, 요구 Eb/N0 등 나머지 값을 사용자가 확인할 수 있도록 검토해야 한다. V6에서는 이 기능이 아직 연결되지 않았다.
- 기존 판정은 여유 3dB 이상 pass, 0dB 이상 marginal이다. 서비스/장비별 근거가 확인되지 않은 이 기준을 실제 통신 성공이나 장비 적합 판정으로 표시하지 않는다.
- `contact_plan`은 벽시계와 시나리오 링크 품질에서 구간을 생성한다. 기존 GP 기하학적 가시 구간을 대체하거나 실제 접촉 예약으로 연결하지 않는다. route도 시나리오 그래프 계산이며 실제 망 상태가 아니다.

## 확인된 공백

1. 기존 26GHz/20W 등의 값은 예시이며 ISS 통신 사양으로 지정된 값이 아니다.
2. 서비스/장비, 입력별 출처와 확인일, 도플러 추적, 편파 및 지향 손실, 실제 시설 장애물 제한, 운용 가용성은 추가 확인이 필요하다.
3. 공개 ARISS 자료에는 여러 서비스별 주파수와 운용 모드가 있다. 한 종류를 임의 선택하면 전체 ISDC 데이터 링크 요구와 다른 기능이 될 수 있다.
4. 기존 RF 회귀는 동일 입력 재현성과 장애 시 경로 제외를 검증한다. 독립 수치 기준/필수 입력 누락/경계값/입력 사본 보존/실제 조건 적용을 모두 검증한 시험은 아니다.

## 공식 조사 출발점

- [ITU-R P.525-5](https://www.itu.int/rec/R-REC-P.525-5-202411-I/en): 자유공간 감쇠 기준. 2026-10-03 공식 표제와 문서 버전을 확인했으며 전체 링크 모델 검증을 완료한 것은 아니다.
- [ARISS Contact the ISS](https://www.ariss.org/contact-the-iss.html): 서비스별 주파수/모드 및 장비 개요. 실제 선택 장비의 모든 파라미터나 과거 저장 궤도 시점의 가용성 근거로 대체하지 않는다.

## 검토 가능한 두 범위

- A 권고: 편집 가능한 RF 입력과 모델 계산 결과를 V6 지상국 창에 연결한다. 기존 계산/API를 보존하고 모든 가정값을 명시한다. 실제 조건 조사·적용(F001)은 별도의 필수 게이트로 계속 열어 둔다. 이 묶음에서는 실제 통신 충족 구간이나 GP 거리 자동 연결을 완료로 주장하지 않는다.
- B: ISS의 특정 서비스와 지상 수신 장비를 먼저 선정하고 공식 조건을 확보한 뒤 해당 프로파일의 모델을 연결한다. 서비스/장비 선정 답변이 먼저 필요하다.

어느 범위든 상세 명세/계약/시험 작업을 작성하고 일관성 검토 후 구현한다. 미래 입력을 빈 폴더/범용 내부 bus로 미리 확장하지 않는다. runtime 상태와 선택 UTC를 RF 계산기에서 복제 소유하지 않는다.

## 이번 검증과 상태

- 기존 `test_link_budget_is_reproducible_and_route_respects_fault_target` 1 PASS/0.03초. 기존 동작 기준선의 제한된 확인이다.
- 제품 소스/API/UI 변경 없음. 새로운 전체 pytest/Node/native 시험은 실행하지 않았다.
- T032 프레임 검증은 사용자 지시로 나중에 재개한다. 실패 기록과 16.7ms 목표는 유지한다.
- 질문 1개 제시, 답변 0개. W03 범위 선택 후 기존 feature 명세와 계획을 확장한다. 초기 8/8 체크리스트는 첫 묶음 명세의 기록이며 W03 설계 완료 판정이 아니다.


## 승인 A 및 재사용 확인
- 사용자 답변 A로 직접 설정 RF 계산기 연결을 먼저 수행했다. 실제 서비스/장비 선정과 조건 적용은 F001로 계속 추적한다.
- 원본 참조 HEAD 1a1e00297a0301637455b0ef2cf48b2e74576b07과 현재 AST 비교: calculate_link_budget/calculate_route/contact_plan, link_budget/communication_route/communication_contacts, LinkBudgetRequest 총7개 동일. 계산 재작성이나 RF 서버 API 교체 없음.
- 신규 코드는 V6 입력/결과 패널과 화면용 요청·오류·취소 처리다. 기존 RF 계산/API에 모든11개 입력을 보내고8개 결과와 기존 status를 표시한다. transport의 signal/422 필드 오류 개선은 wire/서버 의미를 바꾸지 않는다.
- 전체 Python304/Node95 PASS, 실제 두 해상도 HTTP/UI 검증. 상세 한계와 근거: validation/t036_rf_workspace.md. T032/F001/F002 유지.


## 2026-10-04 최종 검토 보완
읽기 전용 검토에서 링크 이름의 Unicode 길이 차이를 확인했다. 서버는 code point40자, JS text.length/HTML maxlength는 UTF-16 단위를 세므로 emoji21~40자를 과도하게 거부했다. emoji40/41 경계 시험 RED 확인 후 [...text].length와 maxlength 제거로 서버 계약에 맞췄다. 실제 V6→기존 API에서도40자 정상/41자 오류 확인했다. 계산/API/schema는 그대로다. 수정 후 전체 Python304 PASS103.50초/기존경고1, Node95 PASS313.47ms. 최신 원자료 pytest_final.log/node_full_final.log/unicode_red.log. 이미 기록한 이전 검증은 이력으로 보존한다. 실제 통신 F001과 보류T032는 미완료 유지.
