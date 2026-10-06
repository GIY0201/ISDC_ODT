# Native NodeScene frame reuse

The existing NodeScene looked up and validated complete native pose records for
each endpoint, again when placing links during flow animation. The change retains
those rendering operations and memoizes their validated geometry only within one
`syncFrame` call. Forty nodes still require forty current poses and forty forward
poses for model orientation. There is no persistent state cache or new clock.

The memo is bound to exact UTC, Viewer/Cesium references, definition Map/scope,
transition status and scene mode. A callback changing any binding invalidates the
frame and hides owned point/model/link output. Every later frame starts fresh.
Missing poses remain missing. Native metadata, definition hash, UTC and finite
vector validation are unchanged.

## Reproducible isolated measurement

`project_support/tooling/profile_node_scene.mjs` runs the actual NodeScene and
native sample buffer with a minimal Cesium CPU adapter. Input was extracted from
`t081_actual_20261007_030808.json`: 40 nodes x 601 native samples and the accepted
fabric query at the same UTC, with 60 OISL edges. The capture's 71 total links
include ground links; this benchmark has 60 OISL edges. The renderer proof hook is
an explicit performance adapter, not an independent optical proof.

Commands, from the development worktree:

```powershell
node project_support/tooling/profile_node_scene.mjs data/workspace/validation/native_scene_40_input.json --uncached
node project_support/tooling/profile_node_scene.mjs data/workspace/validation/native_scene_40_input.json
```

The `--uncached` mode restores only the preceding geometry/frame methods in
memory. It never changes product files. Thirty measured frames per mode:

| Mode | Geometry calls/frame | Median CPU | p95 CPU |
| --- | ---: | ---: | ---: |
| Preceding uncached methods | 360 | 47.84 ms | 56.88 ms |
| Ephemeral frame memo | 80 | 11.51 ms | 15.40 ms |

Median CPU decreased by approximately 75.9% in this isolated adapter. Receipts
are saved under ignored runtime artifacts `native_scene_40_baseline.json` and
`native_scene_40_memo.json`. This is not a GPU, browser FPS or live end-to-end
measurement; root must verify preserved-state gameplay separately.

## Regression evidence

Two new regressions were red before the change. They establish current/forward
pose reuse, fresh next-frame reads, changed UTC behavior, and failure closure
when a callback changes UTC, definition scope, morph status, Viewer or destroys
the scene. Existing original shader, marker, material phase, path, model cap and
malformed native/source tests remain unchanged.

```powershell
node --test project_support/tests/browser/node_scene.test.mjs project_support/tests/browser/node_network_timeline.test.mjs
```

Result: 48 passed. Root owns full-suite validation and live browser acceptance.
