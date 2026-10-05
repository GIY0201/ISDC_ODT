# T134 solar display input buffer (2026-10-05)

Implemented standalone SolarTimeline; not yet assembled into V6. Original T075–T084 goal remains open.

## Implementation and fidelity

Existing createUtcCodec supplies canonical UTC and SI-second/leap arithmetic. Existing solarSamples transport returns the pure native-frame solar calculation; no browser ephemeris or new propagator. setContext accepts the existing display owner key/UTC/leap identity, with optional solar EOP identity. First valid response pins solar EOP when the caller has no solar hash; all subsequent responses retain it. Stored-orbit EOP identity is not mistaken for the independent solar EOP snapshot. The upcoming T135 assembly owns catalog→stored→scene priority.

Query601 rows at1SI-second cadence, normalize adjacent vector interpolation, retain exact endpoints and never extrapolate. Validate request ID/schema/status/frame/model/units/hash/start/end/count/cadence/quality and every row. Copy and freeze accepted input once. Only two buffers retained for overlap/reverse access; sampleAt returns a small copied row and does not mutate, notify or query. No Viewer, Date-current-UTC, timers, RAF or playback/rate ownership. Every display time is supplied explicitly.

At120SI-seconds remaining, prefetch a480SI-second shifted buffer. When supplied UTC decreases, the analogous lower-bound prefetch is used; cached overlap remains available. Covered in-flight requests coalesce display changes and publish the latest supplied UTC. Out-of-range seek aborts/replaces obsolete work. Owner/hash changes, clear and destroy fence late completion. Failures clear solar input and suppress per-frame retries across the failed request range; explicit retry is provided. Missing and antipodal/degenerate interpolation cannot invent a direction or silently requery into success.

## Evidence

- Missing module RED: `data/workspace/validation/ground_stations/t134_solar_timeline_red.log`.
- Degenerate interpolation RED: `t134_solar_interpolation_red.log`. Initially a missing interpolated direction triggered a new request at that UTC; test exposed unintended apparent success. Existing-buffer invalid interpolation now clears input, reports error and suppresses retry storms.
- `node --test project_support/tests/browser/solar_timeline.test.mjs`: 10 passed,202.4369ms (`t134_solar_timeline_target.log`). Covers601/endpoint/normalization/copies,60x-equivalent supplied times/prefetch/coalescing,seek/reverse,late/abort,leap/fractions,17malformed contracts,first-response hash pinning/failure/retry,reverse overlap,quality/degeneracy and in-flight disposal.
- `node --test project_support/tests/browser/*.test.mjs`:344 passed,1364.4604ms (`t134_solar_node.log`), after final interpolation repair.
- `project_support/.venv/Scripts/python -m pytest -q --basetemp=data/workspace/validation/pytest_t134_solar_20261005`:471 passed,8warnings,204.02s (`t134_solar_pytest.log`), session6878 terminal exit0. Existing Starlette deprecation/ERFA date warnings. No restart on observation timeout.

Actual native-query-to-JavaScript consistency: SolarGeometryQuery generated601 rows for2020equinox/two solstices and2016leap, using local frozen IERS-A/leap files. Pure solar_directions generated2401 exact quarter-second rows per600SI-second interval. The implemented SolarTimeline loaded each query result, and actual sampleAt was compared to all9604 exact vectors using atan2(norm(cross),dot). All pass1e-6rad; maximum2.4115991620879543e-10rad. Inputs `t134_solar_exact_inputs.json`, receipt `t134_solar_interpolation.json` are ignored local evidence. EOP c672540e026d3cd4840c0858d4ce2bc4a18c3bc9751f9636c3285e11950d58a1; leap6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7. This is sampled model consistency, not independent ephemeris accuracy, whole-domain accuracy or live UI/performance acceptance.

Existing same-feature prerequisites/constitution/checklist remain valid; interface refinement documented in contracts/solar_display.md without changing wire API. No extensions.yml. Whitespace checks pass. No server/8891/runtime/native/wheel/PR/merge changes. T135 original preference/CSS/singleViewer assembly, T136 actual two-resolution acceptance and T137 Draft review remain open. US18/Terra, all macroT075–84, T032/performance, equipment/real communication/HIL/AeroDT and actual export bytes remain open.
