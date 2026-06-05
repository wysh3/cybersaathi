from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app
from app.models import ComplaintRecord, GeoPoint, PostReportResponseRequest, UpdatePostReportStepsRequest
from app.services.seed_loader import get_seed_store
from app.services.post_report.workflow_selector import select_workflows
from app.services.post_report.generator import generate_post_report_response

client = TestClient(app)

def _complaint(**kwargs) -> ComplaintRecord:
    base = dict(
        id="c-post-test",
        fraud_type="money_movement_fraud",
        payment_method="upi",
        amount=2500.0,
        amount_currency="INR",
        severity="high",
        urgency_score=80,
        pipeline="post_golden_hour",
        status="intake_in_progress",
        location=GeoPoint(state="Delhi", district="New Delhi", pincode="110001"),
        created_at="2026-06-04T00:00:00Z",  # type: ignore
        incident_at="2026-06-04T00:00:00Z",  # type: ignore
        is_resolved=False,
        has_fir=False,
        victim_session_id="vs-post-test",
        summary="Paid Rs 2500 to scammer@upi for hostel fees.",
    )
    base.update(kwargs)
    return ComplaintRecord.model_validate(base)

def test_selector_mappings() -> None:
    # 1. Money movement fraud -> money_movement_fraud primary.
    c1 = _complaint(fraud_type="money_movement_fraud", amount=2500.0, payment_method="upi")
    sel1 = select_workflows(c1)
    assert sel1.primary_workflow == "money_movement_fraud"
    assert "platform_content_suspect" in sel1.secondary_workflows
    assert sel1.risk_level == "medium"

    # 2. Personal safety/extortion -> personal_safety_extortion primary, money_movement_fraud secondary (if money demand)
    c2 = _complaint(fraud_type="personal_safety_extortion", amount=8000.0, summary="Threatened to leak my private video unless I pay UPI.")
    sel2 = select_workflows(c2)
    assert sel2.primary_workflow == "personal_safety_extortion"
    assert "money_movement_fraud" in sel2.secondary_workflows
    assert sel2.risk_level == "critical"

    # 3. Device/data compromise -> device_data_compromise primary
    c3 = _complaint(fraud_type="device_data_compromise", amount=0.0, summary="My files were locked by extension .crypt")
    sel3 = select_workflows(c3)
    assert sel3.primary_workflow == "device_data_compromise"
    assert sel3.risk_level == "high"  # device data compromise risk is high

def test_generator_deterministic_fallback() -> None:
    store = get_seed_store()
    c = _complaint(id="c-gen-test", fraud_type="money_movement_fraud", amount=2500.0)
    store.add_complaint(c)
    
    response = generate_post_report_response(c.id, force_refresh=True)
    assert response.complaint_id == c.id
    assert response.primary_workflow == "money_movement_fraud"
    assert len(response.cards) > 0
    assert "ncrp_complaint_draft" in response.generated_document_kinds

def test_endpoints_flow() -> None:
    store = get_seed_store()
    c = _complaint(id="c-endpoint-test", fraud_type="personal_safety_extortion", amount=5000.0)
    store.add_complaint(c)

    # 1. Generate response via POST
    post_payload = PostReportResponseRequest(force_refresh=True)
    res_post = client.post(f"/post-report/{c.id}/response", json=post_payload.model_dump())
    assert res_post.status_code == 200
    data = res_post.json()
    assert data["primary_workflow"] == "personal_safety_extortion"
    assert "money_movement_fraud" in data["secondary_workflows"]

    # 2. Fetch response via GET
    res_get = client.get(f"/post-report/{c.id}/response")
    assert res_get.status_code == 200
    assert res_get.json()["primary_workflow"] == "personal_safety_extortion"

    # 3. Patch step state via PATCH
    patch_payload = UpdatePostReportStepsRequest(
        step_key="Halt all contact and block the sender",
        status="done",
        notes="Blocked scammer on WhatsApp"
    )
    res_patch = client.patch(f"/post-report/{c.id}/steps", json=patch_payload.model_dump())
    assert res_patch.status_code == 200
    assert res_patch.json() == {"success": True}

    # Verify step state is updated in GET cards
    res_get_updated = client.get(f"/post-report/{c.id}/response")
    assert res_get_updated.status_code == 200
    cards_updated = res_get_updated.json()["cards"]
    found_item = False
    for card in cards_updated:
        for item in card["items"]:
            if item["label"] == patch_payload.step_key:
                assert item["status"] == "done"
                found_item = True
                break
    assert found_item
