# T136 태양 표식 표시와 지구 가림 실제 검증

2026-10-05. 동일 브랜치 4a86165의 실제 8891 화면. 이전 목표 turn은 전환 결함 수정과 실제 두해상도 증거를 추가한 progress였다. 이번에는 제품 코드 변경 없이 남아 있던 태양 표시/지구 가림 관측을 수행했다. 전체 T075–T084와 모델/Terra 범위를 유지한다.

## 실제 입력과 결과

별도 검증 탭에서 현재 저장 입력의 3개 좌표를 읽기 전용으로 계산하고 계산 위치로 카메라를 이동했다. 저장 UTC는 2020-07-12T21:16:01.000416000Z, EOP c672540e026d...이며 UT1/극운동 final_b. 카메라 Shift+left drag 입력으로 방향을 바꾸어 태양 표식을 실제 화면에 진입시켰다. 카메라 또는 태양 데이터를 제품 내부 함수로 강제 설정하지 않았다.

- 1280×720: 실제 radial glow와 중심점이 보인다. DOM hidden=false/state=visible, 지구 canvas 1. 해당 프레임 투영 좌표 x491.4/y115.8은 지구 canvas의 지역 좌표이며 viewport 절대 좌표와 구분한다.
- 같은 카메라에서 1920×1080 resize: 실제 표식 보임, hidden=false/state=visible, 투영 x752.6/y201.9. 원래 표시 크기/CSS와 현재 UTC 보존.
- 기존 목록의 하르테비스훅을 선택하고 지상국으로 이동: 카메라만 이동하며 UTC/궤도 선택은 유지. 두해상도 모두 state=earth-occluded/hidden=true, 패널에 ‘지구에 가림’ 표시. 실제 화면에서 태양 표식이 사라졌다.
- read-only debugger로 Cesium scene.mode=3와 원본 교차 계산 확인: toward-Sun unitvector [-0.6852411256999251,-0.6264942341890873,0.3714156353431133], cameraForward dot0.9687989071903725, rayEllipsoid start2609871.7665335382m / stop14611303.213111961m. 양의 교차 구간이므로 화면 밖/뒤 판정과 별개로 지구에 가려진다. 독립 천문 정확도나 위성 일식/발전량 증거가 아니다.
- 최초 카메라 방향 관측을 위한 1px wheel 입력은 원본 Earth 중심 zoom 정책에 따라 다시 지구를 바라보게 했다. 이후 표시 증거는 wheel 관측 뒤 실제 Shift drag로 다시 얻었고, 가림 native 관측은 UI의 명시적 자료 재시도에서 멈춰 읽어 카메라를 바꾸지 않았다. 중간 offscreen 관측도 보존한다.
- 네트워크 태양 자료 retry는 계산 재조회일 뿐 서버 명령이 아니다. t136_before_ui.json과 t136_after_sun_visual.json 비교는 observed_monotonic_s 외 모든 궤도 필드 동일. revision1/입력/UTC/지상 가정/paused/rate/hash 보존. 서버 restart/포트 변경 없음.
- console error0. debugger breakpoint 제거/resume/disable, 임시 지상국 선택 해제, 계산 위치 카메라 요청, viewport reset, 검증 탭 닫기. 사용자 탭 보존.

## 원자료

data/workspace/validation/ground_stations 아래 ignored 로컬 자료:

- t136_sun_visible_1280.png / t136_sun_visible_1920.png: 실제 표시 화면.
- t136_sun_visible_1280.json / t136_sun_visible_1920.json: DOM hidden/dataset/rect/상태/canvas 사본.
- t136_sun_occluded_1280.png / t136_sun_occluded_1920.png: 가림 상태 패널과 실제 지구. 1920은 상태 패널이 보이도록 다시 저장했다.
- t136_sun_occluded_1280.json / t136_sun_occluded_1920.json: hidden=true와 상태 사본. 숨겨진 표식의 과거 x/y는 위치 성공 증거가 아니며 실제 판정은 hidden/state로 확인한다.
- t136_sun_occlusion_native.json: actual paused renderer의 camera/vector/ray/mode/UTC 사본.
- t136_after_sun_visual.json: 서버 상태 비교.

## 수용 상태와 다음 작업

이번에는 태양 표식 표시와 지구 가림의 두해상도 실제 증거 부족을 해소했다. 제품 코드 변경이 없으므로 직전 전체 Python471PASS8warnings213.18s / Node350PASS1286.0838ms를 다시 실행하지 않았다. T136 전체는 아직 unchecked다. 남은 전체 matrix에서 선택카탈로그/저장/scene 우선순위, 다른 UTC seek와60x, 오류 복구/설정 복원 및 실제 별도 창 preference 전달의 저장된 근거를 대조하고 부족한 항목을 추가해야 한다. T137 exact-tree Draft는 그 이후다. T075 전체/US18 Terra/T076–T084, T032 성능, 실제 장비 통신/HIL/AeroDT/다운로드 저장은 완료되지 않았다.
