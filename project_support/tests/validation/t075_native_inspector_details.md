# T075 native GP inspector details

## Scope and reuse

Pinned source inspector displays WGS84 latitude/longitude/ellipsoid height and TEME speed. The previous V6 catalog contract lacked those fields. This extension is necessary to close that source feature gap; unavailable labels were honest intermediate behavior, not complete functionality.

Existing Rust0.3.0 `propagate_tle`/`propagate_omm` already emit six TEME components per row (position km, velocity km/s). `communication/native/orbit_adapter.py` preserves all six in readonly byte-owned batches. The extended calculation reuses that one native propagation, the existing injected IERS-A TEME→ITRF transformation and compiled ERFA `gc2gd(1, ITRF_m)` for WGS84 geodetic coordinates. TEME speed is the norm of existing native velocity components, not ITRF speed or ground speed. No new propagator, JS physical calculation, runtime owner, clock or Viewer is introduced.

## Contract

New isolated `digital_twin/contracts/catalog_details.py` defines frozen detail rows; original `OrbitSample` and serialized stored orbit fields remain unchanged. New simulation projection `digital_twin/simulation/catalog_details.py` validates aligned finite vectors and WGS84 latitude±90/longitude±180/height≥0/speed≥0. Failure rows have null geodetic/speed/position/elevation and explicit original native error. Bool/nonfinite/unknown profiles are rejected. Existing stored scalar calculation and visibility vector calculation retain their old return shapes.

`create_orbit_calculation` exposes additive `catalog_details`, sharing the original one-propagation scalar kernel. Catalog position/samples use it when available. Existing injected calculators without that capability preserve legacy response shape. Default deployment calculator has the capability.

Position adds:

```
details_version: 1
details_profile: WGS84_ERFA_GC2GD_TEME_SPEED
details_units: {latitude: deg, longitude: deg, ellipsoid_height: m, teme_speed: km/s}
geodetic: {latitude_deg, longitude_deg, ellipsoid_height_m, ellipsoid: WGS84}
teme_speed_km_s: number
```

Samples adds the same metadata and each row's `geodetic`/`teme_speed_km_s`, null on failed rows. Request schemas, response version1, existing fields, GP/EOP/leap hashes, UTC, observer conditions and error codes remain. The existing HTTP query validation remains the boundary; malformed typed detail rows cannot be serialized as successful responses.

Root updates `catalog_geometry.js` and `catalog_timeline.js` validators with optional additive details support, requiring all explicit version/profile/units/ranges when extension is present. Exact native observed row details carry `details_utc`; the displayed interpolated position UTC stays separate. Inspector formatting only reads validated owner data, labels exact detail UTC and converts native height m to displayed km; it does not interpolate geodetic or speed. Different pinned UTC clears details until matching native data arrive.

## Compatibility/build

No Rust source, package version, wheel or ABI change is needed: existing native0.3.0 already supplies velocity. There is therefore no wheel build/reinstall cost in this implementation, and no speculative rebuild time claim. Activating changed Python/JS in the running server is root's preserved-state deployment step. Old clients ignore additive fields. Old injected calculators continue legacy shape; new validators retain missing-extension compatibility while rejecting partially declared/malformed extension. Existing serialized stored runtime contracts are unchanged.

## Evidence

- Tests were RED before the missing helpers/method and before HTTP publication changes.
- `pytest test_catalog_details.py + test_catalog_position.py + test_catalog_samples.py + test_orbit_batch.py`: 46 passed, 5 existing warnings, 11.48s (first eleven detail tests).
- After adding strict contracts and trusted-coordinate regression, `pytest test_catalog_details.py + test_orbit_geometry.py`: 31 passed, one existing warning, 3.40s (13 detail tests).
- Equator/pole analytic WGS84 golden coordinates, analytic3/4/5 speed, official Vallado TEME velocity norm, published Vallado ITRF fixture within existing0.3m tolerance, ERFA inverse roundtrip, finite/bool/shape/center/range rejection, failure nulls, typed immutable validation, original OrbitSample four-field serialization and one native propagation verified.
- Actual isolated `create_app`/HTTP position and samples: epoch/sample0 detail values identical; existing GP observer geometry preserved; stored state and SIM run ID unchanged.
- Root-coordinated inspector tests:9 passed including sample detail UTC distinct from interpolated display UTC and malformed-unit hiding, existing actual station/time assembly.
- Receipt: ignored `data/workspace/validation/catalog_details_http_receipt.json`. Native0.3.0 observed position HTTP9.65ms,601sample HTTP347.84ms in one cold isolated call; these are observations, not throughput guarantees or live network/GPU evidence.

No live server/browser/restart/Git operations were performed by this agent. Root owns actual8891 deployment, broader suites, browser evidence and ADR registration.
