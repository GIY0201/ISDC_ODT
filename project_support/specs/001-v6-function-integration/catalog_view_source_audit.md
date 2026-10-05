# Remaining T075 original display/model source audit

Read-only sourceHEAD1a1e00297a0301637455b0ef2cf48b2e74576b07 verified2026-10-05. No source assets copied or runtime behavior changed by this audit.

## Corrected model scope
Prior US15 research wording that original3D only meant scene modes/representativeSVG and no actualGLB was incorrect. Original user_application/web/assets/models contains50GLB files,37,202,844bytes; manifest schema2 has56mapping records/providers nasa,noaa_goesr,spacetwin,all referenced model files present. ManifestSHA2567a88f531a8a138c0d7f8eaa4e3c88a891ab17920d809389f62feb9b5d621f9fe. Assetdirectory102files,total38,029,187bytes includes thumbnails/metadata. Provider credits and upstream revisions are manifest claims at this audit, not independent external/license verification.

user_application/web/scripts/orbit/satellite_models.js createModelResolver uses assignedmodelkey→exactNORAD/name→series→family→orbit/kind representative, excludes debris/rocket; returns dimensions/scale/orientation/thumbnail/credits/quality. tabs/orbit.js renderShape displays thumbnail/quality/credit and showModel injects selectedmodel into digital_twin/visualization/satellite_model.js. That renderer actually calls Cesium.Model.fromGltfAsync and supports one selectedmodel plus focus/follow/camera interruption/zoom; approximate bodyorientation follows velocity/outwardEarth, not measuredattitude. GLBmodel/render/follow/quality are in T075 scope; SVG alone cannot close it. Some manifest provider notes contain U+FFFD/garbled Korean; preserve originalsource evidence and review presentation text explicitly rather than treating it as verified content.

## Display controls still required
Original globe.js setSceneMode: cancelcamera/morph revision fence/completeMorph,2D/3D1.5s transition,rotate/tilt/zoom limits and2D basis reset. setImagery supports ArcGIS satellite/OSM/NaturalEarth fallback; applyImageryStyle preserves brightness/contrast/saturation/gamma/theme/emphasis. setTheme controls illumination/atmosphere and point/label/path styles. Selected path uses outline material where supported.

Original addSunIndicator/updateSunIndicator/positionSunOverlay uses Simon1994position and ICRF→fixed or pseudo-fixed conversion, one-minute update, camera/earth occlusion/offscreen and2D hiding. Catch block invents a day-angle direction; this must not enter product as verified astronomical/EOP output. Audit original orbit/globe_lighting.js before deciding the equivalent explicit-quality/failed state contract; maintain selected catalogUTC/frozen EOP and no synthetic physical evidence. This is a pending design question to resolve from code, not authorization to weaken source fidelity.

## Next stage
Return to existing feature specify/plan/tasks owner for these original functions; preserve T111–T116 and all previous decisions. Define originaldisplay controls, exact modelmapping/load/lifecycle/failure/provenance, oneViewer and source-ownedasset packaging before implementation. Current T075 partial; T076–T084 and T032/F001/F004–6/download diskunknown unchanged. Do not create another feature or import executable reference paths.

Additional original display detail: tabs/orbit.js hoverSatellite renders a bounded pointer card with escaped name, NORAD, orbit regime and altitude. Current hover emphasis alone does not reproduce this card. Retain the card with T075 model/inspector design using native display geometry and explicit height/frame contract; do not fabricate altitude or exclude it when closing T075.
