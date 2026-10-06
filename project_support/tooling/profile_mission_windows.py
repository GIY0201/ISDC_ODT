"""Isolated native mission query profiling; never contacts/restarts a server."""
import argparse,asyncio,cProfile,pstats,io,json,time,hashlib
from collections import Counter
from pathlib import Path
from foundation.orbit_time import parse_utc
from astropy.time import TimeDelta
from user_application.node_geometry import NodeGeometryQuery
from user_application.mission_window_batch import MissionWindowQuery
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.contracts.mission_windows import MissionWindowSite
import isdc_orbit_propagation as native

def main():
 parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');parser.add_argument('--seconds',type=float,default=360);parser.add_argument('--stamp-memo',action='store_true');parser.add_argument('--no-profile',action='store_true');parser.add_argument('--uncached-baseline',action='store_true');args=parser.parse_args()
 if args.stamp_memo and args.uncached_baseline:parser.error('select memo prototype or uncached baseline, not both')
 if args.stamp_memo or args.uncached_baseline:
  import user_application.mission_window_batch as assembly
  for name,target,arg in [('native_passes','NativeMissionPasses','value'),('mission_windows','NativeMissionWindows','offset')]:
   path=Path('user_application')/(name+'.py');source=path.read_text(encoding='utf-8')
   if args.uncached_baseline:
    source=source.replace('        @lru_cache(maxsize=8192)\n','').replace('return (stamp_origin+TimeDelta('+arg,'return (first.as_time()+TimeDelta('+arg)
   elif '@lru_cache(maxsize=8192)' in source:continue
   else:
    source='from functools import lru_cache\n'+source
    source=source.replace('        def stamp('+arg+'):', '        stamp_origin=first.as_time()\n        @lru_cache(maxsize=8192)\n        def stamp('+arg+'):').replace('return (first.as_time()+TimeDelta('+arg, 'return (stamp_origin+TimeDelta('+arg)
   namespace={'__name__':'profile_variant_'+name};exec(compile(source,str(path)+'[readonly stamp variant]','exec'),namespace);setattr(assembly,target,namespace[target])
 body=json.loads(Path(args.input).read_text(encoding='utf-8'));context=body.get('context',body)
 if any(context.get(key) is not None for key in ['target','external','max_external_range_km']):parser.error('this bounded profile supports ground/eclipse queries only; target/external must be absent')
 nodes=context['nodes'];start=context.get('utc',context.get('start_utc'));end=(parse_utc(start).as_time()+TimeDelta(args.seconds,format='sec')).utc.isot+'Z'
 rawsites=context.get('sites',context.get('stations',[]));sites=[]
 for index,row in enumerate(rawsites):
  p=row.get('ground_point',row);sites.append(MissionWindowSite(row.get('station_id',row.get('id',f'S-{index}')),GroundPoint(p.get('latitude_deg',p.get('latitude')),p.get('longitude_deg',p.get('longitude')),p.get('ellipsoid_height_m',p.get('altitude_km',0)*1000)),row.get('minimum_elevation_deg',row.get('min_elevation_deg',5))))
 async def immediate(work):return work()
 q=NodeGeometryQuery(execute=immediate);original_points=q.points;calculate=q.calculate;counts=Counter();keys=Counter();categories=Counter();native_elapsed=0.;points_elapsed=0.
 def measured_native(prepared,grids):
  nonlocal native_elapsed
  counts['native_calls']+=1;counts['native_rows']+=sum(map(len,grids));started=time.perf_counter()
  try:return calculate(prepared,grids)
  finally:native_elapsed+=time.perf_counter()-started
 async def measured_points(subset,utc,request_id):
  nonlocal points_elapsed
  counts['point_calls']+=1;categories[request_id.split('-')[1]]+=1
  for node in subset:
   digest=hashlib.sha256(json.dumps(node,sort_keys=True,allow_nan=False).encode()).hexdigest()
   keys.update((digest,t) for t in utc)
  started=time.perf_counter()
  try:return await original_points(subset,utc,request_id)
  finally:points_elapsed+=time.perf_counter()-started
 q.calculate=measured_native;q.points=measured_points
 profile=cProfile.Profile();started=time.perf_counter();profile.enable() if not args.no_profile else None;result=asyncio.run(MissionWindowQuery(q,lambda:None).calculate(nodes,sites,start,end,'isolated-profile'));profile.disable();elapsed=time.perf_counter()-started
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);profile.dump_stats(str(out.with_suffix('.pstats')))
 if not args.no_profile:
  stats=io.StringIO();pstats.Stats(profile,stream=stats).sort_stats('cumulative').print_stats(30);out.with_suffix('.profile.txt').write_text(stats.getvalue(),encoding='utf-8')
 receipt={'stamp_memo_prototype':args.stamp_memo,'uncached_baseline':args.uncached_baseline,'cprofile':not args.no_profile,'native_version':native.__version__,'transport':'isolated direct query with immediate executor, no live server','nodes':len(nodes),'sites':len(sites),'horizon_seconds':args.seconds,'elapsed_seconds':elapsed,'native_seconds':native_elapsed,'point_query_seconds':points_elapsed,**counts,'unique_definition_utc_rows':len(keys),'duplicate_definition_utc_rows':sum(keys.values())-len(keys),'categories':dict(categories),'contacts':sum(len(x['geometry']['passes']) for x in result['contact_reports']),'eclipses':len(result['eclipse_report']['windows']),'result_sha256':hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()}
 out.write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
if __name__=='__main__':main()
