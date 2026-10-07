# N018 captured native periodic fabric contract

ADR0054가 규범 계약이다. 원본 cadence/900ms/one-flight/DTN/selected route semantics를 유지한다.

Producer optional pair captureRawAnalysis(): token|null, verifyRawAnalysis(token): boolean. Frozen private token {kind,analysis_utc,snapshot}; OPTICAL_RAW_ANALYSIS_V1 / NETWORK_RAW_ANALYSIS_V1. Full native analytical snapshot content; no sampled UI conversion. Natural current display differs from immutable analysis UTC. Network keeps original optical raw token privately. Full node/hash/station/fault/source/current-control proof before and after external callbacks; revoke on failure/discontinuity/control/reset/dispose, not next successful natural analysis. Missing continuity requires exact-current.

Consumer sendAnalytical(token), routeAnalytical(source,target,objective), analyticalPresentation(), verifyAnalyticalPresentation(view). Existing exact APIs cannot expose analytical receipt as current approval. Same existing active lane/review/uncertain/request sequence/id/header authority; capture actual endpoint before command. Registered raw and accepted deployment proof required on every await. Same UTC periodic exchange remains new guarded command; selected route reruns once per accepted response. 1000ms original active-ground cadence uses existing scheduler; wall MIN900 and bounded pending retain source responsiveness. No new timer/clock/runtime store or physics.

All source/data/render approvals remain guarded. Unknown/review/failure are not usability. UI displays analysis UTC/current UTC/source/incomplete-current and independently verifies registered command provenance. Raw capability is not mission authorization and UI sampled proofs are not command authorization.

단일 flight는 mutating exact/analytical update 및 route command lane을 뜻한다. 기존 readonly status GET은 독립적으로 취소되며 명시 command가 먼저 시작될 때 preempt한다. ignored-abort readonly GET이 물리적으로 drain되는 동안에도 기존 command 시작 정책을 보존한다. mutating retired lane은 terminal까지 모든 새 mutating command를 차단한다.

ADR0061 supersedes blanket !active display exclusion only for privately registered lastaccepted historical report during same-fullscope automatic pending; command/action authority remains unchanged. Exact guards and all source/control/error/uncertain invalidations stay required. See periodic_analytical_display_retention.md.
