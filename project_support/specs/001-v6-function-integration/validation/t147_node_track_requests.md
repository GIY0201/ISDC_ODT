# T147 source track request lifecycle (partial)

createNodeTrackTimeline accepts the existing display UTC, explicit definitions and injected native API/static source period/request IDs/cooperative executor. It has a separate request generation from the existing601-sample timeline. There is no private clock, interval, playback owner, HTTP in readonly lookup, renderer, deployment command or new source dynamics.

refresh compares absolute Gregorian display-time distance with the last successful center and rebuilds at30000ms, in either direction. Subthreshold frames do not request. Automatic updates coalesce an active request even if fast playback has advanced beyond30seconds, preventing repeated abort/restart starvation; the next owner update after completion evaluates the latest UTC. Explicit calculate handles deliberate seeks/retries and cancels prior requests. Input changes/clear/dispose invalidate definitions and concrete abort signals; generation checks reject transports ignoring abort. Same definitions preserve pending work.

Track receipts require the existing validator, previous track hash and separately supplied sample hash to agree. Source full definitions and all121 vertices per node are captured; all240 nodes fit one29040row request. Async construction shares the synchronous decoder generator and yields after each node. No candidate is published before all nodes validate and cooperative work finishes. Failed latest requests clear paths and latch an error; automatic refresh stays stopped until explicit retry or scope reset. A valid aligned native error receipt still retains its source errors/whole-path invisibility.

Validation:

- Missingexport RED before product implementation.
- Initial lifecycle6PASS plus full240node/240yield atomic publication, disposal during cooperative work and observer/transport ownership cases: target9PASS331.7866ms.
- Fast playback regression9PASS1FAIL (second automatic native request created instead of coalescing); repaired pending deduplication.
- Final fullNode495PASS0FAIL0skip2835.6891ms. Log data/workspace/validation/ground_stations/t147_track_requests_node.log.
- Full Python546PASS8existingwarnings153.70s; session91714 terminal exit0, explicit0.3.0 wheel/fresh short basetemp/cache. Log data/workspace/validation/ground_stations/t147_track_requests_pytest.log. Python product unchanged; later JS-only coalescing repair covered by final full Node.
- Syntax/diff whitespace checked before commit. Existing feature/prerequisites/requirements8of8/nohooks retained.

This is request/component evidence. Immediate Promise executors prove yield calls, not real browser frame opportunities. T147 still needs the application coordinator that serializes native sample/track work and performs forward/reverse sample prefetch with shared UTC; composition must not retry errors every frame or revive cancelled scopes. Actual JSON/transport/frame costs and source-render acceptance remain T148/T151/T152/T032. T079 actual activation/T149–153/N001/N003/T075–84/Terra/all50/T137auth/equipment/RF/HIL/download/AeroDT remain. No runtime installation/server8891 restart/browser/remote PR/merge changes. No whole-goal completion claim.
