# T110 / US15 전체 카탈로그 표시 검증

FR023/SC021에 따라 목록 페이지와 독립된 전체 카탈로그를 Rust SGP4와 명시 IERS-A로 계산해 V6 공용 지구에 연결했다. T104–T109 구현 및 시험 근거는 t105_catalog_native.md, t107_catalog_scene_api.md, t109_catalog_scene_ui.md에 있다. 응답 준비와 renderer 보완은 t110_response_preparation.md, t110_renderer_styles.md에 기록했다. 이번 문서는 해당 묶음의 검증을 종합하며 T075–T084 전체 완료를 주장하지 않는다. Draft 게시 확인은 ledger 후속 항목에 기록한다.

## 요구별 근거

| 요구 | 근거 |
|---|---|
| 전체 조회,100개 페이지 제한 없음 | 실제 active16633/ISS13/GEO588/빈0, 기존 catalog limit0와 전체 ID/순서 대조; test_catalog_scene.py와 browser/catalog_scene.test.mjs |
| 모든 점에 같은 UTC/출처, 실패 위치 없음 | domain partial GP/native/null/count 및 provenance 회귀; browser 잘못된 응답·마지막행오류·준비중취소 회귀 |
| 단일/다중 정밀 결과 일치 | 동일 GP epoch의 scalar와 scene ITRF 1e-8m 비교(test_full_scene_no_page_limit_matches_selected_scalar_and_owns_response); Rust official33/668 및 manyOMM 동일668 검증 |
| GP/조건/UTC 변경과 늦은 결과 차단 | 준비 cache/hash conflict409/API422 및 controller cancel/context/generation/latestUTC/초당요청 회귀 |
| 같은 위성 선택/창 복원/단일 지구 | 실제 두 해상도16633, 표 밖 NORAD53130 mouse pick/GP pin/선택 UTC/최소화 복원; assembly 및 primitive/pick 회귀 |
| 저장GP/UTC/SIM 분리 | readonly HTTP 회귀/실제 post-UI input/anchorUTC/ground/mask/paused/rate 대조, no runtime commands assembly assertion |
| 성능 근거 구분 | 단계별 프로파일/HTTP/JSON/응답 준비 wall/최장 slice/renderer callback 별도, 실제 presentation/frame 기준 미확인 유지 |

최종 전체 Python418 PASS/경고5/170.42초 및 Node210 PASS/실패0/974.953ms. 기존 Starlette 및 의도적2100년 ERFA 경고는 보존했다. 초기 실패와 보완 내역은 각 단계 보고서에 남아 있다. Rust 제품0.2.0 공식 검증/clean install은 T105 근거이고 이후 native 소스는 변경하지 않았다. 실제0.0.0.0:8891 두 해상도에서 canvas1/console오류0. 브라우저가 ITRF 위치를 합성하거나 SGP4를 다시 계산하지 않는다.

## 분리한 단계 측정

기존 8891 API에서 전체 GP를 읽어 사본을 만들고, 같은 제품 CatalogGeometryQuery/native/EOP 경로를 별도 프로세스에서 실행했다. 함수별 timer wrapper만 적용했으며 운영 서버를 계측하거나 변경하지 않았다. 한 번씩 관측한 시간으로 p95/최대 시간 보장이 아니다. 원자료 `data/workspace/validation/ground_stations/t110_profile.json`, helper `t110_profile.py`.

| 단계 | 최초 cold | 준비 재사용 warm |
|---|---:|---:|
| 전체 query |9.3884s|0.3882s|
| GP 검증/load |7.0711s|0s|
| native 입력 준비 |1.7934s|0s|
| Rust 다중 전파 adapter |0.0318s|0.0325s|
| 공유 UTC/EOP TEME→ITRF |0.0021s|0.0007s|
| 기타(사본/hash/EOP/결과조립 포함) |0.4899s|0.3550s|
| compact UTF-8 JSON encode |0.0535s|0.0530s|

Compact JSON bytes 5,168,774(약5.17MB, 압축 전/해당requestid). 저장한 pretty JSON 파일의 크기는 HTTP 전송량으로 해석하지 않는다. 실제 HTTP는 다른 측정에서 최초9.7009–11.2871초, 반복0.4978–0.8222초였다. 자료 fetch/캐시/JIT/계측 조건이 달라 서로 같은 표본으로 합산하지 않는다.

1280×720 마지막 화면: 최초 renderer36.6ms, 반복23.3ms; 준비 최장 slice10.5/11.2ms. 1920×1080 반복 renderer16.4ms, 최장 slice4.2ms. 총 준비 wall93.8–157.4ms는 task 양보 시간을 포함한다. 실제 presentation/frame p95나 재생·조작 수용 기준을 대신하지 않는다. 오래된 GP의 원본72h opacity 규칙도 반복 UTC에서 갱신한다.

## 완료 경계와 남음

US15 전체 조회·주입·선택 연결의 기능 검증을 마쳤다. 성능 목표 달성은 미확인/미달 부분이 있으며 T032/SC006 추적을 유지한다. 최종 Draft는 PR28 위에 게시하고 자동 병합하지 않는다. T075 원본 궤적/패스/태양/일조/2D·3D/지도·명암/레이블/대표SVG, T076–T084 및 F001/F004–6/실제 다운로드 저장 확인은 계속 남는다. 이후 구현은 이 전체 범위를 유지한다.
