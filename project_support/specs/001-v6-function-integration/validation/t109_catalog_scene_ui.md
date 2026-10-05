# T108–T109 전체 카탈로그 UI 연결

## 범위와 결과

US15 / FR023 / SC021의 전체 조회 컨트롤러, 패널, 단일 Viewer 표시 및 선택 인계를 구현했다. T110 성능 수용 및 최종 Draft PR 게시를 완료한 기록은 아니다. T075–T084 전체 목표와 기존 보류 사항은 유지한다.

전체 조회는 적용한 검색 조건으로 명시 실행한다. 100개 표 페이지와 분리하며, 전체 응답을 매 프레임 복사하지 않는다. 요청은 한 번에 하나이며 최신 UTC를 합쳐 최대 초당 한 번 갱신한다. 조건 변경, 취소, 오류, hash 변경에서 늦은 응답을 차단한다. GP/UTC/관측점의 서버 권위 상태를 새로 소유하지 않는다.

기존 point 색상·크기·깊이 가림 및 작은 그룹 label 의미를 재사용했다. Viewer와 pick handler는 하나이다. 표 밖 위성 선택도 상세 창을 복원하며, 해당 GP hash와 전체 snapshot UTC를 선택 표시로 전달한다. 선택 위성 UTC와 전체 snapshot UTC를 구분한다. 성공 행이 이후 실패로 바뀐 경우 선택 해제로 과거 점을 되살리지 않는다.

선택 조회가 넓은 숫자 검색 결과 첫 100개에 제한되던 문제를 RED 시험으로 확인하고, 기존 카탈로그의 limit=0 조회로 정확한 NORAD 식별자를 찾도록 수정했다. 계산식과 position/samples wire 계약은 유지한다.

## 자동 검증

- Python 전체: 418 PASS, 경고 5개, 162.17초. 원자료 `data/workspace/validation/ground_stations/python_t109_final.txt`.
- Node 전체: 206 PASS, 실패 0, 861.0495ms. 원자료 `data/workspace/validation/ground_stations/node_t109_meter.txt`.
- Rust 소스는 이번 단계에서 변경하지 않았다. T105의 공식 33입력/668상태 및 clean wheel 검증은 별도 기록을 유지한다.
- 최초 fake leap hash epoch 기대와 isolated module fixture 누락은 보완 후 전체 재검증했다. 실패를 제품 성능 성공 근거로 사용하지 않는다.

## 실제 8891 UI 및 서버 검증

1280×720과 1920×1080에서 전체 active 16,633개가 모두 유효한 위치로 표시됐다. 실제 mouse pick으로 표 밖 위성을 선택하고 최소화된 상세 창이 복원되는 것을 확인했다. 1280 선택은 SUPERVIEW NEO-2 02 / NORAD 53130이었다. GP hash 고정 및 선택 UTC 일치를 확인했다. 1920에서 초안 ISS 입력은 명시 적용 전 기존 전체 표시를 유지하고, 적용 후 이전 표시를 제거하며 새 조회에서 ISS 13개를 표시했다. 잘못된 UTC는 위치를 제거하고 오류로 표시했다. 각 화면에서 canvas 1개, console 오류 0개였다.

원자료 및 화면: `data/workspace/validation/ground_stations/catalog_scene_1280.png`, `catalog_scene_1920.png`, `t109_live_result.json`. 실제 전체 HTTP는 cold 9.7008979초, warm 0.4977654초였다. cold/warm은 캐시 상태에 의존하며 모든 환경의 성능을 보장하지 않는다.

정확한 프로젝트 8891 서버만 재시작했다. 저장 입력과 UTC/관측점은 snapshot으로 복원했다. SIM 메모리 시계가 초기화되는 영향은 사전 안내하고 이전 report를 보존했다. 최종 UI 이후 readonly 대조는 T110에서 다시 확인한다.

## 확인된 성능 gap 및 다음 단계

실제 1280: HTTP 621.8ms, 응답 검증/복사 115.3ms, renderer callback 30.3ms. 실제 1920: HTTP 597.4ms, 검증/복사 113.4ms, callback 36.6ms. 메인 스레드 작업 약 145–150ms가 모여 있어 빠르고 원활한 조작 기준을 달성했다고 주장하지 않는다. 이는 프레임 p95 측정이 아니며 T032/SC006도 닫지 않는다.

다음 T110은 전체 개수와 정확도 및 출처 검증을 유지하면서 처리 분할/소유 사본 비용을 개선하고, 취소·늦은 결과·단일 snapshot UTC 표시를 회귀 검증한다. 최종 실제 두 해상도, readonly, 오류, 성능과 Draft PR 증거가 모이기 전 US15 전체 완료나 게시를 주장하지 않는다.
