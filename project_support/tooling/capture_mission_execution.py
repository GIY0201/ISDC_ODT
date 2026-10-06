"""Offline source ICD-03 router/module lifecycle capture. Never contacts live8891."""
import argparse,json
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from communication.http.orchestration import router
from digital_twin.runtime.mission_planning.exchange import MissionPlanningExchange
from project_support.tests.test_mission_planning_exchange import message

parser=argparse.ArgumentParser();parser.add_argument('output');args=parser.parse_args()
app=FastAPI();app.state.orchestration=MissionPlanningExchange();app.include_router(router)
@app.exception_handler(ValueError)
async def invalid(request,error):return JSONResponse(status_code=400,content={'detail':str(error)})
context='a'*64
with TestClient(app) as client:
 s0=client.get('/api/orchestration/status').json();body=message()
 def headers(s,number,plan=None):
  return {'X-ISDC-Orchestration-Instance':s['instance_id'],'X-ISDC-Orchestration-Sequence':str(s['sequence']),'X-ISDC-Orchestration-Request-Id':'fixture:'+str(number),'X-ISDC-Orchestration-Context':context,'X-ISDC-Orchestration-'+('Plan-Sequence' if plan else 'Mission-Version'):str(plan or 1)}
 r=client.post('/api/orchestration/plan',json=body,headers=headers(s0,1));assert r.status_code==200,r.text;p=r.json();assert p['feasible'] and p['tasks'];s1=client.get('/api/orchestration/status').json()
 commit={'time':p['time'],'mission_id':p['mission_id'],'decision':'commit','version':1,'tasks':p['tasks']}
 r=client.post('/api/orchestration/commit',json=commit,headers=headers(s1,2,p['plan_sequence']));assert r.status_code==200,r.text;c=r.json();s2=client.get('/api/orchestration/status').json()
 abort={**commit,'decision':'abort','tasks':[]}
 r=client.post('/api/orchestration/commit',json=abort,headers=headers(s2,3,p['plan_sequence']));assert r.status_code==200,r.text;a=r.json();s3=client.get('/api/orchestration/status').json()
 assert s2['committed'][p['mission_id']]['tasks']==len(p['tasks']) and not s3['committed']
 value={'transport':'actual ICD-03 router with original scheduler/guarded module under offline TestClient; not production mount','request':body,'status':[s0,s1,s2,s3],'plan':p,'commit_request':commit,'commit':c,'abort_request':abort,'abort':a}
Path(args.output).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
print('source tasks',len(p['tasks']),'final sequence',s3['sequence'])
