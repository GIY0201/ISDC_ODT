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
