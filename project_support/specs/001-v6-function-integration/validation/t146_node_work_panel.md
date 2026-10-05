# T146 whole node work panel — component gate

2026-10-06. T146 component port complete; T076 and full T075–T084 remain incomplete. No actual8891 UI mounting or browser/GPU/deployment acceptance is claimed.

## Changes

Ported source formation/inspector markup, preserving named controls/listbox/live status/editor/tooltips. Shared globe controls replace the source private globe/clock/Viewers. Original node presentation CSS is scoped to .satellite-node-work-panel and existing V6 theme variables, excluding all private-viewer scene/credit rules. Flexible layout/container/media rules adapt the source presentation to a workwindow; actual1280×720/1920×1080 layout remains T152.

createNodeWorkPanel composes the already-ported draft/editor/store/formation, fleet/status and tooltip controllers with owned disposal. Add opens editor; acknowledged save closes it and refreshes status; selection adopts formation and emits copied explicit no-focus intent. Source live slider mode starts enabled only for future explicit edits; initialization does not create a formation. Fleet doubleclick and scene focus revalidate selected geometry at the current display UTC. Removed/foreign rows are ignored. Restore/passive refresh never dispatch camera, clock or deployment commands. Failure during construction releases already-created components/listeners.

createNodeSceneControls delegates source home/untrack, tracks/links/models, lighting, wheel±120, owner zoom percentage, step±60s, pause/play, live and speed actions. State/aria comes from the actual injected scene/display owner, never callback return values or a new clock. Source600x remains visible but disabled when unsupported; an explicitly supported shared-owner0.1x is added. Malformed/absent bounded positive speed capabilities disable commands. Escape is scoped to this root and delegates source untrack({aimAtEarth:true}). Held callbacks and late home continuations cannot run after disposal. Whole deployment controls remain disabled/unconfirmed until T149–T150/T079 acceptance and actual T151 mounting.

## Source fidelity evidence

Pinned commit1a1e00297a0301637455b0ef2cf48b2e74576b07. Source index.html SHAe8be832d…, nodes.css SHAf2e174c6…, zoom_controls.js SHA45ea08eb… are checked by capture_original_node_work_panel.mjs before static capture. Two captures19842bytes, SHA1d2d64057d7faaf0c3e04cf4a9769aad3449114df9544f8ba39fa17bfdcee208 identical. Fixture original_node_work_panel.json preserves original formation/inspector markup and presentation rules, source wheel amounts. Tests compare line-ending-normalized markup after only declared acceptance-label/disabled-button substitutions; source presentation rules match scoped production rules. This static receipt does not execute a renderer or prove visual layout. Existing executed editor/library/store/formation/status goldens remain covered in full Node.

## Regression and full verification

- Workpanel5FAIL before product changes (missing builder/controller).
- After composition4PASS1FAIL was fake DOM disabled-attribute parsing, repaired to represent actual markup. Tooltip/scene/status tests37PASS162.1673ms.
- Source CSS/Escape5PASS2FAIL before those changes →7PASS. Static original receipt7PASS1FAIL exposed CRLF/LF normalization in test; normalized only line endings →8PASS.
- Shared-owner speed8PASS1FAIL before capability-aware choices →9PASS. Added late-home/constructor cleanup, final target11PASS120.1238ms.
- Full Node455PASS,0FAIL,0skip,1476.4104ms. Log:data/workspace/validation/ground_stations/t146_work_panel_node.log.
- Full Python545PASS,8 existing warnings,144.54s, session31888 terminal exit0. Explicit product0.3.0 wheel, fresh short basetemp and unique absolute cache_dir; old denied cache preserved. Log:data/workspace/validation/ground_stations/t146_work_panel_pytest.log. Python product unchanged; subsequent JS-only refinements covered by final full Node.
- Product JS/capture tool node --check and staged diff --check required before commit. Spec Kit existing prerequisites/checklist8/8/hook absence revalidated; no new feature/framework or skill reinstallation.

## Open acceptance

NextT147 native buffers/atomic chunks/UTC/cancellation/121-point track, thenT148 source scene. T079 actual activation andT149–T150 acceptance client/server, T151 actual production mount/additive wheel install/owned8891 restart with before-state restoration, T152 actual browser/two-resolution/multiwindow/source performance matrix andT153 exact-tree Draft remain required. N001 actual multiwindow serialization andN003 source OISL inertial/basis delivery stay open. T075 Terra/all50, T077–T084, T137 authentication, T032 performance, equipment/RF/HIL/download/AeroDT remain open. Browser/server/current native/environment/remote PR/merge unchanged. Fake DOM and geometry inputs prove component control flow, not live position delivery, communication or server activation.
