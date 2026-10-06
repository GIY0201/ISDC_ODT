# ADR0025 Source ICD-02 simulation and module-state transaction

Retain the senior prototype DataFabricStandIn and its link_metrics/routing/bundles algorithms from commit1a1e002. Place pure calculations under digital_twin/simulation/data_fabric and module state under digital_twin/runtime/data_fabric. The module is separate from twin entity/SIM/GP state and does not own a second clock.

Source update resets backlog on backward time before completing metric/path/report computation. A later failure could therefore corrupt the last accepted state. Rather than change its equations or reset semantics, DataFabricExchange owns a serialized candidate transaction around the unchanged source object. JSON finite checks reject NaN/Inf inputs/results. Publish only after the complete source report succeeds; error does not partially reset history, counters, graph or sequence.

Verified source tests plus regression: after accumulating4.5MB, a backward-time message with invalid node extra_delay_ms is rejected; status remains identical and the next valid ten-second step delivers5.25MB. Twenty-four concurrent same-time messages yield exact sequences1..24, copied caller/result mutation cannot change accepted paths, and backward accepted UTC still resets counters as source specifies.

Original tolerant range parsing is preserved. The failure regression uses extra_delay_ms, which the actual original code parses strictly. No source hash was relaxed after failure; Windows CRLF double-translation was corrected by normalizing before writing the copied source. HTTP/schema/client acceptance remains a separate required step, including explicit idempotency/freshness handling before exposing state-changing exchange through V6.
