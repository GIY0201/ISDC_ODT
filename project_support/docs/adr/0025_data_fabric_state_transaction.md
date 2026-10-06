# ADR0025 Source ICD-02 simulation and module-state transaction

Retain the senior prototype DataFabricStandIn and its link_metrics/routing/bundles algorithms from commit1a1e002. Place pure calculations under digital_twin/simulation/data_fabric and module state under digital_twin/runtime/data_fabric. The module is separate from twin entity/SIM/GP state and does not own a second clock.

Source update resets backlog on backward time before completing metric/path/report computation. A later failure could therefore corrupt the last accepted state. Rather than change its equations or reset semantics, DataFabricExchange owns a serialized candidate transaction around the unchanged source object. JSON finite checks reject NaN/Inf inputs/results. Publish only after the complete source report succeeds; error does not partially reset history, counters, graph or sequence.

Verified source tests plus regression: after accumulating4.5MB, a backward-time message with invalid node extra_delay_ms is rejected; status remains identical and the next valid ten-second step delivers5.25MB. Twenty-four concurrent same-time messages yield exact sequences1..24, copied caller/result mutation cannot change accepted paths, and backward accepted UTC still resets counters as source specifies.

Original tolerant range parsing is preserved. The failure regression uses extra_delay_ms, which the actual original code parses strictly. No source hash was relaxed after failure; Windows CRLF double-translation was corrected by normalizing before writing the copied source. HTTP/schema/client acceptance remains a separate required step, including explicit idempotency/freshness handling before exposing state-changing exchange through V6.

HTTP composition retains original endpoint/schema meanings and source remote forwarding; unavailable error type lives in foundation for transport/contract dependency boundaries. JSON parse/non-object/redirect errors are unavailable rather than false valid reports. This is additive to the original OpenAPI baseline. N009 future request identity and route-sequence fences must be specified before browser exposure. Default per-app fabric creates no calculation until explicit network POST; status GET is read-only.


## guarded-v1 optional HTTP guards
Legacy request bodies/headers remain compatible. New browser exchanges must use X-ISDC-Fabric-Instance (status.instance_id), X-ISDC-Fabric-Sequence (observed nonnegative safe integer) and X-ISDC-Fabric-Request-Id (client_id:monotonic positive safe integer). Route queries use instance and sequence. Partial/malformed headers are invalid400; stale instance/sequence/retired or reused-different command returns409. Unsupported guarded transport returns503, never legacy fallback.

Status advertises exchange_contract=guarded-v1, instance_id and current network_hash. Accepted guarded report echoes contract/instance/request_id plus server canonical-input hash. Guarded route echoes contract/instance/sequence/hash. Headers and metadata are source-contract additions; original ICD-02 equations, JSON schema bounds and old endpoints remain unchanged.

One high-water record per client, at most64 clients per module instance; no per-message full-report archive. One current report is retained for exact accepted-request replay. Same current command/body retry returns an independent copy without changing sequence/backlog. Superseded or retired commands conflict rather than reset DTN state. Capacity rejects new clients rather than evicting identities; current clients can keep increasing counters without growing the journal. Module restart changes identity and rejects old requests. Caller must keep command identity and payload unchanged until outcome is known and explicitly refresh after409; do not silently resend with a new identity or older UTC.

Remote adapter checks advertised guarded-v1/reachable before sending, forwards headers, preserves409 and verifies returned identity/sequence. Explicit remote reachable=false remains false. This is module-level protection; V6 verified native context/roster/UTC/edit/late checks and receipt presentation remain N009 acceptance work.
