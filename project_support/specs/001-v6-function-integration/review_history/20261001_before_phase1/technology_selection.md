# 개발 언어와 환경 선정

**상태: 검토 제안. 사용자가 선정에 동의한 것이 아니며 함께 논의 후 수정한다. 설치된 개발 도구는 실험 준비물이다.**

2026-10-01 사용자 요청: 프로토타입 통째 복제 대신 최신화와 최적화를 고려한 개발 환경 선정.

| 영역 | 선정 | 근거 |
|---|---|---|
| 새 UI | TypeScript strict + Vite | 작업/시간/단위 계약의 정적 검사, 모듈 빌드, 개발 HMR. V6는 작업 창 중심이고 기존 독립 renderer가 있어 React 전면 도입은 첫 단계의 필수조건이 아니다. |
| 지구 표현 | CesiumJS 유지 | AeroDT 표현 기준과 호환. renderer 인스턴스를 재사용한다. |
| 서버 | Python + FastAPI/Pydantic | 이미 시험 가능한 도메인 계산, 궤도/과학 도구 연결과 요청 검증. 버전은 잠금 파일로 재현한다. |
| Python 환경 | uv project와 lock | 의존성 결정을 저장하고 재현 설치. 가상환경은 project_support 아래. |
| 브라우저 환경 | Node 24 검증, pnpm lock | 프로젝트 로컬 도구, TypeScript typecheck, Vite build. |

React + TypeScript는 컴포넌트와 상태 흐름이 커질 때 유효한 대안이다. 현재 DOM 기능을 모두 한 번에 교체하면 시험된 기능 이식과 UI 변경을 섞게 되므로 이번에는 typed 작업 공간부터 교체한다. Rust/C++는 병목 측정 전 추가하지 않는다. 언어 자체가 실행 성능 향상을 보장하지 않는다.

이번 최적화: 단일 지구 인스턴스, 창 전환에서 DOM 보존, Vite 정적 번들, 배경 작업의 불필요한 chart 갱신 억제. 원본 대비 처리량/지연 개선 수치는 벤치마크 없이 주장하지 않는다. SGP4 worker 전환은 대규모 카탈로그 profile 이후 별도 검토한다.

공식 근거: [Vite guide](https://vite.dev/guide/), [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html), [uv project layout](https://docs.astral.sh/uv/concepts/projects/layout/), [Cesium quickstart](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/).

기능 이식 기준: upstream 1a1e00297a0301637455b0ef2cf48b2e74576b07. 기존 코드 전부를 현대화했다고 주장하지 않는다. 기존 JavaScript와 Python 계산은 회귀시험을 갖춘 호환 영역이다.
