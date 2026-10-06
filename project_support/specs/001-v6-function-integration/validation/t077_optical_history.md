# T077 optical history and verified consumer composition

## Scope

`createNodeOpticalTimeline` composes the unchanged source optical resolver with the existing serialized native point input owner. It owns only derived terminal history, primes original Unix-millisecond instants at -120/-60/current, and commits complete common-time results atomically. Pending calls are shared; paused calls reuse the accepted result. Definition changes discard only affected owner histories. Reversal remains the source acquisition behavior.

The shared native communication guard checks full definitions, UTC, source metadata, finite nonzero inertial vectors, right-handed orthonormal LVLH axes, definition hashes, sunlit and geodetic values. Hash changes during priming, missing rows, late responses, reset and disposal cannot publish partial histories. Observer failures and mutations cannot modify the accepted calculation.

The verifier compares the complete copied receipt against the private accepted calculation and current full node/time owners. Real NodeScene and statusPresentation consume this verifier in composition tests; no permissive true callback is used. Altered and revoked results clear owned lines or display unknown consumption. Cesium primitives in this composition test are doubles, so this is not GPU or live-browser proof.

## Source and tests

- Pinned source: `1a1e00297a0301637455b0ef2cf48b2e74576b07`.
- Reuse the hash-pinned source trace in `t077_node_link_resolution.md`; the entire final dense-two-plane terminal/pair/history trace matches the captured source.
- Focused producer/consumer tests: 14 PASS, 768.425 ms. Log: `data/workspace/validation/ground_stations/t077_optical_consumers.log`.
- Full Node regression: 615 PASS, 3933.1313 ms. Log: `data/workspace/validation/ground_stations/t077_optical_history_node.log`.
- The existing isolated-wheel test now runs actual Rust historical points through the production native adapter/query, JS decoder/serial owner, actual optical history producer and verifier. Full Python regression: 645 PASS, 8 existing ERFA warnings, 165.31 s (session23515 exit0). Log: `data/workspace/validation/ground_stations/t077_optical_history_pytest_retry.log`.
- Actual clean-venv receipt: `data/workspace/validation/install/55478612fbbd404cb529a2c55508054e/isolated_call.json`: 60 native rows, -120/-60/current, maximum numeric difference 5.4569682106375694e-12, time difference 0 ms, source_semantics_equal=true, verified_snapshot=true. Same source numeric tolerance and periodic azimuth comparison are retained; no equation or threshold was changed.
- Existing wheel SHA256: `d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97`. Original running environment remains native 0.2.0; reverified without installation or restart.
- First Python invocation: 484 PASS, 161 setup errors, 8 existing warnings, 130.56 s. Every error came from the missing new-worktree `data/workspace/v` parent of pytest's explicit basetemp. Created the parent, preserved the failed run and retried using fresh absolute basetemp/cache paths. No product-code change or test exclusion resolves this setup issue.

## Workspace and remaining acceptance

The original `D:/projects/ISDC/ISDC_ODT` checkout was externally switched to `codex/catalog-display-context-local-20261005`. Preserve it. Current source work continues on `codex/satellite-node-integration` in `D:/projects/ISDC/isdc_odt_node_worktree`; Python dependencies and the existing 0.3.0 wheel are read from the original root without installing into its running environment.

T151 actual application/one-Viewer/native installation/owned8891 assembly and T152 live two-resolution tests remain required. This does not close the whole T148 renderer, T077 network/fabric/ground integration, T076, T079, or T075–T084 goal. T032 frame performance, Terra/all50, N001 multiwindow persistence, T137 authentication, equipment/RF/HIL and actual-file-byte validation remain open. The live 8891 server, original native installation, browser and remote PR state were not changed by these component tests.
