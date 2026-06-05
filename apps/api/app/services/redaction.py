"""Redaction service for sensitive PII before persistence or display.

The rules are deliberately strict. CyberSaathi must never store Aadhaar, PAN,
OTPs, bank passwords, full card numbers, PINs, or netbanking credentials. If
such values appear in evidence text we replace them with safe placeholders.
"""

from __future__ import annotations

import re
from typing import Iterable


# Order matters: longer / more specific patterns must run first.
_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "card",
        # 16-digit card numbers, optionally grouped by spaces or hyphens. The
        # 4-4-4-4 grouping must be contiguous.
        re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"),
    ),
    (
        "aadhaar",
        # Aadhaar is 12 digits, typically 4-4-4 grouped. Require a keyword
        # within a short context to avoid colliding with the first 12 digits
        # of a 16-digit card number. Allow up to a few filler tokens
        # (e.g. "is", "no.", "is #", "number").
        re.compile(
            r"(?is)\b(aadhaar|uid(?:ai)?|aadhar)\b[^0-9\n]{0,24}?(\d{4}\s?\d{4}\s?\d{4})"
        ),
    ),
    (
        "pan",
        re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),
    ),
    (
        "cvv",
        re.compile(r"(?i)\b(cvv|cvc)[\s:=-]*\d{3,4}\b"),
    ),
    (
        "otp",
        re.compile(r"(?i)\botp[\s:=-]*\d{4,8}\b"),
    ),
    (
        "pin",
        re.compile(r"(?i)\b(pin|atm\s*pin)[\s:=-]*\d{4,6}\b"),
    ),
    (
        "password",
        re.compile(
            r"(?i)\b(password|passwd|pwd|netbanking\s*password|login\s*password)[\s:=-]+\S+"
        ),
    ),
    (
        "ifsc",
        re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"),
    ),
    (
        "account_long",
        # 9-18 digit account-like numbers. 16-digit numbers are caught by
        # ``card`` first, so this mainly redacts 9-15 digit bank account numbers.
        re.compile(r"\b\d{9,15}\b"),
    ),
)


def redact_text(text: str, *, labels: Iterable[str] | None = None) -> str:
    """Return a copy of *text* with sensitive values replaced by placeholders.

    The redaction uses generic placeholders such as ``[REDACTED:AADHAAR]`` so
    it is obvious to operators that a value was scrubbed. If you pass
    ``labels``, only the listed pattern keys are redacted; otherwise all
    patterns run.
    """

    if not text:
        return text
    allowed = set(labels) if labels is not None else None
    out = text
    for name, pattern in _PATTERNS:
        if allowed is not None and name not in allowed:
            continue
        replacement = f"[REDACTED:{name.upper()}]"
        out = pattern.sub(replacement, out)
    return out


def redact_text_keep_keywords(text: str) -> str:
    """Variant that redacts Aadhaar only when the keyword is present.

    This is used by the evidence storage layer to be conservative: we only
    remove the digits, never the surrounding context word.
    """

    if not text:
        return text
    out = text
    # Run all patterns except aadhaar.
    for name, pattern in _PATTERNS:
        if name == "aadhaar":
            continue
        replacement = f"[REDACTED:{name.upper()}]"
        out = pattern.sub(replacement, out)
    # Aadhaar: keyword + (up to 24 chars of context) + 12 digits in 4-4-4 form.
    aadhaar_pattern = re.compile(
        r"(?is)\b(aadhaar|uid(?:ai)?|aadhar)\b[^0-9\n]{0,24}?\d{4}\s?\d{4}\s?\d{4}"
    )
    out = aadhaar_pattern.sub(r"\1 [REDACTED:AADHAAR]", out)
    return out


def contains_sensitive(text: str) -> bool:
    """Return True if any sensitive pattern matches *text*."""

    for _name, pattern in _PATTERNS:
        if pattern.search(text):
            return True
    return False


def list_pattern_names() -> tuple[str, ...]:
    return tuple(name for name, _ in _PATTERNS)
