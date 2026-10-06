"""Source external-contact geometry over injected node and precise catalog queries."""
import asyncio
from copy import deepcopy
import json,math,re
from uuid import uuid4
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc
from digital_twin.contracts.satellite_nodes import (prepare_node_definitions,MAX_NODE_SAMPLES,
    NODE_PROFILE,NODE_FRAME,NODE_INERTIAL_FRAME,NODE_TIME_MODEL,SOURCE_COMMIT)
from digital_twin.simulation.mission_planning.window_geometry import line_of_sight_clear
from user_application.mission_windows import validate_native_window_points,scan_native_intervals


def position_km(value):
    if (not isinstance(value,(list,tuple)) or len(value)!=3
        or any(type(v) not in (int,float) or not math.isfinite(v) for v in value)):
        raise RuntimeError('required native external position unavailable')
    return [v/1000 for v in value]


class NativeMissionCrosslinks:
    def __init__(self,node_query,catalog_query,*,max_windows=20000):
        if type(max_windows) is not int or not 1<=max_windows<=20000:raise ValueError('window capacity must be1..20000')
        self.node_query=node_query;self.catalog_query=catalog_query;self.max_windows=max_windows

    async def crosslinks(self,nodes,external,start_utc,end_utc,*,max_range_km,step_seconds=30,refine_seconds=1):
        captured=deepcopy(nodes);prepared=prepare_node_definitions(captured);external=deepcopy(external)
        if (not isinstance(external,dict) or type(external.get('catalog_number')) is not int
            or not 1<=external['catalog_number']<=999999999 or not isinstance(external.get('group'),str)
            or not external['group'].strip() or external.get('profile')!='WGS72_AFSPC'
            or any(not isinstance(external.get(k),str) or not re.fullmatch('[a-f0-9]{64}',external[k])
                   for k in ('normalized_gp_sha256','eop_sha256','leap_sha256'))):
            raise ValueError('explicit precise external GP/EOP/leap identity required')
        json.dumps(external,allow_nan=False)
        if type(max_range_km) not in (int,float) or not math.isfinite(max_range_km) or max_range_km<=0:
            raise ValueError('positive finite external range required')
        if type(step_seconds) is not int or not 1<=step_seconds<=60:raise ValueError('step must be integer1..60s')
        if type(refine_seconds) not in (int,float) or not math.isfinite(refine_seconds) or not .001<=refine_seconds<=min(step_seconds,5):
            raise ValueError('boundary tolerance must be1ms..5s')
        first,last=parse_utc(start_utc),parse_utc(end_utc);duration=float((last.as_time()-first.as_time()).sec)
        if not 0<duration<=86400.00000001:raise ValueError('external horizon must be positive and at most24h')
        hashes={p.node_id:p.definition_hash for p in prepared};token=uuid4().hex;sequence=0;provenance=None;qualities=set()
        def stamp(value):
            if value==0:return first.iso_utc
            if value==duration:return last.iso_utc
            time=(first.as_time()+TimeDelta(value,format='sec')).utc;time.precision=9
            return time.isot+'Z'
        async def geometry(indices,offsets):
            nonlocal sequence,provenance
            sequence+=1;request_id='mission-external-'+token+':'+str(sequence)
            requested=[stamp(t) for t in offsets];times=list(dict.fromkeys(requested));slots={t:i for i,t in enumerate(times)}
            subset=[captured[i] for i in indices]
            node_report,report=await asyncio.gather(self.node_query.points(subset,times,request_id),
                self.catalog_query.points(external['group'],external['catalog_number'],external['normalized_gp_sha256'],times,request_id))
            own_rows=validate_native_window_points(node_report,subset,times,request_id,hashes)
            expected={k:external[k] for k in ('group','catalog_number','normalized_gp_sha256','profile','eop_sha256','leap_sha256')}
            expected.update(version=1,status='valid',client_request_id=request_id,frame='ITRF',eop_kind='IERS_A',count=len(times),valid_count=len(times),error_count=0)
            if (not isinstance(report,dict) or any(type(report.get(k)) is not type(v) or report.get(k)!=v for k,v in expected.items())
                or report.get('units')!={'position':'m','time':'UTC'} or not isinstance(report.get('rows'),list) or len(report['rows'])!=len(times)
                or report.get('source') not in ('celestrak-live','celestrak-cache','celestrak-stale') or type(report.get('stale')) is not bool):
                raise RuntimeError('required external receipt unavailable or changed')
            current={k:deepcopy(report.get(k)) for k in ('source','fetched_at','warning','stale','epoch_utc','name')}
            for k in ('fetched_at','epoch_utc'):parse_utc(current[k])
            if not isinstance(current['warning'],str) or not isinstance(current['name'],str):raise RuntimeError('invalid external source provenance')
            if provenance is not None and current!=provenance:raise RuntimeError('external source provenance changed during calculation')
            provenance=current;positions=[]
            for utc,row in zip(times,report['rows']):
                if (not isinstance(row,dict) or row.get('utc')!=utc or row.get('status')!='valid' or row.get('error_code') is not None
                    or not isinstance(row.get('eop_quality'),dict) or set(row['eop_quality'])!={'ut1','polar_motion'}
                    or any(v not in ('final_b','observed_a','predicted_a') for v in row['eop_quality'].values())):
                    raise RuntimeError('required external sample unavailable or misaligned')
                qualities.add(tuple(sorted(row['eop_quality'].items())));positions.append(position_km(row.get('position_m')))
            result=[]
            for rows in own_rows:
                values=[]
                for row,theirs in zip(rows,positions):
                    ours=position_km(row.get('position_m'));distance=math.hypot(*(a-b for a,b in zip(ours,theirs)))
                    values.append((distance,line_of_sight_clear(ours,theirs) and distance<=max_range_km))
                result.append([values[slots[t]] for t in requested])
            return result
        async def read(indices,offsets):return [[inside for distance,inside in rows] for rows in await geometry(indices,offsets)]
        intervals=await scan_native_intervals(read,len(captured),duration,step_seconds,refine_seconds,self.max_windows)
        result=[];range_step=max(5,step_seconds/3)
        for item in intervals:
            offsets=[item['start']+i*range_step for i in range(int((item['end']-item['start'])//range_step)+1)]
            if offsets[-1]<item['end']:offsets.append(item['end'])
            minimum=math.inf
            for start in range(0,len(offsets),MAX_NODE_SAMPLES):
                values=(await geometry([item['index']],offsets[start:start+MAX_NODE_SAMPLES]))[0]
                minimum=min(minimum,*(distance for distance,inside in values))
            identity=captured[item['index']]['id'];a,b=stamp(item['start']),stamp(item['end']);external_id=str(external['catalog_number'])
            result.append({'id':'crosslink|'+identity+'|'+external_id+'|'+a,'satellite':identity,'external':external_id,
                'start':a,'end':b,'min_range_km':math.floor(minimum+.5),'in_progress':item['in_progress'],'truncated':item['truncated']})
        return {'schema_version':1,'status':'sampled','model_profile':NODE_PROFILE,'frame':NODE_FRAME,
            'inertial_frame':NODE_INERTIAL_FRAME,'time_model':NODE_TIME_MODEL,'source_commit':SOURCE_COMMIT,
            'quality':'engineering_assumption','comparison_frame':'WGS84_GEODETIC_EARTH_FIXED_APPROX',
            'definition_hashes':hashes,'external':{**external,**provenance,'frame':'ITRF','eop_kind':'IERS_A','eop_qualities':[dict(v) for v in sorted(qualities)]},
            'max_range_km':max_range_km,'los_margin_km':100,'windows':result,
            'coverage':{'start_utc':first.iso_utc,'end_utc':last.iso_utc,'resolution_seconds':step_seconds,
                'boundary_tolerance_seconds':refine_seconds,'range_resolution_seconds':range_step,
                'minimum_range_is_sampled':True,'short_intervals_may_be_missed':True,'exact_end_included':True}}
