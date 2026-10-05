use isdc_orbit_propagation::{calculate, calculate_many, MAX_CATALOG_BATCH_ROWS};

#[test]
fn many_orbits_match_scalar_official_states_including_errors() {
    let fixture: toml::Value = toml::from_str(include_str!("../../../../project_support/tests/fixtures/orbit/sgp4_test_cases.toml")).unwrap();
    let number = |v: &toml::Value| v.as_float().unwrap_or_else(|| v.as_integer().unwrap() as f64);
    let mut payloads = Vec::new(); let mut times = Vec::new(); let mut expected_bytes = Vec::new(); let mut expected_errors = Vec::new();
    for case in fixture["list"].as_array().unwrap() {
        let elements = sgp4::Elements::from_tle(None, case["line1"].as_str().unwrap().as_bytes(), case["line2"].as_str().unwrap().as_bytes()).unwrap();
        let payload = serde_json::to_string(&elements).unwrap();
        for state in case["states"].as_array().unwrap() {
            let time = number(&state["time"]);
            let (bytes, errors) = calculate(serde_json::from_str(&payload).unwrap(), vec![time]).unwrap();
            expected_bytes.extend(bytes); expected_errors.extend(errors); payloads.push(payload.clone()); times.push(time);
        }
    }
    let (bytes, errors) = calculate_many(payloads, times).unwrap();
    assert_eq!(errors.len(), 668); assert_eq!(errors, expected_errors);
    assert!(bytes==expected_bytes, "many-OMM output must exactly match scalar OMM for all 668 official offsets");
}

#[test]
fn aligned_failures_and_original_order_are_preserved() {
    let fixture: toml::Value = toml::from_str(include_str!("../../../../project_support/tests/fixtures/orbit/sgp4_test_cases.toml")).unwrap();
    let case = &fixture["list"][0];
    let elements = sgp4::Elements::from_tle(None, case["line1"].as_str().unwrap().as_bytes(), case["line2"].as_str().unwrap().as_bytes()).unwrap();
    let payload = serde_json::to_string(&elements).unwrap();
    let mut invalid = serde_json::to_value(&elements).unwrap(); invalid["ECCENTRICITY"] = serde_json::json!(2.0);
    let (bytes, errors) = calculate_many(vec![payload.clone(), "bad".into(), invalid.to_string(), payload.clone(), payload], vec![-1., 0., 0., -1., 1.]).unwrap();
    assert_eq!(errors, vec![None, Some("invalid OMM".into()), Some("invalid SGP4 elements".into()), None, None]);
    assert_eq!(&bytes[..48], &bytes[144..192]);
    for row in [1, 2] { for j in 0..6 { assert!(f64::from_le_bytes(bytes[row*48+j*8..row*48+j*8+8].try_into().unwrap()).is_nan()); } }
}

#[test]
fn whole_batch_structure_is_bounded_and_validated_before_rows() {
    assert_eq!(calculate_many(vec![], vec![]).unwrap(), (vec![], vec![]));
    assert!(calculate_many(vec!["bad".into()], vec![]).is_err());
    for bad in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] { assert!(calculate_many(vec!["bad".into()], vec![bad]).is_err()); }
    assert!(calculate_many(vec!["bad".into(); MAX_CATALOG_BATCH_ROWS+1], vec![0.; MAX_CATALOG_BATCH_ROWS+1]).is_err());
    let (bytes, errors) = calculate_many(vec!["bad".into(); MAX_CATALOG_BATCH_ROWS], vec![0.; MAX_CATALOG_BATCH_ROWS]).unwrap();
    assert_eq!(bytes.len(), MAX_CATALOG_BATCH_ROWS*48); assert_eq!(errors.len(), MAX_CATALOG_BATCH_ROWS);
    assert!(errors.iter().all(|e| e.as_deref()==Some("invalid OMM")));
}
