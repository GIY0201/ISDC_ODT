# 0045: Registered readonly native display projections

2026-10-07. Accepted for the existing native source-node display owner and its
single shared Viewer. This changes an internal JavaScript display contract;
HTTP/wire schemas, source equations, native wheel and runtime ownership do not
change. SC-006/T032 and the 240-node presentation requirement remain unchanged.

## Problem and evidence

Actual 240-node interaction remains below the agreed frame target. Chrome CPU
sampling identified repeated native row validation, definition serialization,
deep copies, coordinate reads and frame-context checks. Static native paths and
single-frame geometry reuse reduce repeated work, but the original geometryFor
API intentionally returns fresh mutable copies. It must retain that behavior.
A frozen arbitrary object is neither proof of valid native data nor permission
to reuse an old result after retry, replacement or disposal.

## Decision

Add an optional `displayGeometry` display port, assembled from the existing
createNodeDisplayTimeline owner and injected into NodeScene. Its methods are:

- `revision()`: opaque frozen identity for the actual atomically accepted sample
  buffer Map; null when no accepted samples are available or the owner is invalid.
- `viewFor(node)`: privately registered frozen descriptor only after the full
  requested node definition matches an accepted native buffer entry. The view
  carries the original full readonly node definition, canonical definition key,
  hash, frame/time/model/source metadata and opaque prepared-buffer revision.
- `isCurrent(view)`: private-registration, accepted-cohort and actual buffer-entry
  identity checks. A copied or invented descriptor cannot become current.
- `sampleAt(view, utc)`: exact canonical-UTC readonly projection using the same
  geometryFor calculation, validation and existing interpolation rules. It keeps
  at most two exact-UTC results strongly referenced per view. No extrapolation,
  decimation or new propagation is introduced. Missing samples remain null;
  aligned native errors remain frozen error packets.
- `verifySample(view, packet, utc)`: private packet registration, originating
  view, exact UTC and current-owner proof. It rejects a mutable copy or an invented
  packet even if its values match a genuine packet.

The prepared buffer owns private WeakMaps for views/packets. Complete packet and
definition graphs are deeply frozen; mutable internal collections never escape.
Held immutable packets may retain their genuine origin after two-UTC cache
eviction, but cannot prove currentness after the accepted cohort changes.

The sample timeline already replaces its accepted Map atomically. The port binds
to that identity instead of the in-flight request counter: pending background
prefetch retains the complete original buffer exactly as before. Accepted
replacement, definition change, explicit seek/retry/clear, failed replacement
or disposal revokes old views. The outer display owner also gates input errors.
Checking the accepted cohort is O(1); it does not serialize the runtime or scan
all previously adopted views on every endpoint read.

NodeScene verifies the complete definition, hash and metadata when adopting a
new registered view. It verifies every newly seen readonly packet through the
owner before reusing that packet's proof under the same view/cohort/exact UTC.
Per-frame geometry and canonical-UTC memo objects are discarded after each
syncFrame. All external owner/UTC callbacks retain before/after frame checks,
and the final boundary checks Viewer, Cesium, definitions, current UTC, mode,
transition, provider identity and native cohort. Revocation during a callback,
including replacement at the same UTC, hides the complete owned point/model/link
frame. The initial revision read is bound inside that same guarded frame.

Existing geometryFor callers still receive fresh mutable copies and the original
full validation. Consumers without the optional port retain the preceding copied
callback path. Source path vectors, marker/label styles,64-model cap, orientation,
OISL endpoint guards, packet-flow shader, shared UTC and Viewer are preserved.

## Validation and limits

RED tests established missing owner/renderer ports. Further callback regressions
exposed an uncaught initial revision exception and initial revision mutation of
the morph state; both now fail closed. Tests cover real prepared buffers and the
actual display owner, private fake-view/packet rejection, deep nested readonly
data, public-copy independence, bounded two-UTC eviction, exact UTC/range/errors,
pending-prefetch retention, replacement/retry/clear/definition/input-error/dispose
revocation, same-UTC mid-frame replacement, all owner callback fences and actual
workspace port assembly. Existing golden, full240x601, interpolation, native
error, orientation, scene, lifecycle and transport tests remain applicable.

These tests establish contracts and behavior, not GPU or physical presentation
performance. Fresh actual before/after measurements and full regression remain
the parent's acceptance gate. Do not infer 60fps or 240 GLBs from this change.

## Advancing-UTC projection refinement

After the registered port improved paused display, an actual playback trial
stalled browser control. The first readonly packet for each new fractional UTC
still called the public copied geometry API and its generic defensive callback
adapter: six fractional ticks executed thirty structuredClone calls. The owner
now projects its registered entry directly after canonical UTC validation.
It captures and deeply freezes complete native rows once, uses the same binary
search, bounded one-second gap rule, angle wrapping and linear interpolation,
and fully checks each new fractional result before registering a packet.
The interpolation function is private and pure, with no caller callback or
mutable input to isolate. The generic orbit_playback API stays unchanged.

Public geometryFor still validates the full supplied definition and returns
fresh mutable definition/row copies. Registered display reads reuse their
already accepted entry proof, never an arbitrary frozen object; public scope,
owner/cohort revocation, two-UTC bounds and renderer callback fences stay intact.
RED established thirty clones versus zero at advancing UTC. Tests compare the
complete projected rows with the unchanged generic interpolation over thirty-three
exact/fractional ticks and cover overflow, aligned errors, leap gaps, canonical
UTC, nested native data, copy independence and existing replacement/lifecycle
contracts. This is behavioral evidence; actual playback and Chrome presentation
measurements remain required before any performance acceptance claim.

## Authoritative transition query refinement

The subsequent paused Chrome CPU profile identified frameCurrent guards as the
largest remaining product cost. Their isTransitioning callback copied the whole
public globe view state each time merely to read mode.phase. The existing globe
owner now exposes isTransitioning(), reading that same authoritative phase with
the identical comparison (including pending, error and disposed-state behavior).
NodeScene and NetworkScene use it when present; injected legacy globe objects
retain their prior viewState fallback. Public viewState continues returning fresh
mutable copies. Every external callback and final frame guard remains unchanged.

RED exposed the absent query and copied-view renderer guard. Real owner tests
cover ready/pending/success/failure/rejection/disposal and demonstrate repeated
queries work even while structuredClone is forbidden. Workspace tests cover
node and ground-network injection, legacy fallback and thrown owner callbacks.
This removes the UI-state copy from the guard, without caching transition state
or claiming that live rendering meets the unchanged presentation target.

## Synchronous panel reentry refinement

An advancing playback CPU profile contained repeated draft-copy calls at many
call depths. Inspection found that a persistent readDisplay/linksFor error in
fleet refresh reports through workspace.report, which immediately refreshes the
same panel again. RED reproduced a maximum call-stack failure. refreshPanel now
uses a try/finally nonreentry boundary: reported errors update immediately, the
current outer refresh completes metadata using the latest error, and the guard
is released even if a callback throws. Disposal during panel refresh stops the
remaining metadata rendering. This does not delay native work or mute errors.

After panel.refresh returns, the metadata render captures fresh draft/deployed
copies once for counts and the reviewed definition display. No copy survives
that synchronous call; mutations in panel callbacks appear immediately, and
later operations read a fresh cohort. Store ownership, public copy semantics,
clock/optical/network proof and accepted deployment validation are unchanged.
Tests cover persistent error reentry, latest error retention, thrown callbacks,
guard recovery, disposal and post-callback/next-operation definition freshness.

## Explicit communication bookkeeping emissions

The actual moving-UTC profile also showed full refreshPanel work on exact-native
communication queue notifications. The existing display timeline now supplies an
optional second onChange argument, with kind communication only for the start
and finally bookkeeping emissions of serveCommunication. Its original first
snapshot, HTTP ordering, exact native state proof, failure settlement, cancellation
and late-work guards remain unchanged. All other emissions use the display kind.

Workspace composition handles communication kind with metadata-only refresh:
latest error, native pending indicator and button/readiness/count metadata stay
current, while pose, scene and fleet/status rebuilding wait for their existing
actual display/native/optical update boundaries. Unknown or absent reasons retain
full refresh. Actual display changes, accepted or failed sample/track receipts,
optical onChange, explicit user refresh and disposal retain their existing path.
The nonreentry boundary and fresh per-operation definition copies apply equally
to metadata-only calls. No optical computation or visible feature is skipped.
Tests cover explicit start/final reasons and original snapshot values, failure
and disposal settlement, bounded workspace scene/fleet counters, concurrent actual
display changes and accepted verified optical results reaching scene/full panel.

## Exact native communication cohort extraction

The next actual moving-UTC CPU profile directly attributed copied geometryFor
work to serveCommunication and per-node communicationStateFor. Prepared native
buffers now offer an internal communicationStatesFor(nodes, display) cohort query.
It validates every complete input definition, unique ID and canonical exact UTC,
uses only that accepted entry's private projection, and checks the unchanged full
communication payload (inertial vectors, right-handed orthonormal basis, finite
geodetic fields and metadata accepted at preparation). Fractional, missing,
aligned error and invalid payloads still cannot become communication states.

The complete cohort crosses one mutable-copy boundary per prepared buffer, rather
than creating discarded geometry/definition/row copies per node. The existing
single-state public API and isNodeCommunicationState retain their behavior;
the latter shares only its original payload predicate. The sample owner groups
nodes by its actual accepted buffers and rejoins them in original request order.
It checks accepted Map identity and disposal after each group, so revocation
inside a copy boundary cannot publish mixed cohorts. serveCommunication uses
this query for accepted grids and exact native point responses; its original
current, generation, hash, HTTP, cache and settlement guards remain unchanged.

RED established the missing cohort query. Tests require complete state parity
with the original public API, one clone for a three-node buffer, independent
nested mutable output copies, malformed payload/error/UTC/definition rejection,
all240 nodes across83/83/74 buffers without extra HTTP, and revocation during
copying followed by fresh calculation/disposal. These are correctness and work
count proofs, not a claim that actual playback meets its performance target.

## Catalog notification differential refresh, 2026-10-07

Native UTC/position display already flows through the globe display observer into node scene and current status. A subsequent catalog presentation notification used to rebuild the same source-node panel again. Composition now compares the complete catalog snapshot excluding only `utc` and `display` before that second node refresh. Every other field, including future keys, selection, observer, buffer summary, playing/rate, pending and errors remains part of the key. No native paint or shared-context notification is removed; source-node calculations and optical currentness remain unchanged. Real catalog timeline RED reproduced three redundant refreshes for three advancing ticks; GREEN keeps all three display callbacks plus same-UTC pause/speed/query-error/clear changes. Independent review found no blocker for this bounded behavior. Combined fullNode1187PASS8112.5299ms includes this and exact communication batch, before new actual replay measurement; no live frame acceptance is claimed.

## Trusted optical scope capture

A later moving-UTC CPU profile directly identified repeated draft JSON copies
and optical context serialization. Optical context now accepts an optional trusted
nodeScopeRevision callback. Workspace composition supplies an opaque token rotated
BEFORE syncDefinitions by its existing store subscription on every notification,
including load, conflict, selection and deployment. Persisted store.revision alone
is unsafe because explicit load can replace definitions at the same number.

The optical owner captures, fully validates and deeply freezes all node definitions
once per token, retaining only one current graph and its complete canonical scope.
It reuses that proven scope to construct the identical canonical [UTC,nodes] key;
exact UTC is still read and validated on every context call. Token drift during
scope/UTC callbacks fails closed. Generic callers without the optional trusted
callback retain their existing fresh read/copy/full-signature behavior. Disposal
releases the cache. All240 nodes, fields, hash/native point checks, current-context
and final acceptance fences remain intact.

The token authorizes cached scope reuse, not receipt reuse: across calls a rotated
token re-reads and proves the full scope. If values are unchanged (for example
selection), an existing exact-UTC receipt remains valid; if definitions differ,
it is revoked by the original scope key. Tests cover actual store reload at the
same persisted revision, scope read-count reduction, token drift during node/UTC
callbacks, generic fallback, selection parity, same-UTC edits and disposal.
