# T123 satellite asset tooling and package — partial

2026-10-05. US18 / FR027 / FR028 / SC024; entire T075–T084 scope remains open.

## Source preservation

Extracted only the used static data into digital_twin/model_library/packages/satellite_display/v1: 50 original GLB models and 50 thumbnails, 37,966,279 asset bytes. All 56 original mappings remain in their original order. Raw manifest SHA256 is 7a88f531a8a138c0d7f8eaa4e3c88a891ab17920d809389f62feb9b5d621f9fe, source HEAD 1a1e00297a0301637455b0ef2cf48b2e74576b07. provenance.json records original asset hashes, byte counts and credits. There are no actual derivatives or presentation repairs. Valid UTF-8 source labels are preserved; earlier terminal encoding observations are explicitly corrected in research files.

## Validation and repair tools

Offline validator checks container lengths, active scene/material/texture references, embedded buffer ranges, image signatures, source/runtime hashes and mapping coverage. Optional explicit Pillow decoding verifies image pixels. This is separate from Cesium readiness, codec/GPU rendering and appearance fidelity; render_status stays unverified.

Offline repair accepts explicitly supplied texture files and hashes, converts to PNG and appends aligned bufferViews while preserving source files, mesh/material/texture indices and geometry bytes. Source authority review remains necessary. Synthetic TGA conversion verifies mechanics only; no invented Terra texture is supplied.

Asset tests first failed because the new validator module was absent. Sixteen new tests cover active versus unused dependencies, container/reference/range failures, MIME/extension rejection, provenance/path/hash/coverage failures, read-only validation, geometry-preserving embedding and CLI exit status. Source reference code is never imported at product runtime.

## Actual package evidence

Both static inspection and the explicit bundled Python/Pillow 12.3.0 decode run found 49 valid models, 76 decoded embedded images and 50 decoded thumbnails. Final decode command:

```powershell
& C:\Users\gwakinyong\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe project_support/tooling/validate_satellite_display.py digital_twin/model_library/packages/satellite_display/v1 --decode-images
```

Exit 1 is the correct incomplete result. Only failures are terra.glb active external images `..\Terra.fbm\Side_Panels_TERRA.tga` and `..\Terra.fbm\solarpanels.tga`. They remain in the original model; no exclusion, texture deletion or generic substitute. Raw output: data/workspace/validation/ground_stations/t123_asset_decoded_final.json. Package asset_receipt.json also records complete=false and render_status=unverified.

Standalone satellite_texture_conversion.py passed decoded red/green pixel preservation and aligned embedding with unchanged geometry/material indices, without warnings. This uses a synthetic 2×1 TGA, not NASA Terra source data. Product dependencies were not changed.

## Remaining acceptance

T123 remains unchecked until authoritative Terra textures and faithful repair are verified. T122 remains unchecked for renderer/camera/UI RED coverage; T125–T129 and original solar remain open. No static mount, server restart, browser/model rendering, new port, wheel change, PR publication or merge occurred in this slice. Independent renderer/camera implementation can proceed without pretending Terra acceptance is complete.

## Final regression

Target asset tests: 16 passed in 0.31s. Whole Python: 439 passed, 5 existing warnings, 233.18s, exit 0; whole Node: 244 passed, 0 failed, 1193.0097ms, exit 0. Logs: data/workspace/validation/ground_stations/t123_pytest_final.log and t123_node_final.log. Python used a fresh project-owned --basetemp data/workspace/validation/ground_stations/pytest_t123_assets_20261005_final. Git diff --check passed. These regressions do not prove actual model rendering.
