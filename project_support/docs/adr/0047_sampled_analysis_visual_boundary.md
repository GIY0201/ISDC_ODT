# 0047: Source analysis cadence and sampled visual receipts

2026-10-07. Approved design for the existing T076/T077 source migration and
T032 performance work. **Design only: implementation and acceptance pending.**
This document does not claim that periodic analysis or past-result rendering
already exists. Earlier full-suite results do not validate this new behavior.

## Source evidence and problem

Pinned ISDC-ODT commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`:

- `user_application/web/scripts/tabs/nodes.js:132–146` computes node states,
  resolves OISL links and updates fleet/status in `tick`. Lines `623–628` activate
  a `1000` ms wall timer and force an immediate tick after initialization.
- `user_application/web/scripts/tabs/communication.js:165–180` computes the
  network twin, links and current report in `tick`. Lines `909–916` activate the
  same `1000` ms tick cadence, separately from module status polling.
- `nodes.js:595` gives the model layer an `onFrame` callback that calls visual
  selected-object synchronization and `scene.syncFrame`. It does not resolve
  optical acquisition or compute a new network snapshot per rendering frame.
- `nodes.js:149` and `communication.js:184` force a tick after explicit time
  changes. Source interval scheduling is not a second simulation clock.

The current V6 display observer calls the optical producer at each changing
fractional display UTC. Exact communication states cannot be invented from
interpolated display LVLH/velocity, so this can cause many native point requests.
Moreover, an HTTP reply for an earlier captured UTC is rejected by the current
exact-display final guard while the display advances. Merely throttling that
function can still starve publication; weakening that guard would incorrectly
approve old communication results.

## Decision: two uses of one analysis owner

Keep the existing optical owner as the **only** owner of terminal histories,
known full definitions/hashes and accepted analytical results. Add a captured
exact-UTC sampled-analysis path and an independently registered visual-only
projection. Preserve the existing exact-current update, snapshot and action
verification paths. Network calculation consumes the same exact-UTC optical
result and native states through its existing owner/pure source model; it never
adds a second terminal-history implementation.

The workspace lifecycle may schedule one `1000` ms wall timer while the relevant
source display consumer is mounted/active. It reads the existing authoritative
display owner; it cannot advance, round, replace or pause its time. This is source
analysis cadence, not a cap on RAF, native interpolation, camera interaction or
UI feedback. A paused unchanged exact UTC may reuse a currently verified result.
Mount, seek, pause/play, rate change, source/run change, physical
definition/configuration change and explicit analysis actions request immediate
current analysis through the
same scheduling boundary. A supplied but unavailable authority fails closed.

Each query captures an immutable lease containing the exact canonical analysis
UTC, complete ordered full node definitions and source provenance, the existing
display source/run authority and its explicit discontinuity capability. Network
queries additionally capture complete stations and authoritative runtime faults.
Use existing validated native rows at that exact instant or request matching
native point receipts in the existing serial lane. Do not round UTC, reuse a
preceding optical row, interpolate communication axes or truncate the fleet.

Natural play advancement may complete a sampled result for its captured instant
only after rechecking the same full definitions, source/run/discontinuity lease,
node/hash/metadata inputs and applicable station/fault scope. It publishes a
historical analytical receipt for visual use, not current communication approval.
The existing exact-current action verifier still requires its original current
UTC and full context equality. A sampled result alone cannot authorize a mission,
fabric route/send, data operation or deployment. No module proof is invented.

## Single history, bounded work and explicit invalidation

All sampled and exact requests use one active analytical calculation and the
existing serial native transport. Keep at most one latest pending display-query
intent, never an unbounded queue of frame times. Do not cancel a slow periodic
query on every timer tick: complete its captured sampled lease, then capture the
actual current display again for the latest pending query. There is no backlog
replay or hidden catch-up simulation. Exact action requests get explicit priority
and may share only an identical exact UTC/full-scope in-flight computation.

Every computation derives a candidate from the same accepted optical history;
only the final winning validated lease atomically advances that history once.
Exact and sampled paths cannot both commit histories for a shared request.
Explicit seek/reverse/discontinuity, source/run change, physical definition or
configuration change, failure, clear and disposal revoke the visual lease and
fence late results. Retain only original source-supported histories for unchanged
full definitions using the existing pruning/reset rules. Selection-only events
rotate the existing authority capability; they cannot change physical node data
or manufacture a new approval. An ignored-abort HTTP request retains the serial
lane until terminal response, and can never publish after invalidation.

Pause/seek/reverse/discontinuity must come from the existing time/source owner as
an explicit event/capability, not inferred from a rounded UTC or a replacement
wall clock. Mount/disposal and hidden consumer lifecycle clear owned timers and
registrations without changing GP, SIM, stored records or runtime state. Do not
hide a currently visible feature to meet performance limits.

## Owner-issued continuity capability, separate from JSON display

The lease must use a real opaque continuity capability issued by the existing
clock/source owner. Rotate it **at explicit command entry**, before any final
frame/notification, for seek (including the same UTC), pause, play, rate change,
source/run/configuration change and failure/clear/disposal. Natural RAF movement
and accepted background buffers for the same physical input do not rotate it.
A numeric catalog generation alone is insufficient: pause/rate/play need not
cancel its generation, and pause may paint a final running frame before stopping.

Provide an optional internal clock-capability binding/read/notification bridge
from that actual owner. A second argument on the display callback alone cannot
cover commands that only emit status notifications. Capture the immutable token
when issuing analysis, re-read the same actual owner capability before/after
await and every visual use, and reject unavailable/different/foreign capabilities.
Each real command notifies immediate-analysis scheduling even if the canonical
UTC string is unchanged. Do not infer continuity from a UTC delta, speed label,
`running` JSON flag, equality of copied display objects or revision number. The
public JSON `displayContext` and current analytical proofs remain unchanged;
only a separately declared internal capability bridge supplies this authority.
SIM runtime sequence naturally advances and an existing `{running,run_id}`
phase/drain lease is not an explicit command continuity capability. Stored-orbit
foreground query generation is also not sufficient by itself. Keep these sources
fail closed for sampled reuse until a real accepted control/source capability is
bound; do not assume equivalent authority from approximate projected SIM UTC.
Generic callers without this bridge keep exact-current behavior and cannot opt
into retained sampled visuals through permissive fallback.

## Staged capability delivery and command transactions

The first implementation may support only the existing **actively playing catalog**
owner through an optional privately registered `capture`/`isCurrent` continuity
port. Its complete source/observer/min-elevation/rate/playing authority is bound
to the actual selected GP/EOP/leap display key and actual display priority. Merely
having a catalog selection behind a different displayed source is insufficient.
Missing bridge, paused catalog, stored orbit, projected SIM and other unsupported
owners retain the existing exact-current path and cannot borrow its lease. A
catalog-first result is only partial T076/T077 delivery; remaining source/network/
ground capabilities and behaviors stay required and pending individually.

Revoke the prior capability at **command entry**, and suppress capture of any new
continuous lease for the entire command transaction. Pause/rate/play may paint or
notify synchronously and reenter display consumers before the command ends. Only
after successful completion may a new capability reflect the final rate/mode and
complete owner inputs; failed/interrupted commands cannot resurrect an old lease.
Tests must invoke capture from within those reentrant callbacks, not only after
the command resolves. Pausing exits the proposed active-play sampled capability
and performs current exact analysis through the existing path.

Null/error accepted display or an availability gap revokes continuity even when
input IDs/UTC later recover unchanged. Recovery requires a new registered lease.
Background fetch success preserves natural continuity only while the same valid
accepted physical/display buffer remained available throughout; selection/hash/
observer changes or a gap are discontinuities. Do not turn every background query
into a false discontinuity or let recovery revive pre-gap views.

## Visual-only contract and unchanged action boundaries

A visual projection is registered privately in its analytical owner, immutable,
and bounded to the latest permitted captured receipt. It retains that receipt's
unchanged **analysis UTC**, native hashes/full scope and source/quality. It also
reports the current display UTC, age and availability/pending/failure reason.
It must explicitly identify sampled analysis and whether the exact current
analysis is unavailable. Do not relabel previous `locked`/route states as current
verified success. A copy, forged marker or stale authority cannot revive it.

The renderer requires an independently typed sampled-visual port and verifier.
It rechecks registration, captured receipt, full current definitions, source/run
and discontinuity capability before/after publication and on each use. It moves
line endpoints using existing valid current native display geometry, without
recomputing OISL/propagation. Missing/failed native endpoints, morph, hidden links,
revoked scope, seek or failure hide lines and stop flow. Ordinary next periodic
work may retain only explicitly labeled last-analysis states while pending.

Existing `NodeScene.setLinks`, exact current `placeLinks` authority and public
`verifyLinkSnapshot` remain unchanged. Never pass a past sample into those paths,
overwrite its UTC or change their guards to accept age. The same restriction
applies to full network snapshots, ground-network rendering and all action
receipts. Sampled ground/network rendering requires its own declared visual
projection before being connected; implementing only optical cadence does not
close whole T077. No automatic fabric exchange/command is introduced here.

## Required validation and unchanged acceptance

Write meaningful failures before implementation for source-equivalent cadence,
full240 exact-point/native provenance and per-frame geometry with no analytical
HTTP. Test advancing UTC while a captured reply is pending: sampled publication
may succeed but exact current action verification must fail. Verify a single
history advancement, identical-query sharing, explicit action priority, bounded
latest pending intent and ignored-abort serial ownership. Test fast/reverse play,
pause/seek/configuration/run/source/hash changes, unavailable authority, failures,
clear/disposal and late results with no clock or runtime mutation.

Compare source priming/acquisition/history/state results at the same captured
instants. Preserve all existing full-context approval and mission/fabric/data
rejection regressions. Verify full fleet/status/equipment and visible analysis
UTC/age/source/incomplete-current labels in both resolutions, along with native
endpoint failure/morph/toggle/lease revocation and forged/copied views. Require
full regression and fresh actual browser/GPU measurements before acceptance.

FR030/SC026, all native golden tolerances and source assumptions, whole
T075–T084 and T032/SC-006 frame p95 <=16.7 ms, feedback <=50 ms, UTC completion
<=100 ms and existing repeated-trial gates remain unchanged. No CPU proxy/unit
pass closes GPU performance, original functionality, real RF/HIL or hardware
acceptance. No new Viewer, propagator, runtime state, ABI or endpoint is approved
by this design.
