# T147 atomic sample request assembly — partial gate

2026-10-06. T147 and fullT075–T084 remain incomplete.

## Implementation

createNodeTimeline captures explicitly supplied draft definitions and canonical shared-owner UTC; it never owns a clock, timer, camera, storage or deployment. Full601sample queries use sequential83/83/74node native chunks for240nodes, each under50000rows. Unique request IDs carry generation/sequence even for a constant injected ID prefix. Actual request payload is copied before transport; response request/node/hash/grid/frame/time checks reuse the existing sample buffer. Known same-definition hashes are pinned across refresh; changing scope invalidates the previous generation.

All candidates stay private until every chunk validates and cooperative buffer construction finishes. Only then are buffers/hashes/startUTC swapped once. A second-chunk failure leaves no first-chunk candidate visible; malformed/failed refresh clears the node layer. Background refresh may retain the previous complete matching-definition buffer until the new entire buffer commits; same-start pending background calls deduplicate. Explicit seeks cancel the old task and hide its old buffer immediately, including reverse seeks. Clear/scope change/destroy abort the concrete transport and executor signal; generation guards also reject a transport that ignores cancellation. Identical definitions do not cancel a live query. Callback errors cannot turn a completed receipt into failure or send additional commands.

createNodeSampleBufferAsync reuses the same validating generator as the synchronous constructor, with an injected cooperative executor after each complete node. Async request definitions are captured; API response is an owned decoded transport receipt, consumed without an extra whole-response clone. Rows/definitions become readonly copies during each node's construction. The actual API returns response JSON without retaining a shared result cache. This execution boundary permits browser task/frame scheduling later; tests use an immediate async executor and prove240yield calls, not actual render opportunities or p95 budgets. Native-query response JSON decode/serialization/request size and main-thread cost still need actual measurements.

Readonly geometryFor/snapshot never send requests or move the display clock. A validated partial/error native receipt can be accepted as aligned data; exact failed rows remain failed geometry, not invented valid positions. Request orchestration success is not a server deployment receipt.

## Validation

- Missing createNodeTimeline export RED before edits.
- First8targetPASS1100.4167ms. Full240×601 pipeline uses3requests, holds third response to prove no partial visibility, retains lastnode/lastsample, invokes executor240times.
- Additional second-chunk failure/reverse seek/observer tests yield final target11PASS1546.0412ms.
- Final full Node478PASS0FAIL0skip2681.996ms. Existing original/state/buffer/GP/playback/UI regressions included. Log:data/workspace/validation/ground_stations/t147_node_requests_node.log.
- Full Python545PASS8existingwarnings149.83s, session12194 terminal exit0, explicit0.3.0 wheel/fresh short basetemp/unique cache. Log:data/workspace/validation/ground_stations/t147_node_requests_pytest.log. Python product unchanged; later JS-only tests/helper consolidation covered by final full Node.
- Syntax and staged diff whitespace check before commit; existing checklist8/8 and prerequisite/hook absence retained. No server install/restart/browser mount/remote publication.

## Remaining

T147 shared-display scheduling/prefetch and original121point Date TimeClip paths/30second absolute UTC refresh and actual transport integration remain. No per-frame HTTP may be introduced by the future display coordinator. Real scheduler/render opportunities and response/serialization/interpolation/frame budgets must be measured; mock full pipeline roughly1second is not game/UTC/frame PASS. T148 original renderer, T079 actual module activation, T149–T153 live mounting/two-resolution/acceptance/Draft review remain. N001/N003/T075–84/Terra/all50/T137auth/T032/equipment/RF/HIL/download/AeroDT stay open. Current8891/native/browser/remotePR/merge unchanged.
