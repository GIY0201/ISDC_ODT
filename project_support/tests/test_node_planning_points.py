import asyncio
import json
from copy import deepcopy
from dataclasses import replace
import pytest
from user_application.node_geometry import NodeGeometryQuery
from project_support.tests.test_node_samples import definition,batch

TIMES=['2026-10-04T22:01:12.000000000Z','2026-10-04T22:01:42.000000000Z','2026-10-04T22:01:43.250000000Z']

def test_arbitrary_exact_utc_grid_reuses_existing_native_calculation_and_executor():
    calls=[];executions=[];nodes=[definition(),definition('N-2',900002)]
    async def execute(fn):executions.append(fn);return fn()
    def calculate(prepared,grids):calls.append(grids);return batch(prepared,grids)
    query=NodeGeometryQuery(calculate=calculate,execute=execute)
    result=asyncio.run(query.points(nodes,TIMES,'plan-points'))
    assert len(executions)==len(calls)==1
    assert [[t.iso_utc for t in grid] for grid in calls[0]]==[TIMES,TIMES]
    assert result['request_id']=='plan-points' and result['status']=='valid'
    assert [n['node_id'] for n in result['nodes']]==['N-1','N-2']
    assert all([r['utc'] for r in n['rows']]==TIMES for n in result['nodes'])

@pytest.mark.parametrize('times',[[],TIMES*201,TIMES[::-1],[TIMES[0],TIMES[0]],'2026-10-04T22:01:12Z',['bad'],[None]])
def test_invalid_or_nonincreasing_grid_is_rejected_before_executor(times):
    async def execute(fn):pytest.fail('invalid input reached executor')
    with pytest.raises(ValueError):asyncio.run(NodeGeometryQuery(execute=execute).points([definition()],times,'invalid'))

def test_rows_limit_and_caller_mutation_before_executor_are_fenced():
    nodes=[definition()];times=deepcopy(TIMES)
    from communication.native.node_adapter import prepare_node_definitions
    expected_hash=prepare_node_definitions(deepcopy(nodes))[0].definition_hash
    async def execute(fn):nodes[0]['orbit']['altitude_km']=999;times.reverse();return fn()
    result=asyncio.run(NodeGeometryQuery(calculate=batch,execute=execute).points(nodes,times,'copied'))
    assert [r['utc'] for r in result['nodes'][0]['rows']]==TIMES
    assert result['nodes'][0]['definition_hash']==expected_hash
    async def forbidden(fn):pytest.fail('oversized grid reached executor')
    nodes=[definition('N-'+str(i),900001+i) for i in range(84)]
    from foundation.orbit_time import parse_utc,format_utc_batch,UtcInstant
    from astropy.time import TimeDelta
    values=format_utc_batch(tuple(UtcInstant(float(t.jd1),float(t.jd2)) for t in (parse_utc(TIMES[0]).as_time()+TimeDelta(list(range(601)),format='sec')).utc))
    with pytest.raises(ValueError):asyncio.run(NodeGeometryQuery(execute=forbidden).points(nodes,list(values),'oversized'))

def test_leap_error_alignment_and_malformed_native_receipts_are_preserved():
    values=['2016-12-31T23:59:59Z','2016-12-31T23:59:60Z','2017-01-01T00:00:00Z']
    result=asyncio.run(NodeGeometryQuery(calculate=batch).points([definition()],values,'leap'))
    assert result['status']=='partial'
    assert [r['status'] for r in result['nodes'][0]['rows']]==['valid','error','valid']
    assert result['nodes'][0]['rows'][1]['error_code']=='unsupported_node_time'
    def wrong(prepared,grids):return replace(batch(prepared,grids),utc=tuple(reversed(TIMES)))
    with pytest.raises(RuntimeError):asyncio.run(NodeGeometryQuery(calculate=wrong).points([definition()],TIMES,'wrong'))
