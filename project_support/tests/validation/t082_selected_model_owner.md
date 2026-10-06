# T082 selected source-node / GP identity

The node editor's default `selected_id` is not evidence that the shared globe currently displays that node. `workspace_nodes.selection()` reads the existing globe model owner and the existing native node geometry. It returns an explicit `source_node` selection only when the current node ID, native definition hash, display UTC, and valid native row agree.

The existing model observer releases explicit node-selection intent when the shared owner selects a GP object or clears its model. Subsequent node definition, model, view, and native refreshes therefore cannot replace that newer GP selection. A transient guard around the node workspace's own synchronous model mutation preserves its pending explicit selection during unavailable geometry; it is not another selected-object owner. Existing context notifications are reused.

Root assembly integration: pass `selection: nodeWorkspace.selection()` into the existing `projectWorkspaceContext` call. Do not pass `sceneSnapshot().selected_id`, which remains the editor's selected draft.

## Regression evidence

`source_node_gp_selection.test.mjs` uses the actual workspace fixture at 1280×720 and 1920×1080. It picks a rendered native node point through the shared picker, selects the actual catalog ISS entry, enters normal/ground/run views with node refreshes, and clears the shared model. The GP model remains selected until the explicit clear; source-node selection remains null after the GP change. The fixture creates one Viewer and sends no stored-GP commands.

Focused command:

```text
node --test project_support/tests/browser/source_node_gp_selection.test.mjs project_support/tests/browser/workspace_nodes.test.mjs project_support/tests/browser/workspace_context.test.mjs project_support/tests/browser/workspace_satellite_model.test.mjs project_support/tests/browser/satellite_model_assembly.test.mjs project_support/tests/browser/satellite_model_selection.test.mjs project_support/tests/browser/satellite_model_panel.test.mjs
```

Result: **63 passed, 0 failed**. This is actual assembly regression evidence with injected native responses; it does not claim a new live-browser or physical-observation validation.
