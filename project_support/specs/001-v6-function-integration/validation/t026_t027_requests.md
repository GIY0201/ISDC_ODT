# T026/T027 요청 경합과 종료

2026-10-03. 기존 feature와 명세를 유지한다. T026 시험 먼저, T027 보완 후 같은 assertion으로 확인했다.

## 시험 및 초기 실패

orbit_requests.test.mjs 초기8개: 5 PASS/3 FAIL. 실패는 현재 요청의 AbortError 이후 fetching=true/pending 잔류, 요청 클라이언트 종료 메서드 누락, focus 렌더 자원 예외가 UI 안내로 변환되지 않음이다. workspace 조립에도 최종 pagehide에서 요청 클라이언트 종료를 연결하는 assertion을 추가해 0 != 1 실패를 먼저 확인했다. 이후 종료 중 선택 명령/초기 catalog 완료 시험2개를 추가했다.

JS 새 시험은 실제 selection/playback/workspace_globe 및 workspace_orbit 조립을 실행한다. HTTP 응답 순서, DOM, 렌더 자원은 adapter로 제어한다. 렌더 fixture별 모듈 cache 격리를 보완한 뒤 실제 focus 예외 실패를 확인했다.

Python 새5개는 실제 FastAPI ASGI 경로/runtime/bounded ThreadPool 실행기와 고정 계산 barrier를 사용한다. 동시에 같은 revision으로 선택하면 200 하나/409 하나, 실제 작업이 큐를 점유하면 503, 계산 중 state/health/선택 응답, 이전 samples/visibility의 stale=true, 대기 작업 취소 후 calculator 미호출, 실행 중 작업 취소 후 용량 조기 반환 금지를 검증한다. 계산 좌표는 주입 fixture이며 실제 궤도 정확도나 TCP 네트워크 부하 시험이 아니다.

## 구현과 경계

- orbit_selection.js: 현재 요청 취소는 fetching/pending을 정리하고 취소 안내를 보낸다. destroy는 요청을 abort하고 generation을 무효화하며 늦은 응답·초기자료·선택 명령 결과의 채택/notify와 대기 선택 명령/새 요청을 막는다.
- workspace_orbit.js: 최종 pagehide에서 요청 client/ground panel/playback/globe를 한 번 종료한다. persisted pagehide는 유지한다.
- workspace_globe.js: focus 예외도 기존 unavailable 안내와 renderer 해제 경로로 보낸다.
- entry 및 import 버전 t027-r1. legacy tabs/orbit.js/API transport/application.py/runtime/native 실행기는 기존 수용 시험을 통과하므로 수정하지 않았다.

문서 종료 이후 브라우저의 후속601행 prefetch/chunk 요청은 중단한다. 이미 서버에서 실행 중인 native 호출이나 전체 visibility job의 강제 중단을 보장하지 않는다. 취소 후 실행 중 작업이 끝날 때까지 큐 용량이 유지됨을 검증했다. 서버 내 계산 중인 visibility의 세부 chunk 조기 중단은 이번 구현 범위가 아니다.

## 최종 검증

- 전체 Node61 PASS, exit0, 216.97ms. 기존50 + 새 요청10 + 조립1. skip/xfail 없음.
- 전체 Python207 PASS, 기존 Starlette 경고1, 100.20초. 새 concurrency5 PASS. Python 제품 변경 없음.
- git diff --check PASS. 기존 요구 체크리스트8/8, Spec Kit prerequisite 정상, extension hooks 없음.
- 실제8877 IAB t027: 선택TLE/3샘플 계산/지구 위치 이동/1배재생 표시UTC 증가/정지와 수치결과 확인. 시험 후 epoch 복귀. canvas1개와 browser error 로그 없음 확인. screenshot data/workspace/validation/workspace/t027_smoke.png.

실제 브라우저에서 렌더 고장을 주입하거나 HTTP 응답 순서를 강제로 바꾼 것은 아니다. 고장·경합은 위 adapter/ASGI 증거로 구분한다. 성능 목표 통과나 실제 native 취소로 해석하지 않는다.

## 다음 단계

T026/T027 완료, 첫묶음27/31(시험 준비 포함), 남은4개 T031/T028/T029/T030. 의존 순서에 따라 다음은 별도창 업무/입력 전달·동기화·충돌·닫기 T031이다. F001 실제 통신 조건 조사·적용과 F002 전체 선배 기능 연결, 게임 성능/격리 설치/전체 제품 검증은 미완료다. T026 시험과 T027 구현은 같은 PR로 리뷰하며 자동 병합하지 않는다.
