# ADR0028: Accepted-plan identity before mission commit

Status: accepted for internal exchange; application/native/HTTP acceptance pending.

Preserve original ICD-03 scheduler and legacy methods. Add guarded methods to the existing module state owner, with copied accepted-plan records and one current retry receipt. Use instance/global base sequence plus client monotonic IDs as in ICD-02; command fingerprint includes all guards and body. Reject stale/reused IDs and bounded-client overflow without eviction. This is explicit conflict detection, not durable idempotency after process restart.

Commit must bind mission version, exact plan sequence, full canonical tasks, feasible verdict, supplied context digest and unchanged analysis UTC. Held missions require abort before replan. Other held satellite intervals cannot overlap. These additive rules are intentional behavior changes isolated from source equations. Original legacy tests remain valid; original unguarded commit still permits supplied intervals and is unsuitable for V6.

Digest comparison cannot establish native provenance or freshness. The application must independently verify current deployed definitions, stations, faults, native window coverage and analysis UTC before/after commands. Do not expose guarded commit as actual operations acceptance until N010/N011 and HTTP/remote/browser/UI acceptance are implemented. No hidden fallback to legacy methods is permitted for the V6 workflow.

Lifetime bounds60 missions/64 clients need recovery/lifecycle policy and actual multiwindow review. Wall audit timestamps are not SIM/analysis time. No extra Viewer/propagation/history/clock is created.
