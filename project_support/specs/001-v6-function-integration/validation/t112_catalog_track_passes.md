# US16 / T112 selected track and visibility calculation progress

Original referenceHEAD1a1e002 was reverified with a per-command safe.directory option; globalGit settings unchanged. Source globe.rebuildPath uses mean-motion period, coarse120 subdivisions, dense±45seconds/.1seconds. New query retains the full period, sorts unique nanosecond offsets and explicitly includes referenceUTC. Existing Rust/native/ITRF/EOP calculate is invoked once, with source/GP hash and perrow quality/failure counts. Error positions are null; no JavaScript or synthetic propagation. CatalogGeometryQuery.visibility reuses existing search_visibility and vector evaluator, returning all known interval/contact/clip/error metadata with user observer and communication unknown. Runtime is not involved.

## RED and targeted evidence

New test_catalog_track_passes.py first failed3tests because track/visibility methods were absent. After implementation3PASS: originalperiod/dense901grid/native reference position1e-8m; failednative rowmasked/null andGP409 domain conflict; visibility exactly equals existing precise search result and selected GP position remains unchanged. This is calculation evidence, not HTTP/UI or actual24h browser validation.

Node existing210PASS957.306ms; no new browser API/controller/renderer coverage yet. T111 aggregate remains incomplete. ADR0015/contract/spec/plan/tasks/data-model/quickstart record additive readonly API and V6 handoff requirements before their implementation. No new stack/nativeexport/wheel or original API change in this stage.

## Whole-suite failure and repair

First full run420PASS/1FAIL/5warnings/190.09s. Failed dependency boundary scan found the prior ad hoc t110_profile.py in data/workspace importing application assemblies. The architectural assertion was preserved. Moved the measurement tool to project_support/tooling/catalog_scene_profile.py, with portable root and guarded main, leaving produced JSON measurements in data/workspace. Module import checked without running profile. Architecture plus newcalculation targeted6PASS39.02s. Entire suite rerun is required before scoped completion; pending handle/results tracked in workflow ledger.

The T110 report's earlier helper name is historical; current executable helper is project_support/tooling/catalog_scene_profile.py. T110 measured JSON remains unchanged. Data folders contain outputs rather than this executable validation tool.

## Remaining work

T113 HTTP/browser transports and compatibility schema review, T114 V6 controller/pass table/AOSseek/track renewal, T115 oneViewer segmented polyline, T116 actual8891 two resolutions/readonly/whole tests/Draft abovePR29 remain. Existing8891 server has not yet loaded new methods; no claim of live track/visibility API success. Exact owned process restart with snapshot/SIM impact disclosure will occur before live validation when HTTP routes are ready. T075 full original display remainder and T076–T084/T032/SC006/F001/other deferred items remain.

Final rerun: Python421PASS/5warnings/169.84s, log python_t112_final.txt. T112 calculation scoped complete; HTTP/UI/actual8891 T113–116 pending. No numerical requirement or boundary assertion weakened.
