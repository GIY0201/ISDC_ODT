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
