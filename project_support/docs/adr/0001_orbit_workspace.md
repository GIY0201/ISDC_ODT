# ADR 0001: 독립 ISDC ODT의 첫 궤도 작업 공간

2026-10-01. 상태: 현재 구현 기준. 최초 요청 전체는 feature의 full_integration_plan.md에 유지한다. 이 ADR의 첫 단계 성공은 전체 기능 완료가 아니다.

## 결정
JavaScript/Cesium V6에 저장된 ISS 궤도와 가상 제주 지점을 연결한다. 전파는 Rust SGP4 WGS72/AFSPC, 좌표/고도각/구간은 검증한 Python 조합으로 구성한다. 내부 typed 계약을 digital_twin/contracts에 두고 native 경계는 communication에 둔다. runtime의 기존 구성 요소가 현재 선택/UTC를 소유하고 기존 SIM elapsed와 GP UTC를 혼합하지 않는다. 새 API는 /api/orbit로 추가하며 기존 API/WS 의미는 보존한다. 상세 wire 계약은 feature contracts/orbit_api.md를 따른다.

foundation의 UTC-JD 값은 정밀 두 float 값이고 UTC wire는 timezone을 명시한다. SI 재생시간은 UTC로 변환한 뒤 SGP4 UTC-JD 차이로 전파 시간을 만든다. 윤초를 JS Date로 암묵 정규화하지 않는다. 원본 입력과 EOP/윤초 파일은 hash 확인 후 명시적으로 읽으며 import 시 네트워크/서버/시계를 시작하지 않는다. 시간이 자료범위 밖이면 오류다.

OrbitInput은 frozen 값이며 TLE 원문/OMM 원문 해시와 출처/epoch/조회UTC를 보존한다. CelesTrak OMM의 EARTH/TEME/UTC/SGP4 defaults는 누락된 경우만 별도 기록하고 원문을 수정하지 않는다. 아직 Rust 경계와 연결하지 않았으므로 parser 통과를 실제 궤도 계산 성공으로 표현하지 않는다.

## V6 원본 보존
채택 V6 HTML SHA256 4e096aea64c1c9beac3218ff40bbe7f6bdd5b3f16750ae92ef3ac16da8c64c5b
CSS c0ab17d9d496dd3eb78d984a661793d1cc266fde9c03ed7643dcc16b97a0e262
JS 7301c5872fd19cb4260dca1424398f37605d425c31397f08022e97feba9fd2c6
원본은 보존한다. 이동/크기/최소화/확장/복원/별도창을 포함한다. Viewer는 문서당 하나이며 popout 충돌은 revision으로 처리한다. 구현되기 전 시안의 동작을 제품 검증 완료로 기록하지 않는다.

## 기존 기준선과 한계
변경 전 project_support 전용 Python 환경의 기존 시험35개 통과. 첫 재실행은 basetemp 상위폴더 누락으로 setup오류10개, 폴더 생성 후35PASS. 기존 pytest cache 경로 경고는 이후 workspace cache_dir로 분리한다. Starlette httpx deprecation은 기존 경고다.
연구 확장17/연결9/기존회귀35 PASS는 이전 계산연구 증거다. 실제 제품 API/UI/게임UX 및 wheel 제품화는 아직 미완료. EOP의 내부 table은 data만 사용하고 밖에는 frozen EarthOrientationPoint를 반환한다. ERFA 윤초 자료 초기화는 load 시의 명시적 정적 시간자료 설정이며 runtime 현재상태가 아니다. 제품 조립 시 하나의 고정 윤초 버전만 사용해야 한다.

## 후속
RF 실제서비스/장비 사양 확인·적용(F001), 나머지 선배 기능의 단계별 연결(F002), 실제 HIL/영구기록/실측위치 및 다른PC 지원은 별도 증거를 요구한다. 향후 AeroDT는 계층/단위/시간/공개 계약 경계로 연결한다. 지금 AeroDT UAM 물리를 변경하지 않는다.

현재 senior index/app/globe 및runtime/telemetry HTTP 소스 baseline hash는 data/workspace/validation/orbit_implementation_baseline/source_hashes.json에 기록했다. 이는 원본 소스 식별 증거이며 실제브라우저 렌더/사용성 시험을 대신하지 않는다.


### 2026-10-02 좌표 계산 및 검사 정책 정합
orbit_geometry는 foundation.UtcInstant와 digital_twin/contracts.EarthOrientationPoint를 입력으로 받는 순수 계산이다. 기존 계층 검사에 simulation->contracts 허용이 빠져 전체시험이 실패했으며, immutable 내부 typed API를 주입하는 현재 설계에 맞춰 해당 허용 경로만 추가한다. simulation->runtime/data/communication/user_application은 계속 금지한다. foundation을 검사대상으로 추가하여 foundation에서 상위 계층 import를 금지하고 각 계층의 foundation 사용은 허용한다. communication/native도 검사대상에 추가한다. 수치처리는 기존 궤도/API/UI와 별도 신규 함수이며 기존 계산을 교체하지 않는다. 출력ITRF m/m/s, ENU 기반 geometric elevation deg, WGS84 타원체 높이 m. 속도는 Earth rotation을 반영하고 LOD 입력 기본0초와 극운동 변화율 무시를 명시한다. 실제 도플러나 통신 유효성을 주장하지 않는다.


### 2026-10-02 runtime/실행 경계
OrbitRuntime은 기존 RuntimeState의 orbit 구성요소이며 current selection/UTC anchor의 단일 소유자다. 새 API query는 선택 snapshot만 복사하고 현재상태를 쓰지 않는다. GroundPoint는 contracts에서 정의하고 geometry에서 재사용하여 runtime이 geometry 구현 타입에 의존하지 않게 한다. application은 조회/계산 함수와 communication/native의 bounded thread executor 실행함수를 주입한다. runtime은 concrete native/data/communication을 import하지 않는다. 현재 기본worker2/대기2는 configs이며 실행중 취소는 슬롯을 조기 반환하지 않는다. 이미 완료된 future도 정확히 한번 반환한다. 기본앱은 입력/EOP 미준비를 허용하며 해당 계산을 unavailable로 보고한다. 공개 HTTP 매핑은 다음 task 범위. 기존 SIM/WS는 orbit snapshot을 자동으로 포함하지 않고 기존 payload를 유지한다.


### 2026-10-02 Orbit API 공개 계약 및 저장 profile
새 GET /api/orbit/inputs,state, PUT selection, POST samples를 추가한다. 기존 OpenAPI baseline fixture는 수정하지 않는다. 호환성 검사는 네 새 경로 및 GroundPointRequest/SelectionRequest/SamplesRequest만 제거한 나머지 전체 OpenAPI의 동일성을 계속 요구한다. runtime/실행 예외 타입은 내부 contracts에 정의하고 기존 runtime/native 모듈에서 재사용하여 HTTP가 concrete runtime/native 계산을 import하지 않는다.
새 요청은 strict Pydantic 형식/UTC/finite/상한 검사. 404 입력없음,409 revision충돌과현재state,422 UTC/범위/EOP오류,503 계산·native미준비/과부하. NaN/Inf를 포함하는 validation error의 원입력은 새prefix 오류응답에 echo하지 않아 strict JSON을 유지한다. 기존prefix handler는 유지한다. samples의 failed row는 수치null,전체오류/부분오류/완료를구분,모든결과통신unknown. 공개원본파일경로없음.
create_stored_orbit_app은 config의 명시된 로컬manifest를 lifespan의 thread에서 읽는 별도 실행 profile다. create_app 기본은 파일읽기 없이 기존/주입 기능으로 동작한다. 묶음검증 뒤첫요청전 단일RuntimeState.orbit을구성한다. 파일미준비/손상시 궤도목록503이며 기존SIM API유지. 이후API에서는파일조회없음. 예제는 Rust sgp4 2.4.0의 2020-07-12 ISS 공개TLE와파생OMM이며동등형식시험용으로만보존. 확보시각은local보존시각,현재telemetry아님. EOP/윤초는 검증된 astropy-iers-data snapshot hash를 고정한다. 자동다운로드/갱신없음. 원본과새manifest의 덮어쓰기를금지한다.
