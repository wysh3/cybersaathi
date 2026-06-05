"""Safety guardrails for LLM intake input and output.

Input guardrails: detect prompt injection, self-harm terms.
Output guardrails: reject claims of official submission, recovery guarantees,
or requests for sensitive credentials.
"""

from __future__ import annotations

import re
from typing import Optional


# ---------------------------------------------------------------------------
# Input guardrails
# ---------------------------------------------------------------------------

_PROMPT_INJECTION_PHRASES = [
    "ignore previous instructions",
    "ignore all instructions",
    "system prompt",
    "you are now",
    "pretend you are",
    "jailbreak",
    "override",
    "do not follow",
    "new instructions",
    "forget everything",
    "you must",
    "your prompt",
]

_SELF_HARM_TERMS = [
    "kill myself",
    "end my life",
    "suicide",
    "self harm",
    "want to die",
    "no reason to live",
]


def detect_prompt_injection(text: str) -> bool:
    """Check if text contains prompt injection phrases."""
    lower = text.lower()
    return any(phrase in lower for phrase in _PROMPT_INJECTION_PHRASES)


def detect_self_harm(text: str) -> bool:
    """Check if text contains self-harm terms."""
    lower = text.lower()
    return any(term in lower for term in _SELF_HARM_TERMS)


def get_input_safety_flags(text: str) -> list[str]:
    """Return safety flags for a user input."""
    flags: list[str] = []
    if detect_prompt_injection(text):
        flags.append("prompt_injection_detected")
    if detect_self_harm(text):
        flags.append("self_harm_terms_detected")
    return flags


# ---------------------------------------------------------------------------
# Output guardrails
# ---------------------------------------------------------------------------

_BLOCKED_OUTPUT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "official_submission",
        re.compile(
            r"(?i)\b(i\s*(have\s*)?(filed|submitted|reported|lodged|registered))\b"
        ),
    ),
    (
        "recovery_guarantee",
        re.compile(
            r"(?i)\b(your\s*money\s*will\s*be\s*(recovered|returned|refunded|back))|"
            r"\b(we\s*will\s*(recover|return|refund|get\s*back)\s*your\s*money)|"
            r"\b(guaranteed?\s*(recovery|refund|return))\b"
        ),
    ),
    (
        "sensitive_request",
        re.compile(
            r"(?i)\b(share|send|provide|tell\s*me|type|enter)\s+(your|the)\s+"
            r"(otp|pin|password|cvv|aadhaar|pan|card\s*number)\b"
        ),
    ),
    (
        "pay_scammer",
        re.compile(
            r"(?i)\b(pay\s+(the\s+)?(scammer|them|the\s+person|more))|"
            r"\b(send\s+(more\s+)?money\s+to)\b"
        ),
    ),
    (
        "invented_stats",
        re.compile(
            r"(?i)\b(\d+[\.,]?\d*\s*(lakh|crore|thousand|million)?\s*(cases|complaints|fir|reports)\s*(filed|registered|resolved))\b"
        ),
    ),
]


def check_output_safety(assistant_text: str) -> list[str]:
    """Check assistant output against blocked patterns.

    Returns a list of safety violations found. Empty list means safe.
    """
    violations: list[str] = []
    for name, pattern in _BLOCKED_OUTPUT_PATTERNS:
        if pattern.search(assistant_text):
            violations.append(name)
    return violations


def block_output(text: str) -> Optional[str]:
    """Check if output should be blocked. Returns a safe replacement message if blocked."""
    violations = check_output_safety(text)
    if violations:
        return (
            "I understand this is a difficult situation. Let me help you take the "
            "right next step. Could you tell me more about what happened so I can "
            "guide you to the correct government service?"
        )
    return None


# ---------------------------------------------------------------------------
# Self-harm response
# ---------------------------------------------------------------------------

SELF_HARM_RESPONSE = (
    "I hear you. What you are feeling matters. If you are thinking about harming "
    "yourself, please reach out to someone who can help right now:\n\n"
    "• iCALL (TISS): 9152987821 — free, confidential counseling\n"
    "• AASRA: 91-9820466726 — 24/7 helpline\n"
    "• Call 112 if you are in immediate danger\n\n"
    "You are not alone. When you are ready, I can also help with the cybercrime "
    "part. You do not need to share anything you are not comfortable with."
)
