"""Mock OCR/NER extraction for CyberSaathi.

The MVP does not call any real OCR or model. We use deterministic regex-based
extraction that covers the most common Indian cyber-fraud artefacts: UTR,
UPI IDs, amounts, timestamps, banks, payment apps, phones, social handles,
URLs, and name mentions. The interface is clean so a real model can be dropped
in later.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Iterable, Optional

from app.models import ExtractedFacts
from app.services.redaction import redact_text


_UPI_RE = re.compile(r"\b([a-zA-Z0-9._-]{2,}@(?:upi|ybl|okhdfcbank|oksbi|axl|ibl|fbl|airtel|apl))\b", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\+?91[\s-]?)?([6-9]\d{9})\b")
_UTR_RE = re.compile(r"\b(?:utr|txn(?:id|ref)?|reference(?:\s*no)?|tx)[\w\s:#=-]{0,30}[\n\r]\s*([0-9]{8,18})\b", re.IGNORECASE)
_AMOUNT_RE = re.compile(r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]*)", re.IGNORECASE)
_BANK_HINTS = {
    "sbi": "State Bank of India",
    "state bank": "State Bank of India",
    "hdfc": "HDFC Bank",
    "icici": "ICICI Bank",
    "axis": "Axis Bank",
    "pnb": "Punjab National Bank",
    "bob": "Bank of Baroda",
    "canara": "Canara Bank",
    "kotak": "Kotak Mahindra Bank",
    "yes bank": "Yes Bank",
    "idfc": "IDFC First Bank",
    "union bank": "Union Bank of India",
}
_APP_HINTS = {
    "google pay": "Google Pay",
    "gpay": "Google Pay",
    "phonepe": "PhonePe",
    "paytm": "Paytm",
    "bhim": "BHIM",
    "amazon pay": "Amazon Pay",
    "whatsapp pay": "WhatsApp Pay",
}
_HANDLE_RE = re.compile(r"(?<![\w.])(@[A-Za-z0-9_]{3,30})\b")
_URL_RE = re.compile(r"\b((?:https?://)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b", re.IGNORECASE)
_NAME_HINT_RE = re.compile(
    r"\b(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})",
)


def _first(patterns: Iterable[re.Match[str]]) -> Optional[str]:
    for m in patterns:
        return m.group(1)
    return None


def _parse_timestamp(text: str) -> Optional[datetime]:
    # Look for common Indian time formats first.
    from datetime import timezone as _tz

    month_names = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }
    patterns = (
        (
            "numeric_date",
            r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b",
        ),
        (
            "month_name_date",
            r"\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
        ),
        ("time_only", r"\b(\d{1,2}):(\d{2})\s*(am|pm)\b"),
    )
    for kind, pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        try:
            groups = match.groups()
            if kind == "numeric_date":
                d, mo, y, h, mi, meridiem = groups
                hour = int(h)
                if meridiem and meridiem.lower() == "pm" and hour < 12:
                    hour += 12
                if meridiem and meridiem.lower() == "am" and hour == 12:
                    hour = 0
                year = int(y)
                if year < 100:
                    year += 2000
                return datetime(year, int(mo), int(d), hour, int(mi), tzinfo=_tz.utc)
            if kind == "month_name_date":
                d, month_name, y, h, mi, meridiem = groups
                month = month_names.get(month_name.lower())
                if month is None:
                    continue
                hour = int(h)
                if meridiem and meridiem.lower() == "pm" and hour < 12:
                    hour += 12
                if meridiem and meridiem.lower() == "am" and hour == 12:
                    hour = 0
                year = int(y)
                if year < 100:
                    year += 2000
                return datetime(year, month, int(d), hour, int(mi or "0"), tzinfo=_tz.utc)
            if kind == "time_only":
                h, mi, meridiem = groups
                hour = int(h)
                if meridiem and meridiem.lower() == "pm" and hour < 12:
                    hour += 12
                if meridiem and meridiem.lower() == "am" and hour == 12:
                    hour = 0
                today = datetime.now(tz=_tz.utc).date()
                return datetime(today.year, today.month, today.day, hour, int(mi), tzinfo=_tz.utc)
        except ValueError:
            continue
    return None


def _detect_bank(text: str) -> Optional[str]:
    lower = text.lower()
    for hint, full_name in _BANK_HINTS.items():
        if hint in lower:
            return full_name
    return None


def _detect_payment_app(text: str) -> Optional[str]:
    lower = text.lower()
    for hint, full_name in _APP_HINTS.items():
        if hint in lower:
            return full_name
    return None


def extract_facts(
    *,
    description: str,
    evidence_text: Optional[str] = None,
    extra_pasted_sms: Optional[str] = None,
    amount_hint: Optional[float] = None,
    incident_at: Optional[datetime] = None,
) -> ExtractedFacts:
    """Return deterministic facts for a single intake submission."""

    sources = [description, evidence_text or "", extra_pasted_sms or ""]
    combined = "\n".join(s for s in sources if s)
    redacted_combined = redact_text(combined)

    upi = _first(_UPI_RE.finditer(combined))
    phone = _first(_PHONE_RE.finditer(combined))
    utr = _first(_UTR_RE.finditer(combined))
    amount = amount_hint
    if amount is None:
        m = _AMOUNT_RE.search(combined)
        if m:
            try:
                amount = float(m.group(1).replace(",", ""))
            except ValueError:
                amount = None
    bank = _detect_bank(combined)
    payment_app = _detect_payment_app(combined)
    handle = _first(_HANDLE_RE.finditer(combined))
    url = _first(_URL_RE.finditer(combined))
    timestamp = incident_at or _parse_timestamp(combined)
    names = _NAME_HINT_RE.findall(combined)

    return ExtractedFacts(
        utr=utr,
        upi_id=upi,
        amount=amount,
        timestamp=timestamp,
        bank=bank,
        payment_app=payment_app,
        phone=phone,
        handle=handle,
        url=url,
        name_mentions=names,
    )
