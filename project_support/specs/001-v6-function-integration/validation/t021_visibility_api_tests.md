# T021 가시 구간 API 시험 준비

PR #6(T019/T020)의 게시 상태 open/미병합을 확인한 뒤 `codex/v6-visibility-api-tests`에서 HTTP 수용 시험을 작성했다. 제품 endpoint/runtime/schema/UI는 변경하지 않았다. T022 구현과 함께 리뷰할 시험 준비분이며 독립 병합 대상으로 게시하지 않는다.

`project_support/tests/test_visibility_api.py`는 실제 FastAPI 앱, selection API와 T020 search를 연결하는 수용 시험이다. 정상/합성/실패 사례에서만 기존 `orbit_calculator` 주입점의 전파·고도각 평가를 대체한다. search나 route를 mock하지 않는다. 별도 native/EOP 시험은 설치된 제품 wheel 및 고정 snapshot을 사용한다. 두 번째 입력 ID는 같은 궤도의 별도 metadata context로, 두 번째 실제 위성을 의미하지 않는다.

## 42개 시험

- selection/현재 UTC의 독립 준비 시험1개.
- 정상 interval/잘림/peak/조회 범위/출처/hash/request ID/revision/단위/통신 unknown과 현재 선택·정지 UTC 보존.
- 없음/부분/전체 실패, 실패 시각을 넘어 구간을 잇지 않음, duration0 접점과 임계 고도각.
- 형식/NaN/Inf/bool/빈 ID/추가 필드/UTC/시각 범위/좌표/virtual/WGS84 검증19개, 잘못된 요청422 및 계산 호출 전 거절.
- revision/다른 input/다른 지점·높이/다른 임계값 충돌5개,409와 최신 state 및 계산 호출 전 거절.
- 선택 없음409, 알 수 없는 입력404, 큐/native/계산 준비 오류503, EOP범위 오류422.
- 윤초를 포함하는3 SI초,0.5초 및 정확한24시간 허용,0/90도 임계값이 현재 선택과 일치하는 정상 요청.
- 실제 고정 ISS/가상 제주 first pass를 포함한400초 범위의 native→geometry→search→HTTP 응답 수용 시험.

## T022에서 실행할 wire 계약

기존 `contracts/orbit_api.md`와 T020 immutable typed 결과를 재사용한다. 응답은 query_start_utc/query_end_utc/minimum_elevation_deg/intervals/contacts/status/errors와 client_request_id/revision/input_id/input_hash/EOP·leap hash/frame/profile/units/stale/communication_status를 제공한다. 접점의 elevation_deg는 `data-model.md`의 요구를 따라 최소 고도각으로 표시한다. interval은 start/end/peak UTC, max_elevation_deg, start_clipped/end_clipped다. errors는 UTC/error_code를 제공한다.

422는 잘못된 wire/range/EOP,404는 존재하지 않는 저장 입력,409는 현재 선택과 불일치하는 유효 context,503은 계산 준비 또는 과부하 오류다. 성공했으나 없음은200/none, 전체 행 실패는200/error, 일부 실패는200/partial이다. 모든 계산 결과에서 communication_status=unknown을 유지한다. 이는 RF 링크 조건 충족 또는 실제 수신을 의미하지 않는다.

42개를 수집했다. endpoint 구현 전에는 selection 준비1개만 통과하고 새 POST 요청은405 Method Not Allowed로 실패할 것으로 예상했다. 실제41 FAIL 중40개는 앱의 기존 catch-all GET 경로 때문에 미구현 POST가405로 응답한 것이고,1개는 시험 도우미의 input_id 인자 중복 TypeError였다. 당시41개 모두405로 설명한 부분은 T022에서 정정하고 도우미를 수정했다. 실패를 skip/xfail이나 mock 응답으로 숨기지 않았다. HTTP 상태 이후 의미 검증은 T022 전까지 실행되지 않았으며, 이후 실제 assertion42개 PASS는 validation/t022_visibility_api.md에서 구분한다.

## 재현

```powershell
project_support/.venv/Scripts/python.exe -m pytest -q -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t021_full --tb=no
node --test project_support/tests/browser/*.test.mjs
```

T021 당시 전체 Python은 기존160개와 selection 준비1개가 통과한161 PASS/41 FAIL, 기존 Starlette 경고1(101.42초)였다. 실패40개는 미구현405,1개는 도우미 인자 중복이다. pytest lastfailed에도 새 visibility API41개만 남고 다른 실패는0임을 확인했다. Node31 PASS(189.45ms)다. 당시 제품 구현은 T020까지였다. T022 API 조립 이후의 결과는 별도 기록하며, T023 화면 연결, T028 게임 성능, 다중창, F001 실제 통신 조건 및 F002 전체 기능은 계속 남아 있다. T021은 화면 코드가 바뀌지 않아 브라우저 시연을 새로 수행하지 않았다.
