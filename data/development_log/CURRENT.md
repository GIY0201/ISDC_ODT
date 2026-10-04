# 현재 개발 기록

## 2026-10-04 W03-D ISS 거리·도플러
- 변경: 선배 상대속도식과 기존 Rust 전파/ITRF 속도 변환을 재사용해 읽기 전용 단일UTC 조회 및 V6 위성 패널 연결. 공식 주파수 명시 적용, 취소/출처/늦은 결과 방어. ADR0008.
- 검증: 전체 Python349 PASS116.61s/기존경고1, Node122 PASS393.7302ms, 실제8891 두해상도/입력오류/복원/GP·RF16입력보존/console0, 읽기 전용 최종 리뷰 결함0. validation/t049_orbit_radio.md.
- 남음: 실제 수신·장비 unknown, F001전체/F002/F004~6/T032보류. PR16 위 stacked Draft PR 리뷰, 자동병합없음.


## 2026-10-04 RF 최종 검토 보완
- 변경: Unicode 링크 이름 길이를 기존 서버와 같은 code point40자로 검사. emoji40/41 RED→PASS 및 실제API/UI 확인. 서버 계산/API/schema 보존.
- 최종검증: 전체Python304 PASS103.50초/기존경고1, Node95 PASS313.47ms. 보고서 t036_rf_workspace.md.
- 남음: 별도Draft PR 리뷰/병합, 필수F001, 전체F002, 사용자보류T032.

## 2026-10-03 W03-A RF 계산기 V6 연결
- 변경: 선배 RF 서버 계산/API/schema를 보존하고 V6에 편집11개/출력8개/가정·실제통신미확인 패널 및취소/echo/422 처리 연결. runtime/GP/UTC 소유권 보존. AST7개 원본동일.
- 검증: 전체Python304 PASS108.66초/기존경고1, Node95 PASS317.33ms, 실제IAB1280×720/1920×1080 HTTP정상·모델여유부족·입력오류·창복원/역할전환 확인. 새Node 모듈/패널 RED→PASS. validation/t036_rf_workspace.md 참조.
- 남음: F001 실제통신조건 조사·적용 필수, F002 전체기능, 사용자 보류T032/SC006 유지. 별도Draft PR 리뷰/자동병합 없음. 신규native/wheel 검증 아님.

## 2026-10-03 T032 프레임 대조군 진단
- 변경: 계산/Cesium/API 없는 10초 RAF 및 Canvas 진단 도구 추가. 제품 동작과 환경 설정은 변경하지 않았다. 원자료와 실패 기록을 로컬 보존, validation/t032_performance.md 참조.
- 결과: 순수 RAF p95 1280 18.6ms/1920 18.2ms, 정상 Canvas 18.1~18.6ms. 앱 계산만의 병목이라고 단정할 수 없다. 비정상23표본/약1초 간격과 브라우저 제어 지연도 보존. 제품30초 수용시험 대체 아님. 회귀 종료 후 별도 재측정 추가.
- 검증: Python 기본 임시경로에서135 PASS/107 setup ERROR 후 프로젝트 내부 새 basetemp로242 PASS109.66초/기존 경고1. Node82 PASS294.26ms. Rust/wheel 변경 및 새 native 실행 없음.
- 남음: T032[ ]/SC006 프레임16.7ms 미달 유지. 표시 경로 재검증 필요, round3 미사용, 목표/정확도/최초 전체 범위/F001 실제 통신 조건을 유지. PR13 Draft 리뷰 및 자동 병합 없음.

## 2026-10-03 T032 하루 조회 개선, 프레임 기준 미달 유지
- 변경: 정확UTC 포맷 및 내부 readonly UTC/EOP/ITRF/고도각 벡터주입으로 하루중간문자열/객체비용을 줄였다. 기존scalar/wire/권위상태/1초grid/40회극값/0.01초경계/윤초·오류 유지. callback Time 사본 보호를RED→PASS로 검증. opt-in EventTiming/trial guard/UserTiming와 실제presentation trace 분석 추가. ADR0006/validation/t032_performance.md 참조.
- 검증: 전체Python242 PASS113.49초/기존Starlette경고1, Node82 PASS351.32ms, product Cargo release locked offline integration1 PASS(공식33입력668상태), 실제TCP inputs2/samples3/visibility1/409/UTC보존/health PASS. 동일자료4구간/peak/각도/provenance exact일치. diffcheck PASS.
- 실제두해상도: 100다른UTC/20다른24h/30초완료3trial, 실제presentation p9518.578/18.552ms FAIL. UTC32.0/32.1ms PASS, 관측EventTiming48ms(16ms threshold/8ms반올림). 최종보호후추가각20일조회 p95543.1/547.3ms PASS. 환경/전체gzip trace/GPU/hash/profile/실패표본/screenshot 로컬보존.
- 남음: SC006/T032 부분완료이며16.7ms 및실제60Hz표시전제 재검증 필요. 환경/전원/주사율변경없음. F001실통신/F002전체선배기능/F004/F005/F006/다른PC·실제AeroDT 연결 미완료. codex/orbit-performance는 PR12에 의존한 별도 Draft 리뷰이며 자동병합없음.

## 2026-10-03 T028/T029/T030 검증 묶음 및 성능 미달
- 변경: 정확UTC/EOP/native/geometry/극값round batch와같은지점Cesium property 재사용, opt-in실제UI계측/분석도구 및 batch15·설치2 회귀시험. dated제품wheel/선택Python DLL출처·hash/LICENSE·RECORD 검증. ADR0005 및 feature validation/t028_performance.md,t029_install.md,t030_review.md에 결과·한계 기록. 원본자료/환경/과거wheel/legacy/합의 보존.
- 검증: 최종Python224 PASS(107.80초,기존Starlette경고1), Node77 PASS(256.24ms), 제품cargo release locked offline integration1 PASS(공식33입력668상태), 실제TCP 입력2/샘플3/구간1/409/선택UTC보존/health PASS. 새venv offline/-I 프로젝트밖 native호출2 PASS. diffcheck PASS.
- 실제IAB1280/1920: 각다른UTC100회/24h20회/30초완료3trial. 1920중단trial은 별도보충/원문보존. UTC p95 44.0/43.6ms PASS; 하루p95 2266.0/2197.8ms FAIL. RAF/두RAF피드백 미달, 실제GPU60Hz 제출경로 미입증. 데이터/EOP/윤초hash·환경/GPU/전원·trace/profile·screenshot은 data/workspace/validation/performance 보존. Chrome가림probe는수용표본아님.
- 개선: 동일1000행중앙0.65630→0.02685초, 하루중앙5.23572→2.06527초,4구간경계/peak차이0초/0도. 정확도/grid/오류/자료계약과목표는유지. 게임성능달성이나실측통신증거가아님.
- 상태: 초기31개작업수행,SC006미달T032추가(Converge HIGH partial1/tasks_appended). verify3회개선후에도미달,fullyverified완료아님. F001실제통신/F002전체기능/F004/F005/F006 및다른PC·AeroDT실제연결미완료. PR11의존branch에서리뷰하며자동병합없음.

## 2026-10-01 단계별 개발 및 실제 통신 조건 요구 기록
- 변경: project_support/specs/001-v6-function-integration/agreed_scope.md에 사용자 합의와 실제 통신 조건 확인/적용의 후속 필수 요구를 기록했다. 초기 전체 이식 초안보다 합의 범위를 우선한다.
- 검증: 문서 간 상대 링크와 필수 요구 문구를 확인했다. 이번 변경은 문서만이며 기능 시험을 새로 실행하지 않았다.
- 현재 상태: application/UI/API/계산 구현 변경 없음. 이전 전용 환경 기준 Python 시험 35 PASS는 기존 프로토타입 기준선 증거다.
- 남은 위험: 통신 서비스/장비 사양과 실제 수신 자료 미확인. 고도각 10도는 시험 조건이며 실장비 기준이 아니다. 통신 기능 구현 및 완료 판정은 아직 하지 않았다.

## 2026-10-01 최신 speckit-auto로 작업 기록 복구
- 변경: 기존 feature의 workflow-progress.md에 최초 목표, R001-R010 요구, 결정, F001-F004 후속 항목, 단계 상태와 실제 증거를 연결했다. 기존 합의/초안/코드는 보존했다.
- 검증: 참조 채팅 2개와 최신 skill 및 프로젝트 규칙을 읽었다. 기록의 요구/후속 연결을 정적으로 확인했다. 새 기능 시험은 실행하지 않았다.
- 상태: constitution/spec/plan/checklist는 최신 합의 반영 전 stale. 구현 미진행. 다음은 원칙 충돌 정리와 기존 명세 검토다.
- 위험: 실제 통신 조건 조사와 적용, 성능 목표, 전체 기존 코드 비교 및 새 UI 실행 검증은 남아 있다.

## 2026-10-01 첫 단계 명세 검토안
- 변경: constitution 1.2.0의 JS 기준/지속 추적 반영, spec 첫 단계 개정, 초기 문서 보존 및 품질 체크 갱신.
- 검증: template resolver 성공, hook 파일 없음, 요구 연결과 문서 구조 검토. 기능 시험 미실행.
- 남은 사항: 정확도/성능 정량 기준 공동 검토, 계획 stale, 구현 pending.

## 2026-10-01 검증 목표 검토 제안
- 변경: 정확도/사용성 목표를 미승인 제안으로 작성하고 clarify 질문 기록.
- 확인: prerequisite JSON에서 기존 feature 경로 확인, 공식 검색 자료 조사. 일부 웹 본문 fetch 실패.
- 상태: 실제 정확도/성능 시험 없음, 합의 답변 대기, 코드 변경 없음.

## 2026-10-01 정확도 검증 의미 합의
- 변경: 사용자 동의를 spec Clarifications와 SC-002에 반영. 실제 위치 오차 평가는 F005 후속으로 기록.
- 검증: 문서 연결 확인만, 수치 계산/성능 시험 없음.
- 남은 사항: 성능 목표 및 수치 허용 오차 검토, 계획 stale 유지.

## 2026-10-01 게임 기준 사용성 요청 반영
- 변경: 사용자 게임 기준 지시를 명세/추적에 기록, 60fps와 즉각 피드백 목표안 작성.
- 검증: 문서 수치 일관성 확인만. 실제 프레임/지연 측정 없음, 소스 변경 없음.
- 남은 사항: 구체 목표 검토 및 정확도 오차/기준 자료 선정.

## 2026-10-01 성능 목표 합의 반영
- 변경: 사용자 동의를 SC-006과 검증 목표 문서에 반영.
- 확인: 합의 수치와 측정 조건의 문서 일치 검토. 실제 성능 시험 없음.
- 남은 사항: 수치 정확도 허용 오차 검토, stale 계획 개정.

## 2026-10-01 첫 단계 명세 합의 완료
- 변경: 정확도 목표 사용자 동의 반영, checklist 6/8에서 8/8로 갱신. specify/clarify 문서 단계 완료.
- 검증: 요구/목표 문서 일관성 검토만, 계산/브라우저/성능 시험 미실행.
- 남은 사항: 기존 계획 재작성 및 설계 검토, 후속 전체 기능/실제 통신 조건 적용.

## 2026-10-01 첫 단계 설계 Phase 0
- 변경: 기존 plan/research를 합의 범위로 개정, 초기 설계 자료 보존.
- 확인: 실제 궤도 계산/렌더/API 조립/가까운 시험 정적 조사, 공식 문서 조사.
- 결과: 기존 pass 계산의 5도/45초/3개 제한과 높이 미반영 확인. 새 설계는 계산/표시 분리.
- 한계: 라이브러리/fixture 해시/좌표 시간 계약 게이트 미해결. Phase 1 미완료, 수치/성능 시험 미실행, 코드 변경 없음.

## 2026-10-01 Rust 계산 코어 재검토
- 사용자 의견: Rust/C++ 고성능 계산 및 AeroDT 연결 시 추가 설치 허용 검토.
- 변경: 기존 합의 보존, 계산 코어 선정만 재검토로 추적.
- 조사: 공식 Python sgp4 C++ 가속 경로, PyO3/FFI 문서 확인. 실제 설치/성능 비교 없음.

## 2026-10-01 Rust 후보 조사
- 변경: rust_core_review.md 및 연구/작업 기록 갱신.
- 확인: 공식 후보 문서/라이선스/배포 자료, PATH 도구 조회.
- 결과: sgp4 2.4.0 우선 후보, 기본 상수/모드 일치 확인 필요.
- 한계: 실제 설치/build/정확도/속도 시험 없음.

## 2026-10-01 Rust 기준 패키지 확보
- 검증: 공식 archive SHA256/릴리스 라이선스/시험 source 및 33 입력/668 기대 상태 inventory 확인.
- 환경: Rust/MSVC 표준 설치 경로 미확인.
- 한계: cargo 시험/benchmark/배포 설치 미실행. 시스템 빌드 도구 설치 논의 필요.

## 2026-10-01 승인된 Rust/MSVC 환경 설치
- 설치: Rust/Cargo1.98.1(프로젝트 경로), BuildTools17.14.41/MSVC14.44.35207/SDK10.0.22621.0. installer0, 재부팅 불필요.
- 검증: cargo release build 성공, unit9/propagation1 PASS(33입력668기대상태). doc9PASS/1FAIL, 전체exit101.
- 실패: live CelesTrak doc 예제 네트워크 실패, 허용 재시도 peer certificate expired. TLS 검증 유지.
- 변경: 프로세스 환경 활성화 helper/.gitignore, 시험 receipts/문서. 앱 소스 변경 없음.
- 남은 사항: C++ 성능 비교/직접fixture대조/PyO3 wheel/좌표변환/웹.

## 2026-10-01 Rust/C++ 동일 조건 benchmark
- 변경: 격리 benchmark 도구/전용 Python environment, 결과 문서/원본report. 앱 소스 변경 없음.
- 확인: C++ 확장 native build accelerated=True, Rust release compile, 동일 ISS AFSPC 위치차이10m 게이트 통과.
- 결과: 86400배치 Rust18.1175ms/C++18.2558ms 중앙값, C++개별호출113.4258ms. 성능 동급이며 작은 차이 우열 판정 금지.
- 회귀: pytest35PASS/경고1(3.47초).
- 한계: PyO3/좌표변환/가시구간/API/웹 미측정. 전체 UI 목표 및 실제 위치 검증 아님.

## 2026-10-01 Rust/Python batch 계약 검토안
- 변경: 입력/원시TEME 단위/오류/메모리/상태 소유권 및 최신 요청 채택 계약 작성.
- 확인: 기존 내부query/snapshot 계약과 책임 정적 검토. 문서만 변경, 추가 기능 시험 없음.
- 남은 사항: 최소PyO3 wheel/경계 비용/변환 계약. plan research running 유지.

## 2026-10-01 Rust–Python 연결/버퍼 검증
- 변경: 검증전용PyO3 wheel 및 반환 방식 비교 도구, process helper Cargo PATH 순서 수정, 문서/ignore. 제품 source 변경 없음.
- 결과: probe9PASS/project35PASS경고1,별도venv(system-onlyPATH)import/계산 성공.
- 성능: 86400 list57.1567ms/buffer20.0098ms/C++20.0791ms 중앙값. 수치 위치차이10m 게이트통과.
- 한계: 같은PC의CPython3.14만, 실제API/웹/좌표변환/패스/통신 미검증.

## 좌표 및 고도각 설계 조사
coordinate_time_review.md에 공식 Vallado 위치 fixture, UT1/극운동/관측점 높이 입력과 오프라인 출처 계약 검토안을 기록. 제품 소스 변경 없음. 공식 문서 및 연구 담당 읽기 전용 결과 확인, 실제 좌표 수치 시험과 신규 pytest 실행 없음. 자료 snapshot/해시와 고도각 기준 및 구간 검증은 남아 있다.

## 좌표/time 연구 실행 결과
coordinate_probe_results.md 참고. 공개fixture1.33cm/고도각비교8641시각/가시경계8개 일치. IERS/윤초 snapshot 해시 고정 재실행 통과. sandbox download 및 Path 인자 오류 수정. 시스템Python pytest FastAPI부재 실패, 프로젝트환경으로 재검증. 제품코드 변경 없음, 공유ERFA/짧은구간/윤초/Rust통합/웹/실통신 검증 한계 유지.
회귀 최종 명령: project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/coordinate_probe_20261001/pytest_temp --tb=short. 35PASS/경고1,2.54초. 기본 임시경로 setup오류10 후 내부basetemp 재실행 통과. 현재 수치연구의 제한과 제품미구현 상태 유지.

## 2026-10-01 현재 계산 검증 묶음 완료
사용자 요청에 따라 중간 승인 없이 현재 계산 연구의 나머지 검증을 실행했다. 최종 확장시험 17 PASS / 실패0 / 오류0, 기존 Rust Python 연결9PASS, 프로젝트 회귀35PASS/Starlette경고1(2.52초).

| 항목 | 최종 증거 |
|---|---|
| 공식 위치 변환 fixture | 차이0.0132868m |
| Rust 전파→Python 변환/고도각 86401시각 | 위치차이 6.77776134823071E-06m, 고도각차이 1.89004367712187E-11도 |
| 실제 10도 구간 | 1초 전범위 탐색의 교차8개, 기준 경계차이 0.017822265625초 |
| 짧은 구간/짧은 공백/접점 | 샘플 사이0.2초 구간과 공백, 접점 분리 통과. 실제 궤도의 높은 임계값에서 약0.08785초 구간 탐지 |
| 잘림/없음/전구간 | 확인 통과 |
| 날짜/윤초 | TAI 1초 연속, UTC JD convention, 고정 EOP 변환 확인. 합성 epoch TLE Rust/C++ 윤초 양쪽 비교차이 1.94852739565509E-08m |
| 범위 밖/손상/NaN/Inf/비단조/중복 | 저장EOP범위밖1900/2100 거절, 손상TLE와 비유한입력 오류, 시각순서 보존 확인 |
| 관측점 기하 및 입력정책 | 바로위90도/지평선0도/아래-90도, 잘못된 좌표 검토정책 확인. 제품API 검증 아님 |
| 속도 변환 | 지구회전 항 포함, 명시적 LOD0 Astropy 비교차이 5.41994292579396E-05m/s, 합성LOD2ms 민감도 확인 |
| 86400시각 계산 전체 경로 | 중앙값 80.14ms / p95 90.88ms |
| 하루 가시 탐색 및 경계 보정 | 20회 중앙값 100.08ms / p95 103.47ms, 1초 목표 통과 |

### 재현과 제한
validate_extended.py 명령은 validate.py와 같은 격리Python으로 실행한다. extended_report.json에 원시20회시간/소스해시 기록. 공식 Vallado PDF snapshot SHA256: 538a5c0ea174eb569bbc258011717142a26d72871ab07cc64ee5fa3773164b16. IERS/윤초 snapshot은 앞 기록과 같은 해시로 확인한다. 범위밖2100 입력의 ERFA dubious-year 경고는 예상 입력 오류 시험에서 발생했고 오류를 정상 거절했다.

현재 계산 연구용 도구에서 실행한 검증 묶음은 모두 통과했다. 제품 기능 전체 검증 완료가 아니다. Rust는 전파, Python은 좌표/고도각인 조합을 검증했으며 Rust 좌표 커널은 작성하지 않았다. 공통 ERFA 함수를 쓰므로 독립이론검증이 아니고 extrema 기반 탐색은 매끄러운 고립 극값 가정 안에서 검증했다. 1초 조밀 탐색만으로 임의의 모든 접점/짧은 구간 발견을 보장하지 않는다. 실제 통신/Doppler, 실측ISS위치, 다른PC배포 및 UI60fps/입력반응/서버동시성은 후속 단계 검증이다. 통신조건(F002)과 전체 V6 기능 연결 목적은 보존했다.

최종 계획에는 UTC JD 전파 규약, EOP범위거절, 접점별도결과 및 짧은구간의 극값 보완 탐색을 반영할 것을 권고한다. 이번 시험이 제품 코드에 이를 적용한 증거는 아니다.

## 2026-10-01 첫 기능 파일 배치/계약/작업 목록
변경: feature plan/data-model/orbit_api/workspace/quickstart/기술선정문서 갱신, 기존문서 review_history/20261001_before_phase1 보존. tasks30개(US1 8/US2 5/US3 4/공통13), 모든checkbox 미완료. R001~010 계획/작업 연결과 F001실통신/F002후속연결 ID 혼용 정정. V6 원본hash기록. 제품코드수정없음.
검증: setup-plan/setup-tasks/prerequisite JSON 성공, extensions.yml 없음, strict checklist format 오류0. 이번turn pytest/Node/브라우저 신규실행없음. 이전61PASS는연구/기존회귀증거이며제품완료아님.
다음: 공동설계검토와read-only analyze 이후 최소US1 구현. 게임UX/실제통신/배포환경 미검증상태유지.

## 전체 요청 범위 보완
full_integration_plan.md에원래기능전범위와V6업무별연결근거를작성하고현재첫상세계획과구분했다. V6별도창보존공백을T031로보완,원래30task ID보존. 기능코드변경없음. 현재는분석준비단계이며문서검사와원본코드/V6읽기만실행했다. 전체제품상세계약이끝났다고주장하지않는다.
read-only일관성분석: 첫묶음14기준/31task, critical/high finding0, 형식오류0/미배정0. 전체범위는full_integration_plan.md의10묶음/16업무표로추적하며후속상세계약미작성상태유지. 분석보고후controller기록만갱신,제품코드변경없음.

## 2026-10-01 T001~T004 제품 입력/시간 구현
- 변경: ADR0001, 환경잠금/제품native빌드도구 준비, foundation/orbit_time.py, data/orbit_inputs.py, earth_orientation.py, contracts/orbit.py, configs/orbit.py. 저장원문SHA256/TLE체크섬/OMMdefaults/필수입력, 정밀UTC/윤초/SI재생시간 및snapshot범위거절. 기존API/UI/SIM계산수정없음.
- Red: 새모듈없음2collection오류,필수OMM누락4KeyError 실패. 해당도메인입력오류를ValueError로수정. 첫basetemp부모누락/시스템temp권한/cache경고는workspace별test/cache경로로정정.
- 검증: project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/orbit_implementation_baseline/pytest_metadata -o cache_dir=data/workspace/validation/orbit_implementation_baseline/pytest_cache --tb=short ->56PASS/기존Starlette경고1/3.37초. pip check 충돌없음. PSbuildscriptparse0/미구현product manifest 거절PASS. git없음은예상확인결과이며Git초기화안함.
- 남은범위: 31개중4개완료. native제품코어/API/V6/게임UX/portablewheel아직미구현·미검증. 처음목적/통신실제조건/선배전체기능추적유지.


## 2026-10-02 Rust 제품 계산 경계 T005/T006
- 변경: Rust sgp4 2.4.0 / PyO3 0.29.2 제품 crate, lockfile 및 cp314-win_amd64 wheel과 communication/native/orbit_adapter.py 구현. 연구 probe를 제품에서 import하지 않는다. TLE/OMM WGS72_AFSPC, TEME km/km/s, UTC 순서와 중복 유지, GIL 해제 및 소유 bytes. 실패 행은 오류코드와 함께 유지하고 typed adapter row는 None, valid_rows는 실패를 제외한 읽기전용 배열을 반환한다.
- 검증: 시험 먼저 작성해 제품 모듈 누락 실패 확인. 공식 fixture33입력668상태 Rust integration 1 PASS와 Python 비교 PASS. TLE/OMM 동등 입력, 잘못된 값/상한/버퍼불변/실패행 분리 확인. 전체 pytest60 PASS/기존 Starlette 경고1(3.53초), pip check PASS. 결과/소스hash는 data/workspace/validation/native_implementation에 저장.
- 수정한 실패: wheel 모듈명은 lib name을 명시해 해결. Windows fixture decoding 실패3개는 UTF-8 지정 후 전체 재실행으로 해결.
- 현재 상태: T001~T006, 6/31 완료. 기존 API/WS/UI 변경 없음. 다음 T007/T008 좌표변환/고도각 제품 시험과 구현.
- 남은 위험: wheel에 빌드 환경 zlib.dll이 동봉됨. 외부 DLL license/격리설치/배포지원 검증 T029 미완료. native batch86401은 24h1초+끝점의 내부 메모리 상한이고 HTTP count3601과 별개. 실제브라우저 성능, 실제 ISS 위치 및 F001 실제통신 조건, F002 전체후속기능 연결은 미완료.


## 2026-10-02 좌표변환/고도각 제품 구현 및 검증 T007/T008
- 변경: digital_twin/simulation/orbit_geometry.py의 WGS84 관측점, 주입 UTC/EOP의 TEME km -> ITRF m, 회전항 포함 속도 m/s, ENU 기하학적 고도각 deg 구현. 파일/네트워크/현재상태 접근 없음. 입력과 결과 소유권 분리 및 bytes 기반 수정불가 배열 반환. 기존 궤도/API/UI 계산 변경 없음.
- 시험 우선: orbit_geometry 누락 수집실패 확인 후 구현. 공개 Vallado Appendix C 위치 fixture와 metadata/hash 추가. WGS84 적도/극/고도, 위/지평선/아래/10도, 좌표 오류/비유한/boolean/complex/문자열/길이/EOP혼용, 관측점일치, 빈배치, immutable/입력사본, Rust 제품 ISS -> 변환/고도각, 윤초 및 LOD 회전항 시험18개.
- 결과: 공개 위치 사례 오차0.013286801192m(<0.3m 게이트). 24h361개시각(240초간격) Astropy 비교 최대 위치차1.919970673e-9m, 고도각차7.460698725e-14도(<0.01도), 속도차5.430054537e-5m/s(<0.01m/s). 전체pytest78 PASS(기존60+새18), 기존Starlette경고1,4.96초. pip check PASS(동일환경). results.json/metrics.json/source_hashes.json은 data/workspace/validation/geometry_implementation에 기록.
- 회귀에서 발견한 규칙 불일치: simulation -> immutable contracts가 기존 검사 허용 목록에 없어1실패/77PASS. 현재 typed입력 설계에 맞춰 허용 목록과 ADR을 정합화한 뒤 전체 재실행 통과. foundation/communication-native 검사도 추가하여 상위상태/통신 의존 금지를 유지.
- 한계: Astropy와 ERFA 회전함수를 공유하므로 이론적으로 독립 검증이나 실측 ISS 정확도 증거가 아니다. 기하학적 고도각이며 굴절/지형/안테나/RF 미반영. 속도LOD 기본0초,2ms합성감도만 확인,극운동변화율 무시. 361시각 비교는 가시구간 경계/누락 검증이 아니다. 해당 제품검증은 T019 이후 별도 진행.
- 현재 상태: T001~T008,8/31완료. R005/R007/R008/R010의 계산기반 증거 추가. 다음T009/T010 단일 위성/UTC 상태와 runtime 조립 시험/구현, 이후API와V6 연결. F001 실제통신 조건 확인/적용, F002 전체선배기능 연결 및 UI/배포 성능 검증은 유지.


## 2026-10-02 선택/UTC runtime T009/T010 완료
- 변경: RuntimeState의 orbit 구성 요소가 현재 위성/지점/UTC anchor/재생/속도/revision을 소유한다. monotonic anchor 투영, 원자적 expected_revision 검사, frozen selection/snapshot/query rows를 추가했다. 샘플 query는 사본으로 계산하며 선택상태를 변경하지 않는다. 오래된 결과는 원래 revision과 stale=true로 반환한다. 별도 현재상태 캐시를 생성하지 않았다.
- 조립: user_application/web/application.py에서 immutable 입력 조회, EOP/native/geometry 계산, bounded thread executor를 주입한다. user_application/orbit_calculation.py가 실제 Rust -> EOP -> ITRF m -> 고도각 deg 행과 hash를 조립한다. 준비된 입력/EOP 없는 기본앱은 기존 기능으로 시작하고 새 계산은 not-ready로 실패한다. 자동 파일/네트워크 조회 없음. lifespan에서 executor 종료를 기다리며 실행중 native 즉시중단을 주장하지 않는다.
- 계약 정리: GroundPoint를 contracts로 옮기고 geometry에서 같은 타입을 재사용한다. 좌표식/기존 시험을 보존했다. 새 불변 OrbitSelection/OrbitSnapshot/OrbitSample/OrbitCalculation/OrbitQueryResult 계약과 구체 기술경계를 runtime에서 import하지 않는 실행 주입을 사용한다.
- 검증: 먼저 계약 미구현 ImportError를 확인. 새16시험: 정지/재생/속도/UTC, 불변사본, SIM 독립, 충돌, stale/다른요청응답, worker+대기한도, 실행중취소슬롯, 오류복구/종료, 실제 제품 계산/재현/EOP범위, 상한/잘못된결과. 전체94PASS(기존78+새16), Starlette경고1,6.18초. pip check PASS. 결과/소스hash는 data/workspace/validation/orbit_runtime.
- 발견/수정: 완료된 future의 callback보다 await가 먼저 반환하면 슬롯이 일시 점유되어 연속호출이 큐가득으로 실패(92PASS/1FAIL). 실제완료시 동기 반환과 once guard를 넣어 수정했고 100회 순차호출 및 전체회귀로 재검증했다. 2100년 EOP밖 시험의 ERFA dubious-year 경고는 예상 경고로 검사한다.
- 상태: 첫묶음 T001~T010,10/31완료. 계산 중 선택변경 .5초 timeout 시험은 응답가능성 증거이며 UI50ms/60fps 계측이 아니다. 기존 SIM API/WS 및 화면 payload는 변경하지 않았다. 새 /api/orbit endpoint는 아직 없고 T011~T013에서 추가한다. V6 이식/첫시연은 이후T014~T018. F001 실통신, F002 전체후속기능, 브라우저/배포검증은 유지.


## 2026-10-02 Orbit API 및 저장 입력 T011/T012/T013 완료
- 변경: /api/orbit/inputs,state,selection,samples 구현. strict UTC/float/범위/상한/추가필드 검사,404 입력없음/409 충돌과현재state/422 입력·EOP범위/503 계산·native미준비·큐가득. 새prefix validation 응답은 NaN/Inf 원입력을echo하지않아strictJSON 유지. 실패행수치는null,complete/partial/error 및원래revision/hash/단위/stale/통신unknown 전달. HTTP는주입runtime과metadata만사용.
- 입력: Rust sgp4 2.4.0 공개ISS 예제(epoch2020-07-12) TLE와동등형식파생OMM을보존. OMM별도실제확보나현재ISS자료라고하지않는다. source/crate·파일hash·보존시각/epoch/형식/defaults 연결. 고정IERS/윤초 snapshot과manifest는data/workspace/inputs/orbit에둠. prepare_orbit_inputs.py는네트워크없이명시적생성,덮어쓰기금지. load_stored_orbit는manifest경로밖파일접근/원본손상/hash오류를거절한다.
- 조립: create_stored_orbit_app 별도profile을통해lifespan thread에서검증된localmanifest를읽고첫요청전단일orbit runtime구성. 기본create_app은기존주입형구조로유지. 손상/미준비묶음은orbit inputs503이며기존health/SIM유지. API원본문서/로컬경로노출없음.
- 브라우저: 기존api메서드보존,orbitInputs/orbitState/selectOrbit/orbitSamples와OrbitApiError 추가. AbortSignal 전달,409 status/code/state 유지. 실제UI표시나late-response client폐기는다음T015/T027이며이번Node는stubfetch transport 시험.
- 검증: 최초API미구현19FAIL과catalog모듈누락을확인후구현. API19+저장4+기존94=전체pytest117PASS/경고1(7.62초),pip check PASS. Node3PASS. 별도localhostTCP HTTP 서버기동→입력2종→선택revision1→실제위치/고도각3행→기존health200→자기서버만종료PASS. data/workspace/validation/orbit_api에results/live_http/source_hashes 기록.
- 수정: router와OrbitRuntime 변수명충돌을orbit_http 별칭으로해결. 기존OpenAPI 전체동등시험의허용신규범위를명시했다. original_openapi.json은보존하고4개신규path/3개신규schema만제외한전체문서가baseline과정확히같아야한다. 이후전체회귀통과.
- 상태: 첫묶음13/31완료. 다음T014에서채택V6원본hash를보존하며화면구조이식,그후T015~T018입력/공용지구/UTC재생연결및첫시연. 현재V6연결/실제브라우저게임성능/가시구간/배포미완료. F001실제통신조건확인/적용,F002전체후속기능유지.

## 2026-10-02 V6 이식 및 Git 버전 관리 T014
- 사용자 지정 GIY0201/ISDC_ODT 원격의 기존 main d26af42를 보존하고 codex/v6-workspace-migration 브랜치를 생성했다. 기존 계산/API 구현을 기준 커밋 fef9dd6으로 기록했다.
- V6 원본 HTML/CSS/JS를 project_support/docs/ui/v6_source에 byte 단위 보존했다. .gitattributes -text로 checkout 줄바꿈 변환을 막으며 3개 SHA256은 회귀시험으로 검사한다. 원본 AeroDT 파일은 수정하지 않았다.
- index.html, styles/workspace.css, scripts/workspace.js 및 로고/지구 이미지가 독립 저장소 내 정적 경로를 사용한다. 기존 index는 legacy.html과 /legacy 경로로 보존했다. API 및 계산식 변경 없음. 자산 시험은 두 화면의 기존 import 그래프를 모두 검사한다.
- 시험 우선: 새 회귀 2 FAIL 확인 후 구현. 전체 pytest119 PASS/기존 Starlette 경고1(8.71초), Node API3 PASS, workspace.js 문법 검사 PASS. 실제 IAB localhost:8876에서 지구/로고 표시, 위성 작업창 열기, 최소화/복원, 확장/복원, 닫기를 확인했다. 단일 브라우저 viewport 확인이며 게임 성능, 다중 해상도, popout 동기화 완료 증거가 아니다.
- 상태: T001~T014,14/31 완료. V6는 예시 state와 CSS 지구이며 실제 궤도 API 연결은 T015 이후다. 단일 runtime 현재상태 및 Cesium 연결 T016~T018, F001 실제 통신 조건, F002 전체 기능 범위 유지. 실행 데이터와 환경은 ignore했다. GitHub push 결과는 별도 확인한다.
## 2026-10-02 T015 저장 입력 및 결과 표시
- V6 위성 작업창에 저장 TLE/파생 OMM, 출처/epoch/보존 UTC/서버 UTC/epoch 대비 시간/hash 및 실제 ITRF m·고도각 deg 결과를 연결했다. 예시 지구와 실제 계산 패널을 구분하며 실측/실제 통신으로 표현하지 않는다. 현재 UTC 재생이나 Cesium 연결은 구현하지 않았다.
- 서버 snapshot 사본만 표시한다. 선택 명령은 직렬화하고 서버가 반환한 revision을 다음 명령에 사용한다. 계산은 요청 ID/revision/input ID/hash/stale를 검증하고 선택 변경 이전 응답은 폐기한다. 충돌은 서버 snapshot을 채택해 오류로 표시하며 무조건 재시도하지 않는다. 빈 입력·미준비·오류 흐름을 구분한다.
- 경로 조정: 기존 state.js와 tabs/orbit.js는 /legacy 콘솔이 사용하므로 보존했다. V6 전용 orbit_selection.js/workspace_orbit.js로 같은 책임을 구현한다. 새 내부 상태 소유자를 만들지 않고 서버 응답 사본과 UI 요청 수명만 관리한다. 원본 V6 snapshot hash는 불변이다.
- 시험 먼저: 새 모듈 누락 ENOENT 확인 후 구현. 최초 Node7 PASS/Python119 PASS. 브라우저에서 역할화면 조기 반환 및 이전 스크립트 캐시로 패널이 표시되지 않는 것을 발견해 렌더 이후 microtask 연결 및 entry script 버전으로 수정했다. 이후 실제 localhost stored profile에서 TLE 선택→revision1→UTC별 Rust/ITRF/고도각3행 complete 표시를 확인했다. 게임 성능/다중창 동기화 측정은 아니다.
- Git 정책: 기능별 브랜치/PR 리뷰 후 main 반영. 원격 초기 PR #1 병합과 사용자 README 수정 6f42791을 확인해 보존했다. T015는 codex/v6-orbit-inputs에서 별도 PR로 제안하며 자동 병합하지 않는다.
- 상태: T001~T015,15/31 완료. 다음 T016 공용 지구 실제 위치 연결. T017/T018 UTC 재생, F001 실제 통신 조건 확인/적용, F002 전체 선배 기능 연결 및 후속 검증은 유지한다.
- 최종 검증: Python119 PASS/경고1(7.76초), Node10 PASS. 실제 브라우저에서 TLE revision1 3행 후 파생 OMM 전환 시 이전 행 제거 및 revision2 3행 complete 확인. 두 형식 표시값 동일. 원격 최신 main에서 T015 PR로 리뷰 예정.

## 2026-10-02 PR #2 P2 빈 선택 표시 수정
- 리뷰 재현: 계산 후 빈 입력 옵션을 선택하면 드롭다운만 비어 이전 입력의 출처/hash/결과와 불일치했다. 서버에는 선택 해제 계약이 없다.
- 수정: 빈 change는 server snapshot의 input_id로 즉시 복원한다. 새 서버 명령이나 계산 요청을 보내지 않으며 결과를 지우지 않는다. 실제 입력 변경 경로는 유지한다. 모듈 갱신은 entry/import 버전으로 구분한다.
- 시험 우선: 새 UI change 회귀에서 빈 값 != stored-tle 실패 확인 후 수정했다. Node11 PASS, 전체 Python119 PASS/기존 경고1(7.86초). 실제 브라우저에서 TLE 계산 revision3 complete 후 빈 옵션 선택→동일 선택값 복원 및 출처/hash/3행 유지 확인했다. DOM stub 시험과 실제 브라우저 확인을 구분한다.
- 상태: PR #2 열림/미병합 확인. 같은 PR에 수정 커밋을 추가한다. T016 이후 및 F001/F002 범위는 그대로 유지한다. 전체 기능/독립 외부 리뷰 완료 또는 병합 성공으로 기록하지 않는다.
## 2026-10-02 T016 공용 Cesium 지구 연결
- ITRF m/FIXED와 서버 UTC를 주입해 정지한 첫 계산 위치를 표시했다. 역할/창 전환 밖 Viewer 하나 유지, 입력 변경·pending·error·stale에서 이전 entity 제거, 렌더 실패 안내 및 멱등 종료를 구현했다. 원본 V6 snapshot/legacy API 및 계산은 보존했다.
- 기존 globe.js의 legacy synthetic 경로를 유지하고 orbit_globe.js/workspace_globe.js로 새 GP 표시를 분리했다. NASA 보존 영상 및 Cesium1.143 공식 CDN을 사용한다. 현재 상태 소유자는 여전히 runtime이다.
- 시험 우선 모듈 누락 실패 확인 후 구현. Node19 PASS, Python119 PASS/기존 경고1(8.86초), 실제 브라우저 TLE/OMM 좌표/UTC 일치·입력변경 점 제거·역할전환/복귀·canvas1개 및 콘솔 오류 없음 확인. 상세: validation/t016_globe.md.
- T001~T016,16/31 구현·검증 완료. PR #2 의존 별도 브랜치 codex/v6-orbit-globe에서 리뷰 예정. T017/T018 재생/보간, F001 실제 통신 조건, F002 전체 기능 연결 및 게임 성능/다중창 검증은 유지한다.

## 2026-10-02 T017 UTC 재생 시험 준비
- 정지/재생/복귀, 단조 시간 투영과 valid 1초 이내 보간, 버퍼 밖/오류/과도한 간격 거절을 브라우저 수용 시험으로 작성했다. T018 모듈 누락으로 예상된 RED(exit1)를 확인했으며 재생 구현 완료가 아니다.
- 새 Rust 분수시각 전파를 참값으로 고정 ISS/제주 1,223구간 검증: 위치 최대1.000891m, 고도각0.004974918도. 1초 간격 게이트 PASS; 60초 간격은10m초과를 확인했다. 유한 fixture이며 전체 위성/자료범위 보장은 아니다.
- 전체 Python121 PASS/기존 경고1(10.68초), 기존 Node19 PASS. 새 orbit_playback.test.mjs는 미구현 RED로 구분하며 wildcard 전체 PASS를 주장하지 않는다. validation/t017_playback_gate.md 참조.
- T017 시험 작성 완료, 제품은T016까지. T018 실제 UTC codec/프리페치/UI재생 미구현, 게임 성능/다중창/F001 실제 통신/F002 전체 기능은 유지한다. codex/v6-orbit-playback-tests에서 PR #3 의존 draft PR로 시험 준비를 제안한다. 미구현 시험이 남아 있으므로 병합 대상이 아니다.

## 2026-10-02 T018 UTC 재생 연결
- 서버 snapshot의 수신 단조 시각/배율로 표시만 투영하고 재생·정지·속도·지정UTC·epoch복귀를 기존 selection API에 연결했다. 새 권위 시계나 전파 구현은 만들지 않았다.
- 1초601행 prefetch, 300초 전 다음 묶음 요청, 기존 버퍼 수신 중 유지, 5초 서버 snapshot 재동기화, 이진검색/행검증과 늦은 응답/자료 계약 거절을 구현했다. 나노초/윤초는 고정 hash 검증 BigInt codec로 처리한다.
- 시험 우선 새 control/prefetch/codec/lifecycle/provenance 실패 확인 후 구현. Node31 PASS, Python122 PASS/기존 경고1. 원본 V6/API/계층 회귀 유지. 정지 화면 고도각 placeholder 문제를 실제 브라우저에서 찾아 수정했다.
- 실제 IAB 1배·60배 재생/반복601행버퍼 전환/정지/지정UTC/epoch복귀 좌표 재현, EOP 범위밖 오류와 위치 미표시 및 정상복구/canvas1개 확인. validation/t018_playback.md와 ADR0002 참조. 서버는 정지 epoch로 남겼다.
- T001~T018,18/31 구현·검증 완료. 다음 T019 가시구간 계산 시험. PR #4 시험 준비분은 T018 없이 독립 병합하면 RED이므로, 구현과 시험을 함께 리뷰·반영해야 한다. 자동 병합하지 않는다. 게임 성능/다중창/F001 실제통신/F002 전체 기능은 유지한다.

## 2026-10-02 T019 가시 구간 시험 준비 및 PR 병렬 게시
- T018 PR #5 게시/첨부 완료, open/미병합. 로컬 및 원격 tree 동일성을 확인했으며 검증 로컬 commit은 별도 branch로 보존했다. 사용자가 요청한 PR 병렬 처리로 게시와 다음 시험 준비를 분리했다.
- T019는 codex/v6-visibility-tests에서 수용 시험35개를 작성했다. 짧은 pass/gap/접점/잘림/없음/6개 구간 반환, 임계값/조회 범위, 부분/전체실패, hash/잘못된 행/불변 결과, 하루 dense 경계와 실제 좁은 pass, 윤초 SI 시간을 다룬다.
- 제품 Rust/좌표 경로로 고정 역사 ISS/제주 가상 하루86401행 기준 준비1 PASS, 10도 교차8개 확인. 새 시험 제외 기존Python122 PASS/경고1, Node31 PASS. 전체Python123 PASS/34 ERROR이며 모두 아직 없는 T020 visibility 모듈 fixture의 예상 RED다. skip/xfail로 숨기지 않았다.
- T019 시험 준비 완료, 제품 구현/검증은 T018까지다. 다음 T020 계산 구현 후 모든 assertion 재검증. API/UI/게임 성능/다중창/F001 실제 통신/F002 전체 기능은 미완료다. 상세 validation/t019_visibility_tests.md. 전체 PASS나 가시 구간 제품 완료로 주장하지 않는다.

## 2026-10-02 T020 기하학적 가시 구간 계산
- immutable 내부 VisibilityResult/Interval/Contact/Error와 주입 calculate 기반 search_visibility를 구현했다. 1초 SI grid/고립 극값/첫·마지막cell 보완/0.01초 경계 bracket, 접점 및 오류별 구간 분리, 단일 provenance/행계약 검증. runtime/API/기존SIM/legacy/UI 변경 없음.
- T019 RED를 실제 assertion 실행으로 전환했다. 정수 접점42ns 군집/조회 시작 직후0.2초 pass/같은endpoint 단일cell 누락을 시험 먼저 재현한 뒤 수정했다. 추가3개 포함 가시구간38개 PASS. 마지막 전체Python160 PASS/기존Starlette경고1(97.19초), Node31 PASS(185.56ms). ADR0003/validation/t020_visibility.md 참조.
- T001~T020,20/31 구현 및 검증 완료이며 전체 프로토타입 완료율은 아니다. 다음 T021 API 시험, T022 API/runtime 조립, T023 UI 연결. F001 실제통신/F002 전체기능, 게임성능/다중창/배포지원은 유지한다. 화면은 변경하지 않아 새 화면 검증 없음. 단계 commit 고정 후 T019시험+T020구현을 같은 PR로 병렬 게시한다. 자동 병합하지 않는다.

## 2026-10-02 T021 가시 구간 API 시험 준비
- T019/T020 PR #6 https://github.com/GIY0201/ISDC_ODT/pull/6 open/미병합 확인, attach 완료. 게시된 dab5c46/upstream 상태에서 codex/v6-visibility-api-tests로 분리했다. 사용자 승인에 따라 다음 시험 단계만 수행하고 T022와 함께 리뷰할 예정이다.
- 실제 FastAPI/selection/주입 calculation을 사용하는 HTTP 수용 시험42개 작성. request/range/ground/threshold/revision, 현재 선택·UTC 보존, 출처/단위, 전체/없음/부분·전체실패/접점, unknown 통신, unavailable/EOP/native, 윤초/24h/0·90도 및 실제 native/EOP first-pass 경로를 포함한다. 아직 구현되지 않은 endpoint를 mock하지 않았다.
- 전체Python161 PASS/41 FAIL/기존Starlette경고1(101.42초). 기존160개와selection 준비1개 통과, 새POST41개는 경로 미구현405의 예상RED다. lastfailed의다른실패0 확인. Node31 PASS(189.45ms). 첫HTTP status assertion 이후 의미 검증은 T022 구현 전 미실행이며 전체PASS/API완료를 주장하지 않는다.
- T021 시험 준비 완료, 제품은T020까지. 다음T022 schema/runtime/HTTP 조립, 이후T023 UI. 시험만 먼저 독립 병합하지 않고 구현과 같은PR에 묶는다. 게임성능/다중창/F001 실제통신/F002 전체기능은 유지한다. 화면 변경/새브라우저시연 없음. validation/t021_visibility_api_tests.md 참조.

## 2026-10-03 T022 가시 구간 HTTP 조회 연결
- VisibilityRequest/OrbitVisibilityQueryResult/OrbitRuntime.visibility와 POST /api/orbit/visibility 연결. snapshot context 비교/범위·설정 검증 후 기존 bounded executor와 T020 계산을 호출한다. query는현재선택·UTC를변경하지않고완료후revision변경을stale로표시한다. 오류/없음/접점/잘림/hash/단위/통신unknown 반환. ADR0004/validation/t022_visibility_api.md 참조.
- T021 실패원인정정: 41개중40개는미구현405,1개는시험도우미input_id중복 TypeError였다. 도우미인자명수정후API42 PASS(4.30초). 기존OpenAPI 새허용목록누락201 PASS/1 FAIL을 확인하고 visibility 경로/schema하나씩만추가한뒤전체Python202 PASS/기존Starlette경고1(101.33초), Node31 PASS(180.07ms). 원본API fixture/기존경로exact 비교는유지했다.
- 실제TCP HTTP: 자신의임시uvicorn만시작/종료하여저장입력2/samples3행/400초구간complete1개/잘못된revision409/선택정지UTC보존/health 확인. 최대기하각16.34968415627627도,통신unknown. 기존8876서버/화면재시작없음. live_http.json receipt와시험클라이언트증거를구분한다.
- T001~T022,22/31 구현·검증 완료,전체제품완료율아님. 다음T023 지점·임계값·가시구간화면연결. T021시험+T022구현을같은PR로병렬게시/리뷰예정이며자동병합없음. 게임성능/다중창/동시성/F001실제통신/F002전체기능은미완료. 이번새화면변경/시연없음.

## 2026-10-03 T023 지점 및 가시 구간 UI 연결
- 사용자 승인 T023만 진행. speckit-auto/implement/prerequisite/ledger 재확인, requirements checklist8/8 PASS, extension hooks 없음. 기존 feature/합의 재사용.
- 가상 WGS84 지점/높이/최소각/조회UTC, 모든구간/접점/잘림/없음/부분·전체실패/자료hash와 통신미확인 표시. 기존 직렬selection/freshUTC/단일Viewer 재사용, context 검증/취소·늦은응답폐기. 위치 버퍼와 query 수명 분리. legacy/V6원본/API/계산식 보존.
- 시험우선 missing module/method RED 후 구현. 실제 새로고침 높이0!=500 문제를 회귀시험으로 재현/수정. Node40 PASS(191.04ms), 전체Python202 PASS/경고2(104.09초:기존Starlette+pytestcache). 제한환경임시폴더setup92오류 후 승인된 같은시험 재실행으로 해소. diff check PASS.
- 실제 IAB TLE/OMM 동일400초구간/20도없음/높이500m양끝잘림/잘못된범위/EOP밖오류·복구/지점·0도설정새로고침복구/취소·역할왕복/24h4구간/1280·1920/canvas1개 확인. validation/t023_ground_visibility.md 참조. Screenshot data/workspace/validation/ground_visibility. 독립8877 preview, 기존8876 보존.
- 첫묶음23/31완료,남은8개T024~T030/T031. 전체제품완료율아님. 다음skill implement의T024 창시험, 이후T025 연결. 하루조회긴대기 관찰로1초성능목표통과아님,T028계측·개선필요. F001/F002/전체기능/배포/다중창/동시성유지.
- T021/T022 PR7 https://github.com/GIY0201/ISDC_ODT/pull/7 게시·첨부/미병합. T023별도PR를 병렬게시/리뷰하며 자동병합없음.

## 2026-10-03 T024 작업창 회귀시험 준비
- 변경: workspace.test.mjs 시험10개 및 validation/t024_workspace_tests.md 추가. 제품 코드 변경 없음.
- 검증: 새5 PASS/5 FAIL, 전체Node45 PASS/5 FAIL(exit1), 기존40 PASS. Python202 PASS/기존Starlette경고1(100.57초). 실제IAB 최소화 중1920→1280 변경 후 복원 경계 이탈 확인. 입력과 구간 유지. 창/임시viewport 복구.
- 남은 위험: geometry3경로/channel/gesture 종료5FAIL은 T025에서 수정. T024는 시험준비이며 제품완료는T023. 남은첫묶음7개, 전체제품/게임성능/F001/F002/다중창/배포 미완료. 실패시험만 독립 정상 병합하지 않는다.

## 2026-10-03 T025 작업창 복원 및 종료 수정
- 변경: workspace.js 크기·위치 clamp/복원 재검증 및 최종pagehide channel/gesture 정리. persisted 자원 보존, entry버전t025-r1. legacy/state.js/CSS/API/계산 보존.
- 검증: 작업창10 PASS/전체Node50 PASS(216.32ms), 전체Python202 PASS/기존Starlette경고1(101.17초), diff check PASS. 실제IAB두해상도3geometry경로/입력·구간 보존/canvas1/error로그0. pagehide/bfcache는adapter시험증거.
- 남은 사항: 첫묶음6개, 다음T026 동시성시험. F001/F002/게임성능/다중창/배포 미완료. 시험과구현 같은PR 게시, 자동병합없음.

## 2026-10-03 T026/T027 요청 경합 및 종료
- 변경: 역순응답/동시선택/큐포화/취소/렌더실패 시험과 V6 취소상태·요청client종료·focus실패 처리 보완. 서버/legacy/계산 보존.
- 검증: 초기Node3FAIL+조립1FAIL 해소. 전체Node61 PASS(216.97ms)/Python207 PASS/기존Starlette경고1(100.20초). 실제IAB계산/지구이동/재생·정지/epoch복귀/canvas1/error로그0. 고장주입은adapter, 서버경합은ASGI/실제bounded executor, native수치성능시험아님.
- 남은위험: 실행중native/visibility job 즉시중단보장없음. 첫묶음4개, 다음T031 별도창. F001/F002/게임성능/설치지원 미완료. PR게시와리뷰/병합별도.

## 2026-10-03 T031 별도 창
- 변경: 업무/편집값 opener 전달 및 화면재구성 보존, 활성편집 충돌 안내, 서버 선택 draft 제외, revision 힌트/snapshot 조회, 409 snapshot 재조회, channel/Viewer 종료.
- 검증: 초기 실패 후 전체Node74 PASS/Python207 PASS(102.02초, 기존Starlette경고1), git diff --check PASS. 실제Chrome popup 입력전달/양방향편집/충돌/서버선택/닫기/부모canvas1; validation/t031_popout.md에 adapter와 실제증거 및 popup 도구제약 구분.
- 상태/위험: 첫묶음28/31, T028/T029/T030 남음. 게임성능/F001실제통신/F002전체기능 미완료. PR리뷰/병합 별도, extension hooks 없음.

## 2026-10-03 다음 구현 범위 검토
- 사용자 지시로 T032 프레임 확인은 후속으로 보류하고 W03 RF 기능 검토 착수. rf_workspace_review.md에 선배 함수/API/UI 재사용 근거와 실제 조건 공백 기록. codex/rf-link-workspace에서 기존 작업 보존.
- RF/route 기존 회귀1 PASS0.03초. 제품 소스 변경 및 전체 시험 없음. 질문1개/답변0개이며 첫 RF 계산기 연결과 실제 서비스 프로파일 중 범위 결정 대기. F001 실제 통신 조건 조사·적용은 필수로 유지.

## 2026-10-04 T037~T040 ISS 공식 수신 조건 부분 연결
- 사용자 ISS부터/장비없음. 공식 출처 버전 모델과read-only GET, 주파수만 명시적용, 공식/사용자가정/미확인입력표시. 기존RF AST7동일/GP불변.
- RED후구현,compatibility신규경로누락보완. 전체Python313 PASS107.66초/기존경고1,Node103 PASS340.8823ms,실제IAB두해상도정상/오류/동일값무효화/창복원/지점입력7보존,error0. report validation/t040_iss_receive_profile.md.
- 이묶음완료,F001전체/실제수신/장비검증/F002및T032보류유지. nativewheel변경없음/JSON은소스배포. stacked Draft PR리뷰,자동병합없음.

## 2026-10-04 개발 포트 8891 고정
- 사용자 지시: 앞으로8891고정. CLI 기본 포트를 configs.DEFAULT_PORT=8891로 설정하고 README/quickstart/AGENTS/DEVELOPMENT에 동일 주소와 동일 포트 재시작 규칙 기록. 기존 검증 이력의 과거 포트는 보존.
- 검증: entrypoint 회귀8765≠8891 RED 후1 PASS, 전체pytest314 PASS107.71초/기존 Starlette경고1, 현재8891 health HTTP200, git diff --check PASS. 포트만 변경하며 기존 서버 종료/추가 서버 시작 없음.

## 2026-10-04 T041~T044 시나리오 경로·접촉 계획
- 선배 기존 bootstrap/route/contacts를V6 지상국에연결. 서버함수/API/schema보존,노드API조회,시나리오의미/UTC/전체행/시간범위한계표시. optional signal과독립세대로늦은응답폐기,복원과원격편집처리.
- RED후구현,Python325 PASS113.65초/기존경고1,Node114 PASS362.4772ms,실제8891두해상도20행/GP·RF입력18개보존/error0/원본AST9동일/read-only리뷰결함0. PATH Python 의존성없음 collection오류를전용venv로해결. report validation/t044_communication_planning.md.
- 이묶음완료. 실제ISS수신/예약/HIL아님,F001전체/F002/F004~6/T032보류유지. PR15위stacked Draft PR,8891고정변경포함,자동병합없음.
