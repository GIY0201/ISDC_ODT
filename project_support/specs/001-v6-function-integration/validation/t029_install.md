# T029 제품 wheel 격리 설치 검증

2026-10-03. 제품 Cargo manifest에서 Windows x64 CPython 3.14 wheel을 다시 빌드하고, 새 venv에 오프라인 설치한 뒤 실제 Rust 계산을 호출했다. 기존 제품 venv, 연구 환경, 이전 wheel, 저장 입력은 교체하지 않았다. 다른 PC 지원 완료를 뜻하지 않는다.

## 시험과 수정

먼저 `test_orbit_install.py`를 추가했다. 기존 wheel의 RECORD/태그 확인은 통과했지만 포함된 zlib DLL의 LICENSE 누락을 검출했다. 격리 호출 시험의 초기 cp949 읽기와 datetime 직렬화 오류는 시험 도우미에서 수정했다. 이를 제품 오류로 계산하지 않는다.

첫 재빌드에서는 maturin이 PATH에 있는 별도 Codex libheif의 zlib DLL을 복사했다. 새 provenance gate는 선택 Python의 설치된 libzlib package와 SHA256이 일치하지 않아 빌드를 실패 처리했다. 빌드 스크립트가 선택 interpreter의 base와 Library/bin을 PATH 앞에 두도록 보완하여 외부 앱 DLL의 우발적 선택을 막았다. 이후 복사된 DLL을 설치 package 파일과 바이트 해시로 대조하고 원 LICENSE를 wheel의 dist-info/licenses에 넣었으며 RECORD를 갱신했다. 새 미확인 DLL은 거절한다.

빌드마다 날짜가 붙은 출력 디렉터리를 만들므로 이전 wheel은 보존된다. pinned maturin 1.15.0, locked Cargo manifest, release profile, repair를 사용한다. 제품 venv에는 maturin이 없어 별도 `project_support/.venv_orbit_build_t029`에 설치했다.

```powershell
./project_support/tooling/build_orbit_wheel.ps1 -PythonPath ./project_support/.venv_orbit_build_t029/Scripts/python.exe
project_support/.venv/Scripts/python -m pytest -q project_support/tests/test_orbit_install.py --tb=short -o cache_dir=data/workspace/validation/workspace/pytest_cache
```

빌드 exit 0. 설치 시험 **2 PASS**, 8.38초. MSVC import-library 생성 메시지 1개는 Rust linker warning으로 출력되었으며 빌드 실패가 아니다.

## 산출물과 지원 범위

- wheel: `project_support/tooling/orbit_wheels/20261003_014508_335/isdc_orbit_propagation-0.1.0-cp314-cp314-win_amd64.whl`
- SHA256: `da76caecf78c8472cb7e0dda75c549fbede2744e0af4b6a6fc179c3c2365ee3a`
- 태그: `cp314-cp314-win_amd64`. abi3 wheel이 아니며 다른 Python minor, free-threaded cp314t, ARM64, Linux/macOS는 미검증이다.
- 실행 Python: 로컬 CPython 3.14.6 Windows x64. `python -I`와 프로젝트 밖 cwd에서 새 venv의 native 파일만 import하고 WGS72_AFSPC 공개 기준 위치 1e-6 km, 속도 1e-9 km/s 및 잘못된 TLE 거절을 확인했다. 프로젝트 모듈이나 기존 site-packages의 native 설치로 대체하지 않았다.
- `--no-index --no-deps` 설치는 네트워크나 새 의존성을 받지 않는다. 전체 웹 제품 설치나 다른 PC의 Microsoft runtime 설치 여부를 검증하는 시험은 아니다.

기계별 경로와 바이너리 및 생성 receipt는 ignored workspace/build 출력에만 보관한다. `build_receipt.json`은 wheel/manifest/Cargo.lock SHA256, Rust package 버전 및 선언 license, DLL hash/provenance, dumpbin dependency와 지원 한계를 기록한다. 격리 실행 receipt는 `data/workspace/validation/install/aac516b1bae54d93bc612702849e6dd6/isolated_call.json`이다.

## DLL 출처와 라이선스

유일한 wheel 내 외부 DLL은 `isdc_orbit_propagation.libs/zlib-a2e123cc.dll`이다. SHA256 `a2e123cc624634d08200b4e5ee6a2828d2df88fd9573b5b5fdd9da336f5738a6`은 선택 Python 환경의 설치 libzlib DLL과 일치한다. 설치 package receipt는 libzlib 1.3.2 `h1c6eee0_0`, Zlib license, Anaconda main win-64 package URL 및 archive SHA256 `ee9ff49405717b96ec8d9b586beaaf96b741ffc4d37df6623f1d599ab8bdbb14`를 기록한다. LICENSE 원문 SHA256은 `e32ff4e00d9d94930537635291da39e7e612703334bf6fde8c7f1686fe8a45a2`이며 wheel 안에 보존했다. 설치 receipt와 로컬 package 파일을 확인한 것으로, 이번에 upstream archive를 다시 다운로드한 것은 아니다.

제품 pyd의 직접 PE 의존성은 python314.dll, VCRUNTIME140.dll과 Windows kernel/UCRT API DLL이다. wheel은 이 파일들을 재배포하지 않는다. Python은 설치 interpreter가 제공하며 로컬 `LICENSE_PYTHON.txt`의 PSF license가 적용된다. Windows/UCRT 및 Microsoft VC runtime은 해당 설치 환경이 제공하는 구성 요소이다. 이 wheel의 zlib은 Python DLL의 전이 의존성이 repair 과정에서 포함된 것이다. 다른 PC 설치 안내와 VC runtime 재배포 권한 검토는 F006에 남긴다. 자체 제품 crate의 배포 license 결정도 별도이며, 이번 로컬 호출 검증으로 대외 배포 허가를 주장하지 않는다.

F001 실제 통신 조건 적용과 F002 전체 프로토타입 기능 연결은 이 시험으로 닫지 않는다. 전체 pytest/Node/native 회귀 결과와 첫 구현 묶음의 요구별 결론은 T028/T030 기록에 연결한다.
