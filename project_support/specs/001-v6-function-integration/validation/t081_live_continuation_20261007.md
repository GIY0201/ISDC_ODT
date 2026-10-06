# Actual V6 continuation on fixed 8891

This records observed live behavior, not full T075–T083 acceptance.

The reviewed original forty-node configuration created `RUN-904CE008D00B`, deployment revision 6, at 03:34:59 KST. Source roles resolve to NODE-0041 through NODE-0080. The live source console accepted its relay and observation plans. The original fleet-update request remained a draft. Preparation receipts and resource timing are preserved in the ignored `data/workspace/validation/live_poc_latest_setup` directory.

At T+61.573 seconds, the source runner injected a 300-second link-loss fault against NODE-0043|NODE-0044. The normal-stage completion evidence showed a route, an executing relay mission, and 80 registered data objects. This is distinct from the earlier isolated run's failed normal-stage check before its first data production; that failed evidence is preserved.

At T+61.975 seconds the actual V6 global controls paused the same run. A distinct validation query reloaded updated browser modules at 04:03 KST without restarting the server. The stored record loaded the same run, and the explicit current-execution resume check accepted it. No setup or deployment replacement was issued during this continuation.

The next-stage control subsequently advanced the authoritative runtime to T+65.975 seconds, sequence 127306, with the same active fault and the same run ID. Read-only `/api/bootstrap` corroborated the advance at 04:06 KST. Browser inspection of the downstream stage was still pending at this checkpoint; this document does not claim all recovery stages or result-file verification complete.

## Regression after exact-point reuse

The clean-environment native optical fixture initially failed because it expected a redundant fourth native point request. Current consumers reuse the validated exact-current-UTC receipt. The fixture now requires exactly the three original priming timestamps, removes the permissive fourth-receipt fallback, and still compares all optical, network, selected-pose and actual workspace records against the native/source golden inputs. Maximum numerical difference was 5.4569682106375694e-12, with zero timestamp difference. The clean installation suite passed all three tests.

Full browser regression at this checkpoint: 1,078 passed, zero failures, zero skipped, 6,761.4507 ms (`full_migration_node_0410.log`). The full Python rerun completed with 960 passes and eight existing warnings in 221.44 seconds (`full_migration_python_0406.log`). Earlier full Python output was 959 passes and the one now-repaired fixture failure. No RF reception, equipment authentication or physical HIL success is implied.
