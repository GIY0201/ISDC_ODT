# T128 model composition boundaries, partial

Same US18/FR027/FR028/SC024 and full T075–T084 goal. Previous turn b2d2a2e was authoritative progress. No new scope, clock, runtime authority, API schema or native wheel.

## Implementation and RED evidence

Catalog timeline now exposes readonly currentUtc/sampleAt/advanceUtc from its existing UTC owner/codec/native sample buffer. No fetch, paint, seek or event is triggered by sampling. Sample identity/frame/GP metadata remain current-selection-pinned and copied. Interpolation uses the original prepared buffer, respects failed rows and bounds, and uses SI leap-second arithmetic. Before a buffer exists, only the exact currently available picked/epoch position is returned; seek/clear/selection/disposal invalidates it. currentUtc returns the owned UTC string without cloning the full snapshot every model frame.

Three native model sampling scenarios failed RED on missing sampleAt/advanceUtc, then passed. currentUtc additionally had missing-method RED before adding accessor. Cases assert no request/display/state mutation, independent return copies, outside-buffer null, bad input, leap gap, selected ID/GP changes and picked exact-time fallback.

workspace_globe adds copied modelState/observeModel plus model show/focus/release/retry/clear ports on the existing OrbitGlobe. Preboot requests retain only the current presentation target. Each source status callback/promise is fenced by modelRevision; old GP completion, clear and dispose cannot update newer state. Renderer model error is reported independently of globe availability. This unit proof is a model callback proof, not live GPU scene.renderError recovery proof. Native source callbacks are injected references; no state snapshot clock or propagation is added.

Two application-boundary scenarios failed RED on missing methods, then passed: preboot latest target/one renderer, copied orientation/status, explicit camera actions, observer unsubscribe, stale same-ID/new-GP callback, clear/dispose and model-error globe preservation. Existing globe-view tests also pass. Real catalog selection/profile/manifest/pick composition is still pending; fake renderer tests do not prove it.

## Verification and limits

Final whole JavaScript:314passed,0failed,1177.5623ms (`node --test project_support/tests/browser/*.test.mjs`). Full Python:439passed,5existing warnings,181.99s,exit0 (`project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t128_boundaries_20261005`). Python started before final JS-only currentUtc accessor; final wholeNode covers accessor. Raw ignored logs: data/workspace/validation/ground_stations/t128_boundaries_node.log and t128_boundaries_pytest.log. Diff check passed apart from line-ending notices.

No browser/live model proof, server restart, port change, package mount, public API/native wheel change, PR or merge this turn. T128 remains unchecked: static manifest transport/versioned mount, current selected original catalog item/matching profile/resolver, model panel and native pick/hover wiring, live state capture/restart proof are outstanding. T122 aggregate/T123/T125–127/T129, faithful Terra/solar, full T075–T084 and prior performance/real communication/download/AerODT gates remain open.
