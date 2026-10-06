"""Execute hash-pinned original ICD-01 modules for bounded component comparison only."""
import hashlib
import ast
import importlib.util
import json
import sys
import types
from pathlib import Path

EXPECTED = {
    'catalog.py': 'eb3309a06806af2883634d23682d2629a2650e0ea7404fc35260afdada8c3bb6',
    'placement.py': '0a467d4899421e5536af1e70ce2010b6ed8ab9bb8e61cdf3ce891f41ab3d66d4',
    'policy.py': '28b5ceb61dc8f18827010e0efd227b418cd6975b42df75ff1c4fe407e00710c9',
    'scopes.py': 'ce67abc01395e0508145f4183c0677e892ae8fd86154acfddaf52987877f7984',
    'stand_in.py': '33acc26a02135549b2c0ef5f86c58227e6d3299f2d5af395097f68b12f6f3138',
}

def main(root, output):
    folder = Path(root) / 'operations_software/data_management'
    for name, sha in EXPECTED.items():
        if hashlib.sha256((folder / name).read_bytes()).hexdigest() != sha:
            raise ValueError('original source mismatch: ' + name)
    semantic_hashes = {}
    for name in EXPECTED:
        tree = ast.parse((folder / name).read_text(encoding='utf-8'))
        tree.body = [node for node in tree.body if not isinstance(node, (ast.Import, ast.ImportFrom))]
        semantic_hashes[name] = hashlib.sha256(ast.dump(tree, include_attributes=False).encode('utf-8')).hexdigest()
    package = types.ModuleType('_captured_original_dm')
    package.__path__ = [str(folder)]
    sys.modules[package.__name__] = package
    for name in ['policy', 'catalog', 'placement', 'stand_in', 'scopes']:
        spec = importlib.util.spec_from_file_location(package.__name__ + '.' + name, folder / (name + '.py'))
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
    state = sys.modules[package.__name__ + '.stand_in'].DataManagementStandIn()
    nodes = [dict(id=n, name=n, kind=k, capacity_gb=c, available=True) for n,k,c in [('S1','onboard',2),('C1','core',1000),('C2','core',500),('E1','edge',100)]]
    def clock(t, **extra): return dict(time='2026-10-06T00:00:00Z', sim_elapsed_s=t, **extra)
    def roster(t, down=False): return clock(t, nodes=[dict(n, available=False) if down and n['id']=='C2' else dict(n) for n in nodes])
    def product(ref, cls='imagery', size=500): return dict(ref=ref, **{'class':cls}, source='S1', size_mb=size, priority=1)
    commands = [('update_nodes',[roster(0)]), ('ingest',[clock(0, products=[product('img'),product('img'),product('tm','telemetry',10),product('tiny',size=.001)])]), ('update_nodes',[roster(60)]), ('request',[clock(61, object_id='OBJ-000001', destination='E1')]), ('request',[clock(62, object_id='missing', destination='E1')]), ('update_nodes',[roster(63,True)]), ('update_nodes',[roster(150,True)]), ('update_nodes',[roster(240,True)]), ('update_nodes',[roster(250)]), ('update_nodes',[roster(260)]), ('action',[clock(261,action='set_replication', **{'class':'imagery'}, replication=2)]), ('action',[clock(262,action='set_replication', **{'class':'imagery'}, replication=3)]), ('action',[clock(263,action='set_filter',filter={'min_size_mb':50,'accept_classes':['imagery']})]), ('ingest',[clock(264,products=[product('filtered','telemetry',10)])]), ('action',[clock(265,action='verify')]), ('action',[clock(266,action='heal')]), ('action',[clock(267,action='rebalance')]), ('action',[clock(268,action='purge_expired')]), ('update_nodes',[roster(5)])]
    trace=[]
    for method,args in commands:
        result=getattr(state,method)(*args)
        trace.append(dict(method=method,args=args,result=result,reports={name:getattr(state,name)() for name in ['overview','objects','nodes','events','status']}))
    scoped = sys.modules[package.__name__ + '.scopes'].ScopedDataManagement()
    a,b=scoped.for_scope('run:deployment:A'),scoped.for_scope('run:deployment:B')
    scope_trace=[]
    for scope,method,args in [('A','update_nodes',[roster(0)]),('A','ingest',[clock(0,products=[product('scope-image')])]),('B','nodes',[]),('B','update_nodes',[roster(0)]),('B','objects',[]),('A','update_nodes',[roster(60)]),('A','objects',[])]:
        obj=a if scope=='A' else b
        scope_trace.append(dict(scope=scope,method=method,args=args,result=getattr(obj,method)(*args)))
    receipt=dict(source_commit='1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes=EXPECTED,semantic_hashes=semantic_hashes,harness='Original module execution; deterministic stand-in component evidence, not storage/network/actual integrity proof',trace=trace,scope_trace=scope_trace)
    data=(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    Path(output).write_bytes(data)
    print(json.dumps(dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())))

if __name__ == '__main__': main(*sys.argv[1:])
