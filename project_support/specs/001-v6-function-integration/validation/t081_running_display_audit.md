# T076/T081 running sourceSIM display acceptance gap

Readonly audit; no shared renderer/clock, live server or user run mutations.

## Current evidence

`workspace_globe.js` validScenarioContext requires actual runtime.running=false
and exact saved candidate UTC. Thus starting the actual source scenario hides
all shared source node poses even though the node buffer contains valid future
positions. Setting a new exact current running UTC is also rejected. This is an
acceptance gap compared with original live sourceSIM rendering, not an absence
of propagation data.

Audit command:
`ISDC_SCENARIO_NATIVE_EVIDENCE=data/workspace/validation/t081_actual_20261007_030808.json node --test project_support/tests/browser/scenario_running_display_audit.test.mjs`

Both audit cases passed. The native case replays an actual installed-Rust receipt
from the isolated ASGI capture:40 nodes each with601 one-second samples.
Every node supports display interpolation at12.5s, reports interpolated=true,
and preserves SOURCE_KEPLER_J2_V1 / EARTH_FIXED_GMST_UTC_APPROX /
SOURCE_MEAN_EQUATOR_EQUINOX_APPROX / unix_ms_utc_approx /
engineering_assumption metadata. Interpolated communication states are rejected;
600.001s beyond the bounded buffer and changed full definitions return null.
No native values were manufactured. This replay is not a new live/browser test.
The other case uses the actual shared globe owner with only presentation stubbed
and explicitly asserts the current running gate gap. Once corrected, replace
that audit assertion with positive running acceptance and drift/foreign tests.

## Existing reusable owners

NodeDisplayTimeline already owns bounded immutable buffers, serial/coalesced
native queries,601 sample grids,300s forward prefetch and30s track refresh.
createSampleBuffer linearly interpolates adjacent one-second valid position
samples, refuses errors/gaps/extrapolation, and carries canonical requested UTC.
No new propagator, Viewer or current-state store is required.

The shared Viewer preRender calls notifyDisplay and displayContext on every
frame. A sourceSIM displayContext can derive current canonical UTC directly
from its bound actual RuntimeState accessor, while retaining explicit source
run identity. That must not relax prepareSimUtc/verifySimUtc/native mission
paused exact receipt guards. GP/ITRF poses must remain hidden unless freshly
calculated in their separate accepted scopes; never relabel them as sourceSIM.

## Proposed smallest integration contract

1. Authorize a sourceSIM *display scope* with run_id and leap hash, not a frozen
   display timestamp. Every frame validates actual same run, valid canonical
   current UTC, accepted scope and connection freshness; derives display UTC
   through the existing bound runtime accessor. Foreign run/reset/error/stale
   clears or hides immediately. Existing display observer sends UTC changes to
   NodeDisplayTimeline.observe; callbacks never create a second time owner.
2. Preserve explicit source engineering frame/quality metadata on node geometry
   and selected-model pose. Never call this ITRF, TEME, actual measured RF or a
   noninterpolated communication input.
3. Retain exact paused sample requests and hashes for communication/planning.
   Rendering may interpolate inside accepted native grids only. Overrun/failure
   hides the pose rather than freezing a stale position.
4. Current RuntimeState loop updates0.2s but telemetry websocket publishes1s.
   Direct runtime UTC fixes running visibility but gives1Hz pose steps. Original
   scenarioClock interpolates displayed elapsed between accepted telemetry
   frames using receivedAt and source speed. The adapter currently leaves
   receivedAt null. Smooth original behavior needs a readonly accepted-frame
   receipt timestamp from the existing SIM owner passed into that *existing*
   source clock; no new clock. Bound receipt age and label projected SIM UTC
   separately from exact actual public UTC/native proof. This display projection
   must stop when running=false and hide after stream freshness expiry.
5. Tests needed before shared changes: actual running40-node receipt samples,
   fractional frame progression,120x bufferprefetch/overrun, pause/step/advance,
   foreign/reset/definitions/hash drift, stream timeout, error gaps, exact
   communication exclusion, selected-model follow using same display UTC and
   disposal/no new Viewer. Browser evidence remains root-owned and outstanding.

## Implemented bounded display integration (focused verification)

Existing SIM owner now exposes displayReceipt(): a timestamp of its validated
accepted telemetry frame with current run/sequence/elapsed/speed. Loading a new
bootstrap clears it; stale/error/busy/disposed states return null. No new timer
or runtime state is introduced. Existing source scenario clock.displayProjection
uses that timestamp and its existing runtime/source speed for display only;
negative/older-than3500ms age is rejected (same existing stream timeout).
The shared globe bindScenarioRuntime third argument accepts projectDisplay.
Running rendering requires exact current runtime run/sequence/elapsed binding,
canonical UTC and source-speed projection delta; it labels projected=true and
source engineering frame/time quality. Paused native scope stays exact.

Focused14 tests passed, including actual40 receipt replay,120x fractional
projection, invalid projection identity/UTC/age, paused UTC drift, fault present,
bootstrap/stale/error/dispose and existing SIM behavior. Root must inject the
readonly receipt accessor and common UTC formatting in workspace_orbit.
Running optical updates require a separate display-only skip gate to avoid
60fps exact communication requests; no projected pose may become a native
communication proof. Browser acceptance remains pending root-owned checks.

## Pose-only runtime transitions and communication exclusion

Projection-enabled display scopes derive exact actual UTC while paused, avoiding
buffer destruction on normal running/paused transitions. Legacy two-argument
bindings retain frozen paused UTC behavior. The node workspace observer keeps
calling the existing bounded/coalesced display timeline; on projectedSIM frames
it skips optical updates and clears previous communication proof once on entry.
Manual network inputs reject projectedSIM explicitly. Exact paused native
communication requests are queued before display observer work and no longer
wait for the independent601-sample/track preparation. The node clock reads
actual running/speed and routes explicit source owner pause/play/speed/step,
validating projected run/sequence/elapsed/age/time provenance.

Focused58 tests passed with actual-native capture environment set (zero skips).
A mounted existing node workspace regression sends60 projected frames inside
its accepted native buffer: zero additional sample queries, usable source pose,
and explicit manual network rejection. Native mission preparation continues to
reject running/dirty/foreign/UTC/hash drift. Real-time browser smoothness is
still a distinct root-owned acceptance check.

## Telemetry-triggered explicit command starvation

Root live observation found pause remaining pending while readonly samples kept
cycling. A deferred existing-runner transaction reproduces this independently:
while an exact source tick is blocked, request pause/speed/advance and send30
telemetry callbacks, invoking the restarted interval tick. HEAD runner creates
both interval timers again during the drain (2 instead of0), permitting another
coalesced tick to extend the drain. The readonly HEAD artifact
`data/workspace/validation/scenario_runner_pre_drain.mjs` reproduces all3 RED
cases via `ISDC_SCENARIO_DRAIN_RUNNER` in scenario_command_drain.test.mjs.
No current product file was reverted during the RED verification.

The existing runner now owns a pending-control count and serialized explicit
command queue. Telemetry, interval and old coalesced ticks cannot restart work
while controls drain; only an advance's explicitly required internal tick can
run after the existing lease finishes. Successful speed/advance resume existing
timers once if the source phase remains playing; pause reaches paused without
restarting timers. The same3 regressions pass, with max one native exchange
active. Combined runner/nativebridge/resume31 tests pass. No original source
step actions, mission planning order or40-node scope changed.

## Explicit analysis-follow transport and readonly capability fencing

The existing catalog, stored-orbit and node clock controls now delegate explicit
play/pause/speed/step commands to the actual followed source clock. The new
analysis_transport helper owns no clock or runtime state. During pending follow
verification or release, controls refuse rather than falling back to an
independent GP clock. Independent seek/epoch/live requests require explicit
release first. Observation and selection changes invalidate follow before
changing their existing owner; disposal permits no late transport writes.

The existing follow coordinator checks its complete stored/catalog identity and
actual run_id whenever a followed capability is read. External accepted observer,
GP hash or run changes invalidate that capability without rollback, GP clock
writes or server commands. Actual assembled stored controls show the source's
running flag and current speed, including the original supported source range.

Completed checks retain their original absolute capture timestamp and explicit
elapsed seconds separately. The panel uses elapsed seconds for T+ labels. Legacy
records lacking explicit elapsed evidence are classified legacy_current; no
elapsed time or completion UTC is fabricated from an epoch timestamp.

Focused verification: 48 PASS, 0 FAIL, 0 SKIP across analysis_transport,
analysis_follow, node_clock_controls, catalog_follow_transport,
catalog_time_assembly, workspace_orbit_selection, stored_follow_transport,
scenario_command_drain and scenario_runner test files. These are existing-owner
and assembly routing regressions; they do not replace root-owned live browser
acceptance or a new whole native scenario execution.
