"""Integrations router: simulated adapters for 1930, NCRP, bank, WhatsApp, press."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

from app.models import HelplineReferenceResponse, MockIntegrationEvent
from app.services import integrations as integrations_service
from app.services.seed_loader import get_seed_store


router = APIRouter(prefix="/integrations", tags=["integrations"])


class PrepareCallRequest(BaseModel):
    complaint_id: str


class PrepareCallResponse(BaseModel):
    event: MockIntegrationEvent
    next_action: str


@router.post("/helpline/prepare", response_model=PrepareCallResponse)
def prepare_call_route(payload: PrepareCallRequest) -> PrepareCallResponse:
    store = get_seed_store()
    complaint = store.complaint(payload.complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    event = integrations_service.helpline_prepare_call(complaint)
    return PrepareCallResponse(
        event=event,
        next_action="call_1930",
    )


class RecordReferenceRequest(BaseModel):
    complaint_id: str
    reference_number: str


@router.post("/helpline/reference", response_model=HelplineReferenceResponse)
def record_reference_route(payload: RecordReferenceRequest) -> HelplineReferenceResponse:
    store = get_seed_store()
    complaint = store.complaint(payload.complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    updated = complaint.model_copy(update={"helpline_reference_number": payload.reference_number})
    store.add_complaint(updated)
    event = integrations_service.helpline_record_reference(updated, payload.reference_number)
    return HelplineReferenceResponse(
        complaint_id=updated.id,
        helpline_reference_number=payload.reference_number,
        mock_event=event,
        next_action="generate_complaint_package",
    )


class NcrpRequest(BaseModel):
    complaint_id: str


@router.post("/ncrp/submit", response_model=MockIntegrationEvent)
def ncrp_route(payload: NcrpRequest) -> MockIntegrationEvent:
    return integrations_service.ncrp_submit_draft(payload.complaint_id)


class BankDisputeRequest(BaseModel):
    complaint_id: str


@router.post("/bank/dispute", response_model=MockIntegrationEvent)
def bank_dispute_route(payload: BankDisputeRequest) -> MockIntegrationEvent:
    return integrations_service.bank_dispute_draft(payload.complaint_id)


class WhatsAppRequest(BaseModel):
    complaint_id: str
    action: str = "drop_off"


@router.post("/whatsapp/simulate", response_model=MockIntegrationEvent)
def whatsapp_route(payload: WhatsAppRequest) -> MockIntegrationEvent:
    return integrations_service.whatsapp_simulate(payload.complaint_id, payload.action)


class PressDigestRequest(BaseModel):
    cluster_id: str


@router.post("/press/digest", response_model=MockIntegrationEvent)
def press_route(payload: PressDigestRequest) -> MockIntegrationEvent:
    return integrations_service.press_digest_email(payload.cluster_id)


@router.get("/events", response_model=list[MockIntegrationEvent])
def list_events_route(limit: int = 25) -> list[MockIntegrationEvent]:
    return integrations_service.list_recent_events(limit=limit)
