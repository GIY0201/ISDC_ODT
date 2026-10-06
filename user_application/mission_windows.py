"""Native-backed source interval scanning, with explicit sampled coverage and failures."""
from copy import deepcopy
from uuid import uuid4
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc,format_utc_batch
from digital_twin.contracts.satellite_nodes import (prepare_node_definitions,MAX_NODE_ROWS,MAX_NODE_SAMPLES,
    NODE_PROFILE,NODE_FRAME,NODE_INERTIAL_FRAME,NODE_TIME_MODEL,SOURCE_COMMIT)


class NativeMissionWindows:
    def __init__(self, node_query, *, max_windows=20000):
        if type(max_windows) is not int or not 1<=max_windows<=20000:
            raise ValueError('window capacity must be1..20000')
        self.node_query=node_query
        self.max_windows=max_windows

    async def eclipses(self,nodes,start_utc,end_utc,*,step_seconds=60,refine_seconds=1):
        """Source !sunlit predicate and inside-edge bisection, queried through native points."""
        captured=deepcopy(nodes)
        prepared=prepare_node_definitions(captured)
        first,last=parse_utc(start_utc),parse_utc(end_utc)
        duration=float((last.as_time()-first.as_time()).sec)
        if not 0<duration<=86400.00000001:
            raise ValueError('explicit eclipse horizon must be greater than0 and at most24h')
        if type(step_seconds) is not int or not 1<=step_seconds<=60:
            raise ValueError('step_seconds must be integer1..60')
        if type(refine_seconds) not in (int,float) or not 0<refine_seconds<=min(step_seconds,5):
            raise ValueError('refine_seconds must be finite positive and at most5')
        # Local invocation work only: no orbit/history/current state is retained by this object.
        token=uuid4().hex;sequence=0
        hashes={p.node_id:p.definition_hash for p in prepared}
        metadata={'model_profile':NODE_PROFILE,'frame':NODE_FRAME,'inertial_frame':NODE_INERTIAL_FRAME,
                  'time_model':NODE_TIME_MODEL,'source_commit':SOURCE_COMMIT,'quality':'engineering_assumption'}
        def stamp(offset):
            if offset==0:return first.iso_utc
            if offset==duration:return last.iso_utc
            return (first.as_time()+TimeDelta(offset,format='sec')).utc.isot+'Z'
        async def read(indices,offsets):
            nonlocal sequence
            sequence+=1;request_id='mission-window-'+token+':'+str(sequence)
            times=[stamp(value) for value in offsets]
            subset=[captured[i] for i in indices]
            report=await self.node_query.points(subset,times,request_id)
            rows=validate_native_window_points(report,subset,times,request_id,hashes)
            states=[]
            for node_rows in rows:
                if any(type(row.get('sunlit')) is not bool for row in node_rows):
                    raise RuntimeError('required native eclipse sample unavailable')
                states.append([not row['sunlit'] for row in node_rows])
            return states
        windows=[];edges=[];active=[None]*len(captured);previous=[None]*len(captured)
        offsets=[float(i*step_seconds) for i in range(int(duration//step_seconds)+1)]
        if offsets[-1]<duration:offsets.append(duration)
        else:offsets[-1]=duration
        chunk=min(MAX_NODE_SAMPLES,MAX_NODE_ROWS//len(captured))
        for begin in range(0,len(offsets),chunk):
            points=offsets[begin:begin+chunk]
            values=await read(list(range(len(captured))),points)
            for i,states in enumerate(values):
                for offset,inside in zip(points,states):
                    prev=previous[i]
                    if inside and (prev is None or not prev[1]):
                        item={'index':i,'start':offset,'end':None,'in_progress':offset==0,'truncated':False}
                        active[i]=item;windows.append(item)
                        if len(windows)>self.max_windows:raise ValueError('window capacity exceeded; result not published')
                        if prev is not None:edges.append({'item':item,'field':'start','inside':offset,'outside':prev[0]})
                    elif not inside and prev is not None and prev[1]:
                        edges.append({'item':active[i],'field':'end','inside':prev[0],'outside':offset})
                        active[i]=None
                    previous[i]=(offset,inside)
        for item in active:
            if item is not None:item['end']=duration;item['truncated']=True
        # Original scanIntervals refinement returns the inside boundary; preserve that convention.
        pending=edges
        while pending:
            by_node={}
            for edge in pending:
                if abs(edge['outside']-edge['inside'])<=refine_seconds:
                    edge['item'][edge['field']]=edge['inside'];continue
                edge['middle']=(edge['inside']+edge['outside'])/2
                by_node.setdefault(edge['item']['index'],[]).append(edge)
            pending=[]
            for i,group in by_node.items():
                mids=sorted(set(e['middle'] for e in group));known={}
                for begin in range(0,len(mids),MAX_NODE_SAMPLES):
                    part=mids[begin:begin+MAX_NODE_SAMPLES]
                    states=(await read([i],part))[0];known.update(zip(part,states))
                for edge in group:
                    edge['inside' if known[edge['middle']] else 'outside']=edge['middle']
                    pending.append(edge)
        result=[]
        for item in windows:
            identity=captured[item['index']]['id'];start=stamp(item['start']);end=stamp(item['end'])
            result.append({'id':'eclipse|'+identity+'|'+start,'satellite':identity,'start':start,'end':end,
                           'in_progress':item['in_progress'],'truncated':item['truncated']})
        result.sort(key=lambda item:(item['satellite'],item['start']))
        return {**metadata,'status':'sampled','definition_hashes':hashes,'windows':result,
                'coverage':{'start_utc':first.iso_utc,'end_utc':last.iso_utc,'resolution_seconds':step_seconds,
                            'boundary_tolerance_seconds':refine_seconds,'short_intervals_may_be_missed':True}}


def validate_native_window_points(report,nodes,times,request_id,hashes):
    """Shared receipt fence for eclipse and pass producers; no state/query ownership."""
    metadata={'model_profile':NODE_PROFILE,'frame':NODE_FRAME,'inertial_frame':NODE_INERTIAL_FRAME,
              'time_model':NODE_TIME_MODEL,'source_commit':SOURCE_COMMIT,'quality':'engineering_assumption'}
    if (not isinstance(report,dict) or report.get('request_id')!=request_id or report.get('schema_version')!=1
        or report.get('status')!='valid' or any(report.get(key)!=value for key,value in metadata.items())
        or not isinstance(report.get('nodes'),list) or len(report['nodes'])!=len(nodes)):
        raise RuntimeError('required native window result unavailable or misaligned')
    rows=[]
    for node,result in zip(nodes,report['nodes']):
        if (not isinstance(result,dict) or result.get('node_id')!=node['id']
            or result.get('definition_hash')!=hashes[node['id']]
            or not isinstance(result.get('rows'),list) or len(result['rows'])!=len(times)):
            raise RuntimeError('native window identity/hash mismatch')
        for utc,row in zip(times,result['rows']):
            if (not isinstance(row,dict) or row.get('utc')!=utc or row.get('status')!='valid'
                or row.get('error_code') is not None):
                raise RuntimeError('required native window sample unavailable')
        rows.append(result['rows'])
    return rows
