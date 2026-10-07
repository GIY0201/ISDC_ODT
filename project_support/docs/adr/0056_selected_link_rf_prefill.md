# ADR0056 Selected ground-link RF draft connection

Review clarification: sampled native geometry remains a currently registered
projection of `snapshot.analysis_utc`, not a current-display exact calculation.
Copy distance/RF fields from current native projection only, label `analysis_utc`
separately from `display_utc` and age/currentness. For exact both UTCs equal
snapshot.utc. Optional observational `isCurrent()` fence in context is checked
by the existing RF owner immediately before replacing a draft; it is not a raw
command capability. Root DI directly calls that owner without arbitrary callbacks.

Status: precode design. Original communication.js linkDetail(660–662) and
calculateBudget(740–753) already prefill six RF inputs and compute the same Friis
API with source assumptions. Current standalone RF calculator is implemented;
the selected-link prefill flow is still missing. No RF formula/API change.

Reuse current createRfLinkBudget/createRfPanel, not a second calculator. Add a
pure exported sourceLinkRfDraft(link) in existing rf_link_budget.js, validating
finite complete ground band/frequency/range/EIRP/G-T/data-rate first. Preserve
source rounded distance/power/Rx gain, S/X/Ka gain3/15/20, temperature150/200/300,
misc loss6, bandwidth=max(.01,rate*1.2), rate=max(.001,rate), requiredEbNo9.6 and
linkID first40 as labelled original representative assumptions. Invalid data
does not receive invented zeros/default physical values. All11 remain editable.

Existing ground selected-link detail exposes an explicit button only with a
current independently verified full native geometry/projection and exact current
link ID+endpoints/kind. Callback receives copied current link and current analysis
UTC, source metadata; historical module verdict is not used to prefill current
geometry. No raw command capability or module receipt is passed. Pre/post owner,
selection,paint/lifecycle checks refuse stale/reentrant/hidden/disposed input.

Root injects onRfLinkDraft to existing rfPanel.applySourceLinkDraft(). Explicit
button replaces draft, cancels obsolete RF result, writes fields and scrolls to
existing calculator. No auto-query/calculate/timer/clock/server mutation. Label
the input calculation UTC and original engineering assumptions; preserve manual
editing, official ISS provenance reset on frequency change, popout/remount.

Tasks T169 pure projection/controller RED, T170 grounded detail+root binding RED,
T171 independent review/fullbatch/current UI source parity. Source equipment and
actual RF reception remain unknown; whole live/performance gates remain open.
