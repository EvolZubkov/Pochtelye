from datetime import UTC, datetime

from sqlalchemy import DateTime, String, create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

from app.repository.base import Role, User


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
