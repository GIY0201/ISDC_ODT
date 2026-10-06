# 0042 Source-backed satellite display repairs

Status: accepted for implementation; actual GPU and complete-package acceptance remain required.

## Context

Pinned senior model assets must remain available byte-identically. Actual Cesium rendering exposes upstream Terra external TGA references and missing UV attributes, and Jason's texture assignment on a surface lacking UV. Treating successful file loading as full rendering hid these defects. Arbitrary generated UVs or removing textures solely to get a green check would lose source meaning.

## Decision

Preserve each original asset and original manifest; select explicitly named derivatives through the existing manifest/provenance contract. Record source URLs/commits, hashes, exact modifications, unresolved lineage limits and independent static/GPU evidence. Do not change orbit, clock, runtime or physical-model calculations.

Terra uses two exact named textures embedded in official historical NASA FBX. Lossless PNG conversion preserves decoded pixels. Pinned official FBX UV data restores missing TEXCOORD_0 through exact float32 vertex bijections and same-winding triangle topology, retaining original geometry bytes/materials/samplers. FBX bottom-left to glTF top-left conversion is explicit(u,1-v), without clamping repeated coordinates. Texture pixel continuity across NASA's2024 re-export cannot be independently proved and remains disclosed.

Jason requires a separate material correction, not invented UVs. Official historical FBX associates the corresponding248vertex/420triangle DarkGrey surface with Solar Panels_backside and no incoming texture connection or UV. Current compressed GLB assigns a baseColorTexture to that UV-less material. A derivative may restore the documented solid-material behavior only after verifying exact named material ownership and all consumers, source/current color and opacity compatibility, preserving other material/texture assignments and all geometry bytes. A source conflict prevents automatic repair. Geometry correspondence affected by Draco quantization must not be represented as Terra's exact vertex proof.

## Verification and limitations

Regressions must detect textured primitives missing their referenced texCoord, including KHR_texture_transform overrides. Repair tests preserve original binaries, unchanged geometry/indices, source provenance and unaffected textured surfaces. Explicit decoder tools remain isolated in ignored workspace; runtime dependencies are unchanged. Static receipt completeness stays false while any active source defect remains. Actual GPU inspection must show the repaired model and surviving textured surfaces without shader errors; source-material correction is not manufacturer shape/measurement certification.
