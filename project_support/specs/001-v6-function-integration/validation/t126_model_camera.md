# T126 original camera behavior and single-Viewer wiring — partial

2026-10-05. Same US18 / FR028 / SC024 and full T075–T084 objective. Actual selected GLB/follow UI acceptance remains T127–T129.

## Original reuse

SatelliteModelLayer retains source camera methods. Twenty-five original 3D/lifecycle tests and seven original 2D tests now feed canonical UTC/native metre samples through explicit synthetic test adapters, rather than exposing a Date/propagator to the product. Original focus/keep-range, 1.4s behind-Earth flight, real-size/CubeSat bounds, paused-clock easing, delayed frames, wheel reversal/release, no teleport on reselection, 2D north-up/date-line following and morph/drag behavior pass. The two initial differences were expected approved contract changes: owned primitive destruction and explicit error retry. Tests now assert destruction and no implicit retry, then exercise explicit retry; no missing behavior is excluded.

Extracted original Earth-centred wheel algorithms into visualization/centered_camera_motion.js, reusing CameraRangeMotion/direction/basis helpers. Original Earth/map bounds, 150ms direction easing and controller inertia are preserved. One existing Viewer handler owns custom wheel; Cesium default wheel is removed from zoomEventTypes while PINCH remains. Model takeover cancels Earth goals. Pointer drag interrupts model approach, Escape/morph releases ownership. Teardown restores previous handlers/controller/morph policy only while still owned, retaining newer external changes. All listeners and frame callbacks are removed.

OrbitGlobe now exposes injected set/focus/retry/clear model methods, releases model following before station/point focus or view morph and disposes model/camera before Viewer destruction. Constructor creates no extra Viewer or model primitive. Existing runtime/native/HTTP/UTC ownership remains unchanged. No model UI, package mount or native propagation is introduced here.

## RED and regression

Missing centered_camera_motion.js caused module-not-found RED. OrbitGlobe composition RED showed missing setSatelliteModel and missing release before morph. After implementation, full Node initially exposed cleanup of incomplete fake Viewer boundaries: optional handler comparison treated undefined===undefined as owned. Fixed explicit handler guard and added inert-boundary teardown regression; kept all existing assembly assertions.

Camera suites: source helpers8, native 3D/lifecycle25, map7, centered input6, OrbitGlobe assembly2, plus renderer8. Whole Node300PASS/0fail/1124.4004ms. Whole Python439PASS/5existingwarnings/180.70s/exit0 with fresh project-owned pytest_t126_camera_20261005. Logs data/workspace/validation/ground_stations/t126_node_final.log and t126_pytest_final.log. Git diff --check passed.

## Actual 8891 evidence

Fresh hidden validation tab loaded actual satellite_model.js, camera_motion.js and centered_camera_motion.js from the existing 8891 server. No server restart or port change. Actual wheel enlarged the globe with station markers retained; UI morph to 2D and back to 3D rendered normally. Native viewport1280×720 and1920×1080, canvas count1, collected warning/error logs empty. Screenshots: t126_zoom_1280.png, t126_map_1280.png, t126_map_1920.png and t126_globe_1920.png under data/workspace/validation/ground_stations. Viewport override reset and temporary tab closed; existing user tabs preserved.

Initial proof lookup used an absent .globe-view selector after successful 2D selection; inspected DOM/current screenshot and continued with observed #globe-mode, no blind repeated mode command. First raw API comparison differed only in observed_monotonic_s, which is the documented per-read observation clock. All other stored orbit fields compare exactly: t126_orbit_before.json, t126_orbit_after.json and t126_state_readonly.json. No stored-GP/UTC/observer/mask/playback mutation claim is supported by whole raw JSON equality; the explicit excluded field is recorded.

This browser check shows Earth/map input behavior only. It does not prove real selected-model readiness/follow, Draco/WebP, Terra fidelity, full-catalog coexistence in the new model mode or T032 frame performance. T125/T126 remain unchecked until remaining source/interface/composition acceptance; T122 UI/hover and T127–T129 remain open. Next owner implement model/hover UI and native timeline composition, preserving Terra/solar and all T076–T084 requirements. No new PR/merge or full-goal completion.
