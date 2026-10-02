#[test]
fn official_states() {
 let fixture:toml::Value=toml::from_str(include_str!("../../../../project_support/tests/fixtures/orbit/sgp4_test_cases.toml")).unwrap();
 let cases=fixture["list"].as_array().unwrap();let mut count=0;
 for case in cases {
  let states=case["states"].as_array().unwrap();
  let number=|v:&toml::Value|v.as_float().unwrap_or_else(||v.as_integer().unwrap() as f64);
  let elements=sgp4::Elements::from_tle(None,case["line1"].as_str().unwrap().as_bytes(),case["line2"].as_str().unwrap().as_bytes()).unwrap();
  let (buf,errors)=isdc_orbit_propagation::calculate(elements,states.iter().map(|s|number(&s["time"])).collect()).unwrap();
  for (i,state) in states.iter().enumerate() {
   if let Some(error)=state.get("error") {assert_eq!(errors[i].as_deref(),error.as_str());}
   else {assert!(errors[i].is_none()); for j in 0..6 {let value=f64::from_le_bytes(buf[i*48+j*8..i*48+j*8+8].try_into().unwrap());let expected=number(&state[if j<3 {"position"} else {"velocity"}][j%3]); assert!((value-expected).abs()<if j<3 {1e-6} else {1e-9});}}
   count+=1;
  }
 }
 assert_eq!(cases.len(),33);assert_eq!(count,668);
}
