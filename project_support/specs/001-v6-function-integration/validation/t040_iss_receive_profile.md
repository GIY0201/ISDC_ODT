# T040 ISS APRS 공식 수신 조건 부분 연결 검증

2026-10-04. 사용자 ISS부터/장비 없음 답변에 따라 FR010/SC008의 공식 주파수 부분을 연결했다. 기존 RF 계산을 유지하며 실제 수신/운용 보장은 하지 않는다.

## 자동 시험
- T037 Python/Node 신규 모듈 미존재 RED, T039 UI 버튼 미존재3 FAIL 후 구현. 단위 비교는 이진 부동소수점 차이를1e-12 GHz 이내로 검증한다.
- 첫 전체 Python312 PASS/1 FAIL은 승인 신규 GET이 compatibility 경로 목록에 없어서 발생. 허용 신규 경로를 명시한 뒤 원래 모든 경로/schema exact 비교를 계속 유지했다.
- 최종 Python **313 PASS**,107.66초, 기존 Starlette 경고1. `python -m pytest -q --tb=short --basetemp=data/workspace/validation/iss_rf/full_02 -o cache_dir=data/workspace/validation/iss_rf/cache`. Node **103 PASS**,340.8823ms, `node --test project_support/tests/browser/*.test.mjs`. 원자료 pytest_final.log/node_final.log, 첫 실패도 보존.
- 신규 Python9개: 공식값/변환/사본, 실제 ASGI 조회/runtime 불변, 손상6가지 및 누락 거절. JS controller4개: 주파수만 적용/다른 값 출처/동일값 무효화/복사/역순/abort/종료/오류/공지 시간. 실제 assembly adapter4개: 두해상도 창복원/역할 전환/가정 보존, 오류 fallback없음, 동일 원격 주파수의 공식 권한 강등. adapter는 실제 OS 별도창 검증으로 주장하지 않는다.
- 원본 HEAD1a1e00297a0301637455b0ef2cf48b2e74576b07 RF 함수3/HTTP 함수3/schema1 AST7개 동일. read-only reviewer 실제 결함0. git diff --check PASS.

## 실제 브라우저
새 stored-orbit server127.0.0.1:8891, 기존8879 공유서버는 그대로. IAB1280x720/1920x1080 각각 공식 조건 조회/주파수만 적용, 나머지 가정값 보존, 기존API 정상 계산/동일값 재적용 결과폐기, 최소화/복원을 확인했다.1280에서 수동 주파수 편집은 사용자 가정으로 강등. 거리1km는 명시 오류. source UI는 ARISS URL/공지2026-09-25/확인UTC2026-10-03T17:12:27Z/저장된 공지/장비 미선정/실제 통신 미확인을 표시. 날짜 age는 UTC 기준8일 경과로 관찰되었다.
최종 저장ISS TLE 선택 후 주파수 적용 전후 ground입력7개 전체 동일: 선택ID/위도33.4996/경도126.5312/타원체0m/10도/시작2020-07-12T21:16:01.000416000Z/종료+24h. ui_ground_proof.json에 원자료. 공식2026공지 적용으로2020GP epoch를갱신하지 않는다. Cesium canvas1, browser error로그0. screenshots profile_1280.png/profile_1920.png/profile_final.png. viewport override 최종reset. 작은창은 내부 스크롤로 입력과 버튼 접근. 프레임시험 재개 아님.

## 범위와 한계
공식 https://www.ariss.org/current-status-of-iss-stations.html 의437.825MHz만0.437825GHz로적용한다. 공지의 troubleshooting/testing과 Oct2~6 SSTV 안내를 분리한다. 현재 송신 전력/데이터율/대역폭/안테나/잡음/손실/도플러/복조/수신 증거 미확인. 일반 최대 전력/2012년 baud/SXKa 대표 접시값 자동적용없음.
모델 JSON은 Git 소스 배포에 포함, Python앱의소스checkout실행범위다. 기존wheel은Rust모듈전용이며이번JSON을wheel에포함했다고주장하지않는다. 새로운전체앱wheel/다른PC설치검증없음. 기존native설치회귀는전체pytest에서통과.
T037~40 이번 묶음 완료. 전체feature implement/verify는 running, F001전체/F002전체기능 및T032프레임보류/F004/F005/F006을닫지않는다. Draft PR은PR14위에stack, 자동병합없음.
