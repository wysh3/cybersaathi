"""LLM Intake Orchestrator — ties NIM provider, prompts, guardrails, reducer.

For each conversation turn:
1. Build context packet from conversation history + case snapshot.
2. Send to NIM with system + developer prompts.
3. Parse and validate JSON output.
4. Run guardrails on LLM output.
5. Merge with deterministic extraction and routing.
6. Update case state.
7. Save invocation audit trail.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from app.models.llm_intake import (
    CaseStateSnapshot,
    LlmOutput,
)
from app.services.llm import (
    chat_completion_json,
    chat_completion_vision,
    extract_content,
    extract_usage,
    get_intake_model,
    get_vision_model,
    is_llm_enabled,
)
from app.services.llm_intake.guardrails import (
    block_output,
    get_input_safety_flags,
    SELF_HARM_RESPONSE,
)
from app.services.llm_intake.reducer import build_context_packet, reduce_case_state


# ---------------------------------------------------------------------------
# Prompt loading
# ---------------------------------------------------------------------------

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def _load_prompt(name: str) -> str:
    path = _PROMPTS_DIR / name
    if path.exists():
        return path.read_text()
    return ""


_SYSTEM_PROMPT = ""

def _ensure_prompts_loaded() -> None:
    global _SYSTEM_PROMPT
    if not _SYSTEM_PROMPT:
        _SYSTEM_PROMPT = _load_prompt("system.md")


# ---------------------------------------------------------------------------
# Deterministic fallback
# ---------------------------------------------------------------------------


def _enrich_snapshot_with_det_facts(
    snapshot: CaseStateSnapshot,
    det_facts,
    det_routing,
) -> CaseStateSnapshot:
    """Quickly merge deterministic facts into snapshot for context building.
    
    This gives the LLM visibility into already-extracted UTR, amount, bank,
    payment app, etc. so it doesn't ask redundant questions.
    Does NOT derive missing fields or set next_action — that's reducer's job.
    """
    enriched = snapshot.model_copy(deep=True)
    f = enriched.facts
    
    if det_facts.utr and not f.utr:
        f.utr = det_facts.utr
    if det_facts.upi_id and not f.upi_id:
        f.upi_id = det_facts.upi_id
    if det_facts.amount and not f.amount:
        f.amount = det_facts.amount
        enriched.amount = det_facts.amount
    if det_facts.bank and not f.bank:
        f.bank = det_facts.bank
    if det_facts.payment_app and not f.payment_app:
        f.payment_app = det_facts.payment_app
    if det_facts.phone and not f.phone:
        f.phone = det_facts.phone
    if det_facts.timestamp and not f.timestamp:
        ts = det_facts.timestamp
        f.timestamp = ts if isinstance(ts, str) else ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
    if det_routing and not enriched.routing:
        from app.models.llm_intake import CaseRouting
        enriched.routing = CaseRouting(
            pipeline=det_routing.pipeline,
            confidence=det_routing.confidence,
            golden_hour_remaining_seconds=det_routing.golden_hour_remaining_seconds,
            is_financial=det_routing.is_financial,
        )
    
    return enriched


def _build_fallback_output(
    snapshot: CaseStateSnapshot,
) -> LlmOutput:
    """Build a deterministic LlmOutput when LLM is disabled or fails."""
    from app.models.llm_intake import CasePatch, Question

    missing = snapshot.missing_required_fields or []
    questions: list[Question] = []

    field_prompts = {
        "fraud_type": ("fraud_type", "What type of fraud happened?", "Needed to route correctly."),
        "payment_method": ("payment_method", "How did you pay — UPI, card, or netbanking?", "Needed for recovery guidance."),
        "amount": ("amount", "How much money was involved?", "Needed to assess severity."),
        "incident_at": ("incident_time", "About how many minutes or hours ago did this happen?", "Needed to decide Golden Hour path."),
        "location.district": ("location", "Which district are you in?", "Needed for jurisdiction."),
        "receiver_identifier": ("receiver_id", "Do you have the UPI ID or phone number you sent money to?", "Needed to identify the scammer."),
    }

    if missing:
        first_missing = missing[0]
        prompt_info = field_prompts.get(first_missing, ("unknown", f"Can you tell me about: {first_missing}?", "Needed to proceed."))
        questions.append(Question(id=prompt_info[0], prompt=prompt_info[1], reason=prompt_info[2]))
        assistant_msg = prompt_info[1]
        next_action = "ask_followup"
    else:
        assistant_msg = _build_confirm_text(snapshot)
        next_action = "confirm_facts"

    return LlmOutput(
        assistant_message=assistant_msg,
        case_patch=CasePatch(),
        missing_fields=missing,
        next_action=next_action,
        confidence=0.7,
        safety_flags=[],
        questions=questions,
    )


def _build_confirm_text(snapshot: CaseStateSnapshot) -> str:
    parts = ["Here's what I found from your description. Please check if this looks right:"]
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
    if snapshot.routing:
        parts.append(f"• Route: {snapshot.routing.pipeline.replace('_', ' ')}")
    parts.append("\nIf this looks right, click Confirm. If something is wrong, tell me what to fix.")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class LlmIntakeOrchestrator:
    """Orchestrates an LLM-powered intake turn.

    Usage:
        orchestrator = LlmIntakeOrchestrator()
        result = await orchestrator.process_turn(
            current_snapshot=...,
            current_phase="clarify",
            user_message="...",
            evidence_text="...",
            conversation_history=[...],
        )
    """

    def __init__(self) -> None:
        _ensure_prompts_loaded()

    async def process_turn(
        self,
        *,
        current_snapshot: CaseStateSnapshot,
        current_phase: str,
        user_message: str,
        evidence_text: Optional[str],
        conversation_history: list[dict[str, Any]],
        image_base64: Optional[str] = None,
    ) -> dict[str, Any]:
        """Process a single user turn.

        If image_base64 is provided, the vision model extracts text from
        the image first. That text is merged into evidence_text for
        deterministic extraction and LLM context.
        """
        # Check input safety
        input_flags = get_input_safety_flags(user_message)
        has_self_harm = "self_harm_terms_detected" in input_flags

        # Run deterministic services first (always authoritative)
        from app.models import IntakeRequest
        from app.services.extraction import extract_facts
        from app.services.routing import route_intake
        from app.services.redaction import redact_text

        # If an image is attached, run vision extraction first.
        # The extracted text becomes additional evidence for deterministic extraction.
        vision_text: Optional[str] = None
        if image_base64 and is_llm_enabled():
            try:
                vision_response = await chat_completion_vision(
                    image_base64,
                    temperature=0.1,
                    max_tokens=800,
                )
                vision_text = extract_content(vision_response).strip()
            except Exception:
                vision_text = None  # Vision failed, continue with text-only

        # Merge vision text into evidence (vision text comes after user message)
        combined_evidence = evidence_text
        if vision_text:
            combined_evidence = (
                (evidence_text + "\n") if evidence_text else ""
            ) + vision_text

        intake_req = IntakeRequest(
            description=user_message,
            evidence_text=combined_evidence,
            incident_at=None,
            amount=current_snapshot.amount,
            payment_method=current_snapshot.payment_method
            if current_snapshot.payment_method != "unknown"
            else "auto",
            location=None,
            contact_channel="web",
            preferred_language=current_snapshot.language,
            extra_pasted_sms=None,
        )
        det_routing = route_intake(intake_req)
        det_facts = extract_facts(
            description=user_message,
            evidence_text=combined_evidence,
            amount_hint=current_snapshot.amount,
            incident_at=None,
        )

        # If self-harm detected, return supportive response with reduced processing
        if has_self_harm:
            snapshot = current_snapshot.model_copy(deep=True)
            snapshot.safety_flags.append("self_harm_terms_detected")
            snapshot.next_action = "ask_followup"

            return {
                "llm_output": LlmOutput(
                    assistant_message=SELF_HARM_RESPONSE,
                    case_patch=None,
                    missing_fields=snapshot.missing_required_fields,
                    next_action="ask_followup",
                    confidence=0.5,
                    safety_flags=["self_harm_terms_detected"],
                    questions=[],
                ),
                "case_snapshot": snapshot,
                "invocation_summary": {
                    "input_summary": "self_harm_terms_detected_in_input",
                    "output_summary": "self_harm_support_response",
                    "latency_ms": 0,
                    "status": "blocked",
                    "token_usage": {},
                },
                "used_llm": False,
            }

        # If LLM is not enabled, use deterministic fallback
        if not is_llm_enabled():
            snapshot = reduce_case_state(
                current_snapshot=current_snapshot,
                llm_output=_build_fallback_output(current_snapshot),
                deterministic_facts=det_facts,
                deterministic_routing=det_routing,
                user_message=user_message,
                evidence_text=evidence_text,
            )
            fallback = _build_fallback_output(snapshot)

            return {
                "llm_output": fallback,
                "case_snapshot": snapshot,
                "invocation_summary": {
                    "input_summary": "llm_disabled_fallback",
                    "output_summary": "deterministic_fallback",
                    "latency_ms": 0,
                    "status": "fallback",
                    "token_usage": {},
                },
                "used_llm": False,
            }

        # --- LLM path ---
        # Pre-enrich snapshot with deterministic extraction before building
        # context, so the LLM sees already-extracted UTR, amount, bank, etc.
        enriched = _enrich_snapshot_with_det_facts(
            current_snapshot, det_facts, det_routing
        )
        
        # Build redacted conversation history
        redacted_history: list[dict[str, str]] = []
        for msg in conversation_history[-10:]:  # Last 10 messages
            content = msg.get("content_redacted", msg.get("content", ""))
            redacted_history.append({
                "role": msg.get("role", "user"),
                "content": content[:500],  # Truncate long messages
            })

        # Build context packet using enriched snapshot
        context = build_context_packet(
            snapshot=enriched,
            current_phase=current_phase,
            last_messages=redacted_history,
            user_message=redact_text(user_message),
        )

        # Build messages for NIM
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ]

        # Call NIM
        start_time = time.monotonic()
        try:
            response = await chat_completion_json(
                messages,
                model=get_intake_model(),
                temperature=0.1,
                max_tokens=2000,
            )
            latency_ms = int((time.monotonic() - start_time) * 1000)
            raw_content = extract_content(response)
            usage = extract_usage(response)

            # Parse JSON output
            try:
                parsed = json.loads(raw_content)
                llm_output = LlmOutput.model_validate(parsed)
            except (json.JSONDecodeError, ValueError) as e:
                # Try repair: re-prompt once
                repair_messages = messages + [
                    {"role": "assistant", "content": raw_content},
                    {
                        "role": "user",
                        "content": f"Your previous response was not valid JSON. Error: {e}. "
                        f"Please output ONLY valid JSON following the exact schema. "
                        f"No markdown, no explanation.",
                    },
                ]
                try:
                    response2 = await chat_completion_json(
                        repair_messages,
                        model=get_intake_model(),
                        temperature=0.1,
                        max_tokens=2000,
                    )
                    latency_ms = int((time.monotonic() - start_time) * 1000)
                    raw_content = extract_content(response2)
                    usage2 = extract_usage(response2)
                    usage = {
                        "prompt_tokens": usage.get("prompt_tokens", 0)
                        + usage2.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0)
                        + usage2.get("completion_tokens", 0),
                    }
                    parsed = json.loads(raw_content)
                    llm_output = LlmOutput.model_validate(parsed)
                except Exception:
                    # Repair failed, use fallback
                    return await self._fallback_response(
                        current_snapshot, det_facts, det_routing,
                        user_message, evidence_text,
                        input_summary="json_parse_repair_failed",
                        output_summary=raw_content[:500],
                        latency_ms=latency_ms,
                        status="fallback",
                    )

            # Run output guardrails
            blocked_msg = block_output(llm_output.assistant_message)
            if blocked_msg:
                llm_output.assistant_message = blocked_msg
                return {
                    "llm_output": llm_output,
                    "case_snapshot": current_snapshot,
                    "invocation_summary": {
                        "input_summary": "content_blocked_by_guardrails",
                        "output_summary": llm_output.assistant_message[:200],
                        "latency_ms": latency_ms,
                        "status": "blocked",
                        "token_usage": usage,
                    },
                    "used_llm": True,
                    "vision_text": vision_text,
                }

            # Merge with deterministic services
            final_snapshot = reduce_case_state(
                current_snapshot=current_snapshot,
                llm_output=llm_output,
                deterministic_facts=det_facts,
                deterministic_routing=det_routing,
                user_message=user_message,
                evidence_text=combined_evidence,
            )

            return {
                "llm_output": llm_output,
                "case_snapshot": final_snapshot,
                "invocation_summary": {
                    "input_summary": user_message[:200],
                    "output_summary": llm_output.assistant_message[:200],
                    "latency_ms": latency_ms,
                    "status": "success",
                    "token_usage": usage,
                },
                "used_llm": True,
                "vision_text": vision_text,
            }

        except Exception as e:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            return await self._fallback_response(
                current_snapshot, det_facts, det_routing,
                user_message, evidence_text,
                input_summary=f"llm_error: {str(e)[:200]}",
                output_summary="llm_call_failed",
                latency_ms=latency_ms,
                status="failed",
                error_type=type(e).__name__,
            )

    async def _fallback_response(
        self,
        snapshot: CaseStateSnapshot,
        det_facts,
        det_routing,
        user_message: str,
        evidence_text: str | None,
        input_summary: str,
        output_summary: str,
        latency_ms: int,
        status: str,
        error_type: str | None = None,
    ) -> dict[str, Any]:
        """Return a deterministic fallback response."""
        snapshot = reduce_case_state(
            current_snapshot=snapshot,
            llm_output=_build_fallback_output(snapshot),
            deterministic_facts=det_facts,
            deterministic_routing=det_routing,
            user_message=user_message,
            evidence_text=evidence_text,
        )
        fallback = _build_fallback_output(snapshot)

        return {
            "llm_output": fallback,
            "case_snapshot": snapshot,
            "invocation_summary": {
                "input_summary": input_summary,
                "output_summary": output_summary,
                "latency_ms": latency_ms,
                "status": status,
                "error_type": error_type,
                "token_usage": {},
            },
            "used_llm": False,
        }
