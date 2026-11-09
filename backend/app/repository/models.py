import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    sub: Mapped[str | None] = mapped_column(String(64), unique=True, default=None)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    display_name: Mapped[str | None] = mapped_column(String(255), default=None)
    role: Mapped[str] = mapped_column(String(16))
    audience_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    group_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    invite_hash: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    invite_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class AudienceRow(Base):
    __tablename__ = "audiences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100))
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class GroupRow(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    audience_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(100))
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    categories: Mapped[list | None] = mapped_column(JSON, default=None)
    limits: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class SendLogRow(Base):
    __tablename__ = "send_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    sender_id: Mapped[str] = mapped_column(String(36), index=True)
    sender_email: Mapped[str | None] = mapped_column(String(255), default=None)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=utcnow)
    subject: Mapped[str] = mapped_column(String(500))
    recipients: Mapped[list] = mapped_column(JSON, default=list)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16))
    error_code: Mapped[str | None] = mapped_column(String(64), default=None)
    template_id: Mapped[str | None] = mapped_column(String(36), default=None)
