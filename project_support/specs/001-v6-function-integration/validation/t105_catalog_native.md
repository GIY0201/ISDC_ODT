# T105 다중 위성 Rust 배치 기반 검증

2026-10-05, US15 FR023/SC021의 native 기반. 전체 카탈로그 API/화면의 완료 증거가 아니다. 실제 제품에 `propagate_omm_many`와 별도50000행 호출 상한을 추가하고0.2.0으로 버전 관리했다. 기존 scalar exports/86401 시간 표본/WGS72_AFSPC 계산은 유지한다. 이후 큰 전체 카탈로그는 여러 chunk로 처리하여 목록100개로 축소하거나 조용히 잘라내지 않는다. ADR0014 참조.

## 실제 시험

- RED Rust: calculate_many/MAX_CATALOG_BATCH_ROWS imports 미구현 compile failure. RED Python: 설치된0.1.0에서 새 export/constant 미제공2FAIL.
- 실제 제품 `cargo test --release --locked --offline --manifest-path digital_twin/simulation/orbit_propagation/Cargo.toml`: integration4PASS. 기존 공식33입력/668상태 위치·속도 허용오차 유지, 새manyOMM은 같은OMM의 scalar계산668offset과bytes/error exact동일. 역순·반복/정상·손상OMM·상수실패/50000경계·50001거절·비유한/길이불일치 검증.
- 최초many시험은 TLE의 내부 Elements와 JSON roundtrip OMM의 raw bytes를 직접 비교하여 실패했다. 동일 OMM 계약의 scalar 비교로 기준을 바로잡았다. 기존 공식 TLE 검증668상태는 별도 그대로 실행·통과하며 오류를 없애려고 허용오차를 늘리지 않았다.
- 제품 build 스크립트는 운영venv에maturin이 없어 최초실패. 기존 전용 `.venv_orbit_build_t029`의 pinnedmaturin1.15.0을 명시하여 실제 product manifest release/locked build 성공. 새 dependency 없음; cp314/win_amd64 tag/RECORD/동봉libzlib출처·license 검사 유지.
- wheelSHA256 `bf366fd6619c9857182e309a51d6085a66c544bcd12070148e1f0198686e5c22`. 생성물/receipt는 ignored project_support/tooling/orbit_wheels/20261005_113812_139. 설치 시험에는 ISDC_ORBIT_INSTALL_WHEEL로 이 파일을 명시했다.
- `test_orbit_install.py`:2PASS7.03s, 새 cleanvenv/-I에서 실제module 경로/0.2.0/profile/기존TLE정상·오류/newexport/shape/error/상한 확인. 프로젝트환경 old/new native 시험6PASS0.68s.
- 최종 전체Python401PASS146.00s/경고5(기존Starlette·의도적2100년EOP범위/ERFA). UI/JavaScript 변경 없음; 이 단계의 새브라우저 수용시험을 주장하지 않는다.

## 고정8891 환경 반영

현재bootstrap/보고서/궤도 상태를 `t105_before_restart.json`에 보존하고 소유 확인한 PID41520 프로젝트uvicorn만 정지했다.0.2.0 localwheel no-index/no-deps 설치 후 같은0.0.0.0:8891에서 다시 시작했다. pip의 oldtemporarydirectory 삭제 경고는 기존 파일을 보존한 채 두었으며 새import0.2.0 확인. 실행SIM 메모리 진행은 초기화됐으며 전체 운용이력 영구 보존을 주장하지 않는다.

저장 선택은 기존PUT로 input/hash/UTC/ground/mask/playing/rate를 복원했다. 복원helper 첫시도는 UTF-8 snapshot을 기본cp949로 읽어 실패했고 명시UTF-8로 정정했다. 실제 기존samples3행 valid, UTC2020-07-12T21:16:01.000416000Z 및 대전/가정높이123.45/최소각5/paused 유지. `t105_live_restore.json`에 응답 보존.

## 남은 범위

T105 native 기반은 완료. T104는 native RED 부분만 완료이고 전체 scene/browser 시험이 남는다. T106–T110 cache/sharedUTC·EOP/API/wholegroup display·pick/실제16633성능 검증은 미완료. T075의 궤적·다음패스·태양·scene모드·imagery·대표SVG와 T076–T084도 유지한다. 전체 목표active이며 이 단계로 전체카탈로그 표시 완료/게임프레임 성능 통과/실제통신 성공을 주장하지 않는다. Git은 현재US15branch에 보존하고 전체묶음은 검증 후 DraftPR로 전달한다. 병합없음.
