# T076 원본 실행 비교 자료 준비

2026-10-05. 기존 FR-008/C002/T076의 이식 준비다. 구현 대상은 원본 전체 노드/편대/전력/배치이며 이 자료만으로 T076을 완료하지 않는다.

## 실제 원본 실행

`project_support/tooling/capture_original_nodes.mjs`가 외부 참조 checkout의 원본 satellite_dynamics.js/satellite_nodes.js 바이트 SHA256을 고정값과 대조한 뒤 Node VM에서 실행한다. 소스 문자열을 수정하거나 제품 구현으로 대체하지 않는다. Date.now/기본 Date는 명시 2026-10-04T22:01:12Z로 고정하고 원본의 ID 증가 순서를 보존한다. 제품은 도구/외부 참조를 import하지 않는다. 실행 모듈은 두 개의 확인된 파일로 제한되며 CLI 출력은 fixture/검증 디렉터리에만 허용한다.

생성 파일: `project_support/tests/fixtures/original_satellite_nodes.json`, 499478bytes, SHA256 `baaad063f638ee2c6f91a24a972e700dea6e22573fb5f59fb4410cc2124e2075`. 두 번 독립 실행하여 바이트가 동일했다. 이 해시는 이번 원본 결과 파일의 식별자이며 정확도 보증이 아니다.

91개 case: bus5/power30/mass5/catalog5/선택 OISL 소비5/formation12/elements4/state20/invalid orbit4/원본 Infinity 검사 gap1. preset 정의와 물리 단위/근사 프레임도 포함한다. 4개 궤도마다 -1일/epoch/+1초/+600초/+1일 상태를 원본에서 계산했다. 원본 궤도 요소/GMST/태양/일조를 제품의 정밀 ITRF 또는 SGP4와 같다고 표시하지 않는다.

## 검증

- 도구 없음으로 import RED 확인 후 구현. 잘못된 source hash/누락 source/명시 경로 누락은 실제 도구 시험에서 거부됐다.
- 관련 Node5PASS: 전체 preset/mode/link-policy 수용 자료, 원본 궤도 영역 오류, 원본 결과 회전 길이/LVLH 직교/단위와 편대 ID·수·위상·정책을 대조했다. 이 검사는 원본 결과의 내부 일관성이며 독립 궤도 정확도 시험이 아니다.
- 전체 Node355PASS,0fail,1588.4173ms. 기본 Node 실행에 VM flag 없이도 시험이 통과한다. 실제 원본 capture만 `--experimental-vm-modules`가 필요하다. Node는 이 기능의 experimental warning을 출력했다.
- Python 전체471PASS,8기존 ERFA 등 warnings,229.27초. 세션62273이 exit0으로 종료됐다. 전체 로그는 data/workspace/validation/ground_stations/t076_original_nodes_pytest.log 및 t076_original_nodes_node.log에 보존한다. whitespace 검사 통과. 제품 코드/서버8891/API/native/wheel/사용자 화면 상태 변경 없음.

## 후속 필수 범위

순수 정의/검사/생성/전력의 원본 비교에 이 파일을 사용한다. 원본 local draft/deployed CRUD 및 저장 실패·사본·240개·복원·충돌, UI 전체 편집/슬라이더/분리/표시, 원본 Kepler+J2의 native 계산 계약/시간·근사 프레임, 지구·scene/composer와 단일Viewer 조립, 서버 deployment 수락(별도 data-management endpoint/T079), 실제 두해상도/전체 회귀/Draft 검토가 남는다. 서버 client의 initialize restore POST를 UI 복원에 자동 도입하지 않는다. T075/Terra/T137 인증과 T077–84/T032/장비·실통신·HIL/다운로드/AeroDT도 유지한다.
