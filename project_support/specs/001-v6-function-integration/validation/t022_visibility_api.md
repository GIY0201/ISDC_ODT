# T022 서버 가시 구간 조회 연결

VisibilityRequest, OrbitRuntime.visibility, OrbitVisibilityQueryResult와 POST `/api/orbit/visibility`를 구현했다. 기존 계산 함수와 bounded executor를 재사용하고 selection/state/samples/legacy/API/WS를 보존한다. ADR0004가 공개 계약 추가의 근거다. T023 화면 연결은 이번 범위 밖이다.

## 구현 검증

T021 API42개가 실제 assertion 실행으로 모두 통과했다(4.30초/기존 Starlette 경고1). 조회 형식/범위/임계값/선택 context를 먼저 검증하고, 잘못된 요청과 충돌은 계산 전 거절한다. 구간/접점/오류/출처/hash/단위/stale/unknown 통신을 반환하며 현재 선택과 정지UTC가 유지됨을 확인했다.0.5초/정확한24h/윤초3SI초와 실제native/EOP/geometry 경로도 포함한다.

T021의 실패 원인 기록을 정정한다.41개 모두405라고 설명했으나 실제40개는 미구현 경로405,1개는 시험 도우미 query에 input_id를 위치/키워드로 중복 전달한 TypeError였다. 인자 이름을 selected_input_id로 수정한 뒤 다른 유효 input의409 검사까지 실제로 실행됐다. 구현의첫 API 실행은41 PASS/도우미오류1 FAIL, 수정후42 PASS다. 수용 조건을 완화하지 않았다.

첫 전체 실행은201 PASS/1 FAIL이었다. 기존 OpenAPI 호환성 시험의 새 prefix 허용 목록이 inputs/state/selection/samples까지만 있어서 visibility 추가를 거절한 것이다. 승인된 새 경로와 VisibilityRequest만 명시적으로 더했고 원본 fixture 및 기존 경로/schema exact 비교는 유지했다. 해당 호환성시험1 PASS로 재검증했다. 최종 전체Python202 PASS/기존Starlette경고1(101.33초), Node31 PASS(180.07ms)다. 추가API42개를 포함한 모든 assertion이 실행됐으며, 기존API/WS/계층/원본V6 회귀도 포함한다.

## 실제 localhost TCP HTTP

`project_support/tooling/validate_orbit_http.py`를 실행했다. 임의의 빈 localhost port에 자신의 uvicorn 서버만 시작·종료했고 기존8876 화면 서버는 재시작하지 않았다. 실제 저장TLE/OMM2개 목록,selection,samples3행,400초visibility 및409오류와health를 요청했다.

| 항목 | 실제 응답 |
|---|---|
| status/구간 수 | complete/1 |
| 시작UTC | 2020-07-12T21:48:30.973072250Z |
| 종료UTC | 2020-07-12T21:52:53.129322250Z |
| peakUTC | 2020-07-12T21:50:42.222365916Z |
| 최대기하고도각 | 16.34968415627627도 |
| clipped/stale | false/false |
| 잘못된revision |409/revision_conflict |
| 현재선택/정지UTC | 유지 |
| 통신 상태 | unknown |

원시 JSON/서버 로그는 `data/workspace/validation/orbit_api/live_http.json`, `live_server.log`다. TCP 실행 증거이며 새 UI 표시 검증이 아니다. 역사 ISS/제주 가상 지점의 기하 계산이며 실측 또는 실제 통신 성공이 아니다. 하루1초/게임UX/동시성/다른PC 배포/F001/F002는 아직 미완료다.
