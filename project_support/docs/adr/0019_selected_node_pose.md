# 0019 Selected source-node pose in the shared model layer

Status: accepted for the existing T151 implementation plan, 2026-10-06.

The selected fleet node model is delegated to SatelliteModelLayer by the source
NodeScene. Its previous ITRF-only sampler rejected native node geometry. Labeling
source GMST coordinates as ITRF would misrepresent the calculation model.

Add an explicit optional `pose_source` model-description contract with
`kind: source_node`, the complete copied `node_definition` and the accepted
64-character lowercase native `definition_hash`. The injected sampler returns
the existing native sample-buffer DTO for the caller's canonical UTC. This layer
validates current definition, hash, identity, metadata, row status and position.
The caller supplies the existing UTC codec. No query, propagation, timer or
application state import is added to visualization.

Render and camera paths use the native Earth-fixed metre position while retaining
the approximate source frame and quality in copied pose/status records. Attitude
remains the existing display approximation. GP descriptors and validation keep
their existing meaning. Domain/full-definition/hash identity fences stale model
loads and camera focus. Workspace records distinguish node ID from catalog ID.

This additive display contract does not change orbital physics or HTTP schemas.
Actual application selection/picking, panel composition and browser acceptance
remain T151/T152 work; component tests do not establish live rendering success.


2026-10-06 T151 application composition: createWorkspaceNodes mounts existing source panel/store/native display/optical owners and shared NodeScene binding in V6. Shared catalog model-manifest owner exposes copied resolve/models access without changing catalog selection. Native errors/unknown common UTC remain visible and retry is explicit, without timed JS propagation. Restore GET-only; deployment/recall enabled explicit actions through current accepted server client. Current full node definition fences old model sampler; explicit selection/focus are separate. Cleanup detaches scoped owners; no new Viewer/analysis clock/server acceptance. Full view/clock/picking/scene-composer/live8891/install/restore cases and T152 remain pending. Evidence validation/t151_workspace_nodes.md.


2026-10-06 T151 node pick display contract: OrbitGlobe.setNodeInteraction accepts injected owns(id,primitive,selectedModel), onSelect(id), onHover(id|null). WorkspaceGlobe.bindNodeInteraction scopes/fences callbacks across boot/replacement/removal/disposal. Existing one handler routes nodeId/node_id before catalog/station; invalid tagged picks are consumed without selection. SelectedModel is true only for own visible shared-layer primitive with currently valid native pose; app verifies current accepted definition/scope/UTC too. Application validates actual source point/label/fleet primitive identity and native buffer before store selection. Hover source style only; no focus, timer, query or physics added. Fleet model metadata adds nodeId, retaining source satelliteId and all render options. Actual GPU/8891 interaction and node hover facts remain pending. Evidence validation/t151_node_picking.md.


2026-10-06 T151 shared camera port: OrbitGlobe cameraState/zoomBy/setZoom/home delegate to its existing cameraMotion/modelLayer with queued-morph/disposal guards. WorkspaceGlobe exposes copied ready/zoom and scoped observeCamera using existing node preRender/view-status paths. Actual node panel passes source wheel amounts/logarithmic slider/home to this owner; cameraReady=false disables home before untrack. Source model range limits/releases unchanged; Earth/map targets reuse existing CameraRangeMotion. Source viewport-fit home and Escape aimAtEarth retained. Node panel refreshScene updates controls without editor/fleet reconstruction. No additional Viewer/clock/timer/handler. Evidence validation/t151_node_camera.md; actual8891/GPU/N005/T151/T152 remain open.


2026-10-06 T151 node lighting/shared view composition: actual V6 injects existing WorkspaceSolar preference owner; node controls read/call same lighting state and observe scoped changes without another preference/query/renderer. Common view panel remains sole mode/imagery/theme controls. NodeScene receives common current theme, copied source-compatible palette and queued-morph guard; setTheme/update on view changes does not regenerate definitions. Source palette eight consumed keys match pinned original both themes. Held callbacks/observers fenced on disposal. Actual assembly boundary tests cover1280x720/1920x1080 lighting synchronization/theme/2D3D/oneViewer/noorbitSIMcommands. Evidence validation/t151_node_view.md; actualGPU/8891/N005/T151/T152/fullT075-T084 remain open. No newbranch/remoteGit/liveserver/native install change.

## 2026-10-06 T151 native node hover facts partial
The actual node workspace publishes a copied source_node payload from current owned geometry and screen coordinates into the existing satellite hover card. Names use literal bounded text; source height_km is displayed directly with canonical UTC, Kepler+J2 simulation, GMST/UTC approximate frame and unverified communications labels. Existing GP ITRF/WGS84 behavior remains separate. Domain-scoped clear avoids erasing the other domain card. The existing mouse handler and node preRender refresh current ownership/geometry; invalid definitions, hidden/foreign primitives, unavailable UTC, morph and disposal hide the card. No additional Viewer, handler, clock, timer, query or command is added to the hover path.
Regression RED preceded implementation. Actual V6 assembly boundary tests at1280x720 and1920x1080 verify one Viewer/handler/card, current source altitude/UTC/quality and morph hide without hover-triggered queries. The fixture now exposes real timer injection for calculation yields, canvas/style, client dimensions and owned collection removal; initial assembly failures were missing adapter capabilities, not weakened production guards. DOM/Cesium/HTTP adapters do not establish actual GPU/browser acceptance.
Final fullNode669PASS5044.4594ms; fullPython649PASS8existingERFAwarnings228.94s(session65406exit0); whitespace check passes. Evidence validation/t151_node_hover.md. T151/T152/T153/N005 and fullT075–T084 remain open. Next scene-composer/snapshot/full restoration assembly, then controlled native0.3 installation and owned8891 capture/restart/restore plus live matrix. Terra/allassets/N001multiwindowCAS/T032/T137auth/equipment/RF/HIL/file bytes/review remain. Same branch; live8891/native-root installation/remote Git unchanged.
2026-10-06 live T151: application periodFor now applies source three-decimal minute rounding, matching existing HTTP node track grid. Dynamics and strict receipt identity/hash/frame/UTC checks are unchanged. Mounted real rounded-contract regression fails before fix and passes afterward; actual8891 source track error cleared. See validation/t151_live_runtime.md.
