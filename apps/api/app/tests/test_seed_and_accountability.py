"""Tests for the deterministic seed data, similarity, and accountability."""

from app.services.clusters import accountability_alerts, all_clusters
from app.services.similarity import similarity_for_complaint
from app.services.seed_loader import get_seed_store
from app.models import ExtractedFacts


def test_seed_data_loads_at_least_500_complaints() -> None:
    store = get_seed_store()
    assert len(store.complaints()) >= 500


def test_accountability_cluster_has_at_least_50_reports() -> None:
    store = get_seed_store()
    cluster = store.cluster("cl-001-accountability")
    assert cluster is not None
    assert cluster.report_count >= 50
    assert any(
        a.id == "cl-001-accountability" for a in accountability_alerts()
    )


def test_similarity_counts_come_from_seed_data() -> None:
    store = get_seed_store()
    cluster = store.cluster("cl-001-accountability")
    assert cluster is not None
    sample_member = cluster.member_complaint_ids[0]
    member_evidence = store.evidence_for_complaint(sample_member)
    assert member_evidence, "Accountability cluster member has no evidence"
    upi_field = next(
        (e.extracted_fields.get("upi_id") for e in member_evidence if e.extracted_fields.get("upi_id")),
        None,
    )
    assert upi_field is not None
    result = similarity_for_complaint(
        ExtractedFacts(upi_id=upi_field),
        exclude_complaint_id=sample_member,
    )
    upi_matches = [m for m in result.matches if m.identifier_type == "upi"]
    assert upi_matches
    assert upi_matches[0].match_count >= 50


def test_public_dashboard_summarises_seed_data() -> None:
    from app.services.clusters import public_dashboard

    response = public_dashboard()
    assert response.total_complaints >= 500
    assert response.buckets
    assert all(b.count > 0 for b in response.buckets)


def test_all_clusters_returns_seeded_clusters() -> None:
    clusters = all_clusters()
    ids = {c.id for c in clusters}
    assert "cl-001-accountability" in ids
    assert "cl-002-jobserver" in ids
    assert "cl-003-refund-phish" in ids
