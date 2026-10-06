"""Readonly catalog/native/precise-frame query assembly; no runtime ownership."""
import hashlib,json,math,re
from copy import deepcopy
from numbers import Real
from collections import OrderedDict
from dataclasses import dataclass,asdict
from threading import Lock
import numpy as np
from astropy.time import TimeDelta
from data.orbit_inputs import load_orbit_input_bytes
from digital_twin.contracts.orbit import GroundPoint,OrbitUnavailable
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from digital_twin.contracts.catalog_details import details_metadata,detail_row_payload
from digital_twin.simulation.orbit_geometry import observation_geometry,teme_positions_at_utc
from communication.native.orbit_adapter import prepare_catalog_orbits,propagate_catalog
from foundation.orbit_time import parse_utc,parse_utc_batch,format_utc_times
from digital_twin.simulation.visibility import search_visibility


@dataclass(frozen=True)
class PreparedSceneRow:
    catalog_number: int
    name: str
    orbit_regime: str
    normalized_gp_sha256: str
    epoch_utc: str|None
    error_code: str|None


@dataclass(frozen=True)
class PreparedScene:
    rows: tuple[PreparedSceneRow,...]
    valid_indices: tuple[int,...]
    native_inputs: tuple

class CatalogGeometryQuery:
    def __init__(self,catalog,eop,calculate,execute):
        self.catalog=catalog;self.eop=eop;self.calculate=calculate;self.execute=execute
        # GP preparation only: no propagated/current runtime states are cached.
        self._scene_prepared=OrderedDict();self._scene_lock=Lock()

    async def track(self,group,catalog_number,expected_hash,utc,client_request_id):
        instant=parse_utc(utc)
        values,item,orbit,digest=await self._input(group,catalog_number)
        if expected_hash!=digest:raise CatalogGpChanged('catalog GP changed; reselect before calculating')
        def compute():
            motion=float(item['MEAN_MOTION'])
            if not math.isfinite(motion) or motion<=0:raise ValueError('invalid catalog mean motion')
            period=86400/motion
            if not math.isfinite(period):raise ValueError('catalog period outside limits')
            half=period/2;dense=min(45.,half)
            coarse=np.linspace(-half,half,121)
            offsets=np.unique(np.round(np.concatenate((coarse[np.abs(coarse)>45],np.arange(-dense,dense+1e-8,.1),[-half,0,half])),9))
            times=(instant.as_time()+TimeDelta(offsets,format='sec',scale='tai')).utc
            stamps=list(format_utc_times(times));stamps[int(np.flatnonzero(offsets==0)[0])]=instant.iso_utc
            result=self.calculate(orbit,stamps,GroundPoint(0,0,0))
            if len(result.rows)!=len(stamps) or result.frame!='ITRF' or result.profile!=orbit.profile or result.eop_sha256!=self.eop.eop_sha256 or result.leap_sha256!=self.eop.leap_sha256:raise ValueError('catalog track provenance mismatch')
            rows=[]
            for stamp,row in zip(stamps,result.rows):
                if row.utc!=stamp:raise ValueError('catalog track UTC mismatch')
                if row.error_code is not None and (not isinstance(row.error_code,str) or not row.error_code):raise ValueError('invalid track error')
                if row.error_code is None and (row.position_m is None or len(row.position_m)!=3 or not all(math.isfinite(x) for x in row.position_m)):raise ValueError('invalid track position')
                rows.append(dict(utc=stamp,status='error' if row.error_code else 'valid',error_code=row.error_code,position_m=None if row.error_code else list(row.position_m),eop_quality=self.eop.quality(parse_utc(stamp))))
            failed=sum(row['status']=='error' for row in rows)
            return dict(version=1,status='error' if failed==len(rows) else 'partial' if failed else 'valid',group=group,catalog_number=catalog_number,client_request_id=client_request_id,name=item.get('OBJECT_NAME',''),source=values['source'],fetched_at=values['fetched_at'],warning=values.get('warning',''),stale=bool(values.get('stale',False)),normalized_gp_sha256=digest,epoch_utc=orbit.epoch_utc,reference_utc=instant.iso_utc,period_seconds=period,count=len(rows),valid_count=len(rows)-failed,error_count=failed,rows=rows,frame=result.frame,profile=result.profile,eop_sha256=result.eop_sha256,leap_sha256=result.leap_sha256,eop_kind='IERS_A',units={'position':'m','time':'UTC','period':'s'})
        return await self.execute(compute)

    async def visibility(self,group,catalog_number,expected_hash,start_utc,end_utc,ground_point,minimum_elevation_deg,client_request_id):
        start=parse_utc(start_utc);end=parse_utc(end_utc)
        values,item,orbit,digest=await self._input(group,catalog_number)
        if expected_hash!=digest:raise CatalogGpChanged('catalog GP changed; reselect before calculating')
        def compute():
            vector=getattr(self.calculate,'evaluate_times',None)
            result=search_visibility(calculate=lambda stamps:self.calculate(orbit,stamps,ground_point),calculate_times=(lambda times:vector(orbit,times,ground_point)) if callable(vector) else None,start_utc=start.iso_utc,end_utc=end.iso_utc,minimum_elevation_deg=minimum_elevation_deg)
            if result.eop_sha256!=self.eop.eop_sha256 or result.leap_sha256!=self.eop.leap_sha256:raise ValueError('catalog visibility provenance mismatch')
            value=asdict(result)
            value.update(version=1,group=group,catalog_number=catalog_number,client_request_id=client_request_id,name=item.get('OBJECT_NAME',''),source=values['source'],fetched_at=values['fetched_at'],warning=values.get('warning',''),stale=bool(values.get('stale',False)),normalized_gp_sha256=digest,epoch_utc=orbit.epoch_utc,eop_kind='IERS_A',ground_point={'latitude_deg':ground_point.latitude_deg,'longitude_deg':ground_point.longitude_deg,'ellipsoid_height_m':ground_point.ellipsoid_height_m,'virtual':True,'ellipsoid':'WGS84'},communication_status='unknown',units={'time':'UTC','elevation':'deg','duration':'s'})
            return value
        return await self.execute(compute)

    async def scene(self,group,query,orbit,utc,client_request_id,expected_scene_sha256=None):
        if group not in {g['id'] for g in self.catalog.catalog_groups()}:raise ValueError('unknown catalog group')
        if not isinstance(query,str) or len(query)>100:raise ValueError('catalog query outside limits')
        if orbit not in ('all','LEO','MEO','GEO','HEO'):raise ValueError('unknown orbit filter')
        if not isinstance(client_request_id,str) or not client_request_id.strip() or len(client_request_id)>128:raise ValueError('invalid request id')
        if expected_scene_sha256 is not None and (not isinstance(expected_scene_sha256,str) or not re.fullmatch('[a-f0-9]{64}',expected_scene_sha256)):
            raise ValueError('invalid scene hash')
        instant=parse_utc(utc)
        values=await self.catalog.get_satellites(group=group,limit=0,query=query,orbit=orbit)
        if values.get('source') not in ('celestrak-live','celestrak-cache','celestrak-stale'):
            raise OrbitUnavailable('current catalog GP unavailable; demo is not propagated')
        def compute():
            items=values['items']
            if values.get('truncated') or values.get('filtered_total',len(items))!=len(items):
                raise ValueError('incomplete catalog snapshot')
            numbers=[item.get('NORAD_CAT_ID') for item in items]
            if any(type(number) is not int or not 1<=number<=999999999 for number in numbers):raise ValueError('invalid catalog identity')
            if len(set(numbers))!=len(numbers):raise ValueError('duplicate catalog identities')
            # Same normalized serialization as selected position/samples hashes.
            # Invalid nonfinite GP still gets an identity/hash and a masked error.
            raw=[json.dumps(item,sort_keys=True).encode() for item in items]
            hashes=[hashlib.sha256(payload).hexdigest() for payload in raw]
            digest=hashlib.sha256(json.dumps([group,query,orbit,hashes],ensure_ascii=True).encode()).hexdigest()
            if expected_scene_sha256 is not None and digest!=expected_scene_sha256:
                raise CatalogGpChanged('catalog scene GP changed; reload before calculating')
            quality=self.eop.quality(instant);point=self.eop.at(instant)
            with self._scene_lock:
                prepared=self._scene_prepared.get(digest)
                if prepared is None:
                    rows=[];indices=[];native_inputs=[]
                    for index,(item,payload,gp_hash) in enumerate(zip(items,raw,hashes)):
                        epoch=None;error=None
                        try:
                            if item.get('demo'):raise ValueError('demo is not propagated')
                            parsed=load_orbit_input_bytes(payload,format='OMM',source=values['source'],
                                fetched_utc=values['fetched_at'],expected_sha256=gp_hash)
                            native_inputs.extend(prepare_catalog_orbits((parsed,)))
                            indices.append(index);epoch=parsed.epoch_utc
                        except ValueError:error='invalid catalog GP'
                        rows.append(PreparedSceneRow(numbers[index],str(item.get('OBJECT_NAME','')),
                            str(item.get('ORBIT_REGIME','')),gp_hash,epoch,error))
                    prepared=PreparedScene(tuple(rows),tuple(indices),tuple(native_inputs))
                    self._scene_prepared[digest]=prepared
                self._scene_prepared.move_to_end(digest)
                while len(self._scene_prepared)>2:self._scene_prepared.popitem(last=False)
            batch=propagate_catalog(prepared.native_inputs,instant)
            expected_ids=tuple(row.input_id for row in prepared.native_inputs)
            if batch.input_ids!=expected_ids or len(batch.errors)!=len(expected_ids) or batch.frame!='TEME' or batch.profile!='WGS72_AFSPC' or batch.utc!=instant.iso_utc:
                raise ValueError('catalog native identity or provenance mismatch')
            valid,teme=batch.valid_rows()
            positions=teme_positions_at_utc(teme[:,:3],instant,point)
            transformed={prepared.valid_indices[i]:list(map(float,p)) for i,p in zip(valid,positions)}
            failures={prepared.valid_indices[i]:error for i,error in enumerate(batch.errors) if error is not None}
            rows=[]
            for index,row in enumerate(prepared.rows):
                error=row.error_code or failures.get(index)
                rows.append(dict(catalog_number=row.catalog_number,name=row.name,orbit_regime=row.orbit_regime,
                    normalized_gp_sha256=row.normalized_gp_sha256,epoch_utc=row.epoch_utc,
                    status='error' if error else 'valid',error_code=error,position_m=transformed.get(index)))
            failed=sum(row['status']=='error' for row in rows);count=len(rows)
            return dict(version=1,status='error' if count and failed==count else 'partial' if failed else 'valid',
                client_request_id=client_request_id,group=group,query=query,orbit=orbit,utc=instant.iso_utc,
                scene_sha256=digest,source=values['source'],fetched_at=values['fetched_at'],warning=values.get('warning',''),
                stale=bool(values.get('stale',False)),count=count,valid_count=count-failed,error_count=failed,
                frame='ITRF',profile=batch.profile,eop_kind='IERS_A',eop_quality=quality,
                eop_sha256=point.snapshot_sha256,leap_sha256=point.leap_sha256,
                units={'position':'m','time':'UTC'},rows=rows)
        return await self.execute(compute)
    async def _input(self,group,catalog_number):
        if group not in {g['id'] for g in self.catalog.catalog_groups()}:raise ValueError('unknown catalog group')
        values=await self.catalog.get_satellites(group=group,limit=0,query=str(catalog_number))
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
            detail_calculate=getattr(self.calculate,'catalog_details',None)
            result=(detail_calculate if callable(detail_calculate) else self.calculate)(orbit,[orbit.epoch_utc],GroundPoint(0,0,0))
            metadata=details_metadata(result)
            if result.frame!='ITRF' or result.profile!=orbit.profile or result.eop_sha256!=self.eop.eop_sha256 or result.leap_sha256!=self.eop.leap_sha256 or len(result.rows)!=1:raise ValueError('catalog position provenance mismatch')
            row=result.rows[0]
            if row.error_code or row.position_m is None:raise ValueError('native propagation failed: '+str(row.error_code))
            payload={'version':1,'status':'valid','group':group,'catalog_number':catalog_number,'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),'utc':row.utc,'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,'frame':'ITRF','profile':orbit.profile,'position_m':list(row.position_m),'eop_sha256':result.eop_sha256,'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','eop_quality':quality}
            if metadata:payload.update(metadata,**detail_row_payload(row))
            return payload
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
            detail_calculate=getattr(self.calculate,'catalog_details',None)
            result=(detail_calculate if callable(detail_calculate) else self.calculate)(orbit,utc,ground_point)
            metadata=details_metadata(result)
            if len(result.rows)!=count or result.frame!='ITRF' or result.profile!=orbit.profile or result.eop_sha256!=self.eop.eop_sha256 or result.leap_sha256!=self.eop.leap_sha256:raise ValueError('catalog calculation provenance or row count mismatch')
            rows=[]
            for time,row,quality in zip(utc,result.rows,qualities):
                if row.utc!=time:raise ValueError('catalog calculation UTC mismatch')
                output={'utc':time,'status':'error' if row.error_code else 'valid','error_code':row.error_code,'position_m':None,'elevation_deg':None,'range_m':None,'azimuth_deg':None,'visible':None,'eop_quality':quality}
                if not row.error_code:
                    if row.position_m is None or len(row.position_m)!=3 or not all(math.isfinite(v) for v in row.position_m) or row.elevation_deg is None or not math.isfinite(row.elevation_deg) or abs(row.elevation_deg)>90:raise ValueError('invalid catalog calculation row')
                    distance,azimuth=observation_geometry([row.position_m],ground_point)[0]
                    output.update(position_m=list(row.position_m),elevation_deg=row.elevation_deg,range_m=distance,azimuth_deg=azimuth,visible=row.elevation_deg>=minimum_elevation_deg)
                if metadata:output.update(detail_row_payload(row))
                rows.append(output)
            failed=sum(row['status']=='error' for row in rows)
            payload={'version':1,'status':'error' if failed==count else 'partial' if failed else 'valid','client_request_id':client_request_id,'group':group,'catalog_number':catalog_number,'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,'start_utc':utc[0],'step_seconds':step_seconds,'count':count,'ground_point':{'latitude_deg':ground_point.latitude_deg,'longitude_deg':ground_point.longitude_deg,'ellipsoid_height_m':ground_point.ellipsoid_height_m,'virtual':True,'ellipsoid':'WGS84'},'minimum_elevation_deg':minimum_elevation_deg,'frame':result.frame,'profile':result.profile,'eop_sha256':result.eop_sha256,'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','communication_status':'unknown','units':{'position':'m','range':'m','elevation':'deg','azimuth':'deg','time':'UTC'},'rows':rows}
            payload.update(metadata)
            return payload
        return await self.execute(compute)


    async def points(self,group,catalog_number,expected_hash,utc,client_request_id):
        """Explicit planning/refinement instants, through the existing precise catalog calculator."""
        if type(catalog_number) is not int or not 1<=catalog_number<=999999999:
            raise ValueError('valid catalog identity required')
        if not isinstance(expected_hash,str) or not re.fullmatch('[a-f0-9]{64}',expected_hash):
            raise ValueError('explicit catalog GP hash required')
        if not isinstance(client_request_id,str) or not client_request_id.strip() or len(client_request_id)>128:
            raise ValueError('valid point request identity required')
        if not isinstance(utc,(list,tuple)) or not 1<=len(utc)<=601:
            raise ValueError('explicit catalog point grid1..601 required')
        instants=tuple(parse_utc(value) for value in utc)
        if any(b.as_time()<=a.as_time() for a,b in zip(instants,instants[1:])):
            raise ValueError('catalog points must be strictly increasing')
        stamps=tuple(instant.iso_utc for instant in instants)
        eop=self.eop;calculate=self.calculate
        values,item,orbit,digest=await self._input(group,catalog_number)
        if expected_hash!=digest:raise CatalogGpChanged('catalog GP changed; reselect before calculating')
        values=deepcopy(values);item=deepcopy(item)
        def compute():
            qualities=[eop.quality(instant) for instant in instants]
            result=calculate(orbit,list(stamps),GroundPoint(0,0,0))
            if (len(result.rows)!=len(stamps) or result.frame!='ITRF' or result.profile!=orbit.profile
                or result.eop_sha256!=eop.eop_sha256 or result.leap_sha256!=eop.leap_sha256):
                raise ValueError('catalog point provenance or row count mismatch')
            rows=[]
            for stamp,row,quality in zip(stamps,result.rows,qualities):
                if row.utc!=stamp:raise ValueError('catalog point UTC mismatch')
                error=row.error_code
                if error is not None and (not isinstance(error,str) or not error.strip() or len(error)>128):
                    raise ValueError('invalid catalog point error code')
                position=None
                if error is None:
                    if (not isinstance(row.position_m,(tuple,list)) or len(row.position_m)!=3
                        or any(isinstance(v,bool) or not isinstance(v,Real) or not math.isfinite(v) for v in row.position_m)):
                        raise ValueError('invalid catalog point position')
                    position=[float(v) for v in row.position_m]
                rows.append({'utc':stamp,'status':'error' if error else 'valid','error_code':error,
                             'position_m':position,'eop_quality':quality})
            failed=sum(row['status']=='error' for row in rows)
            return {'version':1,'status':'error' if failed==len(rows) else 'partial' if failed else 'valid',
                    'client_request_id':client_request_id,'group':group,'catalog_number':catalog_number,
                    'name':item.get('OBJECT_NAME',''),'source':values['source'],'fetched_at':values['fetched_at'],
                    'warning':values.get('warning',''),'stale':bool(values.get('stale',False)),
                    'epoch_utc':orbit.epoch_utc,'normalized_gp_sha256':digest,
                    'count':len(rows),'valid_count':len(rows)-failed,'error_count':failed,
                    'frame':result.frame,'profile':result.profile,'eop_sha256':result.eop_sha256,
                    'leap_sha256':result.leap_sha256,'eop_kind':'IERS_A','communication_status':'unknown',
                    'units':{'position':'m','time':'UTC'},'rows':rows}
        return await self.execute(compute)
