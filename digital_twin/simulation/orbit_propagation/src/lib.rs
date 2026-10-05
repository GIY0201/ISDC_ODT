pub mod node_dynamics;
use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;
use pyo3::types::PyBytes;
pub const MAX_BATCH_ROWS: usize = 86401;
pub const MAX_CATALOG_BATCH_ROWS: usize = 50_000;
pub fn calculate(elements: sgp4::Elements, minutes: Vec<f64>) -> Result<(Vec<u8>,Vec<Option<String>>),String> {
    if minutes.len()>MAX_BATCH_ROWS || minutes.iter().any(|t| !t.is_finite()) {return Err("finite minutes and at most 86401 rows required".into());}
    let constants=sgp4::Constants::from_elements_afspc_compatibility_mode(&elements).map_err(|e|e.to_string())?;
    let mut buffer=Vec::with_capacity(minutes.len()*48); let mut errors=Vec::with_capacity(minutes.len());
    for t in minutes {
        let (values,error)=match constants.propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(t)) {
            Ok(p)=>([p.position[0],p.position[1],p.position[2],p.velocity[0],p.velocity[1],p.velocity[2]],None),
            Err(e)=> {let code=match e {
                sgp4::Error::OutOfRangePerturbedEccentricity{..}=>"diverging perturbed eccentricity",
                sgp4::Error::NegativeSemiLatusRectum{..}=>"negative semi-latus rectum",
                _=>"propagation error",
            }; ([f64::NAN;6],Some(code.to_string()))}
        };
        for value in values {buffer.extend_from_slice(&value.to_le_bytes());} errors.push(error);
    }
    Ok((buffer,errors))
}
pub fn calculate_many(payloads: Vec<String>, minutes: Vec<f64>) -> Result<(Vec<u8>, Vec<Option<String>>), String> {
    if payloads.len() != minutes.len() || payloads.len() > MAX_CATALOG_BATCH_ROWS || minutes.iter().any(|t| !t.is_finite()) {
        return Err("aligned payloads and finite minutes; at most 50000 catalog rows required".into());
    }
    let mut buffer = Vec::with_capacity(payloads.len()*48);
    let mut errors = Vec::with_capacity(payloads.len());
    for (payload, minute) in payloads.into_iter().zip(minutes) {
        let output = match serde_json::from_str::<sgp4::Elements>(&payload) {
            Ok(elements) => calculate(elements, vec![minute]).map_err(|_| "invalid SGP4 elements"),
            Err(_) => Err("invalid OMM"),
        };
        match output {
            Ok((row, row_errors)) => { buffer.extend(row); errors.extend(row_errors); }
            Err(code) => {
                for _ in 0..6 { buffer.extend_from_slice(&f64::NAN.to_le_bytes()); }
                errors.push(Some(code.to_string()));
            }
        }
    }
    Ok((buffer, errors))
}
fn run(py:Python<'_>, elements:sgp4::Elements, minutes:Vec<f64>)->PyResult<(Py<PyBytes>,Vec<Option<String>>)> {
    let (buffer,errors)=py.detach(move||calculate(elements,minutes)).map_err(PyValueError::new_err)?;
    Ok((PyBytes::new(py,&buffer).unbind(),errors))
}
#[pyfunction]
fn propagate_tle(py:Python<'_>,line1:String,line2:String,minutes:Vec<f64>)->PyResult<(Py<PyBytes>,Vec<Option<String>>)> {
    let elements=sgp4::Elements::from_tle(None,line1.as_bytes(),line2.as_bytes()).map_err(|e|PyValueError::new_err(e.to_string()))?;
    run(py,elements,minutes)
}
#[pyfunction]
fn propagate_omm(py:Python<'_>,payload:String,minutes:Vec<f64>)->PyResult<(Py<PyBytes>,Vec<Option<String>>)> {
    let elements:sgp4::Elements=serde_json::from_str(&payload).map_err(|e|PyValueError::new_err(e.to_string()))?;
    run(py,elements,minutes)
}
#[pyfunction]
fn propagate_omm_many(py:Python<'_>,payloads:Vec<String>,minutes:Vec<f64>)->PyResult<(Py<PyBytes>,Vec<Option<String>>)> {
    let (buffer, errors) = py.detach(move || calculate_many(payloads, minutes)).map_err(PyValueError::new_err)?;
    Ok((PyBytes::new(py, &buffer).unbind(), errors))
}
#[pyfunction]
fn propagate_nodes(py:Python<'_>,definitions_json:String,node_indices:Vec<usize>,unix_millis:Vec<f64>)->PyResult<(Py<PyBytes>,Vec<Option<String>>)> {
    let (buffer,errors)=py.detach(move||node_dynamics::calculate_nodes(definitions_json,node_indices,unix_millis)).map_err(PyValueError::new_err)?;
    Ok((PyBytes::new(py,&buffer).unbind(),errors))
}
#[pymodule]
fn isdc_orbit_propagation(m:&Bound<'_,PyModule>)->PyResult<()> {
    m.add_function(wrap_pyfunction!(propagate_tle,m)?)?;m.add_function(wrap_pyfunction!(propagate_omm,m)?)?;
    m.add_function(wrap_pyfunction!(propagate_omm_many,m)?)?;
    m.add_function(wrap_pyfunction!(propagate_nodes,m)?)?;
    m.add("node_calculation_profile",node_dynamics::NODE_PROFILE)?;
    m.add("node_frame",node_dynamics::NODE_FRAME)?;
    m.add("node_inertial_frame",node_dynamics::NODE_INERTIAL_FRAME)?;
    m.add("node_time_model",node_dynamics::NODE_TIME_MODEL)?;
    m.add("NODE_ROW_WIDTH",node_dynamics::NODE_ROW_WIDTH)?;
    m.add("MAX_NODE_DEFINITIONS",node_dynamics::MAX_NODE_DEFINITIONS)?;
    m.add("MAX_NODE_ROWS",node_dynamics::MAX_NODE_ROWS)?;
    m.add("MAX_NODE_SAMPLES",node_dynamics::MAX_NODE_SAMPLES)?;
    m.add("calculation_profile","WGS72_AFSPC")?;m.add("__version__",env!("CARGO_PKG_VERSION"))?;m.add("MAX_BATCH_ROWS",MAX_BATCH_ROWS)?;m.add("MAX_CATALOG_BATCH_ROWS",MAX_CATALOG_BATCH_ROWS)?;Ok(())
}
