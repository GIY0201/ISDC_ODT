# Native mission-window stamp formatting latency

## Measured evidence

Read-only inspection found that pass elevation caches are station-specific and rebuilt for every node/site. `MissionWindowQuery` calls passes per station, then eclipses/access. The same exact node-definition/UTC state is often propagated repeatedly, but station-specific elevation/peak/boundary decisions cannot be shared as if identical.

A 40-node/3-site representative360s query on installed native0.3.0 under cProfile took7.155s:3642nativecalls/5607rows,2832unique definition+UTC rows,2775duplicates. `native_passes.stamp`5561calls consumed2.60s cumulative; native adapter1.85s. Most work was source peak refinement247brackets, whose semantics remain required. A readonly in-memory stamp-only prototype produced the exact whole report hash and all native call/row counts, reducing unprofiled4.279s to2.852s in that representative run.

The actual captured PoC request was extracted from first `/api/nodes/mission-windows` record in ignored `data/workspace/validation/t081_actual_20261007_023348.json`:40nodes,3sites, original3h horizon, no target/external. Profiling used its first360s explicitly, not the full3h/24h horizon. Native0.3.0 and original definitions/sites/startUTC remain. Exact result SHA-256 across baseline/prototype/product: `42206cbac6a9e0b4a2aab4abc12843e02631cf96577ca2fd2242da683eea1132`. All3701nativecalls/5667rows,9contacts,18eclipses remain. There are2273unique definition+UTC rows and3394duplicates (59.9%), still computed because this change does not cache native states.

Initial actual-request baseline4.669s → in-memory prototype3.516s; product3.875s. A final reproducible paired readonly uncached variant vs product comparison gave5.061s →3.327s (34.3% less time) with exact same report and native counts. Native adapter timing varied, so these single-run observations are not latency guarantees or estimates for full3h/24h. Query executor in this tool is an isolated immediate executor; it does not benchmark live HTTP/background-lane contention.

## Product change authorized by root

Only `user_application/native_passes.py` and `user_application/mission_windows.py` changed: capture `first.as_time()` once and put `@lru_cache(maxsize=8192)` on each existing nested canonical `stamp` formatter. Cache contains only pure offset→UTC strings, is invocation-local and bounded, and is discarded after the call. Exact captured endpoints/nanoseconds/leap behavior remain. Source30scoarse grid,0.1speak bracket,1sboundary bracket, native propagation, required receipt validation, hashes/frames/profiles, errors and final reports are unchanged. Native row cache/query vectorization was not implemented.

## Verification and reproducibility

Pre-change fixture `project_support/tests/fixtures/mission_stamp_precision_golden.json` captures whole precise-endpoint reports and every node/UTC request. Regression tests compare both byte-equivalent JSON structures, verify repeated-node formatting reuse without skipping native requests, sequential-scope endpoint isolation and actual unsupported native leap sample rejection. The reuse requirement was RED before product edits.

`pytest test_mission_stamp_memo.py test_native_mission_passes.py test_native_mission_windows.py test_mission_window_batch.py`:47passed, one existing warning,2.41s. Existing source peak/grazing/crossing/clipped/access/eclipse/provenance/error/HTTP-state tests stay included.

Tool: `project_support/tooling/profile_mission_windows.py INPUT OUTPUT --seconds360 --no-profile`; `--uncached-baseline` compiles a formatter-only baseline variant in memory without modifying product files; `--stamp-memo` was used for the pre-product prototype. Target/external inputs are rejected explicitly rather than silently omitted. The tool never accesses/restarts the live server. Timing/counters/cProfile receipts are ignored under `data/workspace/validation/mission_profile_*`.

No server/port/browser/Git operations, native/wheel/ABI changes or user runtime changes were performed. Root performs broader suites and production deployment. Further exact native point reuse requires a separately reviewed request-local provenance adapter and remains deferred.
