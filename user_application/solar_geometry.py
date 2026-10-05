"""Assemble immutable solar display samples with an explicit EOP snapshot."""
import numpy as np
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc,UtcInstant,format_utc_times
from digital_twin.simulation.solar_geometry import solar_directions


class SolarGeometryQuery:
    def __init__(self,eop,execute):
        self.eop=eop;self.execute=execute

    async def samples(self,start_utc,step_seconds,count,client_request_id):
        if type(step_seconds) is not int or step_seconds!=1:raise ValueError('step_seconds must be1')
        if type(count) is not int or not 1<=count<=601:raise ValueError('count must be1..601')
        if not isinstance(client_request_id,str) or not client_request_id.strip() or len(client_request_id)>128:
            raise ValueError('nonblank request id length1..128 required')
        first=parse_utc(start_utc)
        def calculate():
            times=(first.as_time()+TimeDelta(np.arange(count),format='sec',scale='tai')).utc
            instants=tuple(UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
            points=self.eop.at_many(instants)
            batch=solar_directions(instants,points)
            stamps=format_utc_times(times)
            rows=[{'utc':stamp,'status':'valid','direction_to_sun':vector.tolist(),
                'eop_quality':self.eop.quality(instant)} for stamp,vector,instant in zip(stamps,batch.direction_to_sun,instants)]
            return {'schema_version':1,'client_request_id':client_request_id,'status':'valid','frame':batch.frame,
                'start_utc':stamps[0],'end_utc':stamps[-1],'step_seconds':1,'count':count,'rows':rows,
                'eop_sha256':batch.eop_sha256,'leap_sha256':batch.leap_sha256,
                'solar_model':'ERFA_builtin','frame_transform':'IAU2006_2000A',
                'observed_cip_offsets':False,'purpose':'display_geometry','units':{'direction':'unitless','time':'UTC'}}
        return await self.execute(calculate)
