# T143 node query preparation and readonly application query

## Scope and retained goal

Adds per-node UTC grids to the existing native adapter and a readonly NodeGeometryQuery. T143 remains unchecked: strict HTTP schemas/routes, browser transport and their regression proofs are still pending. T144 actual additive wheel installation and T145–153 UI/deployment/live gates remain pending. This does not close T076 or full T075–T084.

## Implementation

- Shared Gregorian Unix-ms preparation in foundation/orbit_time.py preserves the previously tested leap-row failure policy. No quasi-JD leap-day stretching.
- Native adapter accepts separate 1..601 grids per definition, enforces 240 definitions/50000 rows and retains node-major alignment and one native batch call. Common UTC formatting is request-local deduplicated preparation.
- Source static two-body period is rounded to 0.001 minutes using source positive rounding; original perigee/apogee/e/inclination bounds retained. Tracks retain 120 intervals/121 vertices and Date TimeClip integer milliseconds, with explicit unsupported leap center.
- Application query snapshots definitions before executor yield, uses explicit SI/UTC sample grids, checks native profile/frame/time/identity/hash/UTC/shape alignment and returns fresh JSON-safe rows. Failed rows have no numeric geometry. Track path is hidden if any row fails. Source fixed km is converted to m once, inertial velocity stays explicitly km/s.
- No timed Python propagation, runtime ownership, wall clock, HTTP mounting, browser edit or current server/native installation change.

## Evidence

Regression-first static module collection failed (t143_track_red.log); target preparation 29PASS (t143_track_target.log). Query collection failed for missing module (t143_query_red.log). A reserved pytest parameter name was corrected during collection, not a product failure. Final targeted adapter/static/query tests:52PASS0.62s (t143_query_target.log).

Query test doubles prove decoding, request assembly, leap/error handling, source periods/track time convention, copy isolation, metadata rejection and caps. They do not prove new wheel installation or independent physical accuracy. Source golden fixture is unchanged.

Whole Python523PASS8existingwarnings219.71s, session27785exit0 using fresh short ignored basetemp (t143_query_pytest.log). Whitespace inspection passed; original91 fixture unchanged. Node369PASS1399.0046ms (t143_query_node.log). Logs live in ignored data/workspace/validation/ground_stations.

## Remaining gates

T143 HTTP/browser transport and read-only runtime proofs; T144 versioned clean native wheel; T145–153 full editor/store/scene/accepted T079 deployment/two-resolution UI/review. Original approximation frame/time metadata is preserved, never labelled ITRF/TEME. Terra/all50, Git credential-dependent publication, full T075–84, T032, equipment/RF/HIL, download and future AeroDT remain tracked separately. Fixed8891 server and browser session preserved.

