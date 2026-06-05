"""Seed data store — in-memory (SeedStore) or PostgreSQL (DatabaseStore).

Loads JSON files from ``apps/api/seed_data`` and exposes typed accessors.
Set ``DATABASE_ENABLED=true`` in the environment to use the PostgreSQL-backed
``DatabaseStore`` instead of the default in-memory ``SeedStore``.

All services call ``get_seed_store()`` and receive either implementation
seamlessly.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from app.models import (
    ClusterRecord,
    ComplaintRecord,
    EvidenceItem,
    ScamIdentifier,
    PostReportResponse,
    PostReportStepState,
)


DEFAULT_SEED_DIR = (
    # apps/api/app/services/seed_loader.py -> apps/api/app/services ->
    # apps/api/app -> apps/api -> apps -> <monorepo root>
    Path(__file__).resolve().parents[4] / "seed_data"
)


# Import DatabaseStore conditionally to avoid circular imports at module level.
# The toggle is evaluated each time get_seed_store() is called (cached after first).


class SeedStore:
    def __init__(self, seed_dir: Path | None = None) -> None:
        self.seed_dir = seed_dir or DEFAULT_SEED_DIR
        self._complaints: dict[str, ComplaintRecord] = {}
        self._identifiers: dict[str, ScamIdentifier] = {}
        self._evidence: dict[str, EvidenceItem] = {}
        self._clusters: dict[str, ClusterRecord] = {}
        self._post_report_responses: dict[str, PostReportResponse] = {}
        self._post_report_steps: dict[str, PostReportStepState] = {}
        self._meta: dict = {}
        self._load()

    def _load(self) -> None:
        meta_path = self.seed_dir / "meta.json"
        if not meta_path.exists():
            from app.seed import write_seed_files

            write_seed_files(self.seed_dir)
        self._meta = json.loads(meta_path.read_text())
        self._complaints = {
            item["id"]: ComplaintRecord.model_validate(item)
            for item in _read_jsonl(self.seed_dir / "complaints.json")
        }
        self._identifiers = {
            item["id"]: ScamIdentifier.model_validate(item)
            for item in _read_jsonl(self.seed_dir / "identifiers.json")
        }
        self._evidence = {
            item["id"]: EvidenceItem.model_validate(item)
            for item in _read_jsonl(self.seed_dir / "evidence.json")
        }
        self._clusters = {
            item["id"]: ClusterRecord.model_validate(item)
            for item in _read_jsonl(self.seed_dir / "clusters.json")
        }

    @property
    def meta(self) -> dict:
        return self._meta

    def complaints(self) -> list[ComplaintRecord]:
        return list(self._complaints.values())

    def complaint(self, cid: str) -> ComplaintRecord | None:
        return self._complaints.get(cid)

    def identifiers(self) -> list[ScamIdentifier]:
        return list(self._identifiers.values())

    def identifier(self, iid: str) -> ScamIdentifier | None:
        return self._identifiers.get(iid)

    def evidence(self) -> list[EvidenceItem]:
        return list(self._evidence.values())

    def evidence_for_complaint(self, cid: str) -> list[EvidenceItem]:
        return [e for e in self._evidence.values() if e.complaint_id == cid]

    def clusters(self) -> list[ClusterRecord]:
        return list(self._clusters.values())

    def cluster(self, clid: str) -> ClusterRecord | None:
        return self._clusters.get(clid)

    def add_complaint(self, complaint: ComplaintRecord) -> None:
        self._complaints[complaint.id] = complaint

    def add_identifier(self, identifier: ScamIdentifier) -> None:
        self._identifiers[identifier.id] = identifier

    def add_evidence(self, evidence: EvidenceItem) -> None:
        self._evidence[evidence.id] = evidence

    def add_cluster(self, cluster: ClusterRecord) -> None:
        self._clusters[cluster.id] = cluster

    def get_post_report_response(self, cid: str) -> PostReportResponse | None:
        return self._post_report_responses.get(cid)

    def add_post_report_response(self, response: PostReportResponse) -> None:
        self._post_report_responses[response.complaint_id] = response

    def get_post_report_steps(self, cid: str) -> list[PostReportStepState]:
        return [s for s in self._post_report_steps.values() if s.complaint_id == cid]

    def add_post_report_step(self, step: PostReportStepState) -> None:
        self._post_report_steps[f"{step.complaint_id}|{step.workflow_id}|{step.step_key}"] = step


def _read_jsonl(path: Path) -> Iterable[dict]:
    payload = json.loads(path.read_text())
    if isinstance(payload, list):
        return payload
    return []


_store: SeedStore | None = None


def get_seed_store():
    """Return the active store — SeedStore (in-memory) or DatabaseStore (Postgres).

    The decision is made once on first call and cached. Set
    ``DATABASE_ENABLED=true`` in the environment to enable PostgreSQL.
    """
    global _store
    if _store is not None:
        return _store
    from app.services.db_store import is_database_enabled, DatabaseStore

    if is_database_enabled():
        _store = DatabaseStore()
    else:
        _store = SeedStore()
    return _store


def reset_seed_store() -> None:
    """Used by tests to rebuild the store from the seed directory."""

    global _store
    _store = None


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)
