from copy import deepcopy
import pytest
from user_application.bootstrap import create_runtime

def capture(r):return {'runtime':r.status(),'missions':deepcopy(r.missions),'devices':deepcopy(r.devices),'events':deepcopy(list(r.events)),'deployment':r.data_deployment()}

def test_unconfigured_development_resume_preserves_public_sim_state_and_events():
 a=create_runtime();a.elapsed_seconds=16000.25;a.sequence=1234;a.running=False;a.speed=10;a.missions[0]['name']='preserved request'
 value=capture(a);b=create_runtime();b.resume_unconfigured_development(value)
 assert b.status()==a.status() and b.missions==a.missions and b.devices==a.devices and list(b.events)==list(a.events)
 assert b.data_deployment()==a.data_deployment();value['missions'].clear();assert b.missions

def test_resume_refuses_nonempty_roster_active_fault_or_invalid_state_atomically():
 for change in ['roster','fault','nan','sequence','scenario','mode']:
  r=create_runtime();value=capture(r);before=capture(r)
  if change=='roster':value['deployment']['nodes']=[{'id':'N1'}]
  if change=='fault':value['runtime']['active_faults']=[{'kind':'link_loss'}]
  if change=='nan':value['runtime']['elapsed_seconds']=float('nan')
  if change=='sequence':value['runtime']['sequence']=-1
  if change=='scenario':value['runtime']['scenario_id']='unregistered'
  if change=='mode':value['runtime']['mode']='LIVE'
  with pytest.raises(ValueError):r.resume_unconfigured_development(value)
  assert capture(r)==before

def test_empty_recalled_deployment_retains_revision_scope_and_owner_copies():
 a=create_runtime();a._data_deployment={'deployment_id':'recalled-validation','revision':2,'nodes':[]}
 value=capture(a);b=create_runtime();b.resume_unconfigured_development(value)
 assert b.data_deployment()==a.data_deployment()
 assert b._deployment_ids=={'recalled-validation'}
 value['deployment']['revision']=99;assert b.data_deployment()['revision']==2
 for field,replacement in [('revision',True),('revision',0),('deployment_id','bad:id'),('scope_id','foreign')]:
  invalid=capture(a);invalid['deployment'][field]=replacement;before=capture(b)
  with pytest.raises(ValueError):b.resume_unconfigured_development(invalid)
  assert capture(b)==before
