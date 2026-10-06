# Service mission configuration contract

createMissionTypes injects existing node equipmentSpec/equipmentActive. Original five service types, defaults, representative rates, equations and validation are source-preserved; no clock/transport/propagation/DOM created. Factory tables deeply frozen. source-body and original-file hashes are in original_mission_source.json.

createMissionStore({model,storage,now}) creates no import-time localStorage singleton. load is explicit, returns true/false and sets ready/error. Unknown/malformed saved schema, duplicate IDs, unsafe counters/status/nonfinite values cannot silently restore an empty ready set. Storage absent is explicitly memory_only.

CRUD/plan/status operations use source methods. Public arguments/results/getters are copied. Before a persisted write, current raw storage token must match last loaded/accepted token. Changed token rejects and preserves local accepted values; explicit load reviews another writer. Failed writes restore missions, plans, log, sequence and selection; observers cannot roll back accepted writes. Token checks are optimistic, not a cross-process database transaction.

Limit60 missions, last200 local log entries, source IDs and version increments preserved. Update drops plan and returns draft. Source setPlan keeps committed status on replan, including infeasible result. This is a local decision record only; application must validate freshness and server commit receipt before operational use (N010). UI status cannot claim confirmed execution from this store.

No planning windows, ICD-03 scheduler/commit, autonomous actions, second runtime/current-state owner, Viewer/native queue/history or extra clock. Actual native planning input producer and error/horizon coverage remain N011. No V6 mount yet; T078 stays open.
