# T082 V6 shared context owner audit and projection

The original approved V6 static role examples remain explanatory drafts. Before
assembly, `workspace.js` render assigned SAT-A, E-014, M-204, GS-02 and D-731 to
the shared header/desktop quick status regardless of selected native GP or actual
source SIM deployment. Those identifiers are not operational evidence.

`workspace_context.js` now derives readonly presentation from existing owners:

| Input | Existing owner port | Meaning |
| --- | --- | --- |
| display | globe.displayContext() | Actual displayed key/UTC; priority SIM, selected GP, stored orbit, catalog scene |
| catalog | catalogTimeline.snapshot() | Selected normalized GP hash and native ITRF display; exact UTC/hash required |
| stored | client.snapshot() | Saved input identity and provenance; current displayed input hash required |
| nodes | nodeWorkspace.sceneSnapshot() | Draft/accepted roster and selected node ID; draft selection does not imply active globe selection |
| selection | Explicit renderer-owned selected source node, or null | Never infer active node selection from a draft ID |
| sim | simPanel.controller.snapshot() | SIM runtime/run ID and error |
| mission | ready,selected,module,context,inspection from missionServices | Source draft vs current module-held plan; physical context and acceptance hash/instance/version must match |
| network | {proof:networkSnapshot(),verified:verifyNetworkSnapshot(proof)} | Exact native network input/UTC proof |
| fabric | fabric.snapshot(), read after network proof | Guarded ICD-02 owner reconciles current scope; projected native UTC and module receipt UTC are separate |
| data | sourceDataPanel.contextSnapshot() | Last verified scoped query; never realtime reception or storage hardware evidence |

Output is `identity,utc,run,deployment,mission,communication,data,handoff,text`.
`text` contains satellite,clock,contextId,contextRelated,status,next,event,alert.
Use textContent for DOM rendering. No fallback mock identifiers, timers, sockets,
viewer, authoritative store, native propagation or UTC derivation were added.
ITRF is labeled only for native GP/stored/catalog scene. SIM/source-node frame is
unknown here because this presentation has no actual native frame receipt.

Root assembly must recapture on the existing display observer, SIM onChange,
catalog/stored/node selection/display/deployment notifications, mission store and
execution changes, fabric onChange, and sourceData `onContextChange`. A callback
recomputes current readonly snapshots. Apply the projection again after the V6
static render so examples cannot overwrite the shared context. Popout/window
draft transfer is not a transfer of runtime, module receipts or authorization.

SourceData's original full `snapshot()` is preserved. The additive narrow
`contextSnapshot()` returns only report runtime/deployment/module and local
error/busy/selected_id. Callback exceptions do not change data command outcomes.

Validation: `node --test project_support/tests/browser/workspace_context.test.mjs
project_support/tests/browser/source_data_detail.test.mjs
project_support/tests/browser/source_data_panel.test.mjs`: 17 passed.
The captured fixture retains consumed fields from actual T081 HTTP receipts:
40 accepted nodes, run/scope/revision, data module SIM time and guarded fabric
receipt. It intentionally keeps first native-query UTC separate from the later
data-query elapsed time. Corruption tests cover exact nanosecond GP identity,
cleared display, foreign run/scope/revision, pending/error, physical mission
context/module restart, missing/foreign native network proof and frame labels.
An additional test uses the existing saved-orbit selection owner through load and
selection change; a previous rendered key cannot be attributed to the new input.

This is projection and bounded panel verification. Shared root DOM assembly,
Chrome all-screen behavior and original full T082 acceptance remain root work;
this evidence does not claim actual RF, reception, facility or hardware security.
