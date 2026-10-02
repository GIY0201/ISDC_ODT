# Spec Kit 작업 추적 기록

갱신: 2026-10-01. 이 파일은 기존 feature의 지속 기록이다. 새 feature를 만들거나 기존 합의를 폐기하지 않는다.

## 최초 요청과 현재 진행 경계
최종 목적은 독립 ISDC ODT의 확정 V6 UI에 선배 프로토타입 기능을 단계적으로 연결하고, 향후 AeroDT 연결/이식이 가능하도록 계층 책임과 파일 생성 규칙을 공유하는 것이다. ISS 시험만으로 전체 목적이 완료되지 않는다.
현재 사용자 승인으로 첫 구현 묶음을 단계적으로 실행한다. 전체 기능 계획과 후속필수를 유지하며 지금은 입력/시간 기반 T001~T004까지 완료했다.
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
| R001 | 독립 ISDC ODT + AeroDT 이식 가능한 구조 / S1,S5 | AeroDT 설치 의존성 없이 실행, 계층/명명/상태 소유권 검사 | constitution, plan, verify | plan File placement/Constitution / T001,T004,T010,T029 | 구조 규칙 확인, 새 통합 검증 없음 |
| R002 | 확정 V6 UI 유지 / S1,S2 | 공용 지구와 역할별 작업 창에서 연결 기능 사용, 기존 UI 결정 추적 | specify, plan, verify | plan State/Workspace / T014,T016,T024,T025 | V6 채택 확인, 기능 연결 미구현 |
| R003 | 선배 기능의 단계별 연결 / S1 | 궤도, 통신, 임무, 분석/내보내기, MOCK-HIL 및 SIM 제어 각각 범위/시험/출처 추적 | specify, tasks, verify | plan Summary/Validation / T030 + F002 | 기존 기능 조사만, 재사용 정도는 기능별 검토 |
| R004 | 핵심 기능부터 확장하고 함께 검토 / S1 | 각 단계의 범위와 검증 결과를 제시하고 다음 범위 논의 | 모든 경계 | plan Delivery gates / T018,T023,T030 | 현재 복구 및 명세 검토 준비 |
| R005 | 첫 위성 1개 + 지상국 1개 / S1 | 저장된 실제 TLE/OMM, UTC 조작, 위치/고도각/가시 구간, 오류/출처 표시 검증 | specify, plan, implement, verify | plan Input/State/Geometry / T003-T023 | ISS/제주 가상 지점/10도 시험안 합의, 미구현 |
| R006 | 실제 통신 조건 확인 및 적용 / S1 | 출처 있는 서비스/장비 입력과 링크 조건 적용, 정상/실패/미확인 시험 | clarify, plan, implement, verify | plan Visibility/후속 / T023,T030 + F001 | 필수 후속, 조사/적용 미실행 |
| R007 | 결과 의미 구분 / S1,S5 | 기하 가시성, 모델 통신 충족, 실제 수신 증거를 UI/산출물에서 구분 | specify, verify | plan Validation / T003,T005,T007,T011,T017,T019,T021,T026,T028,T029 | agreed_scope.md 기준, 구현 증거 없음 |
| R008 | JS 모듈/HTML/CSS/Cesium + Python/FastAPI / S1 | 기술 계획이 합의와 일치, 버전/현대화 선택 근거 기록 | constitution, plan | plan Technical Context / T002,T006,T008,T029 | TS/React 보류, 기존 도구 실험 미승인 |
| R009 | 빠르고 원활한 사용성 / S1 | 지구/시간/창 조작의 측정 조건과 합의된 목표로 실제 웹 검증 | clarify, plan, verify | plan State/Validation / T018,T024-T028 | 성능 수치/측정 환경 미확정, 성능 주장 없음 |
| R010 | 기존 자료와 합의 보존 / S1 | 수정 이력 보존, 초안/합의/검증 증거 구분 | 모든 단계 | plan Summary/Phase1 / T001,T030 | 이번 변경은 작업 기록, 코드 변경 없음 |

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
| F001 | R006,R007 | 기하 가시성만으로 통신 판정 불가 | 통신 clarify/plan, 대상 서비스와 장비 특정 및 공식 출처 조사 | 필수 대기, 선택 기능 아님 |
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
| tasks | complete | tasks.md 31개, US1 8/US2 5/US3 5 및 공통13개. 형식 검사 오류0, 모두 미구현 |
| analyze | complete | 첫묶음14기준/31task read-only분석, 차단충돌0. 전체후속구현완료아님 |
| implement | running | T001~T004 완료, 31개 중4개. 입력/시간만 연결, native/API/UI 미완료 |
| verify | pending | 연구용 확장17/연결9/기존회귀35 통과 이력. 제품 새 기능 실제API/UI/설치/게임UX 검증은 T028/T029 미진행 |

## 실제 증거와 실패
- E001: 이번 재개에서 두 참조 채팅과 최신 orchestrator, 프로젝트 규칙 및 합의 파일을 읽음.
- E002: 이전 Python 기준선 35 PASS, Starlette 경고 1개. 기존 코드의 당시 기준선이며 새 기능 완료 증거 아님.
- E003: upstream HEAD 1a1e00297a0301637455b0ef2cf48b2e74576b07 확인 이력. 로컬 코드 전체 비교는 미완료.
- E004: 이전 pnpm 도구 실험은 esbuild build script 미처리로 exit 1. 새 JS 환경의 완료 증거로 사용하지 않음. 설치/환경 파일은 보존.
- 이번 기록 수정: 문서 구조와 요구/후속 연결 정적 확인만. 기능 시험을 새로 실행하지 않음.

## 다음 선택과 복구
최초 목적과 합의를 복구했으므로 다음은 constitution의 충돌 정리 후 speckit-specify로 기존 spec을 개정한다. 현재 feature_directory를 재사용한다. 첫 단계 완료와 전체 기능 완료를 별개로 검토한다. 뒤 단계는 stale 상태를 해소하기 전 실행하지 않는다.
현재 사용자에게 반복 선택을 요구하지 않음. 합의된 사항은 유지. 새로운 기술 선택과 기능 확대는 구체적 검토안을 마련하여 함께 논의한다.
Hooks: extensions.yml 없음. 필수 hook 없음. Repair count: 0. 전체 제품 완료: 아님.

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
