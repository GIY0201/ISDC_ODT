# T049 저장 ISS 거리·도플러 검증

2026-10-04. FR012/SC010 → R003/R005/R006/R007. W03-D / T045~T049.

선배 oisl.js::pointingTo의 상대 위치·속도 내적/거리 식을 ITRF SI 단위로 적용했다. 기존 Rust Nx6 전파와 TEME→ITRF 속도 변환을 재사용한다. 광학 LOS/짐벌/품질 휴리스틱은 이식하지 않는다. 신규 POST /api/orbit/radio-geometry는 읽기 전용 단일 UTC 조회이며 기존 samples/visibility와 RF/route/contact API·계산을 보존한다.

## 자동 검증
- Python 신규 모듈 미존재 collection RED, 실제 assembly 미조립 RED 이후 구현. runtime 부정 provenance/고도각 주입 RED 3 FAIL/1 PASS → 보완. 공식 MHz 왕복 변환으로 437.82500000000005가 되던 화면 출처 오류도 시험 RED 후 검증된 frequency_mhz 직접 적용으로 수정.
- 전체 Python **349 PASS / 116.61초 / 기존 Starlette 경고1**. 프로젝트 venv로 pytest -q --tb=short, basetemp/cache_dir 모두 data/workspace/validation/radio 아래 지정. pytest_full02.log가 최종 근거.
- 전체 Node **122 PASS / 393.7302ms**. node --test project_support/tests/browser/*.test.mjs, node_full02.log.
- 접근/이탈/횡방향 합성 수치·단위·주파수 배율·비유한/일치 위치 거부. 실제 native 전파의 거리 중앙차분 h=1/0.1/0.01초 오차 각각 0.1m/s 미만. 별도 Astropy 좌표 구현과 위치 1e-5m/속도·거리 변화율 0.1m/s 허용 범위 비교. 공통 ERFA·이론이 있어 완전 독립 물리 검증이나 실제 정확도 주장은 아니다.
- strict 422/선택409/계산기503/EOP범위422, 조회 중 선택 변경 stale, 입력·주파수·UTC·hash·지점 echo, 실패 numeric null, controller 취소/generation/종료/원격 같은값 무효화/윤초 입력 검증. 기존 API 호환 시험 통과.
- 읽기 전용 최종 재검토: 잘못된 고도각/EOP/윤초 출처 거부 및 정합 입력 허용 직접 재현. 추가 수정 결함0. 기존 scalar/vector 및 samples/visibility 관련 정의 12개 HEAD AST 보존 확인; 기존 RF/route/contact 계산 보존 확인.

## 실제 브라우저
고정 **8891** IAB 1280×720 및 1920×1080. 저장25544/TLE와 서버 UTC를 명시 복사, 공식 프로파일 조회 후 명시 주파수 적용, 실제 API 결과 정상. 공식 주파수 입력 정확히 437.825 MHz, 출처 표시 정상. 1280 최소화/복원 결과 동일, 주파수0 실패/이전 결과 폐기/사용자 가정으로 전환. 1920 재조회와 위성↔지상 창 전환 결과 유지, RF/지점 입력16개 전후 동일, Cesium canvas1, console error0. viewport reset. 원격창은 DOM assembly 시험이며 OS 별도창 검증으로 주장하지 않는다.

표본 UTC 2020-07-12T21:16:01.000416000Z / revision1: 거리11935.631556km, 변화율−3016.830789m/s, 고도각−64.010731°, 송신437.825MHz, 도플러(수신−송신)+4405.861138Hz, 수신 예측437.829405861MHz. 선택 최소고도각 미충족 표시. 이 2020 저장 궤도는 현재 ISS 관측값이 아니다.

원자료·실패·ui_proof.json·radio_1280.png/radio_1920.png는 ignored data/workspace/validation/radio에 보존. 기본 pytest 임시경로 권한 오류는 프로젝트 내부 basetemp로 해결. 최초 Stop-Process 실패와 동일8891 bind 실패를 보존하며, 소유한 기존 exec 서버 Ctrl-C 종료 후 동일8891에서 재시작했다. 현재 프로젝트 서버는 PID7748이며 다른 서버나 포트를 변경하지 않았다.

## 의미와 범위
단방향 1차 하향 Doppler: 수신−송신 = −f0×range_rate/c. 동일 UTC ITRF 고정 지점 속도0, LOD0, 극운동 변화율 무시. 광행시간·상대론·대기·발진기 오차 제외. RF 입력이나 실제 수신 장비를 자동 조정하지 않는다. 실제 통신/장비 수신 unknown.

이번 FR012/SC010 및 T045~49 구현·검증 묶음 완료. F001전체/F002/F004~6, 사용자 보류T032/SC006, W04 임무와 다른 후속 기능·실제 AerODT 연계는 미완료 유지. PR16 위 codex/iss-radio-geometry stacked Draft PR로 리뷰하며 자동 병합하지 않는다.
