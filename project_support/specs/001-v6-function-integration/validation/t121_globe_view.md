# US17 globe display controls verification

2026-10-05, FR026/SC023 → T117–T121; original reference1a1e002. This closes only the view-controls increment when Draft publication is verified, not full T075–T084.

## Source and implementation

Original globe modes/1.5s transitions/north-up2D/rotate-tilt/minzoom1000vs100000, imagery providers/NaturalEarth fallback, brightness/contrast/saturation/gamma/dark-light palettes, selected path outline1.4, hover max(7,size*2.2) and background selection alpha0.65 are reused in the injected existing Viewer. Current local NASA BlueMarble remains default. Immutable native coordinates and separate selected/whole display UTC are preserved. Solar lighting waits for explicit geometry.

Original hover emphasis is now bound to the existing typed mouse handler and mouseleave; changing hover touches only previous/new points, repeated same-target input performs no color allocations, failure/clear/theme/selection restores original styles. No JS propagation/clock/API is called. Panel disposal now removes all bound field handlers including detached nodes, and a new panel owner rebinds existing nodes once. Snapshot/draft state remains copied and enum validated.

Original orbit.js hoverSatellite also has a name/NORAD/orbit-regime/altitude card. That card is explicitly retained in the remaining T075 model/inspector design; hover emphasis is not a claim that this separate card has been connected. No invented altitude fallback.

## Automated evidence

- RED missinghoverCatalog and panel listener count1vs0 proved gaps before edits; now pass.
- Actual typed input registration/leave/failure/no-selection plus 16633 hover allocation/style/ownership tests pass.
- Panel disconnected/connected removal, remount one owner and teardown observer tests pass.
- Full Node238PASS,0fail,1012.3735ms: `node_t120_lifecycle.txt`.
- Full Python423PASS,5existingwarnings,177.34s with fresh project basetemp: `python_t120_lifecycle.txt`.
- Earlier UI/renderer API/style/mode/provider/busy/late/fallback/error/destroy/source golden tests retained. Git diff check pass. No native wheel/server/schema change.

## Actual fixed8891 evidence

Use the final static reload; no server restart/newport. Prior t120 report includes each map provider ready and modes/theme/emphasis/restore at1280x720 and1920x1080.

Current whole active catalog:16633valid/0errors at2026-10-04T12:43:41.833920000Z. Selecting original CALSPHERE1/NORAD900 from the existing first100 list retains the whole scene and29 representative stations; selection UTC2026-10-04T15:01:25.220640000Z, ITRF(-4024583.30,-1101957.60,6049369.35)m and predicted_a UT1/polar-motion labels. Track1021valid/0errors,6275.784s period/1segment. Selected and whole UTC remain separately visible.

At1280x720, selection/track/full scene coexist in3D and light palette. At1920x1080, same full count/segment persists in2D/dark/BlueMarble with onecanvas; final3D restored and viewport reset. Screenshots: `t121_selected_full_1280.jpg`, `t121_coexist_1920.jpg`.

Controlled browser fault: temporarily blocked only ArcGIS resources and disabled cache with CDP. Selecting ArcGIS showed its real provider failure and explicit NaturalEarth fallback, requested satellite/displayed natural,16633/canvas1 retained. Screenshot `t121_injected_map_fallback.jpg`. Both request block and cache override restored in finally. Fault injection is simulated network failure, not evidence that the provider is generally unavailable. Subsequent BlueMarble loads ready; captured browser warn/error logs empty.

Actual mouse input: a center pixel returned no catalog hover (inconclusive overlap), then the visibly drawn selected marker edge(682,402) produced pointer cursor on globe container and canvas. Moving to rail(40,402) cleared cursor. No claim that the first unhit coordinates selected a specific satellite. Unit tests prove nonselected color/size and no commands, while this shows actual binding works.

Saved orbit input/anchor/currentUTC/revision/ground/mask/playback/hash fields compare exactly against the prior t120 baseline, unchanged in `t121_state_readonly.json`. SIM command immutability is covered by assembly tests; no actual receiver/HIL or absolute SIM-time stability claim.

## Publication and remaining scope

T119/T120 functional complete. T121 publication remains pending until remote tree/Draft URL abovePR30 and task attachment are verified. Overall goal active. T075 actualGLB/thumbnail/mapping/camera/hovercard/solar, T076–84, T032/SC006/F001/F004–6/actualdownloadedbytes remain open. No performance acceptance or automatic merge.
