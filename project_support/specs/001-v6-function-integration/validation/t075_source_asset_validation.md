# T075 pinned display assets: source identity, dependencies and HTTP verification

Baseline: senior repository `HyeonJun9138/ISDC-ODT` pinned `1a1e00297a0301637455b0ef2cf48b2e74576b07`.

## Verified current state

- All56 mapping entries are preserved in order; all50 unique GLB files and50 unique JPG thumbnails exist.
- Direct comparison with the readonly pinned repository proves all50 GLB and50 JPG files are byte-identical. No derivative models exist and no geometry/material/manifest file was changed in this work.
- Factory/TestClient actual static mounts serve all100 assets with HTTP200, non-HTML MIME, and exact original provenance SHA256/byte count.
- Existing Anaconda Python/Pillow12.3 (read-only environment reuse; no installation) decoded all50 thumbnails and76 active embedded PNG/JPEG/WebP image resources. The project venv has no Pillow; its normal structural tests therefore avoid claiming pixel decoding and the independent decoder receipt records that evidence.
- All50 containers, mapping provenance and active reference graphs were inspected. **49 models have complete validated active dependencies; Terra has two original missing external image dependencies.** This is not a GPU/renderability claim. Draco mesh decoding and all50 actual Cesium GPU renderings remain separate parent-browser validation.

Decoder inventory: `data/workspace/validation/t075_asset_source_check/decoded_inventory.json` (generated evidence, not a source asset).

## Terra defect and faithful behavior

Terra contains active material texture indices0 and1 referencing exactly:

```
..\Terra.fbm\Side_Panels_TERRA.tga
..\Terra.fbm\solarpanels.tga
```

The GLB is unchanged from the pinned senior repository. A full readonly search of that repository found no `.tga` file or Terra.fbm dependency directory; there is therefore no source dependency available to copy or minimally remount. This identifies a defect in the pinned senior asset package. It does not assert anything about unpublished files or a separate NASA upstream resource version.

Current model URL is `/static/satellite_display/terra.glb`; normalized relative dependency requests resolve to `/static/Terra.fbm/...`. Originally those unmapped requests reached the migrated application's SPA catchall and returned HTTP200 HTML. The regression was captured RED. The parent's explicitly authorized narrow correction makes unknown `api/` and `static/` namespaces (including their roots) return JSON404, while ordinary `/`, `/ground`, `/satellite`, `/legacy` pages retain HTML200.

Pinned source SatelliteModelLayer109–112 catches `fromGltfAsync` failure, logs model unavailable and preserves the point marker. It does not retry with removed textures/default materials. Inventing images or silently stripping texture references would change the source view behavior, so neither was done. Package `complete:false` and `render_status:unverified` remain faithful rather than claiming a repaired Terra model.

## Tests and boundaries

```
project_support/.venv/Scripts/python.exe -m pytest project_support/tests/test_satellite_display_source_static.py project_support/tests/test_satellite_display_assets.py project_support/tests/test_web_assets.py -q -o cache_dir=data/workspace/validation/t075_asset_source_check/cache --basetemp=data/workspace/validation/t075_asset_source_check/temp3
```

**23 passed**, one pre-existing Starlette/httpx deprecation warning. New tests check every source asset/thumbnail HTTP identity, source mapping coverage, the exact original active Terra texture defect, missing-dependency404, API/static404 versus ordinary SPA success. Existing malformed container/reference/image/provenance and texture-embedding preservation tests remain passing. The separate actual image decode run completed with the only errors being the two Terra external resources.

Only product edit: frontend namespace guard in `user_application/web/application.py`. No model bytes, source formulas, server/browser process, Git state, dependencies or fallback model were changed.
