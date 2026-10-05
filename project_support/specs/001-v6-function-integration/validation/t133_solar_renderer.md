# T133 solar renderer (2026-10-05)

Standalone renderer implemented; workspace assembly and actual browser acceptance remain T135–136. Original full T075–T084 scope remains open.

## Source fidelity and deliberate repairs

Read original pinned 1a1e002 `digital_twin/visualization/globe.js:885–969` and `user_application/web/scripts/orbit/globe_lighting.js`. Retain existing Viewer, one postRender callback, 50ms projection cadence, 80,000,000m virtual point, inclusive 45px screen margin, camera-direction dot test, Earth-ray occlusion and 2D/morph hiding. Original light-theme and shading preference semantics are represented by injected setStyle; persistence and UI binding belong to T135.

SolarDisplay consumes validated copied ITRF unit vectors and explicit UTC/model/snapshot metadata. It performs no HTTP, ephemeris, UTC clock or propagation. Light rays use negative direction-to-Sun, retaining original light color/intensity. Every sample updates light; only screen projection is throttled. No synthetic angle or TEME fallback is imported. Missing/invalid geometry clears dependent lighting. Disposal restores only properties still owned by this instance and removes its callback without destroying Viewer.

Original positive entry-distance occlusion misses cameras inside/on Earth looking inward. A positive exit distance also hides these cases; analytic ray/sphere tests preserve outward surface visibility and tangency. Nonfinite projected coordinates hide. 2D and behind-camera hiding happen before throttling. clear resets projection timestamp so valid same-tick retry works even when playback is paused.

Source caveat for upcoming presentation: original generic `.space-sun` CSS describes an indicator, but original index overlay elements lack that class and screen-specific CSS sets display:none. T135 must explicitly assemble approved indicator and record this difference. No visible original screenshot or V6 indicator is claimed here.

## Regression evidence

Missing-module RED: `data/workspace/validation/ground_stations/t133_solar_renderer_red.log`. Invalid unknown-status RED: `t133_solar_boundary_red.log`. Same-tick retry RED: `t133_solar_retry_red.log`. Retry initially returned true while overlay stayed hidden because projection remained throttled; timestamp reset repaired this boundary.

- `node --test project_support/tests/browser/solar_display.test.mjs`: 7 passed, 77.9063ms (`t133_solar_renderer_target.log`). Sign/color/intensity/copies, occlusion/tangent/interior/surface, margin/resize/nonfinite, 30/60/144Hz/background jumps, invalid inputs, retry and disposal/external light ownership.
- `node --test project_support/tests/browser/*.test.mjs`: 334 passed, 1228.9975ms (`t133_solar_node.log`), after final retry repair.
- `project_support/.venv/Scripts/python -m pytest -q --basetemp=data/workspace/validation/pytest_t133_solar_20261005`: 471 passed, 8 warnings, 201.73s (`t133_solar_pytest.log`). Existing run reached terminal output; no duplicate run/restart. Warnings: existing Starlette deprecation and deliberately out-of-date ERFA dates. Subsequent final edits JS-only, covered by final Node suite.

Same Spec Kit feature/prerequisites, constitution1.2.0, requirements checklist8/8, no extensions.yml. No server/port/native/wheel/runtime state changes. Actual lighting, subsolar sign and two-resolution screenshots not yet verified. T134 buffer, T135 preferences/assembly, T136 browser acceptance and T137 Draft review remain open, as do model/Terra, T076–84, performance, equipment and downloaded bytes.
