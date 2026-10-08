# ISDC_ODT

위성 궤도, 지상국, 통신망과 시험 시나리오를 하나의 웹 작업 공간에서 다루는 독립 실행형 디지털 트윈 개발 프로젝트입니다. Python FastAPI 서버, Rust 기반 궤도 계산, JavaScript UI와 공용 Cesium 지구를 사용합니다. AeroDT 연계를 고려한 계층 구조를 유지하며, AeroDT를 실행하지 않아도 사용할 수 있습니다.

공개 위성 궤도 자료로 현재 시각의 위치를 계산하고, 사용자가 구성한 위성군과 지상국으로 모의 시험을 수행합니다. 화면의 현재 시각 추적은 **궤도 모델의 계산 결과**이며 실제 위성 원격측정을 수신하는 기능과는 다릅니다.

## 현재 기능

왼쪽 메뉴는 작업 대상을 기준으로 구성합니다. 선택한 위성, 지상국과 지구 화면을 유지하면서 필요한 작업 창을 열 수 있습니다.

| 메뉴 | 주요 작업 |
|---|---|
| 상황판 | 지구 중심의 통합 관제 현황, 시스템 연결도 중심의 DT 상황판 |
| 위성 | 위성 검색, 현재 시각 및 지정 시각 분석, 위성군 구성, 저장 궤도 분석, 거리와 도플러 계산 |
| 지상국 | 한반도 지도에서 지상국 선택·추가·편집, 선택 위성의 가시 시간, 배치 위성 통신 분석, 통신 계획과 RF 링크 계산 |
| 임무 | 군집 서비스 임무 계획, SIM 임무 편집, 운용 절차와 인계 참고 |
| 데이터 | SDC 모의 데이터 처리 상태, 정책과 처리 결과 확인 |
| 보안 | 보안 모의 모듈 상태와 처리 결과 확인 |
| 시험 | 시험 환경 구성, 사용자 시나리오 작성, 기존 운용 시나리오 시험, SIM 실행과 KPI 비교 |
| 시스템 | 모듈 연결도, 연결 설정과 인터페이스 명세, 지상 시스템 및 장비 연동 시험 |
| 환경 설정 | 공용 지구 표시, 전체 위성 ON/OFF, 태양 음영, 화면 설정과 자료 출처 |

### 지구와 위성

- CelesTrak 카탈로그와 저장된 TLE/OMM 궤도 입력을 지원합니다. 정밀 좌표 계산은 제품 native 모듈과 보존된 지구 회전·윤초 자료를 사용합니다.
- 전체 위성 표시는 현재 시각 추적을 기본으로 사용합니다. 선택한 위성도 같은 표시 시각의 계산 위치를 따라갑니다. 저장 궤도와 지정 시각 분석은 별도로 사용할 수 있습니다.
- 위성을 선택해도 작업 창이 자동으로 열리지 않습니다. `Esc`로 선택 정보와 카메라 추적을 해제할 수 있습니다. 궤적 ON/OFF와 형상 모델 정보는 선택 위성의 상세정보에서 확인합니다.
- 하나의 Cesium 지구에서 2D/3D, NASA Blue Marble 및 지도 소스를 전환합니다. 태양 음영은 위성 미선택 시 현재 시각을 사용하고 KST로 안내합니다. 계산 시각을 선택하면 해당 시각을 기준으로 표시합니다.

### 지상국과 시나리오 작성

한반도 지도에서 지상국을 누르면 위치와 설정을 확인하고, 지도 후보 위치 또는 좌표 입력으로 지상국을 추가할 수 있습니다. 안테나, 지원 대역과 최소 고도각을 편집하고 해당 지상국을 가시 시간 분석에 사용합니다. 지도에 표시되는 시설 및 통신망은 등록된 설정과 계산 모델이며 실제 시설의 가동 상태를 보장하지 않습니다.

시험 시나리오는 빈 초안부터 이름, 목적, 위성 구성, 지상국과 시간순 시험 단계를 작성합니다. 장애 단계에는 종류, 대상, 발생 시각, 지속 시간, 주입 조건과 확인할 결과를 기록할 수 있으며 저장, 재편집과 JSON 내보내기를 지원합니다. **사용자가 작성한 장애 정의를 자동 실행하는 연결은 아직 없습니다.** 기존 SIM 실행기의 장애 주입 기능과 사용자 시나리오 정의 저장은 별개입니다.

PostgreSQL 연결 환경에서는 **추가·편집한 지상국과 사용자 시나리오 정의 및 변경 이력**을 서버에 저장합니다. 저장 상태와 버전 충돌을 표시하고, 새로고침 시 서버 정의를 복원합니다. 실행 중 SIM 상태, 배치된 위성군, 계산 결과와 모든 화면 입력을 DB에 영구 저장하는 구조는 아닙니다.

## 실행 환경 준비

검증된 기준 환경은 **Windows x64 / CPython 3.14**입니다. 웹 시험에는 Node.js가 필요합니다. native wheel은 `cp314-cp314-win_amd64`용이며 다른 Python 버전과 운영체제의 설치는 검증하지 않았습니다.

아래 명령은 저장소 루트의 PowerShell에서 실행합니다.

```powershell
python -m venv project_support/.venv
./project_support/.venv/Scripts/python.exe -m pip install -r requirements.txt
```

전체 기능을 사용하려면 다음 로컬 준비물이 필요합니다. 가상환경, native 바이너리, DB와 실행 데이터는 Git에 포함하지 않습니다.

| 준비물 | 준비 방법 |
|---|---|
| 제품 native wheel | `isdc_orbit_propagation` 0.3.0 제품 wheel을 검증한 후 위 가상환경에 설치합니다. 연구용 probe wheel로 대체하지 않습니다. |
| 저장 궤도와 시간 자료 | 아래 준비 도구로 설치된 IERS 자료와 역사적 ISS 예제를 보존합니다. 기존 자료는 덮어쓰지 않습니다. |
| PostgreSQL | 바이너리, 클러스터, 앱 계정과 [스키마](data/migrations/001_workspace_configuration.sql)를 준비하고 접속 정보를 별도로 설정합니다. [DB 운영 안내](project_support/docs/development/postgresql_workspace_storage.md)를 참고합니다. |
| 외부 웹 자산 | 기본 Cesium 라이브러리는 CDN에서, 카탈로그와 일부 지도 영상은 외부 공급자에서 읽습니다. 네트워크 가용성과 각 자료의 유효 범위에 영향을 받습니다. |

native wheel 경로는 실제 검증한 파일로 지정합니다.

```powershell
./project_support/.venv/Scripts/python.exe -m pip install --no-deps "<검증한 제품 wheel 경로>"
./project_support/.venv/Scripts/python.exe -m project_support.tooling.prepare_orbit_inputs
./project_support/.venv/Scripts/python.exe -m project_support.tooling.prepare_catalog_geometry
```

저장 궤도 준비 도구의 ISS 입력은 2020년 검증 예제입니다. 현재 ISS 자료로 해석하지 않습니다. 카탈로그용 지구 회전 자료도 설치된 `astropy-iers-data`의 스냅샷이며 시작할 때 자동으로 새 자료로 교체하지 않습니다.

native 모듈을 직접 빌드하려면 프로젝트 Rust 환경, MSVC Build Tools와 별도 빌드용 Python 환경이 필요합니다. [고정 빌드 의존성](project_support/tooling/orbit_build_requirements.txt)을 설치한 뒤 다음 도구를 사용합니다. 빌드는 wheel과 함께 해시, DLL 출처와 라이선스 확인 기록을 남깁니다. 환경 및 이력은 [제품 설치 검증](project_support/specs/001-v6-function-integration/validation/t029_install.md)과 [0.3.0 native 검증](project_support/specs/001-v6-function-integration/validation/t144_node_native.md)에 설명합니다.

```powershell
./project_support/tooling/build_orbit_wheel.ps1 -PythonPath "<빌드용 Python 실행 파일>"
```

### 준비된 환경에서 서버 시작

저장소의 **`project_support/tooling/start_workspace.bat`를 더블클릭**합니다. 바탕화면에 바로가기를 만들어 사용할 수도 있습니다. 이 파일은 설치 프로그램이 아니며, 위의 Python/native 환경과 로컬 PostgreSQL 구성이 준비되어 있어야 합니다.

실행기는 PostgreSQL과 웹 서버를 시작하고 앱 식별 및 실제 DB 조회를 확인합니다. 이미 정상 실행 중이면 중복 실행하지 않습니다. 결과 창을 닫아도 서버는 유지됩니다. 접속 주소는 [http://127.0.0.1:8891](http://127.0.0.1:8891)이며 개발 포트는 8891로 고정합니다. 새 서버 시작 시 새 SIM 실행이 생성되며, DB에 저장된 지상국과 시나리오 정의는 유지됩니다.

직접 서버를 실행하려면 같은 포트의 기존 앱을 먼저 확인한 뒤 제품 factory를 사용합니다. DB 접속 파일에는 `app` 접속 설정이 필요하며 백업 도구는 `admin` 설정도 사용합니다. 접속 파일을 Git에 추가하지 않습니다.

```powershell
$env:ISDC_DATABASE_CONFIG = (Resolve-Path 'data/workspace/postgresql/connection.json').Path
./project_support/.venv/Scripts/python.exe -m uvicorn user_application.web.application:create_stored_orbit_app --factory --host 0.0.0.0 --port 8891
```

실행 후 [API 문서](http://127.0.0.1:8891/docs)를 볼 수 있습니다. 기존 프로토타입 콘솔은 `/legacy`에 보존합니다. DB 백업, 복원 검증과 다른 서버로의 이관은 [PostgreSQL 운영 안내](project_support/docs/development/postgresql_workspace_storage.md)를 따릅니다.

## 검증과 현재 한계

2026-10-08 기준 최신 회귀 결과는 다음과 같습니다.

| 검증 | 결과 | 실행 기록 |
|---|---|---|
| JavaScript 전체 시험 | 2,195 통과, 1 건너뜀 | U038, 32.13초 |
| Python 전체 시험 | 967 통과, 8 건너뜀, 8 경고 | U037, 330.17초 |
| 실제 UI 점검 | 모든 메뉴 그룹, 하위 탭, 접힌 상세와 스크롤 하단 확인 | [U036 UI 검토](project_support/docs/validation/u036_workspace_ui_audit.md) |

Python 경고는 ERFA의 날짜 경계 시험에서 발생한 `dubious year` 경고입니다. 상세 결과와 이후 변경은 [개발 현황](data/development_log/CURRENT.md)에서 확인합니다. 개별 시험 통과를 전체 성능이나 실제 장비 운용 검증으로 해석하지 않습니다.

회귀시험은 다음과 같이 실행합니다. PostgreSQL 시험은 지정한 DB 안의 분리된 시험 namespace를 사용합니다. DB 설정을 지정하지 않으면 해당 통합시험은 건너뜁니다. 격리 native 설치 시험에는 실제 제품 wheel 경로를 지정합니다.

```powershell
$env:ISDC_TEST_DATABASE_CONFIG = (Resolve-Path 'data/workspace/postgresql/connection.json').Path
$env:ISDC_ORBIT_INSTALL_WHEEL = (Resolve-Path '<검증한 제품 wheel 경로>').Path
./project_support/.venv/Scripts/python.exe -m pytest -q
node --test project_support/tests/browser/*.test.mjs
```

현재 남은 범위:

- 실제 원격측정, RF 수신, 장비 HIL과 영구 운용 기록은 검증되지 않았습니다. SIM KPI, MOCK-HIL 및 규칙 기반 재계획을 실측 또는 AI로 표현하지 않습니다.
- 지도 영상과 위성 형상 표시가 위성 센서의 촬영·광학 특성·영상 선별을 검증하는 것은 아닙니다.
- 일부 초기 운용, 정상 운용, 인계와 시설 화면은 절차 참고용 예시입니다.
- 프레임 성능 목표와 전체 모델·GPU·다중창 수용 검증은 미완료입니다. 반복 처리 감소를 확인한 [U029 최적화](project_support/docs/validation/u029_idle_performance.md)도 전체 성능 통과를 뜻하지 않습니다.
- 나머지 통합 요구와 실제 실행 증거는 [요구별 감사](project_support/specs/001-v6-function-integration/validation/t075_t083_current_requirement_audit.md), [실제 실행 기록](project_support/specs/001-v6-function-integration/validation/t081_live_continuation_20261007.md)과 [진행 장부](project_support/specs/001-v6-function-integration/workflow-progress.md)에 남깁니다.

## 코드와 문서 안내

| 경로 | 책임 |
|---|---|
| `user_application` | 앱 조립, 실행 구성과 사용자 작업 흐름 |
| `communication` | HTTP/WebSocket, 외부 자료 및 native 계산 어댑터 |
| `data` | 카탈로그, 저장 입력, 설정 영속화와 실행 생성물 |
| `digital_twin/contracts` | 내부 계약 |
| `digital_twin/model_library` | 위성·장비·표시 자산 정의 |
| `digital_twin/simulation` | 궤도와 모의 계산 |
| `digital_twin/runtime` | 실행 중 현재 상태와 생명주기 |
| `digital_twin/visualization` | 지구·모델·그래프 표현 |
| `project_support` | 시험, 도구, 설계·검증 문서 |

작업 전 [AGENTS.md](AGENTS.md)와 [공동 개발 규칙](project_support/docs/DEVELOPMENT.md)을 읽습니다. 구조와 의존성은 [설계 문서](project_support/docs/architecture/design.md), 궤도 API는 [계약 문서](project_support/specs/001-v6-function-integration/contracts/orbit_api.md), 화면별 재현 절차는 [검증 quickstart](project_support/specs/001-v6-function-integration/quickstart.md)를 참고합니다. quickstart와 이전 검증 보고서는 작성 시점의 이력을 포함하므로 현재 실행 환경 및 상태는 이 README와 최신 개발 현황을 함께 확인합니다.

초기 프로토타입 기록은 [prototype_readme.md](project_support/docs/prototype_readme.md)에, 위성 표시 자산의 출처와 파생본 정보는 [자산 안내](digital_twin/model_library/packages/satellite_display/v1/README.md)에 정리되어 있습니다.
