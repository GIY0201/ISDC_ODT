"""Actual native HTTP -> JS raw owners -> guarded source module, no live server writes."""
import importlib.metadata
import json
from pathlib import Path
import queue
import subprocess
import threading
import time

from fastapi.testclient import TestClient
from user_application.web.application import create_app


def test_full240_actual_native_periodic_guarded_module_source_chain():
    root=Path(__file__).resolve().parents[2]
    process=subprocess.Popen(['node',str(root/'project_support/tests/browser_fixtures/periodic_native_module.mjs')],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
    messages=queue.Queue()
    def read_lines():
        for line in process.stdout:messages.put(line)
        messages.put(None)
    threading.Thread(target=read_lines,daemon=True).start()
    deadline=time.monotonic()+60
    requests=[]
    proof=None
    try:
        with TestClient(create_app()) as client:
            before=client.get('/api/data-management/deployment').json()
            while time.monotonic()<deadline:
                line=messages.get(timeout=max(.1,deadline-time.monotonic()))
                assert line is not None,'JS probe exited: '+process.stderr.read()
                message=json.loads(line)
                if message['type']=='done':proof=message['proof'];break
                assert message['type']=='http'
                path=message['path']
                assert path in ['/api/nodes/samples','/api/data-fabric/status','/api/data-fabric/network','/api/data-fabric/route']
                response=client.request(message['method'],path,headers=message['headers'],content=message['body'])
                requests.append({'path':path,'status':response.status_code})
                process.stdin.write(json.dumps({'id':message['id'],'status':response.status_code,'body':response.json()})+'\n');process.stdin.flush()
            assert proof is not None,'bounded actual pipeline did not finish'
            assert client.get('/api/data-management/deployment').json()==before
            assert client.get('/api/data-fabric/status').json()['sequence']==2
        assert process.wait(timeout=5)==0,process.stderr.read()
    finally:
        if process.poll() is None:process.kill();process.wait(timeout=5)
        for stream in [process.stdin,process.stdout,process.stderr]:stream.close()
    assert proof['status']=='passed' and proof['native_rows']==720 and proof['native_queries']==3
    assert proof['full_nodes']==241 and proof['sequence']==2 and proof['route_status']=='available'
    assert proof['exact_receipt_unavailable'] and proof['guarded_source_module'] and proof['registered_analytical_visual']
    assert all(request['status']==200 for request in requests)
    destination=root/'data/workspace/validation/periodic_actual_native_module.json'
    destination.write_text(json.dumps({'native_distribution':importlib.metadata.version('isdc-orbit-propagation'),'proof':proof,'requests':requests},indent=2),encoding='utf-8')
