"""Tests for the deterministic document generation."""

from app.models import ComplaintRecord, ExtractedFacts, GeoPoint
from app.services.documents import (
    generate_bank_dispute_email,
    generate_complaint_package,
    generate_evidence_timeline,
    generate_ncrp_draft,
    generate_rti_draft,
    generate_journalist_digest,
)


def _complaint(**kwargs) -> ComplaintRecord:
    base = dict(
        id="c-test",
        fraud_type="money_movement_fraud",
        payment_method="upi",
        amount=2500.0,
        amount_currency="INR",
        severity="high",
        urgency_score=80,
        pipeline="post_golden_hour",
        status="intake_in_progress",
        location=GeoPoint(state="Delhi", district="New Delhi", pincode="110001"),
        created_at="2026-06-04T00:00:00Z",  # type: ignore[arg-type]
        incident_at="2026-06-04T00:00:00Z",  # type: ignore[arg-type]
        is_resolved=False,
        has_fir=False,
        victim_session_id="vs-test",
        summary="Paid Rs 2500 to scammer@upi for hostel fees.",
    )
    base.update(kwargs)
    return ComplaintRecord.model_validate(base)


def _facts() -> ExtractedFacts:
    return ExtractedFacts(
        utr="UTR123456789",
        upi_id="scammer.fraud@upi",
        amount=2500.0,
        bank="State Bank of India",
        payment_app="Google Pay",
        phone="9876543210",
    )


def test_ncrp_draft_contains_required_sections() -> None:
    doc = generate_ncrp_draft(_complaint(), _facts(), helpline_reference="1930REF0001")
    body = doc.editable_body
    assert "NCRP" in body
    assert "UTR123456789" in body
    assert "scammer.fraud@upi" in body
    assert "1930REF0001" in body
    assert "DRAFT" in body


def test_bank_dispute_email_contains_required_sections() -> None:
    doc = generate_bank_dispute_email(_complaint(), _facts())
    body = doc.editable_body
    assert "Dispute" in body
    assert "State Bank of India" in body
    assert "scammer.fraud@upi" in body
    assert "DRAFT" in body


def test_evidence_timeline_contains_key_events() -> None:
    doc = generate_evidence_timeline(_complaint(), _facts())
    body = doc.editable_body
    assert "Incident occurred" in body
    assert "Reported on CyberSaathi" in body


def test_complaint_package_includes_four_documents() -> None:
    docs = generate_complaint_package(_complaint(), _facts())
    kinds = {d.kind for d in docs}
    assert "ncrp_complaint_draft" in kinds
    assert "bank_dispute_email" in kinds
    assert "evidence_timeline" in kinds
    assert "recovery_checklist" in kinds


def test_rti_draft_targets_relevant_state() -> None:
    from app.services.seed_loader import get_seed_store

    store = get_seed_store()
    cluster = store.cluster("cl-001-accountability")
    assert cluster is not None
    doc = generate_rti_draft(cluster)
    body = doc.editable_body
    assert cluster.states[0] in body
    assert "RTI" in body or "Right to Information" in body


def test_journalist_digest_uses_cluster_figures() -> None:
    from app.services.seed_loader import get_seed_store

    store = get_seed_store()
    cluster = store.cluster("cl-001-accountability")
    assert cluster is not None
    doc = generate_journalist_digest(cluster, sample_identifier_values=["UPI: scam***@upi"])
    body = doc.editable_body
    assert str(cluster.report_count) in body
    assert f"INR {cluster.total_amount:,.2f}" in body
    assert cluster.states[0] in body
