"""Cluster router: accountability alerts and cluster summaries."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import (
    ClustersResponse,
    ClusterSummary,
    GeneratedDocument,
    GeneratedDocumentsResponse,
    JournalistDigestResponse,
)
from app.services import documents as docs_service
from app.services.clusters import (
    accountability_alerts,
    all_clusters,
    trigger_accountability,
)
from app.services.seed_loader import get_seed_store


router = APIRouter(prefix="/clusters", tags=["clusters"])


@router.get("", response_model=ClustersResponse)
def list_clusters_route() -> ClustersResponse:
    return ClustersResponse(
        accountability_alert_count=len(accountability_alerts()),
        clusters=all_clusters(),
    )


@router.get("/{cluster_id}", response_model=ClusterSummary)
def get_cluster_route(cluster_id: str) -> ClusterSummary:
    store = get_seed_store()
    cluster = store.cluster(cluster_id)
    if cluster is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return ClusterSummary(
        id=cluster.id,
        fraud_type=cluster.fraud_type,
        states=cluster.states,
        districts=cluster.districts,
        report_count=cluster.report_count,
        total_amount=cluster.total_amount,
        status=cluster.status,
        is_accountability_alert=bool(cluster.trigger_reason) and cluster.report_count >= 50,
        first_report_at=cluster.first_report_at,
        latest_report_at=cluster.latest_report_at,
        common_identifier_summary=[f"identifier:{iid}" for iid in cluster.common_identifier_ids[:3]],
    )


@router.post("/{cluster_id}/trigger-accountability", response_model=ClusterSummary)
def trigger_accountability_route(cluster_id: str) -> ClusterSummary:
    try:
        trigger_accountability(cluster_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return get_cluster_route(cluster_id)


@router.get("/{cluster_id}/digest", response_model=JournalistDigestResponse)
def journalist_digest_route(cluster_id: str) -> JournalistDigestResponse:
    store = get_seed_store()
    cluster = store.cluster(cluster_id)
    if cluster is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    sample_identifier_values = []
    for iid in cluster.common_identifier_ids[:3]:
        ident = store.identifier(iid)
        if ident is None:
            continue
        if ident.type == "upi":
            sample_identifier_values.append(f"UPI handle (redacted): {ident.value.split('@')[0][:3]}***@{ident.value.split('@')[-1]}")
        elif ident.type == "phone":
            sample_identifier_values.append(f"Phone: +91-XXXXX-{ident.value[-5:]}")
        elif ident.type == "social_handle":
            sample_identifier_values.append(f"Handle: @{ident.value.lstrip('@')[:3]}***")
        else:
            sample_identifier_values.append(f"{ident.type}: (redacted)")
    summary = ClusterSummary(
        id=cluster.id,
        fraud_type=cluster.fraud_type,
        states=cluster.states,
        districts=cluster.districts,
        report_count=cluster.report_count,
        total_amount=cluster.total_amount,
        status=cluster.status,
        is_accountability_alert=bool(cluster.trigger_reason) and cluster.report_count >= 50,
        first_report_at=cluster.first_report_at,
        latest_report_at=cluster.latest_report_at,
        common_identifier_summary=sample_identifier_values,
    )
    digest = docs_service.generate_journalist_digest(cluster, sample_identifier_values=sample_identifier_values)
    infographic = docs_service.generate_infographic_copy(cluster)
    rti = docs_service.generate_rti_draft(cluster)
    victim = docs_service.generate_victim_notification(cluster)
    return JournalistDigestResponse(
        cluster=summary,
        digest=digest,
        infographic=infographic,
        rti_draft=rti,
        victim_notification=victim,
        note="All numbers are from CyberSaathi's deterministic seed data set.",
    )


@router.get("/{cluster_id}/documents", response_model=GeneratedDocumentsResponse)
def cluster_documents_route(cluster_id: str) -> GeneratedDocumentsResponse:
    store = get_seed_store()
    cluster = store.cluster(cluster_id)
    if cluster is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return GeneratedDocumentsResponse(
        complaint_id=cluster_id,
        documents=[
            docs_service.generate_rti_draft(cluster),
            docs_service.generate_journalist_digest(cluster, sample_identifier_values=[]),
            docs_service.generate_infographic_copy(cluster),
            docs_service.generate_victim_notification(cluster),
        ],
    )
