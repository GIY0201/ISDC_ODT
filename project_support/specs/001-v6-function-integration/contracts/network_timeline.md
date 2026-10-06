# T077 verified native network input producer

`createNodeNetworkTimeline` joins the existing exact native point query, sole optical-history owner and pure source network model. Application injects readNodes/readDisplay/readStations/readFaults, node/station validators, canonical UTC codec and onChange. Construction and snapshot are readonly; update is explicit. No timer, propagation, fabric exchange, alternate history/clock/Viewer or default station fallback.

Validate complete finite copied inputs, <=240 source node definitions, <=24 enabled station definitions, unique nonempty IDs without node/station collisions, station schema/bands/ranges, and canonical supported non-leap UTC. All roster/definition/config/fault changes form the request generation identity. Valid source node rows must match every definition, nodeID, UTC, source metadata, hash and native axes/finite geodetic range. Optical snapshot must be valid, exactly match complete nodes/UTC and pass its existing every-field verifier. Native hashes must match the optical producer's accepted hashes. Missing, duplicate, invalid, stale or partial rows fail the entire result, rather than omitting a node and claiming complete success.

After optical update, request current native states through the existing serial owner; no manual history priming or orbital calculation. Same-context callers share pending/accepted work. Seek/edit/config changes, clear and dispose abort/fence only this consumer's native request; never reset/destroy the shared optical/display owner. Revalidate inputs and optical proof before atomic publication and every subsequent snapshot/verify. Values and wire records are copies. Observer errors cannot change accepted proof. Error clears the result; retry is explicit, no automatic exchange or command. Finite empty network/station sets are valid analysis inputs and retain original pure-model semantics.

The envelope carries original native source provenance, canonical UTC, full definitions/stations/faults/hashes and source `{time,nodes,links}` message. It proves model-input alignment, not an operational link or data-fabric acknowledgement. Fabric send/route/status later consumes verified current envelope and must own its explicit external request, response correlation and remote failure policy. Actual workspace/ground-store/fabric/UI/8891 and cross-window acceptance remain T077 requirements.

## Pending sampled-visual boundary; current contract retained

[ADR0047](../../../docs/adr/0047_sampled_analysis_visual_boundary.md) plans source1000ms analytical cadence separately from RAF endpoint rendering. The existing producer's exact-current update/snapshot/verify and no independent timer/history/clock rules above remain binding. Composition may own a lifecycle wall scheduler reading the existing display owner; captured sampled queries require a distinct analytical lease rather than weakening current final UTC checks. Network source inputs must be complete exact native/optical states at the captured analysis UTC, including fresh full stations/faults and final node/source/run/discontinuity checks.

Retained analysis is available only as a privately registered immutable visual
projection with unchanged analysis UTC, display UTC, age/source and incomplete
current status. It cannot pass verifySnapshot or authorize fabric/mission/data
commands. There remains one optical history owner and one active analytical
calculation plus one latest pending display intent; no per-RAF optical/native
queries, duplicate history or unbounded queue. Existing full current actions and
ground renderer receipt guards are unchanged; sampled ground/network rendering
requires its own declared visual port. **Design only; no implementation or
acceptance is claimed.** Whole T077 and original accuracy/performance gates remain.

Sampled continuity is the existing clock/source owner's opaque capability,
rotated at explicit same-UTC seek/pause/play/rate/config/failure command entry.
A separately declared optional binding/read/notification bridge covers notify-only
commands; plain display callbacks or catalog generation numbers cannot prove
continuity. Re-read the owner capability around awaits and visual publication;
no capability means no past-result reuse, with the existing exact path retained.

## N016 sampled network owner and visual consumers

Implement the scoped decision in
[ADR0048](../../../docs/adr/0048_sampled_network_visual_projection.md) inside the
existing owner. Optional complete readContinuity/verifyContinuity pair; new
updateSampled/sampledPresentation/verifySampledPresentation/cancelSampled keep one
active analytical task/latest record and unchanged exact public checks. The actual
readonly getter is sampledPresentation.
Capture network analysis UTC from a fresh registered, verified optical sampled
view; obtain full native states at that same UTC through existing serial owner.
Reverify fresh current optical views with identical captured analysis content,
complete nodes/stations/faults/native hashes/source/run/configuration and opaque
lease around awaits and callbacks. No additional optical history advancement.
Immutable registered NETWORK_SAMPLED_UI_V1 retains utc=analysis_utc and adds current
UTC/age/availability. Sample-origin sameUTC approval requires still-current opaque
owner authority; copying marker/value or revoking permit never promotes an exact
receipt. Exact actions preempt/sampledrain and remain exact-current.

NativeNetworkScene optional sampledNetwork read/verify ports and readonly ground
panel ports use that separate authority; sampled outputs never go through existing
setSnapshot/verifySnapshot/fabric actions. Scene uses current native endpoints,
complete hashes, final proof after external getters, actual Viewer ownership and
morph/toggle/disposal guards. Diagram/table/coverage retain historical labels and
unknown quality without current remote acknowledgement. Root uses sameone-second
scheduler chain, no newtimer/history/clock. WholeN017/N018/fullT077 and actualGPU
acceptance remain pending. Design implementation requires RED and independent
review before changes; existing exact behavior is preserved.

N016 activation/pending clarification: root consumeractive gate plus renderer
setSampledActive; clear/leaveground/dispose disable before cleanup, only explicit
show/reactivation reads fresh registeredview. Ordinarynextperiodicpending keeps
verifiedlastanalysis; failures/changedscope/authority clear. Source network.time
stays originalUnixmsISO, canonicalanalysisUTC staysunchanged. Coverage adapter
usesactualfullsampled definitions. ADR0048 is the binding implementation design.
