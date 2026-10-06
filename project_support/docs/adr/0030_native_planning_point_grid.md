# ADR0030: Reuse the node native query for arbitrary planning UTC grids

Status: internal query prerequisite accepted; HTTP/native-window/V6 assembly pending.

Mission contact/access/eclipse/refinement samples need explicit irregular UTC points. Existing samples intentionally accepts only one-second grids and tracks uses source-rounded periods. Keep both contracts unchanged; add points to NodeGeometryPort and the existing query object, using existing prepared definitions/native grid adapter/receipt decoder/injected executor. Do not introduce another calculation service or JavaScript propagator.

A point batch contains1..601 strictly increasing parsed UTC instants, bounded50000 node rows. Inputs are captured before yielding. Source leap errors remain per-row errors rather than fabricated states. Consumers must reject missing/error rows for required windows and validate all roster/hash/profile/UTC fields. Arbitrary points alone do not establish interval completeness, bisection convergence or current deployment/fault context.

The current change adds no HTTP endpoint and does not mount a planning producer or restart the active8891 server. Later transport/producer composition must retain existing bounded native execution and declare sampling/coverage limits, with end boundary and explicit partial/failure semantics. Original source equations and legacy sample/track tests remain unchanged.
