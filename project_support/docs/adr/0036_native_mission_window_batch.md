# ADR 0036 Captured native mission-window batch transport

Status: application factory composition implemented; actual V6/controller/live server acceptance pending.

Expose one readonly `/api/nodes/mission-windows` POST over injected MissionWindowPort. Typed virtual WGS84 sites, optional camera target, optional precise external GP/EOP/leap identity and positive range, full node definitions, explicit positive at-most24h horizon and request identity are captured before awaiting geometry. Request schema rejects unknown fields/nonfinite values/duplicate station IDs; max240nodes/64sites. No planning/commit/abort or runtime command is issued by this endpoint.

MissionWindowQuery composes the already owned node/catalog query ports with existing ground/access/eclipse/external producers. Each report retains its sampled coverage, model/coordinate/quality/source hashes and errors. Only publish after all requested producers succeed and full node hash agreement. Bound source ICD-03 contacts20000/access5000/crosslinks5000/eclipse20000 and reject overflow without truncation. External catalog getter is injected by the app factory to use its actual lifespan-loaded query, not a new GP/EOP owner. Missing catalog503, stale GP409, bad required native receipt502, invalid request422; unavailable/busy503.

The request is a geometry query on caller-supplied snapshots, not proof that those inputs remain the accepted deployed roster. Future OR-01 assembly must verify commonUTC/full definitions/sites/faults/accepted module context and existing optical owner's receipt before publication, retain coverage and invalidate late/replaced commands. No private primed OISL history/window cache is copied from the original planner. N010/N011 remain open for this lifecycle and actual V6 acceptance.

OpenAPI compatibility allowlist adds this one path and four new schemas explicitly. Every original path/schema and the original fixture remain exact. Source scheduling/OR-01/OR-03 schemas are unchanged.

Evidence: feature validation/t078_native_window_batch.md. Installed native four-kind roundtrip uses the real FastAPI app factory under TestClient, not live TCP. Active8891/SIM/GP state is preserved; safe combined production/controller assembly restart and validation remains pending.
