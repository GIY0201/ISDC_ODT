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


## W03-A RF 화면 모델
RF draft: link_id 문자열과 contracts/rf_workspace.md의10수치에 대한 편집 문자열. 초기 빈칸, 서버선택상태와독립, 사용자입력가정. 조회입력은trim/유한성/범위검증후새object로생성.
RF 응답사본: 기존model/link_id/inputs/8수치/status/assumptions. 변경불가능한canonical서버상태가아닌화면결과사본. idle/pending/ready/error 상태, generation 및AbortController로수명관리. 편집/취소/종료는결과소거, 동일draft복원은결과유지. snapshot은structuredClone. HTTP/DOM응답오류는error이며실제통신status로전환하지않는다.

## ISS 수신 공식 부분 프로파일
정적 버전 자산: schema_version=1, profile_id, ISS25544/RS0ISS/APRS/receive_only, source(url/status_as_of/checked_utc), frequency_mhz, known_inputs(frequency_ghz만), equipment_status=not_selected, communication_status=unknown, source_report, notes, canonical JSON hash. runtime 소유 상태 아님. 화면 사본은 pending/ready/error와 applied 여부만 소유한다. 각 RF input origin은 공식 명시 적용/사용자 가정/빈 미확인으로 계산한다. 프로파일/출처 변경은 RF query 세대 무효화.

## 시나리오 경로와 접촉 표시 사본
communication graph: bootstrap가반환한nodes(id,type)와links(id,source,target,quality,protocol). draft: source/target는graph내ID,objective latency/reliability/balanced,hours정수1~72. route response:echo3개,path/link_ids/hops/finitecost 또는unavailable/null,active_fault_targets. contacts response:hours/count/items와scenario-contact-plan-v1, 각item UTC start/end/duration/quality/capacity_mb/graphlink. 조회브라우저UTC를별도기록하며실제수신증거아님. network/route/contacts 각각idle/pending/ready/error, route/contacts 세대독립. 편집/재조회/취소/종료는관련과거결과폐기.

W03-D: OrbitRadioCalculation immutable 단일 UTC의 ITRF position_m/velocity_m_s, elevation_deg, range_m/range_rate_m_s/frequency_hz/doppler_hz/received_frequency_hz와error_code 및EOP/leap/frame/profile. 실패시 기하·주파수결과metric는None, 입력주파수echo는보존. OrbitRadioQueryResult는requestID/revision/inputID/hash/ground/minimum_elevation/calculation/stale를보존. Browser draft UTC/MHz, 공식프로파일은화면출처사본이고서버권위아님.

## W03-E
OrbitRadioSeriesCalculation: start_utc,end_utc,duration_seconds,step_seconds,rows tuple[OrbitRadioCalculation,...],eop_sha256,leap_sha256. OrbitRadioSeriesQueryResult: request/revision/input/hash/ground/minimum_elevation/calculation/stale. UTC grid와 rows immutable, 오류행 전 numeric null. UI interval 사본(start/end/peak/clip와조회 metadata)은 서버 현재 상태를 소유하지 않는다. Graph 요약은 모든 행 유효할 때 표본 중 min range/abs max shift, 부분실패이면 전체 요약 없음.


## W04 UI 사본과 초안
Mission은 기존 id/name/status/progress/plan_version/tasks/resources/success_conditions 사본. Task는 기존 id/lane/name/start/duration/status/predecessor/priority. Validation은 mission_id/plan_version/valid/conflict_count/conflicts. Preview는 mission/applied:false/diff/validation으로 현재 검증과 분리한다. UI 선택과 편집 초안은 서버 현재 상태가 아니며 저장 요청 전까지 runtime에 영향이 없다.

W05: runtime/status/metrics/events/missions는 서버 사본. 편집 draft만 브라우저 소유. metrics 마지막 snapshot과 SIM runtime 시간을 별도 표시. contracts/sim_workspace.md.
