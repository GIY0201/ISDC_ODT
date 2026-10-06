# ADR 0035 External crosslink geometry with explicit source approximation

Status: internal producer implemented, full T078 acceptance pending.

Reuse the original Earth-segment clearance,100km margin, range threshold, inside-edge scanner and sampled minimum-range convention over existing injected node and precise catalog native queries. The scanner extraction was a separate behavior-preserving checkpoint. Capture node definitions/external GP/EOP/leap identity and required common UTC grids; reject incomplete or changed receipts/provenance, never interpret required calculation failure as no contact. Keep invocation-local data only.

Source node frame is still the original approximate Earth-fixed frame. Catalog coordinates remain precise ITRF from Rust SGP4 and injected EOP. Under the original WGS84 geodetic/ECEF comparison convention, compare Earth-fixed Cartesian coordinates for an explicitly declared engineering approximation. Retain both frames and external hashes/quality; do not claim source positions are precise ITRF or invent a rigorous inertial transform. This convention preserves source model intent while retaining external EOP precision. A future source dynamics upgrade requires a separate model/profile decision.

Declare sampled30s predicate grid,1s boundary tolerance,10s observed-range samples by default. Short intervals may be missed/merged; sampled minimum is not true continuous closest approach. Include exact final endpoints, repairing source scan/minimum-grid omission. Bound positive horizon24h, point batches601 and window capacity20000; overflow rejects without partial publication. No claim of radio/optical compatibility, slew/acquisition or physical reception.

Evidence and limits: feature validation/t078_native_crosslinks.md, original-function capture fixture/tool, actual native source/ISS fixture1h receipt, full796 Python passes plus final43 focused passes. No public route or production/V6 assembly is mounted by this change.
