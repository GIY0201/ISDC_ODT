# T127 model panel and hover presentation, partial

Source: upstream1a1e002 orbit.js renderShape/hoverSatellite/focusSelected/centerSelected. Same US18/FR027/FR028/SC024 and full T075–T084 objective. Isolated presentation evidence, not application composition or live GLB rendering.

`tabs/satellite_model.js` reuses describeMatch, thumbnail/credit and explicit focus/keep-range follow/release semantics. Mapping quality and render status have separate nodes. No camera command on show/update/draft restoration. Missing selection/geometry disables focus; retry only for failed matched model. Source fields use textContent; credit href HTTPS only. Detached/remounted button handlers and model observer disposed.

`tabs/satellite_hover.js` ports original name/NORAD/regime/height and placement with injected Cesium WGS84 conversion of only picked ITRF metres. UTC belongs to picked position; interpolation/ellipsoid height explicit. Text bounded256 Unicode code points without HTML. Identity mismatch, invalid frame/geometry/time/screen, failed rows or invalid height hide card. Small globe bounds clamp to available origin; mouseleave/card cleanup idempotent. No query/propagation/selection/camera function accepted.

Both modules: module-not-found RED before implementation. Two model-panel scenarios cover quality/readiness, explicit actions, errors/retry, remount/draft/cleanup, no model and unsafe credit. Initial fixture expected release while tracking=false; corrected fixture to publish tracking=true before clicking, preserving disabled-release behavior. Seven hover cases cover native input/UTC, literal hostile text, bounds/code points, invalid data, ownership/disposal and failed row. Failed-row residual-coordinates RED produced visible card; fixed status/error_code rejection and reran full suite.

Final verification:

- `node --test project_support/tests/browser/*.test.mjs`:309passed,0failed,1108.2498ms.
- `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t127_hover_20261005`:439passed,5existing warnings,182.07s,exit0.
- Raw ignored logs: `data/workspace/validation/ground_stations/t127_node.log`, `t127_hover_pytest.log`.

Panels not yet imported into workspace_orbit; globe modelState/observeModel and pick-handler hover callback need T128 composition with current selection/GP/native sample callbacks. No live browser/render/thumbnail proof, server restart, port/native/API/wheel/PR/merge change. T122 UI partly covered, application/selection/profile/late-manifest still outstanding. T127 unchecked until composition/lifecycle acceptance. T123 Terra textures, T125/126 live acceptance, T129 all50, solar/fullT075–T084/T032/real communication/download/AerODT remain open.
