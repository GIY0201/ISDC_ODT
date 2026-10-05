# T136 실제 화면 검증 중 2D/3D 전환 결함 수정

2026-10-05. T136은 부분 진행이며 전체 수용 완료가 아니다.

## 원인과 변경

실제 8891 화면에서 빠른 2D→3D 요청 후 선택값은 3D, 지도와 태양 표식은 2D로 남았다. 기존 GlobeView는 이전 요청을 취소하고 scene.completeMorph()가 진행 중인 전환을 끝낸다고 가정했다. 카메라 입력 소유자는 completeMorphOnUserInput=false를 유지한다. [Cesium 1.143 원본](https://raw.githubusercontent.com/CesiumGS/cesium/1.143/packages/engine/Source/Scene/SceneTransitioner.js)의 completeMorph, createMorphHandler, morphTo3D를 확인하면 이 설정에서는 강제 완료 콜백이 만들어지지 않으며 MORPHING 중 새 요청은 무시된다.

GlobeView는 물리 전환의 morphComplete 리스너를 보존하고 마지막 요청만 기다렸다가 적용한다. 대체된 요청은 false로 즉시 종료하고, destroy는 대기 요청과 리스너를 정리한다. 원본 1.5초 전환, 입력 정책, 2D north-up과 확대 제한을 보존한다. 공개 API, 계산, native, 서버 상태와 8891 포트는 변경하지 않았다. 브라우저가 수정된 모듈을 읽도록 실제 import 경로의 버전을 갱신했다.

## 검증

- 회귀시험 먼저 추가: 빠른 전환 및 강제 완료 불가 조건에서 2개 실패 확인 후 수정, 대상 7개 통과.
- 전체 Node 최종 350 PASS, 1286.0838ms. data/workspace/validation/ground_stations/t136_node_final.log.
- 전체 Python 471 PASS, 기존 경고 8개, 213.18초. 프로젝트 venv의 pytest -q --basetemp data/workspace/pytest_t136_morph, 세션77454 exit0. Python 수집 시작 뒤 변경한 모듈 import 버전은 최종 Node 실행과 실제 화면 재로드로 검증했다.
- 실제 1280×720 / 1920×1080, 8891의 별도 검증 탭에서 빠른 2D→3D 입력. 완료 오류 문구 없음. 읽기 전용 debugger로 두 해상도 모두 실제 scene.mode=3, completeMorphOnUserInput=false, 저장 UTC=2020-07-12T21:16:01.000416000Z, 계산 광원과 enableLighting=true 확인.
- 계산 위치 초점 후 실제 3D 지구 스크린샷 t136_morph_1280.png / t136_morph_1920.png, native 결과 t136_morph_1280.json / t136_morph_1920.json을 위 로컬 검증 디렉터리에 보존. canvas 1 / console error 0.
- t136_before_ui.json과 t136_after_morph.json의 서버 궤도 상태 비교: observed_monotonic_s 외 모든 필드 동일. 입력, UTC, revision, 지상 가정, paused/rate와 자료 hash 보존. 서버 재시작 없음.
- 디버거 중간 결과를 REPL에 할당할 때 변수 범위 오류가 있었지만 finally로 breakpoint/resume/disable 정리 후 같은 확인을 다시 수행하고 1920 결과를 저장했다. 임시 탭 닫기 / viewport reset. 사용자 탭은 보존.

## 남은 범위

태양 표식이 실제 화면에 나타나는 경우와 지구에 가려지는 경우의 두 해상도 증거는 아직 부족하다. 이전 실제 UTC 우선순위/60x/오류복구 관측은 별도 원자료로 남아 있으나 이번 수정 시험만으로 T136 전체를 완료하지 않는다. T137 Draft도 아직 생성하지 않았다. US18 모델/Terra 자산, T075 전체 및 T076–T084, T032 성능, 실제 장비 통신, 다운로드 저장 확인과 AeroDT 연결은 그대로 미완료다.
