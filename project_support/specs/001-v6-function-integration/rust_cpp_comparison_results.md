# Rust / C++ 가속 SGP4 비교 결과

2026-10-01. run ID: sgp4_comparison_20261001T095328Z.
원본 결과: data/workspace/validation/sgp4_comparison_20261001T095328Z/report.json. 이 문서는 생성물 삭제 후에도 결과와 한계를 보존한다.

## 결과
| 하루 범위의 시각 수 | Rust native batch 중앙값 | Python-C++ batch 중앙값 | Python-C++ 개별 호출 반복 중앙값 |
|---|---|---|---|
| 1,440 (1분 간격) | 0.2914ms | 0.2920ms | 1.2298ms |
| 86,400 (1초 간격) | 18.1175ms | 18.2558ms | 113.4258ms |

86,400 batch p95: Rust 19.1294ms, Python-C++ 20.2755ms. Rust와 C++ batch 차이는 약 0.8%로 이 측정만으로 우열을 판단하지 않는다. C++ 개별 호출은 batch보다 약 6.2배 오래 걸렸다. 이는 Python 반복/호출/튜플 할당과 NumPy 반환 방식까지 포함한 차이이며 순수 FFI 비용만 측정한 값은 아니다.

수치 일치: 1,440 시각 최대 위치 벡터 차이 2.5931e-7m, 86,400 시각 6.8740e-6m. 합의한 10m 이내. 같은 알고리즘 계보의 두 구현 일치이며 실측 정확도 검증이 아니다. 독립성은 기존 공식 fixture 시험과 후속 좌표변환 자료 대조로 보완한다.

## 시험 조건
- historical ISS TLE 2020년 epoch부터 +24시간 미만. sgp4 2.4.0 examples/tle_afspc.rs의 입력 고정. 현재 ISS 자료로 주장하지 않는다.
- Rust sgp4 2.4.0, Rust1.98.1 release/LTO/codegen-units1, WGS72/AFSPC 초기화/전파 명시.
- Python3.14.6, sgp4 2.25, NumPy2.5.3. MSVC로 cp314 native wheel 직접 빌드 후 accelerated=True 확인. 최초 pip 배포 wheel의 pure Python fallback은 비교 대상에서 제외.
- Python Satrec.sgp4init opsmode='a' 및 WGS72, 동일 epoch/평균요소. Rust와 동일 시각 배열/원시 TEME 출력.
- i9-11900, Windows, 균형 조정 전원 계획. affinity/priority/전원 구성 변경 없음. 배경 부하/열 상태 통제 없음.
- batch 준비 3회, 측정20회. scalar5회. Rust batch 먼저, C++ batch/scalar 순서. 낮은 반복수/실행순서 때문에 작은 차이 해석 금지.
- Rust 시간은 native loop/Vec 할당 포함, Python-C++ batch는 extension 호출/C++ loop/NumPy 할당 포함. 파싱과 시각 배열 준비는 측정 제외.
- Rust CLI 전체 wall 시간은 여러 batch+JSON+프로세스가 포함되므로 batch 응답 시간으로 쓰지 않는다. PyO3 호출 비용은 아직 측정하지 않았다.

## 재현
현재 프로세스에서 `. project_support/tooling/use_rust_environment.ps1` 적용 후 `cargo build --release --locked --offline --manifest-path project_support/tooling/sgp4_benchmark/Cargo.toml`.
비교: `project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe project_support/tooling/sgp4_benchmark/compare.py`.
검증용 가상환경/원본 입력/코드/lock/binary SHA256은 report.json에 보존한다. 도구는 product runtime에서 import하지 않는다. benchmark dependencies는 전용 requirements.txt에 고정.

## 판단과 남은 검증
Rust 선택의 근거는 이번 시험에서 C++보다 월등히 빠르기 때문이 아니라, 네이티브 수준 계산 성능과 독립 계산 모듈/향후 연계 가능성이다. Rust 우선 후보를 유지하고 batch API를 설계한다.
이번 계산 시간은 궤도 전파만이다. 지상좌표 변환/고도각/가시 구간 경계/직렬화/PyO3/API/렌더는 측정하지 않았다. 하루 구간 1초 및 60fps/100ms UI 목표 달성으로 기록하지 않는다.
다음은 Rust-Python batch 계약과 좌표/시간 변환 설계, Windows wheel 설치/호출 시험, 직접 공식 기준 자료 대조다. 실제 통신 조건 확인/적용과 나머지 기능 연결은 필수 후속으로 유지한다.
기존 전체 pytest: 35 PASS/Starlette 경고1, 3.47초. 앱 소스 변경 없음.
