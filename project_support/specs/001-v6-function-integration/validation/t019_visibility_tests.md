# T019 가시 구간 시험 준비

T018 PR #5 이후 `codex/v6-visibility-tests`에서 시험만 작성한다. T020 계산 구현, T021/T022 API 및 T023 UI는 이번 변경에 포함하지 않는다. 기존 화면과 runtime 소유권을 유지한다.

## 계산 진입점 수용 계약

`digital_twin/simulation/visibility.py`의 `search_visibility`에 keyword 인자 `calculate`, `start_utc`, `end_utc`, `minimum_elevation_deg`를 전달한다. calculate는 요청된 UTC tuple을 받아 같은 순서/시각의 immutable `OrbitCalculation`을 반환하는 주입 함수다. 파일 조회, native 조립과 runtime 접근은 계산 모듈 책임이 아니다. 최소 고도각은 0~90도, 조회는 SI 시간으로 0초 초과~86400초 이하이며 잘못된 입력은 계산 호출 전에 ValueError로 거절한다.

결과는 immutable이며 `query_start_utc`, `query_end_utc`, `minimum_elevation_deg`, tuple `intervals`, tuple `contacts`, `status`, `errors`, `eop_sha256`, `leap_sha256`, `frame`, `profile`을 제공한다. interval은 `start_utc`, `end_utc`, `peak_utc`, `max_elevation_deg`, `start_clipped`, `end_clipped`을 제공한다. contact는 `utc`, `duration_seconds=0`이다. 오류의 상세 wire 형식은 T021에서 정의하며 여기서는 존재 여부와 오류 구간 연결 금지를 검증한다.

고도각이 임계값 이상인 양의 시간 구간을 반환한다. 동일 임계값의 평탄한 전구간은 interval이며, 고립된 접점은 duration 0의 별도 contact다. 잘림 flag는 조회 범위 경계에 해당한다. 실패한 계산 시각을 넘어 가시 구간을 이어 붙이지 않는다. status는 유효 결과 complete, 성공했으나 구간/접점 없음 none, 일부 계산 실패 partial, 전부 실패 error로 구분한다. 혼합 자료 hash, 잘못된 UTC/행수/비유한 성공값은 정상 또는 없음으로 위장하지 않는다.

## 시험 범위와 참값

35개 시험을 수집했다. 0.2초 pass와 gap, 정수/분수 시각 접점, 평탄한 임계값, 범위 잘림, 없음, 6개 pass 모두 반환, 임계값 0/10/90 및 잘못된 값, 잘못된 조회 범위, 부분/전체 실패, immutable 결과, 자료 hash 변화, 잘못된 계산 행, 윤초 SI 시간, 실제 ISS 하루 기준과 극히 짧은 pass를 포함한다.

고정 역사 ISS와 제주 가상 지점의 기존 Rust 제품 전파와 Python 좌표/고도각으로 86401개 시각을 계산했다. 10도 기준 교차 8개의 1초 bracket을 확인하고 `data/workspace/validation/v6_migration/t019_dense_reference.json`에 저장했다. 후속 제품 search 비교는 시험 전용 bisection으로 얻은 경계와 1초 이내 일치를 요구한다. 합성 pass/gap과 접점은 0.01초 이내를 요구한다. 실제 좁은 pass는 고립 peak 근처에서 peak-0.000001도 임계값을 사용한다.

매끄러운 고립 극값이 샘플 bracket에서 분해 가능한 경우를 대상으로 한다. 임의 진동 함수의 모든 극값이나 모든 위성의 가시 구간 탐지를 보장하지 않는다. 1초 조밀 기준 자체도 더 짧은 pass를 모두 발견하지 못하므로 해석 가능한 합성 함수와 실제 peak 주변 시험을 별도로 둔다. 같은 전파/좌표 kernel을 공유하는 수용 시험이며 독립 이론 정확도, 실측 ISS 또는 실제 통신 성공의 증거가 아니다. F001 실제 통신 조건과 F002 전체 프로토타입 기능 연결은 미완료다.

## 실행

```powershell
project_support/.venv/Scripts/python.exe -m pytest -q project_support/tests/test_visibility.py -k dense_reference_preparation -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t019_oracle
project_support/.venv/Scripts/python.exe -m pytest -q -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t019_full --tb=no
node --test project_support/tests/browser/*.test.mjs
```

기준 자료 준비는 1 PASS(35.84초)다. 새 시험을 제외한 기존 Python 회귀는 122 PASS(11.17초), 기존 Starlette 경고1이며 Node31 PASS다. 전체 Python 실행은 123 PASS / 34 ERROR(47.26초)로, 오류 34개는 모두 아직 없는 visibility 모듈을 불러오는 fixture에서 발생했다. 제품 search의 미구현 RED를 skip/xfail로 숨기지 않는다. 전체 시험 PASS나 가시 구간 기능 완료로 기록하지 않는다. T020과 함께 리뷰하고 구현 후 모든 assertion을 재실행한다.
