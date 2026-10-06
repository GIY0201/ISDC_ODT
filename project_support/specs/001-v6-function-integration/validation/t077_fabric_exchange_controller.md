# T077 explicit exchange controller prerequisite


## 2026-10-06 T077/N009 explicit exchange controller prerequisite
Add createFabricExchange as application-only command/receipt owner around original guarded browser client and existing workspace networkSnapshot/verifyNetworkSnapshot ports. No native query, definition roster, history, clock, Viewer, timer, storage or server-owned state is duplicated. Explicit send requires complete copied verified network envelope and matching network wire time. Concurrent send shares one promise. Uncertain retry retains command ID/body/instance/base sequence exactly; changed uncertain input blocks reapply until explicit status refresh. Conflict409 requires refresh then explicit send. Complete input proof or endpoint change clears local receipt/route. Async pre/post fences and disposal reject late replies. Route requires accepted instance/sequence/hash plus matching requested source/target/objective and original three objectives only.
Tests: missing module RED; fixture UTC changed without wire time correctly rejected (fixture repaired, guard retained); wrong route source RED before echo fence. FullNode754PASS4572.4466ms, six focused controller regressions. FullPython684PASS8existingERFAwarnings171.60s session36579exit0; syntax check PASS. Evidence validation/t077_fabric_exchange_controller.md. Controller remains unmounted; this is application logic evidence, not rendered V6 or actual native network acceptance.
N009/T077/fullT075-T084 remain OPEN. Next compose source browser factory and controller in existing workspace_orbit, add explicit send/refresh/source-target/objective/path/DTN presentation to existing ground panel, preserve pending ground edits and event disposal, verify real native network/live8891 and both resolutions. N008 cleanup GS-SITE_1/storage/late/multiwindow, other source modules/Terra/allGPU/T032/N001/T137auth/equipment/RF-HIL/file bytes/review stay open. Same branch; no remote Git/new branch/server restart/native install/SIM command.

## Evidence

node --test project_support/tests/browser/*.test.mjs: 754 passed; data/workspace/validation/t077_fabric_exchange_node.log.
RED logs: t077_fabric_exchange_red.log and t077_fabric_exchange_route_red.log.
Tests use injected transport and verified-network port fixtures; no actual native/browser/controller TCP claim.
Controller consumes full input proof and does not regenerate native geometry. Tests cover copies, send dedup, identical uncertain retries, changed-input refresh requirement,409 refresh, late/disposed response, unknown proof, endpoint/fault invalidation and wrong route echo.
Full Python684PASS8existingERFAwarnings171.60s; session36579exit0 confirmed. Evidence t077_fabric_exchange_python.log. Syntax and whitespace checks pass. Pre/post extension hooks absent (.specify/extensions.yml does not exist); requirements checklist8/8 and prerequisite artifact paths revalidated.
Actual V6 controls, native fixture and real UI failure matrix remain N009 acceptance work.
