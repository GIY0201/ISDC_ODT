# T080 선배 보안 관측 모듈 이식

원본: `HyeonJun9138/ISDC-ODT` 고정 커밋 `1a1e00297a0301637455b0ef2cf48b2e74576b07`.

## 구현과 보존 범위

원본 `SecurityStandIn`을 `digital_twin/runtime/security/observations.py`로 옮겼다. 원본 정책·계약·HTTP 5개 경로·wire schema·RemoteSecurity HTTP 어댑터·운용 기준·JavaScript view model 7개 구현 파일은 원본과 바이트 단위로 동일하며 SHA256 회귀시험에 고정했다. 런타임은 관측 사본과 전환 이력만 소유하고 DT 현재 상태를 복제하지 않는다. 조회 bridge는 실제 주입된 runtime.telemetry()의 사본을 관측으로 전달한다.

ICD-08 1.0 경로는 observations POST, overview GET, events GET(after), status GET, dashboard GET(after)이다. 실행 변경 시 전환 이력과 순서를 초기화하고 이전 실행의 지연 관측은 무시한다. 같은/역순 SIM 표본은 중복 이벤트를 추가하지 않는다. 인증률 99% 기준 판정만 수행하며 무결성과 암호화는 항상 unknown이다. 이력은 메모리의 최근 200개이며 영구 기록이 아니다.

V6 `createSourceSecurityPanel({api,document,host})`은 `security` 화면에서 명시적 조회를 제공한다. 원본 `securityView`와 `transportView`로 판정·SIM 자료·MOCK 장비·모듈 위치·endpoint·관측/수신 UTC·최근40개 전환 이력을 표시한다. 화면 이탈·폐기·실행 변경은 요청을 취소하며 늦은 응답이 새 실행을 덮지 않는다. 외부 모듈 오류는 fallback SIM 성공으로 바꾸지 않으며 503의 실제 위치/endpoint 진단을 보존하고 판정은 미확인으로 표시한다.

## 검증

- 시험부터 작성한 첫 Python 실행: runtime/security 미존재로 collection RED. 첫 JS 실행: source_security.js 미존재 RED.
- 원본 HTTP 회귀 첫 조립: 기존 `/` fallback보다 뒤에 라우터를 붙여 HTML 반환으로 12개 실패. 시험 조립에서 보안 router를 fallback 앞에 넣고 원본 입력/응답과 동일하게 검증했다. 제품 조립에도 같은 순서가 필요하다.
- `project_support/.venv/Scripts/python.exe -m pytest -q project_support/tests/test_source_security.py -o cache_dir=data/workspace/validation/t080_py_cache`: **67 PASS**, 1.45s. 기존 Starlette httpx deprecation 경고1.
- `node --test project_support/tests/browser/source_security_panel.test.mjs project_support/tests/browser/source_security_view.test.mjs`: **10 PASS**,115.3318ms.
- 자동 시험은 원본 임계값·미확인·사본·이력보존200·중복/역순·실행 변경·schema오류·외부HTTP timeout/응답오류·같은실행bridge·close 및 UI 수명/오류/escape를 확인했다.

## 통합에 필요한 작업과 미완료

부모 조립 작업에서 create_app(security=...) 주입, `SPACETWIN_SECURITY_URL`의 선택적 RemoteSecurity와 기본 SecurityStandIn(99.0), app.state.security와 SecurityBridge, router include 및 remote close를 연결한다. 원본과 같이 import 시 네트워크를 시작하지 않는다. api.securityDashboard는 503 JSON을 읽어 Error.report로 반환할 진단을 보존한다. shared SIM frame/status를 panel.updateTelemetry/updateSocket에 전달하고 showWorkspaceOrbit 및 destroy에 연결한다.

이 문서 시점에는 제품 factory의 실제 조립, 전체 Python/Node 회귀와8891 실제 두 해상도 UI가 아직 미완료다. T080 전체 완료 또는 실제 보안 보증으로 기록하지 않는다. 선배 기능은 SIM 규칙 판정이며 실제 인증·암호화·파일 무결성 구현이 아니다.


## 2026-10-07 current fixed-8891 live observation

The existing in-app browser opened the mounted security pane, initially showing receipt pending and unknown values. Its visible **현재 SIM 보안 관측 조회** action returned the real embedded `sim-rule-stand-in` / ICD-08 v1.0 report for `RUN-904CE008D00B`, SIM elapsed 884.7 seconds. The displayed values were authentication SIM 99.78%, throughput 47.2 Mbps and loss 0.16%; authentication criterion was the original ≥99% rule. Observed UTC `2026-10-06T19:22:50.000Z` and received UTC `2026-10-06T19:24:52.730Z` were separately displayed. Integrity explicitly lacked verification input, and PQC-TEE was labelled MOCK. The actual source transition history displayed its first rule observation, not invented physical security incidents.

After the receipt aged beyond the presentation window, the same live pane changed to **모듈 보고 지연** and **마지막 수신값입니다. 최신 상태를 확인할 수 없습니다.**, preserving the last numeric value and run identity. This bounded actual-browser check verifies pending→received→stale presentation and honest source semantics. No SIM fault, runtime transport, settings or deployment was changed for this check. Remote failure, run-change race and full two-resolution security acceptance remain separate gates; this does not close T080 or certify authentication/encryption.

## 계층 검증 후 구조 보완

전체 회귀의 architecture 시험이 외부 transport에서 digital_twin.contracts 예외를 import하는 원본 의존성을 거부했다. 기준을 완화하지 않고 기존 ICD-01 방식과 같이 원본 SecurityUnavailable 클래스 본문을 foundation/security_errors.py로 그대로 추출했다. contracts/security.py는 같은 클래스를 재공개하며 external/security.py는 foundation에서 가져온다. Runtime/HTTP/transport의 예외 클래스 identity는 동일하다. 따라서 앞선 7개 파일의 바이트 동일 주장은 이 구조 보완 이전 상태를 설명한다. 현재는 5개 파일 바이트 동일, 2개 파일은 예외 위치/import만 변경했다. 골든 시험은 명시된 이 두 변경만 역변환하여 원본 SHA256을 검사하고 정책·schema·adapter의 다른 차이를 허용하지 않는다.

The same tab's CDP Network.setBlockedURLs temporarily blocked only its `/api/security/dashboard` request. A visible query produced **조회 오류**, **미확인** and `Failed to fetch`, retaining the labelled last values rather than manufacturing a successful report. The URL block was immediately cleared, and the same visible query then received the actual SIM report at `2026-10-06T19:26:37.030Z`. No server or other browser was taken offline. Actual 1280×720 and 1920×1080 viewports both retained RUN-904CE008D00B and one canvas, with body width equal to the viewport; the 626-pixel content pane scrolls internally. The temporary viewport override was reset. This adds actual network-error→retry proof; remote-module 503 semantics and run-change races still require separate evidence.
