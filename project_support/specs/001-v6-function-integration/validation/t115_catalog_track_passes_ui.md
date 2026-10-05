# T114–T115 selected track and24h visibility V6 integration

## Scope and automated verification
Readonly catalog pass controller and panel added; selectedGP/UTC/observer/mask/source/hash matching, generation/abort fencing and owned results. Explicit24h SI query reuses native precise API. Table and UTC timeline expose complete/partial/none/error, clipped boundaries, zero-duration contacts and errors. AOS seek changes only selected catalog timeline and calculates its existing observation buffer. No stored orbit/runtime command.

Original one-period track retains dense±45s/.1s renewal, onepending/latestUTC coalescing and full-failure masking. Renderer receives validated segmented ITRF metres, width3/ArcType.NONE, never bridges failed rows; track toggle removes only owned track entities. Wholecatalog primitive collections, station entities and singleViewer remain. Pending track status includes last displayed referenceUTC. Checkbox drafts/window restoration preserve UI preference.

RED: missing pass controller and renderer method, then missing actual panel. Initial assembly harness used wrong fixture export/property; corrected before confirming missingpanel RED. Controller4tests, renderer1 and actual two-size composition1 PASS; additional partial-with-no-known-interval case preserves unknown semantics from existing search_visibility. Node full224PASS966.3763ms; Python full423PASS5existingwarnings243.40s. Logs: data/workspace/validation/ground_stations/node_t115_all.txt and python_t115_all.txt. Git diff check PASS. Python/native/API formulas unchanged; current API remains T113 evidence. Static reload only; no server/SIM restart in this stage.

## Actual fixed8891 browser
Final static reload verified. Actual ISS25544 currentcatalogGP e24fac3257361f114c8129f535d53dde06f9e11b2ad225e9ee1e87535e678b9d, reference2026-10-04T12:43:41.833920000Z, track1021/1021success,period5578.758s/onesegment. Daejeon36.3742/127.3567/userWGS84height123.45m/minimum5degrees:24h7intervals,zero contacts/errors. Both1280x720 and1920x1080 have oneCesiumcanvas, seven table rows and path. Actual wholeactive16633/16633success coexists with selectedtrack/stations in sameViewer; errors/warnings0.

Clicked first AOS→2026-10-04T23:40:56.689388750Z; trackhide→0segments, restore→1. Selected60x replay advanced UTC; stop and epochreturn worked. Windowminimize/restore preserved sevenrows/track/onecanvas. Minimum90degrees returned none/0intervals/0contacts/0errors, restored5degrees→7. Original savedGP/anchorUTC/observer/mask/playback/sourcehashes compared with T113restore snapshot after UI work:exactlyunchanged. Evidence t115_saved_state_readonly.json.

Screenshots under ignored data/workspace/validation/ground_stations: t115_passes_1280.png,t115_passes_1920.png,t115_track_globe_1920.png. Temporary viewport reset and tab markedhandoff. These are geometric model outputs, not measured RF or actual receiver evidence. No performance percentile acceptance claim.

## Status and next
T111 aggregate RED categories, T114 composition and T115 renderer scopedcomplete. T116 remains pending for consolidated exact-head verification, remaining selection/pick/replay acceptance and Draft PR above29. Full T075–T084 remain open; original sun/modes/imagery/labels/models and all other module work retained. T032/SC006,F001/F004–6,disk-saveunknown preserved. No merge.
