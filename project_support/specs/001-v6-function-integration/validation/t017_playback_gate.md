# T017 UTC 재생 시험과 보간 수치 게이트

2026-10-02. 이 단계는 시험 작성이며 재생 기능 구현은 T018이다. 공용 지구는 T016의 정지 UTC 표시 상태를 유지한다.

## 수치 검증

고정 ISS TLE(2020-07-12 epoch), Rust WGS72/AFSPC, 보존 IERS/EOP 및 윤초 hash, 제주 가상 WGS84 높이 0m를 사용했다. 테스트는 분수 시각에서 Rust를 새로 전파한 ITRF/고도각을 참값으로 삼는다. 보간 결과를 다시 참값으로 삼지 않는다.

- 1초 간격 1,223개 구간, 각 구간의 0/0.25/0.5/0.75/1초를 비교했다. epoch부터 10분, 첫 24시간의 10분 간격 검색에서 가장 높은 고도각 주변 10분, 추가 시간별 구간을 포함한다.
- 위치 최대 오차 **1.000891 m**, 고도각 최대 오차 **0.004974918°**. 게이트 10m/0.01° 통과.
- 60초 간격의 midpoint는 위치 오차가 10m를 넘는 것을 별도 시험으로 확인했다. T015의 60초 3행을 재생 버퍼로 그대로 채택하지 않는다.
- 이는 유한한 과거 ISS/제주 fixture 검증이다. 다른 위성·지점·자료 시기 전체에 대한 오차 보장이 아니다. 0.1~60배 재생은 표시 시계 배율이며 샘플 간격을 늘려도 된다는 의미가 아니다. 프레임 지연/프리페치 지속성과 게임 성능은 T018 및 후속 측정 대상이다.

## 브라우저 시험 계약과 예상된 실패

`orbit_playback.test.mjs`는 아래를 고정했다.

1. 정지 상태는 서버 UTC 그대로 유지하고 이전 UTC로 복귀 가능.
2. 서버 snapshot 수신 시각을 기준으로 단조 증가 시간과 속도만 표시 투영. snapshot 수정 없음. 역행 단조 시간은 0 경과로 처리.
3. 1초 이내 valid 행만 선형 보간, 입력 버퍼 수정 없음.
4. 빈 버퍼/범위 밖/오류 행/NaN/역순·중복 시각/1초 초과 간격은 null. 외삽 또는 합성 좌표 없음.

T018이 구현할 `projectUtc(snapshot, receivedAtMs, nowMs, advanceUtc)`와 `interpolateSample(rows, utc, secondsBetween)`를 대상으로 한다. UTC 연산은 주입하는 별도 변환 함수의 책임이며 Date.parse만으로 윤초/나노초를 버리는 구현을 채택하지 않는다. T018에서 실제 UTC codec, 서버 명령/응답, 프리페치, UI 연결과 이 시험의 각 assertion을 통과시켜야 한다.

실행: `node --test project_support/tests/browser/orbit_playback.test.mjs` → 모듈 미구현 `ERR_MODULE_NOT_FOUND`, exit 1. 예상된 RED를 확인했으며 개별 assertion PASS 또는 실제 재생 시연으로 기록하지 않는다. 따라서 이 시험 준비 PR은 draft이고 병합 대상이 아니다. 전체 Node wildcard 실행도 T018 전까지 RED다.

수치 실행: `python -m pytest project_support/tests/test_orbit_interpolation.py -q` → 2 PASS. 측정 원본은 ignore된 `data/workspace/validation/v6_migration/t017_interpolation.json`이다. 기존 Python/Node 회귀 결과는 개발 로그에 별도 기록한다.

다음 T018: 1초 간격 batch와 UTC codec를 검증해 위 시험을 통과시키고 정지/재생/이전 시각 복귀를 실제 브라우저로 확인한다. 매 frame HTTP 호출은 허용하지 않는다. F001 실제 통신 조건 확인/적용, F002 전체 프로토타입 이식 요구는 계속 유지한다.
