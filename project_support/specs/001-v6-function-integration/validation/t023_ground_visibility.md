# T023 가상 지점 및 가시 구간 화면

2026-10-03. US2 화면 연결 증거이며 전체 선배 기능 및 실제 통신 완료가 아니다.

## 구현 및 경계

`scripts/tabs/ground_visibility.js`에 가상 WGS84 위도/경도/타원체 높이, 최소 고도각, UTC 범위와 모든 구간·접점·잘림·없음·부분/전체 실패 표시를 연결했다. 설정은 기존 `orbit_selection.js`의 직렬 명령과 fresh 서버 UTC를 사용해 적용·정지한다. 조회는 browser API POST이며 위치 버퍼와 별도 표시 사본이다. 권위 상태/시계와 계산식/API 의미를 바꾸지 않았다.

request ID/revision/input ID/hash/EOP/leap/frame/profile/지점/임계값/조회 범위/통신unknown을 비교한다. 설정 변경·취소·역순 응답은 이전 결과를 복원하지 않는다. 실제 통신 미확인을 표시한다. 실제 GP용 `orbit_globe.js`/`workspace_globe.js`에서 가상 지점 마커를 추가하고 문서당 Viewer 하나를 유지한다. 위치 행이 없으면 위성 마커만 지운다. legacy 합성 `globe.js`와 원본 V6 및 다른 고정 예시 카드는 보존한다.

## 시험 우선 및 자동 검증

- 새 ground_visibility 시험은 모듈 없음 RED, POST/setGround/지점 마커 시험은 missing method RED 확인 후 구현.
- 새로고침에서 비동기 서버 높이500m가 기본0m로 남는 문제를 발견. `0 != 500` 회귀시험 RED 후 서버 설정 반영 및 편집 draft 보존 수정.
- `node --test project_support/tests/browser/*.test.mjs`: 최종40 PASS/0 FAIL,191.04ms. 기존31개+새9개. 늦은 응답/13개 context 필드/취소/표시 구분/설정UTC/단일Viewer/비동기 설정 포함. DOM stub과 실제 브라우저 증거를 구분한다.
- `project_support/.venv/Scripts/python -m pytest -q --tb=short`: 202 PASS/2 warnings,104.09초. 기존 Starlette deprecation과 pytest cache 생성 경고. 첫 제한 환경 실행은 임시폴더 setup 접근 오류로110 PASS/92 ERROR. 승인된 제한 밖에서 같은 시험을 통과했다. skip/xfail 없음. API/계층/V6 원본 해시 회귀 유지.
- `git diff --check`: PASS.

## 실제 브라우저

독립 localhost8877 `create_stored_orbit_app`와 IAB에서 수행. 이전8876 서버는 재시작하지 않았다.

1. 제주33.4996N/126.5312E,높이0m,10도,역사ISS TLE: 2020-07-12T21:47:41.000416000Z~21:54:21.000416000Z 조회. 시작21:48:30.973072250Z/종료21:52:53.129322250Z/peak21:50:42.222365916Z/16.3497도. T022 HTTP 증거와 일치. 파생 OMM도 같은 구간과 peak 확인.
2. 같은400초 범위20도: 없음/0구간/0접점. 높이500m/10도로 구간 내부100초 조회: 양끝 잘림/peak16.3260도.
3. 종료가 시작보다 빠른 입력: 안내/이전결과 제거. 2100년: EOP 자료범위 밖 오류, 정상 빈 결과로 위장하지 않음. 입력 변경 후 복구.
4. 35N/127E/높이100m/최소0도 적용 후 새로고침: 네 서버 설정 복구. 이후 제주/높이0/10도 복귀.
5. 24h조회 취소/새조회, 계산 중 운용자 목록으로 satellite/ground 왕복: 입력 유지/완료 후 모든 구간 표시. 취소된 응답은 복원되지 않음. 실행 중 native 즉시중단 보장은 아님.
6. epoch2020-07-12T21:16:01.000416000Z부터24h: 4구간/0접점, 최대각16.3497/68.6805/21.5401/30.4774도. 처음3개로 자르지 않음.
7. 1280x720/1920x1080 입력/결과 표와 확장 작업창 확인. 공용 globe canvas1개, 확인한 browser error log0. `data/workspace/validation/ground_visibility/t023_1920.png`, `t023_1280.png`, `t023_1280_results.png`에 화면 저장. 전체 창 수명/다중창 검증은 T024~T031이다.

## 미완료

하루 조회의 긴 대기가 관찰됐다. 하루 결과1초/게임fps/50ms피드백 목표 통과를 주장하지 않는다. T028에서 trace/p95/p99/max 계측 및 개선이 필요하다. 접점/부분 실패 표시는 함수시험이고 이번 실제 ISS 시연에서는 발생하지 않았다. 계산 탐지/정확도 한계는 T020/ADR0003 그대로다. F001 실제 통신 조건 조사·적용, F002 선배 전체 기능, 배포/다중창/동시성은 유지한다. PR 게시와 리뷰/병합은 별개다.
