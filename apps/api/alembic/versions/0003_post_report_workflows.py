"""add post-report response workflow tables

Revision ID: 0003_post_report_workflows
Revises: 0002_llm_intake
Create Date: 2026-06-06

Adds durable post-report workflow guidance and per-step state tables.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0003_post_report_workflows"
down_revision: Union[str, None] = "0002_llm_intake"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


risk_level_enum = postgresql.ENUM(
    "low",
    "medium",
    "high",
    "critical",
    name="risk_level_enum",
    create_type=False,
)
step_status_enum = postgresql.ENUM(
    "todo",
    "done",
    "skipped",
    "blocked",
    name="step_status_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    risk_level_enum.create(bind, checkfirst=True)
    step_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "post_report_responses",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "complaint_id",
            sa.String(32),
            sa.ForeignKey("complaints.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("primary_workflow", sa.String(64), nullable=False),
        sa.Column(
            "secondary_workflows",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("risk_level", risk_level_enum, nullable=False),
        sa.Column("headline", sa.String(256), nullable=False),
        sa.Column("cards", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("do_not_do", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "evidence_to_preserve",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "official_paths",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "generated_document_kinds",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "follow_up_schedule",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "disclaimer",
            sa.Text,
            nullable=False,
            server_default="CyberSaathi prepared this guidance; it has not filed or submitted anything for you.",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_post_report_responses_complaint_id",
        "post_report_responses",
        ["complaint_id"],
    )

    op.create_table(
        "post_report_step_states",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "complaint_id",
            sa.String(32),
            sa.ForeignKey("complaints.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workflow_id", sa.String(64), nullable=False),
        sa.Column("step_key", sa.String(256), nullable=False),
        sa.Column("status", step_status_enum, nullable=False, server_default="todo"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_post_report_step_states_complaint_id",
        "post_report_step_states",
        ["complaint_id"],
    )
    op.create_index(
        "ux_complaint_workflow_step",
        "post_report_step_states",
        ["complaint_id", "workflow_id", "step_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_complaint_workflow_step", table_name="post_report_step_states")
    op.drop_index("ix_post_report_step_states_complaint_id", table_name="post_report_step_states")
    op.drop_table("post_report_step_states")

    op.drop_index("ix_post_report_responses_complaint_id", table_name="post_report_responses")
    op.drop_table("post_report_responses")

    step_status_enum.drop(op.get_bind(), checkfirst=True)
    risk_level_enum.drop(op.get_bind(), checkfirst=True)
