# T113 selected catalog readonly API verification

## Scope and result
Strict POST `/api/catalog/track` and `/api/catalog/visibility`, browser AbortSignal transport and typed CatalogGeometryPort are implemented. Existing API baseline is unchanged; only the two approved paths and request schemas are added to the compatibility allowlist. T113 complete; T111 controller/renderer coverage and T114–T116 remain pending. T075–T084 remain open.

## Automated evidence
HTTP RED: two missing routes returned 405. Browser RED: missing transport methods. Following implementation, targeted Python6 and browser API6 passed. Full Python423 passed, five existing ERFA warnings,174.04s; Node211 passed,939.158ms. Raw logs: `data/workspace/validation/ground_stations/python_t113_all.txt` and `node_t113_all.txt`. Strict invalid identity/extra fields/UTC/range/mask422, GP conflict409 and unavailable/busy503 covered.

An initial readonly fixture comparison included natural running SIM ticks. The isolated TestClient fixture was paused before its snapshot, retaining exact state equality assertions. The actual server was not paused. Initial compatibility failure was resolved by explicitly allowlisting only the approved additive paths/schemas. No numerical/native/wheel change.

## Actual 8891 verification
`project_support/tooling/catalog_track_live_check.py` captured saved state and report before restarting the exact owned server on0.0.0.0:8891. Restart resets in-memory SIM time; prior report/state were preserved and saved GP/UTC/observer restored with the existing revision-checked API. No port change.

Actual ISS25544 reference2026-10-04T12:43:41.833920000Z: period5578.75822513646s,1021 valid track rows,zero failed,HTTP0.810471700s. Center position exactly equals the existing position query. Next24h visibility returned complete,seven geometric intervals,zero contacts/errors,HTTP0.804216200s. These timings are single observations, not latency percentiles. Invalid GP409/UTC422/zero interval422 and saved selection/anchor/observer/mask/playback state preservation passed. Active catalog GP and separately saved historical GP remain distinct.

Raw output: `t113_before_restart.json`, `t113_live_track.json`, `t113_live_visibility.json`, `t113_live_result.json`, `t113_server_stdout.txt`, `t113_server_stderr.txt`, all under ignored `data/workspace/validation/ground_stations`.

## Remaining
No new track/pass UI or real-browser acceptance claimed here. Next: controller generation fences, replay renewal,24h table/timeline/AOS seek, segmented polyline/toggle and actual two-resolution verification before Draft PR. Receiver/RF communication remains unknown. T032/SC006,F001/F004–6 and download disk evidence remain unresolved; no merge.
