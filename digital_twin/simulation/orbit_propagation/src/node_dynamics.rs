//! Source-equivalent Kepler/J2 engineering model from ISDC-ODT 1a1e002.
//! km, km/s, degrees, Unix-ms UTC approximation. Not SGP4/TEME/ITRF.
use serde_json::Value;
use std::f64::consts::{PI,TAU};
pub const NODE_PROFILE:&str="SOURCE_KEPLER_J2_V1";
pub const NODE_FRAME:&str="EARTH_FIXED_GMST_UTC_APPROX";
pub const NODE_INERTIAL_FRAME:&str="SOURCE_MEAN_EQUATOR_EQUINOX_APPROX";
pub const NODE_TIME_MODEL:&str="unix_ms_utc_approx";
pub const NODE_ROW_WIDTH:usize=31;
pub const MAX_NODE_DEFINITIONS:usize=240;
pub const MAX_NODE_ROWS:usize=50_000;
pub const MAX_NODE_SAMPLES:usize=601;
const R:f64=6378.137;
const MU:f64=398600.4418;
const J2:f64=1.08262668e-3;
const RAD:f64=PI/180.0;
const DEG:f64=180.0/PI;
const F:f64=1.0/298.257223563;
const E2:f64=F*(2.0-F);
#[derive(Clone,Copy)]
struct Elements{a:f64,e:f64,i:f64,raan:f64,argp:f64,m:f64,epoch:f64,n:f64,raan_dot:f64,argp_dot:f64}
fn number(v:&Value,key:&str,default:Option<f64>)->Option<f64>{
 let n=match v.get(key){None=>default?,Some(x)=>x.as_f64()?};n.is_finite().then_some(n)
}
fn elements(v:&Value)->Option<Elements>{
 let a=R+number(v,"altitude_km",None)?;let e=number(v,"eccentricity",Some(0.0))?;let inc=number(v,"inclination",None)?;
 let epoch=number(v,"epoch",None)?;
 if !(0.0..0.95).contains(&e)||!(0.0..=180.0).contains(&inc)||epoch.abs()>8.64e15||a*(1.0-e)-R<120.0||a*(1.0+e)-R>200000.0{return None;}
 let i=inc*RAD;let n0=(MU/(a*a*a)).sqrt();let p=a*(1.0-e*e);let k=1.5*J2*(R/p).powi(2)*n0;let sin2=i.sin().powi(2);
 Some(Elements{a,e,i,epoch,raan:number(v,"raan",Some(0.0))?*RAD,argp:number(v,"argp",Some(0.0))?*RAD,m:number(v,"mean_anomaly",Some(0.0))?*RAD,n:n0+k*(1.0-e*e).sqrt()*(1.0-1.5*sin2),raan_dot:-k*i.cos(),argp_dot:k*(2.0-2.5*sin2)})
}
fn wrap(v:f64,period:f64)->f64{let w=v%period;if w<0.0{w+period}else{w}}
fn rotate(raan:f64,argp:f64,i:f64,x:f64,y:f64)->[f64;3]{
 let (so,co)=raan.sin_cos();let(sw,cw)=argp.sin_cos();let(si,ci)=i.sin_cos();
 [(co*cw-so*sw*ci)*x+(-co*sw-so*cw*ci)*y,(so*cw+co*sw*ci)*x+(-so*sw+co*cw*ci)*y,si*sw*x+si*cw*y]
}
fn norm(v:[f64;3])->f64{v[0].hypot(v[1]).hypot(v[2])}
fn dot(a:[f64;3],b:[f64;3])->f64{a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
fn unit(v:[f64;3])->[f64;3]{let n=norm(v);if n>0.0{v.map(|x|x/n)}else{[0.0;3]}}
fn cross(a:[f64;3],b:[f64;3])->[f64;3]{[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
fn state(el:Elements,millis:f64)->Option<[f64;31]>{
 let t=(millis-el.epoch)/1000.0;let m=wrap(el.m+el.n*t,TAU);let raan=wrap(el.raan+el.raan_dot*t,TAU);let argp=wrap(el.argp+el.argp_dot*t,TAU);
 let mut big=if el.e<0.8{m}else{PI};for _ in 0..30{let step=(big-el.e*big.sin()-m)/(1.0-el.e*big.cos());big-=step;if step.abs()<1e-12{break;}}
 let( sin_e,cos_e)=big.sin_cos();let radius=el.a*(1.0-el.e*cos_e);let true_anomaly=((1.0-el.e*el.e).sqrt()*sin_e).atan2(cos_e-el.e);
 let r=rotate(raan,argp,el.i,radius*true_anomaly.cos(),radius*true_anomaly.sin());let factor=(MU*el.a).sqrt()/radius;
 let v=rotate(raan,argp,el.i,-factor*sin_e,factor*(1.0-el.e*el.e).sqrt()*cos_e);
 let centuries=(millis/86400000.0+2440587.5-2451545.0)/36525.0;
 let seconds=67310.54841+(876600.0*3600.0+8640184.812866)*centuries+0.093104*centuries*centuries-6.2e-6*centuries*centuries*centuries;
 let theta=wrap((seconds%86400.0)/240.0*RAD,TAU);let(s,c)=theta.sin_cos();let fixed=[r[0]*c+r[1]*s,-r[0]*s+r[1]*c,r[2]];
 let horizontal=fixed[0].hypot(fixed[1]);let mut latitude=fixed[2].atan2(horizontal);
 for _ in 0..10{let sine=latitude.sin();let normal=R/(1.0-E2*sine*sine).sqrt();latitude=(fixed[2]+E2*normal*sine).atan2(horizontal);}
 let sine=latitude.sin();let height=horizontal*latitude.cos()+fixed[2]*sine-R*(1.0-E2*sine*sine).sqrt();if height<0.0{return None;}
 let mean_longitude=wrap(280.460+36000.771*centuries,360.0);let sun_m=wrap(357.5291092+35999.05034*centuries,360.0)*RAD;
 let longitude=(mean_longitude+1.914666471*sun_m.sin()+0.019994643*(2.0*sun_m).sin())*RAD;let obliquity=(23.439291-0.0130042*centuries)*RAD;
 let sun=[longitude.cos(),obliquity.cos()*longitude.sin(),obliquity.sin()*longitude.sin()];let along=dot(r,sun);let perpendicular=norm([r[0]-sun[0]*along,r[1]-sun[1]*along,r[2]-sun[2]*along]);
 let z=unit(r);let y=unit(cross(z,unit(v)));let x=cross(y,z);
 let mut row=[0.0;31];for(start,vector)in [(0,r),(3,v),(6,fixed),(9,sun),(12,x),(15,y),(18,z)]{row[start..start+3].copy_from_slice(&vector);}
 row[21..].copy_from_slice(&[radius,m*DEG,wrap(true_anomaly,TAU)*DEG,raan*DEG,argp*DEG,theta*DEG,if along>=0.0||perpendicular>R{1.0}else{0.0},fixed[1].atan2(fixed[0])*DEG,latitude*DEG,height]);
 row.iter().all(|n|n.is_finite()).then_some(row)
}
/// Owned little-endian rows and aligned errors. No state survives this call.
pub fn calculate_nodes(definitions_json:String,indices:Vec<usize>,times:Vec<f64>)->Result<(Vec<u8>,Vec<Option<String>>),String>{
 let definitions:Value=serde_json::from_str(&definitions_json).map_err(|_|"invalid_node_definitions")?;let defs=definitions.as_array().ok_or("node_definitions_array_required")?;
 if defs.is_empty()||defs.len()>MAX_NODE_DEFINITIONS||indices.len()!=times.len()||times.len()>MAX_NODE_ROWS||times.iter().any(|t|!t.is_finite())||indices.iter().any(|i|*i>=defs.len()){return Err("invalid_node_batch_structure".into());}
 let mut counts=vec![0;defs.len()];for i in &indices{counts[*i]+=1;if counts[*i]>MAX_NODE_SAMPLES{return Err("node_sample_limit".into());}}
 let prepared:Vec<_>=defs.iter().map(elements).collect();let mut buffer=Vec::with_capacity(times.len()*NODE_ROW_WIDTH*8);let mut errors=Vec::with_capacity(times.len());
 for(index,time)in indices.into_iter().zip(times){let(row,error)=if time.abs()>8.64e15{([f64::NAN;31],Some("unsupported_node_time".into()))}else{match prepared[index]{None=>([f64::NAN;31],Some("invalid_node_orbit".into())),Some(el)=>match state(el,time){Some(row)=>(row,None),None=>([f64::NAN;31],Some("node_calculation_failed".into()))}}};for value in row{buffer.extend_from_slice(&value.to_le_bytes());}errors.push(error);}
 Ok((buffer,errors))
}
