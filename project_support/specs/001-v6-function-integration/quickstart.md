# Quickstart: 구현 후 검증 절차
2026-10-01 설계, 2026-10-03 상태 갱신. 첫 제품 시나리오 구현·실제 브라우저/격리 설치 검증을 수행했다. SC-006 성능은 미달이며 validation/t028_performance.md, t029_install.md, t030_review.md에 현재 증거를 기록했다. 아래 연구 재현 명령/35PASS는 초기 이력으로 현재 전체224PASS와 구분한다.

## 연구 증거 재현
- project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe project_support/tooling/coordinate_probe/validate_extended.py (17PASS 이력, 고정snapshot/hash필요)
- 같은Python으로 -m unittest discover -s project_support/tooling/sgp4_python_probe -p test_probe.py (9PASS 이력)
- project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/orbit_tests/pytest_temp --tb=short (35PASS 기준선)
- Node관련시험은기존실행환경으로 node --test project_support/tests/browser/*.test.mjs. 새로운시험은tasks에서작성하며이번문서작성에서실행하지않음.

## 제품설치/기동 게이트
project_support 아래격리venv와Rusttoolchain/buildtarget 사용. 고정requirements 및Cargo.lock, wheel명/해시/native DLL출처·license receipt기록. 검증자료/EOP download는명시적준비도구에서만실행. startup은저장hash/날짜범위검증, network자동갱신금지. 첫wheel CPython3.14/Windowsx64지원,다른환경미검증표시.
main.py --host127.0.0.1 --port8776 --no-browser 기존CLI형식에맞춰실행. import만으로서버/시계/네트워크가시작하지않아야함. orbitprefix추가전후기존API/WS시험통과. 최초실행실패는원인표시,synthetic위치fallback금지.

## 독립 시나리오
US1: 저장ISS TLE와OMM각각선택→출처/epoch/age확인→UTC앞뒤이동/재생·정지→같은UTC복귀→ITRF표시와패널시각/자료hash일치. 잘못된입력/EOP범위밖오류. interpolation중간시각도기준좌표10m안확인.
US2: 가상제주좌표/타원체높이/10도확인→threshold변경→모든구간/접점/peak/잘림/없음확인. 24h와짧은구간/공백/접점/자료실패시나리오. 가시성문구는실통신성공아님.
US3: globe드래그/창이동·크기·최소화·복원→입력과결과유지. 늦은응답을의도적으로반대로도착시켜덮어쓰기0확인. 자원실패/계산중/오류후에도주요조작가능.

## 실제브라우저 측정
1280x720/1920x1080,첫위성1/지점1,60Hz이상전경탭,warmup후. browser/GPU/전원/해상도/입력부터render까지marker기록. 프레임p95<=16.7ms,화면피드백<=50ms,시간동일결과<=100ms,24h구간<=1초,p99/max및run원문기록. 연구단순batch시간을브라우저시간으로대체하지않음. screenshot/trace/수치조건을검증manifest에보존. 두해상도에서실제최소화/복원·지구조작을실행하고마지막결과공개.

## 후속
F001 실제서비스/장비/RF조건은공식근거로확인후반영. F002 선배나머지기능은현재단계검토후순서선정. 실제ISS 위치/다른PC설치/실제HIL·replay는별도증거가필요. 이번feature완료로전체목적을닫지않는다.



### 제품 native 빌드 및 설치 (현재 Windows x64 CPython3.14)
빌드 Python에 project_support/tooling/orbit_build_requirements.txt를 설치하고 use_rust_environment.ps1 환경을 사용한다. build_orbit_wheel.ps1의 -PythonPath로 빌드 환경 interpreter를 명시한다. 현재 준비된 빌드 환경은 project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe이며 제품은 이 환경의 probe를 import하지 않는다.
```powershell
project_support/tooling/build_orbit_wheel.ps1 -PythonPath project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe
project_support/.venv/Scripts/python.exe -m pip install --no-index --no-deps project_support/tooling/orbit_wheels/isdc_orbit_propagation-0.1.0-cp314-cp314-win_amd64.whl
. project_support/tooling/use_rust_environment.ps1
cargo test --release --locked --offline --manifest-path digital_twin/simulation/orbit_propagation/Cargo.toml
```
아직 API/UI 연결 전이다. 빌드에 포함되는 DLL 출처/license 및 별도 격리환경 설치 검증은 T029에서 완료한다.


### 저장 ISS Orbit API 실행 profile (2026-10-02)
프로젝트root에서실행한다. 최초한번만prepare명령으로공개과거ISS예제와설치된고정EOP를보존한다. 이미manifest가있으면생성도구는덮어쓰기를거절하므로기존자료를보존한다. native wheel 설치는위절차가필요하다.
```powershell
project_support/.venv/Scripts/python.exe project_support/tooling/prepare_orbit_inputs.py
project_support/.venv/Scripts/python.exe -m uvicorn user_application.web.application:create_stored_orbit_app --factory --host 127.0.0.1 --port 8765
```
GET /api/orbit/inputs의input_id/epoch_utc로selection을PUT하고그revision으로samples를POST한다. 기존CLI/defaultcreate_app과달리이profile이localmanifest를lifespan에서읽는다. V6 위성 창에서 저장 입력 선택과 샘플 계산을 수행하면 공용 Cesium 지구에 첫 행의 UTC/ITRF 위치가 표시된다. UTC 재생은 후속 단계다. 과거epoch2020-07-12이며확보시각은로컬보존시각이다.현재telemetry/현재ISS예측으로사용하지않는다.
검증명령:
```powershell
node --test project_support/tests/browser/orbit_api.test.mjs
project_support/.venv/Scripts/python.exe project_support/tooling/validate_orbit_http.py
```
HTTP검증도구는임시localhost서버를실제로기동하고자신이만든프로세스만종료한다. API목록·선택·위치3행과기존health를확인한다. UI검증은포함하지않는다.

## W03-A RF 계산기 확인
V6 지상국 창에서 RF 패널을 연다. 모든 필드가 빈칸이며 실제통신미확인 안내가 있는지 확인한다. 합성 시험용 링크 이름과10개수치를직접입력해모델계산한다. 출력8개단위,반환status,입력사본,가정이표시되어야한다. 요구Eb/N0를높여모델여유부족을확인하고빈값/범위위반은서버조회전에오류로표시되어야한다.
계산후입력편집은이전결과를지워야하며작업창최소화/복원과다른업무전환후입력/같은결과를유지해야한다. 별도창전달값변경은재계산안내. 기존기하학적가시결과의실제통신미확인표시는유지한다. 두해상도에서패널내스크롤로모든항목과계산버튼접근을확인한다. 서버장비연결/실수신/프레임성능통과를주장하지않는다.

## ISS 프로파일 검증 T037~T040
새 프로파일 API/모듈 미존재에서 RED 확인 후 focused Python/Node 시험. 전체 pytest와 browser/*.test.mjs 실행. fresh stored-orbit server에서 ground RF 패널의 공식 조건 불러오기/주파수 적용, 다른 입력 보존, 재적용 결과 폐기, 편집 출처 강등 및 창 복원을1280x720/1920x1080 확인한다. GP epoch/UTC/기하 판정은 보존하며 실제 수신은 미확인이다. F001/T032 전체 완료로 표시하지 않는다.
