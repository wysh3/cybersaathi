"""add llm intake conversation tables

Revision ID: 0002_llm_intake
Create Date: 2026-06-06

Adds intake_conversations, intake_messages, and llm_invocations tables
for the LLM-powered conversational intake feature (F015).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0002_llm_intake"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- intake_conversations ---
    op.create_table(
        "intake_conversations",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "victim_session_id",
            sa.String(32),
            sa.ForeignKey("victim_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "complaint_id",
            sa.String(32),
            sa.ForeignKey("complaints.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active", "ready_to_route", "routed", "completed", "abandoned", "blocked",
                name="conv_status_enum",
                create_type=True,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "current_phase",
            sa.Enum(
                "describe", "clarify", "confirm", "route", "documents",
                name="conv_phase_enum",
                create_type=True,
            ),
            nullable=False,
            server_default="describe",
        ),
        sa.Column("safety_flags", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("case_snapshot", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("last_model", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_intake_conv_session_status", "intake_conversations", ["victim_session_id", "status"])
    op.create_index("ix_intake_conv_updated_at_desc", "intake_conversations", [sa.text("updated_at DESC")])

    # --- intake_messages ---
    op.create_table(
        "intake_messages",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.String(32),
            sa.ForeignKey("intake_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.Enum("user", "assistant", "system", "tool", name="message_role_enum", create_type=True),
            nullable=False,
        ),
        sa.Column("content_redacted", sa.Text, nullable=False),
        sa.Column("content_original", sa.Text, nullable=True),
        sa.Column(
            "message_kind",
            sa.Enum("chat", "evidence", "question", "action", "error", name="message_kind_enum", create_type=True),
            nullable=False,
            server_default="chat",
        ),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_intake_msgs_conv_created", "intake_messages", ["conversation_id", sa.text("created_at")])

    # --- llm_invocations ---
    op.create_table(
        "llm_invocations",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.String(32),
            sa.ForeignKey("intake_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(128), nullable=False),
        sa.Column("prompt_version", sa.String(32), nullable=False, server_default="v1"),
        sa.Column("input_summary_redacted", sa.Text, nullable=False),
        sa.Column("output_summary_redacted", sa.Text, nullable=False),
        sa.Column("raw_output_redacted", sa.Text, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=False),
        sa.Column(
            "status",
            sa.Enum("success", "retry", "fallback", "failed", "blocked", name="llm_status_enum", create_type=True),
            nullable=False,
        ),
        sa.Column("error_type", sa.String(64), nullable=True),
        sa.Column("token_usage", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_llm_invocations_conv_created", "llm_invocations", ["conversation_id", sa.text("created_at")])


def downgrade() -> None:
    op.drop_table("llm_invocations")
    op.execute("DROP TYPE IF EXISTS llm_status_enum")
    op.drop_table("intake_messages")
    op.execute("DROP TYPE IF EXISTS message_role_enum")
    op.execute("DROP TYPE IF EXISTS message_kind_enum")
    op.drop_table("intake_conversations")
    op.execute("DROP TYPE IF EXISTS conv_status_enum")
    op.execute("DROP TYPE IF EXISTS conv_phase_enum")
