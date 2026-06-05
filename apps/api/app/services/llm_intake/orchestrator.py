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
    extract_content,
    extract_usage,
    get_intake_model,
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
_DEVELOPER_CONTEXT = ""


def _ensure_prompts_loaded() -> None:
    global _SYSTEM_PROMPT, _DEVELOPER_CONTEXT
    if not _SYSTEM_PROMPT:
        _SYSTEM_PROMPT = _load_prompt("system.md")
    if not _DEVELOPER_CONTEXT:
        _DEVELOPER_CONTEXT = _load_prompt("developer_context.md")


# ---------------------------------------------------------------------------
# Deterministic fallback
# ---------------------------------------------------------------------------


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
    if snapshot.routing:
        parts.append(f"• Route: {snapshot.routing.pipeline.replace('_', ' ')}")
    parts.append("\nIf correct, click Confirm. If wrong, tell me what to fix.")
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
    ) -> dict[str, Any]:
        """Process a single user turn.

        Returns a dict with:
          - llm_output: LlmOutput
          - case_snapshot: CaseStateSnapshot
          - invocation_summary: dict (for audit trail)
          - used_llm: bool
        """
        # Check input safety
        input_flags = get_input_safety_flags(user_message)
        has_self_harm = "self_harm_terms_detected" in input_flags

        # Run deterministic services first (always authoritative)
        from app.models import IntakeRequest
        from app.services.extraction import extract_facts
        from app.services.routing import route_intake
        from app.services.redaction import redact_text

        intake_req = IntakeRequest(
            description=user_message,
            evidence_text=evidence_text,
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
            evidence_text=evidence_text,
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
        # Build redacted conversation history
        redacted_history: list[dict[str, str]] = []
        for msg in conversation_history[-10:]:  # Last 10 messages
            content = msg.get("content_redacted", msg.get("content", ""))
            redacted_history.append({
                "role": msg.get("role", "user"),
                "content": content[:500],  # Truncate long messages
            })

        # Build context packet
        context = build_context_packet(
            snapshot=current_snapshot,
            current_phase=current_phase,
            last_messages=redacted_history,
            user_message=redact_text(user_message),
        )

        # Build messages for NIM
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "developer", "content": _DEVELOPER_CONTEXT},
            {"role": "user", "content": context},
        ]

        # Call NIM
        start_time = time.monotonic()
        try:
            response = await chat_completion_json(
                messages,
                model=get_intake_model(),
                temperature=0.1,
                max_tokens=1200,
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
                        max_tokens=1200,
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
                }

            # Merge with deterministic services
            final_snapshot = reduce_case_state(
                current_snapshot=current_snapshot,
                llm_output=llm_output,
                deterministic_facts=det_facts,
                deterministic_routing=det_routing,
                user_message=user_message,
                evidence_text=evidence_text,
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
