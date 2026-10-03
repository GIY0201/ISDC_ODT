# T032: 하루 조회 개선 및 실제 표시 계측

2026-10-03. **부분 완료: 하루 조회/UTC/관측 입력 지연은 목표 안, 프레임은 미달.** T032 checkbox와 SC-006은 완료로 바꾸지 않는다. T028 실패 원자료와 최초 전체 연결 목적은 유지한다.

## 변경과 정확도

Round1은 동일 ERFA UTC 포맷의 dict/문자열 중복과 scalar 숫자 검증 비용을 줄였다. 신규 시간 시험5 FAIL/1 PASS에서 관련28 PASS로 전환했다. 실제 저장 TLE 하루3회 중앙1.678초/최대2.448초로 여전히 실패했다.

Round2는 선택적으로 주입되는 불변 UTC/EOP/ITRF/고도각 벡터를 사용한다. 86,401개 시각의 중간 문자열과 객체 생성을 줄이며 기존 scalar 주입과 wire는 유지한다. 하루3회 0.48337/0.49399/0.4548초, 중앙0.48337초. 동일 자료의 round1 대비4구간 경계/peak UTC/최고각도/자료 provenance가 exact 일치했다. 동일 kernel 회귀이며 독립 물리 검증은 기존 fixture 시험으로 구분한다.

1초 SI grid, 40회 극값 보정, 1e-6초 정밀도, 0.01초 root bracket, 윤초/행별 오류/부분 실패를 유지했다. 임계값이나 결과 캐시를 이용해 표본을 줄이지 않았다. 벡터 행 수/UTC/hash/readonly와 scalar fallback 보호를 test-first로 검증했다. 읽기 검토에서 발견한 mutable Time callback 공백은 별도1 RED→PASS로 수정했다. callback에 사본을 넘겨 비교 기준을 보존한다. 실제 하루 scalar/vector exact parity를 포함한 관련25 PASS. ADR0006 참조. 추가 성능 최적화 round3은 사용하지 않았다.

## 실제 브라우저 절차

제품 venv의 전용8879 서버와 전경 Chrome154/ANGLE RTX5070/D3D11/DPR1을 사용했다. i9-11900 8코어16스레드, Windows11 26300, 균형 조정 전원. OS 보고144Hz는 실제 페이지60Hz 표시의 인증이 아니다. 전원/주사율/브라우저 설정은 변경하지 않았다.

두 해상도에서 각각 서로 다른 UTC100회, 다른 시작 UTC의24h20회, 재생30초 완료trial3회를 수행했다. UTC 초기화/추가 확인은 전체 표본에 남겨 UTC 완료 수는102/101이다. 주계측 중단trial0/hidden frame0, 표본을 제거하지 않았다. 1920 마지막trial에는 지구 위치 이동과 작업창 이동/크기 조절도 포함했다.

계측 시작 버튼은 진행 중 비활성화되어 완료 직전 재시작을 막는다. 최종 종료 시 중단trial을 기록한다. User Timing의 start/end 마크와 Chrome ReturnAsStream 추적으로 완료30초 구간을 연결했다. 같은 렌더러의 `AnimationFrame::Presentation` 간격은 presentation feedback 시각을 사용한다([Chromium 구현](https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/frame/animation_frame_timing_monitor.cc)). GPU Display/Present 이벤트도 원문에 보존했다. 물리 모니터 scanout이나 다른 PC 성능까지 인증하지 않는다.

Event Timing은 interactionId>0을 가진 같은 입력의 최대 duration으로 집계한다. hover와 hidden 표본은 별도 원문에 보존하며 입력 지연에 섞지 않는다. durationThreshold16ms/8ms 반올림이 적용되므로 관측된22/25개 interaction의 통계이며 모든100개 입력의 개별 duration을 확보했다고 주장하지 않는다. 빈 표본은 PASS가 아니다. 초기 UTC 반복에서 유효 표본이 없었으나 이후 실제 조회/조작에서 확보했다. 별도 CDP 입력 probe1회도 보존했다.

## 주계측 결과 (ms, nearest-rank)

| 해상도/지표 | 표본 | p95 | p99 | max | 판정 |
|---|---:|---:|---:|---:|---|
|1280 실제 presentation|4981|18.578|18.760|19.249|16.7 목표 FAIL|
|1920 실제 presentation|4985|18.552|18.753|19.162|16.7 목표 FAIL|
|1280 RAF|4981|18.6|18.8|19.2|대리지표 FAIL|
|1920 RAF|4985|18.6|18.8|19.1|대리지표 FAIL|
|1280 두RAF 피드백|126|34.7|38.6|52.5|50 목표 PASS 대리지표|
|1920 두RAF 피드백|126|35.8|39.0|76.9|50 목표 PASS 대리지표|
|1280 Event Timing|22|48|48|48|관측/반올림 표본 p95≤50|
|1920 Event Timing|25|48|56|56|관측/반올림 표본 p95≤50, 최대치 유지|
|1280 UTC 완료|102|32.0|36.1|37.3|100 목표 PASS|
|1920 UTC 완료|101|32.1|35.8|98.4|100 목표 PASS|
|1280 하루 완료|20|551.0|611.0|611.0|1000 목표 PASS|
|1920 하루 완료|20|534.0|534.2|534.2|1000 목표 PASS|

mutable Time 보호 수정 후 fresh 서버에서 각 해상도20개24h를 다시 측정했다. 1280 p95/p99/max=543.1/546.4/546.4ms, 1920=547.3/624.6/624.6ms로 최종 코드에서도 PASS다. 이 추가 기록의 frame0/UTC0을 주측정의3trial/100UTC를 대체하는 증거로 쓰지 않는다. 정상 시간/입력/프론트 경로는 수정하지 않았다.

페이지 표시와 RAF 간격이 같은 약18.6ms이며 GPU 피드백 증거는 확보했지만 원인을 앱 계산만으로 단정하지 않는다. 실제60Hz 표시 전제/렌더 경로 점검과 재검증은 남는다. 합의 목표를55fps로 낮추거나 실패표본을 제거하지 않는다.

## 최종 회귀

- Python242 PASS, 기존Starlette 경고1,113.49초. 구조/상태/웹 import, 공식 자료, 정확도/윤초/short-pass/오류/큐/설치 회귀 포함.
- Node82 PASS,351.32ms. 새 계측3개 및 trace2개 RED→PASS, 기존 역순 응답/늦은 결과 덮어쓰기0 유지.
- 제품 Cargo release/locked/offline integration1 PASS(공식33입력668상태), unit/doc0. 처음 shell PATH의 cargo 명령 미발견 후 기존 프로젝트 use_rust_environment.ps1을 적용해 재실행했다. Rust/wheel 변경 없음.
- 실제 localhost TCP: inputs2/samples3/visibility1구간/409/선택UTC보존/health PASS. 정상 브라우저 반복에서 고장 주입을 수행했다고 주장하지 않는다.

## 보존 원자료 및 재현

입력 `8d7c0750a5c89662ce8b113dff5b74104ba355a1d9742efc08e951158a9184fc`, EOP `31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7`, 윤초 `6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7`.

`data/workspace/validation/performance/`에 t032_round1/round2 JSON/profile/parity, t032_environment.json, t032_final_1280/1920.json/.png, t032_guard_1280/1920.json, t032_trace_1280/1920.json과 전체압축원문.json.gz, 요약 및 미리보기를 보존했다. trace transport dataLossOccurred=false와 EOF를 확인했다. 초기 report-event probe의 버퍼 evicted/누락은 수용증거로 쓰지 않았다. 대용량 원문은 분할 압축 저장했으며 JSON요약에는 마크/표시/GPU 이벤트만 추출했다. 생성물과 바이너리는 Git에서 제외한다.

```powershell
node project_support/tooling/measure_orbit_ui.mjs data/workspace/validation/performance/t032_final_1280.json data/workspace/validation/performance/t032_summary_1280.json data/workspace/validation/performance/t032_trace_1280.json
node project_support/tooling/measure_orbit_ui.mjs data/workspace/validation/performance/t032_final_1920.json data/workspace/validation/performance/t032_summary_1920.json data/workspace/validation/performance/t032_trace_1920.json
```

SC-006/T032는 프레임 기준 때문에 열어 둔다. F001 실제 통신 조건 조사·적용, F002 선배 전체 기능 연결, 다른 PC/ABI 및 실제 AeroDT 연결은 별도 후속이며 완료로 변경하지 않는다. 변경은 PR12 위 별도 Draft PR로 리뷰하고 자동 병합하지 않는다.

## 추가 프레임 대조군 진단

2026-10-03 사용자 승인으로 남은 프레임 항목을 다시 확인했다. `project_support/tooling/frame_scheduling_control.html`은 Cesium, API, 궤도 계산, 외부 자산 없이 10초 RAF 간격을 측정하며 선택적으로 작은 Canvas 도형을 그린다. 원자료는 `data/workspace/validation/performance/t032_frame_control.json`에 실패 기록까지 보존한다. 제품의 30초 3회 수용 시험을 대체하지 않는다.

초기 순수 RAF p95는 1280×720에서18.6ms(537개), 1920×1080에서18.2ms(554개)였다. 1920 Canvas p95는18.6ms(555개), 1280 Canvas 재측정은18.1ms(555개)였다. 초기 1280 Canvas는23개/p951011.8ms로 비정상이며 삭제하지 않았다. 종료 시 visible/focused였다는 정보만으로 측정 중 전경 유지까지 입증할 수 없다. 브라우저 제어 호출도 한 차례 약5134초 지연됐으며 정상 수용 증거로 사용하지 않는다. 일부 진단은 회귀시험과 겹쳐 단독 부하 시험으로 주장하지 않는다.

계산 없는 페이지에도16.7ms 미달이 나타나므로 앱 계산만이 원인이라는 근거는 부족하다. CPU 최적화만으로 목표를 달성한다고 약속하거나 FPS 기준을 낮추지 않는다. 제품 소스 및 표시 품질을 변경하지 않았고 최적화 round3는 사용하지 않았다. 실제 표시 경로를 확인할 환경에서 재측정하는 항목을 T032에 유지한다. 전원, 주사율, 브라우저 설정 변경 없음.

회귀시험 종료 후 같은 페이지에서 별도로 10초씩 재측정한 결과는 아래와 같다. 원자료의 마지막4개 trial이며 기존 실패를 대체하거나 제외하지 않는다. RAF 간격 진단으로서 GPU presentation이나 물리 화면 주사율의 직접 측정은 아니다.

| 해상도/모드 | 표본 | p95 ms | p99 ms | max ms |
|---|---:|---:|---:|---:|
|1280 순수 RAF|553|18.5|18.6|19.0|
|1280 Canvas|555|18.5|18.6|18.9|
|1920 순수 RAF|552|18.5|18.7|19.6|
|1920 Canvas|555|18.5|18.7|19.2|

재현: 전용 폴더에 진단 HTML만 복사하고 localhost HTTP 서버로 연다. 두 해상도에서 Canvas 체크 해제/체크 각각 Start 10s를 실행하고 완료까지 페이지를 전경에 둔다. DOM 결과의 전체 trial을 JSON으로 보존한다. 이 도구는 제품 초기화 경로에서 로드하지 않는다.

회귀 재실행: 기본 pytest 임시 디렉터리 접근 문제로135 PASS/107 setup ERROR가 발생했다. 새 프로젝트 내부 `--basetemp`를 지정한 재실행은242 PASS/109.66초/기존Starlette 경고1이었다. Node82 PASS/294.26ms. 이전 성공으로 이번 오류를 덮지 않는다. 제품 Rust/wheel 변경이 없어 native 시험은 이전 기록을 유지하고 새 실행으로 표현하지 않는다.
