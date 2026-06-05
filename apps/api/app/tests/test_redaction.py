"""Tests for the redaction service."""

from app.services.redaction import (
    contains_sensitive,
    list_pattern_names,
    redact_text,
)


def test_redacts_aadhaar_number() -> None:
    text = "My Aadhaar is 1234 5678 9012 and the bank officer asked for it."
    out = redact_text(text)
    assert "1234 5678 9012" not in out
    assert "[REDACTED:AADHAAR]" in out


def test_redacts_pan_number() -> None:
    text = "PAN ABCDE1234F was shared in the screenshot."
    out = redact_text(text)
    assert "ABCDE1234F" not in out
    assert "[REDACTED:PAN]" in out


def test_redacts_card_number() -> None:
    text = "Card 4111 1111 1111 1111 was charged by the scammer."
    out = redact_text(text)
    assert "4111 1111 1111 1111" not in out
    assert "[REDACTED:CARD]" in out


def test_redacts_otp_password_pin() -> None:
    text = "OTP: 482910, password=hunter2, PIN 1234 were typed in by the victim."
    out = redact_text(text)
    assert "482910" not in out
    assert "hunter2" not in out
    assert "PIN 1234" not in out
    assert "1234" not in out or "[REDACTED" in out


def test_redact_does_not_change_safe_text() -> None:
    text = "I was tricked by someone claiming to be from the bank."
    assert redact_text(text) == text


def test_contains_sensitive_detects_aadhaar() -> None:
    assert contains_sensitive("Aadhaar 1234 5678 9012 issued in Delhi.")


def test_contains_sensitive_returns_false_for_clean_text() -> None:
    assert not contains_sensitive("My bank statement arrived today.")


def test_list_pattern_names_returns_all_keys() -> None:
    names = list_pattern_names()
    assert "aadhaar" in names
    assert "pan" in names
    assert "card" in names
    assert "otp" in names
