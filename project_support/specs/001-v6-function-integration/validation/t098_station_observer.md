# T098 지상국 초안과 기존 계산 연결 검증

2026-10-05, US13 FR021/SC019, T095–T098. 범위: 원본 지상국 위도·경도·최소고각→가상 계산 초안→기존 명시 적용/가시 구간/거리·도플러. 카탈로그 표시 입력은 저장 GP와 별개다. 새 계산식/API/서버 상태 없음.

## 시험
- RED: station-use 미구현으로 두 해상도 시험 실패. 추가 시험의 VM lexical binding 접근 오류를 수정했다(제품 오류와 구분). 구현 후 모든 assertion 수행.
- `node --test project_support/tests/browser/*.test.mjs`:181PASS,713.1441ms. 실제 V6 assembly에서 높이/조회UTC/저장input 보존, 명시적 적용과 결과, invalid/busy/실패/no-input/teardown, 과거구간무효화/목록해제불변, satellite→ground 초안 전달 검증. fixture setGround는 실제 명령의 상태사본 갱신을 모사한다; native 수치 증거가 아니다.
- `project_support/.venv/Scripts/python.exe -m pytest project_support/tests -q --basetemp=data/workspace/validation/ground_stations/pytest_t098`:385PASS140.61s/기존Starlette경고1. 이후 production변경은 JS 입력부만이며 최종 Node전체 재실행.
- git diff --check PASS. communication API/runtime/simulation/native와 원본 preset 모델 변경없음.

## 실제8891 화면
IAB1280x720/1920x1080, 동일0.0.0.0:8891 유지/서버재시작없음. 저장 역사ISS TLE선택후 대전 초안36.3742/127.3567/5°, 높이123.45m와 UTC범위보존/창최소화·복원. 높이는 시험용 사용자 가정이며 실측이 아니다. 적용후 동일input/currentUTC2020-07-12T21:16:01.000416000Z, virtualWGS84/threshold만변경. 대전400초 구간none/스발바르 하루none/대전하루8구간 정상, 실제통신unknown. 위성창 SVALBARD→ground handoff lat78.2298/lon15.4078/mask3/height123.45 보존.
거리·도플러 기존API: 대전 동일UTC에서11847.657381km/고도각-63.079664°/거리변화율-3105.203109m/s, 사용자주파수145.825MHz→도플러1510.432405Hz. 재사용 경로 동작 확인이며 독립 수치oracle 추가검증이 아니다(계산식 미변경). 주파수는 화면전환/지상국변경후145.825 보존. 낮은고도각을조건미충족으로표시. canvas1/수평overflowfalse/consolewarn-error0.
캡처: ignored data/workspace/validation/ground_stations/observer_1280.png,observer_1920.png,observer_radio_1920.png. before/applied/after JSON과 전체시험출력같은폴더.

## 재사용과 한계
선배 원본 commit1a1e002의 tabs/orbit.js observer는 lat/lon/h0가정/마스크/기하 look angles를 사용한다. 본 연결은 이미 검증된 Rust SGP4+정밀ITRF+기존radio식/visibility를 사용하며 browser SGP4나 lookAngles를 중복이식하지 않는다. 높이datum미확인때문에 altitudeKm자동변환금지; 현타원체높이를검토하는입력흐름. 실제시설/RF수신/장비 확인 F001 미완료. 실제부하/성능새수용주장없음. T075/C001의 카탈로그 동적기하/재생/다중위성/3D, T076–84/F002/F004–6/T032/W06diskunknown 유지. Draft PR26위독립검토, 자동병합없음.
