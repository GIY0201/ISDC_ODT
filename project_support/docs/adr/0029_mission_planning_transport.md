# ADR0029: Preserve ICD-03 and add guarded HTTP forwarding

Status: transport prerequisites accepted; production assembly/native/V6 validation pending.

Reuse original schemas (including nested extension fields) and endpoints. Layer-specific errors are shared in foundation, reexported through orchestration contract. HTTP obtains an injected contract, never constructs runtime state. Original unguarded endpoint compatibility remains explicit; V6 must always use complete guarded headers and cannot silently fall back.

Guarded requests bind instance, base sequence, monotonic client ID, caller context digest and mission version/plan sequence. Header validation is400, domain input remains400 and Pydantic422, conflict409, disconnected/unsupported503. Remote forwarding checks capability before mutation and validates typed acceptance echoes; missing/array/nonfinite JSON, redirects and mismatched receipts are unavailable rather than claimed acceptance. Preserve original endpoint and source commit assertions.

Application factory/lifetime close, fixed8891 live verification, current native context and browser API are still pending. Tests explicitly compose actual router and runtime/remote in a local FastAPI test app; this does not prove production mounting. Caller digest is not trusted geometry proof. No active server restart or runtime reset is performed for this unmounted prerequisite.
