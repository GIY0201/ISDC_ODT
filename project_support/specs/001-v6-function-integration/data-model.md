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

W06: AnalyticsCopy(run/scenario/generated_at/provenance/KPI/requirements), DisplayFrame(runtime/analytics/events/telemetry/wall_time), bounded300 History, filter/selectedKpi/displayMode/live-or-history-or-json, ReportBytes/CSVRows가 화면 사본이다. server runtime은 변경하지 않음. JSONfreeze와CSV별도preview로 동일원본다운로드를 검증. 기존wire불변.

## W07 view copies
HilView: copied devices/runtime/events and optional telemetry; selectedDevice/sequence/localLogs<=60/chartHistory<=300, preflight with source context, sequence immutable result, pending/stale/error/connection, synchronization barrier. Server runtime remains authority. Null clock/jitter unknown. Preflight cleared on sourcecontext change; sequence preserves original run_id. Local clearing hides current displayed server event IDs without deleting server events; future events remain visible.

## US10 Catalog 표시 사본
그룹 목록/편집 조건/적용 조건/100개 페이지 응답/선택NORAD/상세 응답/각 요청 오류만 UI가 소유한다. 서버 cache 및 runtime 현재 상태를 복제한 권위 저장소를 만들지 않는다. 필터 변경시 상세 요청 취소/선택 초기화. null/빈 문자열은 미확인, 0은 유효한 수치일 때 보존한다.

## US11 표시사본
serverquery는normalizedGP의canonicalJSONhash, epoch, source, listfetched_at, typedOrbitInput 및명시IERS-A/윤초hash를가진일회읽기전용사본. UI는선택요청과검증된고정ITRF행만보유하며현재상태권위는기존runtime. Viewer표시모드는clock권위아님.

## US12 view-only station selection
ReferenceSite: original key/name/group/region/operator/network/role/latitude/longitude/altitudeKm/dishMeters/bands/minElevationDeg/presetKey. All positions are original representative presets. StationSelection: selectedKey|null, group=all|sourcegroup, display copy; no persisted physical station state. Scene entities keyed reference-ground-{key}; virtual-ground-point/stored-orbit-satellite unaffected. List/canvas invoke same selector. Unknown key leaves selection unchanged, clear retains all markers and existing camera; explicit focus moves camera only. Dispose releases pick handler once.

US13: StationDraft is local lat/lon/angle plus existing height/start/end strings. Source station key/name is an explanatory message, never authoritative server metadata. GroundPoint remains virtual WGS84. No source altitudeKm-to-ellipsoid-height conversion. Selected catalog geometry remains separate from stored orbit input.

US14: CatalogSamplesRequest = client_request_id, group,catalog_number,normalized_gp_sha256,start_utc,step_seconds(integer1–60),count(integer1–601),virtual WGS84 ground_point,minimum_elevation_deg. CatalogSamplesResult retains epoch/source/hash/EOP/profile, requestedground/mask, rowsutc/status/position_m/elevation_deg/range_m/azimuth_deg/error_code. Native failures have null geometric values and visibility unknown. Local playback projection is render state, not stored orbit/SIM clock.


US15 CatalogScene: canonicalUTC/group/query/orbit/scene_sha256/source/fetched/stale/warning/frame/profile/EOP+leaphash+quality/count/validcount/errorcount/rows. Row: catalog_number/name/epoch_utc/normalized_gp_sha256/orbitregime/status/error_code/position_m (3finite ITRFm ornull). PreparedCatalog: immutable validated OMM/epoch orparse-error per originalrow; boundednativechunks<=50000, externalmutation cannotaltercachedinputs. No authority over Runtime/SIM/currentstoredGP. DisplayScene: copied currentnative snapshot and selection ID; independent from stored selection, late generation discard, explicitsnapshotUTC.

US16: CatalogTrackSnapshot selected group/NORAD/GP hash+source/EOP/leap/referenceUTC/period/counts/sorted rows(UTC,ITRFm|null,error,quality). Presentation only, no authority clock. CatalogVisibilitySnapshot selected identity/hash/querybounds/virtualpoint/mask/knownintervals/contacts/errors/units; exact existingVisibilityResult with catalogprovenance. Controller selections copied; failedtrack rows split segments. AOS transfer to catalogTimeline only, never storedstate. Oldmodels unchanged.

## US17 GlobeViewChoice
Display-owned copied choice: mode in {2d,3d}, imagery in {blue_marble,satellite,osm,natural}, theme in {dark,light}, emphasis boolean. Defaults3d/blue_marble/dark/true. Renderer status: requestedImagery, displayedImagery nullable, phase pending/ready/fallback/error, error nullable. A revision guards asynchronous provider/morph changes; no UTC/GP/SIM fields or current-state authority. Owned layer and event callbacks disposed with the oneViewer. Model/solar entities remain pending separate T075 design.


## US18 display entities
- SatelliteDisplayPackage: original source HEAD/manifest hash, runtime schema2 manifest, ordered56 mapping records and50 distinct asset pairs, provider records/credits, original/derived hashes and dependency receipt. Static model definition, never runtime state. Validation constraints are normative in contracts/satellite_display.md. Missing dependency leaves incomplete receipt.
- ModelMatch: independent key/quality/kind/orbit/provider/title/label/url/thumbnail/orientation/minimumPixelSize/sizeMeters/scale/credit/creditUrl, from pure ordered resolver. Model quality assigned/exact/series/representative is mapping evidence, independent from rendering state. No-match is null.
- SelectedDisplayGeometry: existing selected number/GP hash/UTC/ITRF position_m plus buffer quality/interpolation; injected readonly sampler and UTC advance callbacks. No new position owner. At missing/failure sample no geometry and no follow; optional +1s buffer sample supports approximate orientation only.
- ModelPresentation: application-owned copied selection/match/status/error, renderer-owned primitive/load generation/ready subscription. Status unassigned/loading/ready/error/hidden_no_geometry. loading→ready requires current selection and render readiness; selection/clear/disposal invalidate all prior callbacks; explicit retry can restart error. Geometry loss cancels follow and hides primitive; recovery never starts follow automatically.
- CameraPresentation: existing Viewer pose and original CameraRangeMotion easing target, monotonic stamps, follow/pending-focus revision. These are display controls, not native/SIM state. Input interruption/morph/hidden canvas/selection/clear invalidates pending motion; new selection never reuses previous target ownership.
- HoverPresentation: picked number/name/regime/native position/that-position UTC, WGS84 ellipsoid height_m and pointer bounds. Only hovered target is converted; escaped text. Leave/failure/clear destroys card, no selection/query/runtime/camera changes.

## Solar display input (US19)
SolarDirectionBatch: immutable N×3 normalized terrestrial direction_to_sun plus aligned UtcInstant tuple, frameITRF, EOP/leap identities and model metadata. SolarSamples: start UTC, fixed step1SIsecond, count1..601, canonical aligned rows and EOP quality; copied presentation inputs only. SolarDisplayContext: existing display owner/UTC/selection generation; not runtime ownership. Interpolation uses only adjacent successful same-identity rows and hides outside range. Missing/failed query or cleared owner disables lighting and labels reason.
# US20 satellite node entities

FR030/FR031/SC026, contracts/satellite_nodes.md. Design only.

- NodeDefinition(schema1): id, virtual catalog_number>=900000, name, bus/model_key/mode, mass_kg, power{generation_w,bus_w,battery_wh}, orbit{altitude_km,eccentricity,inclination,raan,argp,mean_anomaly,explicit epoch}, equipment{id,catalog,role,target,enabled}, optional formation/notes/created_at/updated_at. Preserve source definitions with finite/deep-copy/uniqueness/domain checks. Equipment representative spec is a library definition, not expanded server wire data.
- FormationDefinition: original preset/planes/per_plane/altitude/eccentricity/inclination/raan_start/raan_spread/anomaly_start/phasing/spacing/prefix/bus/link_policy; ID pool supports atomic replacement and detached individual nodes. Total draft set max240.
- NodeDraftSet: copied definitions/selectedId/sequence/editRevision/draft errors; local deployed display copy has definitions+deployedAt+server receipt identity. Draft edits don't modify runtime config. Persistent storage failure is a visible condition, not a successful save.
- NodeGeometryBatch: requestId/source commit/profile/definition hashes/explicit canonical UTC grid/frame/time model/copy-owned finite fixed_position_m and inertial_velocity_km_s/sunlit or aligned row errors. Fixed positions are EARTH_FIXED_GMST_UTC_APPROX; no GP hash or ITRF claim. Original calculations remain identified as engineering assumptions.
- AcceptedDataDeployment: runtime-owned deployment_id/revision/nodes identity roster/run_id/scope_id. Candidate activation precedes commit; same ID+same nodes is idempotent, stale/reused mismatch conflicts, unavailable activation preserves previous receipt. No server orbit definitions or expanded equipment model fields in this roster.
- PendingDeploymentCommand: captured identity-only nodes, deployment_id, expected_revision and operation kind; same ambiguous retry keeps IDs, successful receipt updates exact captured local copy,409 refresh requires explicit reapply. Initialization/restore performs read only. T079 owns verified data-module capability for activation.

## N016 sampled network visual record

Existing network owner privately retains a single latest captured analyticalrecord;
NetworkSampledProjection is immutable and registered, not a second state store.
NETWORK_SAMPLED_UI_V1 includes complete existing envelope/native metadata/full
node_definitions/stations/faults/definition_hashes/network, utc=analysis_utc,
display_utc, age_seconds, current_analysis, availability and reason. Opaque actual
owner continuity and full captured optical analysis are private validation inputs.
Fresh current view rechecks them, copied marker is not proof. Ordinary periodic
pending retains still-valid analysis with availability=pending. Failure, invalid
authority, changed source/config/node/station/fault scope, command and disposal
invalidate at existing boundaries; pending alone never clears accepted analysis.
Exact network/fabric/action DTOs are unchanged. See ADR0048/network_timeline contract.
N017 readonly status is a copied observation separate from the existing command
snapshot. Bounded quality samples are historical presentation records owned by the
existing fabric exchange, with quality/UTC/instance/sequence/hash/request/link
provenance. Maximum48 per accepted link identity; endpoint/module instance changes
clear history and new accepted membership prunes removed links. UTC/hash/sequence/
request change records another past sample rather than clearing all history.
No parallel mutable current-state owner.
ADR0049 and contracts/network_lifecycle.md define lifecycle and failure behavior.
N017c–e OperatorStationPick is a renderer-issued deeply-frozen {id,station} value
registered privately against actual entity/coverage, entry definition and Viewer.
It is current presentation capability only; copied JSON is invalid. ground active,
native/sampled display ownership and current sourceGround definition must match.
clear/hide/morph/dispose/replacement revokes it. No current runtime duplication.

N017f FuturePassInput is a deeply-frozen registered readonly analysis input with
presentation_kind FUTURE_PASS_INPUT_V1, analysis_utc, whole nodes, station and
actual deployment receipt. Private record binds owner epoch/fullaccepted scope/
display source and optional actual catalog continuity. It is not a current runtime
store or mission/fabric approval. Any observed failure revokes registration.

FuturePassControlEntry is a scoped private pending depth and epoch increment,
not a clock/runtime state. Actual existing controller API-entry begins it and
finally releases it once. Pending blocks all capture/verification; source
provenance is the whole exposed display context excludingUTC.
Observational input ports return actual owner copies/proofs; allowed mutations
publish existing invalidation events. Silent mutation of another private owner
inside an arbitrary getter is outside this port contract.

N017g/h NativeFuturePassQuery captures actual FuturePassInput and request identity,
single site/start/end10800seconds and noacceptedcontext. Whole contact/eclipses
bundle must validate before pernodefirst3/stableAOSfirst12 projection.
FuturePassPresentation is a frozen privatelyregistered FUTURE_PASSES_UI_V1 with
status/availability,analysis_utc,display_utc,end_utc,age_seconds,station,
satellite_count,rows,coverage,communication_status:'unknown'. Each row includes
node identity/name, canonical start/end/peak, elevation, derived duration and
inclusive live flag. It is display history, never runtime/action/mission authority.
FuturePassQueryState owns only current request, cancellation/generation and
lastverified analysis, with active/idle/pending/valid/error/disposed transitions.
Failure/cancel/control/source/config/leave irreversibly revoke old presentation.

MIXED_ROUTE_EMPHASIS_UI_V1: privately registered deeply frozen analysis_utc/fullnode definitions/fullhashes/OISL IDs-endpoints/routed_ids/selected_id. Existing native/fabric owners retain authority; copies cannot approve, sampled scope cannot grant route truth. A single UI projection is cleared on changed proof/source/UTC/clear/dispose (ADR0053); no DTN or current runtime state is replicated.

## N018 주기적 native 분석 교환 추가 계약

Raw native command token: private registered frozen {kind,analysis_utc,snapshot}; optical/network 각각 기존 full raw accepted analytical payload. 다음 자연 분석은 token을 재라벨링하거나 자동 철회하지 않고 실제 continuity/full scope/control epoch로 검증한다. same fabric accepted record origin exact|captured_analysis; UI-only command provenance는 기존 exact approval로 승격하지 않는다.

## N018 analytical mixed route 시각 연결 잔여

ADR0055/contracts/analytical_mixed_route_visual.md/T166–T168: historical captured native route를 exact approval로 승격하지 않고 별도 등록 UI proof로 같은 OISL/ground 현재 native primitive의 원본 purple/width/material을 표시한다. immutable route 분석 UTC와 current display UTC/age/incomplete-current를 구분한다. 현재 구현 전이며 전체 이식/실제 두 해상도/성능 gate는 보존한다.

ADR0056/contracts/selected_link_rf_prefill.md: missing original selected ground-link -> existing RF calculator draft flow, T169–T171. Current geometry registration/ID/endpoints only; explicit copy cancels obsolete result, all11 editable labelled source representative assumptions. No formula/API/clock/automatic query change. Precode independent analysis required; whole live/performance gates unchanged.
