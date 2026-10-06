# T150 original browser deployment client

2026-10-06. FR031/SC026, original source commit1a1e00297a0301637455b0ef2cf48b2e74576b07. Client component uses the actual T145 store acceptance verifier and T149 server protocol; application mounting/actual8891 remain T151/T152. Full T075–T084 scope unchanged.

## Source fidelity

Original user_application/web/scripts/nodes/data_deployment.js SHA2563774b247d3fe3fb1048ea583b2f2ac1547e3c488f3e2b64d97b46a5900b438b4. Source deploymentNodes/signature, single Promise queue,15second AbortController timeout, minimal id/name/mode/equipment payload, matching-configuration ID reuse, same-key/kind pending command retry,409 read-before-explicit-reapply, ordered nodes:deployed/data:deployment events retained. No orbit/power/capacity expansion in deployment requests.

capture_original_data_client.mjs executes the original module with deterministic injected transport/presentation harness for initialize/deploy/idempotent/offline/retry/recall. Two captures identical14095bytes/SHA256d1f1c545fe570aaca78a93a290a4cc36857a4baa2d64eb6f390850a2001dd290; product compares all requests/events/state projections exactly. The harness proves normal client wire/state behavior; it is not actual store/server authority or live HTTP evidence.

## Explicit integration changes

Caller injects one constellation store, HTTP transport, command IDs and owner notifications; no global client singleton or automatic network/ID generation at import. Timer scheduling can be injected; timeout is wall-duration request control, not a SIM clock. Startup only GETs, including saved local deployments; it never POSTs restored configuration automatically. This intentionally replaces the original pristine-server automatic restore to honor the approved restore contract.

Before accepting any GET/POST receipt, validate safe revision, run/scope identity shape, exact scope derivation, strict bounded node/equipment IDs/names/modes/catalog/enabled fields, duplicates and forbidden node/equipment fields. POST additionally matches pending ID, expected accepted revision and order-independent source equipment signature. Same ID/configuration idempotent replies retain the current revision. Server configuration remains distinct from browser full orbital definitions.

Each pending request captures full display definitions; ambiguity retries preserve both wire command and full sent snapshot despite later orbit-only draft edits. The T145 store verifier succeeds only during this client's synchronous commit, for the exact copied sent definitions/receipt/kind; saved receipts cannot authorize arbitrary later deploys. This is trusted application composition, not authentication or cryptographic authority. Local persistence failure keeps the actual accepted server receipt visible, syncRequired true and pending command intact for idempotent retry; previous local deployment/drafts stay unchanged.

Observers each receive independent snapshots. Observer/event failures are reported in notificationError and do not break transport/queue. destroy aborts owned requests/timers, releases subscriptions, rejects queued/future operations and rejects late responses. Expired replies are rejected even if injected transport ignores AbortSignal. Original source failure/ambiguous receipt errors are retained; no guessed successful deployment is reported.

## Verification

Initial RED: missingdata_deployment.js, t150_client_red.log. Initial structural11PASS. Boundary RED12PASS2FAIL: initialize afterdestroy and late reply after timeout could succeed; repaired with explicit active/aborted checks. Final focused15PASS131.369ms includes actual T145 library/store, sent-snapshot/persist/replay protection, ambiguity/serialization/recall/409, restore GET-only, HTML/JSON/strict malformed receipts, copied observers, timeout/dispose/late responses and original client trace.

Cross-language component: test_node_deployment_client.py runs the actual JS client/library/store in Node and exchanges its actual requests through test IPC with the actual FastAPI router/RuntimeState/ScopedDataManagement/bridge. It deliberately drops the first successful server response, verifies exact duplicate command/no new revision, changes server configuration through an independent command to produce409, confirms refresh and no silent retry, then explicit reapply and recall.1PASS/1existing Starlette warning0.46s. All returned scopes have zero historical products and old scopes remain distinct. Initial harness1FAIL was an incorrect expectation: identical external configuration correctly reuses its ID/revision; changed the external fixture to a different name to exercise the intended conflict/reapply case. No product code was changed to satisfy that fixture.

Final full Python643PASS/8existing ERFA warnings/161.11s(session89311exit0), Node555PASS/3138.1009ms. Client/tool/IPC JavaScript syntax and staged whitespace checks PASS. Logs data/workspace/validation/ground_stations/t150_client_pytest.log, t150_client_node.log, t150_client_target.log, t150_client_ipc.log. IPC is not actualTCP/browser/8891 proof and injected timers are not elapsed-time performance evidence.

## Remaining

T151 one-client application assembly with panel/store/native timelines/renderer/model, native installation and owned8891 restart after before-state capture; T152 actual two-resolution source/UI/server acceptance matrix; T153 Draft review. T148 actualT077 producer/N003, full T079 data console/UI, T075Terra/all50/T077–84/N001/T032/real equipment/RF/HIL/download remain open. Actual native runtime0.2.0 and8891 server/user browser/remotePR/merge unchanged.
