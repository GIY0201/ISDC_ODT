# T151 application composition: server portion

## Implemented

The real `create_app` mounts the existing strict node sample/track routes and source deployment GET/POST routes. The default native node query shares the existing bounded orbit executor, including its queue limits and lifespan closure. It creates no second pool, propagator, clock or independent deployment owner.

Each application has its own source `ScopedDataManagement` isolated-v1 embedded simulation module and delivery bridge. Startup and readonly GET do not activate scopes or backfill products. Explicit commands use the original runtime lock, candidate activation, idempotent receipt, revision conflicts and rollback. Injected capabilities are used as supplied. No original-source model equation or policy is changed.

## Component evidence

- Four new application tests initially failed because the composition API/routes were missing (RED). After assembly, node application/HTTP/deployment targets: 48 PASS, 1 import deprecation warning, 1.88 s.
- Exact original OpenAPI baseline remains unchanged after excluding precisely the three approved new paths and five new schemas. Compatibility/application/architecture target: 8 PASS, 1 import deprecation warning, 3.84 s. The first full run found the absent OpenAPI addition allowlist: 648 PASS, 1 FAIL, 8 existing warnings, 162.29 s. Its failed log is preserved; product behavior and original baseline were not weakened.
- Isolated 0.3.0 wheel/native installation target: 3 PASS, 1 import deprecation warning, 8.83 s. Actual Rust bytes from three historical instants pass through the real default application routes and its shared executor, native adapter/query, JS serialized owner and optical producer/verifier. This uses ASGI transport and restricted actual-output native IPC forwarding, not a live8891 process or network/GPU proof.
- Receipt: `data/workspace/validation/install/b32d1c3296d747a082a7ec7139f60763/isolated_call.json`; native_application_requests=3, native_rows=60, maxNumericError=5.4569682106375694e-12, maxTimeErrorMs=0, verified_snapshot=true. No runtime/deployment change from geometry requests; no startup/GET scope activation.
- Final full Python: 649 PASS, 8 existing warnings, 176.45 s (session74585 exit0). Final receipt: `data/workspace/validation/install/9690d8cd11a04dd0aafb47f0c4cf5e0b/isolated_call.json`, three real application requests and the same native/source numeric/time results. Wheel SHA256 remains d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97; original installed native remains0.2.0.
- Full Node: 615 PASS, 3900.9173 ms. Logs are under `data/workspace/validation/ground_stations/t151_node_application_*.log`.
- Second full Python run: 648 PASS, 1 FAIL, 8 existing warnings, 179.45 s. The original catalog-scene readonly test compared an actively running SIM before/after a 103-satellite query; normal 200ms background progress changed elapsed_seconds from124.5 to124.703 and sequence0 to1. A separate unchanged probe passed. Repair the test by explicitly pausing SIM before taking its baseline and preserve exact whole-state comparison. Product runtime/clock/query equations remain unchanged. Catalog-scene/application/OpenAPI repair target: 19 PASS, 1 import deprecation warning, 18.15 s. Preserve both failed full logs and the probe.

## Remaining

T151 remains unchecked: actual node panel/store/timeline/NodeScene/model/deployment-client/scene-composer snapshot assembly, one-Viewer preservation and controlled native installation/owned8891 restart still remain. Capture and restore stored GP/observer/UTC plus SIM-memory impact before that restart. Preserve the original root checkout and its installed native 0.2.0. T152 actual two-resolution/browser/performance matrix and T153 review remain required. This server portion does not close T076/T077/T079 or the whole T075–T084 goal.

Readonly live preflight found owned ISDC python PID37724 listening on0.0.0.0:8891, healthok, active SIM RUN-C65FEF01B577 and playing stored ISS revision2. This observation is not the restart-time capture/restore evidence. No restart, wheel installation, display change or server command was performed.

Branch policy: continue the existing `codex/satellite-node-integration` branch; incremental changes and validation use commits on that branch. Create a new branch for a distinct reviewable feature only when needed. No branch deletion or automatic merge was performed. Local refs alone do not establish current GitHub PR/merge status.
