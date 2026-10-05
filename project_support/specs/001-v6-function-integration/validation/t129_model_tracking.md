# T129 selected model rendering and tracking status — partial

## Scope and evidence

The actual V6 page on fixed port 8891 rendered the original ISS GLB at 1280×720 and 1920×1080 after explicit focus. Preserved screenshots in `data/workspace/validation/ground_stations`: `t128_iss_focus_1280.jpg` and `t128_iss_focus_1920.jpg`. These prove the selected ISS display only, not all 50 assets or performance acceptance.

The actual 1920×1080 2D focus left a black map background with the selected point and track visible. `t128_iss_2d_focus_1920_failure.jpg` preserves the failure. A later observation still showed the failure. No console error was observed at that check, which does not establish correct rendering. Cause remains unproven; T126/T129 stay open pending camera investigation and real two-resolution revalidation.

## Tracking observer repair

SatelliteModelLayer already reports tracking ownership changes. OrbitGlobe did not forward the injected `onTrackingChange` callback and workspace_globe did not subscribe to it. Tests first failed for the missing callback, then passed after forwarding the existing event with the same disposal/model-revision fence as status updates. This makes presentation observers update on asynchronous tracking changes without introducing a second clock, propagation, or runtime state authority.

Verification:

- `node --test project_support/tests/browser/*.test.mjs`: 323 passed, 0 failed, 1219.9083 ms; log `t129_tracking_node.log`.
- `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t129_tracking_20261005`: 440 passed, 5 existing warnings, 201.23 s; log `t129_tracking_pytest.log`. Confirmed completion from the original exec session 29835 and its saved log; no restart of the test job.
- `git diff --check`: passed (Git line-ending notices only).

The temporary browser tab from the preceding observation was no longer present on resumption. No new live Escape/follow-status verification is claimed in this continuation. The earlier screenshots are retained as earlier observations.

## Remaining acceptance

Actual native hover composition, 2D camera repair, live follow/release/error cases, all-model GPU proof and faithful missing Terra textures remain open. Solar, whole T075–T084, T032 performance, actual equipment/communication, file-download bytes and AeroDT integration retain their existing scope. No server restart, port change, new API/native calculation, PR publication or merge occurred in this repair.
