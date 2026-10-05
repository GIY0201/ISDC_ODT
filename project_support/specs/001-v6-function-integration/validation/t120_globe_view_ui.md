# US17 application and UI progress

2026-10-05, FR026/SC023, same feature and full T075–T084 objective.

Implemented: OrbitGlobe delegates mode and source choices to its injected existing Viewer helper. Original dark/light orbital palettes, selected marker/label color, nonselected alpha multiplier0.65 and outlined selected track are applied without changing native coordinates or UTC. Render preferences are retained before Cesium boot, copied on read, enum validated, propagated with separate mode/imagery status and disposed with the globe. Provider construction remains at application boundary with original ArcGIS/OSM/NaturalEarth and current local BlueMarble.

V6 now has accessible mode/map/theme/emphasis controls. They appear at the top of satellite/ground work windows, keep copied choices during window reconstruction, support valid preference drafts and unsubscribe on teardown. Map theme refers to map styling, not an unrelated V6 chrome redesign. Solar shading remains pending explicit solar geometry.

RED before implementation: missing setViewStyle; missing observeView/provider injection; absent V6 controls at both dimensions. Those cases now pass. Existing mock renderer imports were extended to represent the new assembly dependencies; the isolated selection regression initially failed to rewrite the new import and was repaired without changing its assertion. Source controls behavior uses the real renderer with mocked Cesium boundary in workspace_fixture.

Node final whole suite:235 passed,0 failed,992.32ms (`node_t120_final.txt`). First Python full run423PASS5warnings177.09s (`python_t120_all.txt`); the panel ordering was adjusted while that run was active, so a fresh final whole Python run was started afterward (`python_t120_final.txt`). Record final outcome only after terminal completion.

Actual fixed8891 static reload, no server restart/port change:

-1280x720: BlueMarble ready,2D actual projected map, light map theme/emphasisoff, controls visible at top, canvas1. Screenshot `t120_2d_1280.jpg`.
-OSM ready,3D requested, then NaturalEarth ready.
-1920x1080:3D/NaturalEarth/dark/emphasisoff retained through minimize/reopen,canvas1,consolewarnings/errors0. Screenshot `t120_3d_1920.jpg`.
-Additional ArcGIS provider reported ready, rapid2D→3D request completed with latest3D choice and no consoleerrors. Returned to3D/BlueMarble/dark/emphasison.
-Actual orbit API state before/after the additional changes compares input/anchor/currentUTC/revision/observer/mask/playback/source hashes unchanged, saved in `t120_state_readonly.json`. This is a model-state comparison, not actual receiver evidence.

The first restore-button query used an incorrect label and matched nothing after successful minimize; fresh DOM identified the existing `shelf-restore` button and restore succeeded. Browser override reset; same tab retained for next verification.

Pending T121: consolidate original style golden/hover and all current scene/station/track coexistence with selected/full16633 display, controlled real-browser source-failure/fallback behavior and final provenance comparison; Draft review publication. Helper unit tests cover source/tile failure/fallback/destroy, but this report does not call actual fault injection complete. Original GLB/camera/solar and T076–84/performance/actualreceiver/filedownload gaps remain open.

Final code regression:423PythonPASS/5existingwarnings176.61s and235NodePASS992.32ms. Both final suites run after panel placement change; no later product edits. T117/T118 complete. T119 pending original hover styling and full source-style audit; T120 controls connected but re-created-panel DOM change-listener disposal/rebinding remains to verify/fix (observer subscription disposal already present). T121 selected/whole scene coexistence/fault-injection/Draft remains pending. Do not close US17/T075 from this evidence.
