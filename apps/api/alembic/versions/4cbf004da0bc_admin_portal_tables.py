"""admin_portal_tables

Revision ID: 4cbf004da0bc
Revises: 0003_post_report_workflows
Create Date: 2026-06-06 06:40:51.413898

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cbf004da0bc'
down_revision: Union[str, Sequence[str], None] = '0003_post_report_workflows'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'admin_users',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('officer_id', sa.String(length=32), nullable=False),
        sa.Column('password_hash', sa.String(length=256), nullable=False),
        sa.Column('role', sa.Enum('super_admin', 'field_officer', name='admin_role_enum'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admin_users_officer_id', 'admin_users', ['officer_id'], unique=True)
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('complaint_id', sa.String(length=32), nullable=True),
        sa.Column('officer_id', sa.String(length=32), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('old_status', sa.String(length=32), nullable=True),
        sa.Column('new_status', sa.String(length=32), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('officer_name', sa.String(length=128), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['complaint_id'], ['complaints.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admin_audit_complaint_ts', 'admin_audit_logs', ['complaint_id', 'timestamp'], unique=False)
    op.create_index(op.f('ix_admin_audit_logs_complaint_id'), 'admin_audit_logs', ['complaint_id'], unique=False)
    op.create_index(op.f('ix_admin_audit_logs_officer_id'), 'admin_audit_logs', ['officer_id'], unique=False)
    op.create_index('ix_admin_audit_officer_ts', 'admin_audit_logs', ['officer_id', 'timestamp'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_admin_audit_officer_ts', table_name='admin_audit_logs')
    op.drop_index(op.f('ix_admin_audit_logs_officer_id'), table_name='admin_audit_logs')
    op.drop_index(op.f('ix_admin_audit_logs_complaint_id'), table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_complaint_ts', table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')
    op.drop_index('ix_admin_users_officer_id', table_name='admin_users')
    op.drop_table('admin_users')
