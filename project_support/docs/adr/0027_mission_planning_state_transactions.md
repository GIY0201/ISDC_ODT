# ADR0027 Source mission-planning module state

Retain original deterministic ICD-03 scheduler and OrchestrationStandIn. Scheduler belongs to digital_twin/simulation/mission_planning; module memory belongs to runtime/mission_planning. Redirect one import only; normalized source hashes pin all equations. No operations_software root or new internal buses.

Wrap source mutating methods in serialized private-candidate execution, finite JSON checks and independent copies. A failure after source audit stamping must not corrupt sequence/last verdict/held records. Capacity1..60 rejects overflow without evicting accepted missions; this additive lifetime bound is distinct from original equations and must be disclosed at the future API/UI boundary.

Original commit accepts caller tasks without verifying a prior feasible plan. Keep original compatibility test but do not expose this as validated V6 execution. N010 must add context/request/plan/task identity and exact retry guards. Native planning windows/horizon/error verification remains N011. Internal module tests are not evidence of HTTP/native/real-browser or hardware execution.
