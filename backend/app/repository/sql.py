import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, String, Text, create_engine, func, or_, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

from app.repository.base import (
    NewTemplate,
    Role,
    Template,
    TemplatePage,
    TemplateScope,
    TemplateSummary,
    User,
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    sub: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    display_name: Mapped[str | None] = mapped_column(String(255), default=None)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class TemplateRow(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_sub: Mapped[str] = mapped_column(String(64), index=True)
    scope: Mapped[str] = mapped_column(String(16), index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), default="")
    blocks: Mapped[list] = mapped_column(JSON, default=list)
    preview: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


_TEMPLATE_EDITABLE = ("name", "category", "blocks", "preview")


def _summary_fields(row: TemplateRow) -> dict:
    return {
        "id": row.id,
        "owner_sub": row.owner_sub,
        "scope": TemplateScope(row.scope),
        "name": row.name,
        "category": row.category,
        "preview": row.preview,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _to_summary(row: TemplateRow) -> TemplateSummary:
    return TemplateSummary(**_summary_fields(row))


def _to_template(row: TemplateRow) -> Template:
    return Template(**_summary_fields(row), blocks=tuple(row.blocks))


def _to_user(row: UserRow) -> User:
    return User(
        sub=row.sub,
        role=Role(row.role),
        display_name=row.display_name,
        email=row.email,
        created_at=row.created_at,
    )


def make_engine(database_url: str) -> Engine:
    if database_url.startswith("sqlite") and ":memory:" in database_url:
        return create_engine(
            database_url, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    if database_url.startswith("sqlite"):
        return create_engine(database_url, connect_args={"check_same_thread": False})
    return create_engine(database_url, pool_pre_ping=True)


class SqlRepository:
    def __init__(self, engine: Engine) -> None:
        self._sessions = sessionmaker(engine, expire_on_commit=False)

    def _active(self, session: Session, sub: str) -> UserRow | None:
        return session.scalar(
            select(UserRow).where(UserRow.sub == sub, UserRow.deleted_at.is_(None))
        )

    def get_user(self, sub: str) -> User | None:
        with self._sessions() as session:
            row = self._active(session, sub)
            return _to_user(row) if row else None

    def ensure_user(self, sub: str, default_role: Role = Role.VIEWER) -> User:
        with self._sessions.begin() as session:
            row = session.get(UserRow, sub)
            if row is None:
                row = UserRow(sub=sub, role=default_role.value)
                session.add(row)
            elif row.deleted_at is not None:
                row.deleted_at = None
                row.role = default_role.value
            session.flush()
            return _to_user(row)

    def set_role(self, sub: str, role: Role) -> User | None:
        with self._sessions.begin() as session:
            row = self._active(session, sub)
            if row is None:
                return None
            row.role = role.value
            return _to_user(row)

    def delete_user(self, sub: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active(session, sub)
            if row is None:
                return False
            row.deleted_at = _utcnow()
            return True

    def list_templates(
        self, viewer_sub: str, page: int, limit: int, scope: TemplateScope | None = None
    ) -> TemplatePage:
        visible = or_(
            TemplateRow.scope == TemplateScope.SHARED.value,
            TemplateRow.owner_sub == viewer_sub,
        )
        conditions = [TemplateRow.deleted_at.is_(None), visible]
        if scope is not None:
            conditions.append(TemplateRow.scope == scope.value)
        with self._sessions() as session:
            total = session.scalar(select(func.count()).select_from(TemplateRow).where(*conditions))
            rows = session.scalars(
                select(TemplateRow)
                .where(*conditions)
                .order_by(TemplateRow.name, TemplateRow.id)
                .offset((page - 1) * limit)
                .limit(limit)
            ).all()
            return TemplatePage(items=tuple(_to_summary(r) for r in rows), total=total or 0)

    def _active_template(self, session: Session, template_id: str) -> TemplateRow | None:
        return session.scalar(
            select(TemplateRow).where(
                TemplateRow.id == template_id, TemplateRow.deleted_at.is_(None)
            )
        )

    def get_template(self, template_id: str) -> Template | None:
        with self._sessions() as session:
            row = self._active_template(session, template_id)
            return _to_template(row) if row else None

    def create_template(self, new: NewTemplate) -> Template:
        with self._sessions.begin() as session:
            row = TemplateRow(
                id=str(uuid.uuid4()),
                owner_sub=new.owner_sub,
                scope=new.scope.value,
                name=new.name,
                category=new.category,
                blocks=list(new.blocks),
                preview=new.preview,
            )
            session.add(row)
            session.flush()
            return _to_template(row)

    def update_template(self, template_id: str, changes: dict) -> Template | None:
        with self._sessions.begin() as session:
            row = self._active_template(session, template_id)
            if row is None:
                return None
            for key in _TEMPLATE_EDITABLE:
                if key in changes:
                    setattr(row, key, changes[key])
            row.updated_at = _utcnow()
            return _to_template(row)

    def delete_template(self, template_id: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active_template(session, template_id)
            if row is None:
                return False
            row.deleted_at = _utcnow()
            return True
