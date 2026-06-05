"""Tests for the intelligence map and shallow categories endpoints."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[4]
API_DIR = ROOT / "apps" / "api"
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("PYTHONPATH", str(API_DIR))

from app.main import create_app  # noqa: E402


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


def test_intelligence_map_returns_every_state(client: TestClient) -> None:
    response = client.get("/dashboards/intelligence-map")
    assert response.status_code == 200
    body = response.json()
    state_names = {row["state"] for row in body["states"]}
    # Every union-territory/state present in the vendored TopoJSON should
    # also be present in the API response (36 entries in india-states.json).
    for expected in (
        "Delhi",
        "Maharashtra",
        "Karnataka",
        "Tamil Nadu",
        "Uttar Pradesh",
        "Andaman and Nicobar Islands",
        "Ladakh",
        "Lakshadweep",
    ):
        assert expected in state_names
    delhi = next(row for row in body["states"] if row["state"] == "Delhi")
    assert delhi["intensity_bin"] >= 1
    assert delhi["has_accountability_alert"] is True
    assert "Delhi" in body["accountability_alert_states"]


def test_intelligence_map_filters_by_fraud_type(client: TestClient) -> None:
    response = client.get("/dashboards/intelligence-map?fraud_type=personal_safety_extortion")
    assert response.status_code == 200
    body = response.json()
    assert body["total_complaints"] < 500
    # Top fraud type on every populated state must be canonical when filtered.
    for row in body["states"]:
        if row["report_count"] == 0:
            continue
        assert row["top_fraud_type"] == "personal_safety_extortion"


def test_intelligence_map_metric_amount(client: TestClient) -> None:
    response = client.get(
        "/dashboards/intelligence-map?metric=amount",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metric"] == "amount"
    assert "max_state_amount" in body


def test_intelligence_map_state_id_matches_topology(client: TestClient) -> None:
    """The state_id of every row must exactly match the ``st_nm`` value in
    the vendored TopoJSON so the frontend can join the two.
    """
    import json

    topo_path = (
        ROOT
        / "apps"
        / "web"
        / "lib"
        / "maps"
        / "india-states.json"
    )
    topo_names = {
        g["properties"]["st_nm"]
        for g in json.loads(topo_path.read_text())["objects"]["states"][
            "geometries"
        ]
    }
    response = client.get("/dashboards/intelligence-map")
    api_names = {row["state_id"] for row in response.json()["states"]}
    missing = topo_names - api_names
    assert not missing, f"API missing states present in TopoJSON: {missing}"


def test_state_district_rollup_for_delhi(client: TestClient) -> None:
    response = client.get(
        "/dashboards/intelligence-map/state/Delhi",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["state_id"] == "Delhi"
    assert body["state"] == "Delhi"
    assert body["report_count"] > 0
    assert body["districts"], "Delhi should have at least one district"
    for d in body["districts"]:
        assert d["district"]
        assert d["report_count"] >= 1
        assert d["total_amount"] >= 0


def test_state_district_rollup_unknown_state(client: TestClient) -> None:
    response = client.get(
        "/dashboards/intelligence-map/state/Atlantis",
    )
    assert response.status_code == 404


def test_state_district_rollup_no_pii(client: TestClient) -> None:
    """No PII, no Aadhaar/PAN/OTP/phone fields should ever be returned."""

    import re

    response = client.get(
        "/dashboards/intelligence-map/state/Delhi",
    )
    assert response.status_code == 200
    body = response.json()
    forbidden_keys = {
        "aadhaar",
        "pan",
        "otp",
        "pin",
        "password",
        "phone",
        "victim_name",
    }
    for d in body["districts"]:
        for key in forbidden_keys:
            assert key not in d, f"forbidden key {key} in district rollup"
    raw = response.text
    assert not re.search(r"\b\d{12}\b", raw), "Aadhaar-like 12-digit run leaked"
    assert not re.search(r"\b\d{10}\b", raw), "phone-like 10-digit run leaked"


def test_shallow_categories_lists_three(client: TestClient) -> None:
    response = client.get("/intake/shallow-categories")
    assert response.status_code == 200
    body = response.json()
    ids = {c["id"] for c in body["categories"]}
    assert ids == {"medical_emergency", "domestic_violence", "lost_documents"}
    for cat in body["categories"]:
        assert cat["primary_number"]
        assert cat["support_lines"], "shallow categories must include support lines"


def test_cluster_digest_includes_victim_notification(client: TestClient) -> None:
    response = client.get("/clusters/cl-001-accountability/digest")
    assert response.status_code == 200
    body = response.json()
    assert "victim_notification" in body
    assert body["victim_notification"]["kind"] == "victim_notification"
    assert "Your case is part of an escalated pattern" in body["victim_notification"]["editable_body"]
