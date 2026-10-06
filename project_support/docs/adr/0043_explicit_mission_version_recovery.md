# Explicit current-input mission version recovery

2026-10-07. Accepted within the existing source-feature migration scope.

## Problem

Reload retains saved mission display records but intentionally discards the
controller's accepted native input proof. A different window may also advance
the authoritative module mission version. Existing commit guards correctly
reject a saved plan with no current proof, but there was no explicit route to
calculate a fresh plan when the module version exceeded the local version.

## Decision

Expose an explicit latest-version fresh-plan action through the existing mission
execution controller. Query and validate the current guarded module receipt,
choose max(local version, verified module version)+1, then run the unchanged
current native input approval/window/request builder and guarded planning path.
Retain exact accepted tasks, analysis UTC, module identity and sequence, endpoint
and current-context checks. Stored tasks never become command authority simply
because their display record survived a reload.

The source store's setPlan receives an optional acceptedVersion. Its original
default local+1 behavior is preserved. An explicit version must be a safe,
monotonically increasing integer bound to the guarded-v1 accepted receipt and
the exact mission identity/version. The controller validates that receipt before
invoking this display persistence option. The store remains a display owner,
not a native approval authority.

Existing held tasks require explicit abort; an uncertain pending command needs
its existing retry/reconciliation flow. Recovery neither automatically aborts
work nor overwrites a pending result. Cancellation and input/endpoint drift fail
closed. No new API, module instance, scheduler, clock, Viewer or state store is
introduced.

## Verification and limits

RED preceded the implementation. Fifty-four focused checks cover reload,
other-window version advance, malformed receipts, held/pending commands,
cancellation, input and endpoint drift, exact tasks and dirty UI preservation.
Full Node regression subsequently passed1099 checks. Full Python and actual UI
recovery acceptance remain separately recorded; this ADR does not certify them.

Completed scenario workspace revalidation is a separate discovered lifecycle
gap. Its current ready/paused guard must not be bypassed to reset a finished run.
Any repair must preserve finished phase/verdict and current runtime and require
exact current source/native evidence before restoring analysis input authority.
