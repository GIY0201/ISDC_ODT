# T146 node draft actions — partial component gate

2026-10-06. T146 remains unchecked; full T075–T084 objective remains active.

## Implemented

Reused existing source-derived library, constellation store, formation controls and editor. createNodeDraftPanel owns their local wiring and scoped add/clear listeners, not a Viewer, clock, transport, storage restoration or deployment client. Original single-add uses selected bus, altitude/inclination/RAAN/anomaly and link policy. Saving through the actual store detaches formation membership while preserving identity. Explicit selection closes editing and gives the existing scene owner a copied no-focus user intent; passive storage/store events never issue camera commands. Store events refresh owners and notify definition changes using copies.

Invalid raw formation input blocks single-add as well as formation creation. Persistence failure preserves node identities/definitions/editor. Clear uses injected explicit confirmation; changed drafts, superseded approval or disposal invalidate a pending answer. Draft clear preserves a nonempty deployed display copy. That test uses an injected receipt predicate to exercise preservation, not actual server acceptance. Terminal history cleanup is delegated to its existing owner after acknowledged save/clear; downstream roster consumers own pruning for other store changes.

Editor onClose reports actual closing after acknowledged save or explicit cancellation so the status owner refreshes after the editor is hidden. Failed saves never report closure. Disposal removes owned listeners/subscriptions; failed editor construction releases already-created formation listeners. Observer failures after a persisted transaction are reported separately and do not invalidate save acknowledgement.

## Source evidence

Directly inspected pinned senior tabs/nodes.js saveNode lines346–356, add/clear lines520–530 and onStoreChange lines569–589 at source commit1a1e00297a0301637455b0ef2cf48b2e74576b07. The source calls existing library.defaultOrbit/createNode and store.update/clear/select, as does this port. Existing executed original library/store/editor/formation/status goldens are covered by the complete Node suite. No new full-panel original DOM golden or actual rendered-UI claim is made here. Source's confirmation is retained through an injected owner; original private globe/clock/global storage/history singletons are not created.

## Validation

- New draft actions regression:9FAIL before implementation (missing createNodeDraftPanel) →20PASS with existing formation tests.
- Editor closure regression:10PASS1FAIL before change →11PASS after change.
- Real editor and real store composition, failed selection/clear, listener preservation, missing confirmation, async stale approval, source add/save/detach and deployed-copy preservation now covered. Expanded fake element initially lacked dataset (13 fixture errors); corrected test surface before auditing the actual construction leak. Cleanup regression then12PASS1FAIL → fixed.
- Final full Node:444PASS,0FAIL,0skip,1432.6922ms. Log:data/workspace/validation/ground_stations/t146_draft_panel_node.log.
- Full Python:545PASS,8 existing warnings,150.85s; session1180 terminal exit0. Explicit0.3.0 wheel test setting with fresh short basetemp and unique absolute cache_dir under data/workspace/v. Existing denied cache ACL/files preserved. Log:data/workspace/validation/ground_stations/t146_draft_panel_pytest.log. Python product unchanged; later changes were JS-only and included in final full Node.
- Both edited JS modules pass node --check; staged diff whitespace check required before commit.

## Remaining

T146 whole workwindow shell/fleet-status-event assembly and source delegated scene controls remain. T147 native timeline, T148 source renderer, T079 actual activation and T149–T150 server deployment, T151 production mounting/owned8891 restart/restore, T152 actual two-resolution browser/acceptance and T153 exact-tree Draft review remain. N001 real multiwindow storage serialization and N003 OISL inertial/basis delivery remain open; N002 angles was resolved in the prior component gate only. No current8891 server/native installation/browser state/remote PR/merge changed. Full T076, Terra/all50, T075–T084, T032 performance, equipment/RF/HIL/download/AeroDT remain open. Fake DOM and injected acceptance tests do not prove GPU, communications or actual backend activation.
