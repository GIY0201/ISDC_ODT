# T106–T107 전체 카탈로그 계산과 API 검증

2026-10-05. US15 FR023/SC021의 서버 계산과 외부 계약까지 완료했다. V6 전체 위성 표시, 선택 인계, 실제 화면 렌더링 수용시험은 T108–T110에 남는다. 전체 T075–T084 목표는 진행 중이다.

## 구현과 회귀

선배 Catalog.get_satellites의 limit=0 전체 필터 조회를 재사용한다. 불변 GP payload와 파싱한 epoch를 내용 hash별로 준비하고 최대 두 snapshot만 보존한다. 현재 위치나 runtime 상태를 캐시에 복제하지 않는다. 매 요청의 source, fetched_at, stale, warning은 새 조회에서 가져온다. 새로운 관측 UTC마다 기존 double-JD offset 규칙과 native0.2.0 manyOMM을 사용한다. native 호출은 최대50000행씩 나누며 전체 결과를 자르지 않는다. EOP 한 지점과 GMST82/polar rotation으로 성공 행만 ITRF m로 변환한다.

POST /api/catalog/scene은 strict group/query/orbit/UTC/requestid/선택적 scene hash 계약이다. 기존 경로와 schema는 그대로 유지한다. 개별 GP와 native 실패는 error/null 위치로 보존하며 중복 NORAD 번호나 불완전 snapshot은 거절한다. demo GP는 계산하지 않는다. 변경된 hash409, 준비 불가와 busy503, 잘못된 입력422를 구분한다. ADR0014와 contracts/catalog_scene.md 참조.

- RED adapter/공유UTC 변환3FAIL: 미구현 함수 import/AttributeError. 구현 후 기존 native/geometry를 포함25PASS1.98s.
- RED scene9FAIL: scene 함수 미구현. 구현 후 기존 selected position/samples/architecture 포함35PASS36.70s. 단일 계산과 위치1e-8m 이내 일치, 날짜가 다른 GP/역순/반복, bytes 소유권, 오류 alignment, 작은 chunk 경계, 손상 native 출력, epoch 재파싱 없음 검증.
- 16633행 시험용 역사 OMM fixture 전체 성공, EOP at 한 번, 카탈로그 페이지 제한 미적용. 실제 최신 카탈로그와 구분한다. 개별 손상/nonfinite/demo GP, 모든 행 실패, 빈 결과, 두 snapshot cache 한계, 새 source metadata, 변경GP409, 불완전/중복 snapshot 검증.
- RED HTTP405/브라우저 API 함수 없음 이후 route/adapter 구현. strict 입력, unknown/empty query, readonly runtime, hash409, demo/busy503, cancellation 전달 시험.
- 최초 전체 Python은416PASS/1FAIL163.03s: 새 경로가 기존 OpenAPI 추가 허용목록에 없었다. 승인된 새 path/schema만 명시적으로 추가하고 원본 baseline 전체 동일성 검사를 유지했다. 별도1PASS 후 전체 재실행.
- **최종 전체 Python417PASS165.14s/경고5**, 제품0.2.0 wheel을 설치 시험에 명시했다. 기존 Starlette 및 의도적2100년 EOP 범위 관련 ERFA 경고. 로그 data/workspace/validation/ground_stations/python_t107_final.txt. 최초 실패 로그도 보존.
- **전체 Node192PASS812.9899ms**. 로그 node_t107_all.txt. 새 화면 렌더링 시험의 증거는 아니다. Rust 소스/wheel 변경 없음; T105의 실제 제품 build/공식 검증 근거는 보존한다.

## 실제 고정8891 서버

이전 state/bootstrap/JSON report를 t107_before_restart.json에 보존했다. 확인된 PID2148의 정확한 프로젝트 uvicorn 명령만 종료하고 동일0.0.0.0:8891/동일factory로 Hidden 재시작했다. SIM 메모리 시간은 초기화됐으며 전체 운용 이력의 영구 보존을 주장하지 않는다. 저장 input/hash/UTC/ground/mask/paused/rate는 기존PUT로 복원했다. 이후 scene 조회와 필터/오류 요청은 해당 상태를 변경하지 않았다. 캡처 helper의 첫 report 경로는 HTML fallback이어서 JSON 해석에 실패했다. 실제 기존 /api/reports/snapshot.json 경로로 정정하고 캡처 완료 후에만 재시작했다.

실제 active source snapshot, UTC2026-10-05T03:03:33.000000000Z:

| 조회 | 전체 | 성공 | 실패 | HTTP 전체 시간 |
|---|---:|---:|---:|---:|
| 최초 cold |16633|16633|0|12.8084484s|
| 동일 snapshot 재사용 warm |16633|16633|0|0.8037933s|

단일 cold/warm 관측이며 p95나 안정적인 프레임 성능의 증거가 아니다. GP 준비, native 계산, 변환, JSON 전송과 파싱을 포함한 HTTP 시간이다. 서버 내부 각 단계/실제 Cesium render 시간은 T110에서 분리 측정한다. snapshot hash71506860ff0afc7ee7e7dffa933a82edd1294b1889af745b65409c17fcdcabfc. 원자료 t107_scene_cold.json/t107_scene_warm.json/t107_live_result.json.

실제 필터는 기존 /api/satellites limit0 응답의 순서와 모든 NORAD ID를 대조했다. ISS 검색13개, GEO588개, 없는 검색0개. expected hash 불일치409/UTC와 pagination 입력422 확인, t107_live_filters.json. 실제통신/수신/시설장비 검증을 의미하지 않는다.

## 다음 단계

T106–T107 완료. T104는 browser scene RED가 아직 남아 aggregate 미완료. T108–T110 controller/동일Viewer primitive/pick/전체원자료/두해상도/렌더성능/Draft PR 묶음 검증이 남는다. T075의 궤적·통과·태양·2D/3D·지도·대표SVG, T076–T084 및 기존 F001/F004–6/T032/다운로드 파일 확인을 보존한다. 자동 병합 없음.
