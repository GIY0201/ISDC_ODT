"""Explicit local readonly API validation; restore saved selection after restart."""
import json,sys,time,urllib.request,urllib.error
from pathlib import Path
PROJECT_ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(PROJECT_ROOT))
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc,format_utc_times

OUTPUT=PROJECT_ROOT/'data'/'workspace'/'validation'/'ground_stations'
def request(path,payload=None,method=None):
    command=urllib.request.Request('http://127.0.0.1:8891/'+path,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method=method)
    with urllib.request.urlopen(command,timeout=60) as response:return json.loads(response.read())

def main(mode):
    if mode=='capture':
        value={path:request(path) for path in ('api/orbit/state','api/bootstrap','api/reports/snapshot.json')}
        (OUTPUT/'t113_before_restart.json').write_text(json.dumps(value,indent=2),encoding='utf-8')
        print(json.dumps({'input_id':value['api/orbit/state']['input_id'],'runtime':value['api/bootstrap']['runtime']}));return
    if mode!='verify':raise ValueError('capture or verify required')
    saved=json.loads((OUTPUT/'t113_before_restart.json').read_text(encoding='utf-8'))['api/orbit/state']
    before=request('api/orbit/state')
    if saved['input_id']:
        command={key:saved[key] for key in ('input_id','ground_point','minimum_elevation_deg','playing','play_rate')}
        command.update(anchor_utc=saved['current_utc'],expected_revision=before['revision'],client_request_id='restore-t113')
        restored=request('api/orbit/selection',command,'PUT')
    else:restored=before
    selected=request('api/catalog/position',dict(group='active',catalog_number=25544))
    identity=dict(group='active',catalog_number=25544,normalized_gp_sha256=selected['normalized_gp_sha256'],client_request_id='t113-live')
    started=time.perf_counter();track=request('api/catalog/track',identity|dict(utc=selected['utc']));track_seconds=time.perf_counter()-started
    center=next(row for row in track['rows'] if row['utc']==selected['utc'])
    assert center['position_m']==selected['position_m']
    assert track['count']==track['valid_count']+track['error_count'] and track['error_count']==0
    end=format_utc_times((parse_utc(selected['utc']).as_time()+TimeDelta([86400],format='sec',scale='tai')).utc)[0]
    point=saved['ground_point'] or dict(latitude_deg=36.3742,longitude_deg=127.3567,ellipsoid_height_m=0.,virtual=True,ellipsoid='WGS84')
    payload=identity|dict(query_start_utc=selected['utc'],query_end_utc=end,ground_point=point,minimum_elevation_deg=saved['minimum_elevation_deg'])
    started=time.perf_counter();visibility=request('api/catalog/visibility',payload);visibility_seconds=time.perf_counter()-started
    assert visibility['normalized_gp_sha256']==selected['normalized_gp_sha256'] and visibility['communication_status']=='unknown'
    assert visibility['query_start_utc']==selected['utc'] and visibility['query_end_utc']==end
    for path,body,expected in [('api/catalog/track',identity|dict(utc=selected['utc'],normalized_gp_sha256='0'*64),409),('api/catalog/track',identity|dict(utc='local'),422),('api/catalog/visibility',payload|dict(query_end_utc=selected['utc']),422)]:
        try:request(path,body)
        except urllib.error.HTTPError as error:assert error.code==expected
        else:raise AssertionError('invalid request accepted')
    after=request('api/orbit/state')
    for key in ('input_id','anchor_utc','ground_point','minimum_elevation_deg','playing','play_rate'):assert after[key]==restored[key]
    value=dict(track_seconds=track_seconds,track_count=track['count'],reference_utc=selected['utc'],period_seconds=track['period_seconds'],visibility_seconds=visibility_seconds,visibility_status=visibility['status'],intervals=len(visibility['intervals']),contacts=len(visibility['contacts']),errors=len(visibility['errors']),restored=restored,after=after)
    for name,content in [('track',track),('visibility',visibility),('result',value)]:
        (OUTPUT/f't113_live_{name}.json').write_text(json.dumps(content,indent=2),encoding='utf-8')
    print(json.dumps({key:item for key,item in value.items() if key not in ('restored','after')}))

if __name__=='__main__':main(sys.argv[1])
