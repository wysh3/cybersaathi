"""Canonical cybercrime workflow categories.

Dashboard, clustering, and post-report workflow surfaces should expose only
these five stable categories. Intake may still use fine-grained detection
hints internally, but anything persisted or aggregated should be normalized.
"""

from __future__ import annotations

from typing import Literal


CanonicalFraudCategory = Literal[
    "personal_safety_extortion",
    "money_movement_fraud",
    "device_data_compromise",
    "identity_account_control",
    "platform_content_suspect",
]

CANONICAL_FRAUD_CATEGORIES: tuple[CanonicalFraudCategory, ...] = (
    "personal_safety_extortion",
    "money_movement_fraud",
    "device_data_compromise",
    "identity_account_control",
    "platform_content_suspect",
)


def canonical_fraud_category(value: str, *, summary: str = "", amount: float = 0) -> CanonicalFraudCategory:
    raw = (value or "").lower()
    text = f"{raw}\n{summary or ''}".lower()

    if raw in CANONICAL_FRAUD_CATEGORIES:
        return raw  # type: ignore[return-value]

    if any(
        term in text
        for term in (
            "sextortion",
            "harassment",
            "stalking",
            "blackmail",
            "doxx",
            "threat",
            "private video",
            "private photo",
            "self-harm",
            "suicide",
            "child",
        )
    ):
        return "personal_safety_extortion"

    if any(
        term in text
        for term in (
            "ransomware",
            "malware",
            "virus",
            "remote_access",
            "remote access",
            "anydesk",
            "teamviewer",
            "locked",
            "infected",
            "breach",
        )
    ):
        return "device_data_compromise"

    if any(
        term in text
        for term in (
            "account_hack",
            "account hack",
            "sim_swap",
            "identity_theft",
            "identity theft",
            "data_breach",
            "email",
            "kyc",
            "credential",
            "password",
            "otp",
        )
    ):
        return "identity_account_control"

    if amount > 0 or any(
        term in text
        for term in (
            "upi",
            "banking_fraud",
            "wallet_fraud",
            "online_payment_fraud",
            "card_fraud",
            "job_scam",
            "loan_scam",
            "refund",
            "investment",
            "crypto",
            "non_delivery",
            "money",
            "paid",
            "payment",
            "transferred",
        )
    ):
        return "money_movement_fraud"

    return "platform_content_suspect"
