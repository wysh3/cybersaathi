"""Complaint router: create, fetch, and generate documents for complaints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException

from app.models import (
    ComplaintRecord,
    ExtractedFacts,
    GeneratedDocument,
    GeoPoint,
    GeneratedDocumentsResponse,
    Pipeline,
    RecoveryBand,
    SimilarityResult,
)
from app.services import documents as docs_service
from app.services.categories import canonical_fraud_category
from app.services import similarity as similarity_service
from app.services.intake import record_complaint
from app.services.recovery import recovery_band
from app.services.seed_loader import get_seed_store


router = APIRouter(prefix="/complaints", tags=["complaints"])


class CreateComplaintRequest(BaseModel):
    session_id: str
    description: str
    location: GeoPoint
    fraud_type: str
    payment_method: str
    amount: Optional[float] = None
    incident_at: Optional[str] = None
    pipeline: Pipeline
    routing_confidence: float = 0.6
    routing_reasoning: list[str] = Field(default_factory=list)
    golden_hour_remaining_seconds: Optional[int] = None
    facts: ExtractedFacts


@router.post("", response_model=ComplaintRecord)
def create_complaint_route(payload: CreateComplaintRequest) -> ComplaintRecord:
    from datetime import datetime

    incident_at = None
    if payload.incident_at:
        try:
            incident_at = datetime.fromisoformat(payload.incident_at.replace("Z", "+00:00"))
        except ValueError:
            incident_at = None
    from app.models import RoutingDecision

    routing = RoutingDecision(
        pipeline=payload.pipeline,
        confidence=payload.routing_confidence,
        reasoning=payload.routing_reasoning,
        golden_hour_remaining_seconds=payload.golden_hour_remaining_seconds,
        is_financial=payload.payment_method in ("upi", "card", "netbanking", "wallet"),
    )
    return record_complaint(
        session_id=payload.session_id,
        routing=routing,
        facts=payload.facts,
        description=payload.description,
        location=payload.location,
        fraud_type=canonical_fraud_category(
            payload.fraud_type,
            summary=payload.description,
            amount=payload.amount or payload.facts.amount or 0,
        ),
        payment_method=payload.payment_method,
        amount=payload.amount,
        incident_at=incident_at,
    )


@router.get("/{complaint_id}", response_model=ComplaintRecord)
def get_complaint_route(complaint_id: str) -> ComplaintRecord:
    store = get_seed_store()
    complaint = store.complaint(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


class DocumentRequest(BaseModel):
    kinds: list[str] = Field(default_factory=list)


@router.post("/{complaint_id}/documents", response_model=GeneratedDocumentsResponse)
def generate_documents_route(
    complaint_id: str,
    payload: DocumentRequest,
) -> GeneratedDocumentsResponse:
    store = get_seed_store()
    complaint = store.complaint(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    evidence_items = store.evidence_for_complaint(complaint_id)
    facts = ExtractedFacts()
    for item in evidence_items:
        for k, v in item.extracted_fields.items():
            if hasattr(facts, k):
                if k == "amount":
                    try:
                        setattr(facts, k, float(v))
                    except (TypeError, ValueError):
                        continue
                else:
                    setattr(facts, k, v)
    package = docs_service.generate_complaint_package(
        complaint,
        facts,
        helpline_reference=complaint.helpline_reference_number,
    )
    if payload.kinds:
        package = [d for d in package if d.kind in payload.kinds]
    persist_documents = getattr(store, "add_generated_documents", None)
    if callable(persist_documents):
        persist_documents(package)
    return GeneratedDocumentsResponse(complaint_id=complaint_id, documents=package)


@router.get("/{complaint_id}/recovery", response_model=RecoveryBand)
def recovery_for_complaint_route(complaint_id: str) -> RecoveryBand:
    store = get_seed_store()
    complaint = store.complaint(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return recovery_band(
        fraud_type=complaint.fraud_type,
        incident_at=complaint.incident_at,
        amount=complaint.amount,
        payment_method=complaint.payment_method,
        is_financial=complaint.payment_method != "none",
    )


@router.get("/{complaint_id}/similarity", response_model=SimilarityResult)
def similarity_for_complaint_route(complaint_id: str) -> SimilarityResult:
    store = get_seed_store()
    complaint = store.complaint(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    evidence_items = store.evidence_for_complaint(complaint_id)
    facts = ExtractedFacts()
    for item in evidence_items:
        for k, v in item.extracted_fields.items():
            if hasattr(facts, k):
                if k == "amount":
                    try:
                        setattr(facts, k, float(v))
                    except (TypeError, ValueError):
                        continue
                else:
                    setattr(facts, k, v)
    return similarity_service.similarity_for_complaint(facts, exclude_complaint_id=complaint_id)
