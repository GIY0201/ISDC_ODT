# T077 original ground-station model

Source: ISDC-ODT commit `1a1e00297a0301637455b0ef2cf48b2e74576b07`, `digital_twin/model_library/browser/ground_stations.js`, SHA256 `d63b55ab5d1e354de743f96a8998871d426217b62d551caeca131c39dc8c5ce4`.

The reused pure model exposes the original constructors, normalizer, validator, band definitions, antenna gain/G/T, great-circle station distance and spherical coverage radius. It imports and reexports the existing `station_presets.js` object, rather than creating another copy of the twelve site definitions used by the observer selector. No clock, runtime state, transport, browser storage or propagation is added.

Units remain degrees for latitude/longitude/mask, kilometres for ellipsoidal station altitude and surface/coverage distance, metres for dish diameter, GHz for band frequency, dBi for antenna gain and dB/K for G/T. Source constants remain aperture efficiency0.6, temperatures150/200/300K and frequencies2.2/8.2/20GHz for S/X/Ka. Coverage and station distance use the original spherical radius6378.137km; these are engineering approximations, separate from the precise native GP/ITRF visibility path.

Preserve the source constructor's fallback/filter semantics and validation ranges exactly. A caller must validate the constructed/restored station before acceptance. The normalizer alone does not prove validity. Station names retain the source JavaScript40-code-unit limit. Returned station band arrays are independent of source presets and caller arrays. This model is neither a current-state owner nor a station-storage acceptance controller.

Coordinates and equipment presets are reused prototype data; no current facility capability, actual antenna, ISS receive band, operational link or measured RF claim is implied. Future ground-segment UI must explicitly label these assumptions and keep the existing official ISS conditions distinct.

Evidence: offline original execution capture covers twelve presets/constructors, custom/filter/restore, validation results,24 gain/G/T cases,144 ordered station distances and20 coverage cases. Production never imports the upstream checkout. Product boundary tests cover invalid ranges and independent output arrays. Full communication acceptance still requires verified common-UTC native states, existing optical-history owner, original ground links/network snapshot, explicit data-fabric exchange/routes/status, ground configuration UI and actual8891 verification; T077 remains open.
