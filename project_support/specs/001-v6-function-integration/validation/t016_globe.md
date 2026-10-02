# T016 공용 지구 위치 연결 검증

2026-10-02. 범위: 정지한 서버 UTC의 첫 계산행만 표시. UTC 이동/재생/보간은 T017/T018이다.

## 구현 경계

- visualization/orbit_globe.js는 주입된 ITRF m를 ConstantPositionProperty FIXED에 넣는다. 별도 전파나 TEME 재해석 없음. Cesium clock은 주입 UTC로 고정한다.
- user_application의 workspace_globe가 서버 snapshot과 결과의 input ID/hash/revision/UTC 및 stale/valid를 비교한다. pending/error/불일치에서 기존 위성 entity를 제거한다. 역할화면과 작업창 수명 밖에서 Viewer 하나를 유지한다.
- 저장소의 NASA Blue Marble 영상과 공식 Cesium 1.143 CDN 사용. 영상 실패 시 단색 타원체, Cesium/WebGL 실패 시 지구 미제공 안내와 수치 패널을 유지한다. 합성 위성 위치로 대체하지 않는다.
- 기존 globe.js와 tabs/orbit.js는 legacy 전파/합성 fallback을 포함하므로 수정하지 않았다. 전용 모듈로 계획 경로를 조정했으며 API, runtime 및 계산 계약은 불변이다.
- 공식 API 근거: [Viewer](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html), [SingleTileImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/SingleTileImageryProvider.html).

## 자동 검증

새 renderer 시험을 먼저 실행해 모듈 누락 ERR_MODULE_NOT_FOUND를 확인한 뒤 구현했다.

```powershell
node --test project_support/tests/browser/*.test.mjs
project_support/.venv/Scripts/python.exe -m pytest -q -o cache_dir=data/workspace/validation/v6_migration/cache --basetemp=data/workspace/validation/v6_migration/t016_pytest
git diff --check
```

Node 19 PASS(기존 legacy 브라우저 계산 4개 포함). 위치 미터 보존, FIXED 프레임, 정확한 입력 UTC/정지 clock, 입력 사본, Viewer 재사용, malformed/빈 입력 제거, focus, 멱등 종료, request/revision/hash/UTC/stale gate와 CDN 미제공 안내 확인. Cesium 대역 시험이며 실제 GPU 동작 증거는 아래에 별도 기록한다.

Python 119 PASS, 기존 Starlette/httpx deprecation 경고 1개. 원본 V6 세 자산 SHA, API 호환, 계층 경계와 정적 import 경로 포함. Rust 및 좌표 계산은 이번 변경 범위에 없다.

## 실제 브라우저

IAB localhost:8876 저장 입력 profile, 단일 현행 viewport에서 확인했다.

1. TLE 계산: 표시 UTC `2020-07-12T21:16:01.000416000Z`, ITRF `[6202527.70, -2633530.38, 881293.80] m`, revision 3. 패널과 지구 caption 일치, 실제 지구/ISS point 렌더링 및 위치 이동 확인.
2. OMM 선택: 이전 point 미표시(data-orbit-visible=false), focus 비활성, canvas 1개 유지. OMM 재계산 revision 4에서 같은 위치 표시.
3. 최소화, 지상국 역할 전환, 위성창 복귀: 입력 OMM/hash/revision 4/3개 결과 유지. 공용 지구 canvas 1개, 위치 계속 표시. 콘솔 warn/error 없음.
4. 보존한 NASA 영상이 Cesium 타원체에 표시되는 실제 screenshot은 ignore된 `data/workspace/validation/v6_migration/t016_globe.png`에 저장했다.

통과 범위는 정지 위치의 표시 연결과 해당 UI 흐름이다. 고도각 수치/실제 통신, 게임 성능, 2개 목표 해상도, 다중창 동기화, UTC 재생 완료 증거가 아니다. F001 실제 통신 조건 확인/적용 및 F002 전체 선배 기능 연결은 계속 미완료다. PR #2에 의존하는 별도 T016 PR로 리뷰하며 자동 병합하지 않는다.
