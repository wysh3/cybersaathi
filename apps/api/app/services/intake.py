"""Intake orchestration.

Ties routing, extraction, similarity, and redaction together for the first
"what happened?" screen. Also tracks the lightweight victim session.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models import (
    ComplaintRecord,
    EvidenceItem,
    ExtractedFacts,
    GeoPoint,
    IntakeRequest,
    IntakeResponse,
    RoutingDecision,
    ScamIdentifier,
    Severity,
)
from app.services.extraction import extract_facts
from app.services.categories import canonical_fraud_category
from app.services.redaction import redact_text
from app.services.routing import route_intake
from app.services.seed_loader import get_seed_store, utcnow


# In-memory session store. Each session keeps the minimum needed to continue
# the workflow across requests. Sessions expire when the process restarts.
_sessions: dict[str, dict] = {}


def start_session() -> dict:
    sid = f"vs-{uuid.uuid4().hex[:12]}"
    record = {
        "id": sid,
        "created_at": utcnow().isoformat(),
        "preferred_language": "en",
        "contact_channel": None,
        "current_step": "intake",
        "complaint_ids": [],
        "consent_flags": {"redaction_ack": True},
    }
    _sessions[sid] = record
    return record


def get_session(sid: str) -> Optional[dict]:
    return _sessions.get(sid)


def process_intake(session_id: str, request: IntakeRequest) -> IntakeResponse:
    routing = route_intake(request)
    facts = extract_facts(
        description=request.description,
        evidence_text=request.evidence_text,
        extra_pasted_sms=request.extra_pasted_sms,
        amount_hint=request.amount,
        incident_at=request.incident_at,
    )
    redacted_description = redact_text(request.description)
    redacted_evidence = redact_text(request.evidence_text) if request.evidence_text else None
    notes: list[str] = []
    if not facts.upi_id and routing.is_financial:
        notes.append(
            "We could not detect a UPI ID. Paste the SMS or upload a screenshot for better extraction."
        )
    if not facts.amount and routing.is_financial:
        notes.append("We could not detect an amount. Enter it manually for an honest recovery range.")
    if not request.incident_at and routing.pipeline == "golden_hour":
        notes.append(
            "We did not receive an incident time. Confirm the minutes-ago value to keep the golden-hour timer accurate."
        )
    return IntakeResponse(
        session_id=session_id,
        extracted_facts=facts,
        routing=routing,
        redacted_description=redacted_description,
        redacted_evidence=redacted_evidence,
        notes=notes,
    )


def record_complaint(
    *,
    session_id: str,
    routing: RoutingDecision,
    facts: ExtractedFacts,
    description: str,
    location: GeoPoint,
    fraud_type: str,
    payment_method: str,
    amount: Optional[float] = None,
    incident_at: Optional[datetime] = None,
) -> ComplaintRecord:
    store = get_seed_store()
    cid = f"c-live-{uuid.uuid4().hex[:10]}"
    eid = f"e-live-{uuid.uuid4().hex[:10]}"
    amount_value = amount if amount is not None else (facts.amount or 0.0)
    canonical_type = canonical_fraud_category(
        fraud_type,
        summary=description,
        amount=amount_value,
    )
    incident_value = incident_at or facts.timestamp or utcnow()
    severity: Severity = "high" if amount_value >= 10000 else "medium" if amount_value > 0 else "low"
    complaint = ComplaintRecord(
        id=cid,
        fraud_type=canonical_type,
        payment_method=payment_method,
        amount=amount_value,
        amount_currency="INR",
        severity=severity,
        urgency_score=int(routing.confidence * 100),
        pipeline=routing.pipeline,
        status="intake_in_progress",
        location=location,
        created_at=utcnow(),
        incident_at=incident_value,
        is_resolved=False,
        has_fir=False,
        victim_session_id=session_id,
        summary=description,
        identifier_ids=[],
        evidence_item_ids=[eid],
        helpline_reference_number=None,
        cluster_id=None,
    )
    identifier_ids: list[str] = []
    if facts.upi_id:
        upi_id = _hash_id("upi-live", facts.upi_id)
        store.add_identifier(
            ScamIdentifier(
                id=upi_id,
                type="upi",
                value=facts.upi_id,
                normalized_value=facts.upi_id.lower(),
                confidence=0.9,
                source_complaint_ids=[cid],
            )
        )
        identifier_ids.append(upi_id)
    if facts.phone:
        phone_id = _hash_id("phone-live", facts.phone)
        store.add_identifier(
            ScamIdentifier(
                id=phone_id,
                type="phone",
                value=facts.phone,
                normalized_value=normalize_phone(facts.phone),
                confidence=0.85,
                source_complaint_ids=[cid],
            )
        )
        identifier_ids.append(phone_id)
    if facts.handle:
        handle_id = _hash_id("handle-live", facts.handle)
        store.add_identifier(
            ScamIdentifier(
                id=handle_id,
                type="social_handle",
                value=facts.handle,
                normalized_value=facts.handle.lower(),
                confidence=0.8,
                source_complaint_ids=[cid],
            )
        )
        identifier_ids.append(handle_id)
    if facts.url:
        url_id = _hash_id("url-live", facts.url)
        store.add_identifier(
            ScamIdentifier(
                id=url_id,
                type="url",
                value=facts.url,
                normalized_value=facts.url.lower(),
                confidence=0.8,
                source_complaint_ids=[cid],
            )
        )
        identifier_ids.append(url_id)
    complaint = complaint.model_copy(update={"identifier_ids": identifier_ids})
    store.add_complaint(complaint)
    evidence = EvidenceItem(
        id=eid,
        complaint_id=cid,
        kind="narrative",
        source="intake",
        original_text=description,
        redacted_text=redact_text(description),
        extracted_fields={
            k: str(v) for k, v in facts.model_dump().items() if v not in (None, [], "")
        },
        created_at=utcnow(),
    )
    store.add_evidence(evidence)
    session = _sessions.setdefault(session_id, start_session())
    session["complaint_ids"].append(cid)
    session["current_step"] = routing.pipeline
    return complaint


def _hash_id(*parts: str) -> str:
    import hashlib

    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:12]


def normalize_phone(value: str) -> str:
    import re

    digits = re.sub(r"\D+", "", value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits
