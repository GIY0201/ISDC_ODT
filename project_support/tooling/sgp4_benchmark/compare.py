"""Read-only numerical/benchmark comparison; not application runtime code."""
import hashlib,json,os,platform,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import sgp4
from sgp4.api import Satrec,WGS72,accelerated
ROOT=Path(__file__).resolve().parents[3]
TOOL=Path(__file__).resolve().parent
assert accelerated, 'A pure Python fallback cannot be used as C++ baseline'
input_path=TOOL/'input.json'; fixed=json.loads(input_path.read_text())
parsed=Satrec.twoline2rv(fixed['line1'],fixed['line2'],WGS72)
satellite=Satrec()
satellite.sgp4init(WGS72,'a',parsed.satnum,(parsed.jdsatepoch-2433281.5)+parsed.jdsatepochF,parsed.bstar,parsed.ndot,parsed.nddot,parsed.ecco,parsed.argpo,parsed.inclo,parsed.mo,parsed.no_kozai,parsed.nodeo)
assert satellite.operationmode=='a'
assert satellite.jdsatepoch==parsed.jdsatepoch and satellite.jdsatepochF==parsed.jdsatepochF
run_id='sgp4_comparison_'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
output=ROOT/'data/workspace/validation'/run_id; output.mkdir(parents=True)
binary=ROOT/'project_support/tooling/rust_env/target/release/isdc_sgp4_benchmark.exe'
def stats(values):
    return {label:float(np.percentile(values,pct)) for label,pct in [('median_ms',50),('p95_ms',95),('p99_ms',99),('max_ms',100)]}
results=[]
for n in [1440,86400]:
    rust_file=output/f'rust_{n}.json'
    start=time.perf_counter_ns()
    subprocess.run([str(binary),str(input_path),str(n),str(rust_file)],check=True)
    process_wall_ms=(time.perf_counter_ns()-start)/1e6
    rust=json.loads(rust_file.read_text())
    times=np.arange(n,dtype=np.float64)*(1440.0/n)
    jd=np.full(n,parsed.jdsatepoch); fr=parsed.jdsatepochF+times/1440.0
    for _ in range(3): satellite.sgp4_array(jd,fr)
    samples=[]
    for _ in range(20):
        start=time.perf_counter_ns(); e,r,v=satellite.sgp4_array(jd,fr)
        samples.append((time.perf_counter_ns()-start)/1e6)
        assert np.all(e==0), 'C++ propagation error'
    rust_rv=np.asarray(rust['predictions'],dtype=np.float64)
    position_m=np.linalg.norm(r-rust_rv[:,0,:],axis=1)*1000
    velocity_m_s=np.linalg.norm(v-rust_rv[:,1,:],axis=1)*1000
    assert np.isfinite(position_m).all()
    assert float(position_m.max())<=10.0, 'Numerical gate failed before speed comparison'
    scalar=[]
    for _ in range(5):
        start=time.perf_counter_ns()
        values=[satellite.sgp4(float(j),float(f)) for j,f in zip(jd,fr)]
        scalar.append((time.perf_counter_ns()-start)/1e6)
        assert all(value[0]==0 for value in values)
    result={'n':n,'max_position_difference_m':float(position_m.max()),'max_velocity_difference_m_s':float(velocity_m_s.max()),'rust_native_batch':stats(rust['samples_ms']),'cpp_python_batch':stats(samples),'cpp_python_scalar_loop':stats(scalar),'rust_process_wall_ms':process_wall_ms,'rust_process_wall_scope':'process launch +23 timed/warmup batches+final output batch+JSON file; not per-batch latency','raw_samples_ms':{'rust_native_batch':rust['samples_ms'],'cpp_python_batch':samples,'cpp_python_scalar_loop':scalar}}
    result['cpp_batch_over_rust_median_ratio']=result['cpp_python_batch']['median_ms']/result['rust_native_batch']['median_ms']
    results.append(result)
    np.savez(output/f'cpp_{n}.npz',times_minutes=times,position_km=r,velocity_km_s=v)
    print(json.dumps({k:v for k,v in result.items() if k!='raw_samples_ms'}))
files=[input_path,TOOL/'Cargo.lock',TOOL/'src/main.rs',Path(__file__),binary]
report={'run_id':run_id,'timestamp_utc':datetime.now(timezone.utc).isoformat(),'input':fixed,'mode':'WGS72 AFSPC, epoch to epoch+24h exclusive; TEME raw positions','environment':{'python':platform.python_version(),'platform':platform.platform(),'processor':os.environ.get('PROCESSOR_IDENTIFIER',platform.processor()),'sgp4_python':sgp4.__version__,'cpp_accelerated':accelerated,'numpy':np.__version__,'rust':'1.98.1','rust_sgp4':'2.4.0','rust_profile':'release LTO codegen-units1; default target CPU; single thread','msvc':'14.44.35207'},'sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files},'conditions':{'warmup_batches':3,'timed_batches':20,'scalar_repeats':5,'execution_order':'Rust process then C++ batch then C++ scalar, for each n; no process priority/CPU affinity changes','rust_scope':'native loop+Vec allocation, excludes FFI, parsing/JSON/process','cpp_batch_scope':'Python extension call+C++ loop+NumPy allocation, excludes parsing and time-array setup','scalar_scope':'Python loop+per-call conversion and output tuple allocation','limitations':['No Rust PyO3 wrapper or direct C++ standalone benchmark','No orbit-frame conversion/elevation/pass calculation/API/render/network','Historical fixed ISS test, not current orbit or observed truth','No controlled power plan or thermal state; modest repeat counts, no generalized language performance claim']},'results':results}
(output/'report.json').write_text(json.dumps(report,indent=2))
print('REPORT',str(output/'report.json'))
