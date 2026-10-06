# ADR 0033 Source mission records over native geometry

Status: internal prerequisite implemented; V6 acceptance pending.

Inject existing source ground-link and mission-type models into the application record projector. Retain source contact/access shapes, radio activity, Ka/X/S selection, equipment rate and representative uplink values. Receive geometry only from NativeMissionPasses through the existing Rust point query. UTC strings are normalized to original JavaScript millisecond ISO format for source window IDs and schema compatibility. Native model time remains explicitly Unix-ms UTC approximate.

Before projecting, compare geometry receipt metadata, expected definition hash, observer site/height and mask/cone. Reject malformed required rows and nonfinite/negative rate inputs; preserve no-common-active-radio as no contacts. Retain every supported native window instead of source8/6 hidden limits. Projection is not a source of authoritative current context: application composition must verify the expected hash against the full captured roster, equipment, station/fault/settings and commonUTC, retain sampled coverage, reject late replies and fence commits. N010 and N011 stay open.

Reference is evaluated only in offline tooling. Native12h three contacts/one access versus unchanged original mapping and pass predictor (normalized70m observer height) matches bands/rates/IDs/rounding; maximum boundary difference1ms. Rates are representative sandbox values, not actual hardware throughput or a validated RF link budget. Projection does not imply terrain/refraction/weather/camera agility/continuous visibility coverage.

See feature validation/t078_mission_window_records.md for tests and remaining gates.
