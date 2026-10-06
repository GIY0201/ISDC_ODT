# T151 shared native-node picking and hover highlight, partial

The existing OrbitGlobe pick handler now routes explicit nodeId/node_id records
through an injected primitive-ownership verifier before catalog/station handling.
This reuses the existing one Viewer/one handler. A tagged foreign, hidden, stale
or invalid node pick cannot become a catalog selection. The application checks
the current full definition's accepted native buffer at the common display UTC,
node renderer availability and the actual owned point/label/fleet model reference.
For the selected model, OrbitGlobe requires its own visible shared model primitive
and SatelliteModelLayer.nativeAt validation; application scope is checked too.

Click selects through the existing constellation store and selected-model path.
It does not focus the camera. Hover uses the existing NodeScene.setHovered styles
and clears the GP hover card. It does not claim a node hover facts card yet.
Source fleet model pick metadata adds nodeId alongside the original satelliteId.
The original source capture remains unchanged; the comparison excludes exactly
this declared additive field and preserves all original glTF options.

Workspace binding supports preboot, replacement/removal, disposal and global
renderer failure. Late callbacks and older removers cannot select or clear a new
owner. A reentrant cleanup test initially failed; assign ownership before calling
cleanup and attach only the still-current binding. Observer exceptions do not
change geometry or destroy the shared Viewer. Scoped cleanup removes interaction
before renderer disposal.

Tests preceded the changes: missing OrbitGlobe/WorkspaceGlobe methods, missing
fleet model tag and missing application interaction binding produced failures.
Focused54 tests passed before the selected-model/reentrant additions. Final full
Node642PASS3704.5978ms. FullPython649PASS8existingERFAwarnings157.12s,
session34156exit0. Actual isolated receipt
`data/workspace/validation/install/48420fb9a16545b1953f99e9c27e88bf/isolated_call.json`
retains60native/selectedposes and source optical comparison maximum numeric
difference5.4569682106375694e-12/time0ms/verifiedsnapshot=true.

Pick tests use the real modules/native buffer and Cesium/DOM boundary doubles,
including the shared native pose guard; they are not actual GPU/browser clicks.
N005 remains open for live interaction/model-camera evidence. T151/T152 remain
open for shared camera/view/zoom/lighting, node hover facts, scene-composer,
storage/HTTP crypto and remaining failure/restore cases, controlled native
installation and owned8891 before-state capture/restart/restore, and full browser
acceptance. FullT075–T084/Terra/allassets/N001/T032/T137auth/equipment/RF/HIL/file
bytes/review remain. No new branch/remoteGit/native install/live restart occurred.
