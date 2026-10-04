# ADR0008 단일시점 radio geometry 추가

2026-10-04. 사용자 위성기능 우선에 따라 /api/orbit/radio-geometry POST와 RadioGeometryRequest/OrbitRadioCalculation/OrbitRadioQueryResult를 추가한다. 기존samples/visibility/API/schema는보존한다. 기존Rustnative의TEME 위치·속도와 scalar변환을 재사용하고 선배oisl pointingTo 상대속도내적을 ITRF SI로이식한다. optical100km LOS는사용하지않는다.
기존bounded executor와selection권위/잠금/response revision을 사용하고 새상태저장소는없다. 주파수Hz는 명시입력(0< f <=300GHz),UTC단일시점read-only. UI는같은기존공식profile controller를쓰며원격·수동값을가정으로표시한다. 실제 수신/장비 제어는없다.
Δf=received−transmitted=−f0*range_rate/299792458 단방향1차. 동일UTC/LOD0/polar rates무시,광행시간·상대론·대기·발진기오차제외. 접근/이탈analytic,거리미분,Astropy별도변환(공통이론/ERFA)과전체회귀/실제UI검증.
