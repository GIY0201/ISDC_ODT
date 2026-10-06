"""Product wheel installation, isolated from project imports and existing site packages."""
import base64
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def product_wheel():
    configured = os.environ.get("ISDC_ORBIT_INSTALL_WHEEL")
    if configured:
        return Path(configured).resolve()
    candidates = sorted((ROOT / "project_support/tooling/orbit_wheels").rglob("*.whl"),
                        key=lambda path: path.stat().st_mtime)
    assert candidates, "Build the product wheel before installation validation"
    return candidates[-1]


def test_product_wheel_tag_record_and_bundled_dll_license():
    with zipfile.ZipFile(product_wheel()) as archive:
        names = archive.namelist()
        wheel = next(name for name in names if name.endswith("/WHEEL"))
        assert b"Tag: cp314-cp314-win_amd64" in archive.read(wheel)
        record = next(name for name in names if name.endswith("/RECORD"))
        for name, digest, size in csv.reader(io.StringIO(archive.read(record).decode())):
            if not digest:
                assert name == record
                continue
            payload = archive.read(name)
            assert digest == "sha256=" + base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip("=")
            assert int(size) == len(payload)
        dlls = [name for name in names if name.lower().endswith(".dll")]
        assert dlls, "This CPython build requires the repaired libzlib dependency"
        assert all("/zlib-" in name for name in dlls), "Unreviewed bundled DLL"
        license_name = next((name for name in names if name.endswith("/licenses/libzlib_LICENSE.txt")), None)
        assert license_name, "Bundled libzlib must retain its license"
        assert b"Permission is granted" in archive.read(license_name)


def test_product_native_call_in_clean_venv(tmp_path):
    assert sys.version_info[:2] == (3, 14) and sys.platform == "win32"
    env_path = tmp_path / "isolated"
    subprocess.run([sys.executable, "-m", "venv", str(env_path)], check=True, timeout=60)
    python = env_path / "Scripts/python.exe"
    subprocess.run([str(python), "-m", "pip", "install", "--no-index", "--no-deps",
                    str(product_wheel())], check=True, capture_output=True, timeout=60)
    case = __import__("tomllib").loads((ROOT / "project_support/tests/fixtures/orbit/sgp4_test_cases.toml").read_text(encoding="utf-8"))["list"][0]
    expected = next(state for state in case["states"] if "position" in state)
    code = """
import json, pathlib, struct, sys
import isdc_orbit_propagation as native
case=json.loads(sys.argv[1]); sample=json.loads(sys.argv[2])
assert pathlib.Path(native.__file__).is_relative_to(pathlib.Path(sys.prefix))
assert sys.prefix != sys.base_prefix
assert native.calculation_profile == 'WGS72_AFSPC'
buffer, errors=native.propagate_tle(case['line1'], case['line2'], [sample['time']])
assert isinstance(buffer, bytes) and errors == [None]
row=struct.unpack('<6d', buffer)
assert all(abs(a-b)<=1e-6 for a,b in zip(row[:3],sample['position']))
assert all(abs(a-b)<=1e-9 for a,b in zip(row[3:],sample['velocity']))
try: native.propagate_tle('bad','bad',[0.])
except ValueError: pass
else: raise AssertionError('invalid TLE accepted')
assert native.__version__ == '0.3.0'
assert native.MAX_CATALOG_BATCH_ROWS == 50000 and native.MAX_BATCH_ROWS == 86401
assert native.propagate_omm_many([],[]) == (b'',[])
failed, errors = native.propagate_omm_many(['bad'],[0.])
assert errors == ['invalid OMM'] and all(__import__('math').isnan(v) for v in struct.unpack('<6d',failed))
try: native.propagate_omm_many(['bad'],[])
except ValueError: pass
else: raise AssertionError('unaligned catalog rows accepted')
official=__import__('tomllib').loads(pathlib.Path(sys.argv[5]).read_text(encoding='utf-8'))['list']
old_states=0
for official_case in official:
    states=official_case['states'];packed,errors=native.propagate_tle(official_case['line1'],official_case['line2'],[state['time'] for state in states])
    for index,state in enumerate(states):
        values=struct.unpack_from('<6d',packed,index*48)
        if 'error' in state:
            assert errors[index]==state['error'] and all(__import__('math').isnan(v) for v in values)
        else:
            assert errors[index] is None
            assert all(abs(a-b)<=1e-6 for a,b in zip(values[:3],state['position']))
            assert all(abs(a-b)<=1e-9 for a,b in zip(values[3:],state['velocity']))
        old_states+=1
assert len(official)==33 and old_states==668
omm={'NORAD_CAT_ID':25544,'OBJECT_NAME':'ISS','CLASSIFICATION_TYPE':'U','EPOCH':'2020-07-12T21:16:01.000416','MEAN_MOTION':15.49507896,'ECCENTRICITY':.0001413,'INCLINATION':51.6461,'RA_OF_ASC_NODE':221.2784,'ARG_OF_PERICENTER':89.1723,'MEAN_ANOMALY':280.4612,'BSTAR':-.000031515,'MEAN_MOTION_DOT':-.00002218,'MEAN_MOTION_DDOT':0,'ELEMENT_SET_NO':0,'REV_AT_EPOCH':0,'EPHEMERIS_TYPE':0}
omm_payload=json.dumps(omm);offsets=[-100.,0.,100.,-100.]
scalar,scalar_errors=native.propagate_omm(omm_payload,offsets)
many,many_errors=native.propagate_omm_many([omm_payload]*4,offsets)
assert scalar==many and scalar_errors==many_errors==[None]*4
assert native.node_calculation_profile == 'SOURCE_KEPLER_J2_V1'
assert native.node_frame == 'EARTH_FIXED_GMST_UTC_APPROX'
assert native.node_inertial_frame == 'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX'
assert native.node_time_model == 'unix_ms_utc_approx'
assert (native.NODE_ROW_WIDTH,native.MAX_NODE_DEFINITIONS,native.MAX_NODE_ROWS,native.MAX_NODE_SAMPLES)==(31,240,50000,601)
fixtures=[json.loads(pathlib.Path(path).read_text(encoding='utf-8')) for path in sys.argv[3:5]]
source_cases=[c for fixture in fixtures for c in fixture['cases'] if c['id'].startswith('state:')]
assert len(source_cases)==62
max_errors=[0.0]*31
for case in source_cases:
    orbit=case['input']['orbit'];time=case['input']['millis'];expected=case['expected']
    buffer,errors=native.propagate_nodes(json.dumps([orbit]),[0],[time])
    assert isinstance(buffer,bytes) and len(buffer)==248 and errors==[None]
    node_row=struct.unpack('<31d',buffer)
    reference=[]
    for path in [('inertial','r'),('inertial','v'),('fixed','r'),('sunDirection',),('basis','x'),('basis','y'),('basis','z')]:
        values=expected
        for key in path:values=values[key]
        reference.extend(values)
    reference.extend(expected[key] for key in ['radius','meanAnomaly','trueAnomaly','raan','argp','gmst'])
    reference.append(float(expected['sunlit']))
    reference.extend(expected['geodetic'][key] for key in ['longitude','latitude','altitude'])
    for column,(actual,wanted) in enumerate(zip(node_row,reference)):
        delta=abs(actual-wanted);max_errors[column]=max(max_errors[column],delta)
        assert delta <= (1e-10 if 3<=column<=5 or 9<=column<=20 else 1e-7), (case['id'],column,delta)
orbit=source_cases[0]['input']['orbit'];epoch=orbit['epoch'];bad=dict(orbit,eccentricity=0.95)
owned,errors=native.propagate_nodes(json.dumps([orbit,bad]),[0,1,0],[epoch]*3)
assert errors==[None,'invalid_node_orbit',None] and owned[:248]==owned[496:]
assert all(__import__('math').isnan(v) for v in struct.unpack('<31d',owned[248:496]))
other,errors=native.propagate_nodes(json.dumps([orbit]),[0],[epoch+1000])
assert owned[:248]!=other
assert native.propagate_nodes(json.dumps([orbit]),[0],[epoch])[0]==owned[:248]
for definitions,indices,times in [('bad',[0],[epoch]),('[]',[],[]),(json.dumps([orbit]),[1],[epoch]),(json.dumps([orbit]),[0],[]),(json.dumps([orbit]*241),[0],[epoch]),(json.dumps([orbit]),[0]*602,[epoch]*602),(json.dumps([orbit]),[0],[float('nan')]),(json.dumps([orbit]),[0]*50001,[epoch]*50001)]:
    try:native.propagate_nodes(definitions,indices,times)
    except (ValueError,OverflowError):pass
    else:raise AssertionError('invalid node batch accepted')
boundary,errors=native.propagate_nodes(json.dumps([orbit]*84),[i//601 for i in range(50000)],[epoch]*50000)
assert len(boundary)==50000*248 and errors==[None]*50000
_,errors=native.propagate_nodes(json.dumps([orbit]*240),list(range(240)),[epoch]*240)
assert errors==[None]*240
_,errors=native.propagate_nodes(json.dumps([orbit]),[0],[8.64e15+1])
assert errors==['unsupported_node_time']
optical=__import__('gzip').decompress(pathlib.Path(sys.argv[6]).read_bytes())
optical=json.loads(optical)
prime=next(case for case in optical['cases'] if case['id']=='dense-two-plane:0')
native_points=[]
for step in prime['rows']:
    inputs=step['input'];nodes=inputs['nodes'];at=inputs['date']
    packed,errors=native.propagate_nodes(json.dumps([node['orbit'] for node in nodes]),list(range(len(nodes))),[at]*len(nodes))
    assert errors==[None]*len(nodes)
    native_points.append({'date':at,'nodes':nodes,'packed':__import__('base64').b64encode(packed).decode(),'errors':errors})
node_metadata={key:getattr(native,key) for key in ['node_calculation_profile','node_frame','node_inertial_frame','node_time_model','NODE_ROW_WIDTH','MAX_NODE_DEFINITIONS','MAX_NODE_ROWS','MAX_NODE_SAMPLES']}
print(json.dumps({'python':sys.version,'native_file':native.__file__,'profile':native.calculation_profile,'row':row,'version':native.__version__,'catalog_export':True,'official_states':old_states,'omm_scalar_batch':True,'node_cases':len(source_cases),'node_max_error':max_errors,'node_boundary_rows':50000,'node_profile':native.node_calculation_profile,'native_points':native_points,'node_metadata':node_metadata}))
"""
    tle = {key: case[key] for key in ("line1", "line2")}
    sample = {key: expected[key] for key in ("time", "position", "velocity")}
    result = subprocess.run([str(python), "-I", "-c", code, json.dumps(tle), json.dumps(sample),
        str(ROOT / "project_support/tests/fixtures/original_satellite_nodes.json"),
        str(ROOT / "project_support/tests/fixtures/original_node_native_offsets.json"),
        str(ROOT / "project_support/tests/fixtures/orbit/sgp4_test_cases.toml"),
        str(ROOT / "project_support/tests/fixtures/original_node_link_resolution.json.gz")],
                            cwd=tmp_path, check=True, capture_output=True, text=True, timeout=30)
    receipt = json.loads(result.stdout)
    assert receipt["profile"] == "WGS72_AFSPC"
    receipt["wheel"] = str(product_wheel())
    receipt["wheel_sha256"] = hashlib.sha256(product_wheel().read_bytes()).hexdigest()
    # Preserve actual clean-venv Rust bytes through the production adapter/query and JS decoder.
    from fastapi.testclient import TestClient
    from communication.native.node_adapter import propagate_node_grids
    from user_application.web.application import create_app
    from foundation.orbit_time import parse_utc, format_utc_batch
    class NativePointPort:
        def __init__(self, point):
            self.point = point
            for key, value in receipt['node_metadata'].items():
                setattr(self, key, value)
        def propagate_nodes(self, definitions, indices, times):
            assert json.loads(definitions) == [node['orbit'] for node in self.point['nodes']]
            assert indices == list(range(len(self.point['nodes'])))
            assert times == [self.point['date']] * len(indices)
            return base64.b64decode(self.point['packed']), self.point['errors'][:]
    wire = []
    for point in receipt.pop('native_points'):
        port = NativePointPort(point)
        app = create_app()
        query = app.state.node_geometry_query
        assert query.execute.__self__ is app.state.orbit_executor
        query.calculate = lambda prepared, grids: propagate_node_grids(prepared, grids, native_port=port)
        stamp = __import__('datetime').datetime.fromtimestamp(point['date']/1000, __import__('datetime').timezone.utc).isoformat()
        utc = format_utc_batch((parse_utc(stamp),))[0]
        request = {'request_id':'native-prime','nodes':point['nodes'],'start_utc':utc,'count':1,'step_seconds':1}
        with TestClient(app) as client:
            assert client.post('/api/runtime/control', json={'action':'pause'}).status_code == 200
            before = app.state.runtime.status()
            response = client.post('/api/nodes/samples', json=request)
            assert response.status_code == 200, response.text
            response = response.json()
            assert app.state.runtime.status() == before
            assert client.get('/api/data-management/deployment').json()['revision'] == 0
            assert app.state.data_management._scopes == {}
        wire.append({'request':request,'response':response})
    payload = tmp_path/'native_optical_points.json'
    payload.write_text(json.dumps(wire),encoding='utf-8')
    optical_result = subprocess.run(['node',str(ROOT/'project_support/tests/browser_fixtures/native_optical_points.mjs'),str(payload)],cwd=ROOT,check=True,capture_output=True,text=True,timeout=30)
    receipt['native_optical_points'] = json.loads(optical_result.stdout)
    receipt['native_application_requests'] = len(wire)
    destination = ROOT / "data/workspace/validation/install" / uuid.uuid4().hex
    destination.mkdir(parents=True)
    (destination / "isolated_call.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")


def test_additive_package_metadata_versions_agree():
    import tomllib
    folder=ROOT/'digital_twin/simulation/orbit_propagation'
    cargo=tomllib.loads((folder/'Cargo.toml').read_text(encoding='utf-8'))
    package=tomllib.loads((folder/'pyproject.toml').read_text(encoding='utf-8'))
    lock=tomllib.loads((folder/'Cargo.lock').read_text(encoding='utf-8'))
    entry=next(p for p in lock['package'] if p['name']=='isdc_orbit_propagation')
    assert cargo['package']['version']==package['project']['version']==entry['version']=='0.3.0'
