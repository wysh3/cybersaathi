"""DatabaseStore — drop-in PostgreSQL replacement for SeedStore, sync edition.

Mirrors every public method on ``SeedStore`` so that existing services
continue to work after swapping:

    from app.services.seed_loader import get_seed_store  # unchanged
    store = get_seed_store()  # returns DatabaseStore when DATABASE_ENABLED=true

Uses synchronous SQLAlchemy (psycopg driver) because all existing routers
and services are synchronous. The async engine (asyncpg) is available in
``database.py`` for future async routers.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ClusterRecord,
    ComplaintRecord,
    EvidenceItem,
    GeneratedDocument,
    GeoPoint,
    MockIntegrationEvent,
    ScamIdentifier,
    PostReportResponse,
    PostReportStepState,
)
from app.models.db import (
    ClusterORM,
    ComplaintIdentifierORM,
    ComplaintORM,
    EvidenceItemORM,
    GeneratedDocumentORM,
    MockIntegrationEventORM,
    ScamIdentifierORM,
    VictimSessionORM,
    PostReportResponseORM,
    PostReportStepStateORM,
)
from app.services.database import get_sync_sessionmaker


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _complaint_to_record(c: ComplaintORM) -> ComplaintRecord:
    """Convert an ORM ComplaintORM back to a Pydantic ComplaintRecord."""
    geo = GeoPoint(
        state=c.state,
        district=c.district,
        pincode=c.pincode,
        lat=c.lat,
        lng=c.lng,
    )
    identifier_ids = [i.id for i in c.identifiers] if c.identifiers else []
    return ComplaintRecord(
        id=c.id,
        victim_session_id=c.victim_session_id,
        fraud_type=c.fraud_type,
        payment_method=c.payment_method,
        amount=c.amount,
        amount_currency=c.amount_currency or "INR",
        severity=c.severity,  # type: ignore[arg-type]
        urgency_score=c.urgency_score,
        pipeline=c.pipeline,  # type: ignore[arg-type]
        status=c.status,
        location=geo,
        created_at=c.created_at,
        incident_at=c.incident_at,
        is_resolved=c.is_resolved,
        has_fir=c.has_fir,
        summary=c.summary,
        identifier_ids=identifier_ids,
        evidence_item_ids=[],
        helpline_reference_number=c.helpline_reference_number,
        cluster_id=c.cluster_id,
    )


def _document_to_record(document: GeneratedDocumentORM) -> GeneratedDocument:
    return GeneratedDocument(
        id=document.id,
        complaint_id=document.complaint_id,
        kind=document.kind,
        title=document.title,
        editable_body=document.editable_body,
        created_at=document.created_at,
        export_status=document.export_status,
    )


def _event_to_record(event: MockIntegrationEventORM) -> MockIntegrationEvent:
    return MockIntegrationEvent(
        id=event.id,
        adapter=event.adapter,
        operation=event.operation,
        request_summary=event.request_summary,
        response_summary=event.response_summary,
        status=event.status,  # type: ignore[arg-type]
        created_at=event.created_at,
    )


def _response_to_record(res: PostReportResponseORM) -> PostReportResponse:
    from app.models import PostReportCard, PostReportItem, OfficialPath, FollowUpScheduleItem
    return PostReportResponse(
        id=res.id,
        complaint_id=res.complaint_id,
        primary_workflow=res.primary_workflow,
        secondary_workflows=res.secondary_workflows,
        risk_level=res.risk_level,  # type: ignore
        headline=res.headline,
        cards=[PostReportCard.model_validate(c) for c in res.cards],
        do_not_do=res.do_not_do,
        evidence_to_preserve=res.evidence_to_preserve,
        official_paths=[OfficialPath.model_validate(p) for p in res.official_paths],
        generated_document_kinds=res.generated_document_kinds,
        follow_up_schedule=[FollowUpScheduleItem.model_validate(s) for s in res.follow_up_schedule],
        disclaimer=res.disclaimer,
        created_at=res.created_at,
        updated_at=res.updated_at,
    )


def _step_to_record(step: PostReportStepStateORM) -> PostReportStepState:
    return PostReportStepState(
        id=step.id,
        complaint_id=step.complaint_id,
        workflow_id=step.workflow_id,
        step_key=step.step_key,
        status=step.status,  # type: ignore
        completed_at=step.completed_at,
        notes=step.notes,
    )


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return _utcnow()


class DatabaseStore:
    """Synchronous PostgreSQL store that mirrors SeedStore's interface.

    Set ``DATABASE_ENABLED=true`` in the environment to use this store
    instead of the in-memory SeedStore.
    """

    def __init__(self) -> None:
        self._sm = get_sync_sessionmaker()

    def _session(self) -> Session:
        return self._sm()

    # --- Complaints ---

    def complaints(self) -> list[ComplaintRecord]:
        with self._session() as session:
            stmt = select(ComplaintORM).options(
                selectinload(ComplaintORM.identifiers)
            )
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [_complaint_to_record(o) for o in orms]

    def complaint(self, cid: str) -> ComplaintRecord | None:
        with self._session() as session:
            stmt = (
                select(ComplaintORM)
                .options(selectinload(ComplaintORM.identifiers))
                .where(ComplaintORM.id == cid)
            )
            result = session.execute(stmt)
            orm = result.scalar_one_or_none()
            return _complaint_to_record(orm) if orm else None

    def add_complaint(self, complaint: ComplaintRecord) -> None:
        with self._session() as session:
            # Auto-create missing victim session (handles in-memory sessions from intake.py)
            vs = session.get(VictimSessionORM, complaint.victim_session_id)
            if vs is None:
                session.add(
                    VictimSessionORM(
                        id=complaint.victim_session_id,
                        preferred_language="en",
                        current_step=complaint.pipeline,
                        consent_flags={"redaction_ack": True},
                        created_at=_utcnow(),
                        updated_at=_utcnow(),
                    )
                )
            geo = complaint.location
            existing_orm = session.get(ComplaintORM, complaint.id)
            if existing_orm is None:
                orm = ComplaintORM(
                    id=complaint.id,
                    victim_session_id=complaint.victim_session_id,
                    fraud_type=complaint.fraud_type,
                    payment_method=complaint.payment_method,
                    amount=complaint.amount,
                    amount_currency=complaint.amount_currency,
                    severity=complaint.severity,
                    urgency_score=complaint.urgency_score,
                    pipeline=complaint.pipeline,
                    status=complaint.status,
                    helpline_reference_number=complaint.helpline_reference_number,
                    cluster_id=complaint.cluster_id,
                    state=geo.state,
                    district=geo.district,
                    pincode=geo.pincode,
                    lat=geo.lat,
                    lng=geo.lng,
                    created_at=_coerce_datetime(complaint.created_at),
                    incident_at=_coerce_datetime(complaint.incident_at),
                    is_resolved=complaint.is_resolved,
                    has_fir=complaint.has_fir,
                    summary=complaint.summary,
                )
                session.add(orm)
            else:
                # Upsert: update existing fields (complaint may be re-saved with identifier_ids)
                existing_orm.identifier_ids = [i.id for i in existing_orm.identifiers]
                existing_orm.summary = complaint.summary
                existing_orm.status = complaint.status
                existing_orm.helpline_reference_number = complaint.helpline_reference_number
                existing_orm.cluster_id = complaint.cluster_id
                orm = existing_orm
            session.flush()
            # Add identifier associations
            for iid in complaint.identifier_ids:
                existing = session.get(
                    ComplaintIdentifierORM, (complaint.id, iid)
                )
                if existing is None:
                    session.add(
                        ComplaintIdentifierORM(
                            complaint_id=complaint.id,
                            identifier_id=iid,
                        )
                    )
            session.commit()

    # --- Identifiers ---

    def identifiers(self) -> list[ScamIdentifier]:
        with self._session() as session:
            stmt = select(ScamIdentifierORM).options(
                selectinload(ScamIdentifierORM.complaints)
            )
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [
                ScamIdentifier(
                    id=o.id,
                    type=o.type,
                    value=o.value,
                    normalized_value=o.normalized_value,
                    confidence=o.confidence,
                    source_complaint_ids=[c.id for c in o.complaints],
                )
                for o in orms
            ]

    def identifier(self, iid: str) -> ScamIdentifier | None:
        with self._session() as session:
            stmt = (
                select(ScamIdentifierORM)
                .options(selectinload(ScamIdentifierORM.complaints))
                .where(ScamIdentifierORM.id == iid)
            )
            result = session.execute(stmt)
            o = result.scalar_one_or_none()
            if o is None:
                return None
            return ScamIdentifier(
                id=o.id,
                type=o.type,
                value=o.value,
                normalized_value=o.normalized_value,
                confidence=o.confidence,
                source_complaint_ids=[c.id for c in o.complaints],
            )

    def add_identifier(self, identifier: ScamIdentifier) -> None:
        with self._session() as session:
            existing_orm = session.get(ScamIdentifierORM, identifier.id)
            if existing_orm is None:
                orm = ScamIdentifierORM(
                    id=identifier.id,
                    type=identifier.type,
                    value=identifier.value,
                    normalized_value=identifier.normalized_value,
                    confidence=identifier.confidence,
                    created_at=_utcnow(),
                )
                session.add(orm)
            # Link to existing complaints that are already persisted
            for cid in identifier.source_complaint_ids:
                complaint = session.get(ComplaintORM, cid)
                if complaint is None:
                    continue  # complaint not yet committed — will be linked when add_complaint runs
                existing = session.get(
                    ComplaintIdentifierORM, (cid, identifier.id)
                )
                if existing is None:
                    session.add(
                        ComplaintIdentifierORM(
                            complaint_id=cid,
                            identifier_id=identifier.id,
                        )
                    )
            session.commit()

    # --- Evidence ---

    def evidence(self) -> list[EvidenceItem]:
        with self._session() as session:
            stmt = select(EvidenceItemORM).order_by(
                EvidenceItemORM.created_at
            )
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [
                EvidenceItem(
                    id=o.id,
                    complaint_id=o.complaint_id,
                    kind=o.kind,  # type: ignore[arg-type]
                    source=o.source,
                    original_text=o.original_text,
                    redacted_text=o.redacted_text,
                    extracted_fields=o.extracted_fields,
                    created_at=o.created_at,
                )
                for o in orms
            ]

    def evidence_for_complaint(self, cid: str) -> list[EvidenceItem]:
        with self._session() as session:
            stmt = (
                select(EvidenceItemORM)
                .where(EvidenceItemORM.complaint_id == cid)
                .order_by(EvidenceItemORM.created_at)
            )
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [
                EvidenceItem(
                    id=o.id,
                    complaint_id=o.complaint_id,
                    kind=o.kind,
                    source=o.source,
                    original_text=o.original_text,
                    redacted_text=o.redacted_text,
                    extracted_fields=o.extracted_fields,
                    created_at=o.created_at,
                )
                for o in orms
            ]

    def add_evidence(self, evidence: EvidenceItem) -> None:
        with self._session() as session:
            orm = EvidenceItemORM(
                id=evidence.id,
                complaint_id=evidence.complaint_id,
                kind=evidence.kind,
                source=evidence.source,
                original_text=evidence.original_text,
                redacted_text=evidence.redacted_text,
                extracted_fields=evidence.extracted_fields,
                created_at=_coerce_datetime(evidence.created_at),
            )
            session.add(orm)
            session.commit()

    # --- Clusters ---

    def clusters(self) -> list[ClusterRecord]:
        with self._session() as session:
            stmt = select(ClusterORM).order_by(
                ClusterORM.report_count.desc()
            )
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [
                ClusterRecord(
                    id=o.id,
                    status=o.status,
                    fraud_type=o.fraud_type,
                    member_complaint_ids=o.member_complaint_ids,
                    common_identifier_ids=o.common_identifier_ids,
                    districts=o.districts,
                    states=o.states,
                    first_report_at=o.first_report_at,
                    latest_report_at=o.latest_report_at,
                    total_amount=o.total_amount,
                    report_count=o.report_count,
                    trigger_reason=o.trigger_reason,
                )
                for o in orms
            ]

    def cluster(self, clid: str) -> ClusterRecord | None:
        with self._session() as session:
            o = session.get(ClusterORM, clid)
            if o is None:
                return None
            return ClusterRecord(
                id=o.id,
                status=o.status,
                fraud_type=o.fraud_type,
                member_complaint_ids=o.member_complaint_ids,
                common_identifier_ids=o.common_identifier_ids,
                districts=o.districts,
                states=o.states,
                first_report_at=o.first_report_at,
                latest_report_at=o.latest_report_at,
                total_amount=o.total_amount,
                report_count=o.report_count,
                trigger_reason=o.trigger_reason,
            )

    def add_cluster(self, cluster: ClusterRecord) -> None:
        with self._session() as session:
            o = session.get(ClusterORM, cluster.id)
            if o is None:
                orm = ClusterORM(
                    id=cluster.id,
                    status=cluster.status,
                    fraud_type=cluster.fraud_type,
                    member_complaint_ids=cluster.member_complaint_ids,
                    common_identifier_ids=cluster.common_identifier_ids,
                    districts=cluster.districts,
                    states=cluster.states,
                    first_report_at=_coerce_datetime(
                        cluster.first_report_at
                    ),
                    latest_report_at=_coerce_datetime(
                        cluster.latest_report_at
                    ),
                    total_amount=cluster.total_amount,
                    report_count=cluster.report_count,
                    trigger_reason=cluster.trigger_reason,
                    created_at=_utcnow(),
                )
                session.add(orm)
            else:
                o.status = cluster.status
                o.member_complaint_ids = cluster.member_complaint_ids
                o.common_identifier_ids = cluster.common_identifier_ids
                o.districts = cluster.districts
                o.states = cluster.states
                o.total_amount = cluster.total_amount
                o.report_count = cluster.report_count
                o.trigger_reason = cluster.trigger_reason
            session.commit()

    # --- Generated documents ---

    def documents_for_complaint(self, complaint_id: str) -> list[GeneratedDocument]:
        with self._session() as session:
            stmt = (
                select(GeneratedDocumentORM)
                .where(GeneratedDocumentORM.complaint_id == complaint_id)
                .order_by(GeneratedDocumentORM.created_at)
            )
            result = session.execute(stmt)
            return [_document_to_record(o) for o in result.scalars().all()]

    def add_generated_document(self, document: GeneratedDocument) -> None:
        with self._session() as session:
            existing = session.get(GeneratedDocumentORM, document.id)
            if existing is None:
                session.add(
                    GeneratedDocumentORM(
                        id=document.id,
                        complaint_id=document.complaint_id,
                        kind=document.kind,
                        title=document.title,
                        editable_body=document.editable_body,
                        export_status=document.export_status,
                        created_at=_coerce_datetime(document.created_at),
                        updated_at=_utcnow(),
                    )
                )
            else:
                existing.kind = document.kind
                existing.title = document.title
                existing.editable_body = document.editable_body
                existing.export_status = document.export_status
                existing.updated_at = _utcnow()
            session.commit()

    def add_generated_documents(self, documents: list[GeneratedDocument]) -> None:
        for document in documents:
            self.add_generated_document(document)

    # --- Mock integration events ---

    def integration_events(self, *, limit: int = 25) -> list[MockIntegrationEvent]:
        with self._session() as session:
            stmt = (
                select(MockIntegrationEventORM)
                .order_by(MockIntegrationEventORM.created_at.desc())
                .limit(limit)
            )
            result = session.execute(stmt)
            return [_event_to_record(o) for o in result.scalars().all()]

    def add_integration_event(
        self,
        event: MockIntegrationEvent,
        *,
        complaint_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        with self._session() as session:
            existing = session.get(MockIntegrationEventORM, event.id)
            if existing is None:
                session.add(
                    MockIntegrationEventORM(
                        id=event.id,
                        adapter=event.adapter,
                        operation=event.operation,
                        request_summary=event.request_summary,
                        response_summary=event.response_summary,
                        status=event.status,
                        related_complaint_id=complaint_id,
                        related_session_id=session_id,
                        created_at=_coerce_datetime(event.created_at),
                    )
                )
            session.commit()

    # --- Post Report Workflows ---

    def get_post_report_response(self, cid: str) -> PostReportResponse | None:
        with self._session() as session:
            stmt = (
                select(PostReportResponseORM)
                .where(PostReportResponseORM.complaint_id == cid)
                .order_by(PostReportResponseORM.updated_at.desc())
                .limit(1)
            )
            result = session.execute(stmt)
            orm = result.scalar_one_or_none()
            return _response_to_record(orm) if orm else None

    def add_post_report_response(self, response: PostReportResponse) -> None:
        with self._session() as session:
            existing_orm = session.get(PostReportResponseORM, response.id)
            if existing_orm is None:
                orm = PostReportResponseORM(
                    id=response.id,
                    complaint_id=response.complaint_id,
                    primary_workflow=response.primary_workflow,
                    secondary_workflows=response.secondary_workflows,
                    risk_level=response.risk_level,
                    headline=response.headline,
                    cards=[c.model_dump() for c in response.cards],
                    do_not_do=response.do_not_do,
                    evidence_to_preserve=response.evidence_to_preserve,
                    official_paths=[p.model_dump() for p in response.official_paths],
                    generated_document_kinds=response.generated_document_kinds,
                    follow_up_schedule=[s.model_dump() for s in response.follow_up_schedule],
                    disclaimer=response.disclaimer,
                    created_at=_coerce_datetime(response.created_at),
                    updated_at=_coerce_datetime(response.updated_at),
                )
                session.add(orm)
            else:
                existing_orm.primary_workflow = response.primary_workflow
                existing_orm.secondary_workflows = response.secondary_workflows
                existing_orm.risk_level = response.risk_level
                existing_orm.headline = response.headline
                existing_orm.cards = [c.model_dump() for c in response.cards]
                existing_orm.do_not_do = response.do_not_do
                existing_orm.evidence_to_preserve = response.evidence_to_preserve
                existing_orm.official_paths = [p.model_dump() for p in response.official_paths]
                existing_orm.generated_document_kinds = response.generated_document_kinds
                existing_orm.follow_up_schedule = [s.model_dump() for s in response.follow_up_schedule]
                existing_orm.disclaimer = response.disclaimer
                existing_orm.updated_at = _utcnow()
            session.commit()

    def get_post_report_steps(self, cid: str) -> list[PostReportStepState]:
        with self._session() as session:
            stmt = select(PostReportStepStateORM).where(PostReportStepStateORM.complaint_id == cid)
            result = session.execute(stmt)
            orms = result.scalars().all()
            return [_step_to_record(o) for o in orms]

    def add_post_report_step(self, step: PostReportStepState) -> None:
        with self._session() as session:
            stmt = select(PostReportStepStateORM).where(
                PostReportStepStateORM.complaint_id == step.complaint_id,
                PostReportStepStateORM.workflow_id == step.workflow_id,
                PostReportStepStateORM.step_key == step.step_key
            )
            result = session.execute(stmt)
            existing_orm = result.scalar_one_or_none()
            if existing_orm is None:
                orm = PostReportStepStateORM(
                    id=step.id,
                    complaint_id=step.complaint_id,
                    workflow_id=step.workflow_id,
                    step_key=step.step_key,
                    status=step.status,
                    completed_at=_coerce_datetime(step.completed_at) if step.completed_at else None,
                    notes=step.notes,
                )
                session.add(orm)
            else:
                existing_orm.status = step.status
                existing_orm.completed_at = _coerce_datetime(step.completed_at) if step.completed_at else None
                existing_orm.notes = step.notes
            session.commit()

    # --- Meta stubs ---

    @property
    def meta(self) -> dict:
        return {"source": "postgresql", "store": "DatabaseStore"}


# Toggle: read DATABASE_ENABLED env var at import time.
#
# CyberSaathi is Postgres-first for real local/runtime usage. Set
# DATABASE_ENABLED=false only for explicit in-memory tests or emergency demos.
_database_enabled = (
    os.environ.get("DATABASE_ENABLED", "true").lower()
    not in ("0", "false", "no")
)


def is_database_enabled() -> bool:
    """Return True if the app should use PostgreSQL instead of in-memory store."""
    global _database_enabled
    return _database_enabled


def set_database_enabled(enabled: bool) -> None:
    """Override the toggle (useful in tests)."""
    global _database_enabled
    _database_enabled = enabled
