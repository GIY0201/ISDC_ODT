# T083 원본 모듈 연결 설정의 V6 연결 준비

2026-10-07 01:22 KST. 이 기록은 독립 어댑터와 패널 검증이다. 전체 이식 완료, 실제 8891 화면 수용 검증, 실제 외부 프로토콜 성공을 주장하지 않는다.

## 원본 재사용

읽기 전용 선배 저장소의 기준 커밋 `1a1e00297a0301637455b0ef2cf48b2e74576b07`에서 `user_application/web/scripts/settings/topology.js`를 바이트 그대로 이식했다. SHA256은 `e42d2debfc82bd326f74566cf8070d3135857f6f1706bb0d208c65c46498eadd`로 원본과 같다. 모듈 책임, 배치 카탈로그, 링크와 기본 운용 구성, 세 가지 운용 모드, ICD 01~08의 메시지 표와 개정 이력, SVG 연결 위치와 곡선 계산을 재사용한다. 저장 키는 `spacetwin-integration-settings`다.

`communication/http/integration.py`는 원본의 TCP 연결 후 즉시 종료하는 진단과 UDP 주소 해석만 확인하는 진단을 재사용한다. 원본의 로컬 주소는 프로세스 내부 모듈 상태를 확인하는 의미를 보존하고 예정 주소를 표시한다. 원격 TCP 연결 성공은 TCP 도달 가능의 근거이고 UDP는 `unverified`다. 보안 외부 링크의 TCP 성공도 보안 프로토콜 성공으로 승격하지 않는다.

원본에서 실제 계약이 없는 내장 스텁을 정상으로 반환하던 부분은 `unverified`로 명시한다. 실제 데이터 관리, 패브릭, 군집 편성, 보안 모듈의 주입된 상태 계약을 호출하며 응답 누락과 실제 오류를 숨기지 않는다. framework/runtime/model/scenario 목록은 기존 소유자에서 읽는다. 현재 상태를 새로 소유하거나 네트워크를 import 시 시작하지 않는다.

## V6 패널

`createSourceSettingsPanel({document,host,storage,probe,readSocket})`의 `show('settings')`를 기존 작업창 조립에서 호출한다. root ID는 `source-module-settings`다. 프로세스 내 SIM 응답, TCP 도달 가능, UDP 주소 해석, 계획/스텁 미확인을 분리한다. 카탈로그에 적힌 배치는 설계 배치로 표시하고 실제 확인 근거는 반환된 진단 detail로 표시한다.

링크 전송 방식, 호스트와 포트, 하트비트 초, 제한 시간 초, 사용과 자동 재연결 옵션을 편집한다. 편집 반영과 저장은 명시적이며 원본 기본값 복원도 명시적으로 저장한다. 모드 변경, 저장, 화면 진입만으로 임의의 주소를 자동 진단하지 않는다. 현재 모드 전체 및 선택 링크 진단 버튼을 제공한다. 콘솔 소켓과 간접 링크는 직접 진단 대상으로 오인하지 않는다. 하트비트/재연결은 원본의 운용 설정이며 패널이 새 소켓이나 프로세스를 만드는 기능이 아니다.

편집/설정 변경 중 도착한 이전 응답은 폐기한다. 응답의 링크 ID 집합, UTC, 상태와 방법을 확인한다. 다른 창에서 설정이 바뀌면 입력을 보존하고 저장/전송을 막고 명시적 다시 불러오기를 제공한다. 처리 실패 후 명시적 진단 재시도는 가능하다. 조회 성공을 실제 장비/HIL/암호화 검증으로 표시하지 않는다.

## 검증

- 코드 전 RED: 원본 topology 12개 회귀시험의 모듈 누락, integration HTTP 시험의 모듈 누락, controller 회귀의 모듈 누락을 확인했다.
- `python -m pytest project_support/tests/test_source_integration_probe.py -q -o cache_dir=data/workspace/validation/t083_pytest_cache`: **12 passed**, FastAPI 기존 Starlette test-client deprecation 경고 1개. 실제 product factory의 여섯 모듈 상태 계약과 조회 전후 배치 불변성도 확인했다.
- `node --test project_support/tests/browser/source_settings_workspace.test.mjs project_support/tests/browser/source_settings_panel.test.mjs project_support/tests/browser/source_settings_controller.test.mjs project_support/tests/browser/source_settings_clients.test.mjs project_support/tests/browser/source_topology.test.mjs`: **27 passed**. 원본 12개 golden, controller 7개, V6 패널 4개, 실제 workspace 조립 두 해상도 2개, 실제 ICD 브라우저 클라이언트 2개다.
- `node --check user_application/web/scripts/tabs/source_settings.js`: 통과.
- 입력 URL/잘못된 포트/비유한 제한 시간/중복 링크/미허용 속성 422, TCP 실제 로컬 listener와 UDP resolve 차이, 누락 계약 실패, 데이터 관리 실제 상태/오류, 외부 보안 TCP 미검증을 확인했다.

## 상위 조립과 남은 검증

상위 조립 담당자는 `integration.router`를 같은 factory에 연결하고 `POST /api/integration/probe`를 기존 브라우저 API에 추가한다. V6 workspace와 fixture에 `createSourceSettingsPanel`를 주입하고 show/update/destroy를 연결해야 한다. 실제 fixed 8891 서버 화면, 두 해상도 및 전체 Python/Node 회귀는 상위 통합 완료 후 검증한다. 이 하위 작업에서 서버 재시작, 브라우저 상태 변경, 공유 조립 파일 변경, Git commit/push/branch 생성은 수행하지 않았다.

추가한 `source_settings_workspace.test.mjs`의 1280×720/1920×1080 실제 V6 조립 회귀에서 원래 launcher에 settings 경로가 없음을 RED로 확인했다. 상위 담당자가 명시적 ‘모듈 연결 설정’ 작업창을 추가했고 다시 실행한 두 조립 회귀를 통과했다. 패널은 settings에서만 표시하고 EM/HIL 화면은 기존 책임을 유지한다.

## 소켓 상태와 실제 ICD 클라이언트 확인

`createSimWorkspace`가 소유한 `connection`은 `idle/open/closed/error` 문자열이다. 원본 topology의 console 링크는 `open`만 활성으로 계산한다. 타입을 변환하거나 연결 상태를 별도로 저장할 필요가 없다. 새 settings 작업창이 기존 SIM 소켓 연결 시작 목록에 없고, SIM 상태 callback이 설정 패널을 갱신하지 않은 조립 공백을 확인해 상위 담당자에게 전달했다. 상위 담당자가 같은 owner의 `connect()`와 status callback에서 패널 `update()`를 호출하도록 연결했다. 실제 SIM controller의 connector를 transport 경계에서 대체한 시험에서 connect/open/closed 후 동일 owner의 snapshot을 읽고 패널을 갱신하면 L09가 실제 상태에 맞게 바뀜을 확인했다. 새 소켓이나 타이머를 패널에 추가하지 않았다.

`source_settings_clients.test.mjs`는 실제 `createDataFabricClient`와 `createOrchestrationClient` 객체를 한 번 생성한 뒤 설정 controller의 편집/저장 전후 `status()` 요청 URL을 확인한다. 저장 전에는 현재 서버, 명시적 저장 후에는 L02/L03에 저장한 각 원격 HTTP API 주소, 저장하지 않은 편집 중에는 마지막 저장 주소, 다음 저장 후에는 새 주소를 사용했다. 모든 fetch는 시험 transport로 대체했고 외부 네트워크를 사용하지 않았다. localhost/127.x는 원본 규칙에 따라 현재 서버를 의미하므로 원격 resolver 검증은 예약된 `.test` 호스트 문자열을 사용했다. 원본 전송 설정이 UDP여도 브라우저 ICD-02 호출 자체는 HTTP API이며, UDP 진단 성공을 실제 UDP 운용 성공으로 표현하지 않는 시험과 UI 설명을 추가했다.
