# ADR 0006: 조회 안에서 사용하는 궤도 벡터 계산 계약

상태: T032 구현 및 공동 검토 초안. HTTP와 브라우저 wire 계약은 유지한다.

## 문제와 선택

정확한 1초 간격의 하루 조회는 86,401개 시각을 평가한다. 기존 계산은 각 시각을 UTC 문자열, UtcInstant, EOP 객체, OrbitSample로 여러 번 바꾸었다. T032 round1의 실제 저장 TLE 조회는 중앙값 1.678초였으며 1초 목표를 넘었다. 표본을 줄이거나 결과를 캐시하지 않고 조회 안에서 시각과 계산값을 벡터로 전달한다.

`OrbitVectorCalculation`은 UTC의 두 부분 JD, ITRF 위치, 고도각, 행별 오류와 EOP/윤초 해시를 가진 불변 사본이다. 숫자 배열은 bytes가 소유하여 write flag를 다시 켤 수 없다. 정상 행은 유한 위치와 -90..90도 고도각을 가져야 한다. 실패 행에는 오류 코드가 있고 숫자 영역은 NaN으로만 마스킹한다. `EarthOrientationVector`는 같은 snapshot에서 얻은 UT1 보정과 polar motion의 불변 배열이다. 현재 상태, 실행 기록 또는 영구 캐시를 소유하지 않는다.

## 주입 경계와 호환성

`create_orbit_calculation`이 반환하는 기존 문자열 계산 함수에 선택적인 `evaluate_times(orbit, UTC Time, ground_point)`를 제공한다. runtime은 조회 당시 선택 사본에 이 함수를 묶어서 `search_visibility(calculate_times=...)`에 주입한다. 함수가 없는 사용자 계산기는 기존 `calculate(tuple[UTC,...]) -> OrbitCalculation` 경로를 사용한다. scalar EOP provider도 기존 at/at_many를 통해 계속 사용할 수 있다. simulation은 data, communication 또는 user_application의 구현을 import하지 않는다.

조회는 vector 결과의 행 수와 두 부분 UTC JD가 요청과 정확히 같은지 확인한다. EOP의 제공자 해시와 벡터 해시가 다르거나 조회 도중 provenance가 바뀌면 오류다. native 행별 실패는 숨기지 않고 기존 VisibilityError로 변환한다. HTTP 상태, stale revision 판정, JSON 필드, 표시 UTC와 communication_status 의미는 바꾸지 않는다.

Astropy Time은 수정 가능한 객체이므로 evaluator에는 요청 시각의 사본을 전달한다. callback이 입력 시각을 바꾼 뒤 그 시각으로 결과를 만들더라도 원래 요청과 비교하여 UTC mismatch로 거부한다. 변이 callback의 최초 1 FAIL을 확인한 뒤 사본 전달로 보호했으며 실제 하루 scalar/vector 결과의 exact 일치도 다시 확인한다.

## 정확도 보존

UTC Time은 ERFA `d2dtf('UTC', 9)`와 `dtf2d`로 기존 9자리 ISO 문자열 왕복과 동일하게 정규화한다. 두 부분 quasi-JD를 합쳐 단일 float로 만들지 않는다. 윤초의 SI 간격과 SGP4의 UTC quasi-JD 분 차이는 계속 구분한다. EOP는 같은 hash 검증 snapshot을 보간하며 GMST82 및 polar motion 계산식은 유지한다. 1초 dense grid, 40회 극값 탐색 상한, 0.01초 root bracket과 오류로 구간을 나누는 동작도 유지한다.

## 검증과 한계

`test_orbit_vectors.py`는 신규 계약의 최초 4 FAIL과 vector 및 scalar fallback provenance 보호, EOP 행 수 보호의 추가 각 1 FAIL을 확인한 후 구현했다. 10,001개 윤초 주변 시각의 scalar parse와 JD exact 일치, 실제 native 행별 오류, readonly/입력 사본, 빈 배치, EOP 범위 오류, scalar provider fallback, 요청과 다른 UTC 행 거부와 하루 scalar/vector 결과 일치를 확인한다. 실제 저장 TLE/EOP/윤초 hash를 가진 계측 원자료와 profile은 data/workspace/validation/performance/t032_round2에 기록한다. 서버 계산 시간만으로 브라우저 결과 도착이나 다른 PC의 성능을 통과했다고 판단하지 않는다. 실제 통신 조건과 RF 검증을 추가한 결정도 아니다.
