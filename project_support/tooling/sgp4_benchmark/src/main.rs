use std::{env, fs, hint::black_box, time::Instant};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let input: serde_json::Value = serde_json::from_str(&fs::read_to_string(&args[1])?)?;
    let elements = sgp4::Elements::from_tle(None, input["line1"].as_str().unwrap().as_bytes(), input["line2"].as_str().unwrap().as_bytes())?;
    let constants = sgp4::Constants::from_elements_afspc_compatibility_mode(&elements)?;
    let n: usize = args[2].parse()?;
    let dt = 1440.0 / n as f64;
    let calculate = || -> Result<Vec<([f64;3],[f64;3])>, sgp4::Error> {
        (0..n).map(|i| constants.propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(i as f64 * dt)).map(|p| (p.position,p.velocity))).collect()
    };
    for _ in 0..3 { black_box(calculate()?); }
    let mut samples_ms = Vec::new();
    for _ in 0..20 {
        let start=Instant::now();
        black_box(calculate()?);
        samples_ms.push(start.elapsed().as_secs_f64()*1000.0);
    }
    let predictions=calculate()?;
    let output=serde_json::json!({"n":n,"step_minutes":dt,"samples_ms":samples_ms,"predictions":predictions,"mode":"WGS72 AFSPC","includes":"propagation loop and Vec allocation; excludes parsing, JSON, process launch"});
    fs::write(&args[3],serde_json::to_vec(&output)?)?;
    Ok(())
}
