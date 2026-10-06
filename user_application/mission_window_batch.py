"""One captured native mission-window request over already owned query ports."""
from copy import deepcopy
from dataclasses import asdict
import math,re,json
from digital_twin.contracts.orbit import OrbitUnavailable
from digital_twin.contracts.satellite_nodes import prepare_node_definitions
from digital_twin.contracts.mission_windows import MissionWindowSite,MissionAccessTarget
from foundation.orbit_time import parse_utc
from user_application.native_passes import NativeMissionPasses
from user_application.mission_windows import NativeMissionWindows
from user_application.native_crosslinks import NativeMissionCrosslinks

class MissionWindowQuery:
    def __init__(self,node_query,catalog_query):
        if not callable(catalog_query):raise TypeError('existing catalog query reader required')
        self.node_query=node_query;self.catalog_query=catalog_query

    async def calculate(self,nodes,sites,start_utc,end_utc,request_id,*,target=None,external=None,max_external_range_km=None):
        captured=deepcopy(nodes);prepared=prepare_node_definitions(captured)
        if not isinstance(sites,(list,tuple)) or len(sites)>64 or any(not isinstance(s,MissionWindowSite) for s in sites):raise ValueError('typed site list at most64 required')
        sites=deepcopy(tuple(sites));target=deepcopy(target);external=deepcopy(external)
        if len({site.station_id for site in sites})!=len(sites):raise ValueError('unique station identities required')
        if target is not None and not isinstance(target,MissionAccessTarget):raise ValueError('typed access target required')
        if not isinstance(request_id,str) or not request_id.strip() or len(request_id)>128:raise ValueError('valid window request id required')
        first,last=parse_utc(start_utc),parse_utc(end_utc)
        if not 0<float((last.as_time()-first.as_time()).sec)<=86400.00000001:raise ValueError('window horizon must be positive and at most24h')
        if ((external is None)!=(max_external_range_km is None) or (external is not None and
            (type(max_external_range_km) not in (int,float) or not math.isfinite(max_external_range_km) or max_external_range_km<=0))):
            raise ValueError('explicit external GP and positive range must be supplied together')
        if external is not None:
            if (not isinstance(external,dict) or type(external.get('catalog_number')) is not int or not 1<=external['catalog_number']<=999999999
                or not isinstance(external.get('group'),str) or not external['group'].strip() or external.get('profile')!='WGS72_AFSPC'
                or any(not isinstance(external.get(k),str) or not re.fullmatch('[a-f0-9]{64}',external[k]) for k in ('normalized_gp_sha256','eop_sha256','leap_sha256'))):
                raise ValueError('explicit precise external GP/EOP/leap identity required')
            json.dumps(external,allow_nan=False)
        catalog=self.catalog_query() if external is not None else None
        if external is not None and catalog is None:raise OrbitUnavailable('precise external catalog geometry unavailable')
        hashes={item.node_id:item.definition_hash for item in prepared};passes=NativeMissionPasses(self.node_query)
        contacts=[];contact_count=0
        for site in sites:
            report=await passes.passes(captured,site.ground_point,first.iso_utc,last.iso_utc,mask_degrees=site.minimum_elevation_deg)
            contact_count+=len(report['passes'])
            if contact_count>20000:raise ValueError('ICD-03 contact window capacity exceeded; result not published')
            contacts.append({'station_id':site.station_id,'geometry':report})
        eclipses=await NativeMissionWindows(self.node_query).eclipses(captured,first.iso_utc,last.iso_utc)
        access=await passes.access(captured,target.ground_point,first.iso_utc,last.iso_utc,off_nadir_degrees=target.off_nadir_degrees) if target else None
        if access is not None and len(access['passes'])>5000:raise ValueError('ICD-03 access window capacity exceeded; result not published')
        crosslinks=await NativeMissionCrosslinks(self.node_query,catalog,max_windows=5000).crosslinks(captured,external,first.iso_utc,last.iso_utc,max_range_km=max_external_range_km) if external else None
        reports=[item['geometry'] for item in contacts]+[eclipses]+([access] if access else [])+([crosslinks] if crosslinks else [])
        if any(report['definition_hashes']!=hashes for report in reports):raise RuntimeError('mission window input hashes changed')
        return {'schema_version':1,'status':'sampled','request_id':request_id,'node_definitions':captured,'definition_hashes':hashes,
            'conditions':{'sites':[asdict(site) for site in sites],'target':asdict(target) if target else None,
                'external':external,'max_external_range_km':max_external_range_km,'start_utc':first.iso_utc,'end_utc':last.iso_utc},
            'contact_reports':contacts,'eclipse_report':eclipses,'target_report':access,'external_report':crosslinks,
            'communication_status':'unknown'}
