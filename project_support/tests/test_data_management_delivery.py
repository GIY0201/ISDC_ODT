"""Real stand-in delivery acceptance and isolated HTTP adapter fences."""
from copy import deepcopy
import httpx
import pytest
from communication.data_management_delivery import DataManagementBridge
from communication.external.data_management import RemoteDataManagement
from digital_twin.contracts.data_management import DataManagementUnavailable
from digital_twin.runtime.data_management.scopes import ScopedDataManagement
from digital_twin.simulation.data_deployment import deployment_inputs, deployment_products

NODE={'id':'A','name':'A','mode':'nominal','equipment':[{'id':'store','catalog':'dtn_store','enabled':True}]}
def context(elapsed=0,scope='run:deployment:A',started=0):
    deployment={'scope_id':scope,'nodes':[deepcopy(NODE)]}
    return {'deployment':deployment,'runtime':{'elapsed_seconds':elapsed},'started_s':started,'inputs':deployment_inputs(deployment,[]),'products':deployment_products}

def test_actual_module_receipt_cursor_and_copy_no_backfill():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'2026-10-06T00:00:00Z')
    scoped,receipt=bridge.sync(module,context(124.5,started=124.5))
    assert receipt['products']==0 and scoped.objects()['total']==0
    _,report=bridge.sync(module,context(200,started=124.5))
    assert report['products']==2 and scoped.objects()['total']==2
    report['ingest']['accepted'].clear()
    assert len(bridge.last_sync['ingest']['accepted'])==2
    assert bridge.sync(module,context(200,started=124.5))[1]['products']==0

def test_bad_roster_or_partial_ingest_does_not_publish_cursor_or_change_prior_scope():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context())
    original=deepcopy(bridge.last_sync)
    class Broken:
        def for_scope(self,scope):return self
        def status(self):return {'scope_id':'run:deployment:B','scope_contract':'isolated-v1','reachable':True}
        def update_nodes(self,message):return {'scope_id':'run:deployment:B','scope_contract':'isolated-v1','sequence':1,'sim_elapsed_s':0,'nodes':[]}
    with pytest.raises(DataManagementUnavailable):bridge.sync(Broken(),context(scope='run:deployment:B'))
    assert bridge.last_sync==original and bridge.last_scope=='run:deployment:A'
    class Partial:
        def for_scope(self,scope):return self
        def status(self):return module.for_scope('run:deployment:A').status()
        def update_nodes(self,message):return module.for_scope('run:deployment:A').update_nodes(message)
        def ingest(self,message):return {'scope_id':'run:deployment:A','scope_contract':'isolated-v1','sequence':1,'accepted':[],'rejected':[]}
    with pytest.raises(DataManagementUnavailable):bridge.sync(Partial(),context(100))
    assert bridge.last_elapsed==0
    assert bridge.sync(module,context(100))[1]['products']==3

def test_source_six_hour_clock_limit_catches_up_without_dropping_cursor():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context())
    _,report=bridge.sync(module,context(8*3600))
    assert report['products']==960 and module.for_scope('run:deployment:A').status()['sim_elapsed_s']==8*3600
    assert module.for_scope('run:deployment:A').objects()['total']==960

@pytest.mark.parametrize('response',[{'scope_contract':'isolated-v1','reachable':False}, {'reachable':True}, []])
def test_remote_incompatible_handshake_never_posts(response):
    calls=[]
    client=httpx.Client(base_url='http://module.test',transport=httpx.MockTransport(lambda req:(calls.append(req.method) or httpx.Response(200,json=response))))
    remote=RemoteDataManagement('http://module.test',client=client)
    with pytest.raises(DataManagementUnavailable):remote.for_scope('run:deployment:A')
    assert calls==['GET'];client.close()

def test_remote_scope_override_and_shared_client_ownership():
    calls=[]
    def handler(req):
        calls.append(req)
        if 'scope_id' not in req.url.params and req.method=='GET':return httpx.Response(200,json={'scope_contract':'isolated-v1','reachable':True})
        if req.method=='POST':
            import json
            assert json.loads(req.content)['scope_id']=='owned'
        return httpx.Response(200,json={'scope_id':'owned','scope_contract':'isolated-v1','reachable':True})
    client=httpx.Client(base_url='http://module.test',transport=httpx.MockTransport(handler));remote=RemoteDataManagement('http://module.test',client=client);scope=remote.for_scope('owned')
    scope.update_nodes({'scope_id':'foreign','nodes':[]});scope.close();assert not client.is_closed;remote.close();assert not client.is_closed;client.close()

@pytest.mark.parametrize('status,body',[(302,{'scope_contract':'isolated-v1','reachable':True}),(500,{}),(200,[]),(400,[])])
def test_remote_invalid_http_responses_are_typed(status,body):
    client=httpx.Client(base_url='http://module.test',transport=httpx.MockTransport(lambda req:httpx.Response(status,json=body)))
    remote=RemoteDataManagement('http://module.test',client=client)
    with pytest.raises((DataManagementUnavailable,ValueError)):remote.status()
    client.close()


def test_partial_second_batch_can_retry_real_module_without_duplicate_objects():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context())
    owner=module.for_scope('run:deployment:A')
    class Interrupted:
        calls=0
        def for_scope(self,scope):return self
        def status(self):return owner.status()
        def update_nodes(self,message):return owner.update_nodes(message)
        def ingest(self,message):
            self.calls+=1
            if self.calls==2:
                raise DataManagementUnavailable('interrupted second batch')
            return owner.ingest(message)
    # 20 hours yields 2400 products, so interruption follows 2000 actual writes.
    with pytest.raises(DataManagementUnavailable):bridge.sync(Interrupted(),context(72000))
    assert bridge.last_elapsed==0 and owner.objects()['total']==2000
    report=bridge.sync(module,context(72000))[1]
    assert report['products']==2400 and owner.objects()['total']==2400
    assert len(report['ingest']['accepted'])==400 and len(report['ingest']['rejected'])==2000


@pytest.mark.parametrize('mutation',[
    lambda r:r.update(scope_id='foreign'),
    lambda r:r.update(sequence=True),
    lambda r:r.update(sim_elapsed_s=float('nan')),
    lambda r:r['nodes'][0].update(capacity_gb=1),
    lambda r:r['nodes'].append(deepcopy(r['nodes'][0])),
])
def test_malformed_roster_receipts_preserve_delivery_cursor(mutation):
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context())
    owner=module.for_scope('run:deployment:A')
    class Malformed:
        def for_scope(self,scope):return self
        def status(self):return owner.status()
        def update_nodes(self,message):
            result=owner.update_nodes(message);mutation(result);return result
    with pytest.raises(DataManagementUnavailable):bridge.sync(Malformed(),context(100))
    assert bridge.last_elapsed==0


def test_source_millisecond_clock_receipt_and_stalled_catchup():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
    assert bridge.sync(module,context(124.56789,started=124.56789))[1]['products']==0
    owner=module.for_scope('run:deployment:A')
    class Stalled:
        def for_scope(self,scope):return self
        def status(self):return owner.status()
        def update_nodes(self,message):
            result=owner.update_nodes(message);result['sim_elapsed_s']=0;return result
    with pytest.raises(DataManagementUnavailable):bridge.sync(Stalled(),context(200,started=124.56789))
    assert bridge.last_elapsed==124.56789


def test_remote_owned_client_closes_and_bad_scope_never_sends():
    remote=RemoteDataManagement('http://module.test')
    with pytest.raises(ValueError):remote.for_scope('')
    remote.close();assert remote._client.is_closed


def test_malformed_product_ref_is_typed_and_preserves_cursor():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context())
    owner=module.for_scope('run:deployment:A')
    class Malformed:
        def for_scope(self,scope):return self
        def status(self):return owner.status()
        def update_nodes(self,message):return owner.update_nodes(message)
        def ingest(self,message):
            result=owner.ingest(message);result['accepted'][0]['ref']=[];return result
    with pytest.raises(DataManagementUnavailable):bridge.sync(Malformed(),context(100))
    assert bridge.last_elapsed==0


def test_backward_same_scope_rejected_before_module_write():
    module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t');bridge.sync(module,context());bridge.sync(module,context(100))
    before=module.for_scope('run:deployment:A').objects()
    with pytest.raises(ValueError):bridge.sync(module,context(50))
    assert module.for_scope('run:deployment:A').objects()==before
    assert module.for_scope('run:deployment:A').status()['sim_elapsed_s']==100


def test_original_adapter_full_wire_trace_preserved():
    import json
    from pathlib import Path
    from project_support.tooling.capture_original_data_delivery import trace
    expected=json.loads((Path(__file__).parent/'fixtures/original_data_delivery.json').read_text(encoding='utf-8'))
    assert trace(RemoteDataManagement)=={key:expected[key] for key in ('calls','results')}
