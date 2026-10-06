# T075 source catalog display policy migration

Source: readonly ISDC-ODT pinned commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`.

## Reused behavior

- `orbit/catalog.js` is byte-identical to the source. SHA-256: `90f98da034d2e6f8f44c35dc1c980828f177f23af6a8f435b18a9545ecbe4007`.
- Original name/NORAD/orbit/epoch-age sorting, ascending/descending, numeric ID tie break and unknown epoch placement use the original pure function.
- Original browser favorite key `spacetwin-orbit-favorites-v1`, original string ID parsing, explicit selected satellite toggle and storage-failure session fallback are preserved.
- V6 exposes these controls on the catalog panel. Favorites and sort alter list presentation; they do not replace the selected native GP owner or change the existing scene/UTC input.
- The scene panel requests/read backs label visibility through root's existing globe owner, using `setLabelsVisible` and `labelsVisible` hooks. It owns no second renderer or label state. The shared root renderer implementation hides GP/catalog names while preserving station/node names; bulk catalog name limits remain explicit.

## Complete-collection boundary

Default server paging remains 100 rows. Explicit whole-result sorting/favorite filtering obtains existing `/api/satellites` `limit=0,offset=0`; source/group/IDs/counts are checked, and complete count must equal `filtered_total` with `truncated=false`. Partial or malformed responses cannot become global-sort evidence. The complete collection is readonly query data; local presentation pages are 100 rows. A new query/group/orbit invalidates that collection. Late requests are generation fenced. The full collection is bounded to 50,000 entries; a larger response is explicitly rejected.

## Validation

`node --test project_support/tests/browser/catalog_workspace.test.mjs project_support/tests/browser/catalog_source_policy.test.mjs project_support/tests/browser/workspace_catalog_source_policy.test.mjs project_support/tests/browser/workspace_catalog.test.mjs`

16 tests passed (6 existing controller, 7 policy/source-integrity, 3 actual workspace assembly). Meaningful cases: sorting across a 205-row page boundary, off-page favorites, explicit original-key persistence, partial complete-response rejection, changed scope and stale response fencing, unknown epoch ordering and source hash, UI favorite/sort wiring, shared label visibility persistence across minimize/restore, unchanged saved orbit state and one Viewer.

This is isolated controller/actual workspace assembly validation with HTTP/Cesium adapters. It is not a live CelesTrak query or actual satellite/communications validation. No server/browser/Git operations or live deployment changes were performed by this agent. Root performs actual browser and full-suite validation separately.

Latest concurrent-edit check: controller/source-integrity 13 passed. The assembly files were temporarily blocked at import time because another integration edit added `digital_twin/visualization/network_diagram.js` to shared `workspace_fixture.mjs` before that dependency existed. The 3 assembly cases passed on the immediately preceding integration state; root was notified to finish that dependency and rerun, so the latest full combined run is not represented as a clean pass.

## Native station card / GP inspector completion

The original `stationCardModel` remains the display policy. New `station_card_projection.js` reads the existing Rust catalog timeline and visibility-query owners; it does not propagate or own a clock. The selected station card displays selected body, native azimuth/elevation/range, minimum-angle geometry state, explicit next-window result and observation UTC. Selection/hash/observer point/mask/UTC mismatch hides those values. Null selection/display/pass states are explicitly guarded. A missing or partial/error pass result remains unknown; only the validated same-scope `none` result says the queried 24 h has no interval. Station query button invokes the existing pass owner, with no automatic extra query or station change.

`inspector_policy.js` adapts original inspector GP elements and source formatting through the byte-identical catalog policy. Added RAAN, argument of pericenter, mean anomaly, mean motion, semimajor axis/shape eligibility, analysis UTC/epoch age and readonly native ITRF position. Native catalog wire responses currently do not supply geodetic position or TEME speed; the UI explicitly says unavailable and does not fabricate those original inspector fields. Completing those fields requires a Rust response-contract extension, reported to root.

Focused command: `node --test project_support/tests/browser/station_catalog_projection.test.mjs project_support/tests/browser/workspace_station_catalog_detail.test.mjs project_support/tests/browser/catalog_time_assembly.test.mjs project_support/tests/browser/station_assembly.test.mjs project_support/tests/browser/catalog_source_policy.test.mjs project_support/tests/browser/workspace_catalog_source_policy.test.mjs`

Latest result: 18 passed. The previous shared fixture missing-dependency issue is resolved. Actual assembly covers native calculate then explicit pass query, selected station switching without reusing a different point's look, GP detail rendering, single Viewer and unchanged stored orbit state. Null selection teardown regression was reproduced before product fix and passed afterwards. Root owns actual observation-line renderer and global validation.
