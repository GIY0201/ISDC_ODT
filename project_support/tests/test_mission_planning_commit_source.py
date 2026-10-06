import pytest
from digital_twin.runtime.mission_planning.stand_in import OrchestrationStandIn

T0 = "2026-09-08T00:00:00Z"
TASKS = [{"id": "MSN-0001-T01", "kind": "crosslink", "satellite": "S1", "counterpart": "S2", "start": "2026-09-08T00:00:00Z", "end": "2026-09-08T00:01:36Z"},
         {"id": "MSN-0001-T02", "kind": "crosslink", "satellite": "S2", "counterpart": "S3", "start": "2026-09-08T00:01:41Z", "end": "2026-09-08T00:03:17Z"}]


def test_stand_in_records_committed_plans_and_releases_them_on_abort():
    module = OrchestrationStandIn()
    answer = module.commit({"time": T0, "mission_id": "MSN-0001", "decision": "commit", "version": 2, "tasks": TASKS})
    assert answer["accepted"] is True and answer["held_tasks"] == 2 and answer["sequence"] == 1
    status = module.status()
    assert status["committed"] == {"MSN-0001": {"version": 2, "tasks": 2}}
    assert module.commit({"time": T0, "mission_id": "MSN-0001", "decision": "abort"})["held_tasks"] == 0
    assert module.status()["committed"] == {}
    with pytest.raises(ValueError):
        module.commit({"time": T0, "mission_id": "", "decision": "commit"})
    with pytest.raises(ValueError):
        module.commit({"time": T0, "mission_id": "MSN-0001", "decision": "maybe"})
    with pytest.raises(ValueError):
        module.commit({"time": T0, "mission_id": "MSN-0001", "decision": "commit", "tasks": [{"satellite": "S1", "start": "2026-09-08T00:02:00Z", "end": "2026-09-08T00:01:00Z"}]})

