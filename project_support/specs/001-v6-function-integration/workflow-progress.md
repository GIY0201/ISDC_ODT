# Spec Kit 작업 추적 기록

갱신: 2026-10-04. 이 파일은 기존 feature의 지속 기록이다. 새 feature를 만들거나 기존 합의를 폐기하지 않는다.

## 최초 요청과 현재 진행 경계
최종 목적은 독립 ISDC ODT의 확정 V6 UI에 선배 프로토타입 기능을 단계적으로 연결하고, 향후 AeroDT 연결/이식이 가능하도록 계층 책임과 파일 생성 규칙을 공유하는 것이다. ISS 시험만으로 전체 목적이 완료되지 않는다.
현재 사용자 승인으로 첫 구현 묶음을 단계적으로 실행한다. T001~T031의31개 작업을 수행했으나 SC-006 성능은 미달이다. 남은 수용기준은 T032로 추적하며 첫 묶음 fully verified/전체제품완료를 주장하지 않는다. PR 리뷰와 main 병합은 별도로 추적한다.
보호 범위: V6 채택, 기존 코드와 계산, 합의 문서, 초기 초안 및 도구 실험 이력. 초안의 존재는 승인 증거가 아니다.

## 근거
- S1: 사용자 최초 요청과 이 채팅의 후속 합의. agreed_scope.md에 정리.
- S2: thread://01a0cd04-1f28-7693-9be5-19152d3c92a7?hostId=local, 정리 ISDC ODT 구현 계획. 이번 재개에서 read_thread로 V6 확정 확인.
- S3: thread://01a0f661-f5f4-74a2-b7af-23ef810a8df4?hostId=local, Find the Spec Kit skill. 이번 재개에서 read_thread로 지속 추적/단계 재방문 목적 확인.
- S4: 현재 speckit-auto SKILL.md, 실제 파일을 읽어 최신 오케스트레이션 규칙 확인.
- S5: 기존 프로젝트 AGENTS.md, DEVELOPMENT.md, architecture/design.md.

## 요구 추적
계획 및 task 연결의 '미배정'은 누락을 숨기지 않는 미완료 상태다. 후속 단계에서 실제 절/ID로 교체한다.

| ID | 요구 / 출처 | 수용 기준 | 담당 단계 | 계획 절 / task | 증거 및 상태 |
|---|---|---|---|---|---|
| R001 | 독립 ISDC ODT + AeroDT 이식 가능한 구조 / S1,S5 | AeroDT 설치 의존성 없이 실행, 계층/명명/상태 소유권 검사 | constitution, plan, verify | plan File placement/Constitution / T001,T004,T010,T029 | 독립 실행/계층/로컬격리wheel 설치 PASS. T029는 실제AeroDT 재통합 증거가 아니며 연결·다른PC는 후속 |
| R002 | 확정 V6 UI 유지 / S1,S2 | 공용 지구와 역할별 작업 창에서 연결 기능 사용, 기존 UI 결정 추적 | specify, plan, verify | plan State/Workspace / T014,T016,T024,T025,T031 | V6 원본 SHA/단일 지구/창·다중창 검증 PASS; 두해상도 성능 계측 완료, SC006 미달 |
| R003 | 선배 기능의 단계별 연결 / S1 | 궤도, 통신, 임무, 분석/내보내기, MOCK-HIL 및 SIM 제어 각각 범위/시험/출처 추적 | specify, tasks, verify | plan Summary/Validation / T030,T033~T074 + F002 | 저장 궤도/UTC/기하가시/RF/시나리오경로·접촉/단일·구간 도플러 연결 검증. 임무 연결 검증 완료. SIM 연결 검증 완료. KPI/내보내기 연결 검증 완료. MOCK-HIL 연결 검증 완료. 카탈로그 검색/목록/상세 T071~74 검증 완료. 남은 교차화면 및 legacy 대조 포함 전체 선배 기능 F002는 미완료 |
| R004 | 핵심 기능부터 확장하고 함께 검토 / S1 | 각 단계의 범위와 검증 결과를 제시하고 다음 범위 논의 | 모든 경계 | plan Delivery gates / T018,T023,T030 | 단계별 승인/실패·해소 및 개별PR 유지. T028~T030 결과 검토, 다음T032 성능미달 보완 |
| R005 | 첫 위성 1개 + 지상국 1개 / S1 | 저장된 실제 TLE/OMM, UTC 조작, 위치/고도각/가시 구간, 오류/출처 표시 검증 | specify, plan, implement, verify | plan Input/State/Geometry / T003-T023 | ISS 저장 입력/제주 가상/위치/고도각/UTC 검증. 가시 구간 계산/API/UI T019~T023 검증. validation/t023_ground_visibility.md에 실제24h4구간/설정/오류/두해상도 증거 |
| R006 | 실제 통신 조건 확인 및 적용 / S1 | 출처 있는 서비스/장비 입력과 링크 조건 적용, 정상/실패/미확인 시험 | clarify, plan, implement, verify | plan Visibility/후속 / T023,T030 + F001 | T023/T040 공식 주파수 부분 조사·적용 및 T049/T054 모델 Doppler 검증. 장비 미선정/실제운용·수신unknown, F001 전체 미완료 |
| R007 | 결과 의미 구분 / S1,S5 | 기하 가시성, 모델 통신 충족, 실제 수신 증거를 UI/산출물에서 구분 | specify, verify | plan Validation / T003,T005,T007,T011,T017,T019,T021,T026,T028,T029 | GP/가상/기하 계산과 통신 미확인 표시 검증. 실제 통신 조건 F001 미완료 |
| R008 | JS 모듈/HTML/CSS/Cesium + Python/FastAPI / S1 | 기술 계획이 합의와 일치, 버전/현대화 선택 근거 기록 | constitution, plan | plan Technical Context / T002,T006,T008,T029 | JS/Cesium/Python FastAPI/Rust 및로컬cp314격리설치 PASS. TS/React 보류, 타환경미검증 유지 |
| R009 | 빠르고 원활한 사용성 / S1 | 지구/시간/창 조작의 측정 조건과 합의된 목표로 실제 웹 검증 | clarify, plan, verify | plan State/Validation / T018,T024-T028,T032 | T032 실제두해상도100UTC/20일조회/30초완료3회와 GPU/presentation 증거. 최종하루p95543.1/547.3ms,UTC32.0/32.1ms PASS. 관측EventTiming p9548ms(검열/반올림); frame18.578/18.552ms FAIL. SC006/T032 부분완료, validation/t032_performance.md. T028 이전실패보존 |
| R010 | 기존 자료와 합의 보존 / S1 | 수정 이력 보존, 초안/합의/검증 증거 구분 | 모든 단계 | plan Summary/Phase1 / T001,T030 | V6 snapshot/합의/legacy 보존, 실제 단계별 증거와 이력 기록 |

## 결정
- D001: 독립 개발 저장소를 사용. 최상위 계층 책임과 명명 규칙은 AeroDT 호환. R001.
- D002: V6 UI 확정, 이후 개발 중 수정 가능. R002.
- D003: JavaScript/Cesium/Python 기준. TypeScript/React 초안 보류. AeroDT 연결성과 도입 부담 고려. R008.
- D004: 첫 검증은 ISS와 제주 가상 지점, 최소 고도각 10도. 실제 장비 기준이 아닌 조절 가능한 시험 설정. R005,R007.
- D005: 전체 연결을 단계화하고 사용자와 상의. 최초 목적을 첫 시험으로 축소하지 않음. R003,R004.
- 가정 A001: 저장된 궤도요소로 재현 가능한 검증을 먼저 한다. 실제 지상국 위치/장비/서비스는 아직 선정하지 않았다. R005,R006.

## 후속 필수 / 보류 기록
| ID | 연결 요구 | 사유 | 담당 / 진입 조건 | 상태 |
|---|---|---|---|---|
| F001 | R006,R007 | 기하 가시성만으로 통신 판정 불가 | 통신 clarify/plan, 대상 서비스와 장비 특정 및 공식 출처 조사 | 공식 주파수와 모델 Doppler 부분 연결. 장비/운용/수신 확인 남음, 전체 필수 미완료 |
| F002 | R003 | 한 번에 모든 기능 이식하지 않음 | 각 기능 specify/plan, 첫 단계 결과 공동 검토 후 우선순위 결정 | 필수 대기 |
| F003 | R008,R009 | 현대화와 성능 목표를 아직 세부 선정하지 않음 | plan/clarify, 합의된 JS 기준에서 버전/측정 환경/목표 검토 | 대기 |
| F004 | R003,R007 | 실제 HIL, 실측, 영구 기록/재생은 기존 구현으로 보장되지 않음 | 후속 요구 검토, 입력/장비/범위 명시 시 | 현재 구현 범위 미포함, 전체 목적에서 필요 여부 보고 |

## 단계 상태 및 산출물
| 단계 | 상태 | 산출물 / 이유 |
|---|---|---|
| constitution | complete | .specify/memory/constitution.md 1.2.0: 최신 JS 합의와 지속 추적 규칙 반영. 기술 세부 선택은 별도 |
| specify | complete | spec.md: 첫 단계 범위와 수용 기준 합의 반영. 전체 제품 기능 완료 아님 |
| clarify | complete | 첫 단계 검증 의미/성능/정확도 3개 질문 합의. 다음 기능 순서/통신 대상은 F001/F002 후속 담당 단계 |
| plan | complete | 연구 결과를 반영한 plan/data-model/contracts/quickstart/technology_selection 작성 및 원칙 검토 완료. 제품 검증/설계 승인 완료와 별개 |
| checklist | complete | checklists/requirements.md: 6/8에서 8/8 문서 검토 통과. 구현 시험 아님 |
| tasks | complete | 초기31개 작성·수행, SC006미달 보완T032 별도 추가. 초기작업완료와 수용기준전체통과 구분 |
| analyze | complete | 첫묶음14기준/31task read-only분석, 차단충돌0. 전체후속구현완료아님 |
| implement | running | 초기31개 수행,수용기준미달T032 미완료. 전체기능/실제통신 미완료 |
| verify | running | 제품Python224/Node77/native1 및실제TCP/브라우저/격리설치 PASS. SC006성능FAIL로 fully verified 아님, 3회 개선 후 후속T032 |

## 실제 증거와 실패
- E001: 이번 재개에서 두 참조 채팅과 최신 orchestrator, 프로젝트 규칙 및 합의 파일을 읽음.
- E002: 이전 Python 기준선 35 PASS, Starlette 경고 1개. 기존 코드의 당시 기준선이며 새 기능 완료 증거 아님.
- E003: upstream HEAD 1a1e00297a0301637455b0ef2cf48b2e74576b07 확인 이력. 로컬 코드 전체 비교는 미완료.
- E004: 이전 pnpm 도구 실험은 esbuild build script 미처리로 exit 1. 새 JS 환경의 완료 증거로 사용하지 않음. 설치/환경 파일은 보존.
- 이번 기록 수정: 문서 구조와 요구/후속 연결 정적 확인만. 기능 시험을 새로 실행하지 않음.

## 다음 선택과 복구
최신 사용자 steering(2026-10-04): 선배가 이미 구현한 기능을 전부 V6에 연결하는 것을 우선한다. W03-E 검증과 Draft PR #18 생성 완료 후, 다음은 W04 임무 관리의 기존 action/tasks/validate/replan 재사용이다. 이어 W05 SIM/WS, W06 KPI/export, W07 MOCK-HIL, 남은 카탈로그 흐름과 W08 화면 간 조립을 확인한다. full_integration_plan.md의 최신 우선순위 표가 이 순서를 추적한다. 새로운 위성 기능 확장은 후순위이며 F001/T032/F004~6는 유지한다. 아래 기존 선택 문장은 날짜별 이력으로 보존한다.

현재 승인 A의 T033~T036 RF 계산기 연결과 검증을 완료했다. 다음 단계는 별도 Draft PR 리뷰 및 F001 실제 서비스·장비 조건 선정이다. T032 프레임 검증은 사용자 지시로 보류한다. 합의된 수치와 기존feature를 재사용한다. 아래 날짜별 초기기록은 이력이며 현재 진행단계를 되돌리는 지시가 아니다. 첫 단계 수행과 전체제품완료를 별개로 검토한다.
현재 사용자에게 반복 선택을 요구하지 않음. 합의된 사항은 유지. 새로운 기술 선택과 기능 확대는 구체적 검토안을 마련하여 함께 논의한다.
Hooks: extensions.yml 없음. 필수 hook 없음. 현재T028/verify repair count: 3. 전체 제품 완료: 아님.

## 첫 단계 명세 개정 기록
constitution 1.2.0으로 충돌을 정리했고 spec.md의 FR-001~008을 R001~010에 연결했다. 초기 spec/checklist는 review_history에 보존했다. 다음 선택은 clarify: SC-002 정확도 기준과 SC-006 성능 목표를 구체적 제안으로 공동 검토한다. 계획은 계속 stale, 구현은 pending이다. Repair count: 1 (정량 기준은 임의 확정하지 않고 열린 항목으로 유지). 기능 검증 없음.

## 정확도/성능 clarify 진행
validation_targets_proposal.md에 검토용 목표와 측정 조건 작성. 질문 Q1: 첫 단계 기준을 계산 구현 일치 검증으로 정하고 실제 ISS 위치 정확도는 별도 관측 기반 후속 평가로 분리할지. 답변 대기, 합의/명세 수치 변경 없음. 성능 수치는 미승인 제안. 공식 검색 자료 확인, 일부 본문 fetch 실패; 기준 데이터 실제 확보/검증 미실행. clarify running, plan stale 유지.

## Clarify Q1 수용
사용자가 계산 구현 일치 검증과 실제 ISS 위치 오차 평가의 분리에 동의. spec.md Clarifications/SC-002에 반영. D006: 첫 단계 정확도 의미 확정, R005/R007 연결. F005: 실제 ISS 위치 오차 평가는 별도 관측 자료 확보 시 후속 검증 단계에서 평가, 현재 대기. 숫자 오차 목표는 미확정. Q2는 사용성 성능 목표 제안에 대한 질문. 질문 1개 답변 완료, clarify running, 계획 stale 유지.

## Clarify Q2 steering: 게임 기준 사용성
사용자가 게임 기준으로 설정 지시. D007/R009: 부드러운 움직임과 즉각 피드백 우선, 30fps 제안 대체. 구체화 제안은 60fps/프레임 p95 16.7ms, 입력 피드백 p95 50ms, 시간 변경 결과 p95 100ms, 24시간 가시 계산 p95 1초. 수치 자체는 미승인 제안으로 구분하고 실제 달성 미검증. 고주사율/부하 확장 목표 미확정. clarify running, plan stale, 구현 pending 유지.

## Q2 구체 성능 목표 수용
사용자 동의로 60fps/입력 피드백 p95 50ms/시간 결과 p95 100ms/하루 구간 p95 1초 및 측정 조건을 SC-006에 반영했다. 이전 미승인 제안 상태는 이 합의로 갱신. R009 성능 목표 결정 완료, 실제 검증 없음. 다음 질문 Q3: 기준 계산 대비 위치 10m/고도각 0.01도/구간 경계 1초 허용 오차안. 숫자 정확도는 아직 미확정. clarify running, plan stale 유지.

## Q3 정확도 목표 합의 및 설계 준비
사용자 동의로 위치 10m/고도각 0.01도/구간 경계 1초 기준을 SC-002에 반영. D008/R005: 동일 조건 기준 계산과 비교, 라이브러리 공식 시험은 별도 유지. clarify 질문 3개 답변 완료. 첫 단계 specify/clarify/checklist complete. 실제 정확도/성능 검증 없음. 다음 skill은 speckit-plan: 기존 stale 계획을 최신 첫 단계에 맞춰 재작성하고 기준 자료/변환/재사용 경계를 고정. 작업 목록/구현은 설계 검토 후 진행. 전체 R003/R006 및 F001~F005는 종료하지 않음.

## Plan Phase 0 설계 조사
speckit-plan 지시에 따른 읽기 전용 연구 에이전트와 로컬 코드 조사. 초기 계획/연구/모델/계약/quickstart는 review_history 보존. Python sgp4 주 계산/JS-Cesium 표시를 설계안으로 기록, 사용자 승인 사실로 기록하지 않음. 기존 5도/45초/최대3개/높이 미반영/synthetic fallback 위험 확인. 기준 fixture 해시/패키지 호환/시간 변환 계약 미해결이라 Phase 1 진입하지 않음. 다음: 설계안 공동 검토 및 연구 게이트 해소, 이후 data-model/contracts/quickstart 작성. plan running, tasks/implement pending, 전체 목적/필수 후속 유지.

## 사용자 steering: Rust/C++ 계산 코어 재검토
사용자는 고성능 계산에 Rust/C++ 사용 가능성과 AeroDT 연결 시 추가 설치 허용 의견을 제시했다. Python 주 계산은 미승인 설계 권고였으므로 확정으로 취급하지 않는다. JS/Cesium UI, Python/FastAPI API, 구조/정확도/성능 목표는 보존하고 계산 코어 선택만 재검토한다. R008 영향: Python은 API/조립 유지, Rust 코어 후보. F006: Rust SGP4 라이브러리 공식 기준 시험/라이선스/배포 지원과 C++ 가속 Python 비교 조사, 담당 plan 연구, 코어 선정 전 해결. 공식 sgp4 패키지는 C++ 가속 경로와 pure Python fallback이 있어 언어 이름만으로 속도 비교 불가. Rust 연계 후보는 PyO3 Python extension 및 향후 C ABI 또는 프로세스 통신. 네이티브 경계/메모리/오류/버전 계약과 Windows binary packaging 검토 필요. 새로운 계산 코어 확정/설치/벤치마크 없음.

## Rust 우선 후보 조사 결과
사용자 동의는 후보 검토 진행이며 성능 달성/최종 라이브러리 채택 증거가 아니다. rust_core_review.md 작성. sgp4 2.4.0, MIT, WGS84/IAU vs WGS72/AFSPC 모드 차이, PyO3/maturin Windows wheel 경로 확인. Rust 도구는 PATH 미확인, 설치/빌드/benchmark 없음. F006 부분 조사 완료, 실행 게이트는 열림. plan Phase0 running. 다음은 격리 도구 환경 준비/공식 fixture 비교와 배포 시험 계획 구체화, 사용자와 설계 검토 유지.

## Rust 검증 준비 실제 증거
공식 sgp4 2.4.0 crate 다운로드 및 SHA256 manifest 기록, MIT/LICENSE/시험 소스 정적 확인, 33 입력/668 상태 inventory 확인. Rust/MSVC 표준 위치 미확인. 실제 cargo/benchmark는 미실행. 프로젝트 전용 Rust 경로 + 시스템 MSVC/SDK 설치안은 rust_build_preparation.md에 기록. 시스템 설치 구성 확인이 다음 사용자 논의 항목. 설치 approval review rejection 없음.

## 설치 승인 실행 및 수치 baseline
사용자 승인 설치 완료: 프로젝트 Rust/Cargo1.98.1 및 시스템 MSVC14.44.35207/SDK10.0.22621.0. 재부팅 필요 없음. Rust persistent PATH 변경 없음. release compile 및 unit9/propagation33입력668상태 통과. doc9PASS/1FAIL, 전체 exit101: 네트워크 예제 sandbox 실패 후 재시도 certificate expired. 전체 통과 아님. F006 환경/라이브러리 수치 baseline 부분 완료, C++ benchmark/wheel/직접 기준 대조 미완료. 다음은 설계 연구의 비교 시험/변환 계약 정리. tasks/제품 구현/웹 검증 미진행.

## Rust/C++ 실측 결과
동일 ISS/WGS72/AFSPC 및 epoch+24h 시각 배열 검증: 위치차이 최대6.874e-6m, 10m 게이트 통과. 86400배치 중앙값 Rust18.1175ms/C++18.2558ms, C++ scalar113.4258ms. 언어 우열/실측 위치/60fps 완료 주장 없음. D009 검토권고: Rust 우선 및 batch 계약, 승인은 기존 후보 연구 범위로 해석. F006 성능 baseline 비교 완료, PyO3 wheel/직접fixture 대조 남음. 전체pytest35PASS/경고1. Phase0의 변환/배포 게이트 남으므로 plan running 유지. 다음 사용자 검토: 동급 성능 근거와 Rust batch 코어 설계.

## Rust batch 계약 검토안
사용자 OK에 따라 Rust 우선 후보의 입력/출력/단위/오류/메모리/상태/최신요청 계약을 contracts/rust_python_batch.md에 작성. 이는 설계 검토안이며 미해결 연구 게이트를 건너뛴 Phase1 완료 아님. 다음 검증은 최소 PyO3 wheel 및 batch 경계 비용, 이후 변환/고도각 계약. 기존 초안과 전체 목적/후속 필수 유지. 이번 변경 문서만, 계산/제품 소스 변경 및 신규 시험 없음.

## Rust–Python 최소 연결 검증 결과
최소 wheel/repair/별도venv 호출 성공,probe9PASS/project35PASS경고1. 반환 경로 실측86400: list57.1567ms/buffer20.0098ms/C++20.0791ms. R008/F006 Python 연결 및 동일PC 격리 설치 부분 증거 확보, 다른PC/ABI/배포/행별오류/서버/UI 완료 아님. 버퍼 반환은 설계 우선안, 제품 source 미변경. 다음skill speckit-plan Phase0 변환/time/독립기준 연구를 해소한 뒤 Phase1 문서 정리. 사용자 새 AGENTS는 작업 규칙으로 확인했으며 skill 개선 작업은 요청되지 않아 실행하지 않음.

## 좌표/time/고도각 연구 검토안
coordinate_time_review.md에 TEME→UT1 기반 회전→ITRF→WGS84 관측점 ENU 고도각, 고정 EOP/윤초 출처 계약과 Vallado Appendix C 공개 위치 fixture를 기록했다. Astropy 독립 구현 비교 후보는 site/EOP/버전 고정이 필요하다. 원문 해시/고도각 fixture/실제 계산 시험은 미완료. 제주 높이0m는 후보 가정, 사용자 확정 아님. R005/R007/R008 연구 진전, F002 실제 통신 필수 유지. plan running, tasks/implement pending. 다음은 기준 자료 확보 및 격리 수치 검증. 새 AGENTS contextual SkillOpt 허용을 확인했으나 현재 단계에 반복 실패나 새 archived 증거를 확인하지 않았으므로 실행하지 않음.

## 좌표/time 최소 수치 검증
coordinate_probe_results.md 및 tooling/coordinate_probe에 공식 fixture와 저장 IERS/윤초 snapshot 검증 기록. 공개 위치 사례 차이0.0132868m, 8641시각 고도각 차이1.279e-13도, 8개경계 차이0초. ERFA 공유 및 C++ 입력이므로 완전독립/Rust통합 검증 아님. R005/R007 부분 증거 추가, 짧은 구간/윤초/범위오류/속도/통합성능 및 F002 유지. plan running, tasks/제품implement pending. 다음은 남은 경계 시험 및 Phase1 설계 문서 갱신. 기존 합의/기능 보존.
회귀 최종: 전용환경 + 프로젝트 내부 basetemp 지정 pytest35PASS/경고1(2.54초). 기본 임시경로 setup오류10은 재실행으로 해소, 수치probe도 snapshot재실행 PASS. 계획연구는 계속 running.

## 현재 계산 검증 묶음 종료
사용자 지시: 이번 검증 전부 수행 후 종합 보고. 확장17PASS/Rust연결9PASS/회귀35PASS, 공개fixture/1초dense/짧은pass·gap·tangent/잘림/윤초 및 합성epoch Rust비교/EOP범위/오류/속도/하루탐색p95 시험 완료. 상세수치 coordinate_probe_results.md 및 extended_report.json. R005/R007/R008 현재 연구용 계산경로 증거 확보. 공유ERFA와 극값가정은 한계로 유지. 제품 UI/서버/다른PC/실통신 후속은 종료하지 않음. plan running은 Phase1 문서갱신과 배포설계 정리 전 유지; tasks/implement pending. 다음 skill speckit-plan의 기존 data-model/contracts/quickstart/technology_selection을 검증결과에 맞춰 갱신. 반복 승인 없이 이번 계산검증 묶음 마침. 기존 합의 삭제없음.


## Phase1 설계 및 tasks 결과(현재 상태)
plan/data-model/orbit_api/workspace/quickstart와 architecture/technology_selection을 최신 Rust+Python+JS 증거에 맞춰 갱신. 이전 문서는 review_history/20261001_before_phase1에 보존. V6 원본3파일 해시 확보, 제품UI 교체 없음. setup-plan/setup-tasks/check-prerequisites JSON 성공, hooks 파일 없음. tasks30개 모두 미완료, US1 8/US2 5/US3 4, 공통13, checklist 형식 오류0. 문서 원칙 검토 완료. 다음은 공동 설계 검토 후 speckit-analyze read-only 분석, 필요한 정정은 담당 stage로 되돌아간다. implement는 아직 pending.

후속 ID 정정: 최초 표의 F001=실제 통신 조건 필수, F002=나머지 기능 순서/단계별 연결이다. 일부 이전 append에서 F002를 실제 통신으로 잘못 호칭했으며 ID를 새로 생성하거나 요구를 삭제하지 않고 이 표 기준으로 교정한다. F003환경/성능 일부 설계완료, 실제브라우저목표는미검증. F004실제HIL/영구기록 등 한계, F005실측위치, F006배포지원 미해결 범위 유지. 현재 범위에서 임무/분석 기능 순서를 임의 확정하지 않는다.

새 가정 A002: 제주33.4996/126.5312, 타원체높이0m/24h, worker2·대기2/위치count3601/재생0.1~60은 첫 구현의 기술 검토 기본값이다. 실제 시설값이나 사용자 개별승인으로 표현하지 않음. 수정가능한 configs/계약에 명시. R005/R008/R009.
새 증거 E010: 30task 문서형식 및 prerequisite 검사 성공. 이번 turn은 문서작성만, 새로운 기능시험 실행없음. 연구 PASS는 이전 계산연구에 한정. 전체목적완료 아님.


## 전체 요청 범위 보완(현재 authoritative scope)
사용자 지적 수용: 현재상세설계는최초요청전체중첫궤도/가시성묶음일뿐이다. full_integration_plan.md에W00~W09전체기능/근거/계층/게이트/V6업무16개 연결표를추가하고R003/R006을후속일정메모만으로완료처리하지않는다. 최초합의는보존. V6원본읽기결과별도창존재확인, 제외안교정: T031(US3) 보존/동기화/충돌시험추가. tasks31/US1 8/US2 5/US3 5/공통13. 전체기능상세계약미완성상태를명시. implementation pending 유지, 다음speckit-analyze read-only 실행. 현재사용자는분석진행및범위보완을승인했다.



## analyze 반환 후 controller 기록
read-only speckit-analyze 완료: FR8/SC6 총14기준, tasks31/unique31/format오류0. 첫묶음 기준 작업연결14/14, 미배정task0, 원칙위반0, 분석 finding critical/high/medium/low0. 전체후속기능상세계약미작성은명시된후속범위이며첫묶음100%연결로전체제품완료를주장하지않음. 분석중파일수정없음, 이기록은skill반환후controller기록. hooks없음. 다음최초제품작업은T001 기준선/ADR부터이며수치계산코드를한꺼번에이식하지않는다. 현재구현checkbox모두미완료,제품소스변경없음.


## 첫 제품 입력/시간 단위 구현
사용자좋아로첫묶음구현진행 승인. speckit-implement 실제지침/선행조건/원칙확인, 체크리스트8/8(읽기전용), hooks없음, git없음(생성안함). T001ADR/원본·기존소스baseline해시/회귀명령, T002pinnedrequirements/constraints/설치receipt/제품buildscript, T003새제품시험, T004immutable input/UTC/EOP/config 구현 완료. 현재4/31이며first제품기능전체완료아님.

Red: 최초module누락2개 수집실패. 누락OMM필드4시험 KeyError실패 확인 후 required-fields ValueError로수정. 시험시스템temp권한오류 및basetemp상위누락은프로젝트workspace경로생성/명시로정정. Green 최종56PASS(새21/기존35)/기존Starlette경고1,3.37초. pip check 충돌0. buildscript PowerShell parser오류0,미구현native제품manifest guard PASS; wheelbuild는미실행. 현재요구 R001/R005/R007/R008/R010의기반부분증거, V6/API/전파접속/성능미검증. 생성물 data/workspace/validation/orbit_implementation_baseline에기록.

다음T005/T006 Rust제품native경계와OMM/행별오류/공식fixture 제품시험. 그후geometry/runtime/API/V6로계속. 기존선배기능/UI/API/WS계산은수정하지않았다. F001실통신 및F002전체후속연결미완료유지. SkillOpt는현재작업직접요청아니며현재실패는실행경로수정으로해결,새archived근거확인없어서실행안함.


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

## 2026-10-03 T024 작업창 시험 준비
- 변경: 실제 workspace/orbit/ground/playback/globe 조립을 사용하는 회귀시험10개 추가. DOM/Cesium/HTTP/시간 adapter의 경계를 validation/t024_workspace_tests.md에 기록. 제품 코드 변경 없음.
- 검증: 새10개5 PASS/5 FAIL, 전체Node45 PASS/5 FAIL(exit1), 기존40 PASS. 전체Python202 PASS/기존Starlette경고1(100.57초). 실제IAB1920→최소화→1280→복원에서 right1818.5/bottom1006 경계 이탈 재현, 입력·구간 보존. 창 위치와 viewport 복구.
- 실패: 일반축소/최소화복원/확장복원의3가지geometry 경로, 최종pagehide channel 및 gesture 구독 해제2가지. 전체PASS 아님. T025 수정 대상으로 유지하며 시험만 독립 정상 병합하지 않는다.
- 상태: T024 시험준비 완료(첫묶음24/31), 제품은T023까지. 남은7개T025~T030/T031, 전체제품완료율 아님. PR8 게시·첨부/미병합. F001 실제통신/F002 전체기능/게임성능/다중창/배포 미완료. extension hooks 없음.

## 2026-10-03 T025 작업창 복원 및 종료 수정
- 기존feature/체크리스트8/8/skill implement 재확인. workspace.js 크기·위치 제한을 복원/resize/열기에서 재사용, 최종pagehide channel/gesture 멱등 종료 및 persisted 자원 보존. legacy/state.js/CSS/API/계산 변경 없음.
- 검증: T024 실패5개 해소, 작업창10 PASS, 전체Node50 PASS(216.32ms)/Python202 PASS/기존Starlette경고1(101.17초). 실제IAB1920→1280 일반축소/최소화복원/확장복원 경계 안, 높이321m/400초구간1개 결과 유지, canvas1/error로그0. 임시viewport 해제. validation/t025_workspace.md 참조.
- 상태: 첫묶음25/31 완료(시험준비 포함), 남은6개 T026~T030/T031. 다음T026 역순응답/동시성 시험. stage implement/verify는 전체묶음 기준 running. F001 실제통신/F002 전체기능/게임성능/다중창/배포 미완료. extension hooks 없음. T024시험+T025수정 같은PR로 게시, 리뷰/병합은 별도.

## 2026-10-03 T026/T027 요청 경합·취소·렌더 종료
- speckit-auto/implement 및 기존feature/체크리스트8/8/prerequisite 정상, extension hooks 없음. T026 초기Node5 PASS/3 FAIL 및 조립종료1 FAIL을 확인 후 T027으로 연결. 렌더 fixture cache 격리 보완, 서버 concurrency5 PASS.
- 변경: V6 client 취소 상태 정리 및 destroy/늦은결과폐기/대기명령·후속요청 차단, 최종pagehide 조립종료, focus실패 안내. legacy/API/runtime/native/application.py 보존. 이미실행중native/visibility job 강제중단 보장 없음.
- 검증: 전체Node61 PASS(216.97ms), Python207 PASS/기존Starlette경고1(100.20초), diff check PASS. 실제IAB계산/지구이동/재생UTC증가·정지/epoch복귀/canvas1/error로그0. race/고장주입은adapter/실제ASGI·executor증거로 구분. validation/t026_t027_requests.md 참조.
- 상태: 첫묶음27/31, 남은4개 T031/T028/T029/T030, 다음T031. implement/verify 전체기준running. F001 실제통신/F002 전체기능/게임성능/격리설치 미완료. 시험+수정을같은PR게시하며리뷰/병합별도.

## 2026-10-03 T031 별도 창
- 현재 업무/편집값 전달, 화면 재구성 보존, 활성 입력 충돌 안내, opener/등록 child 검증. 서버 선택을 draft에서 제외하고 revision 힌트 후 snapshot 재조회, 409 명령 재시도 없음. 최종 채널/Viewer 종료.
- Node74 PASS/Python207 PASS(102.02초, 기존Starlette경고1), diff check PASS. 실제 Chrome 두 창 전달/양방향 편집/충돌 안내/TLE-OMM-TLE 서버 선택/자식 종료 및 부모canvas1 검증. 도구 popup 캡처 제약은 validation/t031_popout.md에 구분.
- 첫묶음28/31 완료, 남은3개 T028/T029/T030. 다음T028 게임성능 계측·개선. F001 실제통신/F002 전체기능 미완료 유지. PR 리뷰/병합 별도, extension hooks 없음.

## 2026-10-03 T028/T029/T030 계측·격리설치·검토
- 사용자 요청: 남은3개 모두 진행. 기존feature/합의/최초목적 보존, speckit-auto/implement/체크리스트8/8/prerequisite 재확인. 병렬승인 이력에 따라 설치와 계산별 파일을 분리하고 최종시험은 안정된 코드에서 재실행했다.
- T028: 정확UTC/EOP/native 준비와geometry·극값round 배치화3회 개선, 같은지점Cesium property 재사용. 1초grid/40회극값/0.01초root/오류·윤초계약 유지. 1000행중앙0.65630→0.02685초, 하루중앙5.23572→2.06527초. 전후4구간경계/peak차이0초/0도는 동일kernel 회귀이며 독립물리증거 아님.
- 실제IAB각100다른UTC/20다른24h/30초완료3trial, 환경/GPU/전원/hash/화면/probe trace/profile 보존. 1920주trial1개29.814초중단은 삭제하지 않고 별도30초완료로 보충. UTC p95 44.0/43.6ms PASS; 하루2266.0/2197.8ms FAIL. RAF와두RAF피드백도미달, 실제GPU60Hz 제출경로 미입증. SC006FAIL,목표완화없음. validation/t028_performance.md.
- T029: 초기zlib LICENSE누락과잘못된PATH DLL 선택을 검출/수정. datedlocked 제품wheel+선택Python package hash/LICENSE/RECORD/receipt. 새venv no-index/no-deps/프로젝트밖-I 실제native호출2 PASS. 로컬cp314-win_amd64만검증; 다른PC/ABI/OS/실제AeroDT/대외배포license범위 후속. validation/t029_install.md.
- 최종Python224 PASS(107.80초,기존Starlette경고1), Node77 PASS(256.24ms), 제품native integration1 PASS(공식33입력668상태), actualTCP inputs2/samples3/visibility1/409/UTC보존/health PASS, diffcheck PASS. 역순/실패주입은client/ASGI시험, 정상브라우저에서주입했다고주장하지않음. validation/t030_review.md에 FR8/SC6/R10 및후속을연결했다.
- Converge: FR8/SC6/US수용10/기존task31, 계층·상태·입력·검증계획 및원칙5검토. HIGH partial1(SC006), missing/contradicts/unrequested0. append-only Phase7/T032추가, outcome tasks_appended. before/after hooks없음. verify repair3회,implement/verify running유지. 초기31개수행+T032미완료이며 fullyverified/전체제품완료 아님.
- F001실제통신/F002전체선배기능/F004실장비·영구기록/F005실제ISS오차/F006다른PC·ABI·배포·AeroDT 연결을닫지않았다. 다음T032 성능보완, PR리뷰/병합별도. codex/orbit-validation-install은 PR11에의존하며 자동병합없음.

## 2026-10-03 T032 사용자 승인 재개
- 사용자가 남은작업 설명 후 진행을 승인했다. codex/orbit-performance에서 기존feature/목표/정확도/후속을 유지해 implement를 재개한다. T028의3회 실패이력은 보존하며 이번 승인된T032의 bounded개선은 별도 최대3회로 기록한다. 체크리스트8/8 PASS, bootstrap기존구성, prerequisite정상, hooks없음.
- round1: 기존프로파일은 UTC ISOT dict생성/중복포맷 및generic Real검증 비용을 보여준다. 새윤초·나노초·연도경계 시험5 FAIL/1 PASS 후 동일ERFA dtfkernel의배치포맷과float검증 경로를 구현, 관련28 PASS. 실제저장자료8d7.. 하루3회 median1.678초/max2.448초로 여전히미달,4구간경계/peak는보존. t032_round1.json/.prof에 실패표본 유지.
- 병렬승인 이력에 따라 backend추가개선과 browser실제표시·입력계측을 독립파일로 분리한다. 공유서버/기존wheel/환경을 교체하지 않는다. T032 checkbox/verify완료는 실제최종수용시험 전 변경하지 않는다. F001/F002/F004/F005/F006열림, PR12리뷰/병합별도.

## 2026-10-03 T032 하루 성능 개선 및 실제 표시 검증
- Round2 불변 내부벡터/선택주입으로 중간UTC/행객체비용제거. scalar주입/wire/권위상태/기존SIM/1초grid/극값40회/경계0.01초/윤초·오류계약 유지. 저장자료8d7.. 하루median0.48337/max0.49399초, round1 대비4구간·peak·각도·provenance exact일치. 새vector12/format6 회귀와 ADR0006; callback변이 보호1RED→PASS 포함. 추가성능round3없음.
- 실제Chrome 두해상도100다른UTC/20다른24h/30초완료3trial, 중단0/hidden0. 실제presentation p9518.578/18.552ms FAIL; UTC32.0/32.1ms PASS; 관측EventTiming22/25개 p9548ms(16ms검열/8ms반올림). 최종callback보호후 fresh서버추가각20일조회 p95543.1/547.3ms PASS. primary/추가/probe/최댓값/전체gzip trace/GPU/hash/환경/screenshot 보존. 모니터60Hz경로 인증이나전원/주사율변경없음. validation/t032_performance.md.
- 최종Python242 PASS113.49초/기존Starlette경고1, Node82 PASS351.32ms, product native release locked offline integration1 PASS(공식33/668), 실제TCP 입력2/샘플3/구간1/409/UTC보존/health PASS. 역순 덮어쓰기0은 client/ASGI 회귀근거이며 정상브라우저에서고장주입했다고주장하지않음.
- implement/verify running 및T032[ ] 유지: SC006의frame16.7ms/실제60Hz표시전제가남음. 목표완화/실패표본삭제/완료재분류없음. 이번범위의계산개선과검증은리뷰용으로게시하되 Draft/자동병합없음. 최초전체목표/F001실통신/F002전체기능/F004/F005/F006은그대로열림.

## 2026-10-03 T032 프레임 대조군 재개
- 사용자 T032 진행 승인에 따라 계산/Cesium/API 없는 10초 순수RAF/Canvas 대조군을 측정했다. 두해상도 정상 p95 약18ms로16.7ms 미달, 앱 계산만이 원인이라는 근거 부족. 일부 회귀 병행/비정상23표본/브라우저 제어 지연은 별도 기록하고 제품 수용시험으로 사용하지 않는다.
- project_support/tooling/frame_scheduling_control.html과 validation/t032_performance.md에 재현/한계 기록. 제품 소스/정확도/표시 품질/환경 설정 변경 없음. round3 미사용, T032[ ] 및 implement/verify running 유지.
- Python 기본 tmp setup135 PASS/107 ERROR 후 프로젝트 내부 새 basetemp242 PASS109.66초/기존경고1. Node82 PASS294.26ms. F001/F002/F004/F005/F006과 실제 표시 경로 재검증 유지. PR13 Draft 업데이트, 자동병합 없음.

## 2026-10-03 사용자 프레임 후속 보류 및 W03 진입 검토
- 사용자가 프레임 문제는 나중에 확인하고 다른 구현을 이어가도록 지시했다. T032는 deferred로 유지하며 완료/실패 해소/목표 완화로 처리하지 않는다. R009의 나머지 통과 증거와 실패 원문 보존. 초기 구현과 전체 목표/F001/F002 유지.
- speckit-auto/clarify 및 bootstrap/prerequisite/constitution/기존 spec 확인. extensions.yml 없음. branch codex/rf-link-workspace를 PR13 HEAD에서 분리했다. W03은 첫 범위 선택을 위한 clarify running이며 상세 plan/tasks/구현은 pending이다.
- 선배와 현재 RF 함수/API/legacy UI 및 가까운 회귀를 검토, rf_workspace_review.md 작성. 기존 RF/route 시험1 PASS0.03초. 실제 서비스/장비 출처, 3dB 판정, 숨겨진 입력 및 시나리오 contact 구분이 공백. 제품 코드 변경/전체 검증 없음.
- 질문1개/답변0개: A 직접 설정 RF 계산기부터 연결(권고), B ISS 서비스·수신 장비 먼저 선정. 답변을 기다리며 공식 ITU/ARISS 조사와 기존 기능 검토만 진행. 자동으로 A를 승인 처리하지 않는다.


## 2026-10-03 W03-A RF 계산기 연결 및 검증
- 사용자 A 승인: 직접 설정 RF 계산기부터 연결. 질문1개/답변1개, 기존 feature를 확장하고 합의와 이력을 보존했다. 실제 통신 조건 F001은 반드시 후속 조사·적용하며 A로 종료하지 않는다.
- clarify/spec/plan/tasks complete: FR009/SC007, rf_workspace 계약, research/data-model/quickstart 및 T033~T036. analyze read-only 검토에서 새 범위의 차단 충돌0; 명세 체크8/8, prerequisite PASS, extensions.yml 없음. 기존 constitution 보존. 구현/전체 검증 단계는 T032/F001/F002 때문에 전체 complete로 바꾸지 않는다.
- T033 RED: 새 RF JS 모듈 미존재. T035 RED: V6 RF 입력 미조립으로4개 실패. 이후 controller/transport/panel/창 연결을 순서대로 구현했다. 기존 선택 회귀의 data-URL 테스트 어댑터는 새 RF import를 처리하도록 갱신했다.
- T034/T035: 11개 입력은 모두 빈 초기값, 기존 API 범위/단위/echo/8개 유한 출력/기존 status 검증. generation/abort/종료/입력 변경으로 늦은 결과 폐기. 기존 RF 서버 계산/API/schema는 변경하지 않았다. 화면용 사본과 창 draft만 소유하며 GP/UTC/revision을 변경하지 않는다.
- E-RF: 전체 Python304 PASS108.66초/기존 Starlette 경고1, Node95 PASS317.33ms. API62개 시험은 실제 ASGI 공개 endpoint의 독립 수치/반올림전status/경계/상태불변 확인. 실제 IAB1280×720/1920×1080에서 기존 HTTP 결과, 빈 입력/거리 경계 오류, 모델 여유 부족, 창 복원/역할 전환/스크롤·확장 확인. 별도 창 전달은 실제 assembly를 사용한 DOM 어댑터 시험 근거이며 실제 OS 창 검증으로 부풀리지 않는다.
- 원본 HEAD1a1e00297a0301637455b0ef2cf48b2e74576b07 대비 RF 함수3/HTTP 함수3/LinkBudgetRequest AST7개 동일. 검증보고서 validation/t036_rf_workspace.md. FR009/SC007 이번 범위 완료. F001 실제 통신/F002 전체 기능과 T032/SC006 실패 기준은 열린 상태다.
- 별도 codex/rf-link-workspace Draft PR 게시 및 리뷰. 자동 병합 없음. 네이티브/Rust/wheel 변경이나 이번 신규 native 실행 없음.


## 2026-10-04 최종 검토 보완
읽기 전용 검토에서 링크 이름의 Unicode 길이 차이를 확인했다. 서버는 code point40자, JS text.length/HTML maxlength는 UTF-16 단위를 세므로 emoji21~40자를 과도하게 거부했다. emoji40/41 경계 시험 RED 확인 후 [...text].length와 maxlength 제거로 서버 계약에 맞췄다. 실제 V6→기존 API에서도40자 정상/41자 오류 확인했다. 계산/API/schema는 그대로다. 수정 후 전체 Python304 PASS103.50초/기존경고1, Node95 PASS313.47ms. 최신 원자료 pytest_final.log/node_full_final.log/unicode_red.log. 이미 기록한 이전 검증은 이력으로 보존한다. 실제 통신 F001과 보류T032는 미완료 유지.

## 2026-10-04 W03-B 범위 확정/설계/작업
질문2/답변2: ISS부터, 장비 아직 없음. 원래 선배 기능→V6→독립 AerODT 호환 구조 목표 및 확정 사항 보존. FR010/SC008과R006/R007에 T037~T040 연결. F001 실제 조건의 부분 연결, F001전체/F002/T032보류 유지. clarify complete. 변경 영향은 신규 plan/tasks/analyze/verification 범위에 한정하며 기존 T033~36 검증 보존. setup-plan/setup-tasks 실제 실행, extensions.yml 없음. research/data-model/contracts/quickstart 보완 및constitution 충돌0. plan/tasks complete, analyze pending, implement pending. 조회는 공식 버전 snapshot이며 현재 운용/수신 보장은 없음.

분석 read-only: FR010/SC008→T037~40 coverage100%, 신규 task4개 unmapped0/ambiguity0/duplication0/critical0. Constitution 충돌0. 기존 T032 실패와 전체 F001/F002 미완료를 숨기지 않는다. analyze complete. Implement gate checklist requirements8/8 PASS(문서 품질), hooks 없음. T037 Python 모듈 미존재 collection error/Node 모듈 미존재 FAIL을 제품 구현 전 확인. implement running.

## 2026-10-04 T037~T040 검증 완료
FR010/SC008→R006/R007 부분 증거 E-ISS-PROFILE: validation/t040_iss_receive_profile.md. clarify/plan/tasks/analyze 신규 범위 complete, checklist8/8. RED 후 실제 구현, Python313 PASS107.66초/기존경고1, Node103 PASS340.8823ms, 실제두해상도 UI/GP7입력보존/error로그0/AST7동일. 버전snapshot 주파수만 공식,장비없음/현재수신unknown. package JSON은소스배포, native전용wheel변경없음. 원격draft는가정,로컬복원은보존. FR010/SC008이번묶음complete,전체implement/verify running;F001전체/F002/T032보류및F004~6미완료. codex/iss-receive-profile stacked Draft PR게시/리뷰,자동병합없음.

2026-10-04 추가 사용자 합의: 개발/UI검증 포트8891고정, 동일포트프로젝트서버재시작. CLI기본값/실행문서/AGENTS반영. entrypoint RED후전체Python314 PASS107.71초/기존경고1,8891health200. 기존포트검증이력/전체미완료항목보존.

## 2026-10-04 W03-C 다음 선택 확정
추가질문1/답변1: 선배 코드의 통신 경로·접촉 계획 기능 연결. 거리/도플러 선택안은F001후속유지. speckit-auto/clarify 실행, bootstrap/prerequisite/setup-plan/setup-tasks 실제실행,hooks없음. FR011/SC009→R002/R003/R004/R007→T041~44 신규범위만plan/tasks/analyze/verify검토. 현재branchcodex/communication-planning은8891설정localcommit위에서진행. 설계/계약작성;clarify/plan/taskscomplete,analyze pending. 기존완료/보류T032/F001전체/F002전체보존.

분석 read-only 완료: FR011/SC009→T041~44 coverage100%, unmapped0/critical0/constitution충돌0. requirements8/8 문서품질PASS. 기존API11PASS, 신규JS 모듈미존재 RED확인. analyze complete, implement running.

## 2026-10-04 T041~T044 연결·검증
FR011/SC009 증거 E-COMM-PLANNING: validation/t044_communication_planning.md. 이번 clarify/plan/tasks/analyze/implement/verify 묶음 complete. Python325 PASS113.65s/기존경고1,Node114 PASS362.4772ms,실제8891두해상도/입력18개보존/20행/오류0/원본AST9동일/read-only review결함0. 전체feature implement/verify running; F001/F002/F004~6/T032보류유지. stacked Draft PR 게시,자동병합없음.

## 2026-10-04 다음 기능 범위 확인
사용자 이어서 진행 지시. 바로 앞 응답의 두 후보(ISS 거리·도플러 / 선배 임무 관리) 중 어느 기능인지 아직 특정되지 않아 clarify 질문1/답변0 대기. 기존 완료T041~44 및보류T032 보존. 기존feature/bootstrap/prerequisite/constitution/hooks(없음) 확인. 읽기 전용 조사: 원본 simulation/browser/oisl.js는 상대 위치·속도의 range_rate_km_s 계산을 제공하지만 현재 product orbit_calculation.py는 속도를 결과에 넘기지 않아 ISS 거리·도플러는 추가 typed 계약과 검증이 필요. 임무는 기존 MissionRuntime/HTTP4경로가 있어 해당 함수 재사용 가능. 제품 소스·계산·API 수정 없음, 새 구현 검증 실행 없음. 범위 답변 후 해당 부분만 spec/plan/tasks/analyze를 보완한다.

## 2026-10-04 W03-D 범위 확정
clarify 질문1/답변1: 위성관련먼저 → ISS 거리·도플러 후보선택. 기존기능·최초목적·8891/T032보류보존. FR012/SC010→R003/R005/R006/R007→T045~49. 기존feature bootstrap/setup-plan/setup-tasks 실제실행,extensions없음. clarify complete, plan research running. 기존임무API는F002후속유지. 단일시점 모델 계산, 실제수신증거미확인.

W03-D plan/tasks complete: research agent 물리식·좌표·근사 검토, 기존scalar/native 재사용,단일UTC계약/ADR계획/5task. analyze pending. clarify1/1,기존requirements8/8 재검토PASS(문서품질). hooks없음.

분석 read-only 1회: 기존 전체이식표 W04가임무인데 신규범위를W04로명명한 불일치1(MEDIUM)발견. authoring단계에서신규범위를W03-D로수정,기존임무W04보존. 재분석 FR012/SC010→T045~49 coverage100%,미연결0/충돌0/모호0/constitution위반0. analyze complete,repair1. Implement gate requirements8/8 checked/0unchecked,문서품질이며기능검증아님.

## 2026-10-04 T045~T049 구현·검증 완료
FR012/SC010 → R003/R005/R006/R007 증거 E-ORBIT-RADIO: validation/t049_orbit_radio.md. 기존 선배 내적식/네이티브 속도/좌표 변환 재사용. 신규 범위 clarify/plan/tasks/analyze/implement/verify complete. 전체 Python349 PASS116.61s/기존경고1, Node122 PASS393.7302ms. 실제8891두해상도/복원/입력오류/공식 출처/GP·RF16입력보존/canvas1/error0. 리뷰 boundary 보완 및 실제화면 주파수 provenance 보완 RED→PASS, 최종 리뷰 추가결함0. 기존 전체 feature implement/verify running; F001전체/F002/F004~6 및 T032보류/SC006미달 유지. 사용자 질문1/답변1 모두 해소. 다음은 Draft PR 리뷰, 자동병합없음.

## 2026-10-04 W03-E 승인 및 설계
사용자 “좋아”로 가시구간의 거리/고도각/도플러 그래프와 표본 요약 승인. 추가 clarify 불필요(제안 그대로), 질문0. FR013/SC011 → R003/R005/R006/R007. 기존feature/bootstrap/prerequisite/setup-plan/setup-tasks 실제실행, constitution1.2.0보존,hooks없음. specify complete, requirements 기존8/8 재검토; plan research running. T032 보류/F001전체/F002/F004~6 보존. 신규 범위 downstream tasks/analyze/implement/verify pending.

W03-E plan/tasks complete: research agent 검토와계약/data-model/quickstart 및5task. Read-only analyze: FR013/SC011 coverage100%(T050~54), unmapped0/duplication0/ambiguity0/critical0,constitution I~V충돌0. 기존 W03-D 단일시점 범위는 이력이며 신규구간 승인으로확장, 기존 wire와scope보존. 분석 repair0. implementation gate requirements8/8 checked/0unchecked(문서품질), hooks없음/ignore검증PASS. implement running.

## 2026-10-04 T050~T054 구현·검증 완료
FR013/SC011→R003/R005/R006/R007 증거 E-ORBIT-RADIO-SERIES: validation/t054_orbit_radio_series.md. 이번묶음 clarify불필요/specify/plan/tasks/analyze/implement/verify complete, hooks없음/8체크PASS. 처음Python363PASS1FAIL architecture→수정 후369PASS125.17s/기존경고1, Node129PASS432.6794ms. 읽기전용marker결함RED→PASS/최종추가결함0. 실제8891두해상도3그래프/복원/오류/clip/none/RF·GP·조회18입력보존/canvas1/error0. 원래17정의AST/물리식보존. 구현검증 repair2(marker/계층), 명세분석repair0. 전체feature implement/verify running. F001전체/F002/F004~6/T032보류와처음목표유지. PR17 위stacked Draft PR리뷰, 자동병합없음.


## 2026-10-04 W04 시작
사용자 임무 연결 순서 수용(좋아). 기존 feature/bootstrap/prerequisites/setup-plan/setup-tasks 실행, constitution1.2.0과 기존 결정 보존. hooks 없음. FR-014/SC-012→R003/R004/R007/R010→T055~58. clarify 불필요(기존 기능 연결 승인), 질문0. specify/plan/tasks complete; 전체 기능/F001/T032 미완료 유지. 현재 구현/검증 pending.


## 2026-10-04 W04 검증 완료
FR-014/SC-012→R003/R004/R007/R010→T055~58 evidence validation/t058_mission_workspace.md. clarify불필요/질문0, specify/plan/tasks/analyze/implement/verify 이번묶음 complete, hooks없음/checklist8/8. Read-only 일관성 분석 coverage100%,추가충돌0. 기존 API4파일 diff0, 요청직렬화/scoped초안/소수native입력노드유지. Python371PASS125.76s(기존경고1),Node134PASS457.4237ms. 첫전체pytest Temp권한오류는 workspace새basetemp로해소하고실패기록보존. 실제8891두해상도 CRUD/충돌/preview/apply/상태실패/소수키/복원/입력18개/canvas1/예상치못한error0 확인. 전체 feature implement/verify running, F001/F002/W05~09/T032 보존. 다음 W05 기존 SIM 제어/WS. PR18위 Draft PR 리뷰, 자동병합없음.

## 2026-10-04 W05 승인 및 재개
사용자 좋음 승인: 선배 기존 SIM 제어/시나리오/장애/텔레메트리 연결. 기존 전체 R001~R010/F001~F006/T032 보존. specify/plan/tasks W05 갱신, 계약 sim_workspace.md. clarify 추가 질문 불필요(기존 서버 의미 재사용). analyze 읽기 전용: FR015/SC013→T059~T062 및 기존 계층/상태/포트/검증 일관, blocking 0. checklist 기존 완료 항목 재검토. implement running, RED 시험 먼저. 후속 KPI/export/MOCK-HIL/catalog/교차화면 남음.

## 2026-10-04 W05 검증 완료
T059~T062 checked. FR015/SC013→validation/t062_sim_workspace.md: 기존 SIM API/계산 보존, controller RED→PASS, Python372/Node142, 실제8891 두해상도/단일canvas/스텝·리셋·시나리오·장애/초안/임무 확인. 초기 timer 오류/오류메시지 소실/old-run 지표 보완 및 회귀, 분석 blocking0/checklist8of8. specify/plan/tasks/analyze/implement W05 complete; verify 승인단위complete. 최초전체R003/F002 및F001/F004~6/T032 미완료 유지. 다음 사용자검토: 기존 KPI/내보내기 연결. PR19 위 독립 Draft 게시 진행, 자동병합없음.

## 2026-10-04 W06 승인
사용자 진행 승인. 기존 W05 PR20/head01d82df 기준 새codex/kpi-workspace. 원래목표/합의와F001~6/T032보존. 동일feature setuphelpers/constitution1.2.0/hooks없음. FR016/SC014→T063~66. specify/plan/tasks W06 complete, analyze/implement pending. 기존내보내기시점과CSV출처없음을계약에명시, CSVpreview/JSON동일응답으로연결. clarify추가질문불필요(기존기능범위). 테스트 RED작성, Python import경로오류는 bootstrap으로수정, JS새module없음RED.

W06 readonly analyze: FR016/SC014 coverage100%(T063~66), requirements2/tasks4/unmapped0/duplication0/ambiguity0/critical0,constitutionI~V충돌0. checklist requirements8/8/unchecked0, hooks없음. 분석단계파일수정없음, controller에서결과기록. implement게이트통과. T063 Python2PASS, 새module/transport/assembly없음RED확인. T064/T065 구현후Node150PASS. pending T066 전체pytest/실제다운로드/두해상도.

## 2026-10-04 W06 검증 완료
T063~T066 checked, FR016/SC014→validation/t066_kpi_workspace.md. Python374PASS126.12s/기존경고1,Node150PASS527.8934ms. 기존계산/API/CSV/JSON/chart diff0. 실제8891두해상도 상세/필터/이력/고정JSON/복원/응답내용일치 확인. 브라우저download완료 이벤트 timeout, 디스크 저장완료 미확인은 보고서에 별도보존. 승인단위 specify/plan/tasks/analyze/implement complete, verify 응답/화면검증complete 및 파일저장증거 미확인. 전체feature implement/verify running/F001~6/T032보존. 다음 W07 기존 MOCK-HIL. PR20 위 Draft, 자동병합없음.

## 2026-10-05 W07 resume
User approved remaining work. Originalgoal/R001~R010/F001~6/T032/W06disk-saveunknown preserved. Samefeature, constitution1.2.0, bootstrap/prerequisites/setup-plan/setup-tasks run, hooks absent. New branch codex/mock-hil-workspace above PR21/head3317ce9. specify/plan/tasks W07 complete; downstream analyze/implement/verify pending. Clarify not applicable: existing mocked contract/three sequence types verified, no new equipment assumption. Checklist existing8/8 rechecked. Host0.0.0.0:8891 userdecision preserved, runtimerestart prior snapshot saved ignored network_access.

W07 readonly analyze report: FR017/SC015 mappedT067~70,2requirements/4tasks,coverage100%,unmapped0/ambiguity0/duplication0/critical0;constitutionI~V0conflicts,8/8checklist,nohooks. Analysis itself readonly, controller records afterward. Implement prerequisites passed, originalPython2PASS, API signal/moduleabsence RED confirmed. T068/T069 running.

## 2026-10-05 W07 complete
FR017/SC015→T067~70→validation/t070_hil_workspace.md. W07 specify/plan/tasks/analyze/implement/verify complete: Python376PASS135.64s/기존경고1,Node159PASS583.0478ms,실제8891두해상도동작/성공·실패/복원/console0. Source original5files diff0. Controller최종readonlyreview추가결함0. 전체feature implement/verify running, F001~6/T032/W06disk-saveunknown 보존. 다음 남은catalog흐름,이후교차화면. PR21 stacked Draft/no merge. 서버0.0.0.0:8891 유지.

## 2026-10-05 US10 Catalog 재개
사용자 승인 다음단계: 기존 카탈로그 검색/그룹/목록/상세의 V6연결. 최초 목적과 R003/F002 유지, T071~74 추가. spec→plan→tasks의 US10 수정 후 읽기 전용 분석: FR018/SC016/US10/T071~74 계약과 책임 방향 일치, constitution1.2.0보존, 새stack/schema없음, 명시조회 선택은 routine UX 결정. prerequisites 통과 후 implement running. clarify/checklist는 기존합의 재사용(미해결 질문 없음); extensions hook 없음. 이전완료작업삭제없음; verify running.

## 2026-10-05 US10 결과
T071~74/FR018/SC016 complete; validation/t074_catalog_workspace.md: Python377/Node166/actual8891두해상도. Initialpytestpath/setup와golden fallback횟수오류 보존/수정후전체통과. Local catalogue lookup complete, feature-level implement/verify running because F002/W08 and other deferred requirements remain. Next skill: speckit-converge to audit all legacy functions/V6 screen mappings before scoped W08 tasks; no full-feature completion claim. Draft PR22 위 게시/자동병합없음. R001~10/원래목표/장비미선정/0.0.0.0:8891/기존승인 보존.

## 2026-10-05 전체 기능 대조 / Converge
사용자 “좋아 대조해보자”에 따라 최신선배GitHubmain과로컬HEAD 1a1e002 일치확인. legacy_function_audit.md에현재PR23/원본/API53↔31/공통23/원본만30/현재추가8 및 browser-only 누락 추적. current liveHTTP30 확인. missing3/partial7/HIGH8/MEDIUM2, tasks_appended T075~84(Phase9, 기존74task bytes보존). 별도controller기록은converge append후수행. 임무생성없음/보안기능없음 설명을최신원본근거로정정; 기존결정/성과폐기없음. Feature implement/verify running/F002미완료. 새묶음상세spec/plan은stale/pending: 다음 specify/plan을T075 위성카탈로그↔공용지구부터 수행하고 실제구현은별도단계. 이번은정적/읽기전용API대조, 제품코드수정/새기능실행없음. F001/F004~6/T032/다운로드완료unknown/8891보존.

## 2026-10-05 US11 시작
사용자T075첫묶음승인및정밀EOP방식선택. FR019/SC017/US11/T085~89 추가; 원래R003/F002/T075잔여와다른9묶음보존. 최초goal축소없음. clarification완료(officialEOP지원확장), spec/plan/tasks 해당묶음갱신, constitution1.2.0/8of8checklist보존/hooks없음. 읽기전용일관성검토:의존성 userapp→data/native/simulation/contracts,HTTP→contract,renderer데이터주입만; 신규wireADR0010필요. 충돌0, implement/verifyrunning;catalogrenderer가IERS예측을실측으로표현하지않음.

## 2026-10-05 US11 selected catalog position complete
FR019/SC017/T085–89 → validation/t089_catalog_position.md. Python380PASS135.43s plus catalogmodule4PASS; Node170PASS633.3169ms; actual8891twores/singleViewer/clear/native precise IERS-A predictions/sourcehash/live readonly/Astropy oracle0m. Initial cache/allow-list/temp-path failures corrected. ADR0010 additive contract. Scoped verify complete; overall implement/verify running, T075/C001 partial and T076–84/F001/F002/F004–6/T032/W06diskunknown retained. Draft PR above24/no merge. 0.0.0.0:8891 preserved, verified process restart reset in-memory SIM only.

Final US11 review: malformed manifest startup isolation hardened; historical testfixture independent from ignoreddeployment inputs. Full Python384PASS133.29s and target7PASS;Node170PASS. Earlier380-run retained above as intermediate. Final artifacts t089_catalog_position.md; no scoped/overall completion boundary changed.

## 2026-10-05 US12 station list/globe resume
User explicitly approved ground station list/selection shared-globe connection. Original R001–10 preserved, FR020/SC018/T090–94 added; T075 partial, US11complete, otherT076–84 untouched. Constitution1.2.0/requirements8of8 preserved. Scope: original29presets/5groups/cards/visual pick/highlight/focus only, not runtime virtual observer changes or actual equipment. Clarification not needed: readonly selection follows approved previous explanation. specify/plan/tasks scoped updates complete after source review, valid historical artifacts reused; implementation/verification pending, hooks absent. No additional custom checklist or research agents for verified existing data. Gitbranch codex/ground-station-globe basePR25.

US12 readonly analyze completed: FR020/SC018/T090–94/contract/entities/plan mapped, 100%scopedcoverage/unmapped0/ambiguity0/duplicates0/critical0;constitutionI–V preserved/checklist8of8. Ignore rules checked, hooks absent. T090 RED imports/missing setStations proved; T091–93 implementation/175NodePASS complete pending final verification. Existing constraints untouched.

## 2026-10-05 US12 station connection complete
FR020/SC018/T090–94 → validation/t094_ground_stations.md. Original29sites/5groups/cards preserved; Python385PASS137.93s/Node175PASS673.2623ms/actual8891twores/list-and-mouse-pick/filter/clear/restore/views/canvas1/console0/liveGP-UTC-virtualpoint-SIMreadonly. Initial static404expectation corrected against unchanged HTMLfallback; encodedtraversal404. ADR0011/sourcegolden/labels/overlap fallback recorded. Scoped verify complete, overall implement/verify running; T075partial/T076–84/F001/F002/F004–6/T032/W06diskunknown unchanged. Draftabove25/no merge, fixed8891/verifiedrestartSIMmemoryreset only.

## 2026-10-05 US13 resume
User 진행하자 approves next station calculation connection. Existing original purpose, all decisions and deferred gaps retained. FR021/SC019→R003,R005,R007,R010→T095–98; same feature. specify/plan/tasks updated; downstream analyze/implement/verify stale until review/test. Height datum unknown resolved by preserving current user height, not importing prototype altitude. clarify not needed for routine safe mapping; no new feature/constitution/stack. Bootstrap/setup helpers executed existing config preserved; hooks absent. Draft PR26 base092d990. No subagents.

US13 readonly analyze: FR021/SC019 mapsT095–98,coverage100%,ambiguity0/duplication0/critical0/unmapped0,constitution conflicts0. No remediation needed. Existing requirements checklist8/8 reviewed unchanged; extra checklist not warranted for existing input mapping. analyze complete, implement running, verify pending; entire feature still running.

US13 scoped complete: FR021/SC019→T095–98→validation/t098_station_observer.md. Node181PASS713.1441ms/Python385PASS140.61s(경고1)/actual8891twores/canvas1/console0/presetdraft-height-range-frequency-UTC-preserved/explicitapply/none+8intervals/radio. Initial no-input staging lost its draft on input selection; require selecting saved GP first and visible guidance added. RED harness lexical binding corrected. specify/plan/tasks/analyze/implement/verify scoped complete; whole feature running. Hooks absent/checklist8of8 unchanged, no newstack or agents. All original requirements/deferred gaps maintained. Next remaining T075 catalog dynamic geometry/playback/multiple/3D, T076 nodes etc. Draftabove26/no merge.

## 2026-10-05 Goal T075–T084
User explicitly activates goal mode for all ten existing gap bundles. Fullobjective retained: T075 catalog selection/replay/observation/multiple/3Dsun; T076 node edit/layout/constellations; T077 OISL/datafabric/ground; T078 service missions/cluster schedules; T079 data lifecycle; T080 security; T081 scenario runner; T082 shared context/example replacement; T083 integration settings/probe; T084 actualdownloadedbytes. Completion requires source-function audit and scoped automatic+actualUI evidence for each; Draft reviews/no automaticmerge. Existing F001/F004–6/T032 outside these implementation bundles remain disclosed. First goal turn progress: inspectcurrentPR27/tree/audit, addUS14 FR022/SC020 T099–103 for T075 dynamic catalog observation. Existing artifacts valid/preserved; scoped downstreamstalependinganalysis. No genuine blocker/no blocked count. Wholegoal active until all ten proven complete.


## 2026-10-05 US14 scoped verification
FR022/SC020→T099–T103→validation/t103_catalog_time.md/ADR0013 complete. Readonly analyze:2requirements/5tasks/coverage100%,unmapped0/critical0/constitutionconflicts0,existing checklist8of8/hooksabsent. Python399PASS145.73s/5warnings; finalNode190PASS751.8215ms (prefetch/rate/latefailure added). Actual8891twores/601rows/epochexact0m/60xprefetch/seek/errors/minimize-restore/canvas1/console0 and savedselectionreadonly verified. Exactserver restart resets SIMmemory; prior snapshot preserved, GPselection restored with PUT; helper405/wrongGET corrected. No merge. T075partial for remainingoriginalmultiple/3D/sun and all T076–84 retained. Wholegoal active. Previous status-answer turn supplied live evidence but no implementation mutation; this continuation changes tests, resolves UI provenance labels and records actual runtime evidence. Next owner specify/plan remaining T075 from originalglobe source; no blocker.


## 2026-10-05 US15 resume / full group
Previousgoalturn=progress: US14 implemented/actualverified/published DraftPR28 head63443e71e7c431979d8e434584240b45cc8433f8 (Python399/Node191). Full T075–T084 objective active, no blocker. Currentbranch codex/catalog-display-context above28. FR023/SC021→US15/T104–110 wholegroup (all16633 currentactive, nevertablepage100) added; T075 tracks/passes/sun/modes/imagery/representativeSVG remainexplicitlytracked, no scope deletion. Scope no newstack, constitution1.2.0 preserved; original source full limit0/primitivecolors/pick, native source audited. Controller selects specify→plan→tasks samefeature; clarify unnecessary because original functionality/precision choices already approved. Skills actualinstructions/bootstrap/setup-plan run, hooksabsent. PlanPhase0 explicitly dispatched read-onlyresearch agent for unknownmulti-orbit native integration; source-backed findings storedresearch.md, no delegatedcode. Checklist8of8existing reviewed, scoped downstreamanalyze/implement/verify pending until gates.


US15 scoped readonlyanalysis FR023/SC021→T104–110 coverage2of2/7tasks/unmapped0/critical0/ambiguity0/constitutionconflicts0; checklist8of8/hooksabsent. NativeRED proof→T105 complete per validation/t105_catalog_native.md: Rustintegration4PASS (official33/668+manyOMM668),cleaninstall2PASS/new+oldnative6PASS/fullPython401PASS146.00s/5warnings. Actual0.2.0wheelhash/source/license proven; exact41520server restart on8891 preserves savedGP/UTC/observer viaPUT, SIMmemoryreset explicitlydisclosed/priorreportstored. FirstTLE-vs-OMMbytes comparator/missingbuildmaturin/UTF8helper failures corrected withoutloweringaccuracy. T104aggregate/106–110 pending; wholeUS15 implement/verify running. GitlocalbranchbasePR28, Draft willpublishfullgroupunitafter110; no merge. WholeT075–T084 active. Next directsafeaction T104backendRED and T106 validatedcache/sharedUTC/nativeadapter; originaldisplayfunctions stilltracked.

## 2026-10-05 US15 server scene progress
T104 backend RED proved adapter/sharedUTC/scene missing and HTTP405/browser API missing. T106–107 complete per validation/t107_catalog_scene_api.md: immutable preparedGP/epoch cache bounded2 snapshots, wholelimit0/nativechunks50000/sharedUTC-EOP, strictreadonlyHTTP/adapter. FinalPython417PASS165.14s/5warnings/Node192PASS812.9899ms. Initialcompatibilityallowlist failure explicitly repaired preserving originalbaseline exactness; full rerun green. Actual8891active16633allvalid/coldHTTP12.8084484s/warm0.8037933s, ISS13/GEO588/empty0 IDs/order matched originalAPI; conflict409/input422/savedselectionreadonly. OwnPID2148 exactrestart preserves snapshots/PUTselection, SIMmemory reset disclosed; firsthelperreportHTML path corrected beforestop. No Rust/wheel changes; priorT105 product proof retained. T104browserRED/108–110 pending, wholeT075–T084 active and all originaldisplay/deferredscope preserved. Hooksabsent/checklist8of8 unchanged; implement/verify running. Next safe action T104 browser scene controller RED thenT108/T109 oneViewer display/pick/coalescing. Publish wholeUS15 Draft afterT110; no merge.

## 2026-10-05 US15 UI integration evidence
T104 browser RED and T108–T109 complete; validation/t109_catalog_scene_ui.md records whole16633/oneViewer/offpage mouse selection/windowrestore/hashpin/ownUTC and full Python418PASS162.17s/Node206PASS861.0495ms. Existing stack/constitution/checklist8of8/hooksabsent/scope unchanged. Exact identity lookup limit100 RED corrected to full limit0 without changing formulas/wire contracts. Actual two-size verification found 113–115ms validation/copy plus30–37ms renderer callback; T110 remains pending for responsive preparation and final verification/publication. T075–T084 all remain active/open; T032/F001/F004–6/download disk unknown retained. Local UI work recorded separately; no new PR/merge. Next implement owner: T110 responsiveness repair, generation fencing and atomic UTC coverage before final actual tests.

T110 repair analysis: bounded owned response preparation matches FR023/SC021 and original oneUTC/no-partial-display/onepending contracts; tasks unchanged, constitution conflicts0, checklist8of8, hooksabsent. RED2 failed (no yield). Implement repair running; final verification remains pending.

## 2026-10-05 T110 bounded response preparation progress
RED2 no-yield failures→PASS, full Node208PASS883.6242ms/Python418PASS170.47s/5warnings. Actual8891 active16633 allvalid, 1280/1920 max preparation slice10.4/10.9ms, preparation wall155.3/164.5ms (includes yields), renderer38.3/16.9ms; no total-latency/frame acceptance claim. Full snapshots publish only after validation/generation fence; clear/lateinvalid coverage maintained. API filter13/588/0 IDs/order,409/422 and post-UI savedGP/UTC/observer readonly passed. Static reload only/no restart. Evidence validation/t110_response_preparation.md; T110 still running for renderer responsiveness and final acceptance/DraftPR. WholeT075–T084 and original deferred requirements unchanged; no merge.

T110 renderer repair: RED visual-allocation/epoch-parse coverage added; cached styles/GPepoch and 72h opacity transition implemented. Readonly scoped consistency check retains sameUTC/oneViewer/readonly/ownership; no spec/wire/stack change. Full Node210PASS974.953ms. Python and actual two-resolution measurement running; overall implement/verify running.

## 2026-10-05 T110 renderer styles and epoch reuse
RED allocation and repeat epoch parsing→PASS; finalNode210PASS974.953ms/Python418PASS170.42s/5warnings. Currentscene visual class styles reused, immutableGP epochcache invalidates byhash/text,72h opacity refresh restored. Actual8891twores16633allvalid/canvas1/console0; initial renderer36.6ms, repeated23.3/16.4ms; do not claim p95/game target or blanket speedup. Filter13/588/0 IDs/order/409/422/readonly rerunPASS, static reload/noSIMrestart. Evidence validation/t110_renderer_styles.md. T110 final acceptance report and DraftPR pending; next safe action consolidate US15 contract evidence, publish reviewed whole-group Draft abovePR28, continue original T075 tracks/pass/sun/modes/imagery/SVG and T076–T084. T032 and all original deferred scope retained; no merge.

## 2026-10-05 US15 final verification consolidated
validation/t110_catalog_scene.md maps FR023/SC021 against actual automated/8891 evidence and profiling. Productquery offline full16633 cold9.3884s/warm.3882s, native~.032s/sharedtransform.0007-.0021s/JSON5,168,774bytes; distinguishes serverHTTP/browser callbacks and unresolvedframe goals. FinalPython418/Node210 pass preserved, all native/wheel proof scopedT105. Functional verify complete; T110 Draftpublication pending until actualURL/remote tree verified. Do not close T075–T084 or T032/SC006/F001/F004–6/diskunknown. Next action existing authorized DraftPR above28, then original T075 remainder. No merge.

## 2026-10-05 US15 Draft published
T104–T110 scoped complete per validation/t110_catalog_scene.md; actual Draft PR29 https://github.com/GIY0201/ISDC_ODT/pull/29 abovePR28, attached/unmerged/mergeabletrue. Remote head3feec93a36ae6c886ccb82c39ae0b5402e71b28f tree30eeccf49fd7970ce2a7659646d0ca7b50a8eeba exactly equals validated local source. Original local series preserved codex/catalog-display-context-local-20261005, clean tree compared before soft reconciliation; no hard reset. Overall implement/verify active, T075–T084 all remain open, T032/SC006 performance gaps/F001/F004–6/download diskunknown retained. Bookkeeping after publication is local until next reviewed document update; no new code/test claim. Next scoped work returns to spec/plan owner for original T075 selectedtrack/pass/sun/modes/imagery/SVG, reuse existing contracts and precise native calculation. No merge.

## 2026-10-05 US16 scoped design
Previousgoalturn progress: PR29 published/attached/exacttree verified; localpostpublicationbookkeeping924e926 preserved in newcodex/catalog-track-passes branch. WholeT075–T084 active. FR024/FR025/SC022→US16/T111–116 added with originalsourceperiod/dense/pass table/timeline/sourceownership and preciseRust/EOP reuse. Samefeature bootstrap/setup-plan/prerequisites executed, plan preserved; constitution1.2.0/checklist8of8/hooksabsent. SourceHEAD1a1e002 verified; clarify not needed for preservedoriginalfunctions, no new stack/equipment assumptions. Scoped specify/plan/tasks complete; analyze/implement/verify pending until gates. T075 sun/modes/imagery/labels/SVG and other9tasks remain tracked.

US16 readonlyanalysis: FR024/FR025/SC022 mappedT111–116/contract/entities/quickstart/source1a1e002; scopedcoverage3of3/unmapped0/ambiguity0/duplication0/critical0, constitutionI–V conflicts0. Existing qualitychecklist8of8/hooksabsent. Samefeatureplan preserved; implement gate passed. BackendRED next, aggregateT111 remains pending until HTTP/browser/renderer RED also complete. No scope or numerical acceptance weakened.

US16 implementation progress: backendRED3missingmethods→PASS3/nativecenter/period/dense/failure/hash/visibilityreuse. FirstfullPython420PASS1FAIL5warnings190.09s duepriorignoredprofilinghelper indata workspace violatinglayerpolicy. Helper moved project_support/tooling/catalog_scene_profile.py withguardedmain; targetarchitecture+backend6PASS39.02s, Node210PASS957.306ms. Whole rerun live session73941 logpython_t112_final.txt; do not claim finalpass before completion. Validation/t112_catalog_track_passes.md. T111 aggregate/112wholegate pending,113–116 not implemented, actual8891 newroutes unverified; serverrestart/snapshot preservation planned when routesready. GoalT075–T084 fullscope unchanged.

US16 T112 calculation scopedcomplete: repaired fullPython421PASS5warnings169.84s (python_t112_final.txt),Node210PASS957.306ms. Initialhelperplacementfailure retained andfixedwithoutweakeningboundarytest. T111aggregateRED/113–116 stillpending; newAPI/UI/live notimplemented. Nextsafeaction T111HTTP/browserRED→T113 strictcontracts/compatibility, thenexact8891restart+snapshot andV6track/pass wiring. WholeT075–T084 unchanged/no new PR ormerge.


## 2026-10-05 T113 readonly track/visibility API complete
HTTP2RED405/browsermissingmethods→targetPython6/NodeAPI6PASS; fullPython423PASS5warnings174.04s/Node211PASS939.158ms. Actualowned8891 restart captured previousreport/state, disclosed SIMmemoryreset and restored savedGP/UTC/observer. ISS1021validtrack/.810s/exactexistingcenter,24h7intervals/.804s/complete/0contacts/errors;409/422/readonlyPASS. Isolatedfixture naturalSIMtick corrected bypausingfixture only; compatibilityadds only approved2paths/2schemas. Evidence validation/t113_catalog_track_api.md. No new UI acceptance/nativewheel/PR/merge. T111aggregate and T114–116 pending; T075–T084/T032/deferredscope unchanged. Nextowner implement T111controllerRED→T114 UIcontrols/generation/replay/24htable/AOSseek,thenT115 segmentedtrack andT116 actualverification/Draft.


## 2026-10-05 T114 selected track controller progress
T111controllerRED missingmodule→six testsPASS; readonly ownership/generation/AbortSignal/latestUTCcoalescing/densewindowrenewal/failuresegmentation/strictmetadata. Additional automaticerrorretry RED corrected toexplicitrefresh; invalidUTCnoquery/allfailednopath passed. ActualsavedT113ISS1021response accepted(valid/noerror). FullNode217PASS930.9457ms/Python423PASS5warnings177.17s; gitdiffcheckPASS. Evidence validation/t114_catalog_track_controller.md. APIcommit94230da preserved; no UIassembly/renderedbrowser/nativewheel/restart/PR completionclaim. T111aggregate/T114 remain unchecked; nextvisibilitycontroller/table/timeline/AOSseek thenT115trackrenderer/T116actualtwores/Draft. EntireT075–T084/T032/deferredscope remainsactive/no merge.


## 2026-10-05 T114–T115 V6 track and24h passes scopedcomplete
Missingcontroller/renderer/panelRED→PASS; original width3/NONE/segmentednativepath, strictreadonly24h controller/table/timeline/AOSseek/checkboxdraft andoneViewer composition. FullNode224PASS966.3763ms/Python423PASS5warnings243.40s. Actual8891finalstaticreload/twores/ISS1021validtrack+7passes/90degnone/60xreplay/AOSseek/toggle/windowrestore/16633wholecoexist/canvas1/logerror0/savedstateexactreadonly passed. Evidence validation/t115_catalog_track_passes_ui.md, rawignoredscreenshots/logs. T111/T114/T115complete; T116 consolidated finalpick/acceptance/Draftabove29 pending. AllT075–T084 and T032/SC006/F001/F004–6/diskunknown remainopen; no serverrestart/nativewheelchange/merge. Nextimplement/verify owner T116, thenoriginalT075sun/modes/imagery/labels/modelasset audit andT076–84.


## 2026-10-05 T116 functional final verification
Final productcode2a447be/Python423PASS243.40s/Node224PASS966.3763ms evidence consolidated in validation/t116_catalog_track_passes.md. Actualmousepick678,403→offpageCREWDRAGON13/100882 changedselectedGP, clearedoldpasses, loadednew1021validtrack while16633/onecanvas preserved. SavedGP/anchorUTC/observer/mask/playback/sourcehashes againexactreadonly; rawpickJSON/png preserved. Fullgoalunchanged; T116 pendingonlyactualDraftabovePR29/attach/exactremotetree. No codechanges/retestclaim/merge. Nextpublication then originalT075sun/modes/imagery/labels/modelasset audit.


## 2026-10-05 US16 Draft publication complete / originalGLB correction
T111–T116 scopedcomplete: attached DraftPR30 https://github.com/GIY0201/ISDC_ODT/pull/30 above29/open/unmerged/mergeabletrue,39blobSHAverified/remotehead6e1bef2/tree6c98af43a6462ddb53781b2c8a78750bbc48d834 exactlocal749a999. Fetched/exactclean tree then softreconciled; originalseries saved codex/catalog-track-passes-local-749a999/no hardreset. FunctionalPython423/Node224/8891 proof unchanged. Nextoriginaldisplayaudit found50GLB/56manifest mappings and realSatelliteModelLayer; earlierSVG-only assumption explicitly superseded in research/audit. catalog_view_source_audit.md records modes/imagery/theme/sun/follow/model source and syntheticsunfallback/garbledmetadata design gaps. WholeT075–T084 remainopen; no runtimeassetcopy/newstack/merge. Nextspecify/plan/tasks for originalremainingT075,thenimplementation; allT032/deferredscope retained.

## 2026-10-05 US17 design resume
Previous status answer=no implementation progress; revalidated clean90e5286 and next safe owner specify/plan. New branch codex/catalog-view-controls preserves postPR30bookkeeping. Same feature FR026/SC023 US17 T117–121 appended, fullT075–84 intact. Original audit and two already-dispatched plan research agents complete; source model Terra dependency defect and explicit solar rotation/sampling follow-ups recorded, not excluded. US17 constitutionI–V/stack preserved; bootstrap/setup-plan existing preserved/hooksabsent/checklist8of8 reviewed. Scoped specify/plan/tasks complete, downstreamanalyze/implement/verify pending. No blocker/no modelcopy/solar implementation/merge. R003/R007/R010 and FR008 map US17; deferred originalmodel/solar remain plan-owner, T032 unchanged.

US17 readonly analysis: FR026/SC023 -> T117–121 / data-model / contracts/globe_view.md / quickstart coverage2of2, tasks5, unmapped0/ambiguity0/duplication0/critical0; constitutionI–V conflicts0. Original model/solar not yet designed are explicit separate T075 owners, not US17 completion or excluded scope. No remediation. Checklistrequirements8of8, hooksabsent; implementation gate passed. RED missingglobe_view.js -> four renderer behavior tests PASS. ApplicationRED and OrbitGlobe delegation still pending, so T117aggregate/T118/T119–121 remain unchecked. Whole regression started; actualUI not yet changed or verified.

US17 renderer progress verified:6behavior tests/wholeNode230PASS1117.1831ms/fullPython423PASS5warnings174.32s with fresh projectownedbasetemp. InitialsystemtempWinError5 run269PASS154setupERROR retained; diagnostic8PASS1error identifiedtmpdir, no acceptance weakened. Evidencevalidation/t118_globe_view_renderer.md. Researchdetails model_solar_source_research.md preserved; Terra repair/solar accelerated sampling remain pending owners. T117aggregate/T118delegation and119–121unchecked; no actualnewUI/newPR/serverrestart/merge. Nextsafeaction applicationRED+OrbitGlobe delegation/provider/palette/UIassembly, thenfull/8891twores. WholegoalT075–T084active, no blocker and alloriginaldeferredrequirements preserved.

## 2026-10-05 US17 application controls progress
Previousgoalturn=progress398c7d0/renderer6tests/Node230/Python423. Actualsamefeature/cleanbranch/gateschecked; implementcontinued, no prerequisitechange/hooksabsent/checklist8of8. T117 aggregate RED (missingstyle/observe/provider/controls) now covered; T118 rendererdelegation complete. T119 provider/preboot/status/palettes andT120panel/drafts/restore implemented; retain unchecked until originalhover and DOMlistener remount/disposal complete. Sourcefaithful camera/model/solar and allT076–84 unchanged.
FinalNode235PASS992.32ms/Python423PASS5warnings176.61s after panelordering. Actual8891twores/2D3D/BlueMarbleOSMNaturalEarth/ArcGISready/rapidlatestmode/restore/canvas1/console0 and savedGP/anchor/currentUTC/revision/observer/mask/playback/hash readonly proven. Rawt120jpg/statejson andvalidation/t120_globe_view_ui.md; firstwrongrestorelabel and isolatedmocknewimport failures corrected preservingassertions. Static reload/no serverrestart/newport/newPR/merge. Fullgoalactive/no blocker; nextT119hover+T120disposalRED/fix→T121coexistence/faulttest/consolidation/Draftabove30. T075 remains partial; T032/SC006/F001/F004–6/diskunknown retained.

## 2026-10-05 US17 final functional evidence
Previousgoalturn=progressed5e6db/actualcontrols235Node/423Python; currentclean/gatesvalid/scopeunchanged. Hover missing and disconnected field listeners RED2→PASS; typedmousemove/leave/failurerows/constantwork/remountowner coverage. T119/T120 complete; Node238PASS1012.3735ms/Python423PASS5warnings177.34s. Actual16633valid/fullUTC+CALSPHERE900selectedUTC+1021validtrack6275.784s/29stations/twores/2D3D/palettes/canvas1; actualmarkeredgehover/leave, injectedArcGISfailure→explicitNaturalEarth with16633 retained and overrides restored. Savedorbit fields exactpriorbaseline, consolecaptured0; validation/t121_globe_view.md/rawjpg/json. Original hoverSatellite information card newlyaudited and retained in T075model/inspector owner; no madeupaltitude/no scope excluded. T121 pendingonlyactual Draftabove30/exacttree/attachment; fullT075–84/T032/deferredscopeactive. No blocker/merge/newport/serverrestart/nativewheelchange. Nextpublication then owner specify/plan actualmodels/camera/hovercard/solar.


## 2026-10-05 US17 Draft publication verified
Draft PR31 https://github.com/GIY0201/ISDC_ODT/pull/31 above PR30 is attached, open, draft, unmerged and mergeable at verification. All33 raw Git blobs matched their local hashes. Remote tree f2bb80f44109f252b0e8edccbcebc1ec749e8390 exactly matches validated local source6cb4234756715f5725a6a8c5bd8082c964f715fa; published head0634243a4c437cf5e2b8aec1e408bb6cc3db9597 parent6e1bef2c279e1a00a32da9675dcfc4cb65f7c384. T117–T121 scoped complete. Existing Python423/Node238 and actual8891 evidence unchanged; no new code, runtime restart, or merge. Publication bookkeeping follows the published source locally.
Full T075–T084 goal remains active: original GLB models/ordered mapping/thumbnail/credits/camera/hover information card/solar and T076–84 are not complete. T032/SC006, F001/F004–6 and disk-download evidence remain open. Next owner specify/plan for faithful selected-model integration including missing Terra textures; preserve original assets and prove real rendering, no SVG-only substitute. Task counts are not whole-product completion percentages.


## 2026-10-05 US18 specification / source design started
Previous goal turn=progress: PR31 published/attached/exact-tree verified and local bookkeeping6cf5815 committed. Current clean source verified before branch codex/catalog-model-display. Same feature FR027/FR028/SC024 adds faithful original model mapping/GLB/thumbnail/credits/camera/hovercard without removing solar or any T075–84. Specify quality reviewed: observable flows, ordered matching/asset completeness/error acceptance, owned UTC/oneViewer/readonly. Existing requirements checklist8of8 remains unchanged; hooks absent. Scoped plan/tasks/analyze/implement/verification pending; prior stories valid. Source research agent dispatched by speckit-plan Phase0 to resolve Terra textures; no product-code/asset changes yet. New plan must preserve approximate attitude distinction, missing texture gate, original camera mechanics, and one selected primitive. No new framework/port/merge or blocker.


US18 design complete: FR027/FR028/SC024 -> T122–129/contract/data-model/quickstart, original full scope retained. Readonly analyze requirements3/tasks8/coverage3of3/unmapped0/ambiguity0/duplication0/critical0; constitutionI–V PASS, hooksabsent, checklist8of8. Known Terra unavailable officialtextures remains asset/acceptance gate, not omitted scope. Plan source research completed pinnedtree/official GLB/FBX/invalidZIP checks recorded. Implementation gates valid; T122 resolver RED missingmodel-librarymodule verified, original fixture56records/50assets/126 actualsource golden outputs captured. T124 pure resolver/description port begun; first targeted5PASS1FAIL was an incorrect assumption that intact ISSlabel was garbled, corrected by injecting corrupt Terra label and explicitly preserving valid ISSlabel; no requirement relaxed. Current targeted6PASS, full regression pending. No actual models copied/mounted/rendered or camera/UI implemented; T122aggregate/T124 remain unchecked until relevant completion evidence.


## 2026-10-05 US18 design and original resolver port verified
Same feature FR027/FR028/SC024/US18 eight tasksT122–129, contracts/satellite_display.md/data-model/quickstart and source research completed; readonly analyze3of3covered/no critical/unmapped0/checklist8of8/hooksabsent. Original resolver126goldens from actual source1a1e002/56records/50asset filenames and mapping precedence/ownership/schema2 paths/rules/links/metadata repair pass. Target6PASS; wholeNode244PASS1058.9786ms/Python423PASS5warnings178.25s/terminalexit0/gitdiffcheck. Initial targeted wrong ISSlabel assumption corrected with injected corrupt Terra label and preservation of valid source text; no assertion relaxation. T124 scopedcomplete, T122aggregate incomplete for asset/renderer/camera/UI RED.
Official NASA pinnedtree/alternateGLB/FBX/archive checks show Terra exacttexture unavailable in inspected distribution; original mapping stays and T123/T129 acceptance remains incomplete. No copied binary assets/staticmount/runtime change/nativewheel/serverrestart/newport/PR/merge. Nextsafeaction T122 assetvalidator RED→T123 active dependency/hash/provenance tooling and available asset packaging, or independent renderer/camera RED→T125–126. Full T075–T084/T032/SC006/F001/F004–6/download scope stays active; no blocker status justified while useful independent work exists. Evidence validation/t124_model_resolver.md.

## 2026-10-05 T123 asset tooling/package partial verified
Previous goal turn was status-only/no progress; current turn resumed implementation from authoritative worktree and existing US18 gates. Checklist8/8/prerequisites valid, hooks absent. Original56 ordered mappings/50GLB/50thumbnail hashes preserved, valid UTF8 source labels unchanged. Asset module missing RED -> target16PASS; offline active dependencies/hash/provenance validator and explicit aligned PNG embedding/conversion tooling packaged. Full Python439PASS5existingwarnings233.18s/Node244PASS1193.0097ms/exit0/diffcheck. Actual Pillow12.3.0 decode49valid models/76embeddedimages/50thumbs; package validator correctly exits1/completefalse for two missing Terra TGA textures. Synthetic conversion/pixel/geometry preservation PASS is not Terra fidelity. No actual derivative, mount, server restart, nativewheel, browser rendering or PR claim. Evidence validation/t123_satellite_assets.md. T123/T129 and T122aggregate stay unchecked; full T075–T084/T032/SC006/F001/F004–6/download remain open. Next safe owner T122 renderer/camera RED -> T125/T126; continue independent integration while authoritative Terra textures remain unresolved.

## 2026-10-05 T125 renderer/T126 camera helper progress
Previous goal turn=progress28bcd18/e8a81bc original assets and exact Git bytes verified. Samefeature existing gates/8of8/prerequisites/hooksabsent; current implementation progressed from source1a1e002. CameraRangeMotion and direction/basis/attitude pure helpers copied exactly(SHA2566c17078c054a8c2ffbcebe87e3a30e22c0ca51c0e028c93d013af5a0f39ae223), original8tests missingexportsRED->PASS. OriginalSatelliteModelLayer port retains camera algorithms but replaces orbit Date/propagator with injected canonicalUTC/advance/nativeITRF sampler and identity/GP fences. Async load vsready/render error/retry/late destroy/listenercleanup/noGeometry covered8tests; initial modulemissingRED and orientationalias90!=0RED repaired with ownedcopy. PendingdedupRED hang interrupted own confirmedhandle; final bounded tests and wholeNode completed. Target16PASS/Node260PASS1071.3918ms/Python439PASS5warnings178.42s/exit0/diffcheck. Python started before last JS-only orientation fix, final wholeNode covers it; no Python/API change. Evidence validation/t125_satellite_renderer.md. T125/T126 remainpartial until original camera/native interfaces/assembly proof; T122aggregate/T127–129/Terra/solar and entireT075–T084 remainopen. No actualGPU/UIcomposition/newport/serverrestart/nativewheel/PR/merge. Next implement originalnative camera regressions+OrbitGlobe ownedhandlers before model/hover application composition.
