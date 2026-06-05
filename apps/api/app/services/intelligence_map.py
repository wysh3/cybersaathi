"""Intelligence map aggregation.

The ``/dashboards/intelligence-map`` endpoint returns a state-level rollup of
seed complaints, primary fraud type, top district, intensity bin, and an
accountability-alert flag, suitable for rendering a real India choropleth
heat map with district drill-down.

The ``state_id`` field is the exact ``st_nm`` value used in the vendored
TopoJSON file (``apps/web/lib/maps/india-states.json``), so the frontend can
join the API rollups to the SVG geometry without any string-massaging.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.services.clusters import accountability_alerts
from app.services.categories import canonical_fraud_category
from app.services.seed_loader import get_seed_store


INDIA_STATES: tuple[str, ...] = (
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
)


def _bin_count(count: int, max_count: int) -> int:
    if max_count <= 0 or count <= 0:
        return 0
    ratio = count / max_count
    if ratio < 0.20:
        return 1
    if ratio < 0.40:
        return 2
    if ratio < 0.60:
        return 3
    if ratio < 0.80:
        return 4
    return 5


def _bin_amount(amount: float, max_amount: float) -> int:
    if max_amount <= 0 or amount <= 0:
        return 0
    ratio = amount / max_amount
    if ratio < 0.20:
        return 1
    if ratio < 0.40:
        return 2
    if ratio < 0.60:
        return 3
    if ratio < 0.80:
        return 4
    return 5


class DistrictRollup(BaseModel):
    district: str
    report_count: int
    total_amount: float
    top_fraud_type: Optional[str] = None


class StateIntelligence(BaseModel):
    state: str
    state_id: str
    report_count: int
    total_amount: float
    district_count: int
    top_district: Optional[str] = None
    top_district_count: int = 0
    top_fraud_type: Optional[str] = None
    intensity_bin: int = 0
    amount_bin: int = 0
    has_accountability_alert: bool = False


class IntelligenceMapResponse(BaseModel):
    metric: str = "count"
    total_complaints: int
    total_amount: float
    max_state_count: int
    max_state_amount: float
    states: list[StateIntelligence] = Field(default_factory=list)
    accountability_alert_states: list[str] = Field(default_factory=list)
    note: str = (
        "All numbers come from CyberSaathi's deterministic seed data set. "
        "The map is anonymised; no victim identities, phone numbers, or "
        "raw evidence are shown."
    )


class StateDistrictResponse(BaseModel):
    state: str
    state_id: str
    report_count: int
    total_amount: float
    districts: list[DistrictRollup] = Field(default_factory=list)
    note: str = (
        "District rollups are computed from the deterministic seed data. "
        "No victim identities, raw evidence, or Aadhaar/PAN/OTP values are "
        "returned."
    )


def _compute_intensity(
    *,
    fraud_type: Optional[str],
    metric: str,
) -> IntelligenceMapResponse:
    store = get_seed_store()
    complaints = store.complaints()
    requested_type = (
        canonical_fraud_category(fraud_type)
        if fraud_type
        else None
    )
    if fraud_type:
        complaints = [
            c
            for c in complaints
            if canonical_fraud_category(
                c.fraud_type,
                summary=c.summary,
                amount=c.amount,
            )
            == requested_type
        ]
    grouped: dict[str, list] = {}
    for c in complaints:
        grouped.setdefault(c.location.state, []).append(c)
    max_count = max((len(items) for items in grouped.values()), default=0)
    max_amount = round(
        max(
            (sum(c.amount for c in items) for items in grouped.values()),
            default=0.0,
        ),
        2,
    )
    alert_states: set[str] = set()
    for alert in accountability_alerts():
        alert_states.update(alert.states)
    states: list[StateIntelligence] = []
    for state_name in INDIA_STATES:
        items = grouped.get(state_name, [])
        if not items:
            states.append(
                StateIntelligence(
                    state=state_name,
                    state_id=state_name,
                    report_count=0,
                    total_amount=0.0,
                    district_count=0,
                    intensity_bin=0,
                    amount_bin=0,
                )
            )
            continue
        district_count: dict[str, int] = {}
        fraud_count: dict[str, int] = {}
        total_amount = 0.0
        for c in items:
            district_count[c.location.district] = (
                district_count.get(c.location.district, 0) + 1
            )
            category = canonical_fraud_category(
                c.fraud_type,
                summary=c.summary,
                amount=c.amount,
            )
            fraud_count[category] = fraud_count.get(category, 0) + 1
            total_amount += c.amount
        top_district, top_district_count = max(
            district_count.items(), key=lambda kv: kv[1], default=("—", 0)
        )
        top_fraud_type, _ = max(
            fraud_count.items(), key=lambda kv: kv[1], default=(None, 0)
        )
        states.append(
            StateIntelligence(
                state=state_name,
                state_id=state_name,
                report_count=len(items),
                total_amount=round(total_amount, 2),
                district_count=len(district_count),
                top_district=top_district,
                top_district_count=top_district_count,
                top_fraud_type=top_fraud_type,
                intensity_bin=_bin_count(len(items), max_count),
                amount_bin=_bin_amount(total_amount, max_amount),
                has_accountability_alert=state_name in alert_states,
            )
        )
    return IntelligenceMapResponse(
        metric=metric,
        total_complaints=len(complaints),
        total_amount=round(sum(c.amount for c in complaints), 2),
        max_state_count=max_count,
        max_state_amount=max_amount,
        states=states,
        accountability_alert_states=sorted(alert_states),
    )


def intelligence_map(
    *,
    fraud_type: Optional[str] = None,
    metric: str = "count",
) -> IntelligenceMapResponse:
    return _compute_intensity(fraud_type=fraud_type, metric=metric)


def state_district_rollup(
    *,
    state: str,
    fraud_type: Optional[str] = None,
) -> StateDistrictResponse:
    store = get_seed_store()
    complaints = [
        c for c in store.complaints() if c.location.state == state
    ]
    requested_type = (
        canonical_fraud_category(fraud_type)
        if fraud_type
        else None
    )
    if fraud_type:
        complaints = [
            c
            for c in complaints
            if canonical_fraud_category(
                c.fraud_type,
                summary=c.summary,
                amount=c.amount,
            )
            == requested_type
        ]
    grouped: dict[str, list] = {}
    for c in complaints:
        grouped.setdefault(c.location.district, []).append(c)
    districts: list[DistrictRollup] = []
    for district, items in grouped.items():
        fraud_count: dict[str, int] = {}
        for c in items:
            category = canonical_fraud_category(
                c.fraud_type,
                summary=c.summary,
                amount=c.amount,
            )
            fraud_count[category] = fraud_count.get(category, 0) + 1
        top_fraud, _ = max(
            fraud_count.items(), key=lambda kv: kv[1], default=(None, 0)
        )
        districts.append(
            DistrictRollup(
                district=district,
                report_count=len(items),
                total_amount=round(sum(c.amount for c in items), 2),
                top_fraud_type=top_fraud,
            )
        )
    districts.sort(key=lambda d: d.report_count, reverse=True)
    return StateDistrictResponse(
        state=state,
        state_id=state,
        report_count=len(complaints),
        total_amount=round(sum(c.amount for c in complaints), 2),
        districts=districts,
    )
