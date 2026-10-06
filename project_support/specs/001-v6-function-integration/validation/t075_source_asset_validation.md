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
## 2026-10-07 04:40 actual GPU selection matrix

Actual fixed8891 in-app browser UI selected all56 manifest entries through the existing node editor, with native valid selected-node samples at2020-07-12T21:16:01.000416000Z.55entries (49unique GLBs) reached the renderer-ready status; original Terra alone failed because its external TGA dependencies were missing. Parent-recorded observations are in data/workspace/validation/t075_gpu_live_0440/observed_ui_models.json, bound to the pre-repair manifest SHA256. This is actual GPU loading evidence, not a claim that every model's appearance or frame rate was visually verified.

Oneweb focus was visually inspected as a cube with solar wings. Existing-distance follow and release,2D/3D map switching, one Cesium canvas and native pose continuity were verified. A tab-scoped block of Hubble GLB produced the real load error and point fallback; clearing the block and clicking the visible retry restored renderer-ready status. Original selected Oneweb was restored through the editor; temporary network blocking and viewport overrides were cleared. No server deployment, run commands or source GP input edits were issued. Local draft nodes remain explicitly unaccepted; their workspace UTC label is intentionally unverified.

Terra official-source recovery and its actual post-repair GPU acceptance are tracked separately. Whole T075 remains open for remaining appearance, solar/occlusion and performance criteria; these checks do not close T076–T083.
## 2026-10-07 04:54 post-texture actual Terra failure

Reloaded in-app browser and selected actual catalog TERRA25994 at its GP epoch2026-10-06T07:11:41.280576000Z. Native ITRF position and1021/1021trajectory samples succeeded, but the texture-embedded derivative reached a Cesium1.143 fragment shader error: v_texCoord_0 undeclared. The original GLB already omits TEXCOORD_0 on its textured meshes14/16; texture embedding preserved that defect. Existing fatal render handling then reported globe unavailable. This is a failed actual rendering gate; texture recovery alone is not completion. Do not interpret prior model-ready statuses as proof of every textured surface drawing successfully. Missing-UV validation and authoritative source UV recovery are ongoing; no synthetic UVs, removed textures or fabricated model success are accepted.
After clearing the failed Terra catalog selection and reloading, the same in-app browser selected HST20580, calculated its actual GP epoch ITRF position, reached renderer-ready and visually displayed the focused cylindrical Hubble body with both textured solar panels. Globe initialization recovered; the five local draft definitions were preserved. This verifies Hubble drawing after the isolated failure, not automatic render-error containment or all-model appearance.
## 2026-10-07 05:08 actual Terra UV repair acceptance

Exact pinned official FBX UV restoration now supersedes the texture-only failure above.168vertices map bijectively after float32 conversion;146triangles match with identical winding. Original GLB geometry/binary bytes remain unchanged; recovered UVs use source(u,1-v) convention without clamping and existing samplers/materials remain unchanged. Active derivative2165908bytes SHA25685e3a8e05c694463e3e664a3fd702484a0fc0e5eb042fbb3acdfb2dc924dd779; provenance retains historical-texture lineage limitation. Focused22PASS/1PillowSKIP plus separate existing Pillow pixel/geometryPASS. Package completeness remains false because Jason independently lacks a material UV.

Actual in-app browser reload and TERRA25994 catalog selection reach renderer-ready with no captured console errors; camera focus visibly draws original golden body and blue tiled solar array while native ITRF/epoch identity remains valid. Actual1280×720 and1920×1080 have body width equal viewport, one Cesium canvas and ready model.2D→3D keeps model-ready and exact selected GP UTC. Solar presentation carries selected GP UTC2026-10-06T07:11:41.280576000Z, official EOP c672540e026d, predicted_a UT1/polar motion and explicit ERFA model/real-measurement disclaimer. Lighting toggled off/on and restored; viewport override reset. The post-morph solar label changes2D-hidden→behind-camera as expected. This proves this model's actual rendering and these presentation actions, not all materials, automatic fatal-error recovery,240-nodeGPU or game60FPS.

## 2026-10-07 Jason source material repair and actual GPU check

Original jason.glb remains592740bytes/SHA25622139020d17a118aeedfa95b8295712b60f1ed992dcd6770b7a59bac57ea225b. Active jason_repaired.glb592788bytes/SHA256f9b01e1684fd83fa1242bdce55793128796b3ff6164272b5fae2e656dd2821fb restores only historical official material7 Solar Panels_backside: removes the newer invalid texture association and restores exact original RGBA(0.27450981736183167,0.27450981736183167,0.29019609093666077,1). All other JSON fields and entire current binary payload remain identical. Official historical/current39Draco primitive chunks match byte-for-byte, providing source geometry proof without invented UVs. Front textures remain unchanged. Provenance ledger records official historical GLB/FBX hashes; source originals and50originalGLBs/50thumbnails stay preserved.

Focused25PASS/1PillowSKIP, plus separate existing system-Pillow Terra pixel1PASS. Static package receipt nowcomplete=true/render_status=unverified; static completeness is not GPU certification. Root actual fixed8891 in-app browser reloaded the latest manifest, temporarily selected Jason on existing NODE-0043, established validated GPepoch display UTC through TERRA selection, selected node, and focused the model. The actual Cesium canvas visibly draws its gold body and gray panel backsides with no captured console errors.1280x720 and1920x1080 retain onecanvas/modelready;1280bodywidth equalsviewport. Current selected node's batch/provenance remains explicitly unaccepted, separate from its native display geometry. The original OneWeb model was restored, allfiveoriginaldraftnodes retained, TERRA catalog display restored and viewport override cleared. No deploy/recall/setup/runtime command/serverrestart/storedGPinputedit was issued. Actual front-side camera appearance, all50material review and gameperformance remain separate gates.
