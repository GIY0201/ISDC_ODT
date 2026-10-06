# Existing-owner exact native point reuse

Read-only audit found that `requestCommunicationStates()` already sends a full
roster count=1 request for an exact miss, not 601 rows. However,
`prepareSimUtc()` previously awaited the display sample/track queue first. Each
count=1 fallback was discarded, so preparation, optical and network consumers
could request the same definition/UTC again. Original optical prime history
still needs its distinct -120/-60/current source timestamps.

Actual captured HTTP receipt `t081_actual_20261007_030808.json` reports:

| Request | Roster | Count | HTTP seconds |
| --- | --- | --- | --- |
| native samples | 40 | 601 | 1.149 and 1.086 |
| native exact samples | 40 | 1 | 0.013–0.047 |
| native tracks | 40 | source track grid | 0.229 and 0.257 |

These are HTTP receipt timings, excluding browser decode, cooperative validation,
scene rendering and asynchronous scheduling. The buffer validator yields once
per node; current workspace executor uses setTimeout(0). Browser timer delays
are a plausible additional cost requiring root's actual browser measurements.
Disk globe changes and the active browser's cached modules can differ; do not
attribute current live behavior solely from newly edited disk code.

Product change in `nodes/node_timeline.js`: eight invocation-owner native point
receipts, keyed by exact canonical UTC and tagged by full definition identity and
communication generation. Existing serial jobs coalesce through the receipt
after the first accepted validation. A true miss still performs native count=1
and all existing metadata/hash/time/vector/basis validation. No interpolation,
native implementation replacement, new propagator, current-state owner or clock.

Definitions/clear/retry/destroy clear every entry. Caller aborts and late responses
cannot cache a receipt. Cache results and each returned value are separate copies.
Current sample hash bindings constrain cache hits; conflict fails closed.

Six added regressions cover 40-node concurrent/repeated point use (one actual
native query rather than three), exact fractional/nanosecond separation, eight
entry bound and invalidations, malformed replies, independent caller cancellation
and newly conflicting native display hashes. Existing ignored-abort serial lane
tests and original resolver golden remain unchanged and passing.

Validation: node --test node_communication_requests.test.mjs,
node_display_timeline.test.mjs, node_network_timeline.test.mjs,
node_optical_timeline.test.mjs (under project_support/tests/browser): 59 passed.

The scenario peer separately changes exact-request priority/nonblocking display
preparation in workspace_nodes; root owns final preserved-state reload and real
gameplay timing. This report proves reduced duplicate point requests and preserved
contracts, not a measured end-to-end live speedup.

## Follow-up: bounded point validation

Root's live resource timing observed a 23.7 ms native point HTTP response followed
by roughly 124.2 s before orchestration status; this establishes a client-side gap,
not its specific cause. No cyclic optical/query await was found in the code audit.
Native-point validation previously awaited one timer task for each node.

`createNodeSampleBufferAsync` now runs the same generator atomically for at most
240 total native rows, with abort checks before/after each iteration and before
return. Full 601-row display grids still yield per node. No numerical validation
or source metadata checks are omitted. Controlled blocked-executor tests were red
before the change and now show 40-row point validation and the original dense
optical historical prime queue can finish without per-node timer waits. The
original JSON golden pairs remain identical; NaN rows and pre-aborted signals
still fail. Existing large-grid cancellation remains passing.

Focused query/display/network/optical/request validation initially: 72 passed.
Root must remeasure live setup/play before attributing the observed delay to timers.

## Follow-up: exact work during large-grid validation

Measured actual captured 40x601 response validation locally: 245.5 ms total CPU,
40 cooperative chunks, typical 4.3–8.9 ms per node and one 20.5 ms cold chunk.
Four-node batching would spend roughly 20 ms continuously, so large-grid CPU
chunks remain unchanged. Receipt extracted to native_validator_40_input.json
under ignored runtime validation artifacts; this is not a new scientific fixture.

A controlled regression proved an exact request could otherwise remain blocked
behind a display response that had already returned from HTTP but whose validator
was waiting on its cooperative executor. The existing display timeline now has a
wakeable cooperative yield: it drains exact requests only at the validation
boundary after display HTTP completes. An uncommitted display candidate stays
private, and generation/abort guards remain in both producers. No native HTTP
requests overlap; an ignored-abort in-flight exact request holds the serial lane
until its concrete response ends. Existing per-node display yielding remains.

The blocked-validation priority test was red before the change and green after.
An additional clear-during-priority ignored-abort regression proves both candidates
are discarded and maximum simultaneous native HTTP requests stays one.
Focused query/display/network/optical/request validation now: 74 passed.
This establishes queue progress under the controlled delay, not the definitive
cause or measured improvement of the live 124-second browser gap.
