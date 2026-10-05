# T125 renderer and T126 camera helpers — partial

2026-10-05, US18 FR027/FR028/SC024. Original source HEAD1a1e002. No actual browser model rendering or camera assembly acceptance is claimed.

## Original reuse and native boundary

Ported the original SatelliteModelLayer and CameraRangeMotion/direction/basis/attitude algorithms into digital_twin/visualization. Working camera_motion.js is byte-identical to the inspected original, SHA256 6c17078c054a8c2ffbcebe87e3a30e22c0ca51c0e028c93d013af5a0f39ae223. Its eight original behavior tests are retained. Model layer retains original ambient lighting, real-size scaling, approximate forward-difference orientation, focus/follow/zoom and 2D/behind-Earth mechanics. Camera ownership/handler wiring still requires T126 assembly and tests.

Model positions now come from an injected native ITRF metre sampler with matching UTC/catalog number/GP hash. Orbit time comes only from injected timeSource and advanceUtc; no Date or browser propagator exists in satellite_model.js. Cartographic conversion is limited to the original 2D/focus camera algorithms. An unavailable +1s native sample retains the original ENU display approximation, not an invented velocity.

## Readiness and ownership

Transport completion attaches one primitive, updates the latest geometry and stays loading until actual model.ready/readyEvent. Error events report render errors separately from load failures. Same identity/GP/URL/scale does not reload while pending or loaded; failed loads require explicit retry. Selection/GP changes or clear invalidate pending callbacks and destroy late primitives. Owned readiness/error/frame listeners are removed. Missing or nonfinite/mismatched geometry hides the primitive and cancels following/pending focus; recovery does not start following. Description orientation is copied rather than shared with the caller. Point/station layers are not modified.

## RED and tests

Missing renderer module produced ERR_MODULE_NOT_FOUND before implementation. Camera tests first failed because the helper exports did not exist. Original camera eight tests then passed: monotonic/no-overshoot zoom, wheel reversal, equal 30/60/144Hz elapsed-time motion, delayed/background frame cap, model-scale approach, invalid input/range bounds, opposite-direction basis and whole-attitude rotation.

Eight native renderer tests pass: latest geometry/readiness, late loads/failures, explicit retry/render error, invalid/mismatched/missing samples and recovery, unassigned/disposal, pending-load deduplication/event cleanup, same-satellite GP-generation fencing/ENU fallback, copied orientation/no-geometry queued focus cancellation. Orientation ownership test initially exposed 90 != 0 and passed after copying source description. Initial pending-deduplication RED command hung on unresolved fake downloads and was explicitly interrupted via its own handle; its empty output is not claimed as successful verification. Subsequent bounded targeted tests completed normally.

Whole Node260PASS/0fail/1071.3918ms; targeted16PASS/0fail/103.4648ms. Whole Python439PASS/5existingwarnings/178.42s/exit0 with project-owned basetemp pytest_t125_renderer_20261005. Raw final logs: data/workspace/validation/ground_stations/t125_node_final.log and t125_pytest_final.log. Python began before the final JS-only orientation ownership fix; the final whole Node run covers that fix. No Python/native/API changes occurred during the run. No new native wheel, HTTP/schema, package mount, runtime state, 8891 restart, PR or merge.

## Remaining

T125 remains partial until complete original lifecycle/geometry boundaries and assembly interfaces are exercised; T126 remains partial for actual original camera scenarios, interruption/morph/handler restoration and OrbitGlobe composition. T122 aggregate UI/hover coverage and T127–129 remain open. Actual single-Viewer rendering of all50 assets/Draco/WebP, faithful Terra textures and two-resolution browser proof remain necessary. Entire T075–T084, solar, T032/SC006 and operational/download deferred requirements stay open. Next owner implement: original camera/native renderer regression coverage then application/hover composition, without claiming existing globe screenshots prove model rendering.
