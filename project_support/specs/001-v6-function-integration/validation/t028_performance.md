# T028 실제 성능 계측과 개선

2026-10-03. 계측 및 3회 계산 개선을 수행했으나 **SC-006 전체 FAIL**이다. 사용자 목표를 낮추지 않는다. UTC 결과 p95는 통과했지만 하루 조회와 프레임/피드백 대리지표가 미달이다. 제품 전체 완료나 게임 수준 사용성 확보를 주장하지 않는다.

## 환경과 절차

제품 코드 전용 서버 8878을 사용했다. 기존 공유 8876/8877 프로세스는 재시작하지 않았다. 8877 초기 표본은 이전 backend의 baseline이며 개선 결과가 아니다. Windows 11 Education 10.0.26300, i9-11900/논리16, RTX5070 driver32.0.16.1692, balanced power, CPython3.14.6/numpy2.5.3/Astropy8.0.1, IAB Chrome154/DPR1. WebGL 실제 renderer는 NVIDIA ANGLE D3D11이다. Remote Display Adapter도 있으며 OS 주사율144Hz 보고만으로 실제 제출·표시 경로를 입증하지 않는다.

두 해상도 각각 서로 다른 UTC100회와 초기 계산1회, 서로 다른 시작 UTC의 실제24h 조회20회. 가상 제주33.4996/126.5312, 타원체높이0m, 최소각10도. UTC 범위 기준은 2020-07-12T21:16:01Z부터 시작을1초씩 바꾸며 정확히 다음날까지다. 입력 변화/재생·정지/키보드 창이동·크기/지구focus/역할전환 및 최소화·복원을 수행했다. 모든 하루 결과4구간, 통신unknown, 마지막console error0, 문서당canvas1. 키보드 동작은 기능 관찰이며 click 피드백 지연 표본이 아니다.

1280은30초trial3개 모두 완료했다. 1920 주 기록은3개시작/2개완료로, 두 번째를29.814초에 새로 시작한 절차 오류를 원자료에 남겼다. 별도30초 보충trial1개를 완료하여 총3개 완료를 확보했다. 불완전 trial을 PASS 표본으로 재분류하지 않았고 주 집계와 보충 집계를 분리한다. RAF 간격은 스케줄링, 두RAF 피드백은 보수적 대리지표이며 GPU 렌더/Event Timing 증거가 아니다. 실제60Hz GPU 제출 경로 인증은 미완료다.

## 실제 UI 결과 (ms)

| 해상도 / 지표 | 표본 | p95 | p99 | max | 목표 / 판정 |
|---|---:|---:|---:|---:|---|
|1280 프레임 RAF|2880|31.7|31.8|32.1|16.7 / FAIL 대리지표|
|1280 click 피드백|129|62.3|63.1|77.1|50 / FAIL 대리지표|
|1280 UTC 완료|101|44.0|48.0|75.3|100 / PASS|
|1280 하루 결과|20|2266.0|2328.7|2328.7|1000 / FAIL|
|1920 주 프레임 RAF|4528|31.3|31.7|90.9|16.7 / FAIL, 중단trial 포함 원자료|
|1920 click 피드백|126|62.7|68.5|124.5|50 / FAIL 대리지표|
|1920 UTC 완료|101|43.6|48.9|109.9|100 / PASS, 최대치는 별도 유지|
|1920 하루 결과|20|2197.8|2214.1|2214.1|1000 / FAIL|
|1920 보충 프레임 RAF|1653|18.6|18.8|20.9|16.7 / FAIL|

원표본 전체를 nearest-rank 집계한다. hidden frame0, 측정 시작/결과 시점 visible/focused true. 보충 재생은 주 시험보다 RAF 주기가 짧아 환경·창 상태 영향 가능성을 유지하며 앱만의 병목으로 단정하지 않는다. 보충의 UTC1/피드백4/하루0을 본100/20회 목표 통과 증거로 쓰지 않는다.

## 계산 개선과 정확도 유지

세 개선 묶음은 (1) 정확UTC/EOP/native 준비·배치화 (2) ndarray geometry 유효성 검사의 scalar 반복 제거 (3) 독립 극값 bracket의 반복별 묶음 계산이다. 1초 dense grid,40회 극값 보정,1e-6초 극값 정밀도,0.01초 경계 bracket, 윤초/오류/provenance/접점 계약을 유지했다. 같은 지점의 Cesium position property를 재생 frame마다 새로 만들지 않는다. wire schema/권위상태/기존SIM 및 legacy는 변경하지 않았다. ADR0005 참조.

동일1000행 계산은 scalar0.65630초에서 batch 중앙0.02685초(약24.4배)로 개선됐다. 하루 탐색은 배치 초기5.23572초에서 마지막 유휴3회 2.0770435/2.0652744/2.0617019초, 중앙2.06527초로 감소했다. 소표본 numpy 선형보간 p95=2.07587/p99=2.07681/max=2.07704초로 UI의 nearest-rank와 구별한다. 호출수1255→138. HTTP/DOM 지연을 제외한 backend만으로도1초 목표 FAIL이다. profile 실행은 timed trial 외 별도이며 타이밍과 혼합하지 않는다.

변경 전후 하루4구간/peak UTC 최대차이0초, 고도각차이0도, provenance동일. 이 비교는 동일native 전후 회귀이며 독립 물리 검증이 아니다. 새 batch시험15개는 nanosecond/윤초/UTC/범위/오류/버퍼/부적합배열 및 실제하루기준을 검증한다. 기존 공개 fixture/독립변환 비교/denseoracle 시험은 유지했다.

## 입력과 증거

UI/TCP 저장 입력SHA256 `8d7c0750a5c89662ce8b113dff5b74104ba355a1d9742efc08e951158a9184fc`.
backend benchmark fixture SHA256 `334ff12e6161f2a343a0eba9f1c351b1171fe41221b043ddeb8fc1614780f031`. 요소/epoch가 같아도 원문 바이트가 다르므로 동일파일/해시로 주장하지 않는다.
EOP `31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7`, 윤초 `6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7`.

로컬 생성물은 `data/workspace/validation/performance/`의 environment.json, scalar_baseline.json, batch_1000.json, batch_day_pre_refinement.json, batch_day_final_idle.json/.prof, batch_parity.json, final_1280.json/.png, final_1920.json/.png, final_1920_supplement.json, final_preview.png이다. 초기baseline_1280.json 및 chrome_probe_1280.json/ chrome_trace.json도 보존한다. Chrome probe는 가림/스로틀링 영향이 있어 전경성능 수용 표본으로 제외했다. 해당 trace는 초기probe만의 자료이며 최종GPU 제출 증거가 아니다. Git에는 도구·요약·회귀시험을 넣고 생성물/바이너리를 넣지 않는다.

역순 덮어쓰기0은 실제 client 두 쿼리 역순 시험과 ASGI/executor 고장 주입에서 검증했다. 정상 브라우저 반복에서 고장 주입을 수행했다고 주장하지 않는다. 실제 TCP 별도 프로세스에서 inputs2/samples3/visibility1구간/409/선택UTC보존/health를 재확인했다. 전체 회귀 최종 결과는 T030 문서에 기록한다.

## 남은 일

T028 계측·개선 작업은 수행했지만 SC-006 미달을 후속 T032로 남긴다. 3회 bounded 개선 후 목표를 바꾸거나 탐색 정확도를 줄이지 않았다. foreground 실제 프레임 제출/입력 Event Timing, 하루 결과1초 및 같은 두해상도100UTC/20일조회/30초3회 재검증이 필요하다. F001 실제 통신/F002 전체 기능/F005 실제ISS 오차/F006 다른PC·ABI·배포 범위는 열려 있다.
