# Rust Windows 검증 준비 결과

2026-10-01. 앱 구현이 아닌 후보 검증 준비.

## 확보 자료
공식 sgp4 2.4.0 배포 archive를 project_support/tooling/rust_validation_inputs에 확보. source/SHA256은 manifest.json에 기록. 외부 전체 소스를 앱으로 복사/추출하지 않았고 앱은 이 파일을 import하지 않는다.
테스트 입력 33개, 상태/오류 기대 결과 668개를 파싱해 확인했다. fixture SHA256: b7c05c2d9e2f965e491401c9ca1f38fe588eeec21b0f0a9e54c0f57dca0cc002.
해당 릴리스 MIT LICENSE 확인. 배포시 저작권/라이선스 고지를 유지한다.
propagate.rs는 AFSPC 초기화+전파로 각 좌표 차이 <1e-6 km(1mm), 속도 각 성분 <1e-9 km/s를 시험한다. 프로젝트 위치10m 수용 기준과 별개로 이 공식 패키지 시험을 유지한다. 아직 cargo test 실행은 하지 않았다.

## 환경 확인
PATH의 rustc/cargo/cl/link/clang와 사용자 .cargo/bin rustc/cargo, Program Files 및 Program Files (x86)의 vswhere를 확인했으나 찾지 못했다. 다른 비표준 설치 위치의 존재를 배제하지 않는다. SDK 일반 설치 경로도 발견되지 않았다.
MSVC Windows 대상은 linker/Windows SDK가 필요하다. 기존 .venv와 tool experiments를 변경/삭제하지 않았다.

## 구체적인 설치/검증안
- Rust 관리 경로는 project_support/tooling/rust_env 아래 CARGO_HOME/RUSTUP_HOME으로 격리. 시스템 PATH 수정 금지. 정확 toolchain 버전은 공식 배포 manifest 확인 후 고정.
- Windows 배포 목표는 x86_64-pc-windows-msvc. Microsoft C++ Build Tools/Windows SDK는 시스템 설치 구성요소가 필요하다. 설치 프로그램의 서명과 설치 경로/구성요소를 확인 후 수행, 자동 재부팅 금지.
- Rust 릴리스 시험은 공식 archive를 읽기 전용 참조에 안전 추출 후 별도 Cargo target/cache를 tooling 아래 지정하여 cargo test --release 실행. 경로 traversal 없는 archive인지 확인 후 추출.
- Python C++ baseline accelerated 확인, 같은 AFSPC 요소/시각/모드 비교. wrapper 비용 포함/제외 및 패스 전체 계산은 분리.
- 다음 Phase 1에는 Rust core/PyO3 경계와 단위/오류/메모리/배포 계약을 문서화한다. 사용자 화면/기존 API 구현은 아직 수정하지 않는다.

## 남은 작업
빌드 도구 설치, cargo 시험, 직접 공식 Vallado 자료와 패키지 fixture 대조, C++ benchmark, Windows wheel 설치 시험. 위 목록이 완료되기 전 후보 검증 통과로 기록하지 않는다.

## 설치 및 실제 시험 결과
사용자 명시적 승인 후 설치 완료. Rust/Cargo 1.98.1, MSVC 14.44.35207, Windows SDK 10.0.22621.0, Build Tools 17.14.41. 설치 exit 0, rebootRequired false. 프로젝트 전용 Rust 관리/빌드 경로 사용, persistent PATH 변경 없음.
현재 프로세스 활성화: `. project_support/tooling/use_rust_environment.ps1`.
SGP4 `cargo test --release --locked --offline --manifest-path project_support/tooling/rust_validation_inputs/sgp4-2.4.0/Cargo.toml` 결과: 릴리스 컴파일 성공(54.48초), unit 9 PASS, propagation 1 PASS(33 입력/668 기대 상태). 문서 시험 9 PASS/1 FAIL로 전체 exit101.
실패한 CelesTrak 네트워크 문서 예제는 최초 sandbox socket 제한, 외부 접속 허용 재시도에서는 peer certificate expired. TLS 검증을 끄지 않았다. 인증서 문제의 원인은 단정하지 않는다. 실제 저장 입력 수치 시험 실패와 구분한다. 전체 suite PASS 주장 없음.
Rust 환경/참조 archive/target는 .gitignore에 추가. 실행 receipt는 local tooling/rust_env에 보관, 핵심 결과는 이 문서와 개발 로그에 보존.
남은 검증: 직접 Vallado fixture 대조, Python C++ mode/성능 비교, PyO3 wheel 설치, 변환/가시 구간 및 실제 웹 검증. 앱 소스 변경 없음.
