# T151 node hover facts

2026-10-06. Local component and actual V6 assembly boundary verification; live8891 and GPU acceptance remain pending.

The existing source-node picking route, current accepted native sample buffer and canonical common UTC feed a copied source_node variant into the one existing satellite hover card. The source node altitude is the native height_km value, not a WGS84 conversion of approximate fixed coordinates. Display explicitly identifies Kepler+J2 simulation, GMST/UTC approximate coordinates and unknown real communications. GP hover preserves its ITRF/WGS84 calculation and NORAD label.

Ownership is rechecked using the existing preRender event. Current definition/hash/provenance/UTC and visible primitive checks prevent stale or foreign geometry. Queued/physical morph, missing geometry, mouseleave and disposal clear owned presentation. Domain-scoped clears preserve the other hover domain. Hover cannot dispatch a query/command, change selection or move the camera.

Tests:
- satellite_hover.test.mjs: literal bounded name, native altitude/UTC/provenance, no Cesium conversion, invalid frame/quality/commit/hash/definition/status/numeric values, domain clear.
- catalog_scene_globe.test.mjs: copied screen and current primitive refresh/expiry through the existing handler.
- workspace_nodes.test.mjs: current copied geometry, no hover queries, unknown UTC/disposal; actual V6 assembly1280x720/1920x1080 one-card/Viewer/handler/current facts/morph hide.
- workspace_fixture.mjs: optional real timer adapter for bounded calculation yields, canvas/style, dimensions and collection removal. These are DOM/Cesium boundaries, not simulated physical assertions.

Commands/results:
- node --test project_support/tests/browser/*.test.mjs:669 passed,0 failures,5044.4594ms.
- Existing Python venv python -X utf8 -m pytest -q with unique basetemp/cache and unchanged isolated0.3 wheel:649 passed,8 existing ERFA warnings,228.94s; session65406exit0.
- git diff --check:pass.

Logs: data/workspace/validation/ground_stations/t151_node_hover_full_node.log and t151_node_hover_full_pytest.log. Initial focused RED/assembly adapter failures and repaired focused run remain in the same ignored directory.

T151 and fullT075–T084 remain incomplete. Next scene-composer/snapshot/full restoration and controlled owned8891/native installation/live acceptance. No live restart, native-root installation, branch creation, push or merge occurred.
