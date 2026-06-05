"""Deterministic recovery probability band.

We compute a band of plausible recovery outcomes using a small set of rules
based on fraud type, time since incident, amount, and payment method. The
band is honest: it always states the range, never a single point, and never
implies a guarantee.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models import ExtractedFacts, RecoveryBand


def recovery_band(
    *,
    fraud_type: str,
    incident_at: Optional[datetime],
    amount: Optional[float],
    payment_method: str,
    is_financial: bool,
) -> RecoveryBand:
    """Return a band and the factors behind it."""

    if not is_financial:
        return RecoveryBand(
            label="Not applicable (non-financial)",
            low_pct=0,
            high_pct=0,
            explanation=(
                "Recovery probability is not meaningful for non-financial cybercrimes. "
                "The focus is on preserving evidence and routing the complaint to the "
                "right authority."
            ),
            factors=[
                "No money was reported as lost in this incident.",
                "Efforts concentrate on evidence preservation and complaint routing.",
            ],
        )

    minutes = None
    if incident_at is not None:
        if incident_at.tzinfo is None:
            incident_at = incident_at.replace(tzinfo=timezone.utc)
        minutes = max(0, int((datetime.now(tz=timezone.utc) - incident_at).total_seconds() // 60))

    base_low, base_high = 5, 25  # baseline when everything is bad

    factors: list[str] = []
    if minutes is not None:
        if minutes < 60:
            base_low, base_high = 45, 70
            factors.append(f"Reported {minutes} minutes after incident — still inside the golden hour.")
        elif minutes < 360:
            base_low, base_high = 25, 45
            factors.append(f"Reported {minutes} minutes after incident — golden hour closed, but early enough for action.")
        elif minutes < 1440:
            base_low, base_high = 12, 25
            factors.append("Reported within 24 hours — bank nodal officer and NCRP can still act.")
        elif minutes < 4320:
            base_low, base_high = 5, 15
            factors.append("Reported within 3 days — chances of fund blocking are low.")
        else:
            base_low, base_high = 2, 8
            factors.append("Reported after 3 days — fund recovery is unlikely.")

    if payment_method == "upi":
        base_low += 5
        base_high += 5
        factors.append("UPI transfers can sometimes be recalled by the issuing PSP if escalated quickly.")
    elif payment_method == "card":
        base_low += 3
        base_high += 3
        factors.append("Card payments may be disputed under chargeback policies.")
    elif payment_method == "netbanking":
        base_low -= 2
        base_high -= 2
        factors.append("Netbanking transfers (IMPS/NEFT/RTGS) are harder to recall once settled.")
    elif payment_method == "wallet":
        factors.append("Wallet balances can sometimes be frozen if escalation reaches the wallet issuer.")

    if amount is not None and amount >= 100000:
        base_low -= 5
        base_high -= 5
        factors.append("High-value transfers often move through layered accounts, reducing recovery chances.")
    elif amount is not None and amount < 5000:
        base_low += 3
        base_high += 3
        factors.append("Small-amount transfers are easier to trace and freeze.")

    if fraud_type in ("job_scam",):
        base_low -= 2
        base_high -= 2
        factors.append("Job scams typically involve multiple small transfers over time.")

    low = max(0, min(100, base_low))
    high = max(low, min(100, base_high))
    label = _label_for(high)
    explanation = (
        "Reporting is the most important step. These ranges are heuristic and depend on "
        "cooperation from the bank, payment app, and law enforcement. Submitting the NCRP "
        "complaint and the bank dispute email gives the case the best chance."
    )
    return RecoveryBand(
        label=label,
        low_pct=low,
        high_pct=high,
        explanation=explanation,
        factors=factors or ["Reporting quickly and submitting full evidence is the single biggest factor."],
    )


def _label_for(high: int) -> str:
    if high >= 60:
        return "Moderate-to-good"
    if high >= 30:
        return "Low-to-moderate"
    if high >= 10:
        return "Low"
    return "Very low"
