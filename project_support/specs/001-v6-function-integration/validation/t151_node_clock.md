# T151 node panel common-clock commands, partial

The actual V6 assembly now injects createNodeClockControls into the original node
work panel. The adapter reads the current globe display context and matches its
complete source key against the existing stored-orbit or catalog owner. UTC must
be canonical under the existing leap codec and the display leap SHA must match.
Unknown/mismatched/missing context returns no command capabilities. There is no
fallback clock, timer, propagation, state copy or automatic play/seek.

Stored play/pause/speed/seek go through the existing server client and the existing
application command wrapper. Catalog play/pause/rate remain on catalogTimeline;
explicit seek uses its existing calculate path. Step uses displayed UTC, not a
separate counter. Current-time action reads an injected wall time only when the
user explicitly invokes it. Supported speeds remain 0.1/1/10/60. Catalog play is
unavailable without its existing buffer. Shared owners retain request/revision
and cancellation responsibility. Disposal prevents held actions from dispatching.

Panel refreshes also follow the existing stored render and catalog status paths,
so paused/speed changes are visible without creating another event loop. The
actual assembly fixture verifies the source work panel sees its stored clock.
It initially had no leap SHA in its sample receipt; the additional assertion
failed as intended. Add the actual receipt's leap provenance to this test fixture
instead of weakening the production guard.

Tests introduced before implementation observed missing module. Focused routing,
capability-copy, invalid/stale context, unsupported speed and disposal tests pass.
Full Node suite: 636 pass, 3653.6844 ms. Full Python suite: 649 pass,
8 existing ERFA warnings, 153.96 seconds, session 96205 exit 0.

This evidence uses existing application/source modules with DOM/HTTP/Cesium
boundary doubles. It does not establish actual 8891 clock control, source picking,
camera/zoom behavior or live model performance. T151/T152 remain unchecked, as do
the complete T075–T084 requirements. No owned-server restart, native installation,
new branch or remote Git operation occurred. Next: picking/hover and shared camera
capabilities, remaining composition failures and controlled installation/restart
with before-state capture/restore followed by the full browser acceptance matrix.

Additional stepping proof: 2016-12-31T23:59:59 +1 SI second preserves23:59:60; another second reaches2017-01-01T00:00:00 using existing codec. Actual isolated native receipt install/39b0d45e1dc84df2affc488ee4be73aa/isolated_call.json retains60native/selectedposes/source numeric delta5.4569682106375694e-12/time0ms/verifiedsnapshot true.
