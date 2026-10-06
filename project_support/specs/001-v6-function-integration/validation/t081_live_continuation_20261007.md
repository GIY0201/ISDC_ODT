# Actual V6 continuation on fixed 8891

This records observed live behavior, not full T075–T083 acceptance.

The reviewed original forty-node configuration created `RUN-904CE008D00B`, deployment revision 6, at 03:34:59 KST. Source roles resolve to NODE-0041 through NODE-0080. The live source console accepted its relay and observation plans. The original fleet-update request remained a draft. Preparation receipts and resource timing are preserved in the ignored `data/workspace/validation/live_poc_latest_setup` directory.

At T+61.573 seconds, the source runner injected a 300-second link-loss fault against NODE-0043|NODE-0044. The normal-stage completion evidence showed a route, an executing relay mission, and 80 registered data objects. This is distinct from the earlier isolated run's failed normal-stage check before its first data production; that failed evidence is preserved.

At T+61.975 seconds the actual V6 global controls paused the same run. A distinct validation query reloaded updated browser modules at 04:03 KST without restarting the server. The stored record loaded the same run, and the explicit current-execution resume check accepted it. No setup or deployment replacement was issued during this continuation.

The next-stage control subsequently advanced the authoritative runtime to T+65.975 seconds, sequence 127306, with the same active fault and the same run ID. Read-only `/api/bootstrap` corroborated the advance at 04:06 KST. Browser inspection of the downstream stage was still pending at this checkpoint; this document does not claim all recovery stages or result-file verification complete.

## Regression after exact-point reuse

The clean-environment native optical fixture initially failed because it expected a redundant fourth native point request. Current consumers reuse the validated exact-current-UTC receipt. The fixture now requires exactly the three original priming timestamps, removes the permissive fourth-receipt fallback, and still compares all optical, network, selected-pose and actual workspace records against the native/source golden inputs. Maximum numerical difference was 5.4569682106375694e-12, with zero timestamp difference. The clean installation suite passed all three tests.

Full browser regression at this checkpoint: 1,078 passed, zero failures, zero skipped, 6,761.4507 ms (`full_migration_node_0410.log`). The full Python rerun completed with 960 passes and eight existing warnings in 221.44 seconds (`full_migration_python_0406.log`). Earlier full Python output was 959 passes and the one now-repaired fixture failure. No RF reception, equipment authentication or physical HIL success is implied.

## 2026-10-07 04:30 actual finished run and VF-03 bytes

Continuing the same browser/run without replacement setup, the original runner completed all five source steps atT884.681. The literal UI shows finished / SIM execution RUN-904CE008D00B, ten completed step checks passing, and three recovery groups containing seven passing rules with no pending rule. Actual fault expiry and primary-route return are recorded; original timing/check semantics were not edited to force a pass. The original relay completed with6650.3s margin, source data stability minimum84.7 and route reconvergence47.722s.

The visible enabled VF-03 download produced C:/Users/gwakinyong/Downloads/SDC_POC_01-RUN-904CE008D00B.json at browser download ID2, complete at2026-10-06T19:28:14.133Z. Parent independently opened this exact returned download path and verified32777bytes and SHA25619810e239670949986dd42a20cfe334796ba1a2bc7445fbdfe2b998073fb9b82. The saved artifact is byte-identical. Exported scenario/run IDs, four phase samples,62ICD log entries and7rules match the actual source result. The source UI verdict includes root pending:false; the pinned original resultRecord deliberately exports only ok/passed/total/groups, so comparing that exact documented projection proves equality without altering the source schema. The record does not contain an invented current_phase field.

Evidence is preserved under data/workspace/validation/t081_live_finished_0430: parent_verification.json, actual browser download record, downloaded bytes, literal source console, events/compare/verdict and finished screenshots. The source screenshot visibly shows finished/T884.7,40accepted nodes and the original shared globe. These are full bounded source SIM scenario and download proofs, not physical RF/HIL/security or every remaining T081 follow/dock/remote-error gate. T075–T083 remain open pending their remaining matrices.
