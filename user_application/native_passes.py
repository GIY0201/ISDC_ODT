"""Original coarse/peak/crossing pass algorithm over the existing native point query."""
from copy import deepcopy
import math
from uuid import uuid4
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.contracts.satellite_nodes import (prepare_node_definitions,MAX_NODE_SAMPLES,
    NODE_PROFILE,NODE_FRAME,NODE_INERTIAL_FRAME,NODE_TIME_MODEL,SOURCE_COMMIT)
from digital_twin.simulation.orbit_geometry import elevation_deg
from digital_twin.simulation.mission_planning.window_geometry import elevation_for_off_nadir
from user_application.mission_windows import validate_native_window_points


class NativeMissionPasses:
    def __init__(self,node_query,*,max_passes=20000):
        if type(max_passes) is not int or not 1<=max_passes<=20000:raise ValueError('pass capacity must be1..20000')
        self.node_query=node_query;self.max_passes=max_passes

    async def passes(self,nodes,site,start_utc,end_utc,*,mask_degrees=10):
        if not isinstance(site,GroundPoint):raise ValueError('typed ground point required')
        if site.ellipsoid_height_m<=-6356752.314245:raise ValueError('ground height outside WGS84 source domain')
        if type(mask_degrees) not in (int,float) or not math.isfinite(mask_degrees) or not 0<=mask_degrees<90:
            raise ValueError('elevation mask must be0..<90deg')
        captured=deepcopy(nodes);prepared=prepare_node_definitions(captured)
        site=deepcopy(site);first,last=parse_utc(start_utc),parse_utc(end_utc)
        duration=float((last.as_time()-first.as_time()).sec)
        if not 0<duration<=86400.00000001:raise ValueError('explicit pass horizon must be greater than0 and at most24h')
        hashes={p.node_id:p.definition_hash for p in prepared};token=uuid4().hex;sequence=0;passes=[]
        def rounded(value):return min(duration,max(0,math.floor(value*1000+0.5)/1000))
        def stamp(value):
            if value==0:return first.iso_utc
            if value==duration:return last.iso_utc
            return (first.as_time()+TimeDelta(value,format='sec')).utc.isot+'Z'
        for index,node in enumerate(captured):
            cache={}
            async def samples(values):
                nonlocal sequence
                times=sorted(set(rounded(value) for value in values)-cache.keys())
                for start in range(0,len(times),MAX_NODE_SAMPLES):
                    chunk=times[start:start+MAX_NODE_SAMPLES];utc=[stamp(t) for t in chunk]
                    sequence+=1;request_id='mission-pass-'+token+':'+str(sequence)
                    reply=await self.node_query.points([node],utc,request_id)
                    rows=validate_native_window_points(reply,[node],utc,request_id,hashes)[0]
                    positions=[]
                    for row in rows:
                        position=row.get('position_m')
                        if not isinstance(position,list) or len(position)!=3 or any(type(v) not in (int,float) or not math.isfinite(v) for v in position):
                            raise RuntimeError('invalid native pass position')
                        positions.append(position)
                    try:elevations=elevation_deg(positions,site)
                    except ValueError as error:raise RuntimeError('invalid native observer geometry') from error
                    cache.update((t,float(value)) for t,value in zip(chunk,elevations))
                return [(rounded(value),cache[rounded(value)]) for value in values]
            async def sample(value):return (await samples([value]))[0]
            async def refine_peak(left,right):
                ratio=(math.sqrt(5)-1)/2
                a,b=await samples([right-ratio*(right-left),left+ratio*(right-left)])
                while right-left>0.1:
                    if a[1]<b[1]:left=a[0];a=b;b=await sample(left+ratio*(right-left))
                    else:right=b[0];b=a;a=await sample(right-ratio*(right-left))
                await sample((left+right)/2)
            grid=[float(i*30) for i in range(int(duration//30)+1)]
            if grid[-1]<duration:grid.append(duration)
            else:grid[-1]=duration
            coarse=await samples(grid)
            for i,point in enumerate(coarse):
                before=coarse[i-1] if i else None;after=coarse[i+1] if i+1<len(coarse) else None
                if before is None:
                    if after is not None:await refine_peak(point[0],after[0])
                elif after is None:await refine_peak(before[0],point[0])
                elif point[1]>=before[1] and point[1]>=after[1] and (point[1]>before[1] or point[1]>after[1]):
                    await refine_peak(before[0],after[0])
            with_peaks=sorted(cache.items())
            for before,after in zip(with_peaks,with_peaks[1:]):
                if (before[1]>=mask_degrees)==(after[1]>=mask_degrees):continue
                left,right=before,after;left_above=left[1]>=mask_degrees
                while right[0]-left[0]>1:
                    middle=await sample((left[0]+right[0])/2)
                    if (middle[1]>=mask_degrees)==left_above:left=middle
                    else:right=middle
            active=None;previous=None
            def finish():
                if len(passes)>=self.max_passes:raise ValueError('pass capacity exceeded; result not published')
                start,end=stamp(active['start']),stamp(active['end'])
                passes.append({'id':'pass|'+node['id']+'|'+start,'satellite':node['id'],'start':start,'end':end,
                    'peak':stamp(active['peak']),'max_elevation_deg':active['maximum'],
                    'duration_seconds':math.floor(active['end']-active['start']+0.5),
                    'in_progress':active['in_progress'],'truncated':active['truncated']})
            for point in sorted(cache.items()):
                if point[1]>=mask_degrees:
                    if active is None:
                        active={'start':rounded((previous[0]+point[0])/2) if previous else point[0],
                            'end':point[0],'peak':point[0],'maximum':point[1],
                            'in_progress':point[0]==0,'truncated':False}
                    active['end']=point[0]
                    if point[1]>active['maximum']:active['peak']=point[0];active['maximum']=point[1]
                elif active is not None:
                    active['end']=rounded((previous[0]+point[0])/2);finish();active=None
                previous=point
            if active is not None:active['truncated']=True;finish()
        return {'schema_version':1,'status':'sampled','model_profile':NODE_PROFILE,'frame':NODE_FRAME,
            'inertial_frame':NODE_INERTIAL_FRAME,'time_model':NODE_TIME_MODEL,'source_commit':SOURCE_COMMIT,
            'quality':'engineering_assumption','definition_hashes':hashes,'passes':passes,
            'site':{'latitude_deg':site.latitude_deg,'longitude_deg':site.longitude_deg,'ellipsoid_height_m':site.ellipsoid_height_m},
            'minimum_elevation_deg':mask_degrees,
            'coverage':{'start_utc':first.iso_utc,'end_utc':last.iso_utc,'resolution_seconds':30,
                'peak_bracket_seconds':0.1,'boundary_bracket_seconds':1,'short_intervals_may_be_missed':True}}

    async def access(self,nodes,target,start_utc,end_utc,*,off_nadir_degrees=30):
        if type(off_nadir_degrees) not in (int,float) or not math.isfinite(off_nadir_degrees) or not 0<off_nadir_degrees<=90:
            raise ValueError('off-nadir angle must be greater0 and at most90deg')
        captured=deepcopy(nodes);prepare_node_definitions(captured);passes=[];hashes={};result=None
        for node in captured:
            mask=elevation_for_off_nadir(node['orbit']['altitude_km'],off_nadir_degrees)
            result=await self.passes([node],target,start_utc,end_utc,mask_degrees=mask)
            hashes.update(result['definition_hashes'])
            for item in result['passes']:
                item['id']='access|'+item['satellite']+'|'+item['start'];item['minimum_elevation_deg']=mask;passes.append(item)
                if len(passes)>self.max_passes:raise ValueError('access capacity exceeded; result not published')
        return {**result,'definition_hashes':hashes,'passes':passes,'off_nadir_degrees':off_nadir_degrees,'minimum_elevation_deg':None}
