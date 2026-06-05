"""Map router — state-level and district-level complaint counts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.categories import canonical_fraud_category
from app.services.seed_loader import get_seed_store

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/states")
def map_states() -> dict:
    """Return {stateName: count} grouped from the complaints store."""
    store = get_seed_store()
    complaints = store.complaints()
    state_counts: dict[str, int] = {}
    for c in complaints:
        st = c.location.state
        if st:
            state_counts[st] = state_counts.get(st, 0) + 1
    return {
        "states": state_counts,
        "total": sum(state_counts.values()),
    }


@router.get("/states/{state_name}/districts")
def map_state_districts(state_name: str) -> dict:
    """Return {districtName: count} for a specific state.

    Also returns the top fraud types and total amount for context.
    """
    store = get_seed_store()
    complaints = store.complaints()
    district_counts: dict[str, int] = {}
    fraud_types: dict[str, int] = {}
    total_amount = 0.0
    found = False
    for c in complaints:
        if c.location.state != state_name:
            continue
        found = True
        dist = c.location.district or "Unknown"
        district_counts[dist] = district_counts.get(dist, 0) + 1
        category = canonical_fraud_category(c.fraud_type, summary=c.summary, amount=c.amount)
        fraud_types[category] = fraud_types.get(category, 0) + 1
        total_amount += c.amount or 0
    if not found:
        raise HTTPException(status_code=404, detail=f"State '{state_name}' not found")
    return {
        "state": state_name,
        "districts": dict(
            sorted(district_counts.items(), key=lambda x: -x[1])
        ),
        "fraud_types": dict(
            sorted(fraud_types.items(), key=lambda x: -x[1])
        ),
        "total_complaints": sum(district_counts.values()),
        "total_amount": round(total_amount, 2),
        "district_count": len(district_counts),
    }
