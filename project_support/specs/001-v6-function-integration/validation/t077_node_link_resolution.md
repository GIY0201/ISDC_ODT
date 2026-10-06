# T077 original node link resolution component

The full original `nodes/links.js` resolver function body is retained. Only its concrete static imports/exports are adapted to `createNodeLinkResolver({library,oisl})`, with required source-faithful dependencies injected by application assembly. Existing pure helpers remain exported. No DOM, transport, clock, runtime state or private history owner is added.

## Source and execution evidence

Pinned source commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`. Original resolver byte SHA256 `83a119b3aa9a129076db7bbf755946bd0582824e17d10b1966f1576b6d923cd5`. Hash-pinned original dynamics/library/optical modules are executed with the original resolver by `capture_original_node_link_resolution.mjs` in an offline VM. Dynamics exists only in the source evidence runner, never in production imports.

Two final executions produce identical gzip476646bytes/SHA256 `9324208901708676cd8710b49fc56aebad1e03588dcd3b4e52aa60fbac7d7ee6`. Uncompressed8107723bytes/SHA256 `7138afa16224bfaf93f319285e644957d72e719813d71428ad74520697cf54a7`. Only the bounded compressed fixture is committed. Fixture18scenarios/59instants includes complete terminal/spec/geometry/acquisition/rate/margin/pair/history results, copied original node definitions and source epoch/timed states. Dense two-plane20-node grid samples12points over96minutes, each primed at -120/-60seconds. Other cases cover same-plane dwell/target continuity/rewind, explicit Earth obstruction/stale target/missing owner or target, safe/standby, mini/long-range terminals, disabled/empty input and preferred-plane-infeasible fallback.

Initial missing-module RED failed before product creation. Focused21PASS343.9717ms: every complete serialized result equals actual source execution; product history is carried across every original trace and previous history/input remains unchanged. Additional direct acquisition/locking/continuity/reversal and helper/dependency checks passed. Entire original resolver function body independently compared with the product text: unchanged. Gzip/JSON comparison matches source JSON negative-zero representation without changing equations.

## Integration prerequisite N004

Original `communication/network_twin.js` owns and primes histories using actual states at current analysis time minus120 and60seconds, then advances current-time links once per input instant. Current native display coordinator keeps one601-row forward or reverse sample window and does not supply those preceding instants on first forward startup. Full-definition scoped native priming delivery must therefore be composed through the current serial query owner before a production verified link snapshot is accepted. Do not invent previous geometry, use current orientation at past times, silently reduce future sampling or claim startup tracking from a test verifier. Repeated same-time/definition ticks, removed/edited definitions, backwards seek, cancellation, missing samples, leap/unsupported times and stale snapshots need explicit production-owner regression tests. No new propagation or clock is justified.

This resolver component proves original source selection/acquisition fidelity; it does not close the verified native producer, T148 or complete network/fabric/ground T077. Actual8891/native0.2.0/browser unchanged. FullT075–84/T076/T079/Terra/all50/T032/real equipment/HIL/download/PR review remain.

## Full verification

Node591PASS3125.7256ms. FullPython645PASS8existingERFAwarnings164.45s(session94379exit0), using fresh unique absolute cache/basetemp. Isolated0.3.0wheel/architecture/static-path regressions pass; actual installed0.2.0 unchanged. Node syntax and Git whitespace checks passed. No real optical connection, live native priming, actual browser/GPU or external fabric acceptance claimed.
