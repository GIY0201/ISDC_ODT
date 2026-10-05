use isdc_orbit_propagation::node_dynamics::{calculate_nodes, NODE_ROW_WIDTH, NODE_PROFILE, NODE_FRAME, NODE_INERTIAL_FRAME, NODE_TIME_MODEL};
use serde_json::{json,Value};
fn fixture()->Value {serde_json::from_str(include_str!("../../../../project_support/tests/fixtures/original_satellite_nodes.json")).unwrap()}
fn orbit()->Value {fixture()["cases"].as_array().unwrap().iter().find(|c|c["id"]=="elements:0").unwrap()["input"]["orbit"].clone()}
fn decode(bytes:&[u8])->Vec<f64>{bytes.chunks_exact(8).map(|b|f64::from_le_bytes(b.try_into().unwrap())).collect()}
#[test]
fn all_original_states_match_pinned_source_and_row_layout(){
 assert_eq!(NODE_FRAME,"EARTH_FIXED_GMST_UTC_APPROX");assert_eq!(NODE_INERTIAL_FRAME,"SOURCE_MEAN_EQUATOR_EQUINOX_APPROX");assert_eq!(NODE_TIME_MODEL,"unix_ms_utc_approx");assert_eq!(NODE_ROW_WIDTH,31);assert_eq!(NODE_PROFILE,"SOURCE_KEPLER_J2_V1");let fixtures=[fixture(),serde_json::from_str(include_str!("../../../../project_support/tests/fixtures/original_node_native_offsets.json")).unwrap()];let mut count=0;
 for f in fixtures {
 for c in f["cases"].as_array().unwrap().iter().filter(|c|c["id"].as_str().unwrap().starts_with("state:")){
  let (bytes,errors)=calculate_nodes(json!([c["input"]["orbit"]]).to_string(),vec![0],vec![c["input"]["millis"].as_f64().unwrap()]).unwrap();
  assert_eq!(bytes.len(),248);assert_eq!(errors,vec![None]);let actual=decode(&bytes);let e=&c["expected"];let mut expected=Vec::new();
  let energy=actual[3..6].iter().map(|v|v*v).sum::<f64>()/2.0-398600.4418/actual[21];
  assert!((energy+398600.4418/(2.0*e["elements"]["a"].as_f64().unwrap())).abs()<1e-10);
  for path in [vec!["inertial","r"],vec!["inertial","v"],vec!["fixed","r"],vec!["sunDirection"],vec!["basis","x"],vec!["basis","y"],vec!["basis","z"]]{let mut v=e;for key in path {v=&v[key];}expected.extend(v.as_array().unwrap().iter().map(|n|n.as_f64().unwrap()));}
  for key in ["radius","meanAnomaly","trueAnomaly","raan","argp","gmst"]{expected.push(e[key].as_f64().unwrap());}
  expected.push(if e["sunlit"].as_bool().unwrap(){1.0}else{0.0});for key in ["longitude","latitude","altitude"]{expected.push(e["geodetic"][key].as_f64().unwrap());}
  for (i,(a,b)) in actual.iter().zip(expected).enumerate(){let tol=match i {3..=5=>1e-10,9..=20=>1e-10,_=>1e-7};assert!((a-b).abs()<=tol,"{} col{} {} != {}",c["id"],i,a,b);}
  count+=1;
 }}assert_eq!(count,62);
}
#[test]
fn alignment_domain_errors_and_owned_repeated_rows(){
 let o=orbit();let epoch=o["epoch"].as_f64().unwrap();let mut invalid=o.clone();invalid["eccentricity"]=json!(0.95);
 let defs=json!([o,invalid]);let (bytes,errors)=calculate_nodes(defs.to_string(),vec![0,1,0],vec![epoch,epoch,epoch]).unwrap();
 assert_eq!(errors,vec![None,Some("invalid_node_orbit".into()),None]);assert_eq!(&bytes[..248],&bytes[496..]);assert!(decode(&bytes[248..496]).iter().all(|x|x.is_nan()));
 for change in [json!({"altitude_km":100}),json!({"altitude_km":200001}),json!({"inclination":181}),json!({"epoch":"2016-12-31T23:59:60Z"})] {let mut bad=orbit();for(k,v)in change.as_object().unwrap(){bad[k]=v.clone();}assert!(calculate_nodes(json!([bad]).to_string(),vec![0],vec![epoch]).unwrap().1[0].is_some());}
}
#[test]
fn negative_fractional_and_large_offsets_preserve_geometric_invariants(){
 let o=orbit();let epoch=o["epoch"].as_f64().unwrap();let times=vec![epoch-31536000000.0,epoch-0.25,epoch,epoch+0.25,epoch+31536000000.0];
 let (bytes,errors)=calculate_nodes(json!([o]).to_string(),vec![0;5],times).unwrap();assert!(errors.iter().all(Option::is_none));let rows=decode(&bytes);
 for row in rows.chunks_exact(31){assert!(row.iter().all(|x|x.is_finite()));let norm=|v:&[f64]|v.iter().map(|x|x*x).sum::<f64>().sqrt();assert!((norm(&row[..3])-row[21]).abs()<1e-8);assert!((norm(&row[6..9])-row[21]).abs()<1e-8);for v in [9,12,15,18]{assert!((norm(&row[v..v+3])-1.0).abs()<1e-12);}let dot=|a:usize,b:usize|(0..3).map(|i|row[a+i]*row[b+i]).sum::<f64>();assert!(dot(12,15).abs()<1e-12);assert!(dot(12,18).abs()<1e-12);}
 assert_ne!(&bytes[248..496],&bytes[496..744]);assert_ne!(&bytes[744..992],&bytes[496..744]);
}
#[test]
fn request_structure_and_capacity_are_enforced(){
 let defs=json!([orbit()]).to_string();for bad in [f64::NAN,f64::INFINITY,f64::NEG_INFINITY]{assert!(calculate_nodes(defs.clone(),vec![0],vec![bad]).is_err());}
 assert!(calculate_nodes("bad".into(),vec![0],vec![0.0]).is_err());assert!(calculate_nodes("[]".into(),vec![],vec![]).is_err());assert!(calculate_nodes(defs.clone(),vec![1],vec![0.0]).is_err());assert!(calculate_nodes(defs.clone(),vec![0],vec![]).is_err());
 assert!(calculate_nodes(json!(vec![orbit();241]).to_string(),vec![0],vec![0.0]).is_err());assert!(calculate_nodes(defs,vec![0;602],vec![0.0;602]).is_err());
 let defs=json!(vec![orbit();84]).to_string();let indices:Vec<usize>=(0..50000).map(|i|i/601).collect();let (bytes,errors)=calculate_nodes(defs.clone(),indices,vec![0.0;50000]).unwrap();assert_eq!(bytes.len(),50000*248);assert!(errors.iter().all(Option::is_none));assert!(calculate_nodes(defs,vec![0;50001],vec![0.0;50001]).is_err());
}

#[test]
fn unsupported_time_rows_and_source_domains_are_explicit(){
 let o=orbit();let epoch=o["epoch"].as_f64().unwrap();
 let(bytes,errors)=calculate_nodes(json!([o]).to_string(),vec![0,0,0],vec![epoch,8.64e15+1.0,epoch]).unwrap();
 assert_eq!(errors,vec![None,Some("unsupported_node_time".into()),None]);assert!(decode(&bytes[248..496]).iter().all(|x|x.is_nan()));assert_eq!(&bytes[..248],&bytes[496..]);
 for change in [json!({"eccentricity":-0.001}),json!({"inclination":-0.001}),json!({"epoch":null}),json!({"altitude_km":null}),json!({"epoch":8.64e15+1.0})]{let mut o=orbit();for(k,v)in change.as_object().unwrap(){o[k]=v.clone();}assert_eq!(calculate_nodes(json!([o]).to_string(),vec![0],vec![epoch]).unwrap().1,vec![Some("invalid_node_orbit".into())]);}
}
