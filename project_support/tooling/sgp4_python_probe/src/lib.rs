use pyo3::prelude::*;
use pyo3::exceptions::{PyValueError,PyRuntimeError};
use std::time::Instant;
type Predictions=Vec<(Vec<f64>,Vec<f64>)>;

#[pyfunction]
fn propagate_batch(py: Python<'_>, line1: String, line2: String, minutes: Vec<f64>) -> PyResult<(Predictions,f64)> {
    if minutes.len()>100000 { return Err(PyValueError::new_err("probe limit: 100000 samples")); }
    if minutes.iter().any(|t| !t.is_finite()) { return Err(PyValueError::new_err("elapsed minutes must be finite")); }
    let elements=sgp4::Elements::from_tle(None,line1.as_bytes(),line2.as_bytes()).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let constants=sgp4::Constants::from_elements_afspc_compatibility_mode(&elements).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let result: Result<(Predictions,f64),String>=py.detach(move || {
        let start=Instant::now();
        let predictions: Predictions=minutes.into_iter().enumerate().map(|(i,t)| {
            constants.propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(t)).map(|p|(p.position.to_vec(),p.velocity.to_vec())).map_err(|e|format!("sample {i}: {e}"))
        }).collect::<Result<_,_>>()?;
        Ok((predictions,start.elapsed().as_secs_f64()*1000.0))
    });
    result.map_err(PyRuntimeError::new_err)
}

#[pyfunction]
fn propagate_batch_buffer(py: Python<'_>, line1: String, line2: String, minutes: Vec<f64>) -> PyResult<(Py<pyo3::types::PyBytes>,usize,f64)> {
    if minutes.len()>100000 { return Err(PyValueError::new_err("probe limit: 100000 samples")); }
    if minutes.iter().any(|t| !t.is_finite()) { return Err(PyValueError::new_err("elapsed minutes must be finite")); }
    let elements=sgp4::Elements::from_tle(None,line1.as_bytes(),line2.as_bytes()).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let constants=sgp4::Constants::from_elements_afspc_compatibility_mode(&elements).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let n=minutes.len();
    let result: Result<(Vec<u8>,f64),String>=py.detach(move || {
        let start=Instant::now(); let mut output=Vec::with_capacity(n*48);
        for (i,t) in minutes.into_iter().enumerate() {
            let p=constants.propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(t)).map_err(|e|format!("sample {i}: {e}"))?;
            for v in p.position.into_iter().chain(p.velocity) { output.extend_from_slice(&v.to_le_bytes()); }
        }
        Ok((output,start.elapsed().as_secs_f64()*1000.0))
    });
    let (buffer,ms)=result.map_err(PyRuntimeError::new_err)?;
    Ok((pyo3::types::PyBytes::new(py,&buffer).unbind(),n,ms))
}

#[pymodule]
fn isdc_sgp4_probe(m: &Bound<'_,PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(propagate_batch,m)?)?;
    m.add_function(wrap_pyfunction!(propagate_batch_buffer,m)?)?;
    m.add("__version__","0.1.0")?;
    m.add("calculation_profile","WGS72 AFSPC")?;
    Ok(())
}
