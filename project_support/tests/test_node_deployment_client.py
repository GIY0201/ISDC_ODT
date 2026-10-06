"""Cross-language component evidence; IPC is not TCP/browser/8891 proof."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

from fastapi import FastAPI
from fastapi.testclient import TestClient

from communication.data_management_delivery import DataManagementBridge
from communication.http.data_deployment import router
from digital_twin.runtime.data_management.scopes import ScopedDataManagement
from user_application.bootstrap import create_runtime


def test_actual_js_client_store_to_asgi_runtime_module_ambiguous_retry_and_conflict():
    root=Path(__file__).resolve().parents[2]
    app=FastAPI();app.state.runtime=create_runtime()
    app.state.data_management=ScopedDataManagement()
    app.state.data_management_bridge=DataManagementBridge(now=lambda:'2026-10-06T00:00:00Z')
    app.include_router(router)
    posts=[];scope_ids=[];result=None
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=1) as reader:
        process=subprocess.Popen(['node',str(root/'project_support/tests/browser_fixtures/data_deployment_ipc.mjs')],
            cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        try:
            while True:
                line=reader.submit(process.stdout.readline).result(timeout=30)
                if not line:break
                message=json.loads(line)
                if message['kind']=='result':result=message;break
                assert message['url']=='/api/data-management/deployment'
                body=message['body'];drop=False
                if message['method']=='POST':
                    posts.append(body)
                    if body['deployment_id']=='DEP-2':
                        external=json.loads(json.dumps({**body,'deployment_id':'OTHER'}))
                        external['nodes'][0]['name']='other browser'
                        response=client.post(message['url'],json=external)
                        assert response.status_code==200
                        scope_ids.append(response.json()['scope_id'])
                    drop=len(posts)==1
                response=client.request(message['method'],message['url'],**({'json':body} if body is not None else {}))
                if response.status_code==200 and message['method']=='POST':scope_ids.append(response.json()['scope_id'])
                process.stdin.write(json.dumps({'status':response.status_code,'body':response.json(),'drop':drop},ensure_ascii=False)+'\n')
                process.stdin.flush()
            assert process.wait(timeout=10)==0,process.stderr.read()
            assert result and result['confirmed'] and result['draft']=='explicit reapply'
            assert result['server']==app.state.runtime.data_deployment()
            assert result['server']['revision']==4 and result['server']['nodes']==[]
            assert posts[0]==posts[1]
            assert [body['expected_revision'] for body in posts]==[0,0,1,2,3]
            assert [body['deployment_id'] for body in posts]==['DEP-1','DEP-1','DEP-2','DEP-3','DEP-4']
            assert len(set(scope_ids))==4
            assert all(app.state.data_management.for_scope(scope).objects()['total']==0 for scope in scope_ids)
        finally:
            if process.poll() is None:process.kill();process.wait(timeout=10)
            for stream in [process.stdin,process.stdout,process.stderr]:stream.close()
