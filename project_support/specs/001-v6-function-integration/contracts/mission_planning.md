# ICD-03 source module contract

Original scheduler operates on UTC input windows, satellite capability/power/busy records, stations and mesh; internal time is Unix seconds. It is deterministic greedy engineering scheduling, not AI or flight-qualified planning. All source equations remain pinned. The twin must supply verified geometry and context; absence of trustworthy inputs is not evidence of no contacts.

Source OrchestrationStandIn owns sequence, last verdict summary per mission, held tasks after commit and audit last_update time. plan advances sequence and records verdict; commit records supplied task intervals/version, abort releases held mission; status returns copies. Existing source commit does not verify prior feasible plan or generated tasks. Preserve source regression; safe V6 requires N010 additive accepted-plan/context/version/task receipt guards.

MissionPlanningExchange serializes plan/commit/status with an RLock. Mutations compute on a deep-copied source candidate. Input/reply/status must be finite JSON; publish candidate only after complete success and capacity check. Failure preserves whole accepted state including sequence/time/verdict/held tasks. Caller/reply/status copies cannot mutate held records. No per-message full history or twin clock is added.

Explicit module capacity: at most60 distinct IDs across last verdict and committed dictionaries; constructor1..60. Exceeding bound rejects without automatic eviction. Source frontend's mission working-set limit is60; this module lifetime bound is an additional policy and must remain visible when exposed through API. It is not source scheduling math. Capacity deletion/recovery policy and multiwindow lifetime acceptance must be reviewed before claiming full mission operations support.

HTTP/remote/browser schemas/adapters/app ownership, bounded native geometry/horizon coverage, current input/plan identity/freshness and actual V6 planning/commit/abort UI are still T078/N010/N011 prerequisites. This module is not mounted in create_app and has no server-runtime/GP/SIM side effects.
