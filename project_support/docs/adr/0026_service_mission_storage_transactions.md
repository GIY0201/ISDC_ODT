# ADR0026 Service mission configuration storage

## Decision

Retain senior mission definitions/equations and store CRUD/version/status logic. Inject existing node-equipment library into a pure factory, remove source import-time singleton, and keep model tables immutable. Add application-bound copied configuration ports, explicit load/ready/error, strict persisted shape, optimistic raw-token review and atomic internal rollback when storage rejects a write. Preserve source keys/limits/IDs; no new runtime owner or protocol.

## Evidence and compatibility

Original model body hash remains exact after export/import adaptation. Source golden assertions remain; older shared-storage writer now must load the newer accepted state before removing a mission. This intentional concurrency guard prevents silent last-writer overwrite. Quota failure retains prior request/plan/log/sequence; bad shape is unready, observer throws cannot roll back a saved mission. Local decisions remain configuration, not server execution.

## Unresolved acceptance

ICD-03 module/adapter, exact request/window/context receipts and explicit commit must precede V6 mounting. Source infeasible replan retains local committed status and does not prove operations acceptance. Source mission windows silently hide exceptions and depend on JS propagation; native producer must supply existing authoritative query lane plus explicit error/coverage handling. T078/N010/N011 and full goal remain open.
