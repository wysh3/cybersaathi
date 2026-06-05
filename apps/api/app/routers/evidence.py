"""Evidence router: extract facts from pasted SMS, screenshots, or text."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from fastapi import APIRouter

from app.models import ExtractedFacts
from app.services.extraction import extract_facts
from app.services.redaction import redact_text


router = APIRouter(prefix="/evidence", tags=["evidence"])


class ExtractRequest(BaseModel):
    description: str = ""
    evidence_text: Optional[str] = None
    extra_pasted_sms: Optional[str] = None
    amount_hint: Optional[float] = None
    incident_at: Optional[str] = None


class ExtractResponse(BaseModel):
    facts: ExtractedFacts
    redacted_text: str
    warnings: list[str] = Field(default_factory=list)


@router.post("/extract", response_model=ExtractResponse)
def extract_route(payload: ExtractRequest) -> ExtractResponse:
    from datetime import datetime

    incident_at_dt: Optional[datetime] = None
    if payload.incident_at:
        try:
            incident_at_dt = datetime.fromisoformat(payload.incident_at.replace("Z", "+00:00"))
        except ValueError:
            incident_at_dt = None
    facts = extract_facts(
        description=payload.description,
        evidence_text=payload.evidence_text,
        extra_pasted_sms=payload.extra_pasted_sms,
        amount_hint=payload.amount_hint,
        incident_at=incident_at_dt,
    )
    combined = "\n".join(
        part for part in (payload.description, payload.evidence_text or "", payload.extra_pasted_sms or "") if part
    )
    redacted = redact_text(combined)
    warnings: list[str] = []
    if not facts.upi_id and any(
        kw in combined.lower() for kw in ("upi", "gpay", "google pay", "phonepe", "paytm", "@")
    ):
        warnings.append("A UPI mention was found but the UPI ID could not be parsed cleanly.")
    if not facts.amount and any(kw in combined.lower() for kw in ("rs", "inr", "₹")):
        warnings.append("A currency mention was found but the amount could not be parsed.")
    return ExtractResponse(facts=facts, redacted_text=redacted, warnings=warnings)
