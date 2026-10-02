# 좌표변환 및 고도각 제품 검증


## 2026-10-02 좌표변환/고도각 제품 구현 및 검증 T007/T008
- 변경: digital_twin/simulation/orbit_geometry.py의 WGS84 관측점, 주입 UTC/EOP의 TEME km -> ITRF m, 회전항 포함 속도 m/s, ENU 기하학적 고도각 deg 구현. 파일/네트워크/현재상태 접근 없음. 입력과 결과 소유권 분리 및 bytes 기반 수정불가 배열 반환. 기존 궤도/API/UI 계산 변경 없음.
- 시험 우선: orbit_geometry 누락 수집실패 확인 후 구현. 공개 Vallado Appendix C 위치 fixture와 metadata/hash 추가. WGS84 적도/극/고도, 위/지평선/아래/10도, 좌표 오류/비유한/boolean/complex/문자열/길이/EOP혼용, 관측점일치, 빈배치, immutable/입력사본, Rust 제품 ISS -> 변환/고도각, 윤초 및 LOD 회전항 시험18개.
- 결과: 공개 위치 사례 오차0.013286801192m(<0.3m 게이트). 24h361개시각(240초간격) Astropy 비교 최대 위치차1.919970673e-9m, 고도각차7.460698725e-14도(<0.01도), 속도차5.430054537e-5m/s(<0.01m/s). 전체pytest78 PASS(기존60+새18), 기존Starlette경고1,4.96초. pip check PASS(동일환경). results.json/metrics.json/source_hashes.json은 data/workspace/validation/geometry_implementation에 기록.
- 회귀에서 발견한 규칙 불일치: simulation -> immutable contracts가 기존 검사 허용 목록에 없어1실패/77PASS. 현재 typed입력 설계에 맞춰 허용 목록과 ADR을 정합화한 뒤 전체 재실행 통과. foundation/communication-native 검사도 추가하여 상위상태/통신 의존 금지를 유지.
- 한계: Astropy와 ERFA 회전함수를 공유하므로 이론적으로 독립 검증이나 실측 ISS 정확도 증거가 아니다. 기하학적 고도각이며 굴절/지형/안테나/RF 미반영. 속도LOD 기본0초,2ms합성감도만 확인,극운동변화율 무시. 361시각 비교는 가시구간 경계/누락 검증이 아니다. 해당 제품검증은 T019 이후 별도 진행.
- 현재 상태: T001~T008,8/31완료. R005/R007/R008/R010의 계산기반 증거 추가. 다음T009/T010 단일 위성/UTC 상태와 runtime 조립 시험/구현, 이후API와V6 연결. F001 실제통신 조건 확인/적용, F002 전체선배기능 연결 및 UI/배포 성능 검증은 유지.

검증 명령:
```powershell
project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/geometry_implementation/full_fixed -o cache_dir=data/workspace/validation/geometry_implementation/cache --tb=short
```
원본 기준: [Vallado Appendix C](https://celestrak.org/publications/AIAA/2006-6753/AIAA-2006-6753-Rev2.pdf). fixture의 UT1-UTC와 xp/yp를 사용하며 실제 시설 좌표를 뜻하지 않는다. 원본 자료 hash는 fixture JSON과 manifest에 연결한다. 사용자 첫 목표인 V6 연결 및 전체 기능 현대화의 일부이며 전체제품 완료가 아니다.
