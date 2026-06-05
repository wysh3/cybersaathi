"""Initial migration: create all CyberSaathi tables.

Revision ID: 0001
Revises:
Create Date: 2026-06-04

This migration creates the 8 ORM tables defined in ``app.models.db``:
- victim_sessions
- clusters
- complaints
- scam_identifiers
- complaint_identifiers (many-to-many)
- evidence_items
- generated_documents
- mock_integration_events

Run with:
    cd apps/api && PYTHONPATH=apps/api:..:../../packages alembic upgrade head
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ENUM types ---
    sa.Enum("low", "medium", "high", "critical", name="severity_enum").create(op.get_bind())
    sa.Enum("golden_hour", "post_golden_hour", "fall_back", name="pipeline_enum").create(op.get_bind())
    sa.Enum("sms", "screenshot", "voice", "narrative", name="evidence_kind_enum").create(op.get_bind())
    sa.Enum("monitor", "escalated", "stable", "resolved", name="cluster_status_enum").create(op.get_bind())
    sa.Enum("simulated_success", "simulated_pending", "simulated_failed", name="mock_status_enum").create(op.get_bind())

    # --- victim_sessions ---
    op.create_table(
        "victim_sessions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("preferred_language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("contact_channel", sa.String(32), nullable=True),
        sa.Column("current_step", sa.String(32), nullable=False, server_default="intake"),
        sa.Column("consent_flags", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_victim_sessions_updated_at_desc", "victim_sessions", [sa.text("updated_at DESC")])

    # --- clusters ---
    op.create_table(
        "clusters",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("fraud_type", sa.String(64), nullable=False),
        sa.Column("member_complaint_ids", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("common_identifier_ids", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("districts", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("states", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("first_report_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latest_report_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_amount", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("report_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("trigger_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_clusters_fraud_type_status", "clusters", ["fraud_type", "status"])
    op.create_index("ix_clusters_report_count_desc", "clusters", [sa.text("report_count DESC")])

    # --- complaints ---
    op.create_table(
        "complaints",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("victim_session_id", sa.String(32), sa.ForeignKey("victim_sessions.id"), nullable=False),
        sa.Column("fraud_type", sa.String(64), nullable=False),
        sa.Column("payment_method", sa.String(32), nullable=False),
        sa.Column("amount", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("amount_currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("urgency_score", sa.Integer, nullable=False),
        sa.Column("pipeline", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="intake_in_progress"),
        sa.Column("helpline_reference_number", sa.String(64), nullable=True),
        sa.Column("cluster_id", sa.String(32), sa.ForeignKey("clusters.id"), nullable=True),
        sa.Column("state", sa.String(64), nullable=False),
        sa.Column("district", sa.String(64), nullable=False),
        sa.Column("pincode", sa.String(10), nullable=True),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("incident_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_resolved", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("has_fir", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("summary", sa.Text, nullable=False),
    )
    op.create_index("ix_complaints_victim_session_id", "complaints", ["victim_session_id"])
    op.create_index("ix_complaints_fraud_type", "complaints", ["fraud_type"])
    op.create_index("ix_complaints_pipeline", "complaints", ["pipeline"])
    op.create_index("ix_complaints_cluster_id", "complaints", ["cluster_id"])
    op.create_index("ix_complaints_state", "complaints", ["state"])
    op.create_index("ix_complaints_district", "complaints", ["district"])
    op.create_index("ix_complaints_fraud_type_pipeline", "complaints", ["fraud_type", "pipeline"])
    op.create_index("ix_complaints_created_at_desc", "complaints", [sa.text("created_at DESC")])
    op.create_index("ix_complaints_state_district", "complaints", ["state", "district"])

    # --- scam_identifiers ---
    op.create_table(
        "scam_identifiers",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("value", sa.String(256), nullable=False),
        sa.Column("normalized_value", sa.String(256), nullable=False),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_scam_identifiers_type", "scam_identifiers", ["type"])
    op.create_index("ix_scam_identifiers_normalized_value", "scam_identifiers", ["normalized_value"])
    op.create_index("ix_scam_identifiers_type_normalized", "scam_identifiers", ["type", "normalized_value"])

    # --- complaint_identifiers (many-to-many association) ---
    op.create_table(
        "complaint_identifiers",
        sa.Column("complaint_id", sa.String(32), sa.ForeignKey("complaints.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("identifier_id", sa.String(32), sa.ForeignKey("scam_identifiers.id", ondelete="CASCADE"), primary_key=True),
    )

    # --- evidence_items ---
    op.create_table(
        "evidence_items",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("complaint_id", sa.String(32), sa.ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("original_text", sa.Text, nullable=False),
        sa.Column("redacted_text", sa.Text, nullable=False),
        sa.Column("extracted_fields", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_evidence_items_complaint_id", "evidence_items", ["complaint_id"])

    # --- generated_documents ---
    op.create_table(
        "generated_documents",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("complaint_id", sa.String(32), sa.ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("editable_body", sa.Text, nullable=False),
        sa.Column("export_status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_generated_documents_complaint_id", "generated_documents", ["complaint_id"])
    op.create_index("ix_generated_documents_complaint_kind", "generated_documents", ["complaint_id", "kind"])

    # --- mock_integration_events ---
    op.create_table(
        "mock_integration_events",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("adapter", sa.String(64), nullable=False),
        sa.Column("operation", sa.String(64), nullable=False),
        sa.Column("request_summary", sa.Text, nullable=False),
        sa.Column("response_summary", sa.Text, nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("related_complaint_id", sa.String(32), sa.ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_session_id", sa.String(32), sa.ForeignKey("victim_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_mock_events_adapter", "mock_integration_events", ["adapter"])
    op.create_index("ix_mock_events_related_complaint_id", "mock_integration_events", ["related_complaint_id"])
    op.create_index("ix_mock_events_related_session_id", "mock_integration_events", ["related_session_id"])
    op.create_index("ix_mock_events_adapter_status", "mock_integration_events", ["adapter", "status"])
    op.create_index("ix_mock_events_created_at_desc", "mock_integration_events", [sa.text("created_at DESC")])


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_table("mock_integration_events")
    op.drop_table("generated_documents")
    op.drop_table("evidence_items")
    op.drop_table("complaint_identifiers")
    op.drop_table("scam_identifiers")
    op.drop_table("complaints")
    op.drop_table("clusters")
    op.drop_table("victim_sessions")

    # Drop enum types
    sa.Enum(name="mock_status_enum").drop(op.get_bind())
    sa.Enum(name="cluster_status_enum").drop(op.get_bind())
    sa.Enum(name="evidence_kind_enum").drop(op.get_bind())
    sa.Enum(name="pipeline_enum").drop(op.get_bind())
    sa.Enum(name="severity_enum").drop(op.get_bind())
