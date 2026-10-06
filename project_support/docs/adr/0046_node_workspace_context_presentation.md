# 0046: Minimal node presentation for the workspace context

2026-10-07. Internal JavaScript presentation contract only. Runtime ownership,
HTTP schemas, node definitions, mission approval and commands remain unchanged.

## Problem

The V6 workspace context refresh called `nodeWorkspace.sceneSnapshot()` even
though it needs only the accepted deployment identity, count and selected node
identity. That public getter copies all draft/deployed nodes, the server receipt,
native calculation and other screen data, then copies the combined result again.
At 240 nodes this repeats work on catalog/display notifications. Actual browser
frame measurements still fail the 16.7 ms target; this decision does not claim
that the new port alone meets that target.

## Decision

`nodeWorkspace.contextPresentation()` provides a bounded, synchronous internal
join of the existing constellation and accepted-deployment owners. It returns
minimal copied labels/counts and `node-workspace-presentation-v1` predicates for
existing full values. It never returns draft/deployed/receipt node arrays, native
calculation rows, a new state owner, clock or Viewer. The projection is consumed
immediately by `projectWorkspaceContext`; function capabilities do not escape
in its final serializable output and must never authorize actions.

The constellation owner derives ordered, full canonical JSON equality of drafts
and deployed nodes, including `updated_at`, on a private state-identity change.
This is stricter than the original order-insensitive `isDirty()` predicate, which
ignores timestamps, and preserves the existing context join. A private cached
canonical deployed string is refreshed when the actual deployed array changes.
Neither cache treats a revision number as proof. Selection identity is copied
from the same existing owner. The accepted server owner supplies minimal run,
scope/revision/ordered IDs and exact full receipt/roster predicates. Disposed
server predicates fail; a disposed workspace returns no presentation.

`projectWorkspaceContext` retains its previous full-snapshot path. The compact
path changes only how existing node/deployment values are read and compared.
Full mission deployment/roster comparisons, physical context comparison,
normalized hashes, module instance, selected mission version, runtime run and
exact UTC guards remain. Data scope/revision and full server roster checks remain.
The initial node port does not change fabric or mission-service projection,
throttling, UI refresh frequency or source actions. The follow-up network-only
presentation join is specified below. Public `sceneSnapshot`, store
getters, server state/receipt copies and all command validation remain unchanged.

## Validation and limits

The initial new regressions failed because the private port was missing and the
actual V6 context refresh called the forbidden public full getter. Focused tests
now pass 96/96:

```text
node --test project_support/tests/browser/workspace_context_presentation.test.mjs project_support/tests/browser/workspace_context.test.mjs project_support/tests/browser/constellation.test.mjs project_support/tests/browser/data_deployment.test.mjs project_support/tests/browser/workspace_nodes.test.mjs
```

The new tests use actual 240-node V6 constellation/deployment owners with fake
HTTP receipt transport and compare the entire old/new context result across
SIM/runtime/module/mission/data failures, GP/stored/no-source selections. Twenty
actual context ticks reject any public full `sceneSnapshot` read. Additional
owner tests cover timestamp-only edits, reordered restored drafts, equipment
changes, subsequent accepted deployment, exact foreign server/roster rejection,
public mutable-copy isolation and disposal. These are local contract regressions,
not actual native runtime, browser GPU or measured performance evidence. Parent
integration owns full repository regression and fresh browser frame measurement.


## Follow-up: existing network-owner UI summary

The same store-event opaque scope token already supplied to the optical owner
is now optionally supplied to the existing network owner. It is dead-gated and
replaced on every actual store notification, including reloads whose persisted
revision is unchanged. This capability permits only reuse of privately copied,
fully validated node definitions; fresh station/fault/display/runtime readers
and the accepted optical proof remain in the network owner's validation path.

`nodeWorkspace.networkPresentation()` delegates to `network.presentation()` and
exposes only `{proof:{status,utc,error,network:{time}|null},verified}` to the
workspace context. That owner rechecks current full context, accepted result,
active/failure identity, generation and disposal before returning the summary.
The UI join already consumed only these fields, so `projectWorkspaceContext`
needs no semantic change. Full `networkSnapshot`, `verifyNetworkSnapshot`,
rendering, mission and fabric action receipt paths remain untouched. The summary
cannot be passed as a verifiable network receipt. For injected older owners with
no summary port, the previous full snapshot and explicit verification path is
retained; absent/null proof never defaults to verified.

Three added regressions first failed because the private summary was missing and
the V6 context refresh still called the full `networkSnapshot`. Focused combined
verification then passed 84/84 in 4.25 seconds:

```text
node --test project_support/tests/browser/workspace_context_presentation.test.mjs project_support/tests/browser/workspace_nodes.test.mjs project_support/tests/browser/node_network_timeline.test.mjs project_support/tests/browser/workspace_context.test.mjs
```

These tests exercise actual mounted network owner output parity with the previous
full path across valid, changed UTC/station/fault, missing display/time, pending,
failed query, fabric error/pending, clear and disposed states. The V6 context tick
forbids access to its public full network getter and preserves the old injected
owner fallback. No fresh browser performance or GPU acceptance is implied.
