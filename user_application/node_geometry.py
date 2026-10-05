"""Readonly source-node queries; native dynamics and explicit display UTC only."""
import asyncio
import json
import math
import numpy as np
from astropy.time import TimeDelta
from communication.native.node_adapter import prepare_node_definitions, propagate_node_grids
from digital_twin.contracts.satellite_nodes import (NativeNodeBatch, NODE_PROFILE, NODE_FRAME,
    NODE_INERTIAL_FRAME, NODE_TIME_MODEL, NODE_ROW_WIDTH, MAX_NODE_ROWS, MAX_NODE_SAMPLES, SOURCE_COMMIT)
from digital_twin.simulation.node_geometry import node_period_minutes, node_track_grid
from foundation.orbit_time import parse_utc, UtcInstant, format_utc_batch


class NodeGeometryQuery:
    def __init__(self, calculate=propagate_node_grids, execute=asyncio.to_thread):
        self.calculate=calculate;self.execute=execute

    def _prepare(self,nodes,request_id):
        if not isinstance(request_id,str) or not request_id.strip() or len(request_id)>128:
            raise ValueError('nonblank request id length1..128 required')
        # Capture all input before yielding to the executor; no runtime state retained.
        prepared=prepare_node_definitions(nodes)
        snapshot=json.loads(json.dumps(nodes,allow_nan=False))
        return snapshot,prepared

    async def samples(self,nodes,start_utc,count,step_seconds,request_id):
        if type(count) is not int or not 1<=count<=MAX_NODE_SAMPLES:raise ValueError('count must be1..601')
        if type(step_seconds) is not int or step_seconds!=1:raise ValueError('step_seconds must be1')
        snapshot,prepared=self._prepare(nodes,request_id)
        if len(prepared)*count>MAX_NODE_ROWS:raise ValueError('node batch limits exceeded')
        first=parse_utc(start_utc)
        def calculate():
            times=(first.as_time()+TimeDelta(np.arange(count),format='sec',scale='tai')).utc
            grid=tuple(UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
            return self._assemble(prepared,[grid]*len(snapshot),request_id)
        return await self.execute(calculate)

    async def track(self,nodes,center_utc,request_id):
        snapshot,prepared=self._prepare(nodes,request_id)
        parse_utc(center_utc)
        def calculate():
            periods=[node_period_minutes(node['orbit']) for node in snapshot]
            grids=[node_track_grid(center_utc,period) for period in periods]
            return self._assemble(prepared,grids,request_id,periods)
        return await self.execute(calculate)

    def _assemble(self,prepared,grids,request_id,periods=None):
        result=self.calculate(prepared,grids)
        expected_ids=tuple(p.node_id for p,g in zip(prepared,grids) for _ in g)
        expected_hashes=tuple(p.definition_hash for p,g in zip(prepared,grids) for _ in g)
        expected_utc=format_utc_batch(t for grid in grids for t in grid)
        count=len(expected_ids)
        if (not isinstance(result,NativeNodeBatch) or result.frame!=NODE_FRAME or result.profile!=NODE_PROFILE
            or result.inertial_frame!=NODE_INERTIAL_FRAME or result.time_model!=NODE_TIME_MODEL
            or result.node_ids!=expected_ids or result.definition_hashes!=expected_hashes or result.utc!=expected_utc
            or not isinstance(result.errors,tuple) or len(result.errors)!=count
            or not isinstance(result._buffer,bytes) or len(result._buffer)!=count*NODE_ROW_WIDTH*8):
            raise RuntimeError('misaligned native node query result')
        nodes=[];offset=0;successes=0
        for index,(item,grid) in enumerate(zip(prepared,grids)):
            rows=[]
            for slot in range(offset,offset+len(grid)):
                error=result.errors[slot]
                if error is not None and (not isinstance(error,str) or not error or len(error)>128):
                    raise RuntimeError('invalid native node query error')
                raw=result.row(slot)
                if raw is not None and (not all(math.isfinite(v) for v in raw) or raw[27] not in (0,1)):
                    raise RuntimeError('invalid native node query success')
                successes+=error is None
                rows.append({'utc':result.utc[slot],'status':'valid' if error is None else 'error',
                    'error_code':error,'position_m':None if raw is None else list(result.fixed_position_m(slot)),
                    'inertial_velocity_km_s':None if raw is None else list(raw[3:6]),
                    'sunlit':None if raw is None else bool(raw[27]),
                    'longitude_deg':None if raw is None else raw[28],
                    'latitude_deg':None if raw is None else raw[29],
                    'height_km':None if raw is None else raw[30]})
            value={'node_id':item.node_id,'definition_hash':item.definition_hash,'rows':rows}
            if periods is not None:value.update(period_minutes=periods[index],path_visible=all(r['status']=='valid' for r in rows))
            nodes.append(value);offset+=len(grid)
        return {'schema_version':1,'request_id':request_id,'status':'valid' if successes==count else 'partial' if successes else 'error',
            'model_profile':NODE_PROFILE,'frame':NODE_FRAME,'inertial_frame':NODE_INERTIAL_FRAME,'time_model':NODE_TIME_MODEL,
            'source_commit':SOURCE_COMMIT,'quality':'engineering_assumption','nodes':nodes}
