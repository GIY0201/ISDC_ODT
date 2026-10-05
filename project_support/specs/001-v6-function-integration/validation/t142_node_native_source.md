# T142 native source-equivalent node dynamics

Existing Rust crate now has additive `node_dynamics.rs` and `propagate_nodes(definitions_json, node_indices, unix_millis)` export. Source Kepler Newton iterations/J2 secular drift, rotation, GMST, WGS84 geodetic, low-precision Sun, cylindrical shadow and LVLH equations are ported from unchanged ISDC-ODT1a1e002. Existing SGP4 exports/profile/math/limits are unchanged. No server/UI/native installation occurred.

## Regression and source evidence

- New Rust tests first failed with unresolved `node_dynamics` import (exit101), before product edits. Original capture option test first failed with ENOENT instead of the intended invalid-grid error, before tooling changes; it now passes.
- Original91 fixture remains unchanged; recapture using default options remains byte-identical. Capture tooling now accepts explicitly bounded additional time grids/orbits, still verifies both original source hashes before evaluation. Default behavior and CLI are unchanged.
- Two independent extended captures were byte-identical:557205bytes/SHA256e849be891febfcf77d43cf7c1d362ca12810485ab719ec59bfa9c5807a489eea. Additional fixture `original_node_native_offsets.json` contains116 receipts, including42 timed states for seven orbits at offsets[-31536000,-0.00025,0,0.00025,600,31536000]seconds. Added orbits: altitude63621.863km/e0.9/inc63.4, altitude120km/e0/inc180, altitude199999.999km/e0/inc90, all explicit epoch1791151272000 and source angular inputs stored in the fixture. Original source/hash/units/frame provenance is embedded.
- Tests compare all20 existing plus42 additional original state results across31 little-endian float64 columns (248bytes). Position/radius/height tolerance1e-7km, velocity1e-10km/s, Sun/LVLH1e-10, angles1e-7degrees. This establishes implementation consistency, not physical orbit accuracy.
- Negative/fractional/year offsets remain finite; rotation length/LVLH orthogonality/unit norms/source osculating energy identity pass. Invalid eccentricity/inclination/perigee/apogee/epoch and unsupported Date range fail explicitly, with NaN only in internal error rows. Repeated rows preserve alignment and owned output; no fallback positions. Raw native definitions require finite numeric orbital fields/Unix-ms epochs; canonical UTC/leap-second rejection is the T143 adapter responsibility.
- max240 prepared definitions,50000 rows,601 rows per definition enforced; successful50000-row boundary and malformed/nonfinite/alignment/index/241definition/602sample/50001row rejection exercised.

## Validation and installation boundary

Full `cargo test --locked --manifest-path digital_twin/simulation/orbit_propagation/Cargo.toml` passed9 integration tests:5 node,3 existing catalog,1 existing official SGP4. Existing scalar/batch668-offset equivalence remains covered. Node tests finished0.17s; this is test runtime, not product latency evidence. Compiler emitted the existing MSVC linker-output warning. Project-local Rust environment/target and project Python used; log `data/workspace/validation/ground_stations/t142_native.log`, initial RED `t142_native_red.log`.

Full Node369PASS/0fail1438.2249ms, log`t142_node.log`. Full Python471PASS/8existingwarnings219.57s; session66925 finished exit0, log`t142_pytest.log`, unique project-local ignored basetemp. Python uses the previously installed wheel and does not validate the new export installation. `rustfmt` attempt reported component unavailable in the existing1.98.1 toolchain; no installation or formatting success is claimed. Whitespace check passed.

Frame/inertial/time constants and module metadata are explicit; missing constants produced a separate regression-first unresolved import RED, then final full Rust tests passed. Final Rust-only metadata additions were compiled/tested by the final native receipt; browser/Python source is unchanged since full-suite receipts.

No new wheel was built/installed; crate/package0.2.0 metadata and installed original wheel remain unchanged during this source stage. T144 must version all package/native metadata consistently before building and verify new Python export and old exports in a clean isolated install. Rust compile/test evidence cannot replace those installation receipts.

T143 readonly Python/native/HTTP adapter, T144 wheel, T145–153 store/editor/timeline/scene/accepted T079 server deployment/live/review remain open. Frame is source pseudo-inertial/GMST-only fixed, UTC≈UT1, not ITRF/TEME; cylindrical shadow and osculating velocity preserve source assumptions. Whole T076/T075–T084/Terra/all50/T137auth/T032/equipment/RF/HIL/download/AeroDT are not complete. Server0.0.0.0:8891 and user browser state preserved.
