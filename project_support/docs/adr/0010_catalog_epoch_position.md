# ADR 0010: Catalog epoch position, explicit IERS-A

Status: accepted for US11, 2026-10-05.

Catalog selection uses existing server GP search/cache, the validated OMM parser, Rust WGS72_AFSPC SGP4, and existing precise TEME-to-ITRF conversion. POST /api/catalog/position accepts only group and catalog_number. It calculates one position at the server GP epoch using the shared bounded native executor. It never selects a stored input, advances runtime UTC, or starts playback/SIM.

The historical stored input manifest and IERS-B remain unchanged. The deployment prepares a separate hash-pinned IERS-A/UTC leap snapshot from installed astropy-iers-data with project_support.tooling.prepare_catalog_geometry. No automatic downloads or snapshot overwrite. Manifest paths are confined. Missing/broken EOP prevents catalog position display; ordinary catalog search and historical calculations remain available.

Response provenance: normalized_gp_sha256 (normalized server GP JSON, not upstream raw bytes), eop_sha256, leap_sha256, source/fetched_at/stale, epoch UTC, ITRF metres, model profile and separate UT1/polar quality final_b/observed_a/predicted_a. IERS-A prediction is disclosed; this is an epoch model position, not a measurement or current communication state. Failed/out-of-range/demo data are not given a synthetic marker.

V6 injects the result into the single existing Cesium viewer. Selection clear restores the current stored sample. Request cancellation and generation fencing reject obsolete replies; running native work may finish within executor limits. The existing calculation computes an unused elevation at a neutral reference point; only Cartesian position is returned. No ground station measurement is implied.

Alternatives: senior browser synthetic/GMST fallback excluded from precise-frame contract. All-catalog rendering, catalog playback, full ground station selection, 3D/sun models and T032 performance remain outside this increment and tracked in T075.

References: https://docs.astropy.org/en/stable/utils/iers.html and contracts/catalog_position.md.
