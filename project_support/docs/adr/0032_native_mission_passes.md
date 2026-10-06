# ADR 0032 Native mission pass geometry

Status: accepted implementation boundary; full T078 acceptance pending.

Reuse source predictPasses coarse/peak/crossing equations and nominal-altitude off-nadir mask, routing positions through the existing injected Rust node point query. The application producer owns only invocation-local samples and captures input definitions before await. No new runtime state or dynamics owner.

Retain the source approximate Earth-fixed frame declaration. Apply existing WGS84 ENU geometry to typed latitude/longitude/ellipsoid_height_m. The native producer returns raw peak degrees and explicit coverage metadata; source contact/access payload projection belongs in a subsequent application composition step. Native row failures must reject, not silently produce an empty successful plan. Capacity must reject, not silently keep only8 contacts or6 accesses. These are intentional repairs to source fallback/truncation, while the source equations and independent original oracle remain unchanged.

Positive horizon at most24h;30s coarse samples including the exact end; peak bracket100ms; boundary bracket1s. Sampled peak detection is not guaranteed to find arbitrary narrow or multimodal intervals. No terrain/refraction/weather/RF feasibility/pointing dynamics are inferred. Result explicitly declares sampled coverage and possible missed short intervals. Nominal altitude in off-nadir relation is retained from source, not an instantaneous-altitude model.

Evidence: feature validation/t078_native_passes.md,28 focused passes and750 full Python passes; actual12h native/original comparison3 contacts and1 access, maximum boundary difference1ms. N011 and N010 remain open for composition and actual UI acceptance.
