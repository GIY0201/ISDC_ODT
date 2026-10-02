# Rust–Python 연결 및 반환 방식 검증

2026-10-01. 실행 기록: pyo3_boundary_20261001T101318Z. 기존 list-only 실행 pyo3_boundary_20261001T101039Z도 보존.
원본: data/workspace/validation/<run_id>/report.json. 이 문서는 결과 요약을 보존한다.

## 실제 확인
PyO3 0.29.2/Maturin1.15.0, Rust1.98.1/sgp4 2.4.0, CPython3.14.6 Windows x64 검증 wheel 빌드 및 설치 성공. 외부 zlib.dll을 wheel에 포함해 repair. 별도 가상환경에서 시스템 경로만 둔 PATH로 import/계산 성공. 동일 PC/동일 Python 배포판의 격리 시험이며 다른 PC 또는 다른 Python ABI 지원을 검증한 것은 아니다.

연결 시험 9 PASS: C++ 수치 비교, 비단조/중복/음수 시각, 손상 TLE, 비유한 시각, 입력/반환 사본 격리, 빈 batch, probe 상한, buffer/list 일치 및 읽기 전용 확인. 기존 프로젝트 pytest35PASS/경고1(Starlette), 2.58초.
초기 import 실패는 설치 전 상태 확인, buffer 메서드 실패2개는 신규 wheel 설치 전 확인. 재빌드/설치 후 모두 통과. 환경 helper의 MSVC 초기화 후 Cargo PATH 소실 문제는 현재 프로세스 Cargo 경로를 마지막에 추가하도록 수정해 해결.

## 반환 방식 실측
동일 historical ISS/WGS72/AFSPC/epoch부터 하루 범위. warmup3, 반복20, 실행 순서 교대.

| 시각 수 | Rust→Python 목록 반환 | Rust→Python 버퍼 반환 + NumPy view | C++→Python NumPy batch |
|---|---|---|---|
| 1,440 | 0.6585ms | 0.2859ms | 0.3094ms |
| 86,400 | 57.1567ms | 20.0098ms | 20.0791ms |

위 표는 중앙값. 86,400 버퍼 경로 p95 23.7817ms, C++ p95 23.2633ms. 작은 차이로 언어 우열을 판정하지 않는다.
Rust 버퍼 내부 계산 중앙값18.4933ms, 호출/입력/파싱/버퍼 복사/NumPy view 설정의 잔여 비용 중앙값 약1.5449ms. 순수 FFI 비용 분리값은 아니다. Rust는 매 호출 TLE 파싱 포함, C++은 초기화 사전 수행.
위치 최대 차이6.874e-6m로 합의10m 게이트 통과. 같은 계보 계산 간 일치이며 실측/좌표변환 정확도 증거 아님.

## 설계 권고
묶음 계산 + 소유권이 명확한 연속 f64 버퍼 반환을 채택할 설계 근거가 마련됐다. probe는 little-endian f64 bytes (N,2,3) 형태이며 NumPy는 bytes를 소유권 참조로 유지하는 읽기 전용 view를 만든다. Rust→Python bytes 복사는 수행하므로 전체 zero-copy라고 부르지 않는다. 임의 Python buffer를 빌린 채 Rust 계산하지 않는다.
원시 TEME 위치km/속도km/s를 반환하고 coordinate 변환/고도각은 별도 계약. 실제 제품 schema/profile/error/status는 plan/ADR에서 고정한다.
probe는 전체 batch 오류 방식 및100000 임시 상한 사용. 제품 계약의 행별 오류 상태/상한을 확정하거나 구현한 증거가 아니다.

## 한계와 다음 단계
현재 연결 코드는 project_support/tooling의 검증 prototype이며 제품 source에서 import하지 않는다. 앱 API/V6 연결,60fps/100ms/가시구간1초 목표는 아직 검증하지 않았다.
배포시 bundled DLL 출처/라이선스/지원 OS 및 clean PC 시험, Python ABI 정책 확인 필요. PyO3의 detach 사용은 source 확인했으나 서버 동시성/취소/큐 응답 시험은 별도다.
다음 연구는 TEME→지구고정→지상좌표 변환, UTC/UT1/극운동 및 지점 높이 기준과 독립 기준 자료 검증. 전체 필수 후속 실제 통신 조건 조사/적용은 그대로 유지한다.
