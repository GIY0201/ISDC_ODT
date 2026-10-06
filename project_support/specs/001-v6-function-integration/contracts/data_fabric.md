# ICD-02 module state and source model

DataFabricExchange.update(snapshot), route(source,target,objective), status() delegate to the original DataFabricStandIn. Only update mutates module memory. JSON messages use UTC time, satellite/ground nodes and oisl/ground/terrestrial links; rate Mbps, storage GB/MB, range km, delay ms and engineering quality retain original units. This is a simulated data fabric, not real RF measurements, packet transfer or validated hardware.

Original link_metrics, routing and bundles are pure simulation modules. Original stand_in owns last network, routing graph, DTN backlog, sequence and cumulative delivery/drop counters. No twin runtime, display clock, renderer or network transport is created. The source 3600-second step clamp and backward-time backlog reset are unchanged. Same-time updates advance source sequence with zero elapsed DTN step.

Exchange serializes update/route/status with one lock. Update deep-copies caller input, requires finite JSON, computes on a private candidate and publishes it only after complete successful finite report creation. Failure retains the entire last accepted module state. Returned reports/status/routes are independent copies. Simultaneous requests cannot interleave source graph/backlog/sequence updates. There is no persistent history or request-ID idempotency yet.

Source commit and original/normalized port hashes: project_support/tests/fixtures/original_data_fabric_source.json. Only three import locations change in stand_in; all source equations and algorithm bodies are preserved. Original tests cover RF/OISL/fibre quality, objective-specific paths, ground reachability, disconnected DTN storage, drain, backward time and malformed input.

HTTP source schemas/adapters, per-app composition, browser exchange/receipt freshness, explicit activation, remote timeout/status semantics and actual V6 routes/DTN rendering remain required T077 work. Do not use this internal module completion as full communication acceptance. The existing UI network result still discloses fabric unconnected.
