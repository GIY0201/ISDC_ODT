# T151 actual node deployment UI failures and restoration

2026-10-06. Existing deployment client/source constellation store in the actual V6 assembly with DOM/Cesium/HTTP boundary adapters. No live API/GPU acceptance claim.

Found a composition defect: after409 the original client correctly reread server state and required explicit synchronization, but the UI disabled deploy/recall indefinitely. An ordinary refresh could not clear a genuine remote mismatch. Existing client retry/receipt/revision behavior is unchanged. The UI now displays the validated server receipt using literal text and offers explicit reviewed reapply or recall actions only when loaded, server-known, not busy and syncRequired. Reapply requires nonempty drafts; reviewed recall requires a nonempty server batch. Regular deploy/recall remain disabled during mismatch. All commands reuse original client authorization; no automatic overwrite or background POST.

Tests were added first and failed for missing reviewed controls. Real V6 buttons at1280x720/1920x1080 verify409→GET→explicitPOST with current revision, preserved complete drafts/old local deployment until acceptance, copied source acceptance, server review and owned listener cleanup. A server-only batch can be explicitly recalled without creating a draft. Lost accepted response retries the identical payload/ID; source persisted drafts and accepted copy are restored in a new composer workspace by GET only, with confirmation explicitly false until an acknowledged command. No new store/clock/Viewer or server calculation/API change.

Whole Node679PASS4711.3867ms. Whole Python649PASS8existingERFAwarnings234.03s; session83514exit0. Ignored logs: data/workspace/validation/ground_stations/t151_deployment_reapply_red.log, t151_deployment_recall_red.log, t151_deployment_restore.log, t151_deployment_restore_full_node.log and t151_deployment_restore_full_pytest.log.

Initial intermediate tests also exposed incomplete fixture support for dynamically appended IDs. Reviewed controls use the existing initial markup and binding lifecycle; the minimal component fixture includes the exact new controls. Assertions and production receipt checks were preserved.

Readonly live preflight confirms the existing owned PID37724 still listening0.0.0.0:8891. No live restart/native installation/remote Git/new branch.

Remaining: full activation-failure/late/timeout/accepted persistence recovery and actual browser evidence, controlled native0.3 install and immediate before-state capture/owned8891 restart/restore, T152/T153/N005, wholeT075–T084, Terra/allassets/N001/T032/T137auth/scenario runtime/equipment/RF/HIL/file bytes. Keep all parent tasks open.
