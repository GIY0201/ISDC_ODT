# T129 2D focus diagnosis: map visibility, not a proven camera defect

## Correction of preceding observation

The preceding `t129_model_tracking.md` recorded a black background after ISS 2D focus as a failed display observation with unknown cause. Keep that screenshot and report. Fresh actual browser evidence narrows the cause: the map is rendered, but the original dark/emphasis styling suppresses detail in the dark NASA Blue Marble ocean. It is not evidence of a camera projection failure. Dark-mode readability remains unresolved, and this does not complete T126/T129.

## Actual fixed-port checks

On the actual V6 page `http://127.0.0.1:8891/?validation=t129-map#satellite`, selected original ISS model, switched to 2D, focused and minimized the work window. The black appearance was reproduced with NASA Blue Marble, dark theme and emphasis. No warning/error console messages were observed.

Read-only debugger observations in the existing mapView method (all breakpoints removed; debugger resumed and disabled): final camera position `(14821836.372636374, 19.550834491965396, 12756274)` metres in camera map coordinates, width `499999.9999999984` metres, target longitude `133.14682152257902` degrees and latitude `0.00017562813441423638` degrees; scene mode 2, globe.show true, globe.tilesLoaded true, one imagery layer. Near/far were 1/500000000 metres. The camera's planar direction mapped to world direction (-1,0,0), consistent with Cesium's 2D transform. No diagnostic mutation of application objects was performed.

Changing imagery to Natural Earth exposed map texture at the same focus. Returning to the same NASA image and choosing light theme exposed islands/coastline at the same focus. In dark theme, disabling emphasis also exposed those features. The local NASA source JPEG itself has very dark ocean; the existing original style is brightness .56, contrast 1.28, saturation .5, gamma .88 in dark/emphasis mode. We preserved that original behavior instead of introducing an unsupported camera correction or silently changing styling.

Saved actual screenshots under `data/workspace/validation/ground_stations`:

- `t129_map_light_1280.jpg`: 1280×720, one Cesium canvas, NASA map and selected ISS point/track.
- `t129_map_light_1920.jpg`: 1920×1080, same NASA map/focus in light theme.
- `t129_map_dark_no_emphasis_1920.jpg`: 1920×1080, dark theme without emphasis; visible map detail.

Projection contract/source checked against official Cesium 1.143 Camera.js: https://raw.githubusercontent.com/CesiumGS/cesium/1.143/packages/engine/Source/Scene/Camera.js (setView2D and Camera.TRANSFORM_2D), and public Camera.setView documentation: https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#setView. The code uses the documented Cartesian destination conversion and orthographic width convention.

## Limits and cleanup

This verifies the selected ISS 2D focus with visible imagery in the alternate style at two sizes. Static NASA image detail is low at this close scale; no high-resolution or real-time imagery claim. It does not verify live playback/follow/zoom/pan or every asset/mode. No product code changed, so no fresh full test run was needed; the existing tracking-repair tests remain historical evidence for their own commit. T075–T084 and other open gates remain unchanged.

Only an agent-created background tab was used. Its settings were returned to NASA/dark/emphasis with tracking released and a 3D transition requested before closing the tab; transition completion was not reobserved. Temporary viewport override reset and temporary tab closed. User-owned tab, server port/process, stored GP, server UTC and SIM commands were not modified in this check. Native hover composition remains the next independently actionable implementation step; dark-style legibility requires an explicit documented design choice and regression if changed.
