"""Accepted equipment and original deterministic SIM product calculation."""
from copy import deepcopy
from collections import Counter
import hashlib
import json
from pathlib import Path
import pytest
from digital_twin.simulation.data_deployment import deployment_inputs, deployment_products
from digital_twin.simulation.data_products import products_between
from digital_twin.runtime.data_management.scopes import ScopedDataManagement

GOLDEN=json.loads((Path(__file__).parent/'fixtures/original_data_production.json').read_text(encoding='utf-8'))

@pytest.mark.parametrize('case',GOLDEN['cases'],ids=lambda c:c['name'])
def test_original_equipment_and_interval_outputs(case):
    deployment,faults=deepcopy(case['deployment']),deepcopy(case['faults'])
    inputs=deployment_inputs(deployment,faults)
    assert inputs==case['inputs']
    for query in case['queries']:
        assert deployment_products(inputs,query['from_s'],query['to_s'])==query['products']
    assert deployment==case['deployment'] and faults==case['faults']

@pytest.mark.parametrize('case',GOLDEN['long'],ids=lambda c:str(c['count']))
def test_long_query_preserves_every_slot_for_all240_nodes(case):
    inputs=deployment_inputs(case['deployment'],[])
    products=deployment_products(inputs,case['from_s'],case['to_s'])
    digest=hashlib.sha256(json.dumps(products,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')).hexdigest()
    assert digest==case['digest']
    assert len(products)==case['products']==case['count']*640
    assert len({p['ref'] for p in products})==case['unique_refs']==len(products)
    assert dict(Counter(p['class'] for p in products))==case['classes']
    assert max(p['created_s'] for p in products)==14400
    for source in [case['deployment']['nodes'][0]['id'],case['deployment']['nodes'][-1]['id']]:
        assert {p['ref'] for p in products if p['source']==source}=={f'{source}:{cls}:{slot}' for cls,count in [('telemetry',480),('imagery',160)] for slot in range(1,count+1)}

def test_equipment_outputs_are_independent_and_never_include_fixed_ground_profiles():
    case=next(c for c in GOLDEN['cases'] if c['name']=='mixed')
    inputs=deployment_inputs(case['deployment'],[])
    inputs['production']['A'][0]['size_mb'][0]=999
    assert deployment_inputs(case['deployment'],[])==case['inputs']
    assert set(inputs['production'])=={'A','B'}
    assert 'DC-SEOUL' not in {n['id'] for n in inputs['nodes']}

def test_actual_scoped_module_ingests_only_generated_equipped_sources_and_deduplicates():
    case=next(c for c in GOLDEN['cases'] if c['name']=='mixed');inputs=deployment_inputs(case['deployment'],[])
    scope=ScopedDataManagement().for_scope('run:deployment:generated')
    scope.update_nodes({'sim_elapsed_s':0,'nodes':inputs['nodes']})
    products=deployment_products(inputs,0,100)
    accepted=scope.ingest({'sim_elapsed_s':100,'products':products})
    assert len(accepted['accepted'])==len(products)==7
    assert {p['source'] for p in scope.objects()['items']}=={'A','B'}
    retry=scope.ingest({'sim_elapsed_s':100,'products':products})
    assert not retry['accepted'] and all(p['reason']=='duplicate' for p in retry['rejected'])
    assert scope.objects()['total']==len(products)

@pytest.mark.parametrize('value',[float('inf'),float('-inf'),float('nan')])
def test_nonfinite_interval_rejected_even_when_comparison_would_skip_the_loop(value):
    # Equal invalid endpoints do not enter the original loop, so RED is bounded.
    with pytest.raises(ValueError):deployment_products({'production':{},'available':{}},value,value)
    with pytest.raises(ValueError):products_between({},value,value)

def test_finite_interval_that_cannot_advance_rejects_instead_of_looping_forever():
    with pytest.raises(ValueError,match='advance'):
        deployment_products({'production':{},'available':{}},1e20,1e20+16384)


@pytest.mark.parametrize('value',[True,None,'100',10**400])
def test_invalid_sim_seconds_are_not_implicitly_coerced(value):
    with pytest.raises(ValueError):deployment_products({'production':{},'available':{}},value,value)
    with pytest.raises(ValueError):products_between({},value,value)


def test_source_profile_and_product_calculations_preserved_except_declared_interval_guards():
    import ast
    root=Path(__file__).resolve().parents[2]
    for path in ['digital_twin/model_library/data_deployment.py','digital_twin/simulation/data_products.py','digital_twin/simulation/data_deployment.py']:
        text=(root/path).read_text(encoding='utf-8')
        text=text.replace('    validate_product_interval(from_s, to_s)\n','')
        text=text.replace('        if end <= begin:\n            raise ValueError("product interval cannot advance at this SIM time precision")\n','')
        tree=ast.parse(text)
        if '/model_library/' in path:
            assert hashlib.sha256(ast.dump(tree,include_attributes=False).encode('utf-8')).hexdigest()==GOLDEN['semantic_hashes']['profile']
        else:
            for node in tree.body:
                if isinstance(node,ast.FunctionDef) and node.name in GOLDEN['semantic_hashes']:
                    assert hashlib.sha256(ast.dump(node,include_attributes=False).encode('utf-8')).hexdigest()==GOLDEN['semantic_hashes'][node.name],node.name
