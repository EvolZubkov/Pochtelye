"""users по id с приглашениями, audiences, send_log

До релиза данных нет, поэтому users пересоздаётся (ключ меняется с sub на id).

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("users")
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("sub", sa.String(length=64), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("audience_id", sa.String(length=36), nullable=True),
        sa.Column("invite_hash", sa.String(length=64), nullable=True),
        sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sub"),
        sa.UniqueConstraint("email"),
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_index("ix_users_audience_id", ["audience_id"])
        batch_op.create_index("ix_users_invite_hash", ["invite_hash"])

    op.create_table(
        "audiences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "send_log",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("sender_id", sa.String(length=36), nullable=False),
        sa.Column("sender_email", sa.String(length=255), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("recipients", sa.JSON(), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("template_id", sa.String(length=36), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("send_log") as batch_op:
        batch_op.create_index("ix_send_log_sender_id", ["sender_id"])
        batch_op.create_index("ix_send_log_sent_at", ["sent_at"])


def downgrade() -> None:
    op.drop_table("send_log")
    op.drop_table("audiences")
    op.drop_table("users")
    op.create_table(
        "users",
        sa.Column("sub", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("sub"),
    )
