# 0003: 주입된 고도각 계산의 가시 구간 탐색

2026-10-02. T019 시험 이후 T020 구현 결정. 기존 SIM/legacy 계산과 공개 HTTP 계약은 변경하지 않는다. API 조립은 T021/T022에서 다룬다.

`digital_twin/simulation/visibility.py`는 UTC 범위, 최소 고도각, immutable OrbitCalculation 반환 함수를 받는다. 현재 선택/시계는 runtime이 계속 소유한다. 저장 입력, EOP 및 native 객체를 이 모듈에서 생성하거나 조회하지 않는다. 쿼리 내부 캐시는 해당 계산의 중복 평가를 줄일 뿐 현재 상태 저장소가 아니다.

0~90도 임계값과 0초 초과~24시간 이하 SI 범위를 검증한 뒤 1초 grid와 끝점을 평가한다. UTC 생성은 TAI TimeDelta로 윤초를 보존한다. 지원 profile은 WGS72_AFSPC, 결과 frame은 ITRF다. EOP/leap hash와 profile/frame은 최초부터 마지막 평가까지 동일해야 한다. 행수/UTC/유효값/오류 행 계약 위반은 ValueError로 거절한다.

샘플에서 기울기 반전이 보이는 매끄러운 고립 극값의 bracket을 ternary 탐색으로 보완한다. 첫/마지막 cell도 별도로 보정하여 조회 경계 직후/직전이나 단일 cell 내부의 극값을 놓치지 않게 한다. 같은 endpoint 값만으로 평탄하다고 가정하지 않는다. 평가한 양 끝과 내부 두 값이 모두 같으면 평탄한 bracket 탐색을 끝낸다. 극값 bracket은 최대40회, 종료 폭 0.000001초다. 임계값 교차는 bisection 최종 bracket 0.01초 이하로 보정한다. 교차는 최종 bracket 중점 추정값이다. 접점 분류의 수치 허용치는 0.000000001도이며, 부동소수점 반올림으로 생긴 0.01초 이하의 zero-only 극값 군집을 양의 시간 pass로 만들지 않는다. 조회 전구간이 임계값과 같은 plateau는 양의 시간 interval이다.

첫3개 구간 제한, legacy45초 샘플 또는 고정5도 조건은 사용하지 않는다. 고립 접점은 duration0의 contact로 반환한다. 시작/끝 잘림은 조회 범위 경계에만 표시한다. 실패한 평가 시각은 가시 구간의 연결을 끊고, 전체/부분 실패를 error/partial로 표시한다. 부분 결과에서 완전한 탐지 범위나 실패 경계의 정확성을 주장하지 않는다. 오류 이후 정상 좌표를 합성하지 않는다.

immutable VisibilityResult/Interval/Contact/Error는 내부 typed 계약으로 `digital_twin/contracts/orbit.py`에 둔다. 기존 OrbitCalculation과 샘플 계약은 유지한다. API 요청 ID/revision/input hash 및 communication_status=unknown은 이후 HTTP/runtime 조립 책임이다.

고립 극값이 1초 샘플 bracket에서 분해 가능하다는 가정 밖의 고주파 진동, 해석 불가능한 sub-grid 구조, 수치 허용치 아래 구간을 완전 탐지한다고 주장하지 않는다. 검증은 고정 역사 ISS/가상 제주와 해석 가능한 합성 사례의 기하학적 수용 시험이다. 굴절/지형/안테나/RF/실측 조건과 다수 위성 일반화 및 하루1초 제품 성능 게이트는 별도다. F001 실제 통신 조사/적용과 F002 전체 기능 연결을 유지한다.
