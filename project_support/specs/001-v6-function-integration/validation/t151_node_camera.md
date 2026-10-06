# T151 shared node camera controls, partial

The actual source node work panel routes wheel buttons (+120/-120), logarithmic
zoom slider and home through the existing WorkspaceGlobe / OrbitGlobe /
CenteredCameraMotion and SatelliteModelLayer owners. No Viewer, propagation,
analysis clock, animation timer or separate input handler is added.

Pinned reference: source commit 1a1e00297a0301637455b0ef2cf48b2e74576b07,
user_application/web/scripts/orbit/zoom_controls.js and
digital_twin/visualization/globe.js home method. Preserve source slider formula
100*log(max/distance)/log(max/min), inverse max*(min/max)^(value/100), Earth
limits 6,498,137..1,006,378,137 m and 2D widths 1,000..40,000,000 m. Tracking
reads existing model-relative range and source size-based minimum; commands use
existing model setZoomDistance, including its existing release/clamping policy.
Earth targets reuse CameraRangeMotion and existing preUpdate easing.

Source home retains longitude126.9/latitude20, viewport short-axis fit to an
8,000,000m shell with factor1.06, pitch-89 degrees and duration1.4s. 2D uses
existing flyHome. It releases existing tracking/range motion before flight.
Queued or physical morph, unavailable camera and disposal reject commands.
The source panel disables home before releasing tracking when cameraReady=false.
Escape options (aimAtEarth) now pass through both application wrappers intact.

Camera state is a copied presentation value; observers run from the already
owned node preRender frame and existing view-status notifications. Only source
scene controls refresh on camera changes, retaining editor/fleet DOM. Unchanged
state sends no new notification. Cleanup fences held callbacks and removes
observers; no second frame loop.

Before-code RED: missing zoomState/home methods (3 cases), missing workspace
observeCamera and node-panel zoom routing (2 cases), and unavailable camera home
button incorrectly enabled (1 case). Targeted then full browser tests pass.
The full validation process exited successfully; results follow below.

These DOM/Cesium boundary tests do not establish live GPU rendering or game
frame performance. Existing8891 process and installed native wheel unchanged.
N005/T151/T152 remain open until actual controlled installation, input/SIM
capture/restore and live browser interaction acceptance. FullT075-T084 scope,
Terra/allassets/N001/T032/T137/equipment/RF/HIL/filebytes/review remain open.
Next shared view/lighting, hover facts, scene composer and storage/HTTP/failure
cases, then owned8891 installation/restart/restore and live matrix.

Final validation: fullNode649PASS4272.0592ms, fullPython649PASS8existingERFAwarnings198.53s, session65719exit0. Syntax and git diff --check pass. Actual isolated receipt data/workspace/validation/install/e1768ada6f794f1db263ea66e021783e/isolated_call.json:60native/selectedposes, source numeric error5.4569682106375694e-12/time0ms/equality and verifier true; wheel SHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. No live8891/native install/remoteGit/newbranch changes.
