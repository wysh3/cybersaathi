"""Tests for the urgency + pipeline routing service."""

from datetime import datetime, timedelta, timezone

from app.models import IntakeRequest
from app.services.routing import route_intake


def _request(description: str, **kwargs) -> IntakeRequest:
    return IntakeRequest(description=description, **kwargs)


def test_priya_routes_to_golden_hour() -> None:
    fifteen_min_ago = datetime.now(tz=timezone.utc) - timedelta(minutes=15)
    request = _request(
        "Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. "
        "Maine bhar diya. Ab number band hai.",
        amount=2500,
        incident_at=fifteen_min_ago,
        payment_method="upi",
    )
    decision = route_intake(request)
    assert decision.pipeline == "golden_hour"
    assert decision.golden_hour_remaining_seconds is not None
    assert decision.golden_hour_remaining_seconds > 0


def test_post_golden_hour_financial_routes_to_post_pipeline() -> None:
    long_ago = datetime.now(tz=timezone.utc) - timedelta(hours=4)
    request = _request(
        "I sent Rs 5000 to scammer@upi 4 hours ago for a refund.",
        amount=5000,
        incident_at=long_ago,
        payment_method="upi",
    )
    decision = route_intake(request)
    assert decision.pipeline == "post_golden_hour"


def test_sextortion_routes_to_fall_back() -> None:
    request = _request(
        "Someone is threatening to leak my private photo unless I pay UPI.",
        payment_method="upi",
    )
    decision = route_intake(request)
    assert decision.pipeline == "fall_back"


def test_account_hack_with_no_money_loss_routes_to_post_golden_hour() -> None:
    request = _request(
        "My social media account was hacked. I cannot login. No money was taken.",
    )
    decision = route_intake(request)
    assert decision.pipeline in ("post_golden_hour", "fall_back")


def test_low_confidence_falls_back() -> None:
    request = _request("hi")
    decision = route_intake(request)
    assert decision.pipeline == "fall_back"
    assert decision.confidence < 0.5
