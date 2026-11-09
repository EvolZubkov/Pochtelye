"""группы доступа и users.group_id

Группа несёт настройки приложения для людей одной аудитории: функции, видимые категории
общих шаблонов и лимиты (на будущее).

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("audience_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("categories", sa.JSON(), nullable=True),
        sa.Column("limits", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("groups") as batch_op:
        batch_op.create_index("ix_groups_audience_id", ["audience_id"])
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.String(length=36), nullable=True))
        batch_op.create_index("ix_users_group_id", ["group_id"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_group_id")
        batch_op.drop_column("group_id")
    op.drop_table("groups")
