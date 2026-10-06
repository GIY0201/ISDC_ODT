# T081 source PoC scenario component migration

Source: HyeonJun9138/ISDC-ODT commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`.

## Implemented and verified

- Original scenario catalogue, full 40-node PoC definition, five-step fault/reroute/recovery actions and KPI criteria migrated.
- Original pure constellation/station/mission assembly reuses existing injected V6 model factories; no alternate propagation or runtime.
- Original scenario runner reuses injected SIM, node store, accepted deployment, mission planner, fabric and data/security owners. Existing body retains original action logic.
- V6 run/composer/compare presentation exposes definition lookup and review, explicit confirmed setup, playback, pause, forward advance, speed, steps, module-derived KPI comparison, verdict and ICD action log.
- SIM clock reads existing runtime. Analysis-clock follow is optional and explicit through supplied existing clock owner. Persisted playing records restore paused without automatically restarting timers or SIM.
- Dependency preflight executes before SIM reset or draft mutation; missing accepted-native/module bridges must fail with a clear message.

## Evidence

1. RED: initial focused migration test failed ERR_MODULE_NOT_FOUND for scenario_assembly.js.
2. Node focused suite `node --test project_support/tests/browser/scenario_migration.test.mjs project_support/tests/browser/scenario_assembly.test.mjs project_support/tests/browser/scenario_kpi.test.mjs project_support/tests/browser/scenario_runner.test.mjs`: 19 PASS.
3. Source assembly tests retain five pinned assertions for40nodes/roles/equipment/displaymodels/referenceerrors/stations/missiondeadlines/narratives.
4. Source runner tests retain five pinned sequences including all five steps, fault targeting, reroute, scoped service request and recovery verdict. Transport fakes are used; this proves reused runner behavior, not live native integration.
5. Isolated source catalogue/router tests `project_support/.venv/Scripts/python.exe -m pytest -q project_support/tests/test_source_scenarios.py`: 2 PASS. Existing Starlette deprecation plus shared-cache warning occurred; no failure.

## Source parity

- `user_application/configs/scenarios.py`: SHA256 `724cc2fca27d04a4fc17845705062a018a171b5a47fb8d0ea512e676e2e90a2c`; pinned source bytes identical.
- `communication/http/scenarios.py`: SHA256 `c4e18098fd8b64f1b4ba10dbcb059b56a6cd79777082990a9bb33d556076f677`; pinned source bytes identical.
- `digital_twin/verification/browser/scenario_kpi.js`: SHA256 `ae12a47b7498b4a56c948c5aa6648ab078981d5dcfdbbe9f44c5caae7b75223e`; pinned source bytes identical.

## Remaining acceptance

T081 remains PARTIAL. Parent assembly, full regression, server8891 reload and actual browser acceptance are still required. Current accepted-native mission owner uses paused GP display UTC; a scenario SIM plan must acquire fresh accepted native geometry/windows at actual SIM UTC. Never relabel GP samples as SIM samples. No scenario setup, fault, mission commit, data request or SIM reset was sent to the active live server during this component migration. Live user drafts/storage and current run were preserved.
