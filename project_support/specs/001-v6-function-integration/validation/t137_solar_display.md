# T136 태양 표시 통합 수용 검증

2026-10-05. US19의 계산/샘플/표시/타임라인/조립 및 실제 화면 수용 항목을 대조했다. T136을 완료 처리한다. 전체 T075, US18 모델 자산과 T076–T084 완료가 아니다. T137 PR 검토 작업은 별도다.

## 수용 항목과 증거

| 항목 | 확인한 범위와 근거 |
|---|---|
| 정확한 프레임/계산/자료 사본 | validation/t131_solar_geometry.md와 t132_solar_samples.md: 주입 UT1/극운동/윤초, ITRF 단위벡터, published ERFA 회전/동일모델 Astropy oracle, 엄격 readonly API, 오류/사본/출처 |
| 보간과 시각 | validation/t134_solar_timeline.md: 실제 구현의 9604개 1/4초 표본, 최대2.4115991620879543e-10rad<1e-6rad. 윤초/역방향/범위/late/abort는 회귀시험으로 검증. 독립 천문 정확도나 전 영역 정확도 주장 없음 |
| 계산 광원 부호 | validation/t136_morph_repair.md와 ignored t136_native_solar_1280.json: 실제 렌더러의 emitted-light=-toward-Sun, dot=-1/intensity2, stock-sun/atmosphere 설정과 실제 입력 모드. renderer의 사본/외부 소유 복원 시험도 유지 |
| 실제 표식/가림/resize | validation/t136_solar_visual.md: 두해상도 실제 radial glow와 hidden=false, 실제 양의 rayEllipsoid 교차/earth-occluded/hidden=true, 1280/1920 스크린샷/DOM/native 증거 |
| 2D/3D/빠른 전환 | validation/t136_morph_repair.md: 실제 결함 RED 후 원본 입력 정책을 보존한 마지막 요청 대기 처리. 두해상도 실제mode3/inputflagfalse/오류 없음. 기존2D 숨김과 mode 전환 회귀시험 유지 |
| 표시 UTC 우선순위 | 이번 t136_matrix_records.json: 두해상도 selected23:45:12→stored2020→scene23:30:00. 자료 무효화/전체 해제 시 unavailable/hidden, 이전 성공 자료로 정상 표시를 발명하지 않음 |
| 60배속/선행 요청 | 실제 카탈로그 재생의 표시 UTC와 태양 UTC 일치. 1280/1920 연속 관측. t136_matrix_network.json의 601×1초 요청, start480SI초 증가, 연속 prefetch wall 간격7.987~8.005초. 프레임마다 HTTP 없음. 60x 종료 정지 UTC23:14:47.294543999Z는 위성 관측 패널 표시 UTC와 정확히 일치 |
| 앞으로/과거 UTC 탐색 | 23:45:12.212544000Z와22:01:12.212544000Z로 명시 계산. 불가용 구간 숨김→실제200 응답 완료→같은 위성/태양 UTC. 두해상도 ready 기록. 중간 ‘ready’ 이름을 붙였지만 pending인 기록은 성공으로 사용하지 않고, 마지막 실제 responseReceived200 후의 final-reverse-ready 및 pairedUTC를 수용 근거로 사용 |
| 요청 실패/명시 복구 | 두해상도 Network.setBlockedURLs로 태양 endpoint만 일시 차단. Failed to fetch 표시/unavailable/hidden, 차단 해제 후 명시 재시도로 ready 회복. 1280/1920 실패 스크린샷과 복구 records. 차단 설정 모두 제거 |
| 원본 preference/theme/복원 | 두 창의 checkbox off/on 양방향 동기화, 두해상도 반복, reload 후on유지. 밝은 테마 ‘음영 꺼짐’, dark복원. 창 최소화/재열기 후 선호값과 Viewer1 유지. denied-storage/자체 event 중복/리스너 정리는 기존 workspace_solar 회귀시험. 브라우저 보안 정책을 약화시켜 강제 검증하지 않음 |
| 상태/단일 지구 | 52개 실제 DOM 사본의 canvas 모두1. matrix before/after orbit는 observed_monotonic_s 외 모든 필드 동일. SIM runtime 변경은 기존 running의 elapsed_seconds/sequence뿐; controls/run/scenario/장비/통신/임무/events 그대로. analytics는 실행 중 SIM 지표 갱신으로 변화. API/native/서버 restart/8891 변경 없음 |

## 최종 검증과 자료

제품 최종 코드 수정은 4a86165. 그 이후 제품 코드 변경 없이 실제 수용 관측/문서만 추가했다. 최종 전체 Python471PASS8기존warnings213.18s/Node350PASS1286.0838ms와 diffcheck를 재사용한다. 장시간 회귀를 이유 없이 반복하지 않았다. 기존 requirements checklist8/8/constitution1.2.0 및 같은 feature를 유지한다.

이번 raw자료는 data/workspace/validation/ground_stations의 t136_matrix_records.json (52개 사본), t136_matrix_network.json (solar요청11개: 이전 저장 재시도/초기 catalog 요청/9개 선행 요청), matrix_before/after.json과 failure/playing/complete_1280/1920.png다. 실제 responseReceived의 catalog/samples200와 solar/samples200/requestID도 records파일에 보존했다. 화면 캡처 일부는 패널 스크롤이 아래에 있으므로, 각 주장에는 해당 상태 DOM 사본과 기존 태양 표시/가림 화면을 함께 사용한다. 비밀/개인 경로/런타임 대량 원자료는 커밋하지 않는다.

기존 catalog_time의 paused 상태 문구 ‘관측 조건을 확인한 뒤 계산하세요’는 유효 결과와 동시에 나타날 수 있다. 별도 창 복원은 기존 초안 동기화로 관측 입력을 적용 전 상태로 만들기도 한다. 이를 태양 오류나 새 계산 성공으로 해석하지 않았다. 별도 창을 닫은 뒤 실제 응답 완료 상태에서 동일 UTC의 위성/태양을 다시 확인했다. 이 문구 가독성 개선은 T082의 공용 맥락 정리에서 추적하며, 관측자료 준비중인 중간 기록을 수용 성공으로 쓰지 않았다.

검증 탭 두 개 닫기/viewport reset/원래 조명on·dark/3D 유지, 모든 차단 설정 제거. 재생은 catalog 로컬 시계만 정지했고 rate1 복원, 장비나 server orbit 제어 명령 없음(잘못된UTC seek는422로거절). 마지막 저장 UTC 계산은 읽기 전용이다.

## 남은 전체 범위

T137은 exact-tree Draft 게시·검토 기록 대조가 남아 있다. US18/T122/T123/T125–129와 faithful Terra2텍스처/all50 실제 검증, T075 전체, T076–T084, T032 프레임 성능, 실제 RF·장비·HIL·AerODT·다운로드 저장은 유지한다. 태양 표시 수용은 위성 일식/전력 모델·실측·통신 가능 판정이 아니다.
