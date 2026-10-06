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
