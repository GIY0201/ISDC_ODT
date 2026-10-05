# T129 stationary hover and whole-catalog observation

2026-10-05. Same T075–T084 scope, same US18 and fixed port8891. Product code unchanged; added regression coverage to `catalog_scene_globe.test.mjs`.

The new test keeps a cursor stationary while whole-scene coordinates and UTC refresh. It checks the picked projection changes, selected playback uses its own UTC despite a later scene snapshot, fractional playback retains the interpolation label and cursor position, and destruction clears the card. This exercises the real OrbitGlobe implementation with a renderer fixture; it does not prove actual accelerated playback or physical coordinate accuracy.

Whole Node:326PASS,0fail,1219.609ms. Log:`data/workspace/validation/ground_stations/t129_hover_refresh_node.log`. Whole Python:440PASS,5existing ERFA warnings,209.84s; original session89096 ended exit0. Log:`data/workspace/validation/ground_stations/t129_hover_refresh_pytest.log`. Git diff whitespace check passed with the existing Windows line-ending notice.

## Actual fixed8891 browser

The previous temporary tab was absent in the current browser inventory; its old in-flight request was not claimed complete. A new temporary tab performed the normal UI query at independent whole-scene UTC `2026-10-04T22:01:12.212544000Z`. The actual panel reported16633/16633 valid,0failed, IERS-A UT1/polar-motion predicted_a. No wall-clock substitution or stored-input selection command was issued.

At1280×720, normal mouse movement to a visible point at(849,301) showed STARLINK-31879/NORAD59937/LEO/486.238km with that exact snapshot UTC and WGS84 ellipsoid height. Moving to empty space(350,280) hid the card. Actual 2D/light-theme morph completed before observation; mouse at(850,301) showed STARLINK-11209 [DTC]/NORAD61200/LEO/360.422km with the same UTC. Console warnings/errors were empty at the recorded3D observation. These are render/display observations, not independent geodetic or ephemeris accuracy bounds.

Ignored screenshot evidence:
- `data/workspace/validation/ground_stations/t129_whole_scene_hover_1280.jpg`
- `data/workspace/validation/ground_stations/t129_whole_scene_hover_2d_1280.jpg`

Temporary page choices were restored to3D/dark and the agent-created tab closed. User tab preserved; no server restart, port change, native/wheel/API/PR/merge changes. No 1920whole-scene, actual stationary replay, edge/live-error or all50 model acceptance claim. T123/T129 faithful Terra dependencies, live camera/error cases, solar and full T075–T084 remain open, along with T032/actual equipment/download/AeroDT gates.
