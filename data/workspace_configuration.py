"""Durable authored definitions, separate from runtime state."""
import json
from copy import deepcopy
from digital_twin.contracts.workspace_configuration import ConfigurationConflict, ConfigurationUnavailable
KINDS = ('ground_stations', 'scenario_drafts')

def validate_configuration(kind, value):
    if kind not in KINDS: raise ValueError('unknown configuration kind')
    if len(json.dumps(value, allow_nan=False).encode()) > 1_000_000: raise ValueError('configuration size limit')
    if not isinstance(value, dict) or value.get('schema') != 1 or type(value.get('sequence')) is not int or value['sequence'] < 0: raise ValueError('invalid schema')
    roster=value.get('stations' if kind=='ground_stations' else 'items')
    if not isinstance(roster,list) or len(roster)>(24 if kind=='ground_stations' else 48): raise ValueError('invalid roster')
    ids=set()
    for item in roster:
        if not isinstance(item,dict) or not isinstance(item.get('id'),str) or not 1<=len(item['id'])<=80 or item['id'] in ids: raise ValueError('invalid definition identifier')
        ids.add(item['id'])
        if kind=='ground_stations':
            for field,low,high in [('latitude',-90,90),('longitude',-180,180),('altitude_km',-.5,9),('dish_m',.5,70),('min_elevation_deg',0,89.999999)]:
                n=item.get(field)
                if type(n) not in (int,float) or not low<=n<=high: raise ValueError('invalid station '+field)
            if type(item.get('enabled')) is not bool or not isinstance(item.get('name'),str) or not item['name'].strip() or len(item['name'])>40 or not isinstance(item.get('bands'),list) or not item['bands'] or any(b not in ('S','X','Ka') for b in item['bands']): raise ValueError('invalid station equipment')
        elif not isinstance(item.get('name'),str) or not item['name'].strip() or not isinstance(item.get('objective'),str) or not item['objective'].strip() or not isinstance(item.get('steps'),list) or not 1<=len(item['steps'])<=128: raise ValueError('invalid scenario')
    return deepcopy(value)

class PostgresWorkspaceConfiguration:
    def __init__(self, connection, *, workspace_id='default'):
        self.connection=dict(connection);self.workspace_id=workspace_id
    def _connect(self):
        import psycopg
        try: return psycopg.connect(**self.connection,connect_timeout=3,options='-c statement_timeout=5000')
        except psycopg.Error as exc: raise ConfigurationUnavailable('DB에 접속할 수 없습니다. 작성 내용을 보존했습니다.') from exc
    def read(self,kind):
        if kind not in KINDS: raise ValueError('unknown configuration kind')
        with self._connect() as c: row=c.execute('SELECT revision,value,updated_at FROM workspace_configuration WHERE workspace_id=%s AND kind=%s',(self.workspace_id,kind)).fetchone()
        return {'kind':kind,'revision':row[0] if row else 0,'value':row[1] if row else None,'updated_at':row[2].isoformat() if row else None}
    def save(self,kind,value,expected_revision):
        from psycopg.types.json import Jsonb
        value=validate_configuration(kind,value)
        if type(expected_revision) is not int or expected_revision<0: raise ValueError('invalid revision')
        with self._connect() as c:
            if expected_revision==0:
                row=c.execute('INSERT INTO workspace_configuration(workspace_id,kind,revision,value) VALUES(%s,%s,1,%s) ON CONFLICT DO NOTHING RETURNING revision,updated_at',(self.workspace_id,kind,Jsonb(value))).fetchone()
            else:
                row=c.execute('UPDATE workspace_configuration SET revision=revision+1,value=%s,updated_at=clock_timestamp() WHERE workspace_id=%s AND kind=%s AND revision=%s RETURNING revision,updated_at',(Jsonb(value),self.workspace_id,kind,expected_revision)).fetchone()
            if not row: raise ConfigurationConflict('다른 창에서 설정이 변경됐습니다. 현재 편집을 보존하고 서버 설정을 다시 불러오세요.')
            c.execute('INSERT INTO workspace_configuration_history(workspace_id,kind,revision,value) VALUES(%s,%s,%s,%s)',(self.workspace_id,kind,row[0],Jsonb(value)))
        return {'kind':kind,'revision':row[0],'value':value,'updated_at':row[1].isoformat()}
    def history(self,kind):
        with self._connect() as c: rows=c.execute('SELECT revision,value FROM workspace_configuration_history WHERE workspace_id=%s AND kind=%s ORDER BY revision DESC LIMIT 100',(self.workspace_id,kind)).fetchall()
        return [{'revision':r[0],'value':r[1]} for r in rows]
    def remove_test_workspace(self):
        if not self.workspace_id.startswith('test-'): raise ValueError('test workspace required')
        with self._connect() as c:
            c.execute('DELETE FROM workspace_configuration_history WHERE workspace_id=%s',(self.workspace_id,))
            c.execute('DELETE FROM workspace_configuration WHERE workspace_id=%s',(self.workspace_id,))
