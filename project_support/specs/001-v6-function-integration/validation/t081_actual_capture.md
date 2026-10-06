# Isolated actual 40-node scenario capture

The capture tool runs `create_app()` with its default installed native query in
FastAPI TestClient. A Node stdio bridge executes the migrated original scenario
factory, runner, existing workspace nodes, native request builder, mission
execution controller, ground store and guarded ICD clients. No listener/port,
browser storage, current live run or user deployment is used. DOM and globe
presentation are absent; this is domain integration evidence, not a 3D/UI test.

Command: `project_support/.venv/Scripts/python.exe -X utf8 project_support/tooling/capture_actual_scenario.py`.

## First actual RED

Evidence: `data/workspace/validation/t081_actual_20261007_021414.json`.
Actual source definition generated and accepted all 40 nodes. Native samples,
native tracks and guarded mission context returned 200. First mission windows
returned 422: `planning UTC points must be strictly increasing`.
The captured horizon was `2026-10-06T17:14:15.520000000Z` to
`2026-10-06T20:14:15.520000000Z`. Astropy's duration is
`10800.00000000001` seconds; a coarse offset 10800 and the appended final
endpoint both encode `2026-10-06T20:14:15.520000000Z`.

## Scoped correction

Native pass and eclipse producers replace the last coarse point with the final
endpoint only when their generated canonical UTC strings match. The strict
native point monotonicity fence remains intact. No arbitrary tolerance removes
distinct endpoints. A distinct five-nanosecond final endpoint regression passes.

Focused verification: `test_native_mission_windows.py`,
`test_native_mission_passes.py`, `test_scenario_window_endpoint.py`: 32 passed.

## Actual whole PoC

Evidence: `data/workspace/validation/t081_actual_20261007_022248.json`.
204 real requests returned HTTP 200. All 40 source definitions were accepted.
The original order was three plans then two commits; relay had two tasks,
observe three tasks and fleet update eight tasks. All plans were feasible.
Five original steps executed to `finished`. Fault `NODE-0003|NODE-0004` was
injected at T+21 with expiry T+321; accepted fabric receipt marked it unusable
with reason `fault`. Native replan, abort and commit succeeded. The final
imagery request was served. Source recovery KPI verdict passed all three groups.

Native window request times were 27.285 seconds for relay, 201.491 seconds for
observation, 48.004 seconds for fleet update and 25.948 seconds for replan.
The guarded planner itself took 0.018–0.032 seconds. These measurements expose
preparation latency; they do not establish the requested smooth interactive
performance for this scenario setup.

The first whole capture exposed original step presentation recomputing earlier
checks against the final restored network. A focused runner regression now
preserves immutable checks/context at the transition to the next step (after
the real current network refresh), and at final completion. Successful completed
steps display their completion evidence. Failed completed checks retain their
immutable failed evidence (`failed_completed`); active and legacy records use
explicitly identified current checks. Restore and returned-array mutation
regressions passed.

Actual recapture `t081_actual_20261007_023348.json` had 196 successful HTTP
requests, all five steps finished, and recovery KPI three-group PASS. Four
later steps retained passing historical checks after recovery. The stricter
all-five-check assertion is RED: the nominal step completed at T+21 with zero
data objects. The pinned original fault offset is first relay crosslink +20 s,
while the pinned deployment telemetry cadence creates the first object at30 s
(and imagery at90 s). Real objects first appeared at T+32, ending with564.
This is an original nominal-readiness/timing inconsistency under the actual
native plan, not proof of all-five criteria passing. Source timing and assertions
remain unchanged.

## Explicit same-run reload verification

Cached node records remain unconfirmed on ordinary load. Explicit resume first
uses a fresh validated GET to reaccept an exact same-run/revision/scope/roster
receipt through the existing constellation acceptance transition. No deployment
POST or runtime reset is permitted. Full saved definitions (including original
scenario role metadata), stations, missions, module-held plans, faults and native
hashes must match. Then all40 nodes are propagated at actual paused SIM UTC and
native mission-context acceptance is checked again after the final module read.
The original deployment time and receipt remain preserved. Old records without
permanent proof, dirty drafts, changed server identities and foreign holds fail.

First actual reload RED `t081_actual_20261007_025423.json` confirmed ordinary
reload correctly left deployment unconfirmed. Second RED
`t081_actual_20261007_030322.json` exposed source role metadata being lost on
normalization. Both corrections retain all evidence fields, rather than relaxing
the comparison. Corrected actual ASGI reload verification PASS:
`t081_actual_20261007_030808.json`, 80 real requests, every HTTP200. After the
actual original40-node/3-plan/2-commit setup, all existing browser owners were
disposed and recreated from isolated saved records. Explicit fresh receipt GET,
all40 native samples/track, guarded mission-context acceptance and final actual
module read passed. Run ID, scenario ID, started_at, elapsed_seconds and running
were unchanged; the resume portion issued no runtime/scenario POST. Cached
receipt/full-node/deployedAt preservation and server/dirty/late-change/invalid
role rejection are separately covered by owner unit guards. Actual native RF
and browser rendering claims remain outside this capture.

The integration uses actual installed native propagation and actual source
stand-in ICD modules. It does not establish physical RF, external hardware HIL
readiness, browser/3D rendering, or all scenarios outside this original PoC.
