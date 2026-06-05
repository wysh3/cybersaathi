"""Mock integrations for CyberSaathi.

The MVP never calls real government, police, bank, WhatsApp, or RTI services.
Each adapter returns a deterministic simulated response and logs a
``MockIntegrationEvent`` for transparency.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models import ComplaintRecord, MockIntegrationEvent


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _new_event(
    adapter: str,
    operation: str,
    request_summary: str,
    response_summary: str,
    status: str = "simulated_success",
) -> MockIntegrationEvent:
    return MockIntegrationEvent(
        id=f"evt-{uuid.uuid4().hex[:10]}",
        adapter=adapter,
        operation=operation,
        request_summary=request_summary,
        response_summary=response_summary,
        status=status,  # type: ignore[arg-type]
        created_at=_now(),
    )


# Stored for transparency; the in-memory list is intentionally small.
_events: list[MockIntegrationEvent] = []


def _record_event(
    event: MockIntegrationEvent,
    *,
    complaint_id: str | None = None,
    session_id: str | None = None,
) -> MockIntegrationEvent:
    _events.append(event)
    try:
        from app.services.db_store import is_database_enabled
        from app.services.seed_loader import get_seed_store

        if is_database_enabled():
            store = get_seed_store()
            persist_event = getattr(store, "add_integration_event", None)
            if callable(persist_event):
                persist_event(
                    event,
                    complaint_id=complaint_id,
                    session_id=session_id,
                )
    except Exception:
        # Mock integrations must never fail an emergency flow because the
        # optional demo persistence layer is unavailable.
        pass
    return event


def list_recent_events(*, limit: int = 25) -> list[MockIntegrationEvent]:
    try:
        from app.services.db_store import is_database_enabled
        from app.services.seed_loader import get_seed_store

        if is_database_enabled():
            store = get_seed_store()
            persisted_events = getattr(store, "integration_events", None)
            if callable(persisted_events):
                return persisted_events(limit=limit)
    except Exception:
        pass
    return list(reversed(_events[-limit:]))


def helpline_prepare_call(complaint: ComplaintRecord) -> MockIntegrationEvent:
    event = _new_event(
        adapter="1930_helpline",
        operation="prepare_call",
        request_summary=(
            f"Complaint {complaint.id} ({complaint.fraud_type}, "
            f"INR {complaint.amount:,.2f}) routed for golden-hour call."
        ),
        response_summary=(
            "Simulated dial prompt. Read out the prepared case brief, capture "
            "the reference number, and update the complaint."
        ),
    )
    return _record_event(event, complaint_id=complaint.id)


def helpline_record_reference(complaint: ComplaintRecord, reference_number: str) -> MockIntegrationEvent:
    event = _new_event(
        adapter="1930_helpline",
        operation="record_reference",
        request_summary=f"Complaint {complaint.id} captured reference {reference_number}.",
        response_summary=(
            "Simulated acknowledgement. Reference number is now attached to the "
            "complaint and will appear in the NCRP and bank dispute drafts."
        ),
    )
    return _record_event(
        event,
        complaint_id=complaint.id,
        session_id=complaint.victim_session_id,
    )


def ncrp_submit_draft(complaint_id: str) -> MockIntegrationEvent:
    event = _new_event(
        adapter="ncrp",
        operation="submit_checklist",
        request_summary=f"Complaint {complaint_id} marked ready for NCRP submission.",
        response_summary=(
            "Simulated checklist. Open cybercrime.gov.in, paste the editable "
            "draft, attach evidence, and submit. The official acknowledgement "
            "number will be added to the complaint by the user."
        ),
    )
    return _record_event(event, complaint_id=complaint_id)


def bank_dispute_draft(complaint_id: str) -> MockIntegrationEvent:
    event = _new_event(
        adapter="bank_dispute",
        operation="prepare_email",
        request_summary=f"Complaint {complaint_id} bank dispute email draft ready.",
        response_summary=(
            "Simulated acknowledgement. Review the email, attach the transaction "
            "screenshot, and send it to the bank's nodal officer from your "
            "registered email."
        ),
    )
    return _record_event(event, complaint_id=complaint_id)


def whatsapp_simulate(complaint_id: str, action: str) -> MockIntegrationEvent:
    event = _new_event(
        adapter="whatsapp",
        operation=action,
        request_summary=f"Complaint {complaint_id} triggered WhatsApp simulation: {action}.",
        response_summary=(
            "Simulated WhatsApp flow. The user can resume the complaint in "
            "CyberSaathi by clicking the deep link sent to their phone."
        ),
        status="simulated_pending",
    )
    return _record_event(event, complaint_id=complaint_id)


def press_digest_email(cluster_id: str) -> MockIntegrationEvent:
    event = _new_event(
        adapter="press_digest",
        operation="send_digest",
        request_summary=f"Journalist digest email prepared for cluster {cluster_id}.",
        response_summary=(
            "Simulated email. Review the digest, edit the recipient list, and "
            "send it from your press contact."
        ),
    )
    return _record_event(event)
