"""Deterministic seed data builder for CyberSaathi.

Generates 500+ anonymized complaint records, one accountability cluster with
>=50 unresolved reports in a 30-day window, and supporting identifiers. All
data is generated from a fixed seed so similarity counts and dashboard numbers
are reproducible.
"""

from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from shared.constants import (
    ACCOUNTABILITY_THRESHOLD,
    ACCOUNTABILITY_WINDOW_DAYS,
    FRAUD_TYPES,
    PAYMENT_METHODS,
    PUBLIC_AUTHORITIES,
    SEVERITY_LEVELS,
)

from app.models import (
    ClusterRecord,
    ComplaintRecord,
    EvidenceItem,
    GeoPoint,
    ScamIdentifier,
)
from app.services.categories import canonical_fraud_category

SEED_VERSION = "1.0.0"
RNG_SEED = 20240601

STATES_AND_DISTRICTS: list[tuple[str, str]] = [
    ("Maharashtra", "Mumbai"),
    ("Maharashtra", "Pune"),
    ("Maharashtra", "Nagpur"),
    ("Maharashtra", "Nashik"),
    ("Maharashtra", "Thane"),
    ("Karnataka", "Bengaluru Urban"),
    ("Karnataka", "Mysuru"),
    ("Karnataka", "Mangaluru"),
    ("Karnataka", "Hubballi"),
    ("Delhi", "Central Delhi"),
    ("Delhi", "South Delhi"),
    ("Delhi", "New Delhi"),
    ("Delhi", "West Delhi"),
    ("Delhi", "East Delhi"),
    ("Uttar Pradesh", "Lucknow"),
    ("Uttar Pradesh", "Kanpur"),
    ("Uttar Pradesh", "Varanasi"),
    ("Uttar Pradesh", "Noida"),
    ("Uttar Pradesh", "Agra"),
    ("Tamil Nadu", "Chennai"),
    ("Tamil Nadu", "Coimbatore"),
    ("Tamil Nadu", "Madurai"),
    ("Tamil Nadu", "Salem"),
    ("Telangana", "Hyderabad"),
    ("Telangana", "Warangal"),
    ("Gujarat", "Ahmedabad"),
    ("Gujarat", "Surat"),
    ("Gujarat", "Vadodara"),
    ("West Bengal", "Kolkata"),
    ("West Bengal", "Howrah"),
    ("Rajasthan", "Jaipur"),
    ("Rajasthan", "Jodhpur"),
    ("Rajasthan", "Udaipur"),
    ("Kerala", "Thiruvananthapuram"),
    ("Kerala", "Kochi"),
    ("Kerala", "Kozhikode"),
    ("Madhya Pradesh", "Bhopal"),
    ("Madhya Pradesh", "Indore"),
    ("Bihar", "Patna"),
    ("Bihar", "Gaya"),
    ("Punjab", "Ludhiana"),
    ("Punjab", "Amritsar"),
    ("Haryana", "Gurugram"),
    ("Haryana", "Faridabad"),
    ("Odisha", "Bhubaneswar"),
    ("Assam", "Guwahati"),
    ("Chhattisgarh", "Raipur"),
    ("Jharkhand", "Ranchi"),
    ("Andhra Pradesh", "Visakhapatnam"),
    ("Andhra Pradesh", "Vijayawada"),
]

SAMPLE_UPI_HANDLES = [
    "scammer.fraud",
    "urgentfees",
    "warden.hostel",
    "rental.assist",
    "job.consult",
    "kyc.update",
    "refund.process",
    "lottery.win",
    "delivery.fine",
    "support.bank",
    "kuber.fund",
    "fast.loan",
    "verify.id",
    "reward.claim",
]

SAMPLE_PHONE_PREFIXES = ["+91-98", "+91-99", "+91-97", "+91-96", "+91-95", "+91-90"]
SAMPLE_BANKS = [
    "State Bank of India",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Punjab National Bank",
    "Bank of Baroda",
    "Canara Bank",
    "Kotak Mahindra Bank",
    "Yes Bank",
    "IDFC First Bank",
]
SAMPLE_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM", "Amazon Pay", "WhatsApp Pay"]


def _hash_id(*parts: str) -> str:
    """Return a stable short id derived from the inputs."""

    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:12]


def _now() -> datetime:
    return datetime(2026, 6, 4, 12, 0, 0, tzinfo=timezone.utc)


def _build_accountability_cluster(
    rng: random.Random,
    session_id_seq: list[int],
) -> tuple[list[ComplaintRecord], list[ScamIdentifier], ClusterRecord, list[EvidenceItem]]:
    """The flagged cluster: same UPI handle, same script, last 30 days, unresolved.

    Returns complaints, identifiers, the cluster record, and evidence items.
    """

    today = _now()
    window_start = today - timedelta(days=ACCOUNTABILITY_WINDOW_DAYS - 1)
    shared_upi = "scammer.fraud@upi"
    shared_phone = "+91-98765-43210"
    shared_handle = "@kyc_official_help"
    shared_script = (
        "Dear customer, your KYC is pending. Update immediately to avoid account "
        "block. Click the link or call our executive."
    )
    states_in_cluster = [
        ("Delhi", "South Delhi"),
        ("Delhi", "Central Delhi"),
        ("Delhi", "New Delhi"),
        ("Delhi", "East Delhi"),
        ("Delhi", "West Delhi"),
        ("Haryana", "Gurugram"),
        ("Haryana", "Faridabad"),
        ("Uttar Pradesh", "Noida"),
        ("Uttar Pradesh", "Lucknow"),
        ("Maharashtra", "Mumbai"),
    ]

    complaints: list[ComplaintRecord] = []
    evidence_items: list[EvidenceItem] = []
    upi_id = ScamIdentifier(
        id=_hash_id("upi", shared_upi),
        type="upi",
        value=shared_upi,
        normalized_value=shared_upi.lower(),
        confidence=0.95,
        source_complaint_ids=[],
    )
    phone_id = ScamIdentifier(
        id=_hash_id("phone", shared_phone),
        type="phone",
        value=shared_phone,
        normalized_value=shared_phone.replace(" ", ""),
        confidence=0.9,
        source_complaint_ids=[],
    )
    handle_id = ScamIdentifier(
        id=_hash_id("handle", shared_handle),
        type="social_handle",
        value=shared_handle,
        normalized_value=shared_handle.lower(),
        confidence=0.85,
        source_complaint_ids=[],
    )
    script_id = ScamIdentifier(
        id=_hash_id("script", shared_script),
        type="message_template",
        value=shared_script,
        normalized_value=shared_script.lower(),
        confidence=0.95,
        source_complaint_ids=[],
    )

    member_count = ACCOUNTABILITY_THRESHOLD + 6  # 56 reports
    for i in range(member_count):
        session_id = f"seed-session-{session_id_seq[0]:05d}"
        session_id_seq[0] += 1
        state, district = states_in_cluster[i % len(states_in_cluster)]
        days_ago = rng.randint(0, ACCOUNTABILITY_WINDOW_DAYS - 1)
        hours_ago = rng.randint(0, 23)
        minutes_ago = rng.randint(0, 59)
        incident_at = today - timedelta(
            days=days_ago, hours=hours_ago, minutes=minutes_ago
        )
        created_at = incident_at + timedelta(hours=rng.randint(1, 6))
        amount = round(rng.uniform(1500.0, 75000.0), 2)
        cid = f"c-seed-cl1-{i:03d}"
        evidence_id = f"e-seed-cl1-{i:03d}"
        identifier_ids = [upi_id.id, phone_id.id, handle_id.id, script_id.id]
        for ident in (upi_id, phone_id, handle_id, script_id):
            ident.source_complaint_ids.append(cid)
        narrative = (
            f"Received a message claiming KYC was pending and was asked to pay a "
            f"fee of Rs {int(amount):,} via UPI to {shared_upi}. The sender "
            f"called from {shared_phone} and referenced handle {shared_handle}."
        )
        complaints.append(
            ComplaintRecord(
                id=cid,
                fraud_type="money_movement_fraud",
                payment_method="upi",
                amount=amount,
                amount_currency="INR",
                severity="high",
                urgency_score=rng.randint(72, 95),
                pipeline="post_golden_hour",
                status="evidence_under_review",
                location=GeoPoint(state=state, district=district, pincode="110001"),
                created_at=created_at,
                incident_at=incident_at,
                is_resolved=False,
                has_fir=False,
                victim_session_id=session_id,
                summary=narrative,
                identifier_ids=identifier_ids,
                evidence_item_ids=[evidence_id],
                helpline_reference_number=None,
                cluster_id="cl-001-accountability",
            )
        )
        evidence_items.append(
            EvidenceItem(
                id=evidence_id,
                complaint_id=cid,
                kind="sms",
                source="seed",
                original_text=(
                    f"From: {shared_phone} - {shared_script} "
                    f"Send Rs {int(amount):,} to {shared_upi} to keep your account active."
                ),
                redacted_text=(
                    f"From: +91-XXXXX-XXXXX - {shared_script} "
                    f"Send Rs X,XXX to scammer@upi to keep your account active."
                ),
                extracted_fields={
                    "upi_id": shared_upi,
                    "phone": shared_phone,
                    "amount": str(int(amount)),
                },
                created_at=created_at,
            )
        )

    cluster = ClusterRecord(
        id="cl-001-accountability",
        status="escalated",
        fraud_type="money_movement_fraud",
        member_complaint_ids=[c.id for c in complaints],
        common_identifier_ids=[upi_id.id, phone_id.id, handle_id.id, script_id.id],
        districts=sorted({c.location.district for c in complaints}),
        states=sorted({c.location.state for c in complaints}),
        first_report_at=min(c.created_at for c in complaints),
        latest_report_at=max(c.created_at for c in complaints),
        total_amount=sum(c.amount for c in complaints),
        report_count=len(complaints),
        trigger_reason=(
            f"{len(complaints)} unresolved reports share the same UPI handle, "
            "phone, social handle, and message script within a 30-day window."
        ),
    )
    return complaints, [upi_id, phone_id, handle_id, script_id], cluster, evidence_items


def _build_other_complaints(
    rng: random.Random,
    session_id_seq: list[int],
    count: int,
) -> tuple[list[ComplaintRecord], list[ScamIdentifier], list[EvidenceItem], list[ClusterRecord]]:
    complaints: list[ComplaintRecord] = []
    evidence: list[EvidenceItem] = []
    identifiers: list[ScamIdentifier] = []
    clusters: list[ClusterRecord] = []

    fraud_distribution = {
        "upi_fraud": 0.30,
        "banking_fraud": 0.12,
        "wallet_fraud": 0.06,
        "online_payment_fraud": 0.10,
        "sextortion": 0.07,
        "job_scam": 0.10,
        "account_hack": 0.10,
        "harassment": 0.05,
        "phishing": 0.07,
        "other": 0.03,
    }
    payment_for_fraud = {
        "upi_fraud": "upi",
        "banking_fraud": "netbanking",
        "wallet_fraud": "wallet",
        "online_payment_fraud": "card",
        "sextortion": "upi",
        "job_scam": "upi",
        "account_hack": "none",
        "harassment": "none",
        "phishing": "upi",
        "other": "upi",
    }
    severity_for_fraud = {
        "upi_fraud": "high",
        "banking_fraud": "high",
        "wallet_fraud": "medium",
        "online_payment_fraud": "high",
        "sextortion": "critical",
        "job_scam": "medium",
        "account_hack": "high",
        "harassment": "medium",
        "phishing": "medium",
        "other": "low",
    }

    for i in range(count):
        incident_type = rng.choices(
            list(fraud_distribution.keys()),
            weights=list(fraud_distribution.values()),
            k=1,
        )[0]
        payment_method = payment_for_fraud[incident_type]
        amount = 0.0 if payment_method == "none" else round(rng.uniform(500.0, 120000.0), 2)
        severity = severity_for_fraud[incident_type]
        state, district = rng.choice(STATES_AND_DISTRICTS)
        days_ago = rng.randint(0, 365)
        incident_at = _now() - timedelta(
            days=days_ago,
            hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59),
        )
        created_at = incident_at + timedelta(hours=rng.randint(0, 72))
        session_id = f"seed-session-{session_id_seq[0]:05d}"
        session_id_seq[0] += 1
        cid = f"c-seed-{i:04d}"
        upi_handle = rng.choice(SAMPLE_UPI_HANDLES) + f"{rng.randint(10, 99)}"
        upi_id = ScamIdentifier(
            id=_hash_id("upi", upi_handle),
            type="upi",
            value=f"{upi_handle}@upi",
            normalized_value=f"{upi_handle}@upi".lower(),
            confidence=round(rng.uniform(0.7, 0.95), 2),
            source_complaint_ids=[cid],
        )
        phone = f"{rng.choice(SAMPLE_PHONE_PREFIXES)}{rng.randint(100000, 999999)}"
        phone_ident = ScamIdentifier(
            id=_hash_id("phone", phone),
            type="phone",
            value=phone,
            normalized_value=phone.replace(" ", ""),
            confidence=round(rng.uniform(0.6, 0.9), 2),
            source_complaint_ids=[cid],
        )
        identifiers.extend([upi_id, phone_ident])
        narrative = _narrative_for(incident_type, upi_handle, phone, amount)
        fraud_type = canonical_fraud_category(
            incident_type,
            summary=narrative,
            amount=amount,
        )
        complaint = ComplaintRecord(
            id=cid,
            fraud_type=fraud_type,
            payment_method=payment_method,
            amount=amount,
            amount_currency="INR",
            severity=severity,
            urgency_score=rng.randint(30, 90),
            pipeline="post_golden_hour" if days_ago > 0 else "golden_hour",
            status=rng.choice(
                [
                    "intake_in_progress",
                    "evidence_under_review",
                    "documents_generated",
                    "submitted",
                ]
            ),
            location=GeoPoint(state=state, district=district),
            created_at=created_at,
            incident_at=incident_at,
            is_resolved=rng.random() < 0.12,
            has_fir=rng.random() < 0.18,
            victim_session_id=session_id,
            summary=narrative,
            identifier_ids=[upi_id.id, phone_ident.id],
            evidence_item_ids=[f"e-seed-{i:04d}"],
            helpline_reference_number=None,
            cluster_id=None,
        )
        complaints.append(complaint)
        evidence.append(
            EvidenceItem(
                id=f"e-seed-{i:04d}",
                complaint_id=cid,
                kind=rng.choice(["sms", "screenshot", "narrative"]),
                source="seed",
                original_text=narrative,
                redacted_text=_redact_for_seed(narrative),
                extracted_fields={
                    "upi_id": f"{upi_handle}@upi",
                    "phone": phone,
                    "amount": str(int(amount)) if amount else "",
                },
                created_at=created_at,
            )
        )

    # Build a small secondary cluster for the dashboard contrast: 12 reports
    # of job scam in Bengaluru and Hyderabad.
    secondary_cluster_id = "cl-002-jobserver"
    secondary_states = [("Karnataka", "Bengaluru Urban"), ("Telangana", "Hyderabad")]
    secondary_complaints: list[ComplaintRecord] = []
    for i in range(12):
        session_id = f"seed-session-{session_id_seq[0]:05d}"
        session_id_seq[0] += 1
        state, district = secondary_states[i % 2]
        days_ago = rng.randint(0, 25)
        incident_at = _now() - timedelta(days=days_ago, hours=rng.randint(0, 23))
        amount = round(rng.uniform(2000.0, 9500.0), 2)
        cid = f"c-seed-jb-{i:03d}"
        shared_handle = "hr.talent.partner"
        shared_upi = "job.fees@upi"
        upi_ident = ScamIdentifier(
            id=_hash_id("upi-secondary", shared_upi),
            type="upi",
            value=shared_upi,
            normalized_value=shared_upi.lower(),
            confidence=0.92,
            source_complaint_ids=[cid],
        )
        handle_ident = ScamIdentifier(
            id=_hash_id("handle-secondary", shared_handle),
            type="social_handle",
            value=shared_handle,
            normalized_value=shared_handle.lower(),
            confidence=0.88,
            source_complaint_ids=[cid],
        )
        identifiers.extend([upi_ident, handle_ident])
        complaints.append(
            ComplaintRecord(
                id=cid,
                fraud_type="money_movement_fraud",
                payment_method="upi",
                amount=amount,
                amount_currency="INR",
                severity="medium",
                urgency_score=rng.randint(40, 70),
                pipeline="post_golden_hour",
                status="documents_generated",
                location=GeoPoint(state=state, district=district),
                created_at=incident_at + timedelta(hours=2),
                incident_at=incident_at,
                is_resolved=False,
                has_fir=False,
                victim_session_id=session_id,
                summary=(
                    f"Offered a data-entry job, asked to pay a Rs {int(amount):,} "
                    f"registration fee via {shared_upi}. Interviewer used handle {shared_handle}."
                ),
                identifier_ids=[upi_ident.id, handle_ident.id],
                evidence_item_ids=[f"e-seed-jb-{i:03d}"],
                helpline_reference_number=None,
                cluster_id=secondary_cluster_id,
            )
        )
        evidence.append(
            EvidenceItem(
                id=f"e-seed-jb-{i:03d}",
                complaint_id=cid,
                kind="screenshot",
                source="seed",
                original_text=f"Job offer letter, {shared_handle} asked for fee {int(amount)} via {shared_upi}",
                redacted_text=f"Job offer letter, @{shared_handle} asked for fee X,XXX via scammer@upi",
                extracted_fields={"upi_id": shared_upi, "handle": shared_handle, "amount": str(int(amount))},
                created_at=incident_at,
            )
        )
        secondary_complaints.append(complaints[-1])

    clusters.append(
        ClusterRecord(
            id=secondary_cluster_id,
            status="monitor",
            fraud_type="money_movement_fraud",
            member_complaint_ids=[c.id for c in secondary_complaints],
            common_identifier_ids=[
                _hash_id("upi-secondary", "job.fees@upi"),
                _hash_id("handle-secondary", "hr.talent.partner"),
            ],
            districts=sorted({c.location.district for c in secondary_complaints}),
            states=sorted({c.location.state for c in secondary_complaints}),
            first_report_at=min(c.created_at for c in secondary_complaints),
            latest_report_at=max(c.created_at for c in secondary_complaints),
            total_amount=sum(c.amount for c in secondary_complaints),
            report_count=len(secondary_complaints),
            trigger_reason=None,
        )
    )

    # Tertiary cluster: 8 phishing reports around a refund scam.
    phishing_cluster_id = "cl-003-refund-phish"
    phishing_states = [("Maharashtra", "Mumbai"), ("Maharashtra", "Pune"), ("Gujarat", "Surat")]
    phishing_complaints: list[ComplaintRecord] = []
    for i in range(8):
        session_id = f"seed-session-{session_id_seq[0]:05d}"
        session_id_seq[0] += 1
        state, district = phishing_states[i % len(phishing_states)]
        days_ago = rng.randint(2, 40)
        incident_at = _now() - timedelta(days=days_ago, hours=rng.randint(0, 23))
        amount = round(rng.uniform(900.0, 8500.0), 2)
        cid = f"c-seed-ph-{i:03d}"
        url = "refund-claim.in"
        url_ident = ScamIdentifier(
            id=_hash_id("url-secondary", url),
            type="url",
            value=url,
            normalized_value=url.lower(),
            confidence=0.85,
            source_complaint_ids=[cid],
        )
        identifiers.append(url_ident)
        complaints.append(
            ComplaintRecord(
                id=cid,
                fraud_type="money_movement_fraud",
                payment_method="card",
                amount=amount,
                amount_currency="INR",
                severity="medium",
                urgency_score=rng.randint(40, 65),
                pipeline="post_golden_hour",
                status="submitted",
                location=GeoPoint(state=state, district=district),
                created_at=incident_at + timedelta(hours=4),
                incident_at=incident_at,
                is_resolved=False,
                has_fir=False,
                victim_session_id=session_id,
                summary=(
                    f"Clicked a refund link {url} after a fake customer care call. "
                    f"Lost Rs {int(amount):,} via card payment."
                ),
                identifier_ids=[url_ident.id],
                evidence_item_ids=[f"e-seed-ph-{i:03d}"],
                helpline_reference_number=None,
                cluster_id=phishing_cluster_id,
            )
        )
        evidence.append(
            EvidenceItem(
                id=f"e-seed-ph-{i:03d}",
                complaint_id=cid,
                kind="screenshot",
                source="seed",
                original_text=f"Phishing site {url}, lost Rs {int(amount)} via card",
                redacted_text=f"Phishing site scammer-site.in, lost Rs X,XXX via card",
                extracted_fields={"url": url, "amount": str(int(amount))},
                created_at=incident_at,
            )
        )
        phishing_complaints.append(complaints[-1])

    clusters.append(
        ClusterRecord(
            id=phishing_cluster_id,
            status="monitor",
            fraud_type="money_movement_fraud",
            member_complaint_ids=[c.id for c in phishing_complaints],
            common_identifier_ids=[_hash_id("url-secondary", "refund-claim.in")],
            districts=sorted({c.location.district for c in phishing_complaints}),
            states=sorted({c.location.state for c in phishing_complaints}),
            first_report_at=min(c.created_at for c in phishing_complaints),
            latest_report_at=max(c.created_at for c in phishing_complaints),
            total_amount=sum(c.amount for c in phishing_complaints),
            report_count=len(phishing_complaints),
            trigger_reason=None,
        )
    )

    return complaints, identifiers, evidence, clusters


def _narrative_for(fraud_type: str, upi: str, phone: str, amount: float) -> str:
    base = {
        "upi_fraud": (
            f"Was convinced to send Rs {int(amount):,} to {upi}@upi after a "
            f"video call. The caller {phone} claimed the payment was for a refund."
        ),
        "banking_fraud": (
            f"Saw an unauthorised transaction of Rs {int(amount):,} in my savings "
            f"account. The fraudster used my netbanking credentials."
        ),
        "wallet_fraud": (
            f"My wallet was drained of Rs {int(amount):,} after I scanned a QR "
            f"code at a small shop."
        ),
        "online_payment_fraud": (
            f"Paid Rs {int(amount):,} for a product on a marketplace and never "
            f"received delivery. The seller stopped responding."
        ),
        "sextortion": (
            f"Was threatened with a private video and asked to pay via UPI to "
            f"keep it private. The caller used {phone}."
        ),
        "job_scam": (
            f"Was offered a part-time job and asked to pay Rs {int(amount):,} "
            f"as a registration fee via {upi}@upi."
        ),
        "account_hack": (
            f"My social media account was hacked. I'm not sure if money was "
            f"stolen but my friends received scam messages."
        ),
        "harassment": (
            f"Receiving repeated threatening messages from {phone} after I "
            f"blocked them on chat."
        ),
        "phishing": (
            f"Clicked a link from an SMS about a refund. Lost Rs {int(amount):,} "
            f"through my card."
        ),
        "other": (
            f"Lost Rs {int(amount):,} in a transaction I cannot clearly classify."
        ),
    }
    return base.get(fraud_type, base["other"])


def _redact_for_seed(text: str) -> str:
    """A conservative redaction pass for narrative text in seed data."""

    import re

    redacted = text
    redacted = re.sub(r"\b[6-9]\d{9}\b", "X-XXXXX-XXXXX", redacted)
    redacted = re.sub(r"Rs\s?\d[\d,]*", "Rs X,XXX", redacted)
    redacted = re.sub(r"[\w.-]+@upi", "scammer@upi", redacted)
    return redacted


def build_seed_data() -> dict[str, Any]:
    rng = random.Random(RNG_SEED)
    session_id_seq = [0]
    cluster_complaints, cluster_idents, cluster_record, cluster_evidence = (
        _build_accountability_cluster(rng, session_id_seq)
    )
    other_complaints, other_idents, other_evidence, other_clusters = (
        _build_other_complaints(rng, session_id_seq, count=480)
    )
    complaints = cluster_complaints + other_complaints
    evidence_items = cluster_evidence + other_evidence
    identifiers = cluster_idents + other_idents
    clusters = [cluster_record] + other_clusters
    return {
        "version": SEED_VERSION,
        "generated_at": _now().isoformat(),
        "rng_seed": RNG_SEED,
        "complaints": [c.model_dump(mode="json") for c in complaints],
        "identifiers": [i.model_dump(mode="json") for i in identifiers],
        "evidence": [e.model_dump(mode="json") for e in evidence_items],
        "clusters": [c.model_dump(mode="json") for c in clusters],
    }


def write_seed_files(target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    data = build_seed_data()
    for key in ("complaints", "identifiers", "evidence", "clusters"):
        path = target_dir / f"{key}.json"
        path.write_text(json.dumps(data[key], indent=2, ensure_ascii=False))
    meta_path = target_dir / "meta.json"
    meta = {
        "version": data["version"],
        "generated_at": data["generated_at"],
        "rng_seed": data["rng_seed"],
        "counts": {k: len(data[k]) for k in ("complaints", "identifiers", "evidence", "clusters")},
    }
    meta_path.write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    # apps/api/app/seed/__init__.py -> apps/api/app/seed -> apps/api/app ->
    # apps/api -> apps -> <monorepo root>
    target = Path(__file__).resolve().parents[4] / "seed_data"
    write_seed_files(target)
    print(f"Wrote seed data to {target}")
