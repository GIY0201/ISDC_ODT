# Solar display contract (US19 / T075)

FR029/SC025; R003/R007/R010. Original source1a1e002 globe.js886–969 and original lighting preference binding. Model/hover/Terra acceptance and T076–84 remain open.

## Pure calculation

`digital_twin/simulation/solar_geometry.py:solar_directions(instants,eop)` accepts aligned UtcInstant and EarthOrientationPoint tuples. Reject nonfinite time/EOP, mismatched lengths or mixed EOP/leap identity. Empty tuples return an empty readonly(N,3) result. Output immutable owned `direction_to_sun` in ITRF, unitless normalized, same UTC rows and snapshot hashes. Existing caller initializes local leap data; no import-time initialization, IERS lookup, downloads, file access, runtime mutation or new propagation engine.

Use Astropy get_sun GCRS geocentric vector and ERFA c2t06a(TT,UT1,xp,yp), with explicitly injected delta_ut1_utc. This is ERFA ephemeris display geometry with IAU2006/2000A terrestrial transform; observed dX/dY corrections are not applied. Never rotate this vector using the TEME adapter or pseudo-fixed fallback. Invalid or missing results are unavailable, with no synthetic day-angle vector.

## Sampling and clock

Readonly `POST /api/solar/samples`: explicit start_utc, `count1..601`, fixed SI `step_seconds=1`, bounded client_request_id. No satellite GP required: solar geometry belongs to the shared display UTC, independent of satellite identity. Canonical UTC rows, frameITRF, direction vectors, EOP/leap hashes, row quality and model metadata returned; out-of-snapshot range fails explicitly. No implicit current wall-clock timestamp.

Frontend owner uses normalized linear interpolation only between valid adjacent1SI-second samples from one hash-pinned result. Never extrapolate. Response bounds/row UTC/norms/hash/frame/model are checked; leap-aware codec already used by orbit playback is reused. Exact endpoints stay exact. Record maximum angular interpolation deviation against exact calculations at fractional instants, including leap, solstice/equinox and snapshot edges; required model-consistency bound1e-6rad (not ephemeris accuracy).601rows cover600SIseconds even at60x; prefetch the next buffer when120SIseconds remain, retaining valid current data until replacement. Seeks outside range hide until exact requested UTC is ready. Requests coalesce to latest display context and generation; late responses cannot relight cleared/changed contexts. No per-frame HTTP, wall-clock clock or per-satellite solar queries.

Follow the existing globe's display owner: valid selected catalog geometry first, otherwise valid stored-input geometry, otherwise whole-scene snapshot UTC. Selection/scene/stored change or unavailable geometry reconciles that priority; different whole-scene UTC remains separately labelled. Sunless globe with no valid UTC stays unlit. Cache samples only as immutable display input, never a second runtime state authority.

## Renderer and original presentation

`digital_twin/visualization/solar_display.js` receives Cesium, existing Viewer, overlay, monotonic projection clock and copied current solar result. One postRender listener, no Viewer/timer/HTTP imports. Direction towardSun is positive; DirectionalLight emitted rays are its negative. Hide stock Cesium sun and set dynamicAtmosphereLightingFromSun=false while owned solar presentation active. Restore prior owned scene/light flags on disposal.

Retain original50ms projection throttle,80000000m virtual point, screen margin45px, camera dot/earth-ray occlusion and2D hiding. Every UTC update changes the light/vector; throttle projection only. Reuse original overlay visual/CSS. Unavailable/missing/nonfinite direction clears overlay and disables dependent shading with a visible reason, no stale success. Tangency and camera-inside edge behaviour are tested. Original light-theme/preference policy and storage/cross-window behaviour are retained with removable listeners and storage-denial handling; do not turn on unrelated Cesium wall-clock sunlight.

## Validation

Regression first: scalar/batch/unitnorm/immutability/no implicit downloads/invalid rows/leap/EOP identity; frozen Astropy ITRS oracle and published ERFA rotation fixture. The oracle shares ERFA and proves wiring, not independent astronomical accuracy. Browser renderer sign/subsolar/occlusion/offscreen/morph/resize/disposal; buffer interpolation/range/60x/reverse/seek/late/clear; actual V6 oneViewer and readonly state. FullPython/Node and real8891twores screenshots, source metadata, failure and restore evidence required before US19 completion. Public endpoint ADR and exact owned8891 restart/state preservation required. Draft review separate; no auto merge.

Sources checked2026-10-05: [Astropy get_sun](https://docs.astropy.org/en/stable/api/astropy.coordinates.get_sun.html), [ERFA c2t06a](https://raw.githubusercontent.com/liberfa/erfa/master/src/c2t06a.c). No system accuracy claim is inherited from library documentation.

## T134 application interface and bounded cache
`createSolarTimeline(api,onDisplay,notify,{requestId})` exposes setContext, readonly sampleAt, snapshot, explicit retry, clear and destroy. Context supplies a stable existing owner key, UTC and frozen leap SHA. An optional EOP SHA refers to the solar calculation snapshot, not an unrelated stored orbit EOP snapshot. If omitted, the first validated response pins solar EOP identity; subsequent prefetch/seek responses must retain it until context is cleared or its identity changes. Catalog and solar may share an EOP snapshot; independent stored-orbit geometry is never silently relabelled.

Retain at most two copied immutable601-row buffers for overlap and reverse access. Existing owner updates setContext with display UTC; no play/rate/tick/frame API or separate timer. Prefetch480SIseconds ahead at120remaining; for explicitly decreasing supplied UTC, prefetch480SIseconds earlier when120remain toward the lower boundary. A covered request coalesces subsequent UTC changes and publishes latest supplied UTC on arrival. Outside all available/pending ranges abort and replace obsolete work. clear/disposal or owner/hash change fences all late responses. sampleAt performs no requests, notification or state mutation and never extrapolates. Failed request or degenerate interpolation clears lighting input, suppresses automatic retries within that failed range, and permits explicit retry. UI retry and reason rendering are T135.
