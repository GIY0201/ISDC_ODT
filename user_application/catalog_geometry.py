"""Readonly catalog/native/precise-frame query assembly; no runtime ownership."""
import hashlib,json
from data.orbit_inputs import load_orbit_input_bytes
from digital_twin.contracts.orbit import GroundPoint,OrbitUnavailable
from foundation.orbit_time import parse_utc

class CatalogGeometryQuery:
    def __init__(self,catalog,eop,calculate,execute):
        self.catalog=catalog;self.eop=eop;self.calculate=calculate;self.execute=execute
    async def position(self,group,catalog_number):
        if group not in {g['id'] for g in self.catalog.catalog_groups()}:raise ValueError('unknown catalog group')
        values=await self.catalog.get_satellites(group=group,limit=100,query=str(catalog_number))
        if values.get('source') not in ('celestrak-live','celestrak-cache','celestrak-stale'):raise ValueError('current catalog GP unavailable; demo is not propagated')
        item=next((x for x in values['items'] if x.get('NORAD_CAT_ID')==catalog_number),None)
        if not item or item.get('demo'):raise ValueError('catalog GP not found')
        raw=json.dumps(item,sort_keys=True,allow_nan=False).encode();digest=hashlib.sha256(raw).hexdigest()
        orbit=load_orbit_input_bytes(raw,format='OMM',source=values['source'],fetched_utc=values['fetched_at'],expected_sha256=digest)
        def compute():
            quality=self.eop.quality(parse_utc(orbit.epoch_utc))
            result=self.calculate(orbit,[orbit.epoch_utc],GroundPoint(0,0,0))
            row=result.rows[0]
            if row.error_code or row.position_m is None:raise ValueError('native propagation failed: '+str(row.error_code))
            return {'version':1,'status':'valid','group':group,'catalog_number':catalog_number,'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),'utc':row.utc,'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,'frame':'ITRF','profile':orbit.profile,'position_m':list(row.position_m),'eop_sha256':result.eop_sha256,'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','eop_quality':quality}
        return await self.execute(compute)
