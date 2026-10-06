# T079 / T149 scoped delivery and remote adapter component

2026-10-06. Full T075–T084 and T149 remain open. This step prepares the actual module capability required by runtime candidate activation; no deployment route or UI has been mounted.

## Source and changes

Original commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`:
- `communication/external/data_management.py`: SHA256 `134d235ea609f0a7f49e12a29c7ae117583afd6ee1837c28f38739fd11d50841`.
- `communication/http/data_management.py` containing the delivery bridge: SHA256 `515898e9d46c234c7071abbbd069a676d6a688fcce1c5d303c8baf3cbefe4585`.
- `digital_twin/contracts/data_management.py`: SHA256 `1d1def2b9935ef9527fb99620498cb36b6bbbb1a30d398df9a89ebb09b96d1b7`.

The original internal Protocol and public exception names are retained. Exceptions live in foundation and are reexported by contracts so the external adapter does not depend on the twin layer. Remote endpoint paths, scoped override, query filtering and normal response values are preserved. Boundary repairs require reachable isolated-v1 before scoped writes, reject redirects/nonobject JSON, map malformed 4xx safely, and close only internally owned clients.

The original serialized transport cursor and 2000-product chunks are reused in communication/data_management_delivery.py, with injected wall timestamp and copied messages/receipts. A matching isolated-v1 scope, exact storage roster, sequence, acknowledged module SIM clock and one result per product ref are required before advancing the delivery cursor. The original module caps clock steps at six hours; repeat roster delivery catches up to the requested SIM time without dropping elapsed products. Millisecond-rounded source receipts remain supported. Failed partial writes retain the cursor and retry uses the original product-ref deduplication. Generation starts no earlier than the runtime-provided accepted start. Same-scope reverse time is rejected before any module write because the source module would reset that catalogue.

## Evidence

Initial RED: missing communication.data_management_delivery (stored t149_delivery_red.log). Additional boundary RED: malformed product-ref TypeError and same-scope reverse-time catalogue reset, 19 PASS / 2 FAIL; t149_delivery_boundary_red.log. Both repaired with focused regressions.

Original adapter class executed against httpx.MockTransport by capture_original_data_delivery.py, not imported into product. Two captures are identical: 5522 bytes, SHA256 `cb1e8bc0b176870dec980ac4ef50c9e13ebbdb9a3a6530966fbdbfb262db2041`. Product regression compares every captured request and response. This proves component wire behavior, not actual remote endpoint connectivity.

Focused delivery tests: 22 PASS (0.49s). Actual ScopedDataManagement covers 8-hour clock catch-up/960 products, 20-hour two-chunk interruption after 2000 writes/retry to2400 unique catalogue objects, malformed/foreign roster and partial product receipts, no initial backfill, copies, millisecond receipts, stalled clock and reverse-time protection. HTTP tests cover unsupported capability, scoped override, redirects/500/list JSON/400 and caller-owned/shared client lifetime.

Final full regression: Python618PASS/8existing ERFA warnings/159.84s (session66449 exit0); Node540PASS/3004.0646ms. Initial closure617PASS preceded the added source wire parity test; final closure includes it. Syntax/newline checks6files and staged whitespace check PASS. Logs: data/workspace/validation/ground_stations/t149_delivery_pytest_final.log and t149_delivery_node.log.

## Remaining

T149 strict deployment schema, RuntimeState candidate activation/revision/idempotency/rollback and GET/POST component assembly; T150 client; T151 installation/owned8891 restart/actual assembly; T152 real browser matrix; T153 review. T079 full data console/actions and T075–T084 unchanged. Source bridge happy path has been inspected, not independently golden-executed; no broad equation parity claim is made for new receipt guards. Native runtime remains0.2.0; no restart, installation or actual network request occurred.
