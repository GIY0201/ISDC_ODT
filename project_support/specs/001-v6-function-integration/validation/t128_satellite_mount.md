# T128 versioned satellite package mount and owned8891 restart

Same US18/FR027/FR028/SC024 and full T075–T084. Previous2d94bf1 is progress. One additional static mount publishes only model_library/packages/satellite_display/v1; no reference/workspace/runtime directory or API schema is published.

## Regression and runtime evidence

New test_web_assets versioned-package RED: absent path returned frontend HTML200, correctly failing non-HTML assertion. Added exact versioned mount; target3PASS verifies manifest/ISS GLB/thumbnail/Terra bytes and encoded traversal/missing404. Existing recursive local module imports and Python/data boundary tests retained.

netstat established existing0.0.0.0:8891 listener34668. Standard CIM access denied; approved read-only escalation identified venv launcher19916/child34668 and exact uvicorn create_stored_orbit_app factory/host/port command. Captured orbit/bootstrap before mutation in ignored validation files. Revalidated command ownership at stop, restarted only those processes with same venv/factory/0.0.0.0:8891 and hidden window. New launcher3780/listener31524 confirmed with netstat and live /api/health. No port increment or environment configuration change.

Restored saved orbit input/UTC/ground/minimum elevation/paused playrate via explicit selection command. Initial comparison excluding only observation time failed, retaining evidence: anchor_monotonic_s and client_request_id also necessarily changed. Final explicit report lists observation clock, new process playback clock anchor and restore receipt as expected differences; all other state fields, including revision/provenance/input/hash/UTC/ground settings, equal. Never claim raw whole-state equality. `t128_mount_state_restore.json` records result. Prior SIM elapsed14902.742s -> new run193.889s at comparison, run ID/started_at changed; running=true/speed1/scenarioLEO_STANDARD/recordingtrue retained. SIM in-memory continuity is not restored. Stored data not removed.

Live HTTP fetched101objects (manifest +50GLB +50JPG),38015944bytes, all exact worktree bytes/hash and non-HTML200. Includes original Terra; serving its bytes does not repair missing textures or prove rendering. Receipt `t128_mount_http_assets.json` explicitly render_proof=false. No synthetic/alternate asset substituted.

Full Node323PASS1238.6573ms (`node --test project_support/tests/browser/*.test.mjs`). Full Python440PASS5existingwarnings184.08s/exit0 (`project_support/.venv/Scripts/python.exe -m pytest -q --basetemp=data/workspace/validation/ground_stations/pytest_t128_mount_full_20261005`), confirmed session13590 terminal. Fresh ignored basetemp and stdout/stderr/testlogs under ground_stations preserved. Server is left running8891 with restored orbit selection.

## Open acceptance

Actual browser selected-model ready/render/thumbnail/follow/2D3D/hover/singleViewer/fullcatalog coexistence proof not run this turn. Native pick/hover wiring and render-error isolation remain. T128/T127/T122aggregate/T123/T125126/T129 not closed; all50 actual GPU/dependency/Draco/WebP/Terra gates, solar/fullT075–T084 and prior T032/communication/download/AerODT gaps stay open. No new native/wheel/API/PR/merge.
