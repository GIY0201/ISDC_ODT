"""Verify and accept one immutable native analysis input scope in the existing runtime."""
from copy import deepcopy
from hashlib import sha256
import json
import asyncio
from digital_twin.contracts.satellite_nodes import prepare_node_definitions
from foundation.mission_planning_errors import MissionPlanningConflict
from digital_twin.contracts.orbit import OrbitUnavailable
from user_application.mission_windows import validate_native_window_points

class MissionContextQuery:
    def __init__(self, runtime, node_query, module, catalog_query):
        self.runtime=runtime;self.node_query=node_query;self.module=module;self.catalog_query=catalog_query

    async def accept(self, command):
        captured=deepcopy(command);deployment=self.runtime.data_deployment();faults=self.runtime.status()['active_faults']
        if (captured['run_id']!=deployment['run_id'] or captured['deployment_revision']!=deployment['revision'] or not deployment['nodes']
            or captured['faults']!=faults):raise MissionPlanningConflict('accepted deployment/run/faults changed or empty')
        projection=[{k:node[k] for k in ('id','name','mode')}|{'equipment':[{k:item[k] for k in ('id','catalog','enabled')} for item in node['equipment']]} for node in captured['nodes']]
        if projection!=deployment['nodes']:raise MissionPlanningConflict('full native definitions do not match accepted equipment roster')
        status=await asyncio.to_thread(self.module.status)
        if status.get('instance_id')!=captured['module_instance'] or status.get('sequence')!=captured['module_sequence']:
            raise MissionPlanningConflict('mission module instance or sequence changed')
        prepared=prepare_node_definitions(captured['nodes']);hashes={p.node_id:p.definition_hash for p in prepared}
        reply=await self.node_query.points(captured['nodes'],[captured['utc']],captured['request_id'])
        try:validate_native_window_points(reply,captured['nodes'],[captured['utc']],captured['request_id'],hashes)
        except ValueError as error:raise RuntimeError('required native mission input receipt invalid') from error
        if captured.get('external'):
            query=self.catalog_query();external=captured['external']
            if query is None:raise OrbitUnavailable('precise external catalog unavailable')
            r=await query.points(external['group'],external['catalog_number'],external['normalized_gp_sha256'],[captured['utc']],captured['request_id'])
            if r['status']!='valid' or any(r.get(k)!=external[k] for k in ('normalized_gp_sha256','eop_sha256','leap_sha256','profile')):
                raise MissionPlanningConflict('external GP/EOP/leap context changed')
        current=await asyncio.to_thread(self.module.status)
        if current.get('instance_id')!=captured['module_instance'] or current.get('sequence')!=captured['module_sequence']:
            raise MissionPlanningConflict('mission module changed during native verification')
        value={'schema_version':1,'status':'verified_analysis_inputs','deployment':deployment,'faults':faults,'utc':captured['utc'],
               'nodes':captured['nodes'],'stations':captured['stations'],'external':captured.get('external'),
               'module_instance':captured['module_instance'],'module_sequence':captured['module_sequence'],
               'definition_hashes':hashes,'communication_status':'unknown'}
        encoded=json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
        value['context_hash']=sha256(encoded).hexdigest()
        return await self.runtime.accept_mission_context(value)
