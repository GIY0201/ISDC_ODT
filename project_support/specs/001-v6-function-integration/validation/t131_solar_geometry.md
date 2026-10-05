# T131 pure solar display geometry

2026-10-05. Same feature and full T075–T084 goal. Original source1a1e002 globe.js885–969 read; contracts/solar_display.md and US19/T130–137 added without overwriting previous artifacts. Constitution1.2.0 unchanged; checklist8/8; no extension hooks. Existing setup-plan preserved plan, prerequisites resolve same feature. Reported script branch001-v6-function-integration is the configured feature selector; actual Git working branch remains codex/catalog-model-display.

## Scoped consistency review

FR029/SC025→R003/R007/R010→US19/T130–137; geometry→application/API→buffer/renderer→workspace→full/live→Draft dependencies explicit. Source indicator/throttle/occlusion/light preference retained; precision replaces wrong-frame/synthetic fallback, preserves error behaviour as explicit unavailable. Existing stack, single runtime owner and Viewer preserved. Pure calculation imports foundation/contracts/Astropy/ERFA only; application owns EOP files, HTTP and UI remain outside simulation. No constitution violation or uncovered new requirement identified. Existing broad T075 model/Terra/solar and T076–84 plus old performance/equipment/download gates remain open. Earlier valid evidence remains valid; new solar implementation verification is pending. This is scoped artifact analysis, not a claim all previous requirements are complete.

## Regression and implementation

Missing solar_geometry module first failed test collection; retained RED log `data/workspace/validation/ground_stations/t130_solar_red.log`. Implemented solar_directions: aligned finite UTC/EOP, mixed identity rejection, GCRS get_sun to terrestrial c2t06a with supplied UT1/polar motion, normalized immutable owned bytes, same UTC/snapshot identities and empty batches. No IERS access/download or import-time setup in this function. Local leap initialization remains existing snapshot-loader responsibility.

Target7PASS2.24s (`t131_solar_target.log`): batch/scalar, unit norm, readonly bytes, frozen ITRS oracle at equinox/two solstices, forbidden IERS_Auto access,1SI-second interpolation at21fractional instants for those dates and2016leap boundary, bad times/EOP/shape/mixed hashes. Model consistency interpolation deviation is below1e-6rad in those sampled cases; the interpolation UI has not been implemented. Shared ERFA oracle verifies frame/time wiring, not independent ephemeris accuracy. Entire snapshot range is not proved by those four intervals. Published ERFA numeric fixture, explicit bad ephemeris output and snapshot-edge regression remain T130 work.

Whole Node326PASS0fail1251.6706ms (`t131_solar_node.log`). Whole Python447PASS,5existing ERFA warnings,194.44s (`t131_solar_pytest.log`), original session49986 exit0. Whitespace checks passed with existing line-ending notices.

An additional actual calculation check covers four600SI-second buffers at0.25second cadence,2401exact rows each, using the frozen EOP/leap hashes recorded in `t131_solar_interpolation.json`. Maximum deviation of normalized1second interpolation from exact solar calculations across those buffers was2.4115991620879543e-10rad, below1e-6rad. These finite sampled intervals support the chosen buffer strategy; they do not bound all supported times or prove UI performance/independent astronomical accuracy.

## Pending

No new endpoint/actual renderer or solar overlay is connected. No current server restart, port8891/native/wheel/PR/merge changes. T132–137 API/buffer/original indicator/preference/actual two-resolution acceptance pending. T130 remains partial and full T075–T084 stays active. The original one-minute hold is replaced by planned buffered1SI-second interpolation to follow60x display time; exact bound and unavailable/late/sign/owner behaviour remain mandatory.
