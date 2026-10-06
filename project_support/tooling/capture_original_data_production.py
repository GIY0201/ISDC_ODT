"""Capture original accepted-equipment profiles and deterministic product output, offline."""
import ast
import hashlib
import json
import sys
import types
from collections import Counter
from pathlib import Path

EXPECTED = {'digital_twin/model_library/data_deployment.py':'5c20fa9dab7f0604a298970b004a196d4067077eff478c09f49d76395a6881b0','digital_twin/simulation/data_deployment.py':'f77e7426ef1f4cb5f285a7975b8a64d329cc02221ebbfa80efdf1b934d5d57df','digital_twin/simulation/data_products.py':'34abc837401a826810d8c23e007a1f6e933f129f8728c121388634d2f2d6e42a'}

def digest(products):
    return hashlib.sha256(json.dumps(products,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')).hexdigest()

def main(root,output):
    texts={}
    for path,sha in EXPECTED.items():
        raw=(Path(root)/path).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=sha:raise ValueError('source hash mismatch:'+path)
        texts[path]=raw.decode('utf-8').replace('\r\n','\n')
    semantic_hashes={}
    for path,text in texts.items():
        tree=ast.parse(text)
        if '/model_library/' in path:
            semantic_hashes['profile']=hashlib.sha256(ast.dump(tree,include_attributes=False).encode('utf-8')).hexdigest()
        else:
            for node in tree.body:
                if isinstance(node,ast.FunctionDef) and node.name in ['_fraction','products_between','deployment_inputs','deployment_products']:
                    semantic_hashes[node.name]=hashlib.sha256(ast.dump(node,include_attributes=False).encode('utf-8')).hexdigest()
    package=types.ModuleType('_captured_original_production');package.__path__=[];sys.modules[package.__name__]=package
    modules={}
    for name,path in [('profile','digital_twin/model_library/data_deployment.py'),('data_products','digital_twin/simulation/data_products.py'),('data_deployment','digital_twin/simulation/data_deployment.py')]:
        source=texts[path].replace('from digital_twin.model_library.data_deployment import ','from _captured_original_production.profile import ')
        mod=types.ModuleType(package.__name__+'.'+name);mod.__package__=package.__name__;sys.modules[mod.__name__]=mod;exec(compile(source,path,'exec'),mod.__dict__);modules[name]=mod
    def node(i='A',mode='nominal',storage=True,camera=True,enabled=True,stores=1):return {'id':i,'name':'  node '+i+'  ','mode':mode,'equipment':([{'id':'store'+str(j),'catalog':'dtn_store','enabled':enabled} for j in range(stores)] if storage else [])+([{'id':'camera','catalog':'eo_camera','enabled':True}] if camera else [])}
    cases=[]
    rows=[('empty',[],[]),('camera-only',[node(storage=False)],[]),('storage',[node(camera=False)],[]),('safe',[node(mode='safe')],[]),('disabled',[node(enabled=False)],[]),('multiple-store',[node(stores=2)],[]),('nominal',[node()],[])]
    for kind in ['power_drop','storage_pressure','thermal_spike','link_loss']:
        for level,active in [('high',True),('medium',True),('high',False)]:rows.append((kind+'-'+level+'-'+str(active),[node()],[{'target':'A','kind':kind,'severity':level,'active':active}]))
    rows.append(('mixed',[node('A'),node('B',camera=False),node('C',storage=False)],[]))
    module=modules['data_deployment']
    for name,nodes,faults in rows:
        deployment={'nodes':nodes};inputs=module.deployment_inputs(deployment,faults)
        cases.append({'name':name,'deployment':deployment,'faults':faults,'inputs':inputs,'queries':[{'from_s':a,'to_s':b,'products':module.deployment_products(inputs,a,b)} for a,b in [(0,100),(60,90),(100,100),(100,60),(89.5,90),(123.5,200)]]})
    long=[]
    for count in [1,240]:
        deployment={'nodes':[node(str(i)) for i in range(count)]};inputs=module.deployment_inputs(deployment,[]);products=module.deployment_products(inputs,0,14400)
        long.append({'count':count,'from_s':0,'to_s':14400,'deployment':deployment,'digest':digest(products),'products':len(products),'unique_refs':len({p['ref'] for p in products}),'classes':dict(Counter(p['class'] for p in products)),'max_created_s':max(p['created_s'] for p in products)})
    receipt={'source_commit':'1a1e00297a0301637455b0ef2cf48b2e74576b07','source_hashes':EXPECTED,'semantic_hashes':semantic_hashes,'harness':'Original pure source execution; representative SIM equipment/products, not bytes or actual hardware','cases':cases,'long':long}
    data=(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n').encode('utf-8');Path(output).write_bytes(data);print(json.dumps({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}))
if __name__=='__main__':main(*sys.argv[1:])
