# T143 readonly node API and browser transport

## Scope

Completes the adapter/query/wire/browser-transport scope of T143. Native installation remains T144 and actual fixed8891 application/scene integration remains T151–152; full T076 requires accepted T079 deployment. No current server restart, installed wheel change or live UI acceptance is claimed.

## Changes

- Strict extra-forbid outer requests: request_id, complete schema1 node definitions, explicit start UTC/count1..601/step1 or center UTC. Geometry identity/orbit/finite-JSON/epoch/duplicates validated before query; max240nodes and50000sample rows. Full editor equipment/mode rules are separate from geometry preparation and accepted deployment.
- Move unchanged finite definition/hash preparation to digital_twin/contracts/satellite_nodes.py, retaining native module re-export compatibility. HTTP depends on contracts/foundation, not concrete Rust adapter. Preparation makes no native calls or state mutations.
- Injected NodeGeometryPort routes return503 for absent/native-unavailable/busy,422 for invalid domain/time and502 for malformed native result. Route-local validation strips input/context from errors so NaN and full definitions are not echoed into strict JSON. No changes to existing global exception handlers or other routes.
- Public response uses model_profile as designed, with unchanged source frame/time/hash/UTC/units/quality. Fresh error rows retain null geometry.
- Browser api.nodeSamples/nodeTrack use same-origin POST/no-store, exact serialized payload and AbortSignal; HTTP errors retain status/detail. HTML/wrong media type and malformed JSON fail explicitly. Timeline response fences remain T147, not a claim from this transport.

## Regression evidence

- test_node_http.py first missing-module collection failure; two browser tests first fail for absent functions. Logs t143_http_red.log/t143_browser_red.log retained.
- Existing architecture test detected concrete HTTP→native dependency (1FAIL2PASS102.12s); unchanged preparation relocated to shared contract and tests then74PASS1existingTestClientWarning104.99s. t143_http_boundary_red.log/t143_http_target.log. Shell wrapper returned1 only for subsequently repaired whitespace at EOF; test assertions passed.
- Real NodeGeometryQuery/native decoder with injected owned source-style rows exercises HTTP samples through valid/leap/valid alignment,121-point track, nulls/source tags/request ID, malformed input/NaN/duplicates/caps, unavailable/busy/malformed result and unchanged actual application orbit/SIM snapshots. Injection verifies assembly/parser behavior, not new wheel or independent physical accuracy.
- Browser target2PASS92.9034ms; fullNode371PASS1397.285ms. Syntax/whitespace gates passed after EOF repair.
- Full Python542PASS8existingwarnings215.38s, session66026exit0, fresh short ignored basetemp (t143_http_pytest.log). Full regression includes architecture and existing isolated old-wheel export tests; those establish unchanged old installation only, not the pending T144 new-node wheel.

Ignored logs: data/workspace/validation/ground_stations/t143_http_*.log and t143_browser_*.log. Previous adapter/query source-golden evidence remains in t143_node_adapter.md/t143_node_query.md. No fixture changes.

## Remaining whole-goal obligations

T144 additive wheel old/new export validation; T145–153 full node editor/store/scene/native playback/T079 accepted activation/live/Draft review; T075 Terra/all50; T077–84 full source functions; Git authentication-dependent publication; T032 and equipment/RF/HIL/download/AeroDT tracked limits. Do not close full T075–T084 from this API gate.
