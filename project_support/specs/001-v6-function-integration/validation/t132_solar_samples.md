# T132 solar samples API and fixed8891 deployment

2026-10-05. Original full T075–T084/US19 scope preserved. Existing contracts/solar_display.md and ADR0016; no old API/schema changes apart from the explicit solar addition in the compatibility allowlist. T133–137 remain pending.

## Regression and current code

Missing SolarGeometryQuery module first failed collection (t132_solar_red.log). HTTP/application tests then covered aligned scalar/batch,601limit,3-row leap-second SI grid, copied response, strict counts/steps/UTC/request ID/extra fields, missing profile503/out-of-range422/busy503, runtime/selection preservation and explicit snapshot injection. The 2100 invalid-range tests intentionally produce ERFA dubious-year warnings.

Added lifespan regression verifies solar/catalog share the explicitly hashchecked snapshot and malformed snapshot leaves stored API available with solar503. NaN/Inf request RED exposed non-serializable validation details; sanitized solar errors using the existing orbit pattern, preserving422 and excluding raw invalid inputs. Browser transport RED exposed missing api.solarSamples; it now uses the existing typed request/abort/no-store boundary and preserves explicit payload/status errors. Original public API compatibility still compares the rest of the original schema exactly.

Application SolarGeometryQuery uses existing bounded executor, explicit SI UTC and pure get_sun/c2t06a. SolarGeometryPort has no application/runtime dependency. Response schema1/frameITRF/unit vectors/canonical rows/EOP+leap hashes/per-row quality/model/transform/absent observedCIP metadata; no native SGP4 requirement or implicit solar clock. New deployment API available independently of future presentation.

Target HTTP/compatibility20PASS4warnings6.05s; browser API1PASS. Whole Python466PASS8warnings201.52s/session47447exit0; whole Node327PASS1273.3442ms. Python warning total includes the existing Starlette deprecation and old/new deliberate out-of-date time tests; no dependency install performed. Five additional T130 regression cases were added after full-suite collection and separately ran in the final solar target12PASS4.59s; do not claim that full run contained471tests. Published PyERFA translated ERFA c2t06a fixture, bad ephemeris vectors and frozen snapshot edges now covered; T130 complete. Fixture source was read from the installed authoritative library tests; no reference runtime import.

Logs retained under data/workspace/validation/ground_stations: t132_solar_target_final.log, t132_solar_pytest.log, t132_solar_node.log, t130_solar_final.log and RED logs. Initial temp fixture error used inaccessible default pytest directory; explicit workspace basetemp resolved it. Initial compatibility failure omitted the additive schema name; allowlist updated without weakening original equality checks. Whitespace check passed with existing Windows line-ending notices.

## Actual server application and state

netstat verified0.0.0.0:8891 listener31524. Standard CIM was denied; read-only escalation confirmed launcher3780/child31524 exact project venv/uvicorn create_stored_orbit_app factory command. Re-captured current orbit/bootstrap/health before stopping only those verified processes; hidden restart with same executable/factory/host/port. New launcher43508/listener37724 re-confirmed. No port increment, global environment change or data deletion.

Restored input25544/hash8d7c0750…/UTC2020-07-12T21:16:01.000416000Z, virtual ground36.3742/127.3567/123.45m, minimum5deg, paused/rate1. Orbit differences are exactly observed_monotonic_s, anchor_monotonic_s and client_request_id (new restore receipt); all other fields including revision1/provenance match. Runtime running/speed/scenario/mode/version/seed/recording/fault settings preserved; SIM elapsed/runID memory reset: RUN-D49699542DC5/4989.358s→RUN-C65FEF01B577/152.728s at the postrestart observation. These are separate from stored-input restoration, not raw whole-state equality.

Actual readonly POST solar601 rows at2026-10-04T22:01:12.212544000Z succeeded in318.8078ms (one HTTP measurement, not p95 or UI/game performance). All finite unit norms: maximum error2.220446049250313e-16; first scalar exactly matches batch; UT1/polar motion predicted_a from frozen snapshotc672540e…/leap6cb6f5d4…. Actual3-row2016leap canonical UTC grid preserved. Actual NaN JSON count returned serializable422. Query changes orbit observation clock only; runID/config fields unchanged. Ignored t132_state_and_solar_report.json, captures/live responses and t132_live_solar_http.json retain full identities/evidence.

No solar UI, light sign, occlusion, buffer playback or two-resolution acceptance claimed. T132 complete for its API/application/deployment boundary; T133–137 original indicator/buffer/preferences/workspace/live/Draft still open. US18/Terra/model/camera and fullT075–T084/performance/equipment/download/AerODT gates remain active; no PR/merge in this step.
