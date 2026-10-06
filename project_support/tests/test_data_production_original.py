"""Original four-hour component regression, source1a1e002/test SHA446243e90291a475331ba37cb750e18bd16b7c8271b662b2eff63008e5f1c09a."""

def node(node_id="SDC-A", *, storage=True, camera=False, mode="nominal"):
    equipment = [{"id": "store", "catalog": "dtn_store", "enabled": True}] if storage else []
    if camera:
        equipment.append({"id": "camera", "catalog": "eo_camera", "enabled": True})
    return {"id": node_id, "name": f"이름 {node_id}", "mode": mode, "equipment": equipment}

def test_four_hour_sync_does_not_drop_telemetry_or_camera_slots():
    from digital_twin.simulation.data_deployment import deployment_inputs, deployment_products
    inputs = deployment_inputs({"nodes": [node(camera=True)]}, [])
    products = deployment_products(inputs, 0, 14400)
    assert sum(item["class"] == "telemetry" for item in products) == 480
    assert sum(item["class"] == "imagery" for item in products) == 160
    assert len({item["ref"] for item in products}) == 640
    assert max(item["created_s"] for item in products) == 14400
