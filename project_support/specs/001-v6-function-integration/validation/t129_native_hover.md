# T127/T128/T129 native satellite hover integration — partial

## Change

Connected the existing original-style hover card to the one existing Cesium pick handler and real V6 workspace. Point primitives supply their current projected ITRF metres and whole-scene UTC; the selected point/model supplies its separate selected-display UTC and small render-only geometry copy. Pointer movement does not scan/copy the full catalog, call APIs, select a satellite or move the camera. Refreshing geometry refreshes the last hover target; invalid/hidden rows, target clearing and mouse leave hide the card. Read-only subscribers receive independent copies. Page teardown unsubscribes, removes the card and disposes the existing handler.

The existing original model emits string satellite IDs. A new regression exposed numeric-only matching; both types now match the same selected native identity. Model description metadata is used only when satellite ID and GP hash match. The card reuses original text/placement, bounded literal content and WGS84 ellipsoid conversion; original hover surface styling is reused under workspace.css. The CSS URL version changed to t129-r1 after actual browser evidence showed the previous cached stylesheet omitted the card surface.

## Regression evidence

- Renderer native hover RED: no payload for a picked point, then passing current scene/selected UTC, geometry copy, failed row and no selection assertions.
- Workspace observer RED: missing observeSatelliteHover, then independent subscriber copies/unsubscribe/disposal passing.
- Actual workspace assembly RED: no card after a pick, then real DOM presentation/native payload/readonly commands and queries/clear/pagehide assertions passing. An invalid test-only sample lacking existing EOP metadata was corrected; assertions were not relaxed. An isolated stored-selection import adapter was updated for the new real module; stored-selection invariants retained.
- String model pick RED retained in `data/workspace/validation/ground_stations/t129_string_pick_red.log`; fixed by ID normalization.
- Final `node --test project_support/tests/browser/*.test.mjs`: 325 passed, 0 failed, 1226.8844 ms. Log `t129_native_hover_node.log`.
- Initial full Python: 440 passed, 5 existing warnings, 189.54 s. After assembly edits, another full run: 440 passed, 5 existing warnings, 199.48 s. Command `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t129_hover_final_20261005`; original session42230 reached exit0, log `t129_native_hover_pytest_final.log`. Final string-ID/stylesheet-only edits were covered by final Node and actual browser checks; no Python code changed.
- `git diff --check`: passed, line-ending notices only. Same feature prerequisite path verified; checklist8/8 and no extension hooks remain unchanged.

## Actual browser evidence

Agent-created background tab on `http://127.0.0.1:8891/?validation=t129-hover#satellite`, real ISS catalog selection, original model ready, explicit focus and minimized window. After reloading final code and stylesheet, normal mouse movement over the visible ISS target showed:

`ISS (ZARYA) / NORAD 25544 / LEO / 424.549 km / 2026-10-04T22:01:12.212544000Z / WGS84 타원체 고도`.

Actual 1280×720 and 1920×1080 screenshots preserved in `data/workspace/validation/ground_stations/t129_native_hover_1280.jpg` and `t129_native_hover_1920.jpg`. Moving onto empty space hid the card; no warning/error logs observed at the final check. The screenshot proves ISS target hover, not independent identification of which overlapping point/model primitive was picked. Native model/string-pick behavior is additionally covered by the renderer regression. No injected payload or custom page mutation was used for these live checks. Temporary viewport reset and tab closed; user-owned tab left alone.

## Remaining scope

This does not finish US18/T075: whole-catalog live hover/edge bounds/2D/live playback coexistence, camera/error/retry/rapid-selection, sequential all50 GPU evidence and faithful Terra texture closure remain pending. Dark-emphasis map legibility remains as diagnosed in t129_map_diagnosis.md. Solar and T076–T084, existing performance/real communication/equipment/download/AeroDT gates remain open. Static JS/CSS changes only; no server restart, new port, native/API change, PR publication or merge. Port8891 preserved.
