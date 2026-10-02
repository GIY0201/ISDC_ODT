# T018 UTC 재생 연결 검증

2026-10-02. T017의 시험 준비 이후 실제 구현. 원본 V6, legacy 콘솔/API, Rust 전파, Python 좌표/고도각과 runtime 소유권은 유지했다.

## 구현

- orbit_playback.js: UTC 투영, 1초 이내 valid 행의 선형 위치/고도각 보간, 이진 검색용 버퍼. 외삽/오류/NaN/역순·중복/과도한 간격 거절.
- orbit_utc.js: 같은 고정 윤초 해시의 1972년 이후 TAI-UTC 표, BigInt ns 연산. 나노초와 실제 양의 윤초 보존. Python snapshot과 표/해시 대조 시험.
- orbit_selection.js: 최신 서버 UTC 기반 재생/정지/속도 및 지정 UTC 명령, 수신 단조 시각, 기존 버퍼를 유지하는 background prefetch, 정지 이후 늦은 응답 폐기. EOP/leap/frame/profile 추가 대조.
- workspace_playback.js: 문서당 한 프레임 수명, 최대 601행 1초 batch, 300초 전 다음 범위 요청 및 5초 서버 재동기화. 실제 계산/HTTP는 매 frame 수행하지 않는다.
- workspace_orbit/globe: 제어 버튼, UTC/고도각 표시와 공용 지구 연결. draft UTC 입력 보존, 결과는 앞 3행만 미리보기. 같은 Viewer/entity를 재사용한다.

## 시험 우선 및 자동 검증

새 control/prefetch/UTC codec/lifecycle 시험의 미구현 실패를 먼저 확인했다. provenance 불일치 응답을 정상 채택하는 회귀도 먼저 실패시킨 뒤 수정했다. T017의 미구현 RED는 이제 실제 assertion PASS다.

```powershell
node --test project_support/tests/browser/*.test.mjs
project_support/.venv/Scripts/python.exe -m pytest -q -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t018_pytest
git diff --check
```

Node 31 PASS: 이전 19개, T017 4개, UTC codec 2개, 제어/프리페치/늦은 응답/자료 계약 4개, 프레임 수명/버퍼 처리 2개. 601행 정상 버퍼에서 반복 프레임 동안 쿼리 0개, 빈 버퍼에서는 제한된 요청 1개를 확인한다. Python 122 PASS/기존 Starlette 경고1: T017 수치 fixture와 브라우저 윤초 표/해시 대조 포함. 라이브 게임 프레임 성능 벤치마크는 아니다.

T017의 ISS/제주 유한 fixture 최대 오차는 위치 1.000891m/고도각0.004974918도였다. 60초 간격은 승인하지 않으며 다른 위성/관측점의 일반 오차 보장을 주장하지 않는다.

## 실제 브라우저

IAB localhost:8876 stored profile, 현행 단일 viewport에서 확인했다.

1. 정지 epoch: `2020-07-12T21:16:01.000416000Z`, ITRF `[6202527.70, -2633530.38, 881293.80] m`, 고도각 `-64.0107°`.
2. 1배 재생 revision5: UTC/위치/고도각 지속 갱신, 601행 버퍼 표시. 정지 revision6의 `21:17:38.224439800Z` 이후 시각 유지. 새 문서에서도 서버 정지 UTC 유지.
3. epoch 복귀 revision7: 같은 최초 좌표/고도각 재현. 발견한 정지 패널의 고도각 placeholder를 수정하고 실제 패널/지구 값 일치를 재확인했다.
4. 60배 재생 revision9: 표시 UTC가 23:01 시각까지 진행했고, 처음 21:16 시작 버퍼에서 이후 22:55 시작 601행 버퍼로 넘어갔다. 위치 계속 표시, canvas 1개. 단일 연속 관찰이며 60fps 또는 지연 목표 측정은 아니다.
5. 지정 `21:17:01.000416000Z` 적용 revision11: `[6247087.17, -2371991.85, 1234588.49] m`, `-62.0765°`로 T015/T016 기준과 일치.
6. `2100-01-01` 요청: EOP snapshot 범위 밖 오류와 data-orbit-visible=false 확인. epoch 복귀 revision13에서 정상 회복, 좌표/UTC/고도각과 canvas 1개 확인. 브라우저는 정지 epoch로 남겼다.
7. 검증 화면: ignore된 data/workspace/validation/v6_migration/t018_controls.png.

## 진행 경계

T001~T018 구현·검증 완료, 외부 PR 리뷰와 main 병합은 별도다. 이 PR은 시험 준비 draft PR #4에 의존한다. #4는 T018 없이 독립 병합하면 Node 시험이 RED이므로, 리뷰 후 구현과 시험을 함께 반영해야 한다. 자동 병합하지 않는다.

가시 구간(T019~T023), workspace/동시성/다중창(T024~T031), 게임 성능(T028), 실제 통신 조건 확인/적용(F001), 전체 프로토타입 기능 이식(F002)은 유지한다. 과거 ISS GP/제주 가상/기하 계산을 실측이나 실제 통신 성공으로 표현하지 않는다.
