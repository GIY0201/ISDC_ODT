# UI 수정 요청 이행 점검

2026-10-07 기준. 사용자 요청과 소스, 실제 화면 검증을 대조한 기록이다.

| 요청 | 상태 | 근거와 남은 작업 |
|---|---|---|
| 공용부터 환경 설정까지 세부 탭과 스크롤 하단 확인 | 확인 | U011~U014 브라우저 점검 기록 및 캡처. 새 상황판은 U015에서 별도 검증 |
| 시간창을 화면 하단에 붙이기 | 반영 | 시간 도크 하단 고정, 최대화 창의 아래 경계를 시간창 위로 제한 |
| 현재 시각과 분석 시각을 구분하고 제목으로 선택 | 반영 | 현재 / 분석 / 둘 다 메뉴, 둘 다일 때 좌우 배치 |
| 시간창 색으로 메뉴와 상단 표시를 통일 | 반영 | workspace_appearance.css 공통 회청색 배경과 경계 |
| 단독 운용 버튼과 간단한 아래 메뉴 | 반영 | 키보드 선택 가능한 운용 모드 메뉴, 지구보다 높은 표시 계층 |
| 운용 설명을 제목 오른쪽 i로 이동 | 반영 | 제목 옆 설명 버튼과 팝오버, 상태나 오류 및 확인 문구는 유지 |
| 화면의 중간점 제거 | 반영 | 표시 어댑터와 브라우저 가시 텍스트 검사. 원본 자료와 코드 식별자는 보존 |
| 실행 제어와 사건 기록 가독성 | 반영 | DT 실행 화면으로 소유권 통합, 수치 카드와 사건 표 |
| 창 위쪽의 비어 있는 공간 제거 | 반영 | 창 이동 최소 높이를 상단 상태바 아래로 조정 |
| 시나리오 버튼 과밀 | 반영 | 정의, 검토, 재생 제어 묶음과 부가 도구 접기 |
| 관제, 운용, DT 용어 정리 | 반영 | 공식 기관 업무 자료에 근거한 메뉴 이름과 목적 문구. 국내 인증 표준 번역이라는 의미는 아님 |
| 그래프와 표 후보 조사 | 완료 | ui_operator_terminology_visualization_review.md |
| 형상, 궤적, 전체 위성 표시를 환경 설정으로 | 반영 | 해당 세 패널을 환경 설정에 배치 |
| DT 연동 설정, 시험 환경, 시나리오 작성의 중복 | 반영 | 노드 구성과 시나리오 제어 소유 화면 분리, 결과 화면에서 편집 제어 제거 |
| 전체 위성의 장황한 상태 문구 제거 | 반영 | wall-scope-status 숨김 |
| 전체 위성 ON인데 준비 중 OFF 표시 | 반영 | 표시 범위로 ON/OFF 결정, 준비 상태는 별도 보조 정보 |
| 임무 이름, 진행률, 자원 수치와 성공 조건 | 반영 | 한국어 상태, 진행 막대, 자원 카드, i 설명. 측정 없는 성공 조건은 미판정 |
| 연동 상태 합계 가독성 | 반영 | 상태별 수치 카드와 색상 |
| 지상국의 실행 ID와 응답 번호 노출 | 반영 | 통신 모듈 조회 정보로 접기 |
| 실제 위성 관제 상황판을 수치 중심으로 재구성 | U015 반영 | 모의실험 자료 제외. 실제 원격측정 미연동 수치는 대시로 표시 |
| 가상 시나리오와 모듈 통합 관리용 DT 상황판 | U015 반영 | DT 첫 메뉴. 실행 수치, 단계 진행, 모듈 연결 분포와 상태, 결과 탐색 |
| 태양 표시 기준 UTC 없음 | 조치 경로 제공, 자료 필요 | 표시 기준은 궤도 계산 또는 전체 위성 표시가 소유한다. 임의로 현재 시각을 덮어쓰지 않는다 |
| UTC가 EOP 범위를 벗어남 | 메시지와 복구 안내 반영, 자료 갱신 미완료 | 저장 입력의 EOP는 2026-08-21까지. 최신 보정 자료 확보와 출처 검증이 필요하며 계산 유효기간 검사를 해제하지 않음 |
| Astro 설치 후 전체 전환 | 취소 | 사용자가 작업 중단을 요청했으므로 적용 대상에서 제외 |

실제 관제 수치는 실제 위성 수신 연결이 마련되어야 표시할 수 있다. 가상 시험 자료를 실제 수치로 대체하지 않는다. EOP 자료 갱신은 UI 수정과 별개이며 현재 계산 입력과 재생 상태를 보존한다.

## U016 추가 지적 20개

- 임무 버전 변경 안내: 오류 또는 다른 창 변경 시만 표시.
- 시간표 계산 문구: 계산 정보 아래로 접음.
- 요청 선택기: 최소 폭 확대. 요청 버튼은 작은 일정 높이로 정리.
- 임무명, 상태, 진행률: 역할 이름을 붙인 수치 카드와 막대.
- 자원: 비율 막대와 연속 색상. 경보 임계값을 임의로 정의하지 않음.
- 성공 기준: 목표 수치 카드와 미판정 표시, 상세 설명은 i.
- 계획 미리보기 설명: 접기.
- 연결 합계: 색상 경계와 큰 숫자.
- 연결도: 박스별 텍스트 표시 범위 제한과 이름 길이 조정.
- SIM 지표: 퍼센트 값에 막대와 색상, 단위 미확인 값은 임의 위험 판정 없음.
- SIM 실행 요약: 상태, 시간, 배속 카드. ID와 순번은 접기.
- 수신 상태: 짧은 상태 표시, 상세 수신 시각은 접기.
- 정상 수신 피드백: 반복 문구 숨김, 오류는 유지.
- 시나리오 UTC: 실행 카드와 접힌 기준 시각.
- 정의를 불러오라는 중복 문구: 제거.
- KPI 실행 문맥: 실행 카드, 출처는 접기.
- KPI 통과 비율: 상태 색상과 진행 막대.
- 원본 공식과 표본 정보: 접기.
- KPI 사건: 시각, 유형, 내용 표.
- F 번호와 SYS 식별자만 적힌 결과 평가 예시: 결과 페이지에서 제거. 제목의 기능 번호도 제거.

브라우저 캐시가 과거 UI를 유지할 수 있어 수정한 화면 자산의 버전도 U016으로 갱신했다.

## U017 대상별 메뉴와 시험 구성 연결

사용자가 대상별 메뉴 개편을 선택했고 보안도 독립 대상으로 요청했다.

- 상황판: 실제 관제 / DT 통합 상황판.
- 위성: 위성 상태와 궤도 / 발사 초기 운용.
- 지상국: 위치와 통신.
- 임무: 임무계획, 정상 운용, 인계, 이상 대응.
- 데이터: 임무 데이터 관리.
- 보안: 보안과 명령 권한.
- 시험: 환경 구성, 시나리오, 실행, 평가.
- 시스템: 연동 설정, 지상 시스템, 장비 시험.

시험 환경에서 이전의 별도 개념 위성 입력을 제거하고 기존 위성 구성 패널을 그대로 재사용했다. 지상국 위치와 통신 설정, 시나리오 작성은 해당 단계에서 바로 연결한다. 새로운 위성 상태 저장소나 별도 배치 명령은 만들지 않았다. 기존 URL은 유지한다.

## U018 중앙 시각화와 좌우 요약 패널

사용자 참고 이미지의 공간 구성을 적용했다. 실제 통합 관제는 중앙 Cesium 지구와 좌우 실제 운용 수치 및 상태 패널, DT는 중앙 모듈 연결 SVG와 좌우 시나리오 진행 및 결과 패널이다. 상황판을 열 때 기존 확장 기능을 사용한다. 작은 화면에서는 패널을 하단으로 재배치한다. 기존 지도 선택, 전체 위성 표시와 연결 상태 소유자는 보존하며 새 측정값이나 가짜 그래프를 생성하지 않는다.

검증: 전용 회귀시험 RED 후 8개 통과. 전체 Node u018_node.log 2146 통과, 실패 0, 1 생략, 39.49초. Python 검증은 U015의 960 통과, 8 생략 결과이며 이후 변경은 UI 자산과 시험이다.

## U019 전체화면 하단 여백 수정

시계 높이를 전체화면 영역에서 빼던 설정을 제거했다. 확장 창은 작업 영역 하단까지 채우며, 시계는 작은 탭으로 접힌다. 마우스 또는 키보드 포커스로 시계를 펼칠 수 있다. 메뉴가 확장 창 뒤에 가려지던 문제도 수정했다. 중앙 지구 초기 구도와 DT 연결도 높이를 조정했다.

회귀시험에서 기존 잘못된 하단 경계를 재현한 뒤 수정했다. 전용25개 통과, 전체 Node2146통과/0실패/1생략35.39초(project_support/u019_node.log). 실제 브라우저에서 확장과 메뉴 전환을 확인했다.

실제 브라우저 1920x990에서 확장 창과 작업 영역 경계가 모두 x76/y38/1844x952/bottom990으로 일치했다. 접힌 시계 높이30px, 키보드 포커스로 펼친 시계90.89px이며 창 경계는 그대로 유지됐다. 중앙 지구가 아시아를 향한 초기 구도로 표시됨을 스크린샷 u019-control.png에서 확인했다.

## 2026-10-07 U020-U024 메뉴 아이콘, 지상국 화면과 현재 시각 궤도 분석

상황판/위성/지상국 메뉴에 Lucide monitor/satellite/satellite-dish SVG를 적용하고 라이선스를 보존했다. 카탈로그의 반복 설명을 정렬 기준, 자료 갱신 시각, 검색 결과 수로 줄였다. 위치 안내는 표시 해제 옆 정보 버튼에 배치하고 GP epoch를 궤도 자료 기준 시각으로 표현했다. 거리/도플러 설명은 한 문장과 모델 종류 표시로 정리했다.

지상국 목록을 기존 통신망 패널에 합쳤으며 별도 상태 소유자를 만들지 않았다. 위성이 없는 지상국 연결도는 빈 궤도면 공간 없이 바로 표시한다. 원본 기본 renderer의 10 golden 출력은 그대로 통과하고 UI만 명시적으로 compactGround 옵션을 사용한다. 요약은 위성/지상국/계산 연결 수와 표시 시각으로 나눴다. 지상망은 실제 회선 조회가 아니라 모든 활성 지상국 쌍에 10 Gbps를 가정하는 기존 모델이다. 사용자 질문 후 시험용 지상망과 연결 가정을 표시했다. 기본 대전/제주/스발바르의 선정은 국내 및 고위도 시험 지점이라는 소스 주석에 따른다. 실제 시설 장비 사양이나 회선 검증을 뜻하지 않는다.

카탈로그 기존 timeline 소유자에 현재 UTC 연속 분석 명령을 추가했다. 기존 native 버퍼를 사용하고 정지/선택 변경/관측 조건 변경/늦은 응답 취소를 보존한다. 저장 궤도 UTC와 SIM 명령은 변경하지 않는다. 현재 UTC 계산은 실측 원격측정이 아니다. 단위 시험의 wall-clock 추종 및 취소 검증은 통과했으나 실제 브라우저의 연속 분석 버튼부터 전체 조회까지의 흐름은 아직 검증하지 않았다.

검증: 관련 RED 재현 후 회귀 통과. 전체 Node u024_node.log 2153PASS/0FAIL/1SKIP 29.04초, 전체 Python u022_python.log 960PASS/8SKIP/8warnings 458.91초. U020 별도 전체 Node2147PASS/1SKIP 및 Python960PASS/8SKIP 통과. 실제8891 브라우저 1920x990에서 세 SVG 아이콘과 지상국 연결도 3개 노드/3개 선, 단일 통합 탭을 확인했다(Aside artifacts/u023-ground.png, u023-icons.png). 마지막 정보 팝업 스타일 클래스 변경은 기존 스타일 재사용이며 계산 변경은 없다.

T075-T083의 전체 acceptance와 지정된 두 해상도, 전체 모델 및 GPU 검증은 계속 열려 있다. 서버 재시작, 배치, SIM 실행/속도 변경, 모듈 probe/save는 하지 않았다.

## 2026-10-07 U025-U027 한반도 지상국 지도와 사용자 시험 시나리오 작성

한반도 지도에 기존 ground segment 소유자의 지상국 핀을 표시하고 선택 시 좌표, 안테나, 고각, 지원 대역과 실제 연결 미확인 상태를 보여준다. 지도 클릭 또는 좌표로 후보를 지정한 뒤 명시적 추가로 기존 저장소와 편집기를 사용한다. 후보 좌표 편집은 기존 후보를 무효화한다. 해외 지상국은 접힌 목록에 표시하며 저장된 스발바르 선택을 한반도 기본 상세에 자동 표시하지 않는다. OSM 6개 타일과 출처를 표시하고 배경 실패 시 좌표와 목록을 유지한다.

내 시험 시나리오 작성 화면은 빈 정의부터 목적, 위성 구성, 현재 사용 지상국, 시간순 시험 단계를 작성하고 브라우저 저장, 재편집, JSON 내보내기를 지원한다. 장애 단계에는 장애 종류, 대상, 발생 시각, 지속 시간, 주입 조건과 확인할 결과를 작성한다. 종류는 통신 단절/노드 중단/통신 품질 저하/자원 부족/직접 정의이며 자동 주입 지원 여부를 뜻하지 않는다. 사용자 정의의 자동 실행기 연결은 아직 없으며 화면에도 명시했다.

검증: 관련 RED 재현 후 회귀 통과. 전체 Node project_support/u027_node.log 2163PASS/0FAIL/1SKIP 26.79초. 전체 Python project_support/u026_python.log 959PASS/1FAIL/8SKIP/8warnings 330.87초. 실패는 기존 data fabric 불변성 시험이 벽시계 analytics.generated_at의 초 경계를 함께 비교한 것이며 해당 파일 단독 재검증 7PASS/1warning. 전체 Python 성공으로 기록하지 않는다. 설치 시험에는 기존 native wheel 경로를 명시했다. 실제 8891 브라우저에서 지도 선택 상세, 접힌 해외 목록, 사용자 작성 화면을 확인했다. artifacts/u027-ground-refresh.png에서 동일 URL 새로고침 뒤 추가 서울 지상국의 좌표/안테나/지원 대역 유지 확인. 사용자 보고의 설정 유실은 아직 재현하지 못했고 저장 완료 여부 확인 중이다.

현재 지상국과 사용자 정의 저장은 localStorage이며 서버 DB 연결이 아니다. DB 제안은 지상국/위성 구성/시나리오/장애 정의/버전/실행 기록을 API 통해 PostgreSQL에 저장하고 저장 성공·실패와 낙관적 버전 충돌을 표시하는 방향이다. 이번 변경에 DB 서버 설치나 배포는 없다. 기존 실행, 저장 궤도와 서버 상태를 변경하지 않았다. 전체 T075-T083 acceptance는 열려 있다.


U027 실제 브라우저 추가 확인: 내 시험 시나리오 작성에서 시험 동작을 장애 주입으로 선택하면 장애 종류/대상/지속 시간/주입 조건/확인할 결과가 표시됐다. Aside artifacts/u027-fault-authoring.png와 DOM snapshot으로 확인했으며 저장이나 런타임 주입은 하지 않았다.

## 2026-10-07 U028 PostgreSQL server and authored definition persistence

User authorized PostgreSQL provisioning. Installed official EDB Windows PostgreSQL18.6 archive at project_support/tooling/postgresql/pgsql. Archive SHA256 E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2 is a recorded local integrity hash, not a separately published signature verification. Initialized isdc_workspace at 127.0.0.1:5432, SCRAM authentication, separate isdc_owner/isdc_app roles. Credentials, cluster, logs and backups are ignored under data/workspace/postgresql; verified credentials ACL grants current OS user only. ISDC-PostgreSQL login scheduled task successfully ran with LastTaskResult0, no system boot service claimed.

Schema001 stores versioned ground station and user scenario definitions plus transactional change history. Additive GET status, GET/PUT definition APIs preserve original OpenAPI paths/schemas; ADR0065 records changes. Browser storage port keeps local pre-migration/pending backups, restores server definitions, imports local definitions only when server document is absent, serializes writes and refuses revision conflicts. UI exposes saving/saved/error instead of treating local acceptance as server durability. This is configuration persistence, not current runtime/telemetry persistence or automatic fault execution.

Validation: RED new Python/JS cases then actual PostgreSQL repository/API roundtrip, malformed input, optimistic conflict and same-origin guard PASS. Entire Node project_support/u028_node_verified.log 2164PASS/0FAIL/1SKIP 27.35s. Entire Python project_support/u028_python_verified.log 963PASS/8SKIP/8warnings240.90s with explicit existing native wheel and actual test DB connection. Earlier u028 full run's expected additive OpenAPI registry failure was corrected explicitly; no original schema was relaxed. Isolated product factory reads real PostgreSQL, and pg_dump/custom + globals backup restored in a separate database with exact document/history comparison (backups/20261007T142218Z, synthetic test namespace only). Successful task launch and local listen address confirmed.

Live8891 was NOT restarted: public capture before.json/orbit.json under data/workspace/validation/u028_database_restart shows paused RUN-904CE008D00B at884.681s/speed5 and40 deployed nodes. Rechecked same runtime fields and full deployment equality after work. resume_unconfigured_development rejects nonempty rosters and cannot restore accepted module work. Requested user decision whether to preserve this run and defer activation or explicitly allow run initialization for web DB activation. Current web server still uses browser-local storage; no live DB migration of user's configuration is claimed. DB server is running; activation of prepared API/frontend is pending. DB operations and migration guide: project_support/docs/development/postgresql_workspace_storage.md. WholeT075-T083 acceptance remains open.

## 2026-10-07 U028 activation after explicit reset approval

User answered "실행 초기화 허용, DB 연결 적용". Stopped only identified old8891 launcher/child and started product stored-orbit factory with ISDC_DATABASE_CONFIG. New run RUN-E578A57A4EB9 was paused after startup; prior forty-node deployment was intentionally reset under this authorization. Saved ISS input/ground point/current UTC/play rate/paused orbit selection restored via revision-checked API. Original before.json/orbit.json retained.

Actual same-origin browser loaded new API/frontend. Existing four stations including Seoul37.5717/126.9734, dish7.3m, elevation5deg, S/X/Ka imported into PostgreSQL default ground_stations revision1. UI reports server DB saved. Created clearly labelled TEST-001 "저장 검증용 지상국 시험" through UI, saved to scenario_drafts revision1, refreshed and re-opened it with purpose/station snapshot/one observation step intact. Refreshed ground map still shows Seoul settings. Browser pre-migration and pending cache retained. Evidence: Aside2026-10-07_QxaEviibtksIfSGs/artifacts/u028-scenario-db-restored.png and u028-ground-db-restored.png, API capture data/workspace/validation/u028_database_restart/after_configurations.json. Real definition/history backup and exact isolated restore PASS at backups/20261007T143506Z. Logon task starts DB under current user; not a boot service.

Entire Python963PASS/8SKIP and Node2164PASS/1SKIP from preactivation validation; final neutral ground storage wording adjustment verified with13 relevant Node tests PASS. SQL persistence is for station and authored scenario definitions; runtime persistence and automatic custom fault execution remain outside this change. WholeT075-T083 remains open.

Final activation receipt: selecting Seoul produced ground_stations revision2; scenario_drafts remains revision1. API values captured and saved ISS input verified again. Latest backup/isolated exact restore at20261007T143800Z PASS; scoped git diff --check PASS.

## 2026-10-08 U029 idle performance optimization

Paused stored GP polling still reads server and updates receipt but no longer clones the full result/notifies all panels when only observation time changed. Playing, forced reads, revision/provenance changes still notify. Replica preRender validates source every frame but only reapplies changed position/visibility; missing-source cleanup is idempotent and newly bound renderers are cleared. Native calculations and API contracts unchanged.

RED tests reproduced both loops and new hidden-renderer cleanup; final Node2168PASS/1SKIP29.47s and Python963PASS/8SKIP264.00s. Benchmark601 rows/240 paused reads: notifications240->0, row copies144240->0,167.05->1.65ms local microbenchmark only. Replica extra60 frame requests120->0. Real1920x990 RAF p95 remains19.0->18.9ms; interrupting samples limit comparison and16.7ms gate remains unmet. No FPS/GPU usage improvement claim. Actual current run, deployment, stored GP and DB definitions unchanged; static reload only. Report project_support/docs/validation/u029_idle_performance.md. WholeT075-T083 acceptance remains open.
