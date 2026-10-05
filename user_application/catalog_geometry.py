"""Readonly catalog/native/precise-frame query assembly; no runtime ownership."""
import hashlib,json,math
import numpy as np
from astropy.time import TimeDelta
from data.orbit_inputs import load_orbit_input_bytes
from digital_twin.contracts.orbit import GroundPoint,OrbitUnavailable
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from digital_twin.simulation.orbit_geometry import observation_geometry
from foundation.orbit_time import parse_utc,parse_utc_batch,format_utc_times

class CatalogGeometryQuery:
    def __init__(self,catalog,eop,calculate,execute):
        self.catalog=catalog;self.eop=eop;self.calculate=calculate;self.execute=execute
    async def _input(self,group,catalog_number):
        if group not in {g['id'] for g in self.catalog.catalog_groups()}:raise ValueError('unknown catalog group')
        values=await self.catalog.get_satellites(group=group,limit=100,query=str(catalog_number))
        if values.get('source') not in ('celestrak-live','celestrak-cache','celestrak-stale'):raise ValueError('current catalog GP unavailable; demo is not propagated')
        item=next((x for x in values['items'] if x.get('NORAD_CAT_ID')==catalog_number),None)
        if not item or item.get('demo'):raise ValueError('catalog GP not found')
        raw=json.dumps(item,sort_keys=True,allow_nan=False).encode();digest=hashlib.sha256(raw).hexdigest()
        orbit=load_orbit_input_bytes(raw,format='OMM',source=values['source'],fetched_utc=values['fetched_at'],expected_sha256=digest)
        return values,item,orbit,digest
    async def position(self,group,catalog_number):
        values,item,orbit,digest=await self._input(group,catalog_number)
        def compute():
            quality=self.eop.quality(parse_utc(orbit.epoch_utc))
            result=self.calculate(orbit,[orbit.epoch_utc],GroundPoint(0,0,0))
            row=result.rows[0]
            if row.error_code or row.position_m is None:raise ValueError('native propagation failed: '+str(row.error_code))
            return {'version':1,'status':'valid','group':group,'catalog_number':catalog_number,'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),'utc':row.utc,'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,'frame':'ITRF','profile':orbit.profile,'position_m':list(row.position_m),'eop_sha256':result.eop_sha256,'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','eop_quality':quality}
        return await self.execute(compute)

    async def samples(self,group,catalog_number,expected_hash,start_utc,step_seconds,count,ground_point,minimum_elevation_deg,client_request_id):
        if type(count) is not int or not 1<=count<=601 or type(step_seconds) is not int or not 1<=step_seconds<=60:raise ValueError('catalog sample grid outside limits')
        if isinstance(minimum_elevation_deg,bool) or not math.isfinite(minimum_elevation_deg) or not 0<=minimum_elevation_deg<=90:raise ValueError('minimum elevation outside limits')
        start=parse_utc(start_utc)
        values,item,orbit,digest=await self._input(group,catalog_number)
        if expected_hash!=digest:raise CatalogGpChanged('catalog GP changed; reselect before calculating')
        def compute():
            times=(start.as_time()+TimeDelta(np.arange(count)*step_seconds,format='sec',scale='tai')).utc
            utc=format_utc_times(times)
            qualities=[self.eop.quality(t) for t in parse_utc_batch(utc)]
            result=self.calculate(orbit,utc,ground_point)
            if len(result.rows)!=count or result.frame!='ITRF' or result.profile!=orbit.profile or result.eop_sha256!=self.eop.eop_sha256 or result.leap_sha256!=self.eop.leap_sha256:raise ValueError('catalog calculation provenance or row count mismatch')
            rows=[]
            for time,row,quality in zip(utc,result.rows,qualities):
                if row.utc!=time:raise ValueError('catalog calculation UTC mismatch')
                output={'utc':time,'status':'error' if row.error_code else 'valid','error_code':row.error_code,'position_m':None,'elevation_deg':None,'range_m':None,'azimuth_deg':None,'visible':None,'eop_quality':quality}
                if not row.error_code:
                    if row.position_m is None or len(row.position_m)!=3 or not all(math.isfinite(v) for v in row.position_m) or row.elevation_deg is None or not math.isfinite(row.elevation_deg) or abs(row.elevation_deg)>90:raise ValueError('invalid catalog calculation row')
                    distance,azimuth=observation_geometry([row.position_m],ground_point)[0]
                    output.update(position_m=list(row.position_m),elevation_deg=row.elevation_deg,range_m=distance,azimuth_deg=azimuth,visible=row.elevation_deg>=minimum_elevation_deg)
                rows.append(output)
            failed=sum(row['status']=='error' for row in rows)
            return {'version':1,'status':'error' if failed==count else 'partial' if failed else 'valid','client_request_id':client_request_id,'group':group,'catalog_number':catalog_number,'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,'start_utc':utc[0],'step_seconds':step_seconds,'count':count,'ground_point':{'latitude_deg':ground_point.latitude_deg,'longitude_deg':ground_point.longitude_deg,'ellipsoid_height_m':ground_point.ellipsoid_height_m,'virtual':True,'ellipsoid':'WGS84'},'minimum_elevation_deg':minimum_elevation_deg,'frame':result.frame,'profile':result.profile,'eop_sha256':result.eop_sha256,'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','communication_status':'unknown','units':{'position':'m','range':'m','elevation':'deg','azimuth':'deg','time':'UTC'},'rows':rows}
        return await self.execute(compute)
