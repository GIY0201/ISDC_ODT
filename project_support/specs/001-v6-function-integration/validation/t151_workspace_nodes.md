# T151 V6 node workspace composition, partial

The actual workspace_orbit assembly now constructs createWorkspaceNodes using the
existing source node library, editor/panel tools, NodeScene, sample/track timeline,
optical producer and data-deployment client. It mounts the original work panel in
the satellite work window and includes its existing CSS. The shared globe binding
supplies the existing Viewer and display UTC; the new application module creates
no Viewer, propagation engine or analysis clock. Date.now is supplied only for
explicit node definitions and source browser persistence timestamps.

Restore and initialization use GET only. Deploy and recall invoke the existing
serialized client only from enabled explicit buttons. Definition changes invalidate
native buffers/history. Native unavailable/unknown UTC is visible and an explicit
retry reuses the existing native owner. Editing invalidates an earlier selected
pose. Selection and focus are separate; passive restore/add cannot focus. Existing
model manifest resolver is shared read-only with nodes, with no additional load.
Cleanup releases panel, node binding, subscriptions, requests and source history.

Tests were introduced before code: workspace module missing and model resolver
accessor missing were observed failures. Initial composition accidentally retried
failed optical queries through every native status callback; its live test process
was stopped and code repaired to calculate only on display/definition changes or
explicit retry. Focused tests verify GET-only restore, unknown/native failure,
accepted sample buffers -> selected-model sampler -> explicit focus, edited
definition rejection, and actual V6 assembly with the original panel/add editor.
These use DOM/Cesium/HTTP boundary doubles, not an actual browser.

First full Node run failed because older VM fixtures lacked new imports/capabilities.
Real workspace fixture now includes actual new composition/source modules. A
separate stored-orbit-handler isolation fixture was updated for its new imports;
its original no-command assertion is retained. Final full Node: 631 passed,
4512.8276 ms. Full Python: 649 passed, 8 existing ERFA warnings, 154.79 seconds,
session 86704 exit 0. Actual isolated native receipt:
`data/workspace/validation/install/d2591b07529342e98224dca3ba8d95b6/isolated_call.json`,
60 native/selected poses, source optical comparison max numeric difference
5.4569682106375694e-12, time error 0 ms, verified snapshot true.

T151 stays open: source picking/hover, common clock command routing, full view/zoom
controls, scene-composer cross-screen consumption and failure/restore cases still
need integration and actual verification. In particular nodes do not create a
fallback display UTC when no existing GP/catalog context exists; unsupported clock
and camera capabilities remain disabled. External HTTP crypto capability and
storage-read failure presentation require verification before external access is
claimed. N005 still needs full interaction and real model/camera browser proof.
Controlled installed-native update and owned 8891 restart with full before-state
capture/restore have not occurred. No live UI/remote PR/new branch claim. T152,
T153 and all original T075–T084 remaining requirements retain their scope.
