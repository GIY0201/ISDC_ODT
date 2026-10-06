# T077 original optical equations component

Scope: original pure optical geometry, mounting sector selection, gimbal/acquisition/history and display labels. This is a source-faithful component port; the complete T077 network/OISL/fabric/ground integration remains open.

## Source evidence

Pinned original commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`. Entire `digital_twin/simulation/browser/oisl.js` text is source-identical (line-ending normalization only); original byte SHA256 `7f781056f135f9a0660040ed0091ee5e4f53e2dd45b89351f7848d99a97ee536`. Original test bytes `43d42dac22ac4aa59e9d4a0305e9c4f4658936b77b9fb9e7be8b5a8027dd728e`, original dynamics bytes `5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5`. All hashes checked before offline module evaluation.

`node project_support/tooling/capture_original_oisl.mjs <readonly-source-root> <output>` executed twice: both565246bytes, SHA256 `c63dc5daeb8852034594c2d5796a8837535de0e4268a38e9dbba660af59ceaf3`. Artifact `project_support/tests/fixtures/original_oisl.json` captures eleven original epoch states and1071 geometry/selection/pair/history/label cases. Original dynamics executes only in offline tooling; product imports none of it. Those eleven captured states are original equation test inputs, not proof of current Rust sample delivery.

## RED and repairs

Original nine test bodies preserved verbatim. Only original timed propagator import/stateOf replaced by hash-pinned captured epoch states. Initial missing-module RED failed as expected. First product run10PASS1FAIL found JSON serialization represents negative zero as zero; compare the same JSON serialization as the captured artifact, preserving all equations unchanged. No tolerance or condition weakening. Final focused11PASS95.562ms includes1071 exact serialized source cases and caller-input ownership. Whole-module text equality and original nine test-body equality verified independently.

## Boundaries and remaining work

Original100km atmospheric LOS margin, optical rated-range margin/quality and equipment acquisition parameters remain engineering assumptions. Margin is a geometric heuristic, not a measured optical/RF link budget. Supplied analysis UTC alone advances a passed history; no private clock, transport, runtime state owner or JS propagation is added. Common exact native inputs still require the existing N003 validated port; fractional/missing samples must not infer link success.

Source `nodes/links.js` target resolver, scoped history ownership and actual snapshot-verifier producer remain before T148/T151. FullT075–84/T076/T079/Terra/all50/T032/equipment/HIL/download/PR review remain. Native0.2.0 installation, actual8891 server and user browser unchanged; actual mounting/restart must respect T151 prerequisites.

## Full verification

Node570PASS2985.9988ms. FullPython645PASS8existingERFAwarnings166.50s, confirmed session73019exit0. Fresh unique absolute pytest cache/basetemp preserved existing caches. Full regression includes architecture/static paths/isolated0.3.0-wheel tests; actual installed0.2.0 unchanged. `node --check digital_twin/simulation/browser/oisl.js` passed. No live UI/GPU/optical/network acceptance claimed.
