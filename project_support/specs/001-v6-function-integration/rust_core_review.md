# Rust 계산 코어 검토

2026-10-01. Rust 우선 후보 조사. 제품 채택/설치/수치 시험 완료가 아니다.

## 확인한 후보와 배포 경계
- neuromorphicsystems/sgp4 2.4.0: pure Rust, TLE/OMM 파싱, MIT. Cargo 의존성으로 사용하며 외부 소스 전체를 vendoring하지 않는다. 버전 고정 후 해당 release의 라이선스/의존성까지 재확인한다.
- 핵심 crate는 digital_twin/simulation 책임, PyO3 호출 래퍼는 communication의 언어 경계 책임. core는 Python/FastAPI/runtime/render를 import하거나 실행 상태를 소유하지 않는다. 실제 파일 경로와 ADR은 Phase 1에서 고정한다.
- PyO3/maturin은 Windows wheel 배포 경로 제공. Rust 개발 도구는 빌드 환경에만 필요하고 사용자에게는 호환 wheel 배포를 목표로 한다. Python 버전/CPU/필요 runtime 조합을 설치 시험으로 확인해야 한다.
- 향후 AeroDT C++ 연동은 C ABI 또는 기존 프로세스 통신 adapter로 연결. Rust 타입을 ABI로 직접 공개하지 않는다. C ABI 구현은 실제 연동 요구 때 진행하며 현재 빈 미래 코드로 만들지 않는다.

## 계산 조건: 기본값 주의
sgp4 2.4.0 Constants::from_elements는 WGS84/IAU를 사용한다. from_elements_afspc_compatibility_mode는 WGS72/AFSPC 조건이며 propagate도 해당 mode와 짝을 맞춘다. Python sgp4 WGS72와 이름만 같다고 동일 조건이라 판단하지 않는다. 기준 fixture의 opsmode와 epoch/sidereal 처리까지 고정해 비교한다.
SGP4 중력상수 선택과 지상국 WGS84 타원체는 서로 다른 계약이다. 좌표 변환과 고도각은 별도 구현/검증해야 한다.
프로젝트 README는 CelesTrak 기준 결과와의 작은 차이를 보고하지만 우리 데이터/환경의 검증 증거가 아니다. 공식 fixture 비교를 먼저 실행한다.

## 비교 시험 설계
1. 정확도 게이트: 공식 원시 TEME 위치/속도, 같은 요소/시간/상수/mode. 기존 합의 10m는 제품 허용 오차이며 공식 시험의 더 엄격한 기준은 유지.
2. 코어 속도: Rust release build vs Python sgp4 accelerated=True, 동일 저장 ISS 입력/UTC 배열. 준비/파싱 시간과 초기화 후 전파 시간을 따로 기록. single call 및 1,440/86,400 시각 batch. pure Python fallback을 C++ baseline이라고 표시하지 않는다.
3. 전체 경로: 파싱/전파/변환/가시 구간 경계/직렬화/PyO3/API/화면까지 포함. 동일 변환 알고리즘/정확도 조건으로 비교한다. 준비시간 제외값과 포함값 둘 다 보고.
4. 호출 비용: 시각마다 경계를 넘는 방식과 batch 호출 비교. Rust 작업 중 Python interpreter 제약을 해제하는 경로는 PyO3 조건을 준수하며 서버 응답/종료도 시험.
5. 부하: 합의된 위성1/지점1 먼저. 이후 100/1,000 위성 시험은 확장 비용 조사이며 이번 기능 범위 승인으로 간주하지 않는다.
6. 결과: 버전/해시/컴파일러/CPU/GPU/전원/반복횟수, 중앙값/p95/p99/최댓값 기록. Rust가 C++보다 빠르다는 선결론 없이 정확도와 성능/배포 요구 충족 여부로 선정.

## 남은 게이트
- 현재 셸 Get-Command rustc,cargo 결과 없음: PATH에서 미확인. 디스크 전체 미설치 판정은 아님. 시스템 전역 설치는 하지 않았다.
- sgp4 2.4.0 release 소스/fixture 실제 확보와 checksum, 해당 release 라이선스/의존성 확인.
- Rust/C++ mode 매칭과 Windows 빌드/wheel/GIL 동작/성능 확인.
- 정확도/성능 확인 전 Rust 코어 최종 채택과 연구 완료를 기록하지 않는다.

## 근거
- https://docs.rs/sgp4/2.4.0/sgp4/
- https://docs.rs/sgp4/2.4.0/sgp4/struct.Constants.html
- https://github.com/neuromorphicsystems/sgp4
- https://raw.githubusercontent.com/neuromorphicsystems/sgp4/master/LICENSE
- https://www.maturin.rs/platform_support
- https://www.maturin.rs/bindings
- https://pyo3.rs/v0.29.2/parallelism.html
- https://pypi.org/project/sgp4/
