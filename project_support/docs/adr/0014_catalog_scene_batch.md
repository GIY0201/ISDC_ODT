# ADR0014 전체 카탈로그의 다중 위성 정밀 표시

선배의 `Catalog.get_satellites(limit=0)` 전체 조건 조회를 재사용한다. V6 목록의 100개 페이지는 지구 표시 범위가 아니다. 전체 카탈로그의 같은 UTC 위치를 Rust SGP4와 공식 EOP로 계산하며 기존 선택 위성 API와 저장 GP/SIM 권위 상태를 변경하지 않는다.

제품 native0.2.0은 `propagate_omm_many(payloads, minutes)`를 추가한다. Python foundation의 검증된 두 부분 JD/UTC·윤초 의미를 유지하고 각 위성 epoch 대비 offset을 전달한다. Rust에 별도 UTC 해석기를 만들지 않는다. 한 native 호출은 정렬된 OMM/유한 offset 최대50000개이며 길이 불일치·초과·비유한 offset은 전체 입력 오류다. OMM/상수 생성/전파 실패는 그 행의 오류와 내부 NaN으로 격리한다. 전파 오류 코드는 기존 계산과 동일하다. 외부 wire에는 실패 위치를 null로 표시한다. 기존 단일 TLE/OMM exports, 86401 시간 표본 상한, WGS72_AFSPC profile은 유지한다.

이후 whole-scene 조립은 전체 source snapshot의 정규화 hash와 개별 GP hash/epoch를 보존하고, 검증한 immutable 입력/epoch를 snapshot별 캐시한다. 공통 UTC/EOP/회전은 한 번 처리하고 full snapshot이50000개를 넘으면 여러 native chunk로 처리하여 페이지 또는 상한 때문에 조용히 잘라내지 않는다. 실행은 기존 bounded executor를 사용한다. UI는 전체 표식의 native snapshot UTC와 선택 위성의 재생 UTC를 각각 명시하며 단일 Viewer에서 원본 pointprimitive/색상/선택 의미를 재사용한다.

설치 산출물은 실제 제품 manifest로 release/locked build하고 새 dependency 없이 기존 repaired DLL 출처·license/RECORD 검사를 유지한다. 깨끗한 venv 설치 후, 소유가 확인된8891 서버 lifecycle 안에서 프로젝트 native wheel을 바꾼다. 공개 HTTP scene 계약과 UI 연결은 T106–T110에서 구현·검증하며 이 ADR 작성만으로 완료라고 기록하지 않는다.
