"""Intake chat router — LLM-powered conversational case builder.

Phase 1: deterministic welcome, conversation persistence, message storage.
Phase 2+: LLM orchestration (see app/services/llm_intake/).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_intake import (
    CaseFacts,
    CaseLocation,
    CaseStateSnapshot,
    ChatTurnRequest,
    ChatTurnResponse,
    ConfirmRequest,
    ConfirmResponse,
    IntakeMessageRead,
    StartChatRequest,
    StartChatResponse,
)
from app.services.database import get_async_session
from app.services.db_store import is_database_enabled
from app.services.categories import canonical_fraud_category
from app.services.redaction import redact_text

router = APIRouter(prefix="/intake/chat", tags=["intake_chat"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _msg_to_read(msg) -> IntakeMessageRead:
    return IntakeMessageRead(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content_redacted=msg.content_redacted,
        message_kind=msg.message_kind,
        metadata=msg.message_metadata or {},
        created_at=msg.created_at,
    )


def _empty_snapshot() -> CaseStateSnapshot:
    return CaseStateSnapshot(
        language="en",
        user_distress="medium",
        incident_summary="",
        fraud_type="unknown",
        payment_method="unknown",
        amount=None,
        incident_at=None,
        location=CaseLocation(),
        facts=CaseFacts(),
        evidence_texts=[],
        missing_required_fields=[],
        routing=None,
        complaint_id=None,
        generated_document_ids=[],
        safety_flags=[],
        next_action="ask_followup",
    )


_WELCOME_MESSAGE = (
    "Tell me what happened. You can write normally or paste the bank/SMS alert. "
    "Your information is safe, secure and confidential."
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/start", response_model=StartChatResponse)
async def start_chat(
    body: StartChatRequest,
    session: AsyncSession = Depends(get_async_session),
) -> StartChatResponse:
    """Create a new victim session and conversation.

    Returns the first assistant message and an empty case snapshot.
    """
    if not is_database_enabled():
        raise HTTPException(status_code=503, detail="Database not enabled. Set DATABASE_ENABLED=true.")

    import uuid

    from app.services.repositories import ConversationRepo

    vs_id = f"vs-{uuid.uuid4().hex[:12]}"
    from app.models.db import VictimSessionORM

    vs = VictimSessionORM(
        id=vs_id,
        preferred_language=body.preferred_language,
        contact_channel=body.contact_channel,
        current_step="intake",
        consent_flags={"redaction_ack": True},
    )
    session.add(vs)

    repo = ConversationRepo(session)
    conv = await repo.create_conversation(
        victim_session_id=vs_id,
        case_snapshot=_empty_snapshot().model_dump(),
    )

    welcome_msg = await repo.create_message(
        conversation_id=conv.id,
        role="assistant",
        content_redacted=_WELCOME_MESSAGE,
        message_kind="chat",
    )

    await session.commit()

    return StartChatResponse(
        session_id=vs_id,
        conversation_id=conv.id,
        message=_msg_to_read(welcome_msg),
        case_snapshot=_empty_snapshot(),
        status="active",
    )


@router.get("/{conversation_id}", response_model=dict)
async def get_chat(
    conversation_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Retrieve a conversation with all messages."""
    if not is_database_enabled():
        raise HTTPException(status_code=503, detail="Database not enabled.")

    from app.models.llm_intake import IntakeConversationRead
    from app.services.repositories import ConversationRepo

    repo = ConversationRepo(session)
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = await repo.get_messages(conversation_id)

    result = IntakeConversationRead(
        id=conv.id,
        victim_session_id=conv.victim_session_id,
        complaint_id=conv.complaint_id,
        status=conv.status,
        current_phase=conv.current_phase,
        safety_flags=conv.safety_flags or [],
        case_snapshot=conv.case_snapshot or {},
        messages=[_msg_to_read(m) for m in messages],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )
    return result.model_dump()


@router.post("/{conversation_id}/turn", response_model=ChatTurnResponse)
async def chat_turn(
    conversation_id: str,
    body: ChatTurnRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ChatTurnResponse:
    """Process a user turn in the conversation.

    Uses LlmIntakeOrchestrator when LLM_ENABLED=true.
    Falls back to deterministic extraction/routing when disabled or on error.
    """
    if not is_database_enabled():
        raise HTTPException(status_code=503, detail="Database not enabled.")

    from app.services.repositories import ConversationRepo

    repo = ConversationRepo(session)
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Redact user input before storage
    redacted_message = redact_text(body.message)
    redacted_evidence = redact_text(body.evidence_text) if body.evidence_text else None

    # Store user message (redacted)
    await repo.create_message(
        conversation_id=conversation_id,
        role="user",
        content_redacted=redacted_message,
        content_original=None,
        message_kind="chat",
        message_meta={"has_evidence": body.evidence_text is not None},
    )

    if redacted_evidence:
        await repo.create_message(
            conversation_id=conversation_id,
            role="user",
            content_redacted=redacted_evidence,
            content_original=None,
            message_kind="evidence",
            message_meta={"source": "pasted_text"},
        )

    # Build current snapshot from conversation
    snapshot = _build_snapshot_from_conv(conv, redacted_message, redacted_evidence)

    # Get conversation history for LLM context
    existing_messages = await repo.get_recent_messages(conversation_id, limit=12)
    history = [
        {"role": m.role, "content_redacted": m.content_redacted, "content": m.content_redacted}
        for m in existing_messages
    ]

    # Try LLM orchestrator, fall back to deterministic
    from app.services.llm import is_llm_enabled as _llm_enabled

    if _llm_enabled():
        try:
            from app.services.llm_intake import LlmIntakeOrchestrator

            orchestrator = LlmIntakeOrchestrator()
            result = await orchestrator.process_turn(
                current_snapshot=snapshot,
                current_phase=conv.current_phase or "describe",
                user_message=body.message,
                evidence_text=body.evidence_text,
                conversation_history=history,
            )

            llm_output = result["llm_output"]
            snapshot = result["case_snapshot"]
            inv_summary = result["invocation_summary"]

            # Save LLM invocation
            from app.services.llm import get_intake_model
            await repo.create_invocation(
                conversation_id=conversation_id,
                provider="nvidia_nim",
                model=get_intake_model(),
                prompt_version="v1",
                input_summary_redacted=inv_summary.get("input_summary", "")[:500],
                output_summary_redacted=inv_summary.get("output_summary", "")[:500],
                latency_ms=inv_summary.get("latency_ms", 0),
                status=inv_summary.get("status", "success"),
                error_type=inv_summary.get("error_type"),
                token_usage=inv_summary.get("token_usage", {}),
            )

            assistant_text = (
                _build_deterministic_message(snapshot)
                if snapshot.next_action != llm_output.next_action
                or snapshot.next_action == "confirm_facts"
                else llm_output.assistant_message
            )
            used_llm = result.get("used_llm", False)
        except Exception:
            # LLM failed entirely, use deterministic
            snapshot = _deterministic_turn(snapshot, body.message, body.evidence_text)
            assistant_text = _build_deterministic_message(snapshot)
            used_llm = False
    else:
        # LLM disabled, use deterministic
        snapshot = _deterministic_turn(snapshot, body.message, body.evidence_text)
        assistant_text = _build_deterministic_message(snapshot)
        used_llm = False

    # Update conversation
    next_phase = "confirm" if snapshot.next_action == "confirm_facts" else "clarify"
    await repo.update_conversation(
        conversation_id,
        case_snapshot=snapshot.model_dump(),
        current_phase=next_phase,
        safety_flags=snapshot.safety_flags,
        last_model=get_intake_model() if used_llm else None,
    )

    # Store assistant message
    assistant_msg = await repo.create_message(
        conversation_id=conversation_id,
        role="assistant",
        content_redacted=assistant_text,
        message_kind="question" if snapshot.next_action == "ask_followup" else "action",
    )

    await session.commit()

    # Build UI actions
    ui_actions = _build_ui_actions(snapshot)

    return ChatTurnResponse(
        conversation_id=conversation_id,
        session_id=conv.victim_session_id,
        assistant_message=_msg_to_read(assistant_msg),
        case_snapshot=snapshot,
        routing=snapshot.routing,
        complaint=None,
        documents=[],
        ui_actions=ui_actions,
        safety_flags=snapshot.safety_flags,
    )


def _deterministic_turn(
    snapshot: CaseStateSnapshot,
    message: str,
    evidence_text: str | None,
) -> CaseStateSnapshot:
    """Run deterministic extraction and routing, merge into snapshot."""
    from app.models import IntakeRequest
    from app.services.routing import route_intake
    from app.services.extraction import extract_facts

    intake_req = IntakeRequest(
        description=message,
        evidence_text=evidence_text,
        incident_at=None,
        amount=snapshot.amount,
        payment_method=snapshot.payment_method if snapshot.payment_method != "unknown" else "auto",
        location=None,
        contact_channel="web",
        preferred_language=snapshot.language,
        extra_pasted_sms=None,
    )
    routing = route_intake(intake_req)
    facts = extract_facts(
        description=message,
        evidence_text=evidence_text,
        amount_hint=snapshot.amount,
        incident_at=None,
    )
    snapshot = _merge_facts_into_snapshot(snapshot, facts, routing)
    snapshot.missing_required_fields = _derive_missing_fields(snapshot)
    snapshot.next_action = "confirm_facts" if not snapshot.missing_required_fields else "ask_followup"

    from app.models.llm_intake import CaseRouting
    snapshot.routing = CaseRouting(
        pipeline=routing.pipeline,
        confidence=routing.confidence,
        golden_hour_remaining_seconds=routing.golden_hour_remaining_seconds,
        is_financial=routing.is_financial,
    )

    # Detect fraud type from routing text
    det_fraud = routing.reasoning
    for r in det_fraud:
        if "Detected fraud type:" in r:
            ft = r.split(":")[-1].strip().rstrip(".")
            if ft and ft != "other":
                snapshot.fraud_type = ft

    return snapshot


def _build_deterministic_message(snapshot: CaseStateSnapshot) -> str:
    """Build a deterministic assistant response."""
    if snapshot.next_action == "confirm_facts":
        return _build_confirm_message(snapshot)
    return _build_followup_message(snapshot)


def _build_ui_actions(snapshot: CaseStateSnapshot) -> list:
    """Build UI actions from snapshot."""
    actions = []
    if snapshot.next_action == "confirm_facts":
        actions.append({"type": "show_fact_review", "target": None, "payload": {}})
        if snapshot.routing and snapshot.routing.pipeline == "golden_hour":
            actions.append({"type": "enable_continue", "target": "/emergency", "payload": {}})
        elif snapshot.routing and snapshot.routing.pipeline == "post_golden_hour":
            actions.append({"type": "enable_continue", "target": "/documents", "payload": {}})
        else:
            actions.append({"type": "enable_continue", "target": "/fall-back", "payload": {}})
    return actions


@router.post("/{conversation_id}/confirm", response_model=ConfirmResponse)
async def confirm_chat(
    conversation_id: str,
    body: ConfirmRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ConfirmResponse:
    """User confirms the extracted facts. Creates complaint, evidence, documents."""
    if not is_database_enabled():
        raise HTTPException(status_code=503, detail="Database not enabled.")

    from app.services.repositories import ConversationRepo

    repo = ConversationRepo(session)
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    snapshot = body.confirmed_snapshot
    location = body.location

    # Create the complaint record
    from app.models import ComplaintRecord, EvidenceItem, GeoPoint, ScamIdentifier
    from app.services.redaction import redact_text
    import uuid, hashlib

    geo = GeoPoint(
        state=location.state or "Karnataka",
        district=location.district or "Bengaluru Urban",
        pincode=location.pincode or "560001",
    )

    cid = f"c-live-{uuid.uuid4().hex[:10]}"
    eid = f"e-live-{uuid.uuid4().hex[:10]}"

    amount_value = snapshot.amount or (snapshot.facts.amount or 0.0)
    canonical_type = canonical_fraud_category(
        snapshot.fraud_type if snapshot.fraud_type != "unknown" else "platform_content_suspect",
        summary=snapshot.incident_summary,
        amount=amount_value,
    )
    severity = "high" if amount_value >= 10000 else "medium" if amount_value > 0 else "low"
    pipeline = snapshot.routing.pipeline if snapshot.routing else "post_golden_hour"
    confidence = snapshot.routing.confidence if snapshot.routing else 0.5

    from datetime import datetime as dt, timezone as tz

    incident_at = snapshot.incident_at
    if incident_at:
        try:
            incident_dt = dt.fromisoformat(incident_at)
        except (ValueError, TypeError):
            incident_dt = dt.now(tz=tz.utc)
    else:
        incident_dt = dt.now(tz=tz.utc)

    complaint = ComplaintRecord(
        id=cid,
        fraud_type=canonical_type,
        payment_method=snapshot.payment_method if snapshot.payment_method != "unknown" else "upi",
        amount=amount_value,
        amount_currency="INR",
        severity=severity,
        urgency_score=int(confidence * 100),
        pipeline=pipeline if pipeline in ("golden_hour", "post_golden_hour", "fall_back") else "post_golden_hour",
        status="intake_in_progress",
        location=geo,
        created_at=dt.now(tz=tz.utc),
        incident_at=incident_dt,
        is_resolved=False,
        has_fir=False,
        victim_session_id=conv.victim_session_id,
        summary=snapshot.incident_summary or body.confirmed_snapshot.incident_summary or "",
        identifier_ids=[],
        evidence_item_ids=[eid],
        helpline_reference_number=None,
        cluster_id=None,
    )

    # Persist to both ORM and seed store
    from app.models.db import ComplaintORM, EvidenceItemORM
    from app.services.seed_loader import get_seed_store

    complaint_orm = ComplaintORM(
        id=complaint.id,
        victim_session_id=complaint.victim_session_id,
        fraud_type=complaint.fraud_type,
        payment_method=complaint.payment_method,
        amount=complaint.amount,
        amount_currency=complaint.amount_currency,
        severity=complaint.severity,
        urgency_score=complaint.urgency_score,
        pipeline=complaint.pipeline,
        status=complaint.status,
        state=complaint.location.state,
        district=complaint.location.district,
        pincode=complaint.location.pincode,
        created_at=complaint.created_at,
        incident_at=complaint.incident_at,
        is_resolved=complaint.is_resolved,
        has_fir=complaint.has_fir,
        summary=complaint.summary,
    )
    session.add(complaint_orm)
    await session.flush()  # flush complaint before adding relations

    # Evidence
    all_evidence = "\n".join(snapshot.evidence_texts) if snapshot.evidence_texts else ""
    evidence = EvidenceItemORM(
        id=eid,
        complaint_id=cid,
        kind="narrative",
        source="intake_chat",
        original_text=redact_text(all_evidence or snapshot.incident_summary or ""),
        redacted_text=redact_text(all_evidence or snapshot.incident_summary or ""),
        extracted_fields={},
    )
    session.add(evidence)

    # Scam identifiers - flush first to avoid FK issues, handle duplicates
    await session.flush()
    if snapshot.facts.upi_id:
        from app.models.db import ScamIdentifierORM, ComplaintIdentifierORM
        from sqlalchemy import select as sa_select
        upi_hash = hashlib.sha1(f"upi-live|{snapshot.facts.upi_id}".encode()).hexdigest()[:12]
        # Check if identifier already exists
        existing_si = await session.get(ScamIdentifierORM, upi_hash)
        if not existing_si:
            si = ScamIdentifierORM(
                id=upi_hash,
                type="upi",
                value=snapshot.facts.upi_id,
                normalized_value=snapshot.facts.upi_id.lower(),
                confidence=0.9,
            )
            session.add(si)
            await session.flush()
        session.add(ComplaintIdentifierORM(complaint_id=cid, identifier_id=upi_hash))

    if snapshot.facts.phone:
        import re
        from app.models.db import ScamIdentifierORM, ComplaintIdentifierORM
        digits = re.sub(r"\D+", "", snapshot.facts.phone)
        phone_hash = hashlib.sha1(f"phone-live|{digits}".encode()).hexdigest()[:12]
        existing_si = await session.get(ScamIdentifierORM, phone_hash)
        if not existing_si:
            si = ScamIdentifierORM(
                id=phone_hash,
                type="phone",
                value=snapshot.facts.phone,
                normalized_value=digits,
                confidence=0.85,
            )
            session.add(si)
            await session.flush()
        session.add(ComplaintIdentifierORM(complaint_id=cid, identifier_id=phone_hash))

    # Update conversation with complaint id
    await repo.update_conversation(
        conversation_id,
        complaint_id=cid,
        status="routed",
        current_phase="route",
        case_snapshot={**snapshot.model_dump(), "complaint_id": cid, "routing": snapshot.routing.model_dump() if snapshot.routing else None},
    )

    await session.commit()

    # Update seed store for backward compatibility (sync-only, best-effort)
    try:
        from app.services.seed_loader import get_seed_store
        store = get_seed_store()
        store.add_complaint(complaint)
    except Exception:
        pass

    # Generate documents
    documents: list[dict[str, Any]] = []
    try:
        from app.services.documents import generate_complaint_package
        from app.models import ExtractedFacts as ApiExtractedFacts
        facts_for_docs = ApiExtractedFacts(
            utr=snapshot.facts.utr,
            upi_id=snapshot.facts.upi_id,
            amount=snapshot.facts.amount,
            timestamp=incident_dt,
            bank=snapshot.facts.bank,
            payment_app=snapshot.facts.payment_app,
            phone=snapshot.facts.phone,
            handle=snapshot.facts.handle,
            url=snapshot.facts.url,
            name_mentions=snapshot.facts.name_mentions,
        )
        doc_response = generate_complaint_package(complaint, facts_for_docs)
        documents = [d.model_dump() for d in doc_response]
    except Exception as e:
        import logging
        logging.warning(f"Document generation failed: {e}")

    # Build routing
    from app.models.llm_intake import CaseRouting
    case_routing = CaseRouting(
        pipeline=complaint.pipeline,
        confidence=confidence,
        golden_hour_remaining_seconds=snapshot.routing.golden_hour_remaining_seconds if snapshot.routing else None,
        is_financial=snapshot.routing.is_financial if snapshot.routing else True,
    )

    ui_actions = [{"type": "navigate", "target": "/documents", "payload": {"complaint_id": cid}}]
    if complaint.pipeline == "golden_hour":
        ui_actions = [{"type": "navigate", "target": "/emergency", "payload": {"complaint_id": cid}}]

    return ConfirmResponse(
        conversation_id=conversation_id,
        session_id=conv.victim_session_id,
        complaint=complaint.model_dump(),
        documents=documents,
        routing=case_routing,
        similarity=None,
        ui_actions=ui_actions,
    )


# ---------------------------------------------------------------------------
# Snapshot helpers
# ---------------------------------------------------------------------------


def _build_combined_text(message: str, evidence_text: str | None) -> str:
    parts = [message]
    if evidence_text:
        parts.append(evidence_text)
    return "\n".join(parts)


def _build_snapshot_from_conv(
    conv,
    redacted_message: str,
    redacted_evidence: str | None,
) -> CaseStateSnapshot:
    """Build/update case snapshot from conversation + new input."""
    existing = CaseStateSnapshot.model_validate(conv.case_snapshot or {}) if conv.case_snapshot else _empty_snapshot()

    # Append evidence text
    if redacted_evidence and redacted_evidence not in existing.evidence_texts:
        existing.evidence_texts = list(existing.evidence_texts) + [redacted_evidence]

    # Update incident summary if not yet set
    if not existing.incident_summary:
        existing.incident_summary = redacted_message

    return existing


def _merge_facts_into_snapshot(
    snapshot: CaseStateSnapshot,
    facts,
    routing,
) -> CaseStateSnapshot:
    """Merge deterministic extraction facts into the case snapshot."""
    f = snapshot.facts

    # Only update if not already set by user/LLM
    if not f.upi_id and facts.upi_id:
        f.upi_id = facts.upi_id
    if not f.amount and facts.amount:
        f.amount = facts.amount
    if not f.amount:
        snapshot.amount = facts.amount
    if not f.utr and facts.utr:
        f.utr = facts.utr
    if not f.bank and facts.bank:
        f.bank = facts.bank
    if not f.payment_app and facts.payment_app:
        f.payment_app = facts.payment_app
    if not f.phone and facts.phone:
        f.phone = facts.phone
    if not f.handle and facts.handle:
        f.handle = facts.handle
    if not f.url and facts.url:
        f.url = facts.url
    if facts.timestamp and not snapshot.incident_at:
        if hasattr(facts.timestamp, "isoformat"):
            snapshot.incident_at = facts.timestamp.isoformat()
        else:
            snapshot.incident_at = str(facts.timestamp)
    if not f.timestamp and facts.timestamp:
        if hasattr(facts.timestamp, "isoformat"):
            f.timestamp = facts.timestamp.isoformat()
        else:
            f.timestamp = str(facts.timestamp)
    if snapshot.payment_method == "unknown" and routing.is_financial:
        snapshot.payment_method = "upi"

    snapshot.facts = f
    return snapshot


def _derive_missing_fields(snapshot: CaseStateSnapshot) -> list[str]:
    """Return list of missing critical fields."""
    missing: list[str] = []
    if not snapshot.fraud_type or snapshot.fraud_type == "unknown":
        missing.append("fraud_type")
    if not snapshot.payment_method or snapshot.payment_method in ("unknown", "auto"):
        missing.append("payment_method")
    if snapshot.amount is None and snapshot.facts.amount is None:
        missing.append("amount")
    if not snapshot.incident_at:
        missing.append("incident_at")
    if not snapshot.location.district:
        missing.append("location.district")
    # For financial fraud, we need a receiver identifier
    if snapshot.fraud_type not in ("sextortion", "harassment", "account_hack", "other"):
        if not snapshot.facts.upi_id and not snapshot.facts.phone and not snapshot.facts.handle:
            missing.append("receiver_identifier")
    return missing


def _build_confirm_message(snapshot: CaseStateSnapshot) -> str:
    """Build a confirmation message summarizing extracted facts."""
    parts = ["I found these details from what you shared. Please confirm:"]
    if snapshot.fraud_type and snapshot.fraud_type != "unknown":
        parts.append(f"• Type: {snapshot.fraud_type.replace('_', ' ')}")
    if snapshot.payment_method and snapshot.payment_method not in ("unknown", "auto"):
        parts.append(f"• Payment: {snapshot.payment_method}")
    if snapshot.amount:
        parts.append(f"• Amount: Rs {snapshot.amount:,.0f}")
    if snapshot.facts.upi_id:
        parts.append(f"• UPI ID: {snapshot.facts.upi_id}")
    if snapshot.facts.utr:
        parts.append(f"• UTR: {snapshot.facts.utr}")
    if snapshot.incident_at:
        parts.append(f"• Incident time recorded")
    parts.append("\nIf this looks right, click Confirm. If something is wrong, tell me what to fix.")
    return "\n".join(parts)


def _build_followup_message(snapshot: CaseStateSnapshot) -> str:
    """Build a follow-up question for missing info."""
    missing = snapshot.missing_required_fields
    if not missing:
        return "Let me confirm what I found. Is everything above correct?"

    field_prompts = {
        "fraud_type": "What type of fraud happened?",
        "payment_method": "How did you pay — UPI, card, or netbanking?",
        "amount": "How much money was involved?",
        "incident_at": "About how many minutes or hours ago did this happen?",
        "location.district": "Which district are you in?",
        "receiver_identifier": "Do you have the UPI ID, phone number, or account you sent money to?",
    }

    if len(missing) == 1:
        prompt = field_prompts.get(missing[0], f"Can you tell me about: {missing[0]}?")
        return prompt

    first = field_prompts.get(missing[0], missing[0])
    second = field_prompts.get(missing[1], missing[1]) if len(missing) > 1 else ""
    return f"I need a bit more to help. First: {first} Also, {second}"
