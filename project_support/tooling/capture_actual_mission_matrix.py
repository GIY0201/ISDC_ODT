"""Actual create_app/native + original migrated JS scenario capture, no TCP listener."""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
import threading
import time
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from user_application.node_geometry import NodeGeometryQuery
from foundation.orbit_time import parse_utc_batch

def main():
    output = ROOT / 'data/workspace/validation' / ('t081_five_kind_actual_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    records = []
    point_metrics = {'calls': 0, 'rows': 0, 'seconds': 0.0}
    original_points = NodeGeometryQuery.points
    async def diagnostic_points(self, nodes, utc, request_id):
        began = time.monotonic()
        point_metrics['calls'] += 1
        point_metrics['rows'] += len(nodes)*len(utc)
        try:
            return await original_points(self, nodes, utc, request_id)
        except ValueError as error:
            grid = parse_utc_batch(utc)
            violations = [{'index': i, 'left': utc[i], 'right': utc[i+1], 'delta_days': (b.jd1-a.jd1)+(b.jd2-a.jd2)} for i,(a,b) in enumerate(zip(grid,grid[1:])) if (b.jd1-a.jd1)+(b.jd2-a.jd2)<=0]
            records.append({'kind': 'native_points_red', 'request_id': request_id, 'node_ids': [n['id'] for n in nodes], 'count': len(utc), 'violations': violations, 'error': str(error)})
            raise
        finally:
            point_metrics['seconds'] += time.monotonic()-began
    NodeGeometryQuery.points = diagnostic_points
    flags = []
    process = subprocess.Popen(['node', '--import', (ROOT / 'project_support/tests/browser/scenario_static_capture_hooks.mjs').as_uri(), str(ROOT / 'project_support/tests/browser/mission_kind_actual_capture.mjs'), *flags], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
    watchdog = threading.Timer(300, process.kill)
    watchdog.start()
    try:
        # Fixed historical fixture wall date only; installed native/EOP/planner remain actual.
        import hashlib, astropy_iers_data as files
        from data.earth_orientation import EarthOrientationSnapshot
        from user_application.catalog_geometry import CatalogGeometryQuery
        from user_application.orbit_calculation import create_orbit_calculation
        import digital_twin.runtime.state as runtime_module
        sys.path.insert(0, str(ROOT / 'project_support/tests'))
        from test_catalog_position import OMM
        class HistoricalDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                value=cls(2020,7,12,21,16,1,tzinfo=timezone.utc)
                return value.astimezone(tz) if tz else value.replace(tzinfo=None)
        class HistoricalCatalog:
            def catalog_groups(self):return [{'id':'active'}]
            async def get_satellites(self, **kwargs):
                return {'source':'celestrak-cache','fetched_at':'2020-07-12T21:16:01Z','items':[dict(OMM)]}
        async def execute(work):return work()
        a=Path(files.IERS_A_FILE);leap=Path(files.IERS_LEAP_SECOND_FILE)
        eop=EarthOrientationSnapshot.load(a,leap,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),leap_sha256=hashlib.sha256(leap.read_bytes()).hexdigest(),table_kind='IERS_A')
        catalog_query=CatalogGeometryQuery(HistoricalCatalog(),eop,create_orbit_calculation(eop),execute)
        original_datetime=runtime_module.datetime
        runtime_module.datetime=HistoricalDateTime
        records.append({'kind':'fixture_provenance','historical':True,'wall_date':'2020-07-12T21:16:01Z','native_version':__import__('isdc_orbit_propagation').__version__,'iss_omm':OMM,'eop_sha256':eop.eop_sha256,'leap_sha256':eop.leap_sha256,'watchdog_seconds':300})
        with TestClient(create_app(catalog_geometry_query=catalog_query)) as client:
            for line in process.stdout:
                value = json.loads(line)
                if value['kind'] == 'request':
                    print(f"REQUEST {value['id']} {value['method']} {value['path']}", flush=True)
                    began = time.monotonic()
                    response = client.request(value['method'], value['path'], headers=value['headers'], json=value['body'])
                    try: body = response.json()
                    except ValueError: body = response.text
                    records.append({'request': value, 'status': response.status_code, 'response': body, 'seconds': time.monotonic()-began})
                    print(f"RESPONSE {value['id']} {response.status_code} {time.monotonic()-began:.3f}s", flush=True)
                    process.stdin.write(json.dumps({'id': value['id'], 'status': response.status_code, 'headers': dict(response.headers), 'body': body}, ensure_ascii=False) + '\n')
                    process.stdin.flush()
                else:
                    records.append(value)
                    print(json.dumps({key: value.get(key) for key in ('kind','stage','success','error','node_count','next')}, ensure_ascii=False), flush=True)
            process.wait(timeout=15)
    finally:
        watchdog.cancel()
        NodeGeometryQuery.points = original_points
        if "original_datetime" in locals():runtime_module.datetime=original_datetime
        if process.poll() is None: process.kill()
        output.write_text(json.dumps({'records': records, 'point_metrics': point_metrics, 'stderr': process.stderr.read(), 'returncode': process.returncode}, ensure_ascii=False, indent=2), encoding='utf-8')
        print('EVIDENCE ' + str(output), flush=True)
    return process.returncode or 0

if __name__ == '__main__':
    raise SystemExit(main())
