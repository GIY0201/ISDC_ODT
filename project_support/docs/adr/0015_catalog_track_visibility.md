# ADR0015 Selected catalog track and visibility queries

Status: accepted design; HTTP/UI implementation and final validation tracked by US16/T111–116.

The original globe draws one mean-motion period around the selected UTC with coarse120 subdivisions and dense±45s/.1s geometry. Its orbit workspace searches the next24h and exposes known/clipped/partial passes and AOS timeline seeking. Preserve these product functions while reusing the selected immutable GP, Rust SGP4, explicit IERS-A and the existing precise visibility search.

Add strict readonly `/api/catalog/track` and `/api/catalog/visibility` at the existing communication HTTP boundary. Both pin normalized GP hash and client request ID; GP change409, bad input/EOP422, unavailable/busy503. Track request has reference UTC and returns ordered ITRF rows and perrow errors/quality. Visibility has >0≤24h SI UTC bounds, assumed virtual WGS84 observer/height/mask and returns the existing VisibilityResult with catalog provenance and communication unknown. No stored input/revision/UTC command, runtime copy or new native export. Original position/samples/scene APIs remain unchanged.

Renderer receives coordinates only, masks/splits failed track rows and keeps one Viewer; selected catalog time controls own replay presentation UTC. AOS handoff targets the catalog timeline rather than stored runtime orbit. Show selected and whole-snapshot UTC separately. Original styling, track toggle and UTC renewal stay in UI composition; no browser SGP4 or synthetic fallback. Reference source is read-only and never imported at runtime.

This is additive wire scope recorded before HTTP changes. Full API compatibility baseline and only these two new request schema/path allowlist entries must be reviewed and tested. Final native/scalar, failure/hash/UTC/readonly, full Python/Node and actual8891 two-resolution evidence is required before scoped completion. T075 original sun/modes/imagery/labels/representative shape and T076–T084 as well as T032/SC006/F001/other deferred requirements remain open.
