# T147 native sample buffer — partial gate

2026-10-06. T147 remains unchecked. Full T075–T084 goal active.

## Implemented

createNodeSampleBuffer in web/scripts/nodes/node_timeline.js validates source-native schema/profile/frame/inertial frame/time/source/engineering quality, request ID, node order/IDs/catalogs/full captured definitions,64hex receipt hashes, optional known expected hashes, exact canonical SI/UTC grid/count and aligned finite/null error rows. Aggregate status must match row failures. Captured definitions, rows and returned descriptors are copy-owned. IDs matching object prototype names use own-property hash lookup. Changed/unknown definitions, out-of-range or noncanonical UTC cannot retrieve old samples. Exact native failures remain explicit error rows; both sides of an error gap fail interpolation.

Reuses existing leap UTC codec and existing binary-search/1second position interpolation in createSampleBuffer. Added optional validity/extra-field projection callbacks, preserving existing default GP position/elevation shape and default inexpensive execution path. Custom predicates see recursively readonly captured rows; projection inputs and outputs are isolated copies. Node velocity/geodetic/height are interpolated between finite native samples; longitude/degree angles follow shortest wrapped interpolation, avoiding359→1 jumps through180. Sun condition holds the preceding native sample until the next actual sample, with observation_utc/interpolated tags. No orbital/Sun/frame transform, clock, timer, HTTP, extrapolation or battery integration is introduced.

The buffer can retain all240×601 assembled samples; it does not itself issue that oversize HTTP batch. T147 request orchestration must still split native calls to<=83nodes/50000rows, validate all chunks in a single generation and commit atomically. Hashes in a first response are receipt-bound to request ID/full captured input through the separately verified server chain, not independently recomputed Python-canonical SHA in JS. Supplied known hashes are strictly compared; orchestration must pin them across the same-definition sample/track generation. No invented browser hash canonicalization is claimed.

## Evidence

- Missing module RED before product edits.
- Initial native buffer7PASS952.2262ms, whole240×601 constructed without truncating lastnode/lastrow. Expanded own-ID and predicate isolation10PASS2FAIL before repair.
- Source20state fixture named-wire mapping retained unchanged at exact UTC, using pre-existing pinned original_satellite_nodes.json. This proves buffer preservation of source values, not a newly executed native/browser chain. Actual Rust/wheel/query comparisons remain the priorT142–T144 evidence and actual mountingT151/T152.
- Existing GP/catalog playback regressions20PASS1091.7483ms after shared-helper extension; final complete Node467PASS0FAIL0skip2136.8524ms. Log:data/workspace/validation/ground_stations/t147_sample_buffer_node.log.
- Full Python545PASS8existingwarnings147.16s, session79187 terminal exit0. Explicit0.3.0 productwheel with fresh short basetemp/unique absolute cache directory; existing denied cache untouched. Log:data/workspace/validation/ground_stations/t147_sample_buffer_pytest.log. Python product unchanged; later JS-only refinements included in final full Node.
- JS syntax and staged diff whitespace check required before commit.

## Remaining

T147 full API batching/atomic assembly, request/cancel/reverse/generation fencing, shared-clock-driven refresh,121point source Date TimeClip tracks/30second absolute display-time rebuild and integration receipts remain. Full144240-row synthetic assembly took roughly0.85–0.96s in earlier target tests; that synchronous stress run is not frame/UTC response evidence and must not be described as meeting game targets. Chunk construction/yielding/transport/serialization/frame costs require real measurement and bounded scheduling in remainingT147/T152; T032 remains failed/deferred. T148 renderer/T079 actual activation/T149–153 actual acceptance remain. N001/N003/wholeT076/T075–84/Terra/all50/T137auth/equipment/RF/HIL/download/AeroDT stay open. Server8891/currentnative/browser/remotePR/merge unchanged.
