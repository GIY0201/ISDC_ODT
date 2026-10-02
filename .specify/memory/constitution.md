<!-- Sync impact: 1.1.0 -> 1.2.0; Constraints aligned with agreed JavaScript baseline; Development Workflow expanded with persistent goal/deferred tracking. No principle removed. Prior TS/Vite proposal superseded, tool experiments preserved. Ratification date remains historical draft metadata, not proof of blanket user approval. -->
# ISDC ODT Constitution

**상태: 최신 사용자 합의를 반영한 개발 원칙. 세부 버전/성능 목표와 후속 기능 범위는 단계별 검토한다. 기존 1.1.0은 미합의 기술 제안을 포함한 초안이었다.**

## Core Principles

### I. 독립 실행과 이식 가능한 계층
ISDC ODT는 독립 프로그램으로 실행한다. AeroDT의 계층 책임과 lower_snake_case 규칙을 따른다. 현재 구현에 필요한 계층만 만들고 AeroDT 설치 또는 개인 경로를 실행 의존성으로 만들지 않는다.

### II. 현재 상태의 단일 소유권
runtime이 현재 상태를 소유한다. application은 조립과 사용자 흐름, communication은 외부 통신, data는 저장, simulation은 계산, visualization은 표현을 담당한다. 내부 bus나 중복 상태 저장소를 추가하지 않는다.

### III. 기존 기능과 계산 보존
선배 프로토타입의 API와 계산은 회귀시험으로 보존한다. 구조 변경과 계산 변경은 분리한다. 공개 계약 변경은 ADR에 기록한다.

### IV. V6 업무 공간과 증거 구분
2026-09-30 채택된 V6를 UI 기준으로 삼는다. 공용 지구, 역할별 작업 목록, 이동 가능한 작업 창을 사용한다. SIM, GP, 합성 궤도, MOCK-HIL, 미연동을 실제 운용과 구분한다.

### V. 검증에 근거한 완료
변경 영역 회귀시험을 먼저 작성하고 실패를 확인한다. 전체 Python 시험과 관련 Node 시험, 실제 웹 실행을 확인한다. 실행하지 않은 검증은 통과로 기록하지 않는다.

## Constraints
새 UI의 기준은 JavaScript ES 모듈과 HTML/CSS, CesiumJS다. TypeScript/React 도입 제안은 보류하며 Vite 및 도구 버전은 별도 선정한다. 기존 기능은 재사용 적합성과 회귀시험을 확인한 뒤 단계적으로 연결한다. Python/FastAPI는 도메인 계산 및 통신 API에 사용한다. 언어 변경만으로 성능 향상을 주장하지 않고 실제 측정과 회귀시험을 요구한다. UAM 물리와 실제 EM/장비 연결은 이번 기능 이식에 포함하지 않는다. 비어 있는 미래 계층, 외부 원본 vendoring, 개인 경로 커밋을 금지한다.

## Development Workflow
AGENTS.md, 개발 규칙, architecture/design.md와 가까운 시험을 읽는다. Spec Kit 산출물은 project_support/specs에 둔다. 변경과 검증 및 남은 위험을 data/development_log/CURRENT.md와 HISTORY.jsonl에 기록한다. 기존 feature의 workflow-progress.md에 최초 목적, 안정된 요구 ID, 합의, 후속 필수 항목과 실제 검증 증거를 유지한다. 명세/계획 변경 시 영향을 받는 후속 단계를 stale로 표시하고 재검토한다. 사용자와 단계별 범위 및 결과를 논의하며 첫 시험 완료를 전체 기능 완료로 기록하지 않는다. 실제 통신 조건 확인과 적용은 필수 후속 요구로 유지하고 기하 가시성, 모델 조건 충족, 실제 수신 증거를 구분한다.

## Governance
사용자의 직접 지시가 우선한다. 원칙 변경은 변경 이유와 영향을 기록하고 semantic version을 올린다. feature 분석에서 계층, 상태 소유권, 출처 표시와 검증 계획을 확인한다.

**Version**: 1.2.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
