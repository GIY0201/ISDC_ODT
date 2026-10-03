"""Reproducible actual native/EOP/geometry timing, separate from browser UX.

Run using the product venv; all inputs are explicit and hashes are checked.
One-second sampling and existing visibility refinement remain unchanged.
"""
import argparse
import cProfile
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys
import time
from datetime import datetime,timezone
from dataclasses import asdict

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
import numpy as np
import astropy_iers_data
from astropy.time import TimeDelta
from data.orbit_inputs import load_orbit_input
from data.earth_orientation import EarthOrientationSnapshot
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.simulation.visibility import search_visibility
from user_application.orbit_calculation import create_orbit_calculation


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--format',choices=('TLE','OMM'),default='TLE')
    parser.add_argument('--sha256',required=True)
    parser.add_argument('--rows',type=int,default=86401)
    parser.add_argument('--repeat',type=int,default=3)
    parser.add_argument('--visibility',action='store_true')
    parser.add_argument('--vector',action='store_true')
    parser.add_argument('--profile',action='store_true')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not 2<=args.rows<=86401 or not 1<=args.repeat<=10:
        parser.error('rows must be 2..86401 and repeat 1..10')
    eop_path=astropy_iers_data.IERS_B_FILE
    leap_path=astropy_iers_data.IERS_LEAP_SECOND_FILE
    eop=EarthOrientationSnapshot.load(eop_path,leap_path,
        eop_sha256=hashlib.sha256(Path(eop_path).read_bytes()).hexdigest(),
        leap_sha256=hashlib.sha256(Path(leap_path).read_bytes()).hexdigest())
    orbit=load_orbit_input(args.input,format=args.format,source='explicit benchmark input',
        fetched_utc=datetime.now(timezone.utc).isoformat(),expected_sha256=args.sha256)
    start=parse_utc(orbit.epoch_utc).as_time()
    utc=tuple(v+'Z' for v in (start+TimeDelta(np.arange(args.rows),format='sec',scale='tai')).utc.isot)
    ground=GroundPoint(33.4996,126.5312,0)
    calculate=create_orbit_calculation(eop)
    calculate(orbit,utc[:2],ground)  # warm native and explicit table only
    def run():
        if args.visibility:
            return search_visibility(calculate=lambda times:calculate(orbit,times,ground),
                calculate_times=(lambda times:calculate.evaluate_times(orbit,times,ground)) if args.vector else None,
                start_utc=utc[0],end_utc=utc[-1],minimum_elevation_deg=10.)
        return calculate(orbit,utc,ground)
    elapsed=[]
    for _ in range(args.repeat):
        t=time.perf_counter();result=run();elapsed.append(time.perf_counter()-t)
    metrics={
        'measured_utc':datetime.now(timezone.utc).isoformat(),
        'platform':platform.platform(),'python':sys.version,
        'packages':{name:importlib.metadata.version(name) for name in
            ('numpy','astropy','astropy-iers-data','isdc-orbit-propagation')},
        'input_hash':orbit.raw_sha256,'eop_hash':eop.eop_sha256,'leap_hash':eop.leap_sha256,
        'kind':'visibility' if args.visibility else 'orbit_calculation',
        'vector_evaluator':args.vector,
        'rows':args.rows,'grid_step_seconds':1,'start_utc':utc[0],'end_utc':utc[-1],
        'seconds':elapsed,'median_seconds':float(np.median(elapsed)),
        'p95_seconds':float(np.percentile(elapsed,95)),
        'p99_seconds':float(np.percentile(elapsed,99)),'max_seconds':max(elapsed),
        'one_second_goal_pass':max(elapsed)<=1.,
        'limitation':'small repeated local sample; excludes HTTP/browser/input/render latency and hardware portability',
    }
    if args.visibility:
        metrics.update(status=result.status,interval_count=len(result.intervals),
                       contact_count=len(result.contacts),error_count=len(result.errors),
                       intervals=[asdict(v) for v in result.intervals],
                       contacts=[asdict(v) for v in result.contacts])
    else:
        metrics.update(result_rows=len(result.rows),
                       error_rows=sum(r.error_code is not None for r in result.rows))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    if args.profile:
        profiler=cProfile.Profile();profiler.runcall(run)
        trace=args.output.with_suffix('.prof');profiler.dump_stats(str(trace))
        metrics['profile_path']=str(trace)
    args.output.write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    print(json.dumps(metrics,indent=2))


if __name__=='__main__':main()
