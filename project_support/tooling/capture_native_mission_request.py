"""Offline installed-native mission fixture capture; no running server access."""
import argparse,asyncio,json
from pathlib import Path
from datetime import datetime,timedelta
from fastapi.testclient import TestClient
from user_application.node_geometry import NodeGeometryQuery
from user_application.web.application import create_app

parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');args=parser.parse_args()
x=json.loads(Path(args.input).read_text(encoding='utf-8'));c=x['context'];q=NodeGeometryQuery()
async def capture():
 receipts=[]
 # Match the existing optical owner's source Date-millisecond priming convention.
 date=datetime.fromisoformat(c['utc'].replace('Z','+00:00'));date=date.replace(microsecond=date.microsecond//1000*1000)
 times=[(date-timedelta(seconds=s)).strftime('%Y-%m-%dT%H:%M:%S.')+f'{date.microsecond*1000:09d}Z' for s in (120,60)]+[c['utc']]
 for index,stamp in enumerate(times):
  request={'nodes':c['nodes'],'start_utc':stamp,'count':1,'step_seconds':1,'request_id':'native-optical-'+str(index)}
  receipts.append({'request':request,'reply':await q.samples(c['nodes'],stamp,1,1,request['request_id'])})
 return receipts
x['optical_receipts']=asyncio.run(capture())
command={'nodes':c['nodes'],'sites':[{'station_id':s['id'],'ground_point':{'latitude_deg':s['latitude'],'longitude_deg':s['longitude'],'ellipsoid_height_m':s.get('altitude_km',0)*1000},'minimum_elevation_deg':s.get('min_elevation_deg',0)} for s in c['stations']],'start_utc':c['utc'],'end_utc':x['end'],'request_id':'native-mission-request','target':None,'external':None,'max_external_range_km':None}
with TestClient(create_app(node_geometry_query=q)) as client:
 before=client.get('/api/orbit/state').json();r=client.post('/api/nodes/mission-windows',json=command);assert r.status_code==200,r.text
 after=client.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert before==after
 x['bundle']=r.json();x['transport']='installed native and actual ASGI factory, offline fixture';x['orbit_state_unchanged']=True
Path(args.output).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
print('contacts',sum(len(i['geometry']['passes']) for i in x['bundle']['contact_reports']),'eclipses',len(x['bundle']['eclipse_report']['windows']))
