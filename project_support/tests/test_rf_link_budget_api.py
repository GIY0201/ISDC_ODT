"""Synthetic generic RF inputs; no actual spacecraft or communication claims.

Exercise the unchanged public endpoint and independently derive its documented
RF-Friis-v1 metrics. These are API regression tests, not equipment validation.
"""
import math

import pytest
from fastapi.testclient import TestClient

from user_application.web.application import create_app


ENDPOINT = "/api/communication/link-budget"
SYNTHETIC = dict(
    link_id="synthetic-editable-link", frequency_ghz=2.4, distance_km=500.0,
    tx_power_w=5.0, tx_gain_dbi=20.0, rx_gain_dbi=25.0,
    misc_losses_db=4.5, bandwidth_mhz=12.0, data_rate_mbps=6.0,
    system_temp_k=310.0, required_ebno_db=8.0,
)
LIMITS = [
    ("frequency_ghz", .1, 300, False),
    ("distance_km", 1, 100000, False),
    ("tx_power_w", .01, 100000, False),
    ("tx_gain_dbi", -20, 100, True),
    ("rx_gain_dbi", -20, 100, True),
    ("misc_losses_db", 0, 100, True),
    ("bandwidth_mhz", .001, 100000, False),
    ("data_rate_mbps", .001, 100000, False),
    ("system_temp_k", 1, 5000, False),
    ("required_ebno_db", -10, 50, True),
]


def expected_metrics(body):
    # The inherited 92.45 coefficient is part of the existing public model.
    path_loss = 92.45 + 20 * math.log10(body["frequency_ghz"] * body["distance_km"])
    eirp_w = body["tx_power_w"] * 10 ** (body["tx_gain_dbi"] / 10)
    received_w = eirp_w * 10 ** ((body["rx_gain_dbi"] - path_loss - body["misc_losses_db"]) / 10)
    bandwidth_hz = body["bandwidth_mhz"] * 1e6
    noise_w = 1.380649e-23 * body["system_temp_k"] * bandwidth_hz
    cn = 10 * math.log10(received_w / noise_w)
    ebno = 10 * math.log10(received_w / (1.380649e-23 * body["system_temp_k"] * body["data_rate_mbps"] * 1e6))
    return dict(
        eirp_dbw=10 * math.log10(eirp_w), fspl_db=path_loss,
        received_power_dbw=10 * math.log10(received_w),
        noise_power_dbw=10 * math.log10(noise_w), cn_db=cn,
        ebno_db=ebno, margin_db=ebno - body["required_ebno_db"],
        capacity_mbps=body["bandwidth_mhz"] * math.log2(1 + received_w / noise_w),
    )


def orbit_state(client):
    snapshot = client.get("/api/orbit/state").json()
    # Observation time advances on each GET, independently of state mutation.
    snapshot.pop("observed_monotonic_s")
    return snapshot


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as test_client:
        # Exclude the independent simulation clock from the state comparison.
        assert test_client.post("/api/runtime/control", json={"action": "pause"}).status_code == 200
        yield test_client


def test_full_editable_synthetic_request_has_expected_response_without_state_mutation(client):
    runtime_before = client.app.state.runtime.snapshot()
    orbit_before = orbit_state(client)
    response = client.post(ENDPOINT, json=SYNTHETIC)
    assert response.status_code == 200
    result = response.json()
    expected = expected_metrics(SYNTHETIC)
    assert set(result) == set(expected) | {"link_id", "model", "inputs", "status", "assumptions"}
    assert result["inputs"] == SYNTHETIC
    assert result["link_id"] == SYNTHETIC["link_id"]
    assert result["model"] == "RF-Friis-v1"
    for key, value in expected.items():
        assert result[key] == pytest.approx(round(value, 3), abs=1e-10)
    assert result["status"] == "pass"
    assert result["assumptions"] == ["자유공간 손실", "시스템 잡음온도 일정", "misc_losses_db에 대기·포인팅·케이블 손실 포함"]
    assert client.app.state.runtime.snapshot() == runtime_before
    assert orbit_state(client) == orbit_before


@pytest.mark.parametrize("margin,status,display", [
    (-.0004, "fail", 0.0), (.0004, "marginal", 0.0),
    (2.9996, "marginal", 3.0), (3.0004, "pass", 3.0),
    (-.01, "fail", -.01), (3.01, "pass", 3.01),
])
def test_status_uses_unrounded_margin_at_synthetic_thresholds(client, margin, status, display):
    body = SYNTHETIC | {"required_ebno_db": expected_metrics(SYNTHETIC)["ebno_db"] - margin}
    response = client.post(ENDPOINT, json=body)
    assert response.status_code == 200
    assert response.json()["status"] == status
    assert response.json()["margin_db"] == pytest.approx(display, abs=1e-10)


@pytest.mark.parametrize("field,lower,upper,inclusive", LIMITS)
@pytest.mark.parametrize("boundary", ["lower", "just_above", "upper", "outside_upper", "outside_lower"])
def test_all_synthetic_numeric_field_boundaries(client, field, lower, upper, inclusive, boundary):
    value = {"lower": lower, "just_above": math.nextafter(lower, math.inf),
             "upper": upper, "outside_upper": math.nextafter(upper, math.inf),
             "outside_lower": math.nextafter(lower, -math.inf)}[boundary]
    accepted = boundary in {"just_above", "upper"} or boundary == "lower" and inclusive
    before = client.app.state.runtime.snapshot()
    orbit_before = orbit_state(client)
    response = client.post(ENDPOINT, json=SYNTHETIC | {field: value})
    assert response.status_code == (200 if accepted else 422)
    if not accepted:
        assert any(error["loc"] == ["body", field] for error in response.json()["detail"])
    assert client.app.state.runtime.snapshot() == before
    assert orbit_state(client) == orbit_before


@pytest.mark.parametrize("link_id,status", [("", 422), ("x", 200), ("x" * 40, 200), ("x" * 41, 422)])
def test_synthetic_link_identifier_boundaries(client, link_id, status):
    response = client.post(ENDPOINT, json=SYNTHETIC | {"link_id": link_id})
    assert response.status_code == status


def test_link_identifier_is_required_and_legacy_numeric_defaults_are_preserved(client):
    assert client.post(ENDPOINT, json={}).status_code == 422
    response = client.post(ENDPOINT, json={"link_id": "synthetic-defaults"})
    assert response.status_code == 200
    assert response.json()["inputs"] == dict(
        link_id="synthetic-defaults", frequency_ghz=26., distance_km=1200.,
        tx_power_w=20., tx_gain_dbi=32., rx_gain_dbi=34., misc_losses_db=3.,
        bandwidth_mhz=20., data_rate_mbps=10., system_temp_k=290., required_ebno_db=7.,
    )
