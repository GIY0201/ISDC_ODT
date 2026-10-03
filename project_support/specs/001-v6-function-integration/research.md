# Phase 0 Research: 첫 위성/지상 지점 검증

Status: 아래 내용은 2026-10-01부터의 연구 결정 이력이다. 이후 Rust 채택·좌표 계약·제품 구현 결과는 plan.md/workflow-progress.md 및 validation/t030_review.md를 따른다. 초기 Python 권고를 현재 Rust 결정으로 오해하지 않는다. 현재 제품 설치 검증은 완료했지만 SC-006 성능 및 전체 후속 기능은 미완료다. 이전 조사/대안은 삭제하지 않는다.

## Decision: 계산 주 구현
권고: Python sgp4 순수 계산을 주 구현으로 사용, 앱이 생성/종료하는 제한된 실행기로 요청을 처리한다. JS/Cesium은 입력/표시를 맡는다. runtime의 현재 상태와 읽기 전용 탐색 결과는 분리한다. 대기열을 제한하고 최신 요청 ID를 적용한다. 실행기만으로 GIL/응답시간 목표 달성을 보장하지 않는다.
Rationale: 입력/단위/오차 기준을 한곳에서 검증하고 renderer와 계산 경계를 유지한다.
Alternatives: JS worker는 브라우저 부하 격리 가능하지만 runtime과 클라이언트 계산의 두 구현 유지가 필요; 처음부터 C++/Rust는 측정된 병목 근거 없음. Worker의 역할은 MDN 공식 문서 확인.

## Decision: 기존 코드 재사용 범위
FastAPI 조립/정적 경로/runtime 종료와 Cesium 카메라 조작은 재사용 후보. 기존 orbit.js의 순수 함수 분리 패턴은 참고한다. synthetic fallback, 음수 고도 clamp, 구면 고도각, 고정 5도/45초/최대 3구간 경로는 새 수치 검증 기준을 충족하는 계산으로 채택하지 않는다. 기존 경로는 회귀시험과 함께 보존한다.
Rationale: 초기 10도 설정, 하루 전체 구간, 높이 반영과 1초 경계 목표에 기존 의미가 맞지 않는다.

## Decision: 검증 계층
SGP4 TEME 원시 위치 -> 지구고정/지상좌표 변환 -> 고도각 -> 패스 경계 -> 웹 결과 일치 -> 성능을 분리한다. Python/JS 두 구현은 계보를 공유할 수 있어 서로의 일치만을 독립 검증으로 삼지 않는다. 공식 Vallado fixture를 기준으로 삼는다.
WGS72 중력상수와 WGS84 지점 타원체는 용도가 다르다. TEME를 J2000 좌표로 취급하지 않는다. UTC/UT1/극운동 적용 여부와 지점 높이 기준을 계약에 명시한다.

## Decision: 입력/가시 구간
저장 원문, 출처, 조회시각, epoch, SHA256 및 형식 defaults를 보존. 같은 시각에 받은 TLE/OMM이라고 무조건 동일 요소로 판단하지 않는다. CelesTrak OMM JSON의 EARTH/TEME/UTC/SGP4 defaults를 명시한다.
거친 탐색과 경계 보정을 분리하고 짧은 구간/접점/잘림/없음/실패를 별도 시험한다. 최초 3개만 반환하지 않는다. 실제 통신 상태는 미확인으로 유지한다.

## 구현 전 미해결 게이트
- Python sgp4 선택 버전과 Python3.14 Windows 설치/가속 지원 검증. 기존 환경 실험을 배포 환경 승인으로 간주하지 않는다.
- 공식 fixture와 원시 입력/출력/변환 기준 자료의 실제 확보, 버전/해시 기록.
- UTC/UT1/극운동을 포함할지 또는 명시된 근사 계약을 채택할지 검증 근거로 결정.
- 제주 가상 좌표는 기존 33.4996N/126.5312E 재사용 후보, 높이는 실제 시설이 아닌 가정값으로 선정/공개. 아직 확정 아님.
- 설치 후 계산/왕복/화면 실측. JS 7.0.1 동등 계산 모드/상수는 별도 확인.

## 공식 근거
- https://celestrak.org/publications/AIAA/2006-6753/ : 코어 코드/검증 자료.
- https://celestrak.org/publications/AIAA/2006-6753/faq.php : TEME/ECEF 및 지상국 절차.
- https://pypi.org/project/sgp4/ : Python 패키지의 출력/상수/형식 설명.
- https://celestrak.org/NORAD/documentation/gp-data-formats.php : OMM defaults/GP 형식.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers : background thread와 DOM 제한.
- https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html : 단일 viewer 구성.

조사 담당의 읽기 전용 확인 및 로컬 코드 정적 검토를 근거로 한다. 설치/수치 시험/실제 웹 실행은 하지 않았다. 자료의 존재 확인과 실제 기준 파일 검증은 구분한다.

## Rust 후보 재검토
사용자 동의로 Rust 우선 후보 조사 진행. rust_core_review.md에 sgp4 2.4.0/MIT/배포/계산 기본값 차이 및 C++ baseline 비교 절차를 기록했다. Python 주 계산 추천은 비교 대안으로 내려놓고 Rust core + PyO3 + Python API + JS UI를 우선 설계 후보로 삼는다. 실제 build/benchmark 미실행이므로 최종 선정 게이트 미해결.

## 실제 Rust/C++ 비교
rust_cpp_comparison_results.md에 동일 ISS historical/WGS72/AFSPC 1,440/86,400 시각 비교 증거 기록. 86,400 Rust18.1175ms/C++batch18.2558ms/C++scalar113.4258ms 중앙값. 최대 위치 차이6.874e-6m. 계산 성능은 동급, batch 경계 중요. Rust 우선 후보 유지. PyO3/좌표변환/API/UI 검증 미완료, Phase0 게이트 전체 완료로 표시하지 않음.

## PyO3 연결 연구 실측
rust_python_probe_results.md: CPython3.14 Windows wheel build/repair/별도venv 설치/9tests 통과. 버퍼 반환 총20.01ms(86400시각), C++20.08ms. batch+소유buffer 반환을 우선 설계. 변환/time/independent fixture 및 실제API/웹 연구 게이트는 남음.

## 고정 자료 수치 시험 후속
coordinate_probe_results.md: 저장된 IERS B 및 윤초 자료 해시 확인 후 재실행 통과. Phase0 공개 위치fixture/고도각/경계 부분 증거 확보. 일반 날짜/윤초/EOP 범위/짧은구간/속도 및 Rust 변환 통합은 미완료. 연구 문서의 이전 미실행 상태는 해당 범위만 이번 증거로 갱신한다.

## 계산연구 검증 게이트 결과
coordinate_probe_results.md 최종 묶음 참조. 확장17시험+Rust연결9+기존회귀35 통과. 공개fixture/윤초UTCJD/자료범위/짧은구간·접점·공백/속도0LOD/전범위배치 및 하루가시탐색 성능 확인. 계산연구 실행게이트는 해당조합 내 완료, 제품구현 및 UI 검증과 배포설계는 별개. 다음은 Phase1 문서의 stale 입력을 수정한다.

## Phase1 설계 정리
plan/data-model/contracts/orbit_api 및workspace/quickstart를 현재검증조합으로갱신했다. 기술문서의미합의TS/Vite권고는backup보존후JS/Rust전파+Python좌표조합으로수정했다. 공개route는별도prefix/ADR, currentstate는runtime기존구성요소, artifact버전은plan참조. 연구gate의배포/UI미검증은제품task에서검증하는사항으로명확히분리. 제품source변경없음.

## W03-A 재사용 결정
Decision: 기존RF-Friis-v1 계산/POST API와모든11입력을편집하는새V6패널. 사용자A승인. Rationale: 선배기능을작은단위로연결하고기존계산/legacy회귀를보존하며숨겨진장비기본값을배제한다. Alternatives: legacy패널복사(숨은고정값존재), ISS전용프로파일우선(서비스/장비미선정), 새RustRF계산(실측병목근거없음).
독립연구검토: 반올림전margin으로status결정, HTTP422배열의필드별오류표시, 정확한exclusive/inclusive경계, 전체요청echo/유한결과검증, generation/abort/사본필수. 공식ITU/ARISS는rf_workspace_review.md 조사출발점이며실조건확정자료가아니다. A구현연구게이트완료, F001실조건/모델충족구간은계속열림.

## 2026-10-04 ISS APRS 부분 프로파일 조사
ARISS https://www.ariss.org/current-status-of-iss-stations.html 확인 UTC2026-10-03T17:12:27Z, 공지 기준2026-09-25: Zvezda/RS0ISS APRS437.825MHz와 troubleshooting/testing. SSTV437.550MHz Oct2~6 공지도 공존하므로 현재 APRS 운용을 자동 확정하지 않는다. https://www.ariss.org/contact-the-iss.html 의 일반 최대 전력은 이 운용의 실제 전력 근거가 아니다. https://www.ariss.org/uploads/1/9/6/8/19681527/k9jkm_2012_symposium_ver2.pdf 의1200baud는2012년 설명이며 현재 장비 조건으로 적용하지 않는다.
읽기 전용 연구/원본1a1e00297a0301637455b0ef2cf48b2e74576b07 검토: 기존 RF 함수/API 재사용, S/X/Ka 대표 접시/잡음 모델을 UHF 장비로 적용하지 않는다. 사용자 장비 없음에 따라 주파수 외 numeric 값은 모두 사용자 가정/unknown. 네트워크 live 조회 대신 출처를 가진 버전 snapshot을 제공, 고정 source 시점을 표시한다. 나중 장비 선정/도플러/복조/실제 수신 증거는 F001 후속.

## W03-C 재사용 결정
사용자는 거리/도플러 대신 선배 경로·접촉 계획을 선택했다. 원본 rf_network.py calculate_route/contact_plan 및 HTTP route/contacts, network.communication은 기존시나리오기능으로재사용한다. 읽기전용연구는정적graph/quality/장애제외와벽시계합성일정의의미를확인했다. 대안: ISS 지상거리/도플러는공식자료와현재위치·속도계약추가검증이필요하므로F001후속. oisl.js는별도원본의위성간LVLH전제라그대로UHF지상수신으로이식하지않는다. actual ISS/GP2020시간과시나리오계획2026벽시계분리. source runtime복제없이결과사본만표시한다.
