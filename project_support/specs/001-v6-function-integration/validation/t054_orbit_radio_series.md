# T054 가시 구간 거리·도플러 변화 검증
2026-10-04. W03-E / FR013/SC011 → R003/R005/R006/R007 → T050~54.

## 구현과 재사용
기존 가시 구간 결과에 선택 버튼을 붙이고, 선택 구간의 거리·고도각·도플러 그래프3개와 표본 요약을 V6 지상국/위성 창에 연결했다. 선배 상대속도식, 기존 Rust Nx6/ITRF 속도 변환과 단일 radio 계산을 재사용한다. series 요청당 native 전파1회 및 bounded executor1회. SI TAI grid로 시작/종료를 포함, 0<duration<=86400초, count=min(601,ceil(duration)+1). 계수나 물리 근사는 변경하지 않았다.
신규 POST /api/orbit/radio-series와 immutable 내부 계약, ADR0009. 기존 single row 검증을 simulation의 공통 함수로 추출해 같은 검사 사용. 기존 endpoint/wire 유지. 가시 구간 선택은 기존 조회 결과 사본/clip을 전달하며 radio 서버가 가시 경계를 다시 확인한 것으로 주장하지 않는다. import IO/native wheel 변경 없음.

## 자동 검증
- Python 제품 구현 전15 FAIL(미존재 callable/endpoint404). Node 모듈 미존재 RED 및 실제 assembly 미조립2 FAIL. 단일점 segment가 안보이는 review defect는 circle0 !=6 RED 확인 후 marker 구현.
- 전체 Python 최초 **363 PASS/1 FAIL**: HTTP 스키마의 simulation 직접 import가 architecture 경계를 위반. 기존foundation 시간차로 wire 범위 검사 변경 후 focused23 PASS18.01s 및 전체 **369 PASS125.17초/기존 Starlette 경고1**. 최종pytest_full02.log, 초기실패pytest_full01.log 모두 보존.
- 전체 Node **129 PASS432.6794ms**. node_full03.log. 신규7개는 controller/3그래프/요약/출처/경합/gap/실제조립 두해상도 검사이며 기존122개 포함.
- Python batch/scalar 실제 native 수치일치, .25/10/7200/86400초 bounds2/11/601/601 및 요청별 native 호출1회, 윤초23:59:59→60→00:00:00 SI2초/3행. native 부분/전체실패 numericnull, 422/409/503/readonly, selection변경stale, injected잘못된hash/개수/간격/고도각 거부. 기존 전체과학/설치/API/계층 회귀 통과.
- Node 정확 UTC 순서/양끝/간격/메타데이터/실패상태 일치/선택과hash/주파수/단위/Doppler식 검사. 같은값 원격 주파수 편집·취소·새조회·종료/late discard, 소유사본 보호. SVG 오류 gaps, 고립 표본circle, 부분실패 전체요약 억제, clipped 및 접근/이탈, 표본중 min/absmaxshift 명시. 단일UTC row validator 재사용.
- 최종 읽기전용 리뷰 추가결함0. 원래 물리식/단일계산/samples/visibility/기존HTTP/schema17개 정의 AST 동일, validation block 추출만 동작보존. 실제단일/series수치시험 포함. diff --check PASS.

## 실제8891 브라우저
자신이 소유한 exec 개발서버를Ctrl-C로 종료하고 동일8891에서 재시작. 최종 PID10124/session47772, 새포트/다른서버 종료없음.
IAB1280×720 및1920×1080: 저장25544/TLE→24h 기하 가시4구간→2번째 선택→공식프로파일 명시조회/437.825MHz 적용→series 실제API→SVG3개. 1280 최소화/복원 결과동일, 주파수0 오류/출처가정/기존결과 폐기, 명시재적용 정상. 1920 위성↔지상 전환과 재조회 후 RF/지점/조회18개 입력 전후동일, canvas1, consoleerror0. 확장/스크롤 확인, viewportreset.
표본: UTC2020-07-13T12:50:48.559009750Z→12:57:28.855884750Z, SI400.296875초/402개/간격0.998247초. 접근→이탈, 표본중최근접12:54:08.208323964Z/448.554997km, 절대shift최대 부호+9865.214492Hz(시작UTC). 최신ISS나실측값아님.
짧은내부범위12:51:18.559009750Z→12:52:18.559009750Z: 양끝잘림/61표본/1초간격/접근만 표시, 실제패스시작종료라고표시하지않음. epoch+1분조회는구간0/선택초기화/결과폐기. 정상24h/2번째구간으로화면복원했다. 실제OS별도창원격이 아니라DOM assembly시험은별도구분.
원자료/실패/스크린샷series_1280.png/series_1920.png/ui_proof.json은 ignored data/workspace/validation/radio_series 보존. UI 조작은 실제요소를사용, 평가로API호출/내부상태주입없음.

## 한계와 완료 경계
표본중최근접/절대Doppler최대이며 continuous extrema를탐색하지않았다. 오류행은연결하지않고부분실패이면전체요약미확인. 동일UTC·단방향1차/LOD0·극운동변화율무시,광행시간·상대론·대기·발진기오차제외. 실제 수신/장비상태unknown, 장비자동조정/RF자동입력없음. 게임60Hz/새성능수용시험성공으로주장하지않음.
이번T050~54/FR013/SC011묶음완료. 최초 선배기능→V6/독립AerODT구조목표/F001전체/F002/F004~6/다른PC·실제AerODT연계/T032보류 유지. PR17위codex/iss-pass-radio stacked Draft PR리뷰, 자동병합없음.
