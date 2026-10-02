# Implementation Plan: V6 기능 연결

**Status: 제안 초안. 기술 스택과 이식 방식은 미합의이며 구현을 시작하지 않는다.**

Date: 2026-10-01 | Spec: [spec.md](spec.md) | Branch: 없음

## Summary
TypeScript strict와 Vite로 V6의 공용 지구/역할 목록/작업 창을 새로 구현한다. 기존 Python 계산/API와 다섯 브라우저 기능 모듈은 동작 보존을 확인하며 호환 연결한다. 기존 DOM을 이동해 입력과 이벤트 바인딩을 보존한다. 지구 렌더러는 공용 배경으로 유지하며 작업 전환으로 새로 만들지 않는다. 기존 JavaScript 도메인 모듈의 전체 TypeScript 전환은 별도 단계로 남긴다.

## Technical Context
Language: TypeScript strict 새 UI, Python 3.14 검증 환경, 기존 ES modules 호환 영역.
Dependencies: 기존 requirements.txt의 FastAPI, uvicorn, httpx, pydantic. 기존 Cesium 및 satellite.js CDN.
Storage: 기존 gzip 카탈로그, 메모리 runtime. 영구 실행 기록 신규 구현 없음.
Testing: pytest, Node test runner, 실제 브라우저.
Platform: Windows 로컬 서버와 데스크톱 웹.
Scale: 기존 카탈로그 및 단일 서버 상태. 다섯 기능 모듈, V6 16개 업무 진입점.
Performance: 기존 지구/전파 루프 재사용, 창 이동에서는 layout 한 번만 적용.
Constraints: 내부 bus, AI placeholder 없음. UI 선택은 창별로 분리. C++/Rust 재작성은 측정 병목과 AeroDT 연결 계약이 생긴 후 검토한다.

## Constitution Check
설계 전/후 PASS: 독립 실행, 기존 계층 보존, runtime 현재 상태 유지, API/계산 변경 없음, 출처 구분, 회귀시험 및 실제 웹 확인 계획 포함.

## Project Structure
문서: project_support/specs/001-v6-function-integration와 project_support/docs.
UI: user_application/web/index.html, scripts/main.ts, scripts/workspace.ts, scripts/workspace_contract.ts, styles/workspace.css, scripts/app.js.
시험: project_support/tests/test_workspace.py, project_support/tests/browser/workspace.test.ts.
기록: data/development_log/CURRENT.md, HISTORY.jsonl.
개발 환경: uv.lock/pyproject.toml, project_support/.venv, project_support/tooling/package.json과 pnpm-lock.yaml. 패키지와 빌드 산출물은 project_support 아래.

## Phases
0. upstream 비교와 기존 시험.
1. 계약/문서/실행 안내.
2. 창 및 V6 UI, 기존 기능 연결.
3. 시험, 실제 웹 검증, 개발 기록.

## Complexity Tracking
원칙 예외 없음. 기존 화면을 iframe으로 중복 실행하거나 renderer를 복제하지 않는다.
