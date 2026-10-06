# T151 deployment failure matrix and isolated runtime preparation

2026-10-06. Current existing feature branch; parent T075–T084/T151/T152/T153 stay open.

Actual V6 assembly tests now cover two-resolution accepted-server receipt plus denied local deployment persistence: drafts/deployed bytes remain unchanged, the validated server receipt is visible, explicit reviewed retry repeats identical payload and deployment ID, and local acceptance is committed only after storage succeeds. Existing production code passed these cases unchanged.

The real timeout callback is manually invoked at the transport boundary, preserving source15000ms policy. A transport that ignores abort and delivers a late valid receipt cannot update source store/storage. Identical request retry subsequently succeeds. Pagehide disposal aborts pending transport and rejects late receipt; released timers cannot retain ownership. Focused workspace_nodes32PASS1198.7425ms; fullNode683PASS4968.2472ms. These are actual module/DOM/Cesium/HTTP boundary tests, not live backend/GPU evidence.

Prepared an independent ignored project_support/.venv inside isdc_odt_node_worktree. CPython3.14.6, pinned requirements, repaired Rust0.3.0 wheel SHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. pip check passes. Actual factory imports/native extension load/OpenAPI node sample+track/deployment paths succeed. First route introspection incorrectly assumed every modern FastAPI route has .path; corrected the read-only probe to inspect app.openapi paths. Product code unchanged.

In this new runtime environment: node_application/node_http/node_deployment48PASS1existingStarlettehttpxdeprecationwarning2.21s; nativeSGP4golden4PASS0.91s (33officialcases/668states exercised by test); node_samples/node_geometry56PASS1.41s. Total108targettests. Original environment native0.2.0 independently checked and preserved. Receipt data/workspace/validation/ground_stations/t151_runtime_environment_receipt.json records prefix/versions/hash/test count/live_restarted=false. Install and target logs are in the same ignored directory.

Whole Python649PASS8existingERFAwarnings237.12s; session34431exit0. Runtime preparation does not establish live acceptance or constitute a server restart. Existing8891 still runs original application/env.

Next: capture current stored inputs/GP observer/UTC/SIM memory immediately before any controlled owned8891 replacement, prepare exact restore/rollback and run real browser twores acceptance. Full activation-failure persistence/runtime evidence, Terra/allassets/N001/N005/T032/T137auth/scenario integration/equipment/RF/HIL/file-byte/review requirements remain. No branch creation/remoteGit/native modification to original env/live-server change.
