# T151 node lighting and shared view composition, partial

Actual workspace_orbit injects its existing WorkspaceSolar into WorkspaceNodes.
The source node lighting button reads the same copied enabled preference and
calls the same setEnabled owner as the common globe setting. Existing localStorage
key spacetwin-globe-lighting-v1, window event, storage mirroring and denied-storage
session policy remain in WorkspaceSolar. Node composition adds no second
preference, renderer, solar query, clock or event writer. Owner notifications
refresh only source scene controls; held callbacks and observers are fenced by
node workspace disposal. Unknown solar owner leaves lighting capability absent.

The existing WorkspaceGlobe view owner supplies theme and queued mode status to
NodeScene. Current theme is applied at renderer attachment, including a view
changed before node boot. Changes call source setTheme/update without replacing
node definitions or recreating editor/fleet DOM. Native fleet models/links receive
existing queued-morph guard; physical MORPHING checks remain in NodeScene. The
already mounted common globe view panel remains the single 2D/3D/imagery/theme
command surface. No extra scene, provider or view state is added.

OrbitGlobe.palette returns a copied source-compatible color mapping from its
existing palette, adding fallback/hover/pathOutline semantics used by NodeScene.
Tests compare eight consumed color keys in both themes with pinned original
original_node_markers.json. Node renderer receives this injected palette so MEO,
GEO, HEO and light-theme paths no longer fall back to LEO/default dark colors.

Beforecode RED: missing lighting/callback and node palette/morph injection plus
missing OrbitGlobe palette. Focused tests pass. Actual V6 composition runs with
real application/panel/store/globe/solar modules and DOM/Cesium/HTTP doubles at
1280x720 and1920x1080: node button/common checkbox synchronize, light-theme
preserves enabled preference, 2D/3D uses one Viewer, and no orbit/SIM commands.
The shared fixture now exposes the actual preRender event needed for node renderer
attachment rather than silently leaving node phase error. Existing catalog scene
assertions initially assumed primitive index0 belonged to catalog; they now check
its explicit catalog identities25544/16633 while preserving full row assertions.
No physics/API assertion was weakened. Boundary doubles are not live GPU proof.

Final fullNode654PASS4785.9543ms. FullPython649PASS8existingERFAwarnings193.28s, session92082exit0. Syntax/whitespace checks and live evidence
status are recorded below. Installed native/original root/live8891 unchanged.

T151/N005/T152/T153 and fullT075-T084 remain open: hover facts/scene composer,
storage/HTTPcrypto/failure restoration, controlled native install and owned8891
input/SIM capture/restart/restore, actual browser matrix, Terra/allassets/N001,
T032/T137auth/equipment/RF/HIL/filebytes/review. Same development branch.

Actual isolated receipt data/workspace/validation/install/fd2f28262715492a8077df0f2785eac6/isolated_call.json:60native/selectedposes, source numeric5.4569682106375694e-12/time0ms/equality+verifiertrue, wheel SHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. Syntax and git diff --check pass.
