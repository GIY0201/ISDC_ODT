# Sampled optical connection checkpoint

2026-10-07. Existing feature, branch and 8891 runtime retained. This is a partial
connection checkpoint; whole T075–T083, N015 and T032 remain open.

The actual catalog owner now issues opaque continuity authority through the shared
globe. The existing optical owner captures exact native analysis UTC and retains
one physical history. The application scheduler samples at 1000 ms, retaining one
active query and one latest pending intent. Natural display frames do not create
analytical queries. Registered sampled views reach NodeScene and the selected/fleet
panel with separate analysis/display UTC, age and engineering-assumption labels.
Existing exact action, mission and network receipts retain their original checks.

Meaningful regressions include same-UTC capability revocation, ignored-abort native
draining, complete 240-node scope, viewer replacement between frames, final external
callback revocation, disposed panel getters and nested refresh preserving the newer
result. Independent renderer/scheduler review passed 157 focused tests; independent
UI review reproduced two additional reentrant paint failures before their repair.
The repaired UI has 40 new and 35 legacy tests passing. Actual catalog command
binding is checked in both 1280x720 and 1920x1080 fixtures. Scheduler-mounted scope
tests use a controlled capability; a complete active real-owner composition test is
still required and is being added independently.

Full browser regression: 1368 passed, 0 failed, 0 skipped, 12121.0829 ms. Log:
`data/workspace/validation/full_migration_node_sampled_optical.log`. Fresh required
Python regression is running in handle 40607; no success claim yet. Actual GPU
performance and the full repeated-trial protocol have not been measured for this
patch. Previous live performance failure remains unresolved.

## Context7 documentation check

The user explicitly requested current documentation checks for repeated problems.
The installed ctx7 CLI resolved the official Cesium reference index
`/websites/cesium_learn_cesiumjs_ref-doc`. Two queries checked event removal,
primitive ownership/destruction, polyline reuse and explicit-rendering behavior.
The application pins Cesium 1.143; this lookup does not establish that 1.143 is the
newest release or justify an unsolicited upgrade.

- [Event](https://cesium.com/learn/cesiumjs/ref-doc/Event.html): addEventListener
  returns its removal callback, matching retained scoped removers.
- [PrimitiveCollection](https://cesium.com/learn/cesiumjs/ref-doc/PrimitiveCollection.html):
  destroyPrimitives controls removal/destruction, with default true; retain the
  collection's original Viewer owner for cleanup.
- [PolylineCollection](https://cesium.com/learn/cesiumjs/ref-doc/PolylineCollection.html):
  temporarily hiding a line is more efficient than removing/readding it; after
  destroy only isDestroyed may be used. Existing line resources are reused.
- [Scene](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html): requestRenderMode
  needs explicit requests after relevant changes. Do not enable it blindly for
  continuously advancing native geometry or claim that it fixes stale authority.

The reproduced failures were application authority and callback lifecycle races,
not proof of an obsolete Cesium API. Latest-reference compatibility does not replace
version-pinned source comparison, adversarial regressions or actual GPU evidence.

## Remaining original communication connections

Independent readonly comparison against pinned upstream 1a1e00297a0301637455b0ef2cf48b2e74576b07
found the following original lifecycle/presentation paths still needing connection:

1. Sampled network/ground links, coverage and diagram during natural playback.
2. Periodic guarded network exchange, DTN progress and selected route refresh.
3. 30-second module status polling.
4. Future three-hour passes refreshing after 60 seconds of analysis progression and
   immediately after station changes.
5. Bounded 48-sample link-quality history and sparkline.
6. Route/selected-link emphasis covering OISL as well as ground links.
7. 3D ground-station selection and explicit focus.

Existing exact native network calculations, manual fabric exchange and route/hop
lists are already connected; these residuals must not be described as missing
backend math. Sampled network views require a separate registered projection in
the existing network owner and must never satisfy fabric/action approval. Automatic
exchange needs an exact current native/module/configuration contract, not a sampled
visual DTO. No separate propagator, history, clock, runtime or Viewer is permitted.

User priority: complete functional connection before PR preparation/review; once
connected, PR work proceeds in parallel with validation. Do not stop connection
work to wait for remote Git credentials or review results.

### Fresh full Python result

Handle40607 completed exit0: 965PASS/1PillowSKIP/8existingERFAwarnings245.86s.
Full browser1368PASS12121.0829ms applies to stable optical application code before
new real-owner fixture tests. Current two-resolution/full240 real-owner composition
is still being stabilized independently; visual601 buffer requests must be separated
from exact point analytical requests. No live GPU or wholeconnection completion.
