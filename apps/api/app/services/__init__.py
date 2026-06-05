"""CyberSaathi service layer.

This package groups business logic into focused modules:

- ``routing``: urgency + pipeline selection.
- ``extraction``: mock OCR/NER for SMS, screenshots, and narratives.
- ``recovery``: deterministic recovery probability band.
- ``similarity``: cluster / pattern matching against seed data.
- ``documents``: NCRP, bank dispute, evidence timeline, RTI, journalist digest.
- ``integrations``: mock adapters for 1930, NCRP, bank, RTI, WhatsApp, press.
- ``clusters``: accountability threshold monitor and dashboard summaries.
- ``intake``: orchestrates extraction + routing for the first screen.
- ``fall_back``: scripted edge-case handler with clarifying questions.
- ``seed_loader``: in-memory seed data store.
"""

from .seed_loader import SeedStore, get_seed_store, reset_seed_store
from .routing import route_intake, route_fall_back
from .extraction import extract_facts
from .recovery import recovery_band
from .similarity import similarity_for_complaint
from .documents import (
    generate_complaint_package,
    generate_rti_draft,
    generate_journalist_digest,
)
from .integrations import (
    helpline_prepare_call,
    helpline_record_reference,
    ncrp_submit_draft,
    bank_dispute_draft,
    whatsapp_simulate,
    press_digest_email,
    list_recent_events,
)
from .clusters import (
    accountability_alerts,
    public_dashboard,
    journalist_dashboard,
    trigger_accountability,
)
from .intake import process_intake, start_session, record_complaint
from .fall_back import FallBackCase, start_fall_back, advance_fall_back

__all__ = [
    "SeedStore",
    "get_seed_store",
    "reset_seed_store",
    "route_intake",
    "route_fall_back",
    "extract_facts",
    "recovery_band",
    "similarity_for_complaint",
    "generate_complaint_package",
    "generate_rti_draft",
    "generate_journalist_digest",
    "helpline_prepare_call",
    "helpline_record_reference",
    "ncrp_submit_draft",
    "bank_dispute_draft",
    "whatsapp_simulate",
    "press_digest_email",
    "list_recent_events",
    "accountability_alerts",
    "public_dashboard",
    "journalist_dashboard",
    "trigger_accountability",
    "process_intake",
    "start_session",
    "record_complaint",
    "FallBackCase",
    "start_fall_back",
    "advance_fall_back",
]
