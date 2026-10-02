# Implementation Plan: V6 첫 위성/지상 지점 검증

Branch: 기존 feature 경로 식별자 001-v6-function-integration, 실제 Git branch 생성 없음.
Date: 2026-10-01 | Spec: [spec.md](spec.md)
Status: 설계 검토안, 연구 확인 및 공동 설계 검토 전 구현 금지. 초기 계획은 review_history 보존.

## Summary
확정 V6에 ISS 하나와 제주 가상 지점의 시간/위치/가시성을 연결한다. 전체 제품 요구는 workflow-progress.md에서 유지한다. 기존 FastAPI 앱 조립, runtime 단일 소유권, Cesium 초기화/카메라 조작을 재사용한다. 기존 구면 고도각/45초/5도/최대 3구간 계산은 정확한 경계 계산의 대체재로 사용하지 않는다.

## Technical Context
- Language: JavaScript ES modules/HTML/CSS, Python/FastAPI. TS/React 보류.
- Versions: 기존 Cesium 1.143 및 satellite.js 7.0.1은 소스에서 확인한 기준선. 새 라이브러리 버전/호환성은 연구 확인 전 고정하지 않음. 현재 Python 3.14 시험 환경은 실험 환경이며 배포 버전 선정 완료 증거가 아님.
- Storage: 원본 궤도 자료/출처/기준시각/해시를 data의 버전 식별 가능한 입력으로 관리. 실행/시험 생성물은 data/workspace. 실제 시설 자료 없음.
- Testing: pytest, Node 계산/계약 시험, 브라우저 수치/작업 창/실제 렌더 계측. 기준 계산 자료와 검증 결과 해시 기록.
- Platform: Windows 로컬 FastAPI와 WebGL 브라우저, 첫 단계 위성 1개/지점 1개.
- Performance: 합의 SC-006 (60fps, p95 화면 피드백 50ms, 시간 결과 100ms, 24시간 구간 1초). 99백분위/최댓값 함께 보고.
- Accuracy: 동일 기준 조건 대비 위치 10m/고도각 0.01도/경계 1초. 실측 정확도 보장 아님.
- Constraints: 기존 API/계산을 무조건 변경하지 않음. 신규 계산 계약은 별도 버전/ADR, 회귀시험 유지. import 네트워크/clock 금지. 실제 통신 조건 후속 필수.

## Constitution Check
설계 전: 독립 실행/상태 소유권/JS 기준/전체 목표 보존 원칙 충족. 시험 통과는 아님.
설계 후: 계산 주 구현 위치와 시간 소유권/공개 계약을 확정한 뒤 재검토. 아직 PASS 선언하지 않음.

## Project Structure
기존 책임을 따른 설계 대상이며 지금 소스 파일/빈 폴더를 생성하지 않는다.
- digital_twin/contracts: 궤도 입력/조회 결과/시계의 단위와 시간 계약.
- digital_twin/simulation: 순수 궤도 전파, 좌표 변환, 지상국 고도각과 구간 경계 탐색.
- digital_twin/runtime: 실행 시계/현재 선택의 권위. 조회 계산은 불변 입력 사본만 사용.
- data: 저장 궤도 입력의 출처/원본/해시 조회. 외부 카탈로그 갱신은 현재 단계 필수 아님.
- communication/http 및 communication/browser: 기존 API에 추가되는 버전 있는 궤도 조회 계약과 클라이언트.
- digital_twin/visualization: 단일 Cesium Viewer, 결과 표시. 계산 실패를 합성 데이터로 성공 처리하지 않음.
- user_application/web: V6 역할 진입점/작업 창/시간 입력 흐름 및 앱 조립.
- user_application/configs: 시험 지점/높이 기준/고도각/표시 설정. 위성 요소를 운용 구성에 복제하지 않음.
- project_support: 계획/ADR/기준 검증 자료와 시험, 도구. 빌드/의존성 실험은 기존 위치 유지.

## 계산과 시간 설계 검토
2026-10-01 사용자 Rust/C++ 의견에 따라 아래 Python 주 계산 권고를 재검토한다. Python SGP4도 C++ 가속을 사용할 수 있으므로 Rust 대비 성능은 실제 구현/배치/경계 비용으로 비교한다. Rust 코어 + Python API + JS UI를 후보로 추가하고, 계산 코어 선택 전 Phase 0 완료로 처리하지 않는다.
추천안: Python 순수 계산을 주 구현으로 두고 앱이 조립한 제한된 실행기로 무거운 구간 조회를 수행한다. HTTP 경계는 계약만 호출한다. 브라우저는 입력 피드백/단일 Cesium 렌더를 담당하고 최신 request ID와 입력 revision이 맞는 결과만 채택한다. 기존 JS satellite.js는 기준선 보존과 비교에 사용하며 새 주 계산과 두 개의 권위 있는 상태를 만들지 않는다.

서버 현재 시계와 사용자의 탐색 시각은 구분한다. 탐색은 읽기 전용 query이고 물리 현재 상태를 수정하지 않는다. 재생은 선택된 탐색 범위의 표시 흐름이며 기존 SIM 제어 명령을 암묵적으로 재사용하지 않는다. 탐색 query/재생 표시 계약은 설계 검토에서 확정한다. 시간 변경 중 서버 왕복이 100ms 목표를 못 맞추면 짧은 검증된 샘플 구간 제공/표시 전략을 먼저 측정하고 변경 이유를 기록한다. 보간 화면은 기준 시각의 정확 계산과 구분하며 수치 정확도를 보간으로 검증하지 않는다.

구간 계산은 거친 탐색 후 교차점 보정, 접하는/짧은 구간 검출 및 잘림 표시를 포함한다. 탐색 간격만 줄여서 1초 정확도를 주장하지 않는다. WGS84 지점 타원체 높이와 UTC, SGP4 계산 상수/모드를 명시하고 원시 TEME와 표시 좌표를 구분한다. 일치 검증은 기준 자료와 독립 좌표/고도각 계산을 사용한다.

## 재사용 결정
| 기존 기능 | 처리 |
|---|---|
| FastAPI 앱 조립/정적 경로/runtime 종료 | 재사용, 새 계산 계약과 의존성 주입만 추가 |
| Cesium 단일 Viewer와 카메라 조작 | 재사용 후보, 계산과 표시 결합 부분 분리 후 웹 검증 |
| orbit.js positionAt | 기존 기준선 보존; 합성 fallback은 첫 단계 경로에서 금지 |
| elevationAt/predictPasses | 기존 기능 보존; 새 정확도 경로는 높이/좌표/경계 시험과 함께 별도 구현 |
| 기존 임무/RF/MOCK-HIL/KPI | 이번 연결 대상에서 유예, 전체 기능 추적에서 계속 유지 |
| V6 시안 | UI 구조와 조작 기준 재사용, mock 입력/결과는 계산 계약으로 교체 |

## Requirement Coverage
R001 -> Project Structure/Constitution Check; R002 -> 단일 Viewer/V6 흐름; R003/R004/R010 -> 재사용 결정/단계 검토와 이력 보존; R005 -> 계산/시간/구간 설계; R006/R007 -> provenance 및 실제 통신 후속; R008 -> Technical Context; R009 -> 성능/최신 요청 채택. task ID는 tasks 단계에서 배정한다.

## Phases
0. 기준 자료/라이브러리/계산 위치와 변환 연구, 설계 검토.
1. data-model/contracts/quickstart 작성, ADR와 정확도 검증 데이터 확보.
2. tasks/analyze 후 핵심 계산부터 작은 단위로 구현 및 시험.
3. V6 화면 연결, 실제 웹 정확도/성능 검증 후 사용자와 다음 기능 논의.

## Complexity Tracking
현재 원칙 예외 없음. 네트워크 query와 단일 상태 소유권은 분리한다. 내부 bus/중복 renderer/전체 언어 재작성은 추가하지 않는다.

## 설계 조사 갱신: 실제 비교
동일 조건 코어 시험에서 Rust와 C++ batch는 동급 성능. Python 주 계산 초기 추천은 비교 대안으로 유지하되 Rust 코어+PyO3 batch를 우선 설계 후보로 채택한다. 후보 검토 동의와 제품 최종 구현 승인은 구분한다. PyO3 비용/배포/좌표변환/전체 흐름은 후속 검증. 근거: rust_cpp_comparison_results.md. 기존 추천 문단은 이전 설계 이력이며 현재 구현 지시가 아니다.
