# T149 source deployment acceptance component

2026-10-06. FR031/SC026, T079 actual scoped capability dependency, full T075–T084 preserved. Runtime/schema/GET–POST route components are implemented; actual application mounting and owned8891 acceptance remain T151/T152.

## Source and fidelity

Original commit1a1e00297a0301637455b0ef2cf48b2e74576b07. RuntimeState source SHA2568ced51056e8dc9fd86a3fc57c898ea41d6e512a53530fdab55448421c8de9b5b. Strict schema SHA25609e8d4d7e3d5093643346033be7475f56271349260ff2322c4280330ffd92100; complete source schema AST identical after newline normalization. Original tests SHA256446243e90291a475331ba37cb750e18bd16b7c8271b662b2eff63008e5f1c09a informed the component cases; whole original application tests are not claimed as executed.

Source four deployment methods are executed on a current RuntimeState core scaffold by capture_original_node_deployment.py, with the source-verified actual ScopedDataManagement and delivery bridge. Original valid apply/duplicate/conflict/reset-exchange/recall/old-scope retention trace is captured and compared against the product. Two captures identical10764bytes/SHA256da127f4626faf7f139d7dd1d8235ba78d67d12b3ec824c55b646a6340a81c491. This isolates source deployment behavior; it is not a whole-upstream-app, liveTCP or UI proof.

## Implementation and intentional repairs

Runtime owns deployment_id/revision/full accepted configuration, used ID set and accepted start SIM timestamp. Original run_id:unconfigured / run_id:deployment:<id> scope generation, duplicate no-reactivation return, expected_revision/ID conflict, independent candidate scope, async lock across activation and complete exchange, reset/scenario new-run behavior are retained. Configuration survives reset; scope data do not mix. Browser orbit definitions are not accepted storage configuration.

Strict source wire schema forbids extra scope/capacity/orbit fields, duplicate identities, unsupported mode/catalog, nonboolean enabled or noninteger revision; keeps all240nodes/all100equipment/name whitespace. Source accepted candidate copy remains distinct from activation context. Separate boundary repair snapshots the command before await and uses captured candidate ID after activation, so caller mutation cannot redirect ID history. Protocol methods are added to existing RuntimePort; runtime imports no communication/module implementation.

Unconditional callback completion is insufficient: activation must return the actual scoped capability and checked sync receipt matching scope, authoritative SIM elapsed, exact derived storage roster/count and zero initial production. Delivery receipt now includes copied node_roster in addition to original node count. Runtime compares that receipt against its own candidate/fault projection. This is trusted composition evidence, not cryptographic proof or authorization for an arbitrary callback. The actual bridge verifies source module scope/roster/time/product receipts. Runtime commits only after the check; failure/cancellation retains prior authoritative state and old module scope. A separately addressed failed candidate can have partial writes; it is not globally deleted, and retries are idempotent.

communication/http/data_deployment.py preserves original GET/POST paths and runs the injected bridge in a worker thread while the runtime async lock spans activation. Wire errors422, revision conflicts409, missing/unavailable/mismatched module503, module domain rejection400. No default module, fake receipt or new clock is created by the route. It is unmounted in the actual application pending T151.

## Validation

RED before product edits: missing communication.http.data_deployment, t149_deployment_red.log. Focused49PASS/1existing Starlette deprecation warning/18.32s, including24deployment cases,22delivery cases and3architecture checks. Tests use FastAPI TestClient without starting8891 or runtime background clocks, real RuntimeState/ScopedDataManagement/bridge. They exercise normal/idempotent/same-ID/stale revision, schema all bounds, exact240node100equipment preservation, recall, scope retention, offline/wrong roster/missing composition/domain refusal, no backfill, no unconditional/mismatched receipt, same-count wrong roster, caller mutation during awaited activation, cancellation after module writes/retry, competing candidates, reset and full exchange serialization, and scenario scope transition. Original schema AST identical; source-method golden exact.

Final full Python642PASS/8existing ERFA warnings/160.97s (session43194exit0), Node540PASS/3144.5469ms. Architecture, source schema AST and staged whitespace gates PASS. Logs: data/workspace/validation/ground_stations/t149_deployment_pytest.log, t149_deployment_node.log.

## Remaining

T150 original serialized browser deployment client, T151 native installation/owned8891 restart and actual node workspace assembly, T152 actual two-resolution source matrix and accepted deployment errors, T153 Draft review/authentication. Full T079 console/actions/data UI, T075Terra/all50, T077–84, N001/N003, T032 and real equipment/RF/HIL/download gates remain open. No real file/network/packet integrity claims; no changes to actual8891/native installation/user browser/remotePR/merge.
