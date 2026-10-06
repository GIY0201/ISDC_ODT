# Current V6 browser performance acceptance plan

2026-10-07. This is an inspected execution plan, not a performance result. The
original SC-006/T032 thresholds remain unchanged. T075–T084 remain open.

## Separate requirements and evidence

The original first-stage SC-006 workload is one satellite and one ground point.
It requires 1280x720 and 1920x1080, three completed foreground interaction trials
of at least thirty seconds per resolution, presentation interval p95 <=16.7 ms,
input-to-feedback p95 <=50 ms, one hundred distinct UTC changes with result
p95 <=100 ms, twenty different 24-hour visibility queries with result
p95 <=1000 ms, and zero stale-result overwrites. Record p99, maximum, failures,
display refresh premise, browser/GPU/power/device-pixel-ratio and raw artifacts.

The expanded node-rendering gate is a separate workload. A forty-node CPU
adapter benchmark and a 240-row native response do not prove 240-node browser
presentation. Current NodeScene has MAX_MODELS=64 and 240 point/label definitions;
the 240-node measurement must explicitly report this existing rendering profile,
models/path/OISL visibility and native readiness. It must not be labelled 240 GLBs
or a 240-node accepted communication network. Request-render mode makes an idle
paused globe unsuitable for measuring sustained frame intervals: use real,
continuous camera/pane interactions rather than counting timer callbacks.

## Safe draft-only 240-node staging

1. Before opening a new validation target, save read-only server and existing
   browser receipts: run identity, elapsed time, running flag, deployment
   revision and roster, current missions/faults, source definitions and original
   browser draft form. The finished forty-node run must remain unchanged.
2. A new tab at the same 127.0.0.1:8891 origin does not isolate drafts: the node
   store uses localStorage and workspace uses an origin-scoped BroadcastChannel.
   A localhost:8891 target is a distinct origin on the same fixed port. Inspect
   it first for pre-existing user drafts; preserve them and avoid overwriting
   them. An actually isolated browser profile is an alternative, if the browser
   tool explicitly supports one. Do not assume a named tab is an isolated profile.
3. In the actual Satellite UI, open the source-node work panel. Record its
   displayed UTC/provenance and verify that current native geometry is available.
   Do not change the shared server GP selection/time or SIM clock solely to
   obtain a benchmark. If no display context is available without doing so,
   record that prerequisite as missing and continue other acceptance work.
4. In an empty validation draft, disable `#formation-live`, select the Walker
   delta preset, enter twelve planes and sixteen satellites per plane, give it
   a validation prefix, then click `#formation-generate`: 192 draft nodes.
   Set a different prefix and three planes by sixteen, then generate a second
   formation: 48 more nodes. The generator creates a new formation identity and
   calls store.addMany. The maximum per formation is 192, so a single 240-node
   formation is not a supported UI path. With a nonempty draft, first determine
   whether an additive formation total of exactly 240 is possible; do not delete
   user nodes to simplify a measurement.
5. Wait for the visible Rust calculation to settle. Export/capture the rendered
   `#node-scene-definitions` text and `#node-scene-summary`, verify 240 unique
   definitions and unchanged accepted server roster. Record visible model-ready
   and calculation errors rather than filtering them away. Keep exactly one
   globe canvas in the validation window and use the existing Viewer/UTC owner.
6. Do not click nodes-deploy, nodes-reapply, nodes-recall, nodes-recall-reviewed,
   scenario configuration, runtime play/pause/step/reset or mission commit while
   staging this load. A query and draft render do not require deployment.
7. After measurement, remove only the two identified validation formations via
   the UI if cleanup is needed; compare original drafts and read-only server
   receipts. Preserve failed traces and screenshots. Never clear origin storage
   or restore it through hidden internal app objects to bypass normal controls.

## Trace and interaction protocol

Use the existing instrumented entry `?validation=t032#satellite`; workspace.js
loads orbit_ui_measurement.js only for t028/t032. It adds the actual thirty-second
measurement control and emits `orbit-frame-trial-N-start/end` performance marks.
Existing tooling already analyzes official Chrome tracing; do not add a parallel
RAF-only FPS estimator or substitute a native CPU result.

Before each resolution, wait for model/native/tile loads, record console errors,
environment, viewport, device pixel ratio and one-canvas proof. Foreground the
target throughout each trial. Start Chrome tracing with timeline/user-timing/
frame/GPU categories supported by that installed browser, using ReturnAsStream.
Click the page measurement button and perform sustained camera rotation/pane
movement for thirty seconds. Capture all three completed trials, not just the
best one. Record visibility/focus changes throughout; start/end visibility alone
cannot establish continuous foreground execution. When an interaction is
interrupted, preserve it as an incomplete trial and take an additional completed
trial without erasing the failure. Avoid simultaneous full-suite CPU load while
measuring; record other active workloads rather than silently stopping them.

End tracing, retain tracingComplete.dataLossOccurred, read IO.read until eof,
respect base64Encoded, save exact stream bytes and close that stream handle.
If events were dropped, stream incomplete, renderer ambiguous or presentation
events absent, the result is unproven. The documented Chrome domains are
[Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/) and
[IO](https://chromedevtools.github.io/devtools-protocol/tot/IO/).

Analyze saved records with the existing command:

```powershell
node project_support/tooling/measure_orbit_ui.mjs RECORD.json SUMMARY.json TRACE.json
```

orbit_trace_measurement.mjs separates renderer-specific
AnimationFrame::Presentation intervals inside completed marked trials from
Display::FrameDisplayed/DCompPresenter::Present counts. Neither these counts nor
RAF cadence certifies physical monitor scanout. Its `gates.protocol` only checks
marked trial duration/count: independently verify trace completeness, event
coverage, foreground state, exactly the requested workload and both resolutions
before accepting it. Sparse traces can yield percentiles without adequate
coverage and must not pass the overall gate.

The single-satellite UTC/24-hour result matrix should run separately and record
distinct requests, exact matching results and stale/error cases through normal
UI. These commands may change shared GP inputs; preserve current state and only
perform the already authorized explicit state transition after the root has
prepared its restore evidence. A 240 draft camera trace does not close this
separate requirement. Event Timing thresholds censor sub-16ms observations and
round to 8ms; report those limits, sample count and unsupported status. Missing
observations never mean zero latency.

## Inspected source and status

- `spec.md` SC-006; `tasks.md` T032; validation_targets_proposal.md.
- workspace.js measurement entry and BroadcastChannel; nodes/constellation.js
  draft storage; tabs/satellite_nodes.js formation generator.
- model_library/browser/satellite_nodes.js: twelve planes, sixteen per plane.
- visualization/node_scene.js: 240-definition limit,64-model cap and point sizing.
- visualization/orbit_globe.js: requestRenderMode=true.
- Existing orbit_trace_measurement tests: renderer attribution and missing data;
  no new production or analysis code was necessary for this plan.

No browser, server, runtime, product source, Git or data was modified while
preparing this document. No new frame measurement was performed. Previous
T032 presentation p95 18.578/18.552ms remains a recorded failure, not reclassified.
