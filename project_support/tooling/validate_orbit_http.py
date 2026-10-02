"""Bounded localhost HTTP check, starts and stops only its own server process."""
from pathlib import Path
import json,socket,subprocess,sys,time,urllib.request,urllib.error
root=Path(__file__).resolve().parents[2]
out=root/'data/workspace/validation/orbit_api';out.mkdir(parents=True,exist_ok=True)
with socket.socket() as probe:
    probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
base=f'http://127.0.0.1:{port}'

def request(path,method='GET',payload=None):
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(base+path,data=body,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=5) as response:return response.status,json.loads(response.read())

with (out/'live_server.log').open('w',encoding='utf-8') as log:
    process=subprocess.Popen([sys.executable,'-m','uvicorn','user_application.web.application:create_stored_orbit_app','--factory','--host','127.0.0.1','--port',str(port),'--log-level','warning'],cwd=root,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        deadline=time.monotonic()+10
        while True:
            if process.poll() is not None:raise RuntimeError('test server exited before ready; see live_server.log')
            try:status,listed=request('/api/orbit/inputs');break
            except (urllib.error.URLError,TimeoutError):
                if time.monotonic()>deadline:raise RuntimeError('test server did not become ready')
                time.sleep(.05)
        assert status==200 and len(listed['inputs'])==2
        record=next(item for item in listed['inputs'] if item['format']=='TLE')
        state=request('/api/orbit/state')[1];assert state['revision']==0
        payload=dict(client_request_id='live-selection',expected_revision=0,input_id=record['input_id'],ground_point={'latitude_deg':33.4996,'longitude_deg':126.5312,'ellipsoid_height_m':0},minimum_elevation_deg=10,anchor_utc=record['epoch_utc'],playing=False,play_rate=1)
        chosen=request('/api/orbit/selection','PUT',payload)[1];assert chosen['revision']==1
        data=request('/api/orbit/samples','POST',dict(client_request_id='live-samples',selection_revision=1,input_id=record['input_id'],start_utc=record['epoch_utc'],step_seconds=1,count=3))[1]
        assert data['status']=='complete' and len(data['rows'])==3 and data['frame']=='ITRF'
        assert request('/api/health')[0]==200
        report={'result':'pass','transport':'actual localhost TCP HTTP','inputs':2,'sample_rows':3,'revision':1,'input_hash':data['input_hash'],'eop_sha256':data['eop_sha256'],'leap_sha256':data['leap_sha256'],'communication_status':data['communication_status'],'ui_verified':False}
        (out/'live_http.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report))
    finally:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
