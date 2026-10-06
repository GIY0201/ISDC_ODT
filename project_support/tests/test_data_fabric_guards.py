from copy import deepcopy
import pytest
from digital_twin.runtime.data_fabric.exchange import DataFabricExchange
from foundation.data_fabric_errors import DataFabricConflict
from project_support.tests.test_data_fabric_source import snapshot


def send(module,command='window_A:1',seq=0,body=None):
    return module.guarded_update(body or snapshot(),command,seq,module.status()['instance_id'])


def test_lost_reply_retry_returns_same_receipt_without_advancing_dtn():
    module=DataFabricExchange();first=send(module)
    assert send(module)==first
    first['nodes'][0]['id']='mutated'
    assert send(module)['nodes'][0]['id']=='S1'
    assert module.status()['sequence']==1
    changed=snapshot();changed['nodes'][0]['generation_mbps']=0.4
    with pytest.raises(DataFabricConflict):send(module,body=changed)
    assert module.status()['sequence']==1


def test_other_window_or_newer_command_invalidates_old_retry_and_route():
    module=DataFabricExchange();first=send(module);instance=module.status()['instance_id']
    second=send(module,'window_B:1',1,snapshot('2026-09-07T12:00:10Z'))
    with pytest.raises(DataFabricConflict):send(module)
    with pytest.raises(DataFabricConflict):module.guarded_route('S1','G1','latency',first['sequence'],instance)
    route=module.guarded_route('S1','G1','latency',second['sequence'],instance)
    assert route['path']==['S1','S2','S3','G1'] and route['network_hash']==second['network_hash']
    send(module,'window_A:2',2)
    with pytest.raises(DataFabricConflict):send(module)
    assert module.status()['sequence']==3


def test_instance_stale_sequence_and_client_capacity_never_mutate_state():
    module=DataFabricExchange(max_clients=2);initial=module.status()
    with pytest.raises(DataFabricConflict):module.guarded_update(snapshot(),'window_A:1',0,'old_instance')
    assert module.status()==initial
    send(module);send(module,'window_B:1',1);before=module.status()
    with pytest.raises(DataFabricConflict):send(module,'window_C:1',2)
    with pytest.raises(DataFabricConflict):send(module,'window_A:2',0)
    assert module.status()==before
    assert send(module,'window_A:2',2)['sequence']==3


@pytest.mark.parametrize('command',['window_A:0','window_A:-1','no_counter','window_A:1.5','window_A:9007199254740992'])
def test_malformed_command_id_is_rejected_before_source_update(command):
    module=DataFabricExchange();before=module.status()
    with pytest.raises(ValueError):send(module,command)
    assert module.status()==before

from fastapi.testclient import TestClient
from user_application.web.application import create_app
import httpx


def headers(status,command='window_A:1',sequence=None):
    return {'X-ISDC-Fabric-Instance':status['instance_id'],
            'X-ISDC-Fabric-Sequence':str(status['sequence'] if sequence is None else sequence),
            'X-ISDC-Fabric-Request-Id':command}


def test_http_guarded_retry_route_conflict_and_partial_headers():
    with TestClient(create_app()) as client:
        status=client.get('/api/data-fabric/status').json();h=headers(status)
        first=client.post('/api/data-fabric/network',json=snapshot(),headers=h)
        assert first.status_code==200 and first.json()['request_id']=='window_A:1'
        assert client.post('/api/data-fabric/network',json=snapshot(),headers=h).json()==first.json()
        assert client.get('/api/data-fabric/status').json()['sequence']==1
        h2=headers(status,'window_B:1',1)
        assert client.post('/api/data-fabric/network',json=snapshot('2026-09-07T12:01:00Z'),headers=h2).status_code==200
        route_headers={'X-ISDC-Fabric-Instance':status['instance_id'],'X-ISDC-Fabric-Sequence':'1'}
        assert client.post('/api/data-fabric/route',json={'source':'S1','target':'G1'},headers=route_headers).status_code==409
        assert client.post('/api/data-fabric/network',json=snapshot(),headers={'X-ISDC-Fabric-Request-Id':'window_A:3'}).status_code==400
        assert client.get('/api/data-fabric/status').json()['sequence']==2


def test_remote_guard_forwarding_and_legacy_capability_do_not_fallback():
    from communication.external.data_fabric import RemoteDataFabric
    with TestClient(create_app()) as remote_server:
        transport=httpx.MockTransport(lambda r:remote_server.request(r.method,r.url.path,content=r.content,headers=dict(r.headers)))
        remote=RemoteDataFabric('http://fabric.example',client=httpx.Client(base_url='http://fabric.example',transport=transport))
        with TestClient(create_app(data_fabric=remote)) as local:
            status=local.get('/api/data-fabric/status').json();h=headers(status)
            first=local.post('/api/data-fabric/network',json=snapshot(),headers=h)
            assert first.status_code==200 and first.json()['request_id']=='window_A:1'
            assert local.post('/api/data-fabric/network',json=snapshot(),headers=h).json()==first.json()
            assert remote_server.get('/api/data-fabric/status').json()['sequence']==1
    requests=[]
    def unsupported(request):
        requests.append(request.method)
        return httpx.Response(200,json={'module':'data_fabric','reachable':True,'sequence':0})
    remote=RemoteDataFabric('http://old.example',client=httpx.Client(base_url='http://old.example',transport=httpx.MockTransport(unsupported)))
    with TestClient(create_app(data_fabric=remote)) as local:
        response=local.post('/api/data-fabric/network',json=snapshot(),headers={'X-ISDC-Fabric-Instance':'unknown','X-ISDC-Fabric-Sequence':'0','X-ISDC-Fabric-Request-Id':'window_A:1'})
        assert response.status_code==503 and requests==['GET']

@pytest.mark.parametrize('sequence',[-1,False,'0',None])
def test_even_accepted_retry_requires_well_formed_sequence(sequence):
    module=DataFabricExchange();send(module);before=module.status()
    with pytest.raises(ValueError):send(module,seq=sequence)
    assert module.status()==before


def test_remote_unreachable_capable_status_blocks_guarded_send():
    from communication.external.data_fabric import RemoteDataFabric
    requests=[]
    def unreachable(request):
        requests.append(request.method)
        return httpx.Response(200,json={'exchange_contract':'guarded-v1','instance_id':'test','sequence':0,'reachable':False})
    remote=RemoteDataFabric('http://fabric.example',client=httpx.Client(base_url='http://fabric.example',transport=httpx.MockTransport(unreachable)))
    from foundation.data_fabric_errors import DataFabricUnavailable
    with pytest.raises(DataFabricUnavailable):remote.guarded_update(snapshot(),'window_A:1',0,'test')
    assert requests==['GET'] and remote.status()['reachable'] is False

from concurrent.futures import ThreadPoolExecutor


def test_parallel_same_command_has_one_source_commit():
    module=DataFabricExchange()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:send(module),range(24)))
    assert all(result==results[0] for result in results)
    assert module.status()['sequence']==1


def test_parallel_different_windows_cannot_replace_unobserved_network():
    module=DataFabricExchange()
    def attempt(index):
        try:return send(module,f'window_{index}:1')
        except DataFabricConflict:return None
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(attempt,range(24)))
    assert sum(result is not None for result in results)==1
    assert module.status()['sequence']==1
