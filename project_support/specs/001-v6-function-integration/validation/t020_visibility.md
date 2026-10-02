# T020 기하학적 가시 구간 계산

T019의 주입 함수/immutable 결과 계약을 `digital_twin/simulation/visibility.py`와 `digital_twin/contracts/orbit.py`에 구현했다. API/runtime 조립과 UI는 이번 범위 밖이다. 기존 SIM/legacy45초/5도/3개 제한 경로를 변경하거나 재사용하지 않는다. ADR0003을 따른다.

1초 SI grid, 매끄러운 고립 극값 보완과 bisection 경계 보정으로 지원 조회 범위의 모든 구간을 반환한다. 임계값은0~90도, 범위는0초 초과~24시간 이하이며 윤초를 SI 시간으로 처리한다. 실패 평가를 넘어 구간을 연결하지 않고 partial/error와 none을 구분한다. 출처/EOP/leap hash/frame/profile/행수/UTC/비유한 행 계약을 검증한다. runtime 현재 상태를 수정하지 않는다.

## 발견과 수정

- 첫 구현의 합성 시험: 28 PASS/1 FAIL. 정수 시각 접점에서 42ns zero-only 군집이 interval로 잡혔다. 고립된 수치 zero 군집은 contact로 분리하여 다시29 PASS를 확인했다.
- T019 이후 조회 시작/끝에 가까운0.2초 pass 시험2개를 추가했다. 시작 직후 pass 누락1 FAIL을 먼저 확인하고 첫/마지막cell 극값 보완으로 수정했다.
- 한cell의 두 endpoint가 정확히 같은 경우에도 내부 peak가 있을 수 있다. 해당 시험을 추가하여 누락1 FAIL을 먼저 확인했다. endpoint가 같다는 이유만으로 탐색하지 않던 조건을 제거하고 실제 내부 평가값도 확인하도록 수정했다.
- 추가3개를 포함한 합성/계약 시험32 PASS. 초기 전체157 PASS, edge 보정 전체159 PASS는 중간 결과이며 최종 전체 실행과 구분한다.

## 수치 수용 범위

고정 역사 ISS2020-07-12/가상 제주의 하루86401시각 기준, 임계값0/10/30/90도에서 교차 개수와 경계1초 게이트를 검증한다. 10도 기준8개 교차이며 실제 isolated peak 주변의1초 미만 pass도 탐지한다. 합성0.2초 pass/gap과 접점은0.01초 이내, 계산 interval peak의 고도각은 재계산 참값과0.01도 이내를 요구한다.

같은 Rust/좌표 kernel을 공유하므로 독립 물리 정확도 또는 실제 수신 증거가 아니다. 임의 고주파 함수나 bracket에서 분해 불가능한 다중 극값 및 수치 허용치보다 작은 구조의 완전 탐지를 보장하지 않는다. 오류 주변의 부분 interval 경계 정확도/완전성은 주장하지 않는다. 시험용 immutable dense fixture 재사용은 제품 성능 증거가 아니다. 하루1초/게임UI 성능 목표는T028에서 실제 조립 경로로 측정한다.

## 재현 명령

```powershell
project_support/.venv/Scripts/python.exe -m pytest -q -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t020_complete --tb=short
node --test project_support/tests/browser/*.test.mjs
```

최종 전체 Python160 PASS/기존 Starlette 경고1(97.19초), Node31 PASS(185.56ms)다. 가시 구간38개 시험의 모든 assertion이 실제 실행됐다. 계층/기존 API/원본 V6 해시 회귀를 포함한다. 실제 통신 조건 F001, 전체 기능 연결 F002, API T021/T022 및 UI T023은 계속 미완료다. 이번에는 화면 코드가 바뀌지 않아 새 화면 검증을 수행하지 않았다.
