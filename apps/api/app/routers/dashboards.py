"""Dashboard router: public, journalist, and police-style aggregates."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import HeatmapResponse
from app.services.clusters import journalist_dashboard, public_dashboard
from app.services.intelligence_map import (
    INDIA_STATES,
    IntelligenceMapResponse,
    StateDistrictResponse,
    intelligence_map,
    state_district_rollup,
)
from app.services.seed_loader import get_seed_store


router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("/public")
def public_dashboard_route(
    state: Optional[str] = Query(default=None),
) -> dict:
    response = public_dashboard(state=state)
    return response.model_dump(mode="json")


@router.get("/journalist")
def journalist_dashboard_route() -> dict:
    return journalist_dashboard()


@router.get("/police")
def police_dashboard_route() -> dict:
    """Police demo: jurisdiction-filtered cluster list and trend.

    No real PII is exposed. The state filter is provided as a query param
    for the demo to feel realistic.
    """

    store = get_seed_store()
    complaints = store.complaints()
    grouped: dict[tuple[str, str, str], int] = {}
    for c in complaints:
        key = (c.location.state, c.location.district, c.fraud_type)
        grouped[key] = grouped.get(key, 0) + 1
    rows = [
        {
            "state": state,
            "district": district,
            "fraud_type": fraud,
            "count": count,
        }
        for (state, district, fraud), count in sorted(grouped.items(), key=lambda kv: -kv[1])
    ]
    return {
        "total_complaints": len(complaints),
        "total_amount": sum(c.amount for c in complaints),
        "rows": rows,
        "note": "Aggregated jurisdictional view. PII is never included.",
    }


@router.get("/heatmap", response_model=HeatmapResponse)
def heatmap_route(
    state: Optional[str] = Query(default=None),
    fraud_type: Optional[str] = Query(default=None),
) -> HeatmapResponse:
    store = get_seed_store()
    complaints = store.complaints()
    if state:
        complaints = [c for c in complaints if c.location.state == state]
    if fraud_type:
        complaints = [c for c in complaints if c.fraud_type == fraud_type]
    grouped: dict[tuple[str, str], list] = {}
    for c in complaints:
        grouped.setdefault((c.location.state, c.location.district), []).append(c)
    from app.models import HeatmapBucket
    from datetime import datetime, timezone

    buckets: list[HeatmapBucket] = []
    for (state_name, district), items in grouped.items():
        buckets.append(
            HeatmapBucket(
                state=state_name,
                state_id=state_name,
                district=district,
                count=len(items),
                total_amount=sum(i.amount for i in items),
                top_fraud_types=_top_fraud_types(items),
            )
        )
    return HeatmapResponse(
        total_complaints=len(complaints),
        total_amount=sum(c.amount for c in complaints),
        buckets=buckets,
        generated_at=datetime.now(tz=timezone.utc),
    )


def _top_fraud_types(items, limit: int = 3) -> list[str]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item.fraud_type] = counts.get(item.fraud_type, 0) + 1
    return [ft for ft, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:limit]]


@router.get("/intelligence-map", response_model=IntelligenceMapResponse)
def intelligence_map_route(
    fraud_type: Optional[str] = Query(default=None),
    metric: Literal["count", "amount"] = Query(default="count"),
) -> IntelligenceMapResponse:
    """State-level rollup for the CyberSaathi India heatmap.

    The ``state_id`` of every row matches the ``st_nm`` property of the
    vendored TopoJSON at ``apps/web/lib/maps/india-states.json`` so the
    frontend can join the rollups to the SVG geometry by exact string
    equality.
    """

    return intelligence_map(fraud_type=fraud_type, metric=metric)


@router.get(
    "/intelligence-map/state/{state_id}",
    response_model=StateDistrictResponse,
)
def intelligence_map_state_route(
    state_id: str,
    fraud_type: Optional[str] = Query(default=None),
) -> StateDistrictResponse:
    """District rollup for a single state, keyed by ``st_nm`` from the
    vendored TopoJSON. The frontend uses this for the right-side panel
    when a state is clicked on the choropleth.
    """

    if state_id not in INDIA_STATES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown state: {state_id}",
        )
    return state_district_rollup(state=state_id, fraud_type=fraud_type)
