# T144 versioned additive native wheel acceptance

## Scope and version

Product crate/Cargo.lock/project metadata are0.3.0; native __version__ derives from CARGO_PKG_VERSION. Same additive source-node ABI/profile/frames/time and unchanged existing SGP4 exports/math/limits. No new dependency, server restart or installation into the current application environment. Whole T075–T084, full T076 and T145–153/T079 activation remain open.

## Regression-first and build

Extended existing clean-venv test before package edits. Existing0.2.0 wheel lacks node export; new version/native probe and package-metadata checks initially2FAIL1PASS5.41s (t144_install_red.log). Probe did not reach new-node assertions after its version mismatch, so this RED is version/old-install evidence, not golden numeric failure.

Cargo metadata --offline updates only the root package lock version; dependencies unchanged. Product build script first failed because the runtime environment has no maturin (t144_build.log retained). The established separate project_support/.venv_orbit_build_t029 was verified to have pinned maturin1.15.0, then explicitly passed to the unchanged product build script. No runtime build tool installation or research-probe build substituted for the product.

Actual release/locked wheel: project_support/tooling/orbit_wheels/20261005_230855_957/isdc_orbit_propagation-0.3.0-cp314-cp314-win_amd64.whl; SHA256d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. Build5.56s, retained build_receipt.json/dependency dump and pinned package provenance/license/RECORD. Local CPython3.14 Windowsx64 only, other installation platforms remain unverified. Build log t144_build_retry.log.

## Actual isolated new-wheel calls

Clean venv with no existing site packages, pip --no-index --no-deps and interpreter -I; asserts imported module is under that venv. Target3PASS6.11s (t144_install_target.log). Actual installed0.3.0:

- TLE33official cases/668states with existing position1e-6km/velocity1e-9km/s tolerances and aligned expected errors.
- Positive OMM scalar vs manyOMM reversed/repeated offsets exact bytes/errors; old empty/error/alignment/profile/limits retained.
- Native node profile/frame/inertial/time/31columns/248bytes/240definitions/601samples/50000rows verified. All62 pinned original source states compared through the actual Python export. Negative/fractional/year/domain cases are in unchanged fixtures.
- Largest source comparison difference: position3.228706191293895e-11km, velocity4.1744385725905886e-14km/s; other angles/vectors/geodetics remain within existing T142 tolerance. These are implementation consistency errors, not physical orbit accuracy.
- Owned repeated buffers, invalid orbit masks/internal NaNs, subsequent-call independence, malformed definitions/alignment/index/nonfinite/241definitions/602samples/50001rows rejected. Successful50000rows/12,400,000bytes and240definitions; unsupported Date-range row explicit error. Canonical UTC/leap masking remains separately verified in T143 adapter.
- Receipt JSON retained in ignored data/workspace/validation/install, with wheel/hash/installed path/version/source column errors and boundary count.

Full release offline locked Rust tests:9PASS (3catalog/5node/1officialSGP4), compile24.88s and existing linker warning. t144_native.log, session93689exit0. Browser code unchanged; reuse last full371PASS1397.285ms from ca88862. Full Python543PASS8existingwarnings226.35s, session19156exit0 (t144_pytest.log), explicit new-wheel path and fresh short ignored basetemp. This suite tests the unchanged runtime-installed0.2.0 plus actual clean0.3.0 wheel; it does not claim the live server uses0.3.0.

## Runtime and remaining goals

Existing project application environment still reports0.2.0 and no node export, intentionally awaiting T151 owned8891 restart/restore after UI/deployment integration. No current native installation/API/browser/runtime/PR/merge change. Existing source approximation tags remain explicit, never ITRF/TEME. T145 source store and T146 editor are next, followed by timeline/scene/real T079 accepted activation/two-resolution/live/Draft review. Terra/all50, T077–84 full prototype integration, Git authentication-dependent publication, T032, equipment/RF/HIL/download/AeroDT remain tracked. T144 alone does not close the whole goal.
