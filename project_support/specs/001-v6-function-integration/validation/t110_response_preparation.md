# T110 응답 준비 분할 검증 — 부분 진행

기존 전체 응답 검증·소유 사본 생성이 약 113–115ms 연속 실행되는 문제를 수정했다. 512행씩 모든 식별자, 단위, 출처, UTC, hash, 위치, epoch 및 실패 개수를 검사하고 두 소유 사본을 준비한다. 묶음 사이 browser task에 실행을 양보한다. 준비 중에는 기존 완료 snapshot만 유지하고 마지막 generation fence 후 완전한 새 snapshot만 게시한다. API, 계산식, 전파, EOP, 전체 개수 및 초당 요청 제한은 변경하지 않았다.

## 회귀시험

추가 시험 두 개는 이전 구현에서 yield 횟수 0으로 실패했다. 수정 후 전체 준비가 끝나기 전에 제어를 돌려주는 것, 준비 중 clear가 부분 결과를 표시하지 않는 것, 마지막 행 오류가 완성되지 않은 위치를 표시하지 않는 것을 확인했다.

- 최종 Node: 208 PASS / 0 FAIL / 883.6242ms. `data/workspace/validation/ground_stations/node_t110_yield_final.txt`.
- 최종 Python: 418 PASS / 경고 5개 / 170.47초. `data/workspace/validation/ground_stations/python_t110_yield.txt`.
- Rust와 wheel은 변경하지 않았으며 별도 T105 근거를 유지한다.

## 실제 화면

기존 8891 서버를 재시작하지 않고 정적 모듈을 reload했다. 전체 active 16,633개가 모두 유효하며, 1920에서 다음 UTC 전체 갱신도 동일 개수였다. canvas 1개, console 오류 0개였다. 다음 수치는 두 번의 관측값이며 p95 또는 모든 환경의 최대 시간 보장이 아니다.

| 측정 | 1280×720 | 1920×1080 |
|---|---:|---:|
| HTTP 응답 | 804.2ms | 822.2ms |
| 준비 wall time (양보 시간 포함) | 155.3ms | 164.5ms |
| 가장 긴 준비 묶음 | 10.4ms | 10.9ms |
| renderer callback | 38.3ms | 16.9ms |

총 준비 시간이 줄었다고 주장하지 않는다. 연속 작업을 나눠 사용자 이벤트를 처리할 기회를 제공했다. 최초 primitive 생성과 기존 collection 갱신을 같은 성능 표본으로 일반화하지 않는다. 원자료 `t110_yield_1280.json`, `t110_yield_1920.json`, 화면 `catalog_scene_t110_1280.png`는 위 ignored 검증 폴더에 보존했다.

실제 readonly 필터 대조는 ISS13 / GEO588 / 빈 결과0의 순서·ID를 기존 전체 catalog API와 비교해 통과했다. snapshot 변경409, 잘못된 UTC422, 페이지 필드 주입422 및 UI 이후 저장 GP/UTC/관측점/배속/정지 상태 불변도 통과했다. 기존 helper `t109_live.py filters`와 `t109_live_filters.json`이 이번 실행 근거이다.

## 남음

Renderer callback의 연속 비용과 실제 조작·재생 성능 수용 검증, 최종 US15 보고 및 Draft PR 게시가 남았다. T110, T075–T084 전체 및 기존 T032/SC006은 완료로 닫지 않는다. 새 응답은 전체 검증 후 한 UTC로 표시해야 하므로 renderer 분할 시에도 섞인 시각의 점을 노출하면 안 된다.
