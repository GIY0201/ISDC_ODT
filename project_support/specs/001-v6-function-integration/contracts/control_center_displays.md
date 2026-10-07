# Control center display contract

- Primary DOM, Viewer, node binding and selection/time ownership remain intact when wall opens.
- Optional owner-created replica rendering ports receive full immutable source projections; validate source identity, hashes, actual UTC, lifecycle and native geometry provenance before display.
- Camera, scene mode and render-only visibility belong to each display; input, deployment, commands and clock retain existing owners.
- Same-document mount/frame adds no backend queries; explicit catalogue ON uses one original query and distributes its accepted rows to both displays.
- Replica teardown, late readiness or failed rendering cannot dispose or replace primary resources. Stale projections fail closed with truthful status.
- Cross-document views rely on original authoritative server reads and command conflict guards. Draft BroadcastChannel messages are never command approvals.
- Acceptance: both Earth surfaces visible, independent camera/mode, equal source UTC, catalogue/source parity, no duplicate query, safe teardown and actual two-client command/result synchronization. Fixed-snapshot and playback behavior must be explained and verified independently.
- Existing 5-second stored-orbit state refresh also observes initialized paused clients; original client request/currentness guards decide acceptance. No server writes or frame queries. This discovers remote start/stop revisions without requiring same-origin messaging or focus. Catalogue playback remains a separately tracked missing shared owner contract.
