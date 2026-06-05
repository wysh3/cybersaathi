"""Case state reducer — merges LLM output with deterministic services.

The LLM produces a CasePatch. The reducer:
1. Validates the patch with Pydantic.
2. Merges it into the current case snapshot.
3. Runs deterministic extraction and routing as the authority.
4. Derives missing fields.
5. Returns the final snapshot and next action.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.llm_intake import (
    CaseFacts,
    CaseLocation,
    CasePatch,
    CaseStateSnapshot,
    CaseRouting,
    LlmOutput,
    NextAction,
)
from app.services.redaction import redact_text


def _utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def reduce_case_state(
    *,
    current_snapshot: CaseStateSnapshot,
    llm_output: LlmOutput,
    deterministic_facts,
    deterministic_routing,
    user_message: str,
    evidence_text: str | None,
) -> CaseStateSnapshot:
    """Merge LLM output and deterministic results into the case snapshot.

    Deterministic services win over LLM output when they conflict.
    """
    snapshot = current_snapshot.model_copy(deep=True)
    patch = llm_output.case_patch

    # --- Update from LLM patch (non-null fields only) ---
    if patch.incident_summary:
        snapshot.incident_summary = patch.incident_summary
    if patch.fraud_type and patch.fraud_type != "unknown":
        snapshot.fraud_type = patch.fraud_type
    if patch.payment_method and patch.payment_method not in ("unknown", "auto"):
        snapshot.payment_method = patch.payment_method
    if patch.amount is not None and patch.amount > 0:
        snapshot.amount = patch.amount
    if patch.incident_at:
        snapshot.incident_at = patch.incident_at
    if patch.user_distress:
        snapshot.user_distress = patch.user_distress

    # Merge facts from patch
    pf = patch.facts
    sf = snapshot.facts
    if pf.utr and not sf.utr:
        sf.utr = pf.utr
    if pf.upi_id and not sf.upi_id:
        sf.upi_id = pf.upi_id
    if pf.amount and not sf.amount:
        sf.amount = pf.amount
    if pf.timestamp and not sf.timestamp:
        sf.timestamp = pf.timestamp
    if pf.bank and not sf.bank:
        sf.bank = pf.bank
    if pf.payment_app and not sf.payment_app:
        sf.payment_app = pf.payment_app
    if pf.phone and not sf.phone:
        sf.phone = pf.phone
    if pf.handle and not sf.handle:
        sf.handle = pf.handle
    if pf.url and not sf.url:
        sf.url = pf.url
    if pf.name_mentions:
        existing = set(sf.name_mentions)
        for name in pf.name_mentions:
            if name not in existing:
                sf.name_mentions.append(name)

    # Merge location
    if patch.location.state and not snapshot.location.state:
        snapshot.location = snapshot.location.model_copy(
            update={"state": patch.location.state}
        )
    if patch.location.district and not snapshot.location.district:
        snapshot.location = snapshot.location.model_copy(
            update={"district": patch.location.district}
        )
    if patch.location.pincode and not snapshot.location.pincode:
        snapshot.location = snapshot.location.model_copy(
            update={"pincode": patch.location.pincode}
        )

    # Add evidence texts
    for text in patch.evidence_texts_to_add:
        redacted = redact_text(text)
        if redacted and redacted not in snapshot.evidence_texts:
            snapshot.evidence_texts.append(redacted)

    # --- Deterministic authority wins ---
    # Amount from deterministic extraction
    if deterministic_facts.amount is not None and deterministic_facts.amount > 0:
        sf.amount = deterministic_facts.amount
        snapshot.amount = deterministic_facts.amount
    if deterministic_facts.upi_id and not sf.upi_id:
        sf.upi_id = deterministic_facts.upi_id
    if deterministic_facts.utr and not sf.utr:
        sf.utr = deterministic_facts.utr
    if deterministic_facts.bank and not sf.bank:
        sf.bank = deterministic_facts.bank
    if deterministic_facts.payment_app and not sf.payment_app:
        sf.payment_app = deterministic_facts.payment_app
    if deterministic_facts.phone and not sf.phone:
        sf.phone = deterministic_facts.phone
    if deterministic_facts.url and not sf.url:
        sf.url = deterministic_facts.url
    if deterministic_facts.timestamp and not sf.timestamp:
        if hasattr(deterministic_facts.timestamp, "isoformat"):
            sf.timestamp = deterministic_facts.timestamp.isoformat()
        else:
            sf.timestamp = str(deterministic_facts.timestamp)
    if deterministic_facts.timestamp and not snapshot.incident_at:
        if hasattr(deterministic_facts.timestamp, "isoformat"):
            snapshot.incident_at = deterministic_facts.timestamp.isoformat()
        else:
            snapshot.incident_at = str(deterministic_facts.timestamp)

    # Routing authority
    case_routing = CaseRouting(
        pipeline=deterministic_routing.pipeline,
        confidence=deterministic_routing.confidence,
        golden_hour_remaining_seconds=deterministic_routing.golden_hour_remaining_seconds,
        is_financial=deterministic_routing.is_financial,
    )
    snapshot.routing = case_routing

    if (
        deterministic_routing.pipeline == "golden_hour"
        and deterministic_routing.golden_hour_remaining_seconds is not None
    ):
        from datetime import timedelta
        from shared.constants import GOLDEN_HOUR_MINUTES

        elapsed_seconds = max(
            0,
            GOLDEN_HOUR_MINUTES * 60
            - deterministic_routing.golden_hour_remaining_seconds,
        )
        incident_at = datetime.now(tz=timezone.utc) - timedelta(
            seconds=elapsed_seconds
        )
        incident_iso = incident_at.isoformat()
        snapshot.incident_at = incident_iso
        sf.timestamp = incident_iso

    # Detect payment method from routing
    if deterministic_routing.is_financial:
        from app.services.routing import _detect_payment_method

        method = _detect_payment_method(
            user_message + "\n" + (evidence_text or ""), None
        )
        if method and method != "auto":
            snapshot.payment_method = method

    # --- Derive missing fields ---
    snapshot.missing_required_fields = _derive_missing(snapshot)

    # --- Determine next action ---
    if snapshot.missing_required_fields:
        snapshot.next_action = "ask_followup"
    else:
        snapshot.next_action = "confirm_facts"

    # --- Add safety flags ---
    for flag in llm_output.safety_flags:
        if flag not in snapshot.safety_flags:
            snapshot.safety_flags.append(flag)

    return snapshot


def _derive_missing(snapshot: CaseStateSnapshot) -> list[str]:
    """Determine which critical fields are still missing."""
    missing: list[str] = []
    if not snapshot.fraud_type or snapshot.fraud_type == "unknown":
        missing.append("fraud_type")
    if not snapshot.payment_method or snapshot.payment_method in ("unknown", "auto"):
        missing.append("payment_method")
    if snapshot.amount is None:
        missing.append("amount")
    if not snapshot.incident_at:
        missing.append("incident_at")
    if not snapshot.location.district:
        missing.append("location.district")
    # For financial fraud, need a receiver identifier
    if snapshot.fraud_type not in ("sextortion", "harassment", "account_hack", "other"):
        f = snapshot.facts
        if not f.upi_id and not f.phone and not f.handle:
            missing.append("receiver_identifier")
    return missing


def build_context_packet(
    *,
    snapshot: CaseStateSnapshot,
    current_phase: str,
    last_messages: list[dict[str, str]],
    user_message: str,
) -> str:
    """Build a compact context packet for the LLM prompt."""
    lines = [
        f"Current phase: {current_phase}",
        f"Current redacted case summary: {snapshot.incident_summary[:200] if snapshot.incident_summary else '(none)'}",
        f"Known facts: fraud_type={snapshot.fraud_type}, payment_method={snapshot.payment_method}, "
        f"amount={snapshot.amount}, incident_at={snapshot.incident_at}, "
        f"upi_id={snapshot.facts.upi_id}, phone={snapshot.facts.phone}, "
        f"utr={snapshot.facts.utr}, bank={snapshot.facts.bank}",
        f"User distress: {snapshot.user_distress}",
        f"Location: {snapshot.location.district or 'unknown'}, {snapshot.location.state or 'unknown'}",
    ]

    if snapshot.routing:
        lines.append(
            f"Deterministic routing: {snapshot.routing.pipeline}, "
            f"confidence={snapshot.routing.confidence}"
        )

    lines.append(f"Missing critical fields: {snapshot.missing_required_fields or 'none'}")
    lines.append(f"Safety flags: {snapshot.safety_flags or 'none'}")
    lines.append(f"\nAllowed actions: ask_followup, confirm_facts, fallback_to_deterministic")
    lines.append(f"\nLast {len(last_messages)} messages:")
    for msg in last_messages:
        lines.append(f"  [{msg['role']}]: {msg['content'][:300]}")

    return "\n".join(lines)
