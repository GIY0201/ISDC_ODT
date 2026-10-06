# T151 selected source-node pose prerequisite

The existing SatelliteModelLayer accepts a separate `pose_source` descriptor for
`kind: source_node`, a copied full `node_definition`, and the accepted native
`definition_hash`. Its sampler receives the common canonical UTC and returns the
existing node sample-buffer DTO. It checks every source metadata field, current
definition, node ID, accepted hash, canonical UTC, valid row, null error and three
finite metre coordinates. It returns a copied pose. It preserves the source
`EARTH_FIXED_GMST_UTC_APPROX` frame and engineering assumption quality. GP samples
still require ITRF, selected catalog number and normalized GP hash.

Model load identity includes the domain, full finite JSON definition and hash.
Editing a node with the same ID and model URL fences the pending load and queued
camera focus. The existing renderer, display orientation approximation, explicit
focus/follow and cleanup lifecycle are reused. Workspace model state exposes a
node ID and definition hash separately from NORAD identity.

Evidence: two model tests failed before implementation (missing node pose and
unchanged pending-load identity). A workspace identity test also failed before
its implementation. The focused suite subsequently passed 15 tests. Full Node
suite passed 626 tests in 3737.2041 ms. Full Python suite passed 649 tests with
8 existing ERFA warnings in 153.53 seconds (session 9235, exit 0).

The existing isolated-wheel fixture now checks all 60 actual Rust node rows after
default application/ASGI, native adapter/query and JS sample-buffer decoding with
this selected-model pose validator. GLB loading and mutation rejection are tested
with Cesium boundary doubles; this is not an actual browser/model rendering claim.

The actual receipt is `data/workspace/validation/install/d141562caeb647ca809dbfcdeaa5df0f/isolated_call.json`:
3 application requests, 60 native rows, 60 selected node poses, original optical
source comparison maximum numeric difference 5.4569682106375694e-12, time error
0 ms, verified snapshot true. Wheel SHA256 remains
`d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97`.

N005 remains open for the full application selection and camera integration.
T151 remains unchecked until the node panel/store/timelines/model/client and scene
composition are mounted with the shared Viewer and clock, followed by controlled
native installation and owned 8891 restart with before-state capture/restore.
T152 requires the actual two-resolution UI and failure matrix. Full T075–T084,
Terra/all assets, N001 multiwindow behavior, T032 performance, Git review and real
equipment/file-byte requirements remain open. No server restart, installed-native
change, branch creation or remote Git operation is part of this component change.
