"""SQLAlchemy ORM models for PostgreSQL + PostGIS persistence.

Maps 1:1 to Pydantic models in app.models. Uses async SQLAlchemy 2.0.
Run migrations with: alembic upgrade head
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models import Pipeline, Severity


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class ComplaintORM(Base):
    __tablename__ = "complaints"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    victim_session_id: Mapped[str] = mapped_column(String(32), ForeignKey("victim_sessions.id"), nullable=False, index=True)
    fraud_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    amount_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    severity: Mapped[str] = mapped_column(SQLEnum("low", "medium", "high", "critical", name="severity_enum"), nullable=False)
    urgency_score: Mapped[int] = mapped_column(Integer, nullable=False)
    pipeline: Mapped[str] = mapped_column(SQLEnum("golden_hour", "post_golden_hour", "fall_back", name="pipeline_enum"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="intake_in_progress")
    helpline_reference_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("clusters.id"), nullable=True, index=True)

    # Location (district-level only, no street address)
    state: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    lat: Mapped[float | None] = mapped_column(nullable=True)
    lng: Mapped[float | None] = mapped_column(nullable=True)

    # PostGIS geometry point for heatmap queries
    # geom: Mapped[WKTElement] = mapped_column(Geometry("POINT", srid=4326), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    incident_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    is_resolved: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_fir: Mapped[bool] = mapped_column(nullable=False, default=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    identifiers: Mapped[list[ScamIdentifierORM]] = relationship(
        "ScamIdentifierORM",
        secondary="complaint_identifiers",
        back_populates="complaints",
    )
    evidence_items: Mapped[list[EvidenceItemORM]] = relationship(
        "EvidenceItemORM",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list[GeneratedDocumentORM]] = relationship(
        "GeneratedDocumentORM",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )
    session: Mapped[VictimSessionORM] = relationship("VictimSessionORM", back_populates="complaints")
    cluster: Mapped[ClusterORM | None] = relationship("ClusterORM", back_populates="complaints")

    __table_args__ = (
        Index("ix_complaints_fraud_type_pipeline", "fraud_type", "pipeline"),
        Index("ix_complaints_created_at_desc", created_at.desc()),
        Index("ix_complaints_state_district", "state", "district"),
        # Index("ix_complaints_geom", "geom", postgresql_using="gist"),
    )


class ScamIdentifierORM(Base):
    __tablename__ = "scam_identifiers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # upi, phone, social_handle, url, bank_account
    value: Mapped[str] = mapped_column(String(256), nullable=False)
    normalized_value: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Many-to-many with complaints
    complaints: Mapped[list[ComplaintORM]] = relationship(
        "ComplaintORM",
        secondary="complaint_identifiers",
        back_populates="identifiers",
    )

    __table_args__ = (
        Index("ix_scam_identifiers_type_normalized", "type", "normalized_value"),
    )


class ComplaintIdentifierORM(Base):
    """Association table for complaint <-> scam_identifier many-to-many."""
    __tablename__ = "complaint_identifiers"

    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), primary_key=True
    )
    identifier_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("scam_identifiers.id", ondelete="CASCADE"), primary_key=True
    )


class EvidenceItemORM(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        SQLEnum("sms", "screenshot", "voice", "narrative", name="evidence_kind_enum"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    redacted_text: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationship
    complaint: Mapped[ComplaintORM] = relationship("ComplaintORM", back_populates="evidence_items")


class ClusterORM(Base):
    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[str] = mapped_column(
        SQLEnum("monitor", "escalated", "stable", "resolved", name="cluster_status_enum"), nullable=False
    )
    fraud_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    member_complaint_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    common_identifier_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    districts: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    states: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    first_report_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latest_report_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trigger_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationship
    complaints: Mapped[list[ComplaintORM]] = relationship("ComplaintORM", back_populates="cluster")

    __table_args__ = (
        Index("ix_clusters_fraud_type_status", "fraud_type", "status"),
        Index("ix_clusters_report_count_desc", report_count.desc()),
    )


class VictimSessionORM(Base):
    __tablename__ = "victim_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    preferred_language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    contact_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_step: Mapped[str] = mapped_column(String(32), nullable=False, default="intake")
    consent_flags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    # Relationship
    complaints: Mapped[list[ComplaintORM]] = relationship("ComplaintORM", back_populates="session")

    __table_args__ = (
        Index("ix_victim_sessions_updated_at_desc", updated_at.desc()),
    )


class GeneratedDocumentORM(Base):
    __tablename__ = "generated_documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    editable_body: Mapped[str] = mapped_column(Text, nullable=False)
    export_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    # Relationship
    complaint: Mapped[ComplaintORM] = relationship("ComplaintORM", back_populates="documents")

    __table_args__ = (
        Index("ix_generated_documents_complaint_kind", "complaint_id", "kind"),
    )


class MockIntegrationEventORM(Base):
    __tablename__ = "mock_integration_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    adapter: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # 1930, ncrp, bank, rti, whatsapp, journalist
    operation: Mapped[str] = mapped_column(String(64), nullable=False)  # create, prepare, submit, send, etc.
    request_summary: Mapped[str] = mapped_column(Text, nullable=False)
    response_summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum("simulated_success", "simulated_pending", "simulated_failed", name="mock_status_enum"),
        nullable=False,
    )
    related_complaint_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    related_session_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("victim_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("ix_mock_events_adapter_status", "adapter", "status"),
        Index("ix_mock_events_created_at_desc", created_at.desc()),
    )


class PostReportResponseORM(Base):
    __tablename__ = "post_report_responses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    primary_workflow: Mapped[str] = mapped_column(String(64), nullable=False)
    secondary_workflows: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    risk_level: Mapped[str] = mapped_column(
        SQLEnum("low", "medium", "high", "critical", name="risk_level_enum"), nullable=False
    )
    headline: Mapped[str] = mapped_column(String(256), nullable=False)
    cards: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    do_not_do: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    evidence_to_preserve: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    official_paths: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    generated_document_kinds: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    follow_up_schedule: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    disclaimer: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="CyberSaathi prepared this guidance; it has not filed or submitted anything for you.",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    complaint: Mapped[ComplaintORM] = relationship(
        "ComplaintORM", back_populates="post_report_responses"
    )


ComplaintORM.post_report_responses = relationship(
    "PostReportResponseORM",
    back_populates="complaint",
    cascade="all, delete-orphan",
)


class PostReportStepStateORM(Base):
    __tablename__ = "post_report_step_states"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workflow_id: Mapped[str] = mapped_column(String(64), nullable=False)
    step_key: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum("todo", "done", "skipped", "blocked", name="step_status_enum"),
        nullable=False,
        default="todo",
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ux_complaint_workflow_step", "complaint_id", "workflow_id", "step_key", unique=True),
    )


# ---------------------------------------------------------------------------
# LLM Intake conversation tables (F015)
# ---------------------------------------------------------------------------


class IntakeConversationORM(Base):
    __tablename__ = "intake_conversations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    victim_session_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("victim_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    complaint_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        SQLEnum("active", "ready_to_route", "routed", "completed", "abandoned", "blocked", name="conv_status_enum"),
        nullable=False,
        default="active",
    )
    current_phase: Mapped[str] = mapped_column(
        SQLEnum("describe", "clarify", "confirm", "route", "documents", name="conv_phase_enum"),
        nullable=False,
        default="describe",
    )
    safety_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    case_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    messages: Mapped[list[IntakeMessageORM]] = relationship(
        "IntakeMessageORM", back_populates="conversation", cascade="all, delete-orphan"
    )
    invocations: Mapped[list[LlmInvocationORM]] = relationship(
        "LlmInvocationORM", back_populates="conversation", cascade="all, delete-orphan"
    )
    session: Mapped[VictimSessionORM] = relationship("VictimSessionORM")

    __table_args__ = (
        Index("ix_intake_conv_session_status", "victim_session_id", "status"),
        Index("ix_intake_conv_updated_at_desc", updated_at.desc()),
    )


class IntakeMessageORM(Base):
    __tablename__ = "intake_messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("intake_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        SQLEnum("user", "assistant", "system", "tool", name="message_role_enum"), nullable=False
    )
    content_redacted: Mapped[str] = mapped_column(Text, nullable=False)
    content_original: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_kind: Mapped[str] = mapped_column(
        SQLEnum("chat", "evidence", "question", "action", "error", name="message_kind_enum"),
        nullable=False,
        default="chat",
    )
    message_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationship
    conversation: Mapped[IntakeConversationORM] = relationship("IntakeConversationORM", back_populates="messages")

    __table_args__ = (
        Index("ix_intake_msgs_conv_created", "conversation_id", "created_at"),
    )


class LlmInvocationORM(Base):
    __tablename__ = "llm_invocations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("intake_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False, default="v1")
    input_summary_redacted: Mapped[str] = mapped_column(Text, nullable=False)
    output_summary_redacted: Mapped[str] = mapped_column(Text, nullable=False)
    raw_output_redacted: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum("success", "retry", "fallback", "failed", "blocked", name="llm_status_enum"), nullable=False
    )
    error_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_usage: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationship
    conversation: Mapped[IntakeConversationORM] = relationship("IntakeConversationORM", back_populates="invocations")

    __table_args__ = (
        Index("ix_llm_invocations_conv_created", "conversation_id", "created_at"),
    )


# ---------------------------------------------------------------------------
# Admin Portal tables (police-dashboard)
# ---------------------------------------------------------------------------


class AdminUserORM(Base):
    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    officer_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(
        SQLEnum("super_admin", "field_officer", name="admin_role_enum"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_admin_users_officer_id", "officer_id", unique=True),
    )


class AdminAuditLogORM(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    complaint_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    officer_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    officer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("ix_admin_audit_complaint_ts", "complaint_id", "timestamp"),
        Index("ix_admin_audit_officer_ts", "officer_id", "timestamp"),
    )


# Export all models for Alembic autogenerate
__all__ = [
    "Base",
    "ComplaintORM",
    "ScamIdentifierORM",
    "ComplaintIdentifierORM",
    "EvidenceItemORM",
    "ClusterORM",
    "VictimSessionORM",
    "GeneratedDocumentORM",
    "MockIntegrationEventORM",
    "PostReportResponseORM",
    "PostReportStepStateORM",
    "IntakeConversationORM",
    "IntakeMessageORM",
    "LlmInvocationORM",
    "AdminUserORM",
    "AdminAuditLogORM",
]
