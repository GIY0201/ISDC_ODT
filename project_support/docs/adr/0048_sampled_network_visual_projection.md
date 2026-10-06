# 0048: Complete source network visuals through the existing analysis owner

2026-10-07. N016 implementation design for T077, extending ADR0047.
Whole migration, network exchange and performance acceptance remain pending.

## Original behavior and remaining gap

Pinned upstream `1a1e00297a0301637455b0ef2cf48b2e74576b07` communication
tick runs the pure network twin every 1000 ms; its frame callback updates visual
endpoints independently. V6's current exact network receipt expires at the next
fractional display UTC and ground links/coverage disappear. Optical cadence alone
does not restore this original behavior. Reuse source network model and native
geometry, not a new network/optical implementation.

## One owner, separately registered visual authority

Extend existing createNodeNetworkTimeline with optional readContinuity and
verifyContinuity ports, matching the actual catalog-to-globe binding. Add
updateSampled(), sampledPresentation(), verifySampledPresentation(value,{utc,nodes?})
and cancelSampled(). No independent timer, optical history, native lane or clock.
Preserve existing update/snapshot/presentation/verifySnapshot and current-context
action contracts; generic owners without optional ports retain exact behavior.

Root composition chains optical.updateSampled() then network.updateSampled() in
the existing one-second scheduler request. Network reads a fresh registered
optical sampledPresentation at current display UTC and verifies it through the
sole optical owner. Its unchanged analysis_utc becomes the network calculation
UTC. Request full native states at precisely that UTC through the existing serial
native owner, and call source buildNetworkSnapshot with that analysis time, full
definitions, complete enabled stations, faults and verified optical pairs. Do not
resolve optical acquisition again or relabel captured analysis as display time.

Capture complete nodes/stations/faults and full display-source identity (excluding
only natural display UTC), plus opaque continuity lease. Revalidate capability,
full input scope, source/run/configuration, optical analysis UTC/hash/pair receipt
and native provenance before/after every await/external callback and publication.
Optical's borrowed presentation is fresh per current display: obtain and verify
a fresh registered view when natural display UTC advances, and require its full
underlying analysis content to equal the captured analysis. A copied marker,
same-source IDs or matching UTC alone never prove authority.
Compare intrinsic complete analytical content/provenance, excluding only sampled
projection marker/display_utc/age/current_analysis/availability/reason. Ordinary
next-periodic pending may retain a still-verified accepted analysis with pending
availability; pending alone never clears it. Failed analysis or invalid authority
does clear it. Source network.time remains its original Unix-ms ISO representation;
the outer canonical analysis UTC is unchanged and never replaced by display UTC.

The existing network owner has one active calculation and latest accepted record;
sampled work uses that same lifecycle, not a second independently mutable result.
Exact update preempts sampled work and remains exact-current. Cancellation retains
the shared native transport drain before reusing the lane. Sample-origin records
cannot survive revoked authority as exact records even when UTC is unchanged.
Invalidated command, scope change, failure, clear or disposal revokes accepted
sampled projection; final pauses use existing exact analysis after settlement.

The immutable privately registered NETWORK_SAMPLED_UI_V1 projection carries the
complete existing envelope/native metadata and unchanged utc=analysis_utc, plus
display_utc, age_seconds, current_analysis, availability and reason. Reverification
reads current full inputs and original owner-issued capability around external
callbacks. It does not satisfy verifySnapshot, fabric/mission/data approval or
acknowledge remote acceptance. Network analysis remains an engineering assumption.

## Rendering and UI ports

NativeNetworkScene receives optional sampledNetwork:{read({utc}),verify(value,{utc})}
ports. Its existing setSnapshot/valid exact guards retain their behavior and reject
sampled marker even with a permissive generic verifier. On each frame, read one
fresh registered sampled view, validate all complete scope/native metadata and
captured network structure, and move endpoints only using current verified native
geometry with matching definition hashes. No native/OISL/network queries in RAF.
Check source authority, full definitions, Viewer owner, morph, toggles and current
time before and after every external callback and before showing primitives.
Final owner proof follows external getters. Missing/invalid data hides the sampled
ground links and coverage and stops flow; old Viewer collections stay with their
original owner for cleanup. Resource reuse follows Cesium's documented lifecycle.

Ground-network table and diagram may use a separately verified sampled read port
only for readonly presentation. Label analysis UTC, current display UTC, age,
engineering assumption and unavailable current analysis. Retain complete 240-node
and 24-station scope with existing pagination/selection/edit/empty/failure behavior.
Without an actual current fabric acknowledgement, sampled links show geometry and
unknown quality/custody, never invented usable links, successful packet flow or
routes. Existing send/refresh/route buttons continue using exact current receipts.
Automatic exchange and status/pass/quality/route/3D-selection residuals are N017
and N018; this step does not silently declare those connected.

Sampled ground publication has an explicit consumer-active gate in the existing
workspace and renderer, separate from analytical authority. Ground panel show
activates it and forces the existing scheduler; leaving ground, explicit scene
clear and disposal deactivate it before cleanup. NativeNetworkScene.clear disables
sampled publication until explicit setSampledActive(true); the actual assembly's
read port also returns null while inactive. A still-valid analytical capability
cannot recreate cleared resources on the next frame. No pause, owner receipt or
new analysis silently activates a hidden/cleared consumer. Reentry explicitly
reactivates and reads a fresh registered view, with old queued callbacks fenced.
Unverified sampled pending/unavailable refreshes hide through proof guards instead of using
the exact panel's clear-every-refresh branch; generic exact panels keep that branch.
Network analysis is chained only while this original communication consumer is
active. Station/fault/config changes force the same scheduler immediately after
revocation; they do not reset the sole optical history or install another timer.
Coverage callback receives the actual current projection's full node definitions;
it must not close over an old exact snapshot or silently use a default cohort.

## Composition and validation

Natural display changes must not clear accepted sampled network records; full
exact network snapshot still fails its exact UTC guard. Explicit capability
invalidation, changed definitions/stations/faults/source/config/run and disposal
clear/revoke at entry. Definition edits prune existing optical history normally.
The scheduler chains complete captured optical/network analysis with one pending
latest display intent; there is no second periodic owner. Missing/paused/stored/
SIM capabilities retain current exact behavior without broadening scope.

Required meaningful RED regressions: actual captured optical/native same-UTC
source comparison, full240/allstation/fault/hash preservation, advancing display
publication with exact-action rejection, duplicate calls/slow ignored-abort lane,
sameUTC pause/seek/config failure and callback reentry, forged/copied/stale view,
Viewer replacement, native endpoint failure/morph/toggle/disposal, separate UI
historical labels and no fabricated fabric quality. Run old exact regressions,
whole suites and actual two-resolution mounted composition; actual GPU/live/remote
acceptance remains separate. All T032 tolerances and full T075–T084 scope remain.
