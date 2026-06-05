"""Urgency + pipeline routing.

CyberSaathi does not ask users to pick a fraud category first. The routing
engine reads the user's natural-language description, the pasted SMS, the
inferred amount, and the incident time, and decides whether to send the user
to Golden Hour, Post-Golden-Hour, or the Fall-Back Agent.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from shared.constants import GOLDEN_HOUR_MINUTES, PIPELINES

from app.models import GeoPoint, IntakeRequest, Pipeline, RoutingDecision


_HIGH_DISTRESS_TERMS = (
    "scared",
    "panic",
    "panicking",
    "afraid",
    "shame",
    "ashamed",
    "threat",
    "threatened",
    "blackmail",
    "suicide",
    "killed",
    "die",
)

_NON_FINANCIAL_TERMS = (
    "hacked",
    "account hack",
    "password changed",
    "can't login",
    "cannot login",
    "locked out",
    "private photo",
    "private video",
    "nude",
    "explicit",
    "harass",
    "stalking",
    "abusive messages",
    "fake profile",
    "morphed",
)

_FINANCIAL_TERMS = (
    "paid",
    "transferred",
    "sent money",
    "sent rs",
    "transferred rs",
    "upi",
    "google pay",
    "phonepe",
    "paytm",
    "card",
    "credited",
    "debited",
    "wallet",
    "loan",
    "refund",
    "deposit",
    "withdraw",
    "amount",
    "rs ",
    "inr",
    "₹",
)

_PAYMENT_HINTS = {
    "upi": ("upi", "google pay", "gpay", "phonepe", "paytm", "bhim", "@upi"),
    "card": ("card", "credit card", "debit card", "visa", "mastercard", "rupay"),
    "netbanking": ("netbanking", "net banking", "imps", "neft", "rtgs", "bank account"),
    "wallet": ("wallet", "amazon pay", "mobikwik", "freecharge"),
    "cash": ("cash", "in person"),
}


def _is_financial(description: str) -> bool:
    desc = description.lower()
    return any(term in desc for term in _FINANCIAL_TERMS)


def _is_non_financial(description: str) -> bool:
    desc = description.lower()
    return any(term in desc for term in _NON_FINANCIAL_TERMS)


def _is_high_distress(description: str) -> bool:
    desc = description.lower()
    return any(term in desc for term in _HIGH_DISTRESS_TERMS)


def _detect_payment_method(description: str, provided: Optional[str]) -> str:
    if provided and provided != "auto":
        return provided
    desc = description.lower()
    for method, hints in _PAYMENT_HINTS.items():
        if any(h in desc for h in hints):
            return method
    return "upi"


def _detect_fraud_type(description: str) -> str:
    desc = description.lower()
    if any(t in desc for t in ("sextortion", "private photo", "private video", "nude", "morphed", "blackmail")):
        return "sextortion"
    if any(t in desc for t in ("job", "interview", "salary", "registration fee", "consultancy")):
        return "job_scam"
    if any(t in desc for t in ("hacked", "account hack", "can't login", "cannot login", "password changed")):
        return "account_hack"
    if any(t in desc for t in ("harass", "stalking", "abusive", "threatening message", "fake profile")):
        return "harassment"
    if any(t in desc for t in ("phishing", "fake link", "fake website", "clicked a link")):
        return "phishing"
    if any(t in desc for t in ("refund", "customer care", "helpline number")):
        return "phishing"
    if "upi" in desc or "google pay" in desc or "phonepe" in desc or "paytm" in desc:
        return "upi_fraud"
    if "card" in desc or "credit" in desc or "debit" in desc:
        return "online_payment_fraud"
    if "netbanking" in desc or "bank account" in desc:
        return "banking_fraud"
    return "other"


def _amount_from_text(description: str, provided: Optional[float]) -> Optional[float]:
    if provided is not None and provided > 0:
        return float(provided)
    match = re.search(
        r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]*)",
        description,
        flags=re.IGNORECASE,
    )
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def _minutes_since(incident_at: Optional[datetime]) -> Optional[int]:
    if not incident_at:
        return None
    if incident_at.tzinfo is None:
        incident_at = incident_at.replace(tzinfo=timezone.utc)
    delta = datetime.now(tz=timezone.utc) - incident_at
    minutes = int(delta.total_seconds() // 60)
    # If the user typed a future timestamp, treat it as "just now" rather than
    # producing a negative number that confuses the UI.
    return max(0, minutes)


_MINUTES_PATTERN = re.compile(
    r"(\d+)\s*(minute|minutes|min|mins|pehle|ago)",
    flags=re.IGNORECASE,
)
_HOURS_PATTERN = re.compile(
    r"(\d+)\s*(hour|hours|hr|hrs|ghante|ghanta)",
    flags=re.IGNORECASE,
)
_DAYS_PATTERN = re.compile(
    r"(\d+)\s*(day|days|din|dino|hafte|hafta|week|weeks)",
    flags=re.IGNORECASE,
)


def _minutes_from_text(text: str) -> Optional[int]:
    """Parse incident time from natural-language phrases like
    "15 minutes ago", "2 ghante pehle", "3 days ago"."""
    if not text:
        return None
    days_match = _DAYS_PATTERN.search(text)
    if days_match:
        try:
            return int(days_match.group(1)) * 24 * 60
        except ValueError:
            pass
    hours_match = _HOURS_PATTERN.search(text)
    if hours_match:
        try:
            return int(hours_match.group(1)) * 60
        except ValueError:
            pass
    minutes_match = _MINUTES_PATTERN.search(text)
    if minutes_match:
        try:
            return int(minutes_match.group(1))
        except ValueError:
            pass
    return None


def route_intake(request: IntakeRequest) -> RoutingDecision:
    """Decide the pipeline based on the user's description and metadata."""

    text = "\n".join(
        part for part in (request.description, request.evidence_text or "", request.extra_pasted_sms or "") if part
    )
    fraud_type = _detect_fraud_type(text)
    payment_method = _detect_payment_method(text, request.payment_method)
    is_financial = _is_financial(text) and not _is_non_financial(text)
    is_high_distress = _is_high_distress(text)
    minutes_since = _minutes_since(request.incident_at)
    if minutes_since is None:
        minutes_since = _minutes_from_text(text)
    reasoning: list[str] = []

    pipeline: Pipeline
    if is_high_distress and _is_non_financial(text):
        pipeline = "fall_back"
        reasoning.append("High distress signals detected; routing to Fall-Back agent for support-first handling.")
    elif is_financial and minutes_since is not None and minutes_since < GOLDEN_HOUR_MINUTES:
        pipeline = "golden_hour"
        if minutes_since == 0:
            reasoning.append("Financial fraud reported just now — still inside the 60-minute golden window.")
        elif minutes_since == 1:
            reasoning.append("Financial fraud reported 1 minute ago — still inside the 60-minute golden window.")
        else:
            reasoning.append(
                f"Financial fraud reported {minutes_since} minutes ago — still inside the 60-minute golden window."
            )
    elif is_financial and minutes_since is not None and minutes_since >= GOLDEN_HOUR_MINUTES:
        pipeline = "post_golden_hour"
        if minutes_since < 1440:
            hours = minutes_since // 60
            reasoning.append(
                f"Financial fraud reported about {hours} hour(s) ago — past the 60-minute golden window."
            )
        else:
            days = minutes_since // 1440
            reasoning.append(
                f"Financial fraud reported {days} day(s) ago — past the 60-minute golden window."
            )
    elif is_financial:
        pipeline = "post_golden_hour"
        reasoning.append("Financial fraud with no clear incident time; using post-golden-hour path.")
    elif _is_non_financial(text):
        pipeline = "post_golden_hour"
        reasoning.append(f"Non-financial cybercrime ({fraud_type}) routed to post-golden-hour guidance.")
    else:
        pipeline = "fall_back"
        reasoning.append("Low-confidence description; routing to Fall-Back agent for clarifying questions.")

    confidence = _compute_confidence(request, fraud_type, minutes_since)
    if confidence < 0.45 and pipeline != "fall_back":
        reasoning.append(
            f"Classification confidence {confidence:.0%} below 45% — escalating to Fall-Back agent."
        )
        pipeline = "fall_back"

    golden_hour_remaining_seconds: Optional[int] = None
    if pipeline == "golden_hour" and minutes_since is not None:
        golden_hour_remaining_seconds = max(0, (GOLDEN_HOUR_MINUTES - minutes_since) * 60)

    reasoning.append(f"Detected fraud type: {fraud_type}.")
    reasoning.append(f"Detected payment method: {payment_method}.")
    return RoutingDecision(
        pipeline=pipeline,
        confidence=round(confidence, 2),
        reasoning=reasoning,
        golden_hour_remaining_seconds=golden_hour_remaining_seconds,
        is_financial=is_financial or payment_method in {"upi", "card", "netbanking", "wallet"},
    )


def _compute_confidence(
    request: IntakeRequest,
    fraud_type: str,
    minutes_since: Optional[int],
) -> float:
    score = 0.4  # base — we always have some signal from the description
    text = (request.description or "").lower()
    if request.amount or re.search(r"rs\.?\s?\d", text):
        score += 0.2
    if request.payment_method and request.payment_method != "auto":
        score += 0.1
    if request.incident_at or re.search(r"\b\d{1,2}\s?(am|pm|:\d{2})\b", text) or "ago" in text or _minutes_from_text(text) is not None:
        score += 0.1
    if fraud_type != "other":
        score += 0.15
    if minutes_since is not None and 0 <= minutes_since <= 24 * 60:
        score += 0.1
    return min(score, 1.0)


def route_fall_back(
    request: IntakeRequest,
    *,
    current_step: str,
    answers: dict[str, str],
) -> RoutingDecision:
    """Re-evaluate routing after a Fall-Back clarifying turn."""

    combined = request.description + "\n" + " ".join(answers.values())
    new_request = IntakeRequest(
        description=combined,
        evidence_text=request.evidence_text,
        incident_at=request.incident_at,
        amount=request.amount,
        payment_method=request.payment_method,
        location=request.location,
        contact_channel=request.contact_channel,
        preferred_language=request.preferred_language,
        extra_pasted_sms=request.extra_pasted_sms,
    )
    decision = route_intake(new_request)
    decision.reasoning.append(f"Re-evaluated from Fall-Back step: {current_step}.")
    return decision
