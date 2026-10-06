# N003 / T077 native communication input boundary

2026-10-06. Fix source OISL input omission without introducing a browser/Python propagator or changing native ABI. Full T077/T148/T075–T084 and actual node workspace acceptance remain open.

## Verified source need

Original source user_application/web/scripts/nodes/links.js calls resolveLinks(nodes,states,histories,date). It passes original equipmentSpec and activeOislTerminals into oisl.pointingTo/linkGeometry/chooseTarget/advanceTerminal, then combines pairState/margins. oisl.pointingTo uses target-owner inertial.r in km, relative inertial.v in km/s and owner basis.x/y/z. Earth LOS uses inertial.r; Earth-fixed metres cannot substitute. Source phase histories and calculation date must be supplied explicitly by the owner; no actual link success can be invented by renderer callbacks.

Existing Rust node layout31 doubles already contains pseudo-inertial r0:3,v3:6 and LVLH axes12:15/15:18/18:21. Native adapter validates finite data and unit-vector norms. API previously omitted r and axes. Add inertial_position_km and lvlh_basis{x,y,z} to sample/track rows, copied directly from those columns; failed rows expose nulls. No native export/profile/wheel/ABI or physical equations are changed. Frame remains SOURCE_MEAN_EQUATOR_EQUINOX_APPROX and fixed frame remains EARTH_FIXED_GMST_UTC_APPROX, quality engineering_assumption.

## Readonly port

communicationStateFor(currentDefinition,{utc}) is separate from geometryFor display interpolation and forwarded by sample/shared display owners. It reuses their existing immutable validated buffers, hash/full-definition/canonical UTC fencing. Return only exact valid row with finite nonzero r/v and orthonormal right-handed axes (1e-7 boundary tolerance); missing/failed/stale/outside/between-row/noncanonical inputs return null. The port maps into original inertial.r/v, basis and geodetic longitude/latitude/altitude names with exact source units. geodetic.velocity is original source norm(v)=Math.hypot(v0,v1,v2), a readonly speed projection, not new orbital dynamics; all20source states match including this scalar. Do not normalize/reconstruct axes, use preceding orientation or mix interpolated velocity/positions into link calculations. Existing marker interpolation remains unchanged even when communication inputs are unavailable.

Copies returned to consumers cannot mutate accepted buffers; readonly queries issue no HTTP/clock/commands. No additional per-row mutable state store is introduced. The additive vectors enlarge JSON node receipts; actual bytes/frame/serialization costs and whole240node acceptance still require T151/T152/T032 measurements. No performance pass is inferred here.

## Evidence

RED before edits: Python1FAIL KeyError inertial_position_km and browser3FAIL missing communicationStateFor, n003_python_red.log/n003_node_red.log. Source20-state fixture tests verify native column mapping/copies and failed-row nulls in samples/tracks. Browser20-state mapping verifies inertial/basis/geodetic values/copies; missing/malformed/zero/nonorthogonal/left-handed/nonfinite axes, missing vectors, changed definitions, out-of-range/error and fractional UTC fail closed. Shared actual timeline test verifies readonly forwarding, copies, clear/dispose and no extra transport. Python query→actual JS buffer subprocess verifies original source vector/basis mapping with injected native rows, not actual live native/GPU/TCP.

Initial browser2PASS1FAIL caught source geodetic.velocity omitted from the mapped view; repaired by the unchanged source norm(v) projection. Focused Python55PASS/1existing Starlette warning2.01s; browser30PASS1452.6804ms. Final full Python645PASS/8existing ERFA warnings/163.79s(session83838exit0), Node559PASS/3084.8885ms; JavaScript syntax and staged whitespace gates PASS. Logs data/workspace/validation/ground_stations/n003_pytest.log and n003_node.log.

## Next / remaining

Original pure oisl.js equations/phase transition tests and nodes/links.js source resolver must next be ported and source-golden verified, using explicit common exact calculation UTC/current full roster/histories and the source-native port. Where the display UTC lies between existing samples, the producer must request matching native input or show unavailable; this step does not invent a cadence or approximate communication state. Verified scoped snapshots must then reach T148 renderer; true test callbacks are not a production verifier.

N003 input omission is locally repaired, but actual calculation producer/T077/T148/T151/T152 remain open. Whole source network/ICD02/ground/fabric, T079 data UI, T075Terra/all50/T078–84/N001/T137auth/T032/real equipment/RF/HIL/download/AeroDT preserved. Actual8891/native0.2.0 installation/user browser/remotePR/merge unchanged.
