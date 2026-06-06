"""Cluster monitor and dashboard summaries."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from shared.constants import (
    ACCOUNTABILITY_THRESHOLD,
    ACCOUNTABILITY_WINDOW_DAYS,
)

from app.models import (
    ClusterRecord,
    ClusterSummary,
    DashboardAlert,
    HeatmapBucket,
    PublicDashboardResponse,
    Severity,
)
from app.services.seed_loader import get_seed_store


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def accountability_alerts() -> list[ClusterSummary]:
    """Return clusters that have crossed the accountability threshold."""

    store = get_seed_store()
    results: list[ClusterSummary] = []
    for cluster in store.clusters():
        if cluster.report_count >= ACCOUNTABILITY_THRESHOLD and cluster.trigger_reason:
            results.append(_summary_for(cluster))
    return results


def all_clusters() -> list[ClusterSummary]:
    store = get_seed_store()
    return [_summary_for(c) for c in store.clusters()]


def _summary_for(cluster: ClusterRecord) -> ClusterSummary:
    is_alert = bool(cluster.trigger_reason) and cluster.report_count >= ACCOUNTABILITY_THRESHOLD
    return ClusterSummary(
        id=cluster.id,
        fraud_type=cluster.fraud_type,
        states=cluster.states,
        districts=cluster.districts,
        report_count=cluster.report_count,
        total_amount=cluster.total_amount,
        status=cluster.status,
        is_accountability_alert=is_alert,
        first_report_at=cluster.first_report_at,
        latest_report_at=cluster.latest_report_at,
        common_identifier_summary=[
            f"{iid}" for iid in cluster.common_identifier_ids[:3]
        ],
    )


def public_dashboard(*, state: Optional[str] = None) -> PublicDashboardResponse:
    store = get_seed_store()
    complaints = store.complaints()
    if state:
        complaints = [c for c in complaints if c.location.state == state]
    buckets: list[HeatmapBucket] = []
    grouped: dict[tuple[str, str], list] = {}
    for c in complaints:
        key = (c.location.state, c.location.district)
        grouped.setdefault(key, []).append(c)
    for (state_name, district), items in grouped.items():
        buckets.append(
            HeatmapBucket(
                state=state_name,
                district=district,
                count=len(items),
                total_amount=sum(i.amount for i in items),
                top_fraud_types=_top_fraud_types(items),
            )
        )
    buckets.sort(key=lambda b: (-b.count, b.state, b.district))
    top_states = sorted(
        buckets,
        key=lambda b: -b.count,
    )[:10]
    return PublicDashboardResponse(
        total_complaints=len(complaints),
        total_reported_amount=sum(c.amount for c in complaints),
        top_states=top_states,
        buckets=buckets,
        accountability_alerts=[
            DashboardAlert(
                id=f"alert-{alert.id}",
                cluster_id=alert.id,
                audience="public",
                title=f"Accountability Alert — {alert.fraud_type.replace('_', ' ').title()}",
                summary=(
                    f"{alert.report_count} unresolved reports share common identifiers "
                    f"in {', '.join(alert.states)}."
                ),
                severity="high" if alert.report_count >= ACCOUNTABILITY_THRESHOLD else "medium",
                created_at=_now(),
                is_public=True,
            )
            for alert in accountability_alerts()
        ],
        note=(
            "All numbers are from CyberSaathi's deterministic seed data set. "
            "Public dashboards never include victim identities, full phone numbers, "
            "or raw evidence."
        ),
    )


def _top_fraud_types(items: list, limit: int = 3) -> list[str]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item.fraud_type] = counts.get(item.fraud_type, 0) + 1
    return [ft for ft, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:limit]]


def journalist_dashboard() -> dict:
    """Return aggregate trends suitable for a journalist demo view."""

    store = get_seed_store()
    complaints = store.complaints()
    buckets: dict[tuple[str, str], int] = {}
    fraud_counts: dict[str, int] = {}
    for c in complaints:
        key = (c.location.state, c.fraud_type)
        buckets[key] = buckets.get(key, 0) + 1
        fraud_counts[c.fraud_type] = fraud_counts.get(c.fraud_type, 0) + 1
    return {
        "total_complaints": len(complaints),
        "total_amount": sum(c.amount for c in complaints),
        "fraud_type_breakdown": [
            {"fraud_type": ft, "count": count}
            for ft, count in sorted(fraud_counts.items(), key=lambda kv: -kv[1])
        ],
        "state_breakdown": [
            {"state": state, "count": sum(v for (s, _), v in buckets.items() if s == state)}
            for state in sorted({s for s, _ in buckets.keys()})
        ],
        "alerts": [
            {
                "id": f"alert-{c.id}",
                "cluster_id": c.id,
                "fraud_type": c.fraud_type,
                "report_count": c.report_count,
                "states": c.states,
                "first_report_at": c.first_report_at.isoformat(),
                "latest_report_at": c.latest_report_at.isoformat(),
            }
            for c in accountability_alerts()
        ],
        "note": (
            "Aggregated, anonymised data for journalist demos. Source: CyberSaathi seed data."
        ),
    }


def trigger_accountability(cluster_id: str) -> DashboardAlert:
    """Promote a cluster to the accountability-alert state and return the alert.

    Idempotent: if the alert already exists we return the existing one.
    """

    store = get_seed_store()
    cluster = store.cluster(cluster_id)
    if cluster is None:
        raise ValueError(f"Unknown cluster: {cluster_id}")
    if cluster.report_count < ACCOUNTABILITY_THRESHOLD:
        raise ValueError(
            f"Cluster {cluster_id} has only {cluster.report_count} reports — below the "
            f"accountability threshold of {ACCOUNTABILITY_THRESHOLD}."
        )
    if not cluster.trigger_reason:
        cluster = cluster.model_copy(
            update={
                "trigger_reason": (
                    f"{cluster.report_count} unresolved reports share identifiers in a "
                    f"30-day window ({ACCOUNTABILITY_WINDOW_DAYS} days) and have no FIR or "
                    "resolution status."
                )
            }
        )
        store.add_cluster(cluster)
    return DashboardAlert(
        id=f"alert-{uuid.uuid4().hex[:10]}",
        cluster_id=cluster.id,
        audience="public",
        title=f"Accountability Alert — {cluster.fraud_type.replace('_', ' ').title()}",
        summary=(
            f"{cluster.report_count} unresolved reports share common identifiers "
            f"in {', '.join(cluster.states)}."
        ),
        severity="high" if cluster.report_count >= ACCOUNTABILITY_THRESHOLD else "medium",
        created_at=_now(),
        is_public=True,
    )
