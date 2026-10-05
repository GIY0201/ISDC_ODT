# ADR0016: readonly solar display samples

2026-10-05, accepted for US19/T075. No original endpoint is removed or redefined.

The original globe indicator computes an inertial vector in the browser and falls back to a synthetic day angle or TEME pseudo-fixed rotation on failure. Selected precision/time ownership requires a terrestrial solar vector at the shared display UTC, separate from native satellite propagation. The original indicator/light/preference behaviour is ported at its renderer boundary.

Add POST `/api/solar/samples`, explicit start_utc, integer step_seconds1/count1..601 and nonblank client_request_id1..128, extra fields forbidden. This query reads the existing hash-checked EOP snapshot and reuses the bounded executor; it does not select input, advance runtime/SIM or depend on an installed Rust propagator. Explicit injected query/provider is preserved; deployment lifespan uses the catalog geometry snapshot for both queries. Missing/invalid snapshot503, outside EOP range/invalid wire422, queue unavailable503. Invalid NaN/Inf validation inputs are omitted from error details so JSON error serialization succeeds.

Response schema_version1, frameITRF, canonical start/end/row UTC, fixed1SI-second grid, valid unit direction_to_sun and per-row EOP quality, EOP/leap hashes, solar_modelERFA_builtin/frame_transformIAU2006_2000A/observed_cip_offsetsfalse/purposedisplay_geometry. GCRS get_sun/c2t06a avoids wrong-frame fallback. This is a model, not measured solar direction, independently bounded ephemeris, eclipse or power result.

The planned browser buffer interpolates only valid neighbouring samples, hides outside range and fences latest-context responses. Current implementation adds transport and calculation only; actual solar renderer/preferences/clock reconciliation remain T133–136. Server deployment requires exact owned8891 restart and state receipts; no auto merge.
