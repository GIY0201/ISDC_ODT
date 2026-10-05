# T118 renderer progress, 2026-10-05

Scope: FR026/SC023, original display policy in the single injected Viewer. `globe_view.js` now owns only mode transitions, its imagery layer and callbacks, source-load generation and theme/emphasis values. No propagation, clock, API or runtime state is added. Existing product assembly is not changed yet; T117 aggregate and T118 delegation remain incomplete.

RED: `node --test project_support/tests/browser/globe_view.test.mjs` failed with ERR_MODULE_NOT_FOUND for the not-yet-created renderer. After implementation six behavior tests pass: rapid morph cancellation/north-up/cleanup; latest-only atomic source replacement/overlay preservation; provider and tile failures with explicit NaturalEarth fallback/failed fallback preservation; exact original satellite/light/plain styles; teardown during provider load; first NaturalEarth failure without invented success.

Full Node:230 passed,0 failed,1117.1831ms. Log: `data/workspace/validation/ground_stations/node_t118_renderer.txt`.

Initial full Python:269 passed,154 setup errors,5 warnings,180.27s. Diagnosis `pytest -x -q`: PermissionError/WinError5 listing the system pytest temp root, before catalog fixture setup;8 passed/1 setup error/1 warning44.76s. Not a regression pass. Existing files and test requirements were preserved. A fresh project-owned `--basetemp` full rerun is required and recorded separately in `python_t118_renderer_final.txt`; do not infer its result from partial progress output.

Pending: OrbitGlobe delegation, provider injection/application preboot state, native point/label/path palettes, accessible controls/draft/restore, actual8891 two-resolution validation and Draft publication. No actual new UI or external map load has been verified in this scoped progress. T075 GLB/camera/solar, T076–84 and performance/actual-receiver/download gaps remain open.

Final rerun: `project_support/.venv/Scripts/python -m pytest -q --basetemp data/workspace/validation/ground_stations/pytest_t118_renderer_20261005` ->423 passed,5 existing warnings,174.32s. Fresh workspace temp path resolved the setup permission errors without changing tests or data. FinalNode230PASS and gitdiffcheck pass. This proves scoped renderer/regression only, not UI/map-render completeness.
