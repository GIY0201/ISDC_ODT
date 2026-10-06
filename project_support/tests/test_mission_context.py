from copy import deepcopy
import json
from pathlib import Path
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from project_support.tests.test_native_mission_passes import query
from digital_twin.runtime.mission_planning.exchange import MissionPlanningExchange

NATIVE=json.loads((Path(__file__).parent/'fixtures/native_mission_request.json').read_text())

def setup():
 app=create_app(node_geometry_query=query(lambda t:70))
 # Keep native full definitions from the real source model fixture, inject only test geometry.
 runtime=app.state.runtime;nodes=deepcopy(NATIVE['context']['nodes'])
 roster=[{k:n[k] for k in ('id','name','mode')}|{'equipment':[{k:i[k] for k in ('id','catalog','enabled')} for i in n['equipment']]} for n in nodes]
 runtime._data_deployment={'deployment_id':'accepted','revision':1,'nodes':roster}
 module=getattr(app.state,'orchestration',MissionPlanningExchange())
 command={'request_id':'context','nodes':nodes,'run_id':runtime.run_id,'deployment_revision':1,'utc':NATIVE['context']['utc'],'stations':deepcopy(NATIVE['context']['stations']),'faults':[],'module_instance':module.status()['instance_id'],'module_sequence':0,'external':None}
 return app,command

def test_real_factory_accepts_native_full_scope_and_preserves_orbit_selection():
 app,command=setup()
 with TestClient(app) as c:
  before=c.get('/api/orbit/state').json();r=c.post('/api/nodes/mission-context',json=command);assert r.status_code==200,r.text
  receipt=r.json();assert receipt['status']=='verified_analysis_inputs' and len(receipt['context_hash'])==64
  assert receipt['nodes']==command['nodes'] and receipt['stations']==command['stations']
  assert c.get('/api/nodes/mission-context').json()['context']==receipt
  after=c.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert before==after
  receipt['nodes'].clear();assert c.get('/api/nodes/mission-context').json()['context']['nodes']

def test_scope_changes_and_bad_full_inputs_never_approve():
 for change,expected in [('revision',409),('run',409),('roster',409),('fault',409),('module',409),('power',422),('station',422)]:
  app,command=setup()
  if change=='revision':command['deployment_revision']=2
  if change=='run':command['run_id']='other'
  if change=='roster':command['nodes'][0]['name']='other'
  if change=='fault':command['faults']=[{'kind':'link_loss','target':'GS'}]
  if change=='module':command['module_instance']='other'
  if change=='power':command['nodes'][0]['power']['battery_wh']=-1
  if change=='station':del command['stations'][0]['latitude']
  with TestClient(app) as c:
   r=c.post('/api/nodes/mission-context',json=command);assert r.status_code==expected,(change,r.text)
   assert c.get('/api/nodes/mission-context').json()['context'] is None

def test_runtime_roster_and_fault_changes_revoke_accepted_context():
 app,command=setup()
 with TestClient(app) as c:
  assert c.post('/api/nodes/mission-context',json=command).status_code==200
  app.state.runtime._data_deployment['revision']=2
  assert c.get('/api/nodes/mission-context').json()['context'] is None


def test_production_guarded_plan_requires_current_native_acceptance_and_abort_can_release_after_roster_drift():
 app,command=setup()
 from project_support.tests.test_mission_planning_exchange import message
 with TestClient(app) as c:
  body_plan=message();body_plan['time']=command['utc'];body_plan['satellites']=[{'id':n['id'],'name':n['name'],'mode':n['mode'],'power':n['power'],'formation':None,'capabilities':{'camera':True,'compute_mbps':200,'storage_free_mb':4000,'oisl':True,'rf_bands':['S']},'busy':[]} for n in command['nodes']];body_plan['stations']=[{k:s[k] for k in ('id','name','bands')} for s in command['stations']]
  # Keep the source route/guard lifecycle fixture consistent with approved node/time scope.
  body_plan['mission']['window_start']=command['utc'];body_plan['mission']['deadline']='2020-07-13T03:16:01.000416000Z';body_plan['windows']={}
  status=c.get('/api/orchestration/status').json()
  headers={'X-ISDC-Orchestration-Instance':status['instance_id'],'X-ISDC-Orchestration-Sequence':'0','X-ISDC-Orchestration-Request-Id':'context-client:1','X-ISDC-Orchestration-Context':'a'*64,'X-ISDC-Orchestration-Mission-Version':'1'}
  assert c.post('/api/orchestration/plan',json=body_plan,headers=headers).status_code==409
  accepted=c.post('/api/nodes/mission-context',json=command).json();headers['X-ISDC-Orchestration-Context']=accepted['context_hash']
  p=c.post('/api/orchestration/plan',json=body_plan,headers=headers);assert p.status_code==200,p.text
  plan=p.json();body={'time':plan['time'],'mission_id':plan['mission_id'],'decision':'commit','version':1,'tasks':plan['tasks']}
  headers.pop('X-ISDC-Orchestration-Mission-Version');headers['X-ISDC-Orchestration-Plan-Sequence']=str(plan['plan_sequence']);headers['X-ISDC-Orchestration-Sequence']='1';headers['X-ISDC-Orchestration-Request-Id']='context-client:2'
  app.state.runtime._data_deployment['revision']=2
  assert c.post('/api/orchestration/commit',json=body,headers=headers).status_code==409
  body['decision']='abort';body['tasks']=[]
  assert c.post('/api/orchestration/commit',json=body,headers=headers).status_code==200


def window_command(command):
 return {'request_id':'approved-windows','nodes':command['nodes'],'sites':[{'station_id':s['id'],'ground_point':{'latitude_deg':s['latitude'],'longitude_deg':s['longitude'],'ellipsoid_height_m':s.get('altitude_km',0)*1000},'minimum_elevation_deg':s.get('min_elevation_deg',0)} for s in command['stations']], 'start_utc':command['utc'],'end_utc':'2020-07-12T21:18:01.000416000Z'}


def test_approved_batch_binds_full_scope_and_fences_late_roster_change():
 app,command=setup()
 with TestClient(app) as c:
  receipt=c.post('/api/nodes/mission-context',json=command).json();body=window_command(command);headers={'X-ISDC-Mission-Context':receipt['context_hash']}
  answer=c.post('/api/nodes/mission-windows',json=body,headers=headers);assert answer.status_code==200,answer.text
  assert answer.json()['accepted_context']==receipt
  for kind in ['hash','empty','node','site','utc']:
   changed=deepcopy(body);h=deepcopy(headers)
   if kind=='hash':h['X-ISDC-Mission-Context']='b'*64
   if kind=='empty':h['X-ISDC-Mission-Context']=''
   if kind=='node':changed['nodes'][0]['power']['battery_wh']+=1
   if kind=='site':changed['sites'][0]['ground_point']['latitude_deg']+=1
   if kind=='utc':changed['start_utc']='2020-07-12T21:16:02.000416000Z'
   r=c.post('/api/nodes/mission-windows',json=changed,headers=h);assert r.status_code==409,(kind,r.text)
  port=app.state.mission_window_query;calculate=port.calculate
  async def drift(*args,**kw):
   answer=await calculate(*args,**kw);app.state.runtime._data_deployment['revision']+=1;return answer
  port.calculate=drift
  r=c.post('/api/nodes/mission-windows',json=body,headers=headers);assert r.status_code==409 and 'accepted_context' not in r.json()


def test_required_native_failure_and_late_module_change_never_accept():
 for kind in ['invalid','module']:
  app,command=setup();port=app.state.mission_context_query.node_query;points=port.points
  async def changed(*args,**kw):
   result=await points(*args,**kw)
   if kind=='invalid':result['nodes'][0]['definition_hash']='a'*64
   else:app.state.orchestration._module._sequence+=1
   return result
  port.points=changed
  with TestClient(app) as c:
   r=c.post('/api/nodes/mission-context',json=command);assert r.status_code==(502 if kind=='invalid' else 409),r.text
   assert c.get('/api/nodes/mission-context').json()['context'] is None


def test_actual_factory_installed_native_and_original_source_feasible_plan_commit_abort():
 app=create_app();nodes=deepcopy(NATIVE['context']['nodes']);body_plan=json.loads((Path(__file__).parent/'fixtures/native_source_plan.json').read_text(encoding='utf-8'))
 roster=[{k:n[k] for k in ('id','name','mode')}|{'equipment':[{k:i[k] for k in ('id','catalog','enabled')} for i in n['equipment']]} for n in nodes]
 with TestClient(app) as c:
  before=c.get('/api/orbit/state').json()
  deployed=c.post('/api/data-management/deployment',json={'deployment_id':'native-mission-integration','expected_revision':0,'nodes':roster});assert deployed.status_code==200,deployed.text
  receipt=deployed.json();status=c.get('/api/orchestration/status').json()
  command={'request_id':'native-mission-approval','nodes':nodes,'run_id':receipt['run_id'],'deployment_revision':receipt['revision'],'utc':NATIVE['context']['utc'],'stations':deepcopy(NATIVE['context']['stations']),'faults':[],'module_instance':status['instance_id'],'module_sequence':status['sequence'],'external':None}
  approved=c.post('/api/nodes/mission-context',json=command);assert approved.status_code==200,approved.text
  context_hash=approved.json()['context_hash'];windows=window_command(command);windows['end_utc']=NATIVE['end']
  geometry=c.post('/api/nodes/mission-windows',json=windows,headers={'X-ISDC-Mission-Context':context_hash});assert geometry.status_code==200,geometry.text
  assert geometry.json()['definition_hashes']==approved.json()['definition_hashes']
  assert geometry.json()['contact_reports']==NATIVE['bundle']['contact_reports']
  headers={'X-ISDC-Orchestration-Instance':status['instance_id'],'X-ISDC-Orchestration-Sequence':'0','X-ISDC-Orchestration-Request-Id':'native-life:1','X-ISDC-Orchestration-Context':context_hash,'X-ISDC-Orchestration-Mission-Version':'1'}
  reply=c.post('/api/orchestration/plan',json=body_plan,headers=headers);assert reply.status_code==200,reply.text
  plan=reply.json();assert plan['feasible'] and len(plan['tasks'])==3
  decision={'time':plan['time'],'mission_id':plan['mission_id'],'decision':'commit','version':1,'tasks':plan['tasks']}
  headers.pop('X-ISDC-Orchestration-Mission-Version');headers.update({'X-ISDC-Orchestration-Sequence':'1','X-ISDC-Orchestration-Request-Id':'native-life:2','X-ISDC-Orchestration-Plan-Sequence':str(plan['plan_sequence'])})
  bad=deepcopy(decision);bad['tasks'][0]['volume_mb']=999
  assert c.post('/api/orchestration/commit',json=bad,headers=headers).status_code==409
  committed=c.post('/api/orchestration/commit',json=decision,headers=headers);assert committed.status_code==200,committed.text
  assert c.get('/api/orchestration/status').json()['committed'][plan['mission_id']]['tasks']==3
  headers.update({'X-ISDC-Orchestration-Sequence':'2','X-ISDC-Orchestration-Request-Id':'native-life:3'});decision['decision']='abort';decision['tasks']=[]
  aborted=c.post('/api/orchestration/commit',json=decision,headers=headers);assert aborted.status_code==200,aborted.text
  assert c.get('/api/orchestration/status').json()['committed']=={}
  after=c.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert after==before


def test_bad_station_band_structure_rejects_without_server_error():
 for invalid in [[{}],[['S']],['S','S']]:
  app,command=setup();command['stations'][0]['bands']=invalid
  with TestClient(app) as c:
   r=c.post('/api/nodes/mission-context',json=command);assert r.status_code==422,r.text
   assert c.get('/api/nodes/mission-context').json()['context'] is None
