# Data model: 첫 orbit 연결

검토안 2026-10-01. simulation/data가 현재 상태를 소유하지 않는다.

| 타입 | 필드와 불변 조건 | 소유 |
|---|---|---|
| OrbitInput | input_id, satellite_id, format(TLE/OMM), raw_sha256, epoch_utc, fetched_utc, source, frame=TEME, time_system=UTC, profile=WGS72_AFSPC, immutable elements | data 입력 조회 |
| EarthOrientationInput | snapshot_id/hash, origin, retrieved_utc, date_range, xp/yp, UT1-UTC, leap_snapshot_hash, interpolation=xp/yp 일별선형; UT1은Astropy IERS.ut1_utc의윤초보정규약을사용하며raw UT1-UTC jump를그대로직선보간하지않음; 윤초 step 유지 | data가 읽어 immutable 값 전달 |
| GroundPoint | point_id, name, geodetic_lat_deg[-90,90], lon_deg[-180,180], ellipsoid_height_m finite, ellipsoid=WGS84, virtual=true | runtime 선택의 값 사본 |
| OrbitSelection | input_id, ground_point, minimum_elevation_deg[0,90], anchor_utc, playing, play_rate[0.1,60], revision>=0 | 기존 runtime의 orbit 구성 요소 |
| OrbitRequestContext | client_request_id, expected_revision, input_hash, eop_hash, calculation_profile | 요청·결과 사본 |
| OrbitSample | utc, position_frame=ITRF, position_m[3], geometric_elevation_deg, status=valid/error, error_code nullable | immutable 계산 반환 |
| VisibilityResult | query_start/end_utc, threshold_deg, intervals[], contacts[], status=complete/none/error/partial, provenance | immutable 계산 반환 |
| VisibilityInterval | start/end_utc, start_clipped/end_clipped, max_elevation_deg, peak_utc; start<end | 반환 사본, 통신성공 아님 |
| TangentContact | utc, elevation_deg, duration_seconds=0 | 별도접점 결과 |
| WorkspaceView | task_id, minimized, expanded, geometry, pending_request_id, provisional_utc, last_confirmed_result | UI 표시사본 |

시각은 timezone을 명시한 UTC ISO8601(윤초 표현 지원)과 계산내부 jd1/jd2로 나눈다. datetime/JS Date가 윤초를 자동정규화하게 두지 않는다. UTC 입력의 문자열을 server에서 검증하고 browser는 wire UTC를 보존한다. 출력 좌표 단위m, Rust내부km는 nativeadapter에서 변환한다. 메모리 소유버퍼를 유지한 read-only view만 전달한다.

전이: unloaded→loading→ready/error, ready→pending→ready/error. 이전결과를 보존할 경우 previous_result_utc와stale를 표시. selection revision 변경 이후 응답은 context가 맞을 때만 view 갱신. 창 geometry 변경은 semantic selection revision을 바꾸지 않는다. 기존 SIM running/speed/elapsed_seconds를 orbit selection과 혼합하지 않는다.

자료가 잘못됐거나 필수 EOP 누락 시 결과값을 valid로 제공하지 않는다. row error가 있으면 query partial, 해당행 수치는null, 전체 실패와구간없음을구분. 범위와길이상한은 plan/configs에 명시. 실제통신 필드는 communication_status=unknown으로만 둔다.

