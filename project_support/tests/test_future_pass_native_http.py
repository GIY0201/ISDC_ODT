"""Fresh headerless full240 HTTP/native bundle -> actual JS readonly query owner.

No fake propagation, no workspace deployment/SIM/runtime approval, no live server.
"""
import copy
import importlib.metadata
import json
from pathlib import Path
import subprocess
import time

from fastapi.testclient import TestClient
from user_application.node_geometry import NodeGeometryQuery
from user_application.web.application import create_app


def test_headerless_full240_installed_native_bundle_reaches_future_owner_without_orbit_mutation():
    root=Path(__file__).resolve().parents[2]
    source=json.loads((Path(__file__).parent/'fixtures/native_mission_request.json').read_text(encoding='utf-8'))
    nodes=[]
    for index in range(240):
        node=copy.deepcopy(source['context']['nodes'][0])
        node.update(id=f'HTTP-N-{index:03}',name=f'Native {index}',catalog_number=910000+index)
        node['orbit'].update(raan=(index//20)*30,mean_anomaly=(index%20)*18)
        nodes.append(node)
    payload={'request_id':'fresh-http-native-future240','nodes':nodes,
             'sites':[{'station_id':'GS-NATIVE','ground_point':{'latitude_deg':36.3742,'longitude_deg':127.3567,'ellipsoid_height_m':70},'minimum_elevation_deg':10}],
             'start_utc':'2026-10-04T22:01:12.000000000Z','end_utc':'2026-10-05T01:01:12.000000000Z',
             'target':None,'external':None,'max_external_range_km':None}
    started=time.perf_counter()
    with TestClient(create_app(node_geometry_query=NodeGeometryQuery())) as client:
        before=client.get('/api/orbit/state').json();before.pop('observed_monotonic_s')
        reply=client.post('/api/nodes/mission-windows',json=payload)
        assert reply.status_code==200,reply.text
        bundle=reply.json()
        after=client.get('/api/orbit/state').json();after.pop('observed_monotonic_s')
        assert after==before
    assert 'accepted_context' not in bundle
    assert bundle['node_definitions']==nodes
    assert len(bundle['definition_hashes'])==240
    assert bundle['target_report'] is None and bundle['external_report'] is None
    probe=subprocess.run(['node',str(root/'project_support/tests/browser/future_pass_native_http_probe.mjs')],input=json.dumps({'query':payload,'bundle':bundle}),text=True,capture_output=True,cwd=root,timeout=60)
    assert probe.returncode==0,probe.stderr
    proof=json.loads(probe.stdout)
    assert proof['status']=='passed' and proof['full_nodes']==240 and proof['display_rows']==12
    print(json.dumps({'elapsed_seconds':round(time.perf_counter()-started,3),'native_distribution':importlib.metadata.version('isdc-orbit-propagation'),**proof}))
