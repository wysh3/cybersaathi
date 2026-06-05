"""Bulk-load seed JSON data into PostgreSQL.

Usage:
    cd apps/api
    PYTHONPATH=apps/api:..:../../packages uv run python -m app.seed.seed_postgres

Requires a running PostgreSQL instance with the schema already created
(via ``alembic upgrade head`` or ``init_db()``).

Environment variables:
    DATABASE_URL   — Postgres connection string (default: postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi)
    SEED_DIR       — Path to seed data directory (default: ../../seed_data)
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    Base,
    ComplaintORM,
    ScamIdentifierORM,
    ComplaintIdentifierORM,
    EvidenceItemORM,
    ClusterORM,
    VictimSessionORM,
    GeneratedDocumentORM,
    MockIntegrationEventORM,
)
from app.services.database import get_engine, get_sessionmaker


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _parse_dt(value: str) -> datetime:
    """Parse ISO datetime string, handling Z suffix."""
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def _find_seed_dir() -> Path:
    """Find seed_data/ relative to this file."""
    # apps/api/app/seed/seed_postgres.py -> seed_data/
    env_dir = os.environ.get("SEED_DIR")
    if env_dir:
        return Path(env_dir)
    return Path(__file__).resolve().parents[4] / "seed_data"


def _read_json(path: Path) -> list[dict]:
    payload = json.loads(path.read_text())
    if isinstance(payload, list):
        return payload
    return []


async def load_sessions(seed_dir: Path, session: AsyncSession) -> dict[str, str]:
    """Load victim sessions from complaints.json (unique sessions)."""
    complaints_data = _read_json(seed_dir / "complaints.json")
    seen: dict[str, dict] = {}
    for item in complaints_data:
        sid = item.get("victim_session_id", f"seed-session-{item['id']}")
        if sid not in seen:
            seen[sid] = {
                "id": sid,
                "preferred_language": "en",
                "contact_channel": None,
                "current_step": item.get("pipeline", "post_golden_hour"),
                "consent_flags": {"redaction_ack": True},
                "created_at": _utcnow(),
                "updated_at": _utcnow(),
            }
    for sid, data in seen.items():
        existing = await session.get(VictimSessionORM, sid)
        if existing is None:
            session.add(VictimSessionORM(**data))
    await session.flush()
    return {sid: sid for sid in seen}


async def load_identifiers(
    seed_dir: Path, session: AsyncSession
) -> dict[str, str]:
    """Load scam identifiers (deduplicates in memory to handle seed data with duplicate IDs)."""
    data = _read_json(seed_dir / "identifiers.json")
    # Deduplicate by ID — the JSON file may have duplicates
    seen: dict[str, dict] = {}
    for item in data:
        iid = item["id"]
        if iid not in seen:
            seen[iid] = item
    id_map: dict[str, str] = {}
    for iid, item in seen.items():
        existing = await session.get(ScamIdentifierORM, iid)
        if existing is None:
            session.add(
                ScamIdentifierORM(
                    id=iid,
                    type=item["type"],
                    value=item["value"],
                    normalized_value=item["normalized_value"],
                    confidence=item.get("confidence", 0.0),
                    created_at=_parse_dt(item.get("created_at", _utcnow().isoformat())),
                )
            )
        id_map[iid] = iid
    await session.flush()
    return id_map


async def load_evidence(
    seed_dir: Path, session: AsyncSession
) -> dict[str, str]:
    """Load evidence items (complaints must be loaded first for FK)."""
    data = _read_json(seed_dir / "evidence.json")
    id_map: dict[str, str] = {}
    for item in data:
        eid = item["id"]
        existing = await session.get(EvidenceItemORM, eid)
        if existing is None:
            session.add(
                EvidenceItemORM(
                    id=eid,
                    complaint_id=item["complaint_id"],
                    kind=item.get("kind", "narrative"),
                    source=item.get("source", "seed"),
                    original_text=item.get("original_text", ""),
                    redacted_text=item.get("redacted_text", ""),
                    extracted_fields=item.get("extracted_fields", {}),
                    created_at=_parse_dt(item.get("created_at", _utcnow().isoformat())),
                )
            )
        id_map[eid] = eid
    await session.flush()
    return id_map


async def load_clusters(seed_dir: Path, session: AsyncSession) -> dict[str, str]:
    """Load clusters."""
    data = _read_json(seed_dir / "clusters.json")
    id_map: dict[str, str] = {}
    for item in data:
        cid = item["id"]
        existing = await session.get(ClusterORM, cid)
        if existing is None:
            session.add(
                ClusterORM(
                    id=cid,
                    status=item.get("status", "monitor"),
                    fraud_type=item["fraud_type"],
                    member_complaint_ids=item.get("member_complaint_ids", []),
                    common_identifier_ids=item.get("common_identifier_ids", []),
                    districts=item.get("districts", []),
                    states=item.get("states", []),
                    first_report_at=_parse_dt(item["first_report_at"]),
                    latest_report_at=_parse_dt(item["latest_report_at"]),
                    total_amount=item.get("total_amount", 0.0),
                    report_count=item.get("report_count", 0),
                    trigger_reason=item.get("trigger_reason"),
                    created_at=_parse_dt(item.get("created_at", _utcnow().isoformat())),
                )
            )
        id_map[cid] = cid
    await session.flush()
    return id_map


async def load_complaints(
    seed_dir: Path, session: AsyncSession
) -> int:
    """Load complaints and their identifier associations."""
    data = _read_json(seed_dir / "complaints.json")
    count = 0
    # First pass: add all complaints
    for item in data:
        cid = item["id"]
        existing = await session.get(ComplaintORM, cid)
        if existing is not None:
            continue
        loc = item.get("location", {})
        incident_at = item.get("incident_at")
        if incident_at:
            incident_at = _parse_dt(incident_at)
        else:
            incident_at = _utcnow()
        complaint = ComplaintORM(
            id=cid,
            victim_session_id=item.get("victim_session_id", f"seed-session-{cid}"),
            fraud_type=item["fraud_type"],
            payment_method=item.get("payment_method", "upi"),
            amount=item.get("amount", 0.0),
            amount_currency=item.get("amount_currency", "INR"),
            severity=item.get("severity", "medium"),
            urgency_score=item.get("urgency_score", 50),
            pipeline=item.get("pipeline", "post_golden_hour"),
            status=item.get("status", "evidence_under_review"),
            helpline_reference_number=item.get("helpline_reference_number"),
            cluster_id=item.get("cluster_id"),
            state=loc.get("state", "Delhi"),
            district=loc.get("district", "New Delhi"),
            pincode=loc.get("pincode"),
            lat=loc.get("lat"),
            lng=loc.get("lng"),
            created_at=_parse_dt(item.get("created_at", _utcnow().isoformat())),
            incident_at=incident_at,
            is_resolved=item.get("is_resolved", False),
            has_fir=item.get("has_fir", False),
            summary=item.get("summary", ""),
        )
        session.add(complaint)
        count += 1

    # Flush complaints so they exist before we add FK associations
    await session.flush()

    # Second pass: add identifier associations (complaints now exist in DB)
    for item in data:
        cid = item["id"]
        identifier_ids = item.get("identifier_ids", [])
        for iid in identifier_ids:
            existing_link = await session.get(
                ComplaintIdentifierORM, (cid, iid)
            )
            if existing_link is None:
                session.add(
                    ComplaintIdentifierORM(
                        complaint_id=cid, identifier_id=iid
                    )
                )

    await session.flush()
    return count


async def main() -> None:
    seed_dir = _find_seed_dir()
    print(f"Seed directory: {seed_dir}")
    print(f"File sizes:")
    for f in ["complaints.json", "identifiers.json", "evidence.json", "clusters.json", "meta.json"]:
        p = seed_dir / f
        if p.exists():
            print(f"  {f}: {p.stat().st_size:,} bytes")

    engine = get_engine()
    sm = get_sessionmaker()

    # Use a dedicated session with autoflush=False for bulk loading
    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(get_engine(), autoflush=False) as session:

        # Verify DB connection
        result = await session.execute(text("SELECT 1"))
        print(f"\nDB connection OK: {result.scalar()}")

        # Create schema if not exists
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Schema verified/created.")

        # Load data idempotently — order matters for FK constraints:
        # sessions → clusters → identifiers → complaints + associations → evidence
        print("\nLoading victim sessions...")
        sessions = await load_sessions(seed_dir, session)
        print(f"  {len(sessions)} sessions ready.")

        print("Loading clusters...")
        clusters = await load_clusters(seed_dir, session)
        print(f"  {len(clusters)} clusters loaded.")

        print("Loading identifiers...")
        identifiers = await load_identifiers(seed_dir, session)
        print(f"  {len(identifiers)} identifiers loaded.")

        print("Loading complaints...")
        complaint_count = await load_complaints(seed_dir, session)
        print(f"  {complaint_count} complaints loaded.")

        print("Loading evidence items...")
        evidence = await load_evidence(seed_dir, session)
        print(f"  {len(evidence)} evidence items loaded.")

        await session.commit()

        # Verify counts
        from sqlalchemy import func as safunc
        result = await session.execute(
            select(safunc.count()).select_from(ComplaintORM)
        )
        total = result.scalar() or 0
        print(f"\nTotal complaints in DB: {total}")
        assert total >= 500, (
            f"Expected at least 500 complaints, got {total}"
        )

    await engine.dispose()
    print("\nSeed loading complete.")


if __name__ == "__main__":
    asyncio.run(main())
