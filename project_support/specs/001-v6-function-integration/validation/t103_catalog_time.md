# T103 카탈로그 시간 탐색·관측 검증

2026-10-05, US14 FR022/SC020, T099–T103. 선배 카탈로그/지상국 선택을 기존 Rust SGP4·EOP 변환·UTC codec·sample buffer와 V6 공용 지구에 연결했다. 기존 position API, 저장 GP 상태와 SIM 명령 의미는 유지했다. 새 wire 계약은 ADR0013과 contracts/catalog_samples.md.

## 자동 시험

- RED: observation helper 미구현 collection error와 samples endpoint 누락 13 FAIL을 확인했다. 이후 신규 native/API/geometry 및 기존 position 시험 21 PASS.
- `project_support/.venv/Scripts/python.exe -m pytest project_support/tests -q --basetemp=data/workspace/validation/ground_stations/pytest_t103`: 399 PASS, 145.73초, 경고5개. 기존 Starlette 경고와 의도적으로 2100년 범위 밖을 넣는 ERFA 경고 포함. 실제 Rust 전파/epoch 동등성, ENU 방향·천정·거리, 601 제한·윤초·부분실패·GP변경409·미제공503·스키마422 및 상태 불변을 검증했다.
- `node --test project_support/tests/browser/*.test.mjs`: 최종190 PASS, 751.8215ms. 중간188 PASS 뒤 prefetch 중복 방지·겹친 표본 갱신·seek 후 늦은 응답 폐기·배속 시각 연속성·배경 실패 정지 시험2개를 추가했다. 실제 모듈 조립 시험은 두 해상도에서 대표 좌표와 사용자 높이 전달/저장 상태·명령0/창 복원/Viewer1/정리를 검증한다. VM은 수치 native 증거와 구분한다.

## 실제 8891 화면과 HTTP

IAB1280×720/1920×1080. ISS25544(active cache), epoch2026-10-04T12:43:41.833920000Z, 대전36.3742/127.3567, 사용자 가정 높이123.45m, 최소각5°.

- epoch 거리12076.412780km/고도각-65.492439°/방위각46.918878°. 최소각 미충족, 실제 통신 미확인 표시.
- 60배 재생과 겹친 표본 갱신 후12:55:25.819920001Z에서 정지. 보간 위치 시각과 native 관측 수치12:55:24.833920000Z 구분 확인.
- 1920 지정 UTC12:45:00Z 거리11997.244190km/고도각-64.600805°/방위각40.846406° 확인.
- 2100 UTC EOP 범위 밖 오류, 최소각91° 오류, epoch 정상 복구. 1280 창 최소화·복원 후 높이·결과 유지.
- 두 해상도 canvas1, document scrollWidth==clientWidth, 확인 시 console warn/error0. 원본 epoch 설명은 현재 재생 위치와 혼동하지 않도록 ‘선택 GP 기준 위치’로 보완했고 높이는 실제 확인값이 아닌 사용자 가정으로 명시했다.
- 실제 `/api/catalog/position`과601개 samples 첫 위치 exact 동일(0m 차이). 저장 selection revision/input/hash/ground/mask/UTC/playing/rate는 t103_ui_before와 동일. 실행 증거 t103_live_evidence.json과 화면 PNG는 ignored data/workspace에 보존한다.

새 API 반영을 위해 소유 확인된 기존8891 uvicorn PID12820만 재시작했다. 실행 중 SIM의 메모리는 초기화되며 이전 bootstrap/report snapshot을 로컬 보존했다. 저장 GP 선택은 기존 PUT로 명시 복구 후 readonly baseline을 잡았다. 복구 helper의 첫 POST405 및 확인 helper의 잘못된 GET selection HTML/JSON decode 실패는 경로·method를 정정 후 성공했다. 이 실패를 제품 API 실패나 전체 이력 영구 저장 성공으로 해석하지 않는다. 포트0.0.0.0:8891 유지.

## 완료 경계

이 단위의 시간 탐색·관측·재생 연결을 검증했다. 실제 수신·시설 좌표/높이·장비·RF 조건 검증은 아니다. T075는 다중 위성·3D 모델·태양 등 원본 표시 기능이 남아 partial이며 T076–T084와 F001/F004–6/T032/다운로드 디스크 확인도 유지한다. 전체 목표는 active. Draft PR 리뷰로 전달하고 자동 병합하지 않는다.
