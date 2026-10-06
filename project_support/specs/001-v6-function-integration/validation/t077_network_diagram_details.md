# T077 source network diagram and fabric detail presentation

Source baseline: HyeonJun9138/ISDC-ODT pinned `1a1e00297a0301637455b0ef2cf48b2e74576b07`.

## Source correspondence

- `digital_twin/visualization/network_diagram.js` copied byte-for-byte (SHA256 `eab9d9183a691cd6809a96476bf67af28a0acb1fd633bd2526db7059cd67e9af`). The original deterministic orbital-plane layout, node/ground cards, ground contact tags, quality tones, route highlighting, SVG accessibility metadata and display-only flow remain unchanged.
- `user_application/web/styles/network_diagram.css` contains original communication.css lines 99–173, excluding other communication view layout rules outside that range. Root assembly loads this stylesheet.
- `ground_network.js` uses optional injected diagram exports and existing `sourceNetworkModel` label dictionaries. Original communication.js `renderDiagram` projection is retained: `node.orbit.raan`, `node.orbit.mean_anomaly`, formation membership, enabled stations.
- Original communication.js `renderRoute` hop fields are exposed as hop_list rows: from/to display names, source link kind labels, delay_ms, capacity_mbps / 1000 (Gbps), quality percentage. Existing route totals stay visible.
- Original communication.js `renderDtn` individual node fields are exposed for all returned nodes rather than truncating to eight: custody label, stored_mb, capacity_mb, generation_mbps, next_hop. Selected node/link detail preserves the native definition / accepted fabric record for inspection.

## Ownership and invalidation

Only the existing verified native network snapshot and accepted fabric exchange receipt are read. This adds no native request, propagator, viewer, clock or current state owner. Explicit send/route/status actions remain unchanged. Before a receipt, layout nodes are neutral and no quality-dependent links are drawn; missing values remain unknown. Display flow is a connectivity cue, not measured traffic. Snapshot invalidation or external editing conflict clears diagram, custody table, hop table and selection detail. Receipt failure is handled by the existing fabric exchange fences.

## Focused validation

Meaningful RED before panel implementation: both 1280x720 and 1920x1080 tests expected a diagram but received empty markup. A subsequent nested-orbit source fixture caught the missing orbit projection (undefined instead of RAAN 50); corrected before completion.

Command:

```
node --test project_support/tests/browser/ground_network_details.test.mjs project_support/tests/browser/ground_fabric_presentation.test.mjs project_support/tests/browser/ground_network_panel.test.mjs
```

Result: **13 passed, 0 failed**. Tests cover source SHA provenance; both resolutions; exact node definition/station projection; actual source SVG and routed ground contact; HTML escaping; explicit selected-link detail; actual hop/custody fields and units; unknown before receipt; clearing on snapshot invalidation; existing transport/controller/editor behavior.

This is fixture-based product assembly/pure rendering evidence. Real browser visual acceptance and complete source NetworkScene ground coverage / future node pass table remain separate work; this document does not mark all T077 complete.

## Native ground NetworkScene port

`digital_twin/visualization/native_network_scene.js` is a ground-only port of the pinned source NetworkScene. Original station markers/labels, coverage ellipse dimensions/opacity, ground state colors and materials, route/selection widths, visibility controls and resource cleanup are retained. Original inheritance through NodeScene was replaced by a display-only composition with the existing shared NodeScene/Viewer; OISL models/tracks remain owned there. The propagation-dependent `cartesianAt` now reads only existing verified native definition/hash/UTC/frame-tagged rows. Station geodetic-to-Cesium conversion is presentation geometry, not orbit propagation. Coverage radius is the existing source ground-station model calculation injected by the parent, evaluated at the original representative median constellation altitude (fallback550km); it is a SIM mask range, not verified antenna/RF coverage.

The renderer validates the current native snapshot/UTC at both boundaries of each synchronous frame, hides all owned entities when invalidated, and caches only display endpoint conversions locally within that frame. One satellite with several ground links causes one native read per frame. Current accepted fabric owner status, pending/error/review fields and exact receipt/route identity must all agree before quality or route emphasis can display. Missing or failed fabric information preserves only native geometric visible/fault states. No alternate Viewer, clock, propagator or current state store was added.

Expanded focused command adds `project_support/tests/browser/native_network_scene.test.mjs` to the earlier command. **22 passed, 0 failed**, including source station/link styling and placement, owned-resource cleanup, fabric failure/conflict/pending fences, epoch drift, stale coverage toggles, malformed station coordinates, ITRF/GCRF/time-model/definition/hash/native-row guards and frame-local endpoint reuse with reentrant owner invalidation. Ground controls and parent scene port are tested in both fixture resolutions. Actual shared-Viewer browser evidence remains the parent's verification step.

## Remaining future-pass presentation: existing endpoint reuse audit

Readonly code inspection found an existing compact path: `createMissionServices` internal `requestWindows` -> native mission context approval -> `/api/nodes/mission-windows` -> `MissionWindowQuery` -> `NativeMissionPasses`. The service currently exposes no public `prepareNative` or window-only query method. Exposing one explicit readonly `queryContactWindows({hours:3,signal})` over that existing function avoids a new endpoint/ABI, propagation implementation and large sample-grid transfer.

It must capture the complete accepted deployed roster, enabled stations, stopped shared display UTC, current faults/deployment revision and current module instance. All stations must be sent because HTTP approval compares the complete station/site list; the selected station is filtered only for presentation. Query conditions use target/external=null and a canonical UTC horizon. Return raw `contact_reports` after scope/hash/conditions/metadata/coverage/row validation. Do not project through `WindowRecords.contacts`: that OR-01 RF projection intentionally drops nodes without matching radio bands, whereas the original geometric pass table includes all nodes. No mission-store draft, scheduler plan or commit is needed.

Source `NativeMissionPasses` already preserves original contact coarse30s, peak bracket0.1s and boundary bracket1s with explicit short-interval sampling warning. Eclipse scan is the separate60s calculation. The table can expose original satellite/AOS/LOS/maximum elevation/duration plus in-progress/truncated flags. Existing service prerequisites should be explained as accepted deployment, stopped UTC and module-status checks rather than silently sending unguarded requests. UI generation/AbortController must fence late results after source roster/station/clock changes. This is an implementation recommendation from current code inspection, not implemented future-pass UI or new validation evidence.

## Future-pass implementation (supersedes recommendation-only status above)

Implemented the recommended existing-endpoint path. `mission_services.js` now exposes `queryContactWindows({hours:3,signal})` and `verifyContactWindows(receipt)`. It refreshes module status, captures existing context, calls original native approval plus mission-windows, and validates complete accepted deployment/nodes/stations/faults/UTC/module instance/definition hashes, null target/external conditions, original source contact metadata and every returned pass. Returned `display_context` is a detached physical-scope receipt, not another current-state owner. Property order is normalized for scope comparison; module sequence and local mission list remain approval/scheduling metadata excluded by the existing physical guard. This does update the existing runtime's approval evidence via the original endpoint; it creates no mission draft, scheduler plan or commit. No wire schema, HTTP endpoint or Rust ABI changed.

`ground_network.js` uses an optional `contactWindows:{query,verify}` port. Query is explicit, fixed to the original three-hour UI horizon, independently of fabric submission/network calculation. All enabled sites are queried under the original approval guard and the selected site filters raw geometry only; nodes without RF radios remain visible in geometric passes. Rows expose original AOS/LOS/maximum elevation/duration plus in-progress/truncated flags, sorted by AOS with fifty-row pagination. Current UTC/whole-roster/sampling scope and actual-RF-unknown distinction are explicit. Before a query, on failure/cancellation/source edits/page exit, and after verification failure, previous results are removed; abort/generation guards prevent late responses from resurrecting them.

Focused command includes `ground_contact_windows`, `mission_services`, `ground_network_details`, `ground_fabric_presentation`, `ground_network_panel`, `mission_request`, `mission_execution`, `mission_window_records` browser test files. **69 passed, zero failed**. New tests were RED for missing query method and missing UI action before implementation. Native fixture validates exact source30s/0.1s/1s coverage, no plan/store mutation, late fault/cancellation/malformed sampling rejection, module sequence-only geometry retention and module instance invalidation. A separate regression plans with native context hash1, performs a readonly window query approving hash2, then commits the original plan with hash1, preserving its store record and inspection evidence. Both fixture resolutions test explicit query, selected-site filtering, UTC/context invalidation, cancel and page-exit late response fences. Native numeric algorithm itself is unchanged.

Root assembly must inject the above port and call ground panel update on existing input/module observer changes. Actual three-hour query/browser rendering evidence remains the parent's verification step.
