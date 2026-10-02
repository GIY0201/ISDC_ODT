# 좌표 및 고도각 검증 결과

2026-10-01, speckit-plan Phase 0 연구용 도구. 제품 구현 변경 없음.

실행: project_support/tooling/sgp4_benchmark/.venv/Scripts/python.exe project_support/tooling/coordinate_probe/validate.py
도구: project_support/tooling/coordinate_probe/validate.py 및 requirements.txt.
결과: data/workspace/validation/coordinate_probe_20261001/report.json 및 reference_samples.npz.

## 결과와 범위
- Vallado Appendix C 공개 위치 fixture 대비 0.0132868m 차이. 도구의 0.3m 확인 기준 통과. 더 엄격한 수치 기준 채택 및 속도 검증은 별도다.
- 역사적 ISS TLE, WGS72/AFSPC, epoch부터 24시간, 10초 간격 8641개 시각.
- 제주 가상 지점 33.4996N/126.5312E, WGS84 타원체 높이0m는 시험 가정이며 실제 시설 또는 사용자 확정 좌표가 아니다.
- 수동 TEME 회전/지상점 ENU 계산과 Astropy TEME→ITRS→topocentric AltAz(pressure=0) 비교: 위치 최대 2.274e-9m, 고도각 최대 1.279e-13도 차이.
- 10도 교차 경계8개(가시 구간4개), 경계 이분법 폭0.05초 이하, 같은 계산 결과의 경계 차이0초. 이번 자료의 위치10m/고도각0.01도/경계1초 수용 수치에 부합.
- 양쪽이 ERFA gmst82/pom00 수학 함수를 공유하므로 완전히 독립적인 이론 또는 구현 검증으로 주장하지 않는다. 공개 fixture는 별도 외부 수치 기준이다.
- 이번 좌표 도구의 궤도 입력은 C++ sgp4다. Rust와 C++ 전파 일치 시험은 앞 단계 별도 증거이며 Rust 변환 통합 시험은 아직 없다.

## 재현 자료
Astropy8.0.1, pyerfa2.0.1.5, astropy-iers-data0.2026.9.28.0.59.37, numpy2.5.3, sgp4 2.25. 별도 검증 환경만 설치, 앱 환경 유지.
IERS B eopc04.1962-now SHA256: 31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7
Leap_Second.dat SHA256: 6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7
두 파일을 결과 폴더에 보존하고 재실행은 snapshot/해시를 확인한다. 자동 네트워크 갱신 비활성화. 윤초 파일을 ERFA에 명시적으로 적용했다. epoch의 UT1-UTC=-0.2273057623s, xp=0.1875412366arcsec, yp=0.4170719907arcsec. 파일 원천은 astropy-iers-data 배포의 IERS 자료다. 일반 운용 시 보간/자료 범위 오류 정책은 추가 계약이 필요하다.

## 실패 및 남은 게이트
sandbox pip는 WinError10013으로 실패, 승인된 네트워크 다운로드 재시도 성공. LeapSeconds.open에 Path 객체를 전달한 오류는 문자열 변환으로 수정 후 재실행 통과. 시스템 Python pytest는 FastAPI 부재로 수집 실패하여 프로젝트 전용 환경으로 재검증한다.
10초 탐색의 짧은 구간/접점 누락 가능성, 날짜/윤초 경계, EOP 범위 밖/잘못된 입력, 속도/LOD 변환, Rust 통합 성능은 미검증. 현재 위치의 실측 정확도/실제 통신 성공/웹60fps 증거가 아니다. 원래 V6 기능 연결 목적과 실제 통신 조건 필수 후속은 유지한다.

회귀 재검증: project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/coordinate_probe_20261001/pytest_temp --tb=short → 35PASS, Starlette경고1, 2.54초. 기본 임시 경로에서는 setup오류10/25PASS가 발생했고 프로젝트 내부 basetemp 지정 재실행은 통과했다. 앱 소스 수정 없이 환경 경로를 조정했다.

## 2026-10-01 현재 계산 검증 묶음 완료
사용자 요청에 따라 중간 승인 없이 현재 계산 연구의 나머지 검증을 실행했다. 최종 확장시험 17 PASS / 실패0 / 오류0, 기존 Rust Python 연결9PASS, 프로젝트 회귀35PASS/Starlette경고1(2.52초).

| 항목 | 최종 증거 |
|---|---|
| 공식 위치 변환 fixture | 차이0.0132868m |
| Rust 전파→Python 변환/고도각 86401시각 | 위치차이 6.77776134823071E-06m, 고도각차이 1.89004367712187E-11도 |
| 실제 10도 구간 | 1초 전범위 탐색의 교차8개, 기준 경계차이 0.017822265625초 |
| 짧은 구간/짧은 공백/접점 | 샘플 사이0.2초 구간과 공백, 접점 분리 통과. 실제 궤도의 높은 임계값에서 약0.08785초 구간 탐지 |
| 잘림/없음/전구간 | 확인 통과 |
| 날짜/윤초 | TAI 1초 연속, UTC JD convention, 고정 EOP 변환 확인. 합성 epoch TLE Rust/C++ 윤초 양쪽 비교차이 1.94852739565509E-08m |
| 범위 밖/손상/NaN/Inf/비단조/중복 | 저장EOP범위밖1900/2100 거절, 손상TLE와 비유한입력 오류, 시각순서 보존 확인 |
| 관측점 기하 및 입력정책 | 바로위90도/지평선0도/아래-90도, 잘못된 좌표 검토정책 확인. 제품API 검증 아님 |
| 속도 변환 | 지구회전 항 포함, 명시적 LOD0 Astropy 비교차이 5.41994292579396E-05m/s, 합성LOD2ms 민감도 확인 |
| 86400시각 계산 전체 경로 | 중앙값 80.14ms / p95 90.88ms |
| 하루 가시 탐색 및 경계 보정 | 20회 중앙값 100.08ms / p95 103.47ms, 1초 목표 통과 |

### 재현과 제한
validate_extended.py 명령은 validate.py와 같은 격리Python으로 실행한다. extended_report.json에 원시20회시간/소스해시 기록. 공식 Vallado PDF snapshot SHA256: 538a5c0ea174eb569bbc258011717142a26d72871ab07cc64ee5fa3773164b16. IERS/윤초 snapshot은 앞 기록과 같은 해시로 확인한다. 범위밖2100 입력의 ERFA dubious-year 경고는 예상 입력 오류 시험에서 발생했고 오류를 정상 거절했다.

현재 계산 연구용 도구에서 실행한 검증 묶음은 모두 통과했다. 제품 기능 전체 검증 완료가 아니다. Rust는 전파, Python은 좌표/고도각인 조합을 검증했으며 Rust 좌표 커널은 작성하지 않았다. 공통 ERFA 함수를 쓰므로 독립이론검증이 아니고 extrema 기반 탐색은 매끄러운 고립 극값 가정 안에서 검증했다. 1초 조밀 탐색만으로 임의의 모든 접점/짧은 구간 발견을 보장하지 않는다. 실제 통신/Doppler, 실측ISS위치, 다른PC배포 및 UI60fps/입력반응/서버동시성은 후속 단계 검증이다. 통신조건(F002)과 전체 V6 기능 연결 목적은 보존했다.

최종 계획에는 UTC JD 전파 규약, EOP범위거절, 접점별도결과 및 짧은구간의 극값 보완 탐색을 반영할 것을 권고한다. 이번 시험이 제품 코드에 이를 적용한 증거는 아니다.
