# Existing workspace network result port

createWorkspaceNodes accepts optional explicit networkInputs: model, readStations, readFaults, validateStation and onChange. It creates createNodeNetworkTimeline with its existing native requestCommunicationStates, optical history/proof owner, copied node definitions, common display UTC and library validator. Mutable timeline/store/optical owners are never exposed to the communication consumer.

Public updateNetwork returns an independently copied result or null when unconfigured/disposed. networkSnapshot returns the current copied envelope, verifyNetworkSnapshot checks every field against current inputs and private proof, clearNetwork invalidates only the network consumer. Definition or common display UTC changes clear accepted network results. Repeated display notifications with the same UTC retain valid proof; station/fault context changes are separately checked by the join. Workspace disposal destroys the network join before its shared optical/native owners. No separate Viewer, clock, serial query lane or node roster is created.

readStations must reject a ground store with ready=false; no stale station list or default fallback is allowed. readFaults must reject unavailable SIM/runtime input rather than pretending no faults exist. These readers are explicit composition dependencies; the boundary does not reach into another panel's controller or make server requests. An onChange observer failure cannot alter accepted results.

The default networkInputs=null preserves existing caller behavior while communication assembly is being implemented. This does not mean the new result port is already connected in workspace_orbit.js. Ground editor/list integration, verified record rendering, actual validated SIM-fault input, cross-window lifecycle and live8891 acceptance remain T077/N008. The source fabric adapter/exchange/routes/status are separate required steps; a valid network geometry envelope is not a fabric acceptance or actual RF link.

## Pending composition amendment: source cadence, not current proof reuse

[ADR0047](../../../docs/adr/0047_sampled_analysis_visual_boundary.md) adds a planned workspace-only1000ms lifecycle analysis scheduler, not a runtime clock. It captures frozen existing display authority and explicit discontinuity lease; natural play may finish a past sampled query only as historical visual analysis after full current definition/source/run/config guards. Seek/pause/config/source/run actions trigger immediate current analysis; failure/seek/clear/disposal revoke visual authority and fence late replies. Keep one active calculation and a bounded latest display intent in the existing serial lane and one optical-history owner.

The existing networkSnapshot/updateNetwork/verifyNetworkSnapshot and UTC-change
invalidation contract above remains. No rounded UTC, old native receipt or visual
projection can substitute for exact-current action proof. New renderer/UI ports
must separately register/verify immutable sampled views, retain analysis UTC and
label age/source/incomplete-current state while only endpoints follow current
valid native visual geometry. Do not route them into existing exact setLinks or
ground snapshot handlers. Preserve timer cleanup, all visible source functions,
full240 scope and observer/late/failed-input guards. **Design only; new behavior
and actual two-resolution/GPU/performance acceptance remain pending.**

The pending lease requires a separate optional internal binding/read/notification
bridge to the actual clock owner's opaque continuity capability. Rotate at
explicit command entry for same-UTC seek, pause/play, rate/config/source/run
change and failure, before any final running paint. Natural RAF/background buffer
acceptance leaves it unchanged. A numeric catalog generation or display callback
extra argument cannot stand in for notify-only commands. Capture/recheck this
capability around awaits/render; unavailable bridge disables sampled reuse while
generic exact-current behavior remains. Public JSON display/current proofs are
not extended with guessed continuity fields.

Natural SIM runtime sequence or a `{running,run_id}` drain lease is not command
continuity. Foreground-query generation is not a stored clock control token.
Sources without an actual bound control/source capability stay fail closed for
sampled reuse; no projected SIM UTC or clock flag grants equivalent authority.

Staging may initially bind only active catalog play through a privately registered
capture/isCurrent port matching the actual GP/EOP/leap display priority and full
source/observer/min-elevation/rate/mode scope. Missing/paused/stored/SIM/other owners
retain exact-current behavior. Revoke at command entry and inhibit new lease
capture throughout synchronous/reentrant command notifications; register only the
final completed owner state. Null/error/gap revokes, and recovery creates a new
lease rather than resurrecting old views. Background success preserves continuity
only if the same accepted valid buffer never became unavailable. This first owner
is partial, unimplemented T076/T077 scope, not whole source/network/ground delivery.
