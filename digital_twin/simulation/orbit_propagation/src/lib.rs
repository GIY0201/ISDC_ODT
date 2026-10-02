use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;
use pyo3::types::PyBytes;
pub const MAX_BATCH_ROWS: usize = 86401;
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
#[pymodule]
fn isdc_orbit_propagation(m:&Bound<'_,PyModule>)->PyResult<()> {
    m.add_function(wrap_pyfunction!(propagate_tle,m)?)?;m.add_function(wrap_pyfunction!(propagate_omm,m)?)?;
    m.add("calculation_profile","WGS72_AFSPC")?;m.add("__version__","0.1.0")?;m.add("MAX_BATCH_ROWS",MAX_BATCH_ROWS)?;Ok(())
}
