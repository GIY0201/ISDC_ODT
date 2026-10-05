# T110 renderer 반복 생성 보완

원본 색상과 거리별 크기 옵션을 각 위성마다 반복 생성하던 처리를 visual class별 공유로 바꿨다. 위치와 point ID는 각각 유지하고 collection도 같은 GP에서 재사용한다. epoch 파싱 결과는 현재 scene 내 정확한 GP hash와 epoch 문자열로 검증하며, scene 교체/해제/종료 시 캐시를 비운다. UTC가 원본 72시간 경계를 넘고 돌아오면 opacity를 갱신한다. 이는 물리식 또는 API 변경이 아니다.

RED 시험에서 visual class 공유가 없고 동일 GP의 반복 UTC 갱신에 Date.parse 16,634회가 호출되는 것을 확인했다. 수정 후 첫 full scene의 색상 할당은 네 regime에 대해 최대 8회, 거리 옵션은 최대 2회다. 같은 GP 반복은 조회 UTC 파싱 1회이고 GP/epoch 변경은 새로 파싱한다. 오래된 자료의 alpha .56과 새 자료 .9/.98 복귀, 같은 point 객체, 실패 숨김, 선택 표시와 단일 Viewer를 함께 시험했다. 카탈로그 필드나 부분 결과를 생략하지 않았다.

## 최종 시험

- Node 전체 210 PASS, 실패 0, 974.953ms (`node_t110_style_final.txt`).
- Python 전체 418 PASS, 경고 5개, 170.42초 (`python_t110_style.txt`).
- 실제 8891 filter 대조 ISS13/GEO588/빈 결과0, 순서·ID,409/422 및 post-UI 저장 입력/UTC/관측점 불변 통과.
- 정적 모듈 reload만 수행했고 서버 및 SIM 시계는 재시작하지 않았다. Rust/wheel 변경도 없다.

## 실제 UI 측정

| 관측 | HTTP | 준비 wall | 최장 준비 묶음 | renderer callback |
|---|---:|---:|---:|---:|
| 1280×720 첫 표시 | 11287.1ms | 151.3ms | 10.5ms | 36.6ms |
| 1280×720 같은 GP 다음 UTC | 802.4ms | 157.4ms | 11.2ms | 23.3ms |
| 1920×1080 같은 GP 다음 UTC | 581.4ms | 93.8ms | 4.2ms | 16.4ms |

모든 응답은 16,633개 전부 성공, 0개 실패였다. canvas 1개, console 오류 0개 확인. 화면과 원자료는 ignored `data/workspace/validation/ground_stations/t110_style_*` 및 `catalog_scene_t110_style_1920.png`에 보존했다. 최초와 반복/다른 해상도·캐시·JIT 상태가 달라 이 소수 관측값만으로 성능 향상을 단정하지 않는다. callback 시간은 실제 presentation 프레임 p95가 아니며 T032/SC006 통과 증거로 사용하지 않는다.

## 전체 경계

T110 최종 보고/수용 검토/Draft PR 게시는 아직 남았다. T075의 궤적·패스·태양·모드·지도/명암·레이블/대표 SVG와 T076–T084 전체가 그대로 남는다. 원래 제품의 원활한 사용성 기준, T032 및 기존 보류 항목을 닫지 않는다.
