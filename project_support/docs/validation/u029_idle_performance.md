# U029 정지 화면의 반복 갱신 최적화

2026-10-08. 기존 Cesium/WebGL과 궤도 계산식은 유지했다. WebGPU 전환은 하지 않았다.

## 재현과 변경

정지된 저장 궤도는 5초 서버 조회 때 observed_monotonic_s만 바뀌어도 선택 사본의 601개 결과를 복제하고 모든 패널을 갱신했다. 서버 조회 및 수신 시각 갱신은 유지하고, ready/paused 상태의 표시 내용이 같으면 알림만 생략한다. 재생 중 수신, revision 및 provenance 변경, 강제 새로고침은 계속 알린다. API/wire 계약과 계산은 변경하지 않았다.

통합 상황판의 replica는 preRender 안에서 같은 선택 위치와 표시 범위를 다시 적용하고 requestRender를 호출해 정지 화면에도 다음 프레임을 계속 요청했다. 기존 불변 표시 사본을 비교해 위치/표시 변경만 적용한다. 원본 검증은 매번 수행하며 동적 노드/태양의 프레임 처리를 유지한다. 자료가 없는 replica는 한번 지우고, 새 renderer가 연결되면 다시 지운다. 실패와 소유권 해제도 기존 경계를 유지한다.

## 측정

| 조건 | 이전 | 이후 |
|---|---:|---:|
| 601행 버퍼, 정지 상태 240회 조회 알림 | 240 | 0 |
| 알림에서 복제한 결과 행 | 144240 | 0 |
| 같은 독립 Node 시험의 총 처리 시간 | 167.05ms | 1.65ms |
| 재생 상태 240회 조회 알림 | 240 | 240 |
| 같은 replica의 추가 60회 preRender 렌더 요청 | 120 | 0 |

Node 시간은 한 번의 로컬 microbenchmark이며 전체 앱 속도/GPU 사용률/FPS 개선 비율이 아니다. 재현: node project_support/tooling/orbit_refresh_benchmark.mjs. 원본 project_support/u029_refresh_before.json 및 u029_refresh_after.json.

실제 Aside/Chrome153, RTX5070 ANGLE/D3D11, 1920x990에서 원래 모듈과 reload 후 모듈의 통합 관제 화면을 각각 측정했다. RAF scheduling p95는19.0ms/18.9ms로 거의 같고16.7ms 기준은 통과하지 않았다. 이전 기록은 초기 측정의34.7초 중단 표본을 함께 포함하고, 이후에는837ms 최대 간격도 있다. 따라서 통제된 GPU 프레임 비교나 성능 수용 완료로 주장하지 않는다. 대량 위성 재생/다른 해상도/CPU·GPU 사용률은 이 시험으로 검증하지 않았다. 프레임 제한을 낮추거나 궤도 정확도를 희생하지 않았다.

## 검증과 보존

관련 회귀시험 먼저 RED: 정지 조회13회 알림 기대1에 실제13, replica 추가60프레임 기대0에 실제120. 신규 renderer 연결시 자료 없음의 지우기 시험도 먼저 실패를 확인한 후 보완했다.

전체 Node2168PASS/0FAIL/1SKIP29.47초(project_support/u029_node_verified.log). 전체 Python963PASS/8SKIP/8warnings264.00초(project_support/u029_python.log), 실제 PG 시험 설정과 기존 native wheel 명시. scoped git diff --check PASS.

실제8891 브라우저 reload/통합 상황판 표시 확인. 서버 재시작과 실행 초기화는 하지 않았다. 현재 run_id/running/speed/elapsed/sequence, 배치, 저장 GP 선택/revision/UTC, PostgreSQL 지상국·시나리오 값이 전후 정확히 동일함을 API로 확인했다. 캡처 data/workspace/validation/u029_performance/before.json 및 after.json.

브라우저 기록 `u029-wall-before.json`, `u029-wall-after.json`, `u029-wall-after.png`는 작성자의 로컬 검증 산출물로 보관하며 저장소에는 포함하지 않는다. 이번 변경은 두 반복 경로의 최적화 완료이며 전체 T075-T083/프레임 성능 수용은 여전히 열려 있다.
