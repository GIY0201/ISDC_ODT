# T147 source-native track buffer (partial)

Original reference HEAD rechecked: 1a1e00297a0301637455b0ef2cf48b2e74576b07. NodeScene periodMinutes/rebuildPaths uses the catalog period, 120 intervals/121 vertices, Date TimeClip per timestamp, whole-path clearing after a missing vertex, and absolute 30000ms display-time refresh. This change implements the readonly response decoder, not its refresh scheduler or renderer.

createNodeTrackBuffer receives a captured request, native-query response, injected original static period resolver and optional previously bound hashes. It requires exact metadata/request/order/full definitions/hash format/known hashes/period/grid/121 rows/aggregate status/path visibility. It copies native metre vectors without orbital propagation or frame conversion. Failed vertices retain aligned UTC/error codes and hide the entire path; no shortened path or substitute circle. Returned values and definitions are defensive copies. Changed definitions return null. The calendar helper is explicit request conversion, not a wall clock or display owner; fractional milliseconds survive until each relative timestamp is truncated. Leap centers remain unsupported_node_time.

Evidence:

- Missing export RED before product changes.
- Five initial targeted JS tests pass, including fractional-period submillisecond TimeClip mismatch against premature Date.parse clipping; expanded tests cover all240 nodes, prototype-name ID, limits, all121 failures and invalid nonnull error geometry.
- Python target33PASS0.81s: real NodeGeometryQuery, Gregorian grid and actual JS decoder/source catalogElements roundtrip for three different source periods. Native rows are injected; this proves cross-language contract consistency, not a freshly executed Rust/native HTTP/GPU chain.
- Final Node485PASS0FAIL0skip2832.0123ms. Log data/workspace/validation/ground_stations/t147_track_node.log.
- Full Python546PASS8existingwarnings149.55s; session15231 terminal exit0. Explicit0.3.0 wheel and fresh short basetemp/cache. Log data/workspace/validation/ground_stations/t147_track_pytest.log.
- JS syntax and git diff whitespace checks pass.

Remaining: T147 shared display coordinator/prefetch/cancel/sample-versus-track ownership and source30second refresh; T148 renderer/T079 activation/T149–153 actual mount/deployment/two-resolution/performance/Draft. Existing epoch validation still uses the sample definition validator and its UTC table scope; any broadened historical epoch compatibility needs its own regression and contract review. T075–84/Terra/all50/N001/N003/T137auth/T032/equipment/RF/HIL/download/AeroDT remain open. No current8891 server/native installation/browser/remote PR/merge changes. No game performance or real-equipment acceptance claim.
