# T128 selected model matching/static transport, partial

Same US18/FR027/FR028/SC024 and original whole T075–T084 scope. Previous turn ecf9c7f/79e2582 was progress; worktree clean before changes. This is application matching/transport proof, not actual V6 assembly or rendered model acceptance.

## Changes and RED

`orbit/satellite_model_selection.js` composes injected original createModelResolver/validateSatelliteManifest with current copied catalog item, matching SATCAT profile and native geometry identity. It owns no clock/runtime/selection authority. Manifest request generations/AbortSignal ignore late old requests and disposed results; late current manifest resolves the current selection. Description signature avoids re-show/reloading during ordinary UTC playback. GP changes update target; mismatched geometry clears. Fixed readonly timeline callbacks supply native coordinates/time. Profile identity and epoch fence prevent unrelated/old GP metadata from influencing matching.

`api.satelliteModelManifest` uses fixed `/static/satellite_display/manifest.json`, no-store, caller AbortSignal and existing error handling. It adds no HTTP API schema. Package static mount is not yet added, so this path is not claimed live.

`workspace_globe.modelManifestStatus` owns copied presentation status and notifies model observers; model panel shows manifest errors separately from GLB readiness/error. No automatic focus/retry/runtime command.

Missing selection module, transport/status methods and missing manifest error display each had RED before implementation. Five selection scenarios include deferred manifest/current selection, deduplication, metadata/GP fences, errors/retry/clear/disposal, actual original schema2 package+real resolver for ISS exact and debris point-only, and equivalent UTC epochs across6/9 fractional digits/no-Z declared OMM EPOCH. Real resolver test exposed explicit null catalog incompatibility; fixed absent metadata to `{}` (original resolver contract), retaining original resolver unchanged. Epoch precision test exposed naive string comparison; existing timeline leap codec now normalizes declared OMM UTC text, preserves9digits and rejects1ns different epoch. No Date or floating timestamp comparison.

## Verification and remaining scope

Whole Node:320passed,0failed,1208.3885ms, command `node --test project_support/tests/browser/*.test.mjs`. Full Python:439passed,5existingwarnings,186.30s,exit0; command `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t128_selection_20261005`. Python started before final JS-only real-resolver/epoch fix; final Node covers it. Python/API/native unchanged. Raw ignored logs: `data/workspace/validation/ground_stations/t128_selection_node.log` and `t128_selection_pytest.log`. Diff check clean apart from line-ending notices.

Not yet imported by workspace_orbit/catalog panel; static package mount, original selection/profile notification hooks, model panel/hover callbacks, oneViewer/live GLB/thumbnail/selected UTC proof and owned8891 restart are outstanding. No browser/render evidence, server restart, public API/native/wheel change, PR or merge. T128/T122aggregate/T123/T125–127/T129 remain unchecked; faithful Terra texture dependency, solar/full T075–T084/T032 and previous real communication/download/AerODT gaps unchanged.
