# ADR 0034 Precise catalog points for mission boundaries

Status: internal query prerequisite; full T078 acceptance pending.

Expose arbitrary increasing UTC instants through CatalogGeometryQuery using its existing injected Rust SGP4 and precise EOP calculator. Reuse its existing catalog input parser/GP digest and executor. A1..601 point grid is invocation-local; do not add propagated-state storage, source JavaScript propagation, another clock or Viewer. Existing regular samples and track behavior remain unchanged.

Receipt keeps precise ITRF, WGS72_AFSPC calculation profile, EOP/leap snapshots, input GP hash, source/stale metadata, request id, aligned UTC, per-row EOP quality and explicit errors. Grid and provenance must be captured before execution; invalid GP identity/hash/time/report rejects, while supported native row failures are explicit partial/error with null position. Mission producers must reject incomplete required grids.

Source nodes still declare their approximate Earth-fixed frame. This query does not unify or silently reinterpret their axes as ITRF. External crosslink composition must retain both input metadata and disclose any source geodetic/Earth-fixed comparison approximation. EOP-correct catalog positions remain authoritative for catalog display/query; no precision downgrade is authorized by this prerequisite.

Tests and installed-native evidence: feature validation/t078_catalog_planning_points.md. No new public HTTP route or production assembly is mounted here.
