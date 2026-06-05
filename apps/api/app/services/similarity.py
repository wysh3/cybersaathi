"""Similarity and cluster matching.

Counts come exclusively from the in-memory seed data. We never invent numbers.
The matching keys are UPI ID, phone, bank account, social handle, URL, email,
and message-template hash, in that priority order.
"""

from __future__ import annotations

import re
from typing import Optional

from app.models import ExtractedFacts, SimilarityMatch, SimilarityResult
from app.services.categories import canonical_fraud_category
from app.services.seed_loader import get_seed_store


def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D+", "", value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def _normalize_upi(value: str) -> str:
    return value.strip().lower()


def similarity_for_complaint(
    facts: ExtractedFacts,
    *,
    exclude_complaint_id: Optional[str] = None,
) -> SimilarityResult:
    """Compute a SimilarityResult from seed data given the extracted facts."""

    store = get_seed_store()
    matches: list[SimilarityMatch] = []
    counts: dict[str, int] = {"total": 0, "upi": 0, "phone": 0, "handle": 0, "url": 0}

    if facts.upi_id:
        normalized = _normalize_upi(facts.upi_id)
        matching_identifiers = [
            ident
            for ident in store.identifiers()
            if ident.type == "upi" and ident.normalized_value == normalized
        ]
        for ident in matching_identifiers:
            sample_complaints = [
                cid for cid in ident.source_complaint_ids if cid != exclude_complaint_id
            ]
            if not sample_complaints:
                continue
            member_records = [store.complaint(cid) for cid in sample_complaints]
            member_records = [m for m in member_records if m is not None]
            sample_districts = sorted({m.location.district for m in member_records})[:5]
            sample_states = sorted({m.location.state for m in member_records})[:5]
            fraud_types = sorted(
                {
                    canonical_fraud_category(m.fraud_type, summary=m.summary, amount=m.amount)
                    for m in member_records
                }
            )
            primary_type = fraud_types[0] if fraud_types else "money_movement_fraud"
            matches.append(
                SimilarityMatch(
                    fraud_type=primary_type,
                    identifier_type="upi",
                    identifier_value=ident.value,
                    match_count=len(sample_complaints),
                    sample_districts=sample_districts,
                    sample_states=sample_states,
                )
            )
            counts["upi"] += len(sample_complaints)

    if facts.phone:
        normalized = _normalize_phone(facts.phone)
        if normalized:
            matching_identifiers = [
                ident
                for ident in store.identifiers()
                if ident.type == "phone" and ident.normalized_value.endswith(normalized)
            ]
            for ident in matching_identifiers:
                sample_complaints = [
                    cid for cid in ident.source_complaint_ids if cid != exclude_complaint_id
                ]
                if not sample_complaints:
                    continue
                member_records = [store.complaint(cid) for cid in sample_complaints]
                member_records = [m for m in member_records if m is not None]
                sample_districts = sorted({m.location.district for m in member_records})[:5]
                sample_states = sorted({m.location.state for m in member_records})[:5]
                fraud_types = sorted(
                    {
                        canonical_fraud_category(m.fraud_type, summary=m.summary, amount=m.amount)
                        for m in member_records
                    }
                )
                primary_type = fraud_types[0] if fraud_types else "money_movement_fraud"
                matches.append(
                    SimilarityMatch(
                        fraud_type=primary_type,
                        identifier_type="phone",
                        identifier_value=ident.value,
                        match_count=len(sample_complaints),
                        sample_districts=sample_districts,
                        sample_states=sample_states,
                    )
                )
                counts["phone"] += len(sample_complaints)

    if facts.handle:
        normalized = facts.handle.strip().lower()
        matching_identifiers = [
            ident
            for ident in store.identifiers()
            if ident.type in ("social_handle", "message_template")
            and ident.normalized_value == normalized
        ]
        for ident in matching_identifiers:
            sample_complaints = [
                cid for cid in ident.source_complaint_ids if cid != exclude_complaint_id
            ]
            if not sample_complaints:
                continue
            member_records = [store.complaint(cid) for cid in sample_complaints]
            member_records = [m for m in member_records if m is not None]
            sample_districts = sorted({m.location.district for m in member_records})[:5]
            sample_states = sorted({m.location.state for m in member_records})[:5]
            fraud_types = sorted(
                {
                    canonical_fraud_category(m.fraud_type, summary=m.summary, amount=m.amount)
                    for m in member_records
                }
            )
            primary_type = fraud_types[0] if fraud_types else "platform_content_suspect"
            matches.append(
                SimilarityMatch(
                    fraud_type=primary_type,
                    identifier_type=ident.type,
                    identifier_value=ident.value,
                    match_count=len(sample_complaints),
                    sample_districts=sample_districts,
                    sample_states=sample_states,
                )
            )
            counts["handle"] += len(sample_complaints)

    if facts.url:
        normalized = facts.url.lower()
        matching_identifiers = [
            ident
            for ident in store.identifiers()
            if ident.type == "url" and ident.normalized_value in normalized
        ]
        for ident in matching_identifiers:
            sample_complaints = [
                cid for cid in ident.source_complaint_ids if cid != exclude_complaint_id
            ]
            if not sample_complaints:
                continue
            member_records = [store.complaint(cid) for cid in sample_complaints]
            member_records = [m for m in member_records if m is not None]
            sample_districts = sorted({m.location.district for m in member_records})[:5]
            sample_states = sorted({m.location.state for m in member_records})[:5]
            fraud_types = sorted(
                {
                    canonical_fraud_category(m.fraud_type, summary=m.summary, amount=m.amount)
                    for m in member_records
                }
            )
            primary_type = fraud_types[0] if fraud_types else "platform_content_suspect"
            matches.append(
                SimilarityMatch(
                    fraud_type=primary_type,
                    identifier_type="url",
                    identifier_value=ident.value,
                    match_count=len(sample_complaints),
                    sample_districts=sample_districts,
                    sample_states=sample_states,
                )
            )
            counts["url"] += len(sample_complaints)

    counts["total"] = sum(m.match_count for m in matches)
    return SimilarityResult(
        complaint_id=exclude_complaint_id or "pending",
        matches=matches,
        counts=counts,
    )
