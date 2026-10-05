# T146 source editor component (partial task)

## Original reuse evidence

Pinned senior source commit 1a1e00297a0301637455b0ef2cf48b2e74576b07, editor SHA256 51d2c72023e702a9c568c72838fe3383101b34a231e33e2631955ae75159ed93. The offline capture tool verifies original dynamics, library, display-helper and editor hashes before evaluating only whitelisted VM imports with explicit frozen time. No reference checkout is imported by product code.

Five actual original bus presets produce exact editor markup and static orbit summaries matching the port. Two 63539-byte captures of original_node_editor.json are byte-identical, SHA256 3a7ad626269755cd88d62cfd899d216749af99e10b69ea575351914d0b4eebaa. Tests require only the committed fixture. Capture execution warning refers to Node experimental VM modules, not a product dependency.

Product editor accepts injected library/static-summary/time functions. Original field layout, Korean labels, model provider groups, orbit and power units, equipment facts/roles, mode notes, bus replacement semantics, thumbnail/credit handling and edit-copy/save-to-owner flow are retained. No propagation, HTTP, runtime ownership, viewer, new clock or automatic deployment is added. Initial test assumptions were corrected against actual source: cubesat_3u key and seven flat_panel equipment items; fixtures use all five real bus keys.

## Intentional input/lifecycle repairs

Numeric blanks remain invalid; UTC datetime-local rejects impossible calendar dates through canonical roundtrip rather than Date normalization. The controller validates before calling the owner and requires an explicit error-array acknowledgement; undefined/throw/errors retain draft and field inputs. Supported paths are whitelisted. Draft getter and save arguments are independent copies. Open validates the replacement before discarding the old draft; focus:false supports future restoration without a focus command.

Owned field listeners are removed on rerender/close/destroy; unrelated submit listeners survive. Asynchronous save freezes input controls, passes an AbortSignal, and fences late results after another open/close/disposal. Own node is excluded from available OISL peers. Missing model/removed target retain explicit selected unconfirmed options instead of silently displaying the first available choice. These are presentation uncertainty markers, not link acceptance or model readiness.

## Verification

Regression-first missing-module RED preserved in t146_editor_red.log. Additional missing-model/removed-target regression produced 9 PASS / 1 FAIL before the repair; preserved t146_editor_safety_red.log. Final target 10 PASS, 125.5196 ms; full Node 400 PASS, 1482.8903 ms. Syntax check passed. Logs and repeated capture reside in ignored data/workspace/validation/ground_stations.

Whole Python 543 PASS, 8 existing warnings, 229.18 s; session83298 exit0. Explicit T144 additive wheel path and a fresh short ignored basetemp preserve both isolated new-wheel and unchanged runtime tests. Final staged whitespace check passed.

The controller tests use a bounded fake DOM/event owner. They verify lifecycle, copies and event contracts, not actual browser parsing/layout, Cesium coexistence, physical multiwindow behavior or frame performance. Actual 8891 tests are required at T151/T152. The source goldens cover markup/static summaries; they do not claim original DOM-controller execution equivalence or physical orbit correctness.

## Remaining original scope

T146 stays unchecked: formation controls and original panel/status/action integration in tabs/satellite_nodes.js remain. Then native timeline T147, NodeScene T148, real T079 activation and T149/T150 deployment, T151 assembly/native installation/owned8891 restart with before-state and restore, T152 two-resolution/live/multiwindow verification and T153 review. Full T076 and T075-T084 remain open, including Terra/all50, OISL/data/mission/security/PoC/context/settings/download. N001 concurrent-window storage, T032 frame budget, actual equipment/RF/HIL and future AeroDT connection remain unverified. Current server/native installation/browser and remote Git/PR state unchanged.
