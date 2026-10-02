# Rust–Python 묶음 궤도 계산 계약 검토안

2026-10-01. 설계 검토용, 아직 구현/승인된 public API가 아니다. 기존 workspace.md는 초기 전체 연결 초안으로 계속 stale이다. 본 문서는 연구 중 계약 제안이며 미해결 연구 게이트를 건너뛴 Phase 1 완료가 아니다.

## 책임과 데이터 흐름
사용자 시각 선택 -> application의 입력 검증/읽기 전용 조회 -> Python 계약 -> Rust 순수 계산 -> Python 결과 사본 -> HTTP/browser -> 단일 Cesium 표시.
Rust 코어는 digital_twin/simulation, PyO3 경계는 communication, 생성/종료 및 HTTP 주입은 user_application 책임. simulation에서 Python/FastAPI/renderer/runtime를 호출하지 않는다. runtime의 현재 상태와 탐색 결과를 복제 소유하지 않는다. HTTP adapter에는 구체 Rust 객체를 노출하지 않는다.

## 첫 호출 단위
검토안 함수 의미: propagate_batch(orbit_input, minutes_since_epoch, calculation_profile) -> batch_result.
첫 단계 위성 하나, 여러 시각을 한 번에 전달한다. 시각 하나도 길이1 배열로 처리한다. 다수 위성/장기 job API는 후속 기능이다.
같은 입력/시각/profile로 다시 호출하면 같은 허용 오차 범위의 결과를 반환한다. 시각 순서 변경도 결과를 바꾸지 않는다. 첫 단계에서는 호출 간 deep-space 적분 상태를 공유하지 않는다.

## 입력
- orbit_input: 검증된 TLE 두 줄 또는 명시한 defaults를 적용한 OMM 요소. source_id/epoch/content_sha256은 Python 계약이 유지하며 결과의 provenance와 연결한다. core의 parse 실패를 synthetic 입력으로 대체하지 않는다.
- minutes_since_epoch: 유한 f64 배열, 각 값은 자료 epoch 대비 분. 음수/비단조/중복 입력도 해당 시각의 계산으로 지원하고 순서를 보존한다. wall-clock 입력을 core에서 읽지 않는다.
- calculation_profile: profile ID와 버전으로 중력 상수/SGP4 초기화 및 전파 모드 지정. 최초 검증 후보는 WGS72/AFSPC이며 Rust/C++ benchmark와 일치. 모드 변경은 버전/ADR/기준 시험을 함께 갱신.
- 하루 시험 범위는 epoch부터 +24h. 범위 시작/종료 포함 여부와 샘플 간격을 호출자가 명시한다. benchmark의 끝 제외와 기능의 경계 포함을 혼동하지 않는다.
- 큐/요청 크기 상한은 실제 메모리/지연 측정 후 고정. Python adapter는 잘못된 배열 차원/NaN/무한값/지원하지 않는 profile을 계산 전에 거부한다.

## 출력과 단위
- index/elapsed_minutes/status를 입력 행과 같은 순서로 반환.
- 성공 행: position_teme_km[3], velocity_teme_km_s[3]. 좌표계와 단위는 필드명/계약에 함께 고정한다.
- 실패 행: 명시적 오류 코드와 input index, 수치 결과 없음. 0벡터/이전 결과/NaN을 성공 위치로 사용하지 않는다.
- batch 전체의 source_id/epoch/hash/profile/library version은 provenance로 전달한다. OMM/TLE 형식 변환 결과가 서로 다른 원본임을 숨기지 않는다.
- 위도/경도/고도/고도각은 후속 변환 계약에서 별도로 계산한다. raw TEME를 Cesium J2000 위치로 넘기지 않는다.

## Python 경계와 메모리
Python 객체 접근/입력 복사는 interpreter 연결 상태에서 수행한다. Rust 계산은 안전하게 소유한 입력으로 interpreter 제약을 해제한 구간에서 수행하고 반환 객체 생성은 다시 연결 후 처리한다. 실행 중 Python mutable 버퍼를 참조한 채 다른 스레드가 수정하도록 두지 않는다.
첫 검증 wrapper는 소유권이 명확한 복사 기반 batch를 기본안으로 한다. zero-copy/NumPy buffer 최적화는 실제 경계 비용 측정 뒤 검토한다. buffer 선택 전 list/array 변환 비용을 비교한다.
외부 경계로 panic을 전달하지 않는다. 예상 가능한 parse/propagate 오류는 Result 기반 처리하고 예외/HTTP error 변환은 adapter가 책임진다. native binary 실행 중 치명 오류까지 정상 응답으로 위장하지 않는다.

## 화면 비동기 계약
source revision, requested UTC, request ID는 application/browser 계약이며 core 전역 상태가 아니다. 결과는 최신 선택/revision과 일치할 때만 채택한다. 취소 요청의 완료가 늦어도 오래된 결과는 덮어쓰지 않는다.
한 요청이 실행 중일 때 시각 입력을 합쳐 최신 요청을 유지하고 무한 대기열을 만들지 않는다. 대기열 크기/최대 batch/취소 방식은 wrapper 및 API benchmark 후 계획에서 고정한다.
재생 화면은 60fps 렌더 목표와 물리 계산 빈도를 구분한다. 보간을 쓰면 표시용 보간임을 구분하고 합의한 정확도/시각 일치 시험을 통과해야 한다. 아직 보간 알고리즘을 선정하지 않는다.

## 검증 순서
1. 최소 PyO3 Windows wheel build/install/import 및 profile/버전 조회.
2. 같은 historical ISS 배열을 Rust native 결과와 비교. batch 호출/변환/반환 비용 포함 측정.
3. 정상/잘못된 TLE/NaN/순서 변경/중복/음수 시각, 행 오류/전체 오류와 상태 불변성 시험.
4. 공식 원시 fixture 비교와 수용 오차 확인. 라이브러리 자체의 더 엄격한 시험 유지.
5. 좌표변환/고도각/구간 경계와 API/browser 연결은 다음 검증. 이 wrapper 검증만으로 UI/통신 완료 주장 금지.

## 미해결과 추적
PyO3 정확 버전/배포 Python ABI, 반환 버퍼 형식 및 호출 비용은 실제 최소 wrapper 검증에서 확정한다. TEME→ECEF/UT1/극운동/높이 계약은 연구 게이트로 남는다. 기존 R001/R005/R007/R008/R009 및 F006에 연결. 실제 통신/선배 나머지 기능은 기존 ledger 유지.

## 검증 근거 갱신
최소 wheel 설치와9개 시험/반환 비용 측정 완료. 목록 반환57.16ms 대비 소유된 연속bytes/readonly NumPy view20.01ms(86400시각)로 버퍼 경로를 제품 설계 우선안으로 한다. probe의 전체batch error/100000 상한은 제품 행별 오류 계약 구현 증거가 아니다. CPython3.14 Windows만 확인. 근거 rust_python_probe_results.md.

## Phase1 연계 보완
Python안쪽typed결과는ITRF m/고도각deg, native전파buffer는TEME km/km/s로유지하고nativeadapter와geometry에서명시변환한다. productsource는simulation/orbit_propagation, nativebinding조립은communication/native/orbit_adapter.py, 현재selection은runtime하나. prototype100000행상한/전체batch예외는제품계약아님. 제품rowstatus 및OMM지원은tasks의새시험/구현으로검증한다. wire는orbit_api.md의JSON이며buffer내부형식을외부API로유출하지않는다.


## 2026-10-02 제품 경계 구현 상태
제품 module isdc_orbit_propagation 0.1.0, crate digital_twin/simulation/orbit_propagation. TLE/OMM 두 함수는 owned little-endian f64 bytes와 행별 Option 오류코드를 반환한다. 실패 행의 내부 buffer는 NaN placeholder이며 성공으로 노출하지 않는다. Python NativeOrbitBatch.row(index)는 실패시 None, valid_rows()는 성공행 indices와 수정불가 TEME km/km/s 배열만 반환한다. profile WGS72_AFSPC, frame TEME, UTC와 입력 hash/id는 유지한다. 최대86401행은 24h1초 간격+끝점용 내부 상한이며 공개 samples count3601과 별개다. OMM 메타데이터 CLASSIFICATION_TYPE/element set/revolution/ephemeris type은 계산에 사용하지 않는 serialization placeholders U/0으로 생성하고 원본 기록을 바꾸지 않는다. 숫자 요소와 epoch는 검증된 OrbitInput에서 가져온다. wheel Windows x64 CPython3.14 빌드/현재 제품venv 호출은 PASS, 별도PC와 DLL 배포는 T029 미완료. 공식33/668제품시험 및 전체pytest60PASS는 실측 ISS 정확도나 UI 성능을 증명하지 않는다.
