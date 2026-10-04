# T074 Catalog V6 validation — 2026-10-05

## Result and scope
US10 FR-018/SC-016/T071–74 complete: existing satellite-groups/satellites/profile API wired to V6 satellite panel, bounded100 page, editable conditions with explicit submit, list/source timestamps, SATCAT/GP limited detail and missing values. Backend query/cache/orbit formulas/schema unchanged. Single existing Viewer and stored GP/UTC retained. UI pagination controls do not discard unapplied drafts. Original V6 mock operational cards remain examples.

## Tests
- RED new controller module absent confirmed before implementation. Existing Python golden pagination/filter/GP fallback test; successful SATCAT cached24h but GP fallback deliberately retries SATCAT, verified3 sourcecalls.
- Full Python `project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/catalog_workspace/pytest_full_02`: **377 PASS130.79s**, existing Starlette warning1.
- Full Node `node --test project_support/tests/browser/*.test.mjs`: **166 PASS642.2707ms**. Dynamic groups, query/pagination, late response fences, abort adapter, malformed/empty/demo/stale/unavailable, deep copies, null-vs-zero, XSS escape, real V6 assembly1280/1920, native draft/minimize/restore and remote draft no automatic query; GP state equality/commands0/Viewer1.
- Initial Python full run228 PASS149 setup ERROR123.94s caused missing basetemp parent. Created parent and reran full suite. New golden assertion expected2calls but actual GP fallback retries3calls; corrected expectation to original behavior. No backend repair.

## Actual web
IAB http://127.0.0.1:8891/?validation=t074#satellite, 1280x720/1920x1080. active live fetched16633 catalog entries, stations live23. Page1–100→101–200→previous, NORAD25544 oneISS, nameISS13, LEO filter, impossible name zero results. Actual SATCAT ISS ownerISS/typePAY/status+/launch1998-11-20/RCS399.0524; null fields remain unknown. OriginalGP epoch2026-10-04T01:53:16.268928 shown raw; not ingested as stored calculation input. Cache/fetched_at and detail-response timestamp distinct. Native edits/minimize/restore retained. Finalr2 CSS cache version corrected and both screenshots refreshed. OneCesiumcanvas, no document horizontal overflow, stored selection/UTC remain empty as before, console errors/warnings0. Tests exercise network failures using fake transports; no intentional live outage was injected.
Screenshots localignored: data/workspace/validation/catalog_workspace/catalog_1280.png and catalog_1920.png. Full test outputs node_full.txt/pytest_full_02.txt. Runtime unchanged0.0.0.0:8891/PID41536; no server restart or SIM commands.

## Review and remaining
Read-only diff check confirms communication/http/catalog.py, data/catalog, digital_twin/simulation/orbital_elements.py and legacy tabs/orbit.js byte-diff0 from PR22. New presentation only calls existing queries; no new propagator, catalog browsercache, viewer or SIM stream. Conditional paging ignores unapplied draft changes; source unavailable is distinct from genuine empty search. Final review no additional blocking findings.
Draft PR above22, automatic merge disabled. F002 remains open pending W08 cross-screen/remaining legacy feature audit, including legacy all-catalog browser globe/selection/pass flow. That flow is not claimed connected by this catalog query feature. F001 equipment/actual RF, F004–6 HIL/durable recording/AeroDT-otherPC, T032 frame requirement and W06 disk save confirmation preserved. No new Rust build required for unchanged calculation.
