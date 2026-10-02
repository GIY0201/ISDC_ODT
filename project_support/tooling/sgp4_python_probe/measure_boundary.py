import hashlib,json,time,platform,os
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
import isdc_sgp4_probe as probe
from sgp4.api import Satrec,WGS72,accelerated
ROOT=Path(__file__).resolve().parents[3]
TOOL=Path(__file__).resolve().parent
fixed=json.loads((TOOL.parent/'sgp4_benchmark/input.json').read_text())
line1,line2=fixed['line1'],fixed['line2']
parsed=Satrec.twoline2rv(line1,line2,WGS72); sat=Satrec()
sat.sgp4init(WGS72,'a',parsed.satnum,(parsed.jdsatepoch-2433281.5)+parsed.jdsatepochF,parsed.bstar,parsed.ndot,parsed.nddot,parsed.ecco,parsed.argpo,parsed.inclo,parsed.mo,parsed.no_kozai,parsed.nodeo)
assert accelerated
output=ROOT/'data/workspace/validation'/('pyo3_boundary_'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));output.mkdir(parents=True)
def stats(a):return {k:float(np.percentile(a,v)) for k,v in [('median_ms',50),('p95_ms',95),('p99_ms',99),('max_ms',100)]}
results=[]
for n in [1,1440,86400]:
    times=np.arange(n,dtype=float)*(1440/n); as_list=times.tolist()
    jd=np.full(n,parsed.jdsatepoch);fr=parsed.jdsatepochF+times/1440
    values,_=probe.propagate_batch(line1,line2,as_list)
    errors,r,v=sat.sgp4_array(jd,fr)
    assert np.all(errors==0)
    a=np.asarray(values);difference=float(np.linalg.norm(a[:,0]-r,axis=1).max())*1000
    assert difference<10
    del values,a
    for _ in range(3):
        probe.propagate_batch(line1,line2,as_list); sat.sgp4_array(jd,fr)
    wall=[];core=[];cpp=[];buffer_wall=[];buffer_core=[]
    def run_rust():
        t=time.perf_counter_ns();values,core_ms=probe.propagate_batch(line1,line2,as_list)
        wall.append((time.perf_counter_ns()-t)/1e6);core.append(core_ms)
        assert len(values)==n
        del values
    def run_cpp():
        t=time.perf_counter_ns();errors,r,v=sat.sgp4_array(jd,fr)
        cpp.append((time.perf_counter_ns()-t)/1e6)
        assert np.all(errors==0)
        del errors,r,v
    def run_buffer():
        t=time.perf_counter_ns();payload,count,core_ms=probe.propagate_batch_buffer(line1,line2,as_list)
        array=np.frombuffer(payload,dtype='<f8').reshape(count,2,3)
        buffer_wall.append((time.perf_counter_ns()-t)/1e6);buffer_core.append(core_ms)
        assert count==n and not array.flags.writeable
        del array,payload
    payload,count,_=probe.propagate_batch_buffer(line1,line2,as_list)
    buffer_values=np.frombuffer(payload,dtype='<f8').reshape(count,2,3)
    assert float(np.linalg.norm(buffer_values[:,0]-r,axis=1).max())*1000<10
    del buffer_values,payload
    for _ in range(3):probe.propagate_batch_buffer(line1,line2,as_list)
    for i in range(20):
        if i%2:run_cpp();run_buffer();run_rust()
        else:run_rust();run_buffer();run_cpp()
    results.append({'samples':n,'position_difference_m':difference,'rust_python_end_to_end':stats(wall),'rust_inside_compute':stats(core),'rust_boundary_and_setup_estimate':stats(np.asarray(wall)-core),'cpp_python_batch':stats(cpp),'rust_buffer_end_to_end':stats(buffer_wall),'rust_buffer_inside_compute':stats(buffer_core),'rust_buffer_boundary_and_setup_estimate':stats(np.asarray(buffer_wall)-buffer_core),'raw_ms':{'wall':wall,'core':core,'cpp':cpp,'buffer_wall':buffer_wall,'buffer_core':buffer_core}})
    print(json.dumps({k:v for k,v in results[-1].items() if k!='raw_ms'}))
wheel=TOOL/'wheels_repaired/isdc_sgp4_probe-0.1.0-cp314-cp314-win_amd64.whl'
report={'run_id':output.name,'python':platform.python_version(),'numpy':np.__version__,'cpp_accelerated':accelerated,'pyo3':'0.29.2','maturin':'1.15.0','rust':'1.98.1','sgp4_rust':'2.4.0','sgp4_cpp':'2.25','input':fixed,'mode':'WGS72 AFSPC','results':results,'wheel_sha256':hashlib.sha256(wheel.read_bytes()).hexdigest(),'limitations':['Rust list probe returns nested lists; buffer probe returns copied little-endian f64 bytes and read-only NumPy view; C++ returns NumPy arrays','Rust wrapper reparses TLE per call, C++ setup outside timed loop','wall-core includes argument extraction, parsing, boundary conversion and Python allocation; not pure FFI cost','Return object destruction excluded from timed calls; initial list/date array preparation excluded','No API/browser/frame conversion/pass timing','CPython3.14 win_amd64 only; no other Python ABI or clean PC validation'],'repeats':20,'warmup':3,'order':'alternating Rust-list/C++ first; buffer between','profile':'single threaded native compute; py.detach during Rust compute'}
(output/'report.json').write_text(json.dumps(report,indent=2))
print('REPORT',output/'report.json')
