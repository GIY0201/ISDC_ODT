# T084 actual Chrome export files — 2026-10-07

The existing V6 `#compare` controls called the original report routes on port 8891. Chrome saved the JSON and CSV files to its normal Downloads directory. No browser download setting was changed, and existing files were preserved by Chrome's duplicate filename suffix.

| Format | Saved file | Bytes | SHA-256 of file and same HTTP response |
|---|---|---:|---|
| JSON | `spacetwin-snapshot (1).json` | 2549 | `43e231a754eb78ca836270f7bde802885a699716917a8389a858a37c225dbee6` |
| CSV | `spacetwin-report (1).csv` | 216 | `289334fcb069324316665c4451a1cf77d0c395858a958c61197bec01943e25f3` |

Evidence is under ignored `data/workspace/validation/migration_0125`: `export_json_http.bin`, `export_csv_raw_http.bin`, `export_csv_live_0147.png`. JSON was captured from the response associated with the same UI download, not a later query. CSV was captured as raw base64 through an origin-scoped Fetch response observer, continued unchanged, and the temporary observer was removed with empty patterns. The normal Network text response strips the UTF-8 BOM; that decoded text was not used as a claim of byte equality. The raw capture retains the original three-byte BOM and CRLF.

The high-level browser download event timed out even though Chrome created the file. Completion was therefore verified on disk by exact filename, current creation time, byte count and SHA-256 rather than inferred from a UI toast. Two earlier verification downloads remain preserved.

CSV retains exactly the source `KPI,Name,Value,Target,Unit,Status` columns: percent, milliseconds, seconds, percent. It does not include run, scenario, generation time or provenance. JSON retains generation time, runtime run/scenario/elapsed and source SIM data-quality context. These are existing deterministic SIM reports, not actual RF/security/whole-product verification. Each button makes a separate query; the two formats are not asserted to describe a single frozen SIM instant.

This closes the specific actual-file gap of T084. It does not close scenario playback, multiwindow, performance, RF/HIL or the overall migration.
