"""Tests for the record_complaint flow preserving the original incident time.

The whole point of CyberSaathi's "incident_at" is that it is the time the
victim says the event happened, NOT the time they reached us. The
intake, the routing decision, the complaint record, the recovery band,
and the generated documents must all use that same timestamp.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import GeoPoint, IntakeRequest, RoutingDecision
from app.services.intake import process_intake, record_complaint
from app.services.documents import generate_complaint_package
from app.services.recovery import recovery_band


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def test_incident_at_survives_routing_and_complaint() -> None:
    """The incident time submitted in intake must reach the complaint record
    unchanged, and propagate to the recovery band and document package."""
    fifteen_min_ago = datetime.now(tz=timezone.utc) - timedelta(minutes=15)
    request = IntakeRequest(
        description=(
            "Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. "
            "Maine bhar diya. Ab number band hai."
        ),
        amount=2500,
        incident_at=fifteen_min_ago,
        payment_method="upi",
    )

    # 1. Intake + routing uses the submitted incident time.
    response = process_intake("vs-test-priya", request)
    assert response.routing.pipeline == "golden_hour"
    assert response.routing.is_financial is True

    # 2. The complaint record keeps the same incident time.
    complaint = record_complaint(
        session_id="vs-test-priya",
        routing=response.routing,
        facts=response.extracted_facts,
        description=request.description,
        location=GeoPoint(state="Delhi", district="New Delhi", pincode="110001"),
        fraud_type="money_movement_fraud",
        payment_method="upi",
        amount=request.amount,
        incident_at=request.incident_at,
    )
    assert complaint.incident_at == fifteen_min_ago
    assert complaint.amount == 2500

    # 3. The recovery band reflects the same ~15 minutes, not "just now".
    band = recovery_band(
        fraud_type=complaint.fraud_type,
        incident_at=complaint.incident_at,
        amount=complaint.amount,
        payment_method=complaint.payment_method,
        is_financial=True,
    )
    # "Reported N minutes after incident" should be in the band factors.
    minutes_factor = next(
        (f for f in band.factors if f.startswith("Reported ") and "minute" in f),
        None,
    )
    assert minutes_factor is not None, band.factors
    assert "15" in minutes_factor, minutes_factor

    # 4. The complaint package uses the same incident time in the body.
    package = generate_complaint_package(
        complaint,
        response.extracted_facts,
        helpline_reference="1930REF0001",
    )
    # The NCRP draft, bank email, and timeline use complaint.incident_at.
    from app.services.documents import _format_date

    expected = _format_date(complaint.incident_at)
    for kind in ("ncrp_complaint_draft", "bank_dispute_email", "evidence_timeline"):
        doc = next(d for d in package if d.kind == kind)
        assert expected in doc.editable_body, (kind, expected, doc.editable_body)
    # The evidence timeline explicitly includes "Incident occurred" / "Reported on CyberSaathi".
    timeline = next(d for d in package if d.kind == "evidence_timeline")
    assert "Incident occurred" in timeline.editable_body
    assert "Reported on CyberSaathi" in timeline.editable_body
    # The recovery checklist uses complaint.incident_at in its factors.
    checklist = next(d for d in package if d.kind == "recovery_checklist")
    assert expected in checklist.editable_body or "15 minutes" in checklist.editable_body


def test_incident_at_falls_back_to_facts_timestamp() -> None:
    """If the caller did not submit an incident_at, the facts.timestamp
    (parsed from the text) must still be used, NOT utcnow()."""
    fixed_text_ts = datetime(2026, 6, 4, 9, 30, 0, tzinfo=timezone.utc)
    request = IntakeRequest(
        description=(
            "Lost Rs 8000 to scammer.fraud@upi on 04-Jun-2026 9:30 AM."
        ),
        amount=8000,
        incident_at=None,
        payment_method="upi",
    )
    response = process_intake("vs-test-facts-ts", request)
    facts = response.extracted_facts
    # The extraction picks up the timestamp from the text.
    assert facts.timestamp is not None

    complaint = record_complaint(
        session_id="vs-test-facts-ts",
        routing=response.routing,
        facts=facts,
        description=request.description,
        location=GeoPoint(state="Delhi", district="New Delhi", pincode="110001"),
        fraud_type="money_movement_fraud",
        payment_method="upi",
        amount=request.amount,
        incident_at=None,
    )
    # The complaint's incident_at must come from facts.timestamp, not utcnow().
    assert complaint.incident_at == facts.timestamp
    assert complaint.incident_at == fixed_text_ts


def test_routing_decision_keeps_golden_hour_remaining_seconds() -> None:
    """When intake is < 60 min, the golden-hour remaining seconds is set
    and computed against the original incident time, not utcnow()."""
    forty_min_ago = datetime.now(tz=timezone.utc) - timedelta(minutes=40)
    request = IntakeRequest(
        description="I sent Rs 5000 to scammer@upi via Google Pay.",
        amount=5000,
        incident_at=forty_min_ago,
        payment_method="upi",
    )
    response = process_intake("vs-test-gh", request)
    assert response.routing.pipeline == "golden_hour"
    assert response.routing.golden_hour_remaining_seconds is not None
    # Roughly 20 minutes left: between 18 and 22 (a small jitter window is
    # allowed for the time it takes the test to run).
    remaining = response.routing.golden_hour_remaining_seconds
    assert 18 * 60 <= remaining <= 22 * 60, remaining


def test_priya_similarity_matches_seed_data() -> None:
    """Priya's preset uses scammer.fraud@upi which appears in 56+ seed
    reports. The similarity endpoint should return a non-zero match."""
    from app.services.seed_loader import get_seed_store
    from app.services.similarity import similarity_for_complaint

    request = IntakeRequest(
        description=(
            "Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. "
            "Maine bhar diya. Ab number band hai."
        ),
        amount=2500,
        payment_method="upi",
        evidence_text=(
            "Google Pay txn alert: Rs 2,500.00 paid to scammer.fraud@upi. "
            "UTR 408722195166. From +91-98765-43210."
        ),
    )
    response = process_intake("vs-test-sim", request)
    assert response.extracted_facts.upi_id == "scammer.fraud@upi"
    assert response.extracted_facts.utr is not None

    # Seed store must have the identifier for the accountability cluster.
    store = get_seed_store()
    matches_upi = [
        ident
        for ident in store.identifiers()
        if ident.type == "upi" and ident.normalized_value == "scammer.fraud@upi"
    ]
    assert matches_upi, "scammer.fraud@upi should exist in the seed identifiers"

    similarity = similarity_for_complaint(response.extracted_facts)
    assert similarity.counts["upi"] >= 1
    assert any(m.identifier_type == "upi" for m in similarity.matches)
