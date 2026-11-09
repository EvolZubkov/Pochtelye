"""Доменные типы и интерфейсы хранилища. SQLite локально, PostgreSQL в проде."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol


class Role(StrEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class UserStatus(StrEnum):
    INVITED = "invited"  # заведён админом, ещё не вошёл (нет sub)
    ACTIVE = "active"


@dataclass(frozen=True)
class User:
    id: str
    sub: str | None
    email: str | None
    display_name: str | None
    role: Role
    audience_id: str | None
    group_id: str | None
    created_at: datetime
    last_seen_at: datetime | None
    invite_expires_at: datetime | None

    @property
    def status(self) -> UserStatus:
        return UserStatus.ACTIVE if self.sub else UserStatus.INVITED


@dataclass(frozen=True)
class NewUser:
    email: str | None
    role: Role
    display_name: str | None = None
    audience_id: str | None = None
    group_id: str | None = None
    sub: str | None = None


@dataclass(frozen=True)
class UserPage:
    items: tuple[User, ...]
    total: int


class UserRepository(Protocol):
    def get_user(self, user_id: str) -> User | None: ...

    def get_user_by_sub(self, sub: str) -> User | None: ...

    def list_users(self, page: int, limit: int, search: str | None = None) -> UserPage: ...

    def ensure_admin(self, sub: str) -> User:
        """Идемпотентно заводит администратора из настроек (ADMIN_SUBS, dev-пользователь)."""
        ...

    def create_user(self, new: NewUser) -> User:
        """Заводит пользователя; DuplicateEmailError, если почта занята."""
        ...

    def update_user(self, user_id: str, changes: dict) -> User | None:
        """changes: email, display_name, role, audience_id, group_id. Прочие ключи игнорируются."""
        ...

    def delete_user(self, user_id: str) -> bool:
        """Мягкое удаление (deleted_at); освобождает sub и почту."""
        ...

    def set_invite(self, user_id: str, code_hash: str, expires_at: datetime) -> User | None: ...

    def claim_invite(self, code_hash: str, sub: str, now: datetime) -> User | None:
        """Привязывает sub к приглашённому пользователю и гасит код. None, если код не подошёл."""
        ...

    def claim_by_email(
        self, email: str, sub: str, display_name: str | None, now: datetime
    ) -> User | None:
        """Привязывает sub к заведённому админом пользователю по рабочей почте.

        None, если такой почты нет или запись уже привязана. Вызывать только для login
        из JWT с проверенной подписью.
        """
        ...

    def touch_last_seen(self, user_id: str, now: datetime) -> None: ...

    def count_users_by_audience(self, audience_id: str) -> int: ...

    def count_users_by_group(self, group_id: str) -> int: ...


@dataclass(frozen=True)
class Audience:
    """Аудитория: профиль редактора (какие блоки и функции доступны)."""

    id: str
    name: str
    profile: dict
    is_default: bool
    created_at: datetime
    updated_at: datetime


class AudienceRepository(Protocol):
    def list_audiences(self) -> tuple[Audience, ...]: ...

    def get_audience(self, audience_id: str) -> Audience | None: ...

    def get_default_audience(self) -> Audience | None: ...

    def create_audience(self, name: str, profile: dict, is_default: bool = False) -> Audience: ...

    def update_audience(self, audience_id: str, changes: dict) -> Audience | None:
        """changes: name, profile, is_default (True делает аудиторию единственной по умолчанию)."""
        ...

    def delete_audience(self, audience_id: str) -> bool:
        """Мягкое удаление (deleted_at)."""
        ...


@dataclass(frozen=True)
class Group:
    """Группа доступа внутри аудитории: что люди видят и могут в приложении.

    features перекрывают features профиля аудитории; categories: какие категории общих
    шаблонов видны (None: все); limits: лимиты на будущее (пока не проверяются).
    Доступ к почтовым ящикам к группе не относится: он у пользователя и на стороне Exchange.
    """

    id: str
    audience_id: str
    name: str
    features: dict[str, bool]
    categories: tuple[str, ...] | None
    limits: dict[str, int]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class NewGroup:
    audience_id: str
    name: str
    features: dict[str, bool]
    categories: tuple[str, ...] | None = None
    limits: dict[str, int] | None = None


class GroupRepository(Protocol):
    def list_groups(self) -> tuple[Group, ...]: ...

    def get_group(self, group_id: str) -> Group | None: ...

    def create_group(self, new: NewGroup) -> Group: ...

    def update_group(self, group_id: str, changes: dict) -> Group | None:
        """changes: name, features, categories, limits. Прочие ключи игнорируются."""
        ...

    def delete_group(self, group_id: str) -> bool:
        """Мягкое удаление (deleted_at)."""
        ...

    def count_groups_by_audience(self, audience_id: str) -> int: ...


class TemplateScope(StrEnum):
    SHARED = "shared"
    PERSONAL = "personal"


@dataclass(frozen=True)
class TemplateSummary:
    """Шаблон без блоков: для списков и карточек (preview нужен для миниатюр)."""

    id: str
    owner_sub: str
    scope: TemplateScope
    name: str
    category: str
    preview: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Template(TemplateSummary):
    blocks: tuple[dict, ...]


@dataclass(frozen=True)
class NewTemplate:
    owner_sub: str
    scope: TemplateScope
    name: str
    category: str
    blocks: tuple[dict, ...]
    preview: str | None = None


@dataclass(frozen=True)
class TemplatePage:
    items: tuple[TemplateSummary, ...]
    total: int


class TemplateRepository(Protocol):
    def list_templates(
        self,
        viewer_sub: str,
        page: int,
        limit: int,
        scope: TemplateScope | None = None,
        shared_categories: frozenset[str] | None = None,
    ) -> TemplatePage:
        """Общие шаблоны и личные шаблоны viewer_sub; чужие личные не видны.

        shared_categories ограничивает только общие шаблоны (None: без ограничения).
        """
        ...

    def get_template(self, template_id: str) -> Template | None: ...

    def create_template(self, new: NewTemplate) -> Template: ...

    def update_template(self, template_id: str, changes: dict) -> Template | None:
        """changes: name, category, blocks, preview. Прочие ключи игнорируются."""
        ...

    def delete_template(self, template_id: str) -> bool:
        """Мягкое удаление (deleted_at)."""
        ...


class SendStatus(StrEnum):
    SENT = "sent"
    FAILED = "failed"


@dataclass(frozen=True)
class NewSend:
    sender_id: str
    sender_email: str | None
    subject: str
    recipients: tuple[str, ...]
    status: SendStatus
    error_code: str | None = None
    template_id: str | None = None


@dataclass(frozen=True)
class SendRecord:
    id: str
    sender_id: str
    sender_email: str | None
    sent_at: datetime
    subject: str
    recipients: tuple[str, ...]
    status: SendStatus
    error_code: str | None
    template_id: str | None


@dataclass(frozen=True)
class SendFilter:
    sender_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


@dataclass(frozen=True)
class SendPage:
    items: tuple[SendRecord, ...]
    total: int


@dataclass(frozen=True)
class SenderSummary:
    sender_id: str
    sender_email: str | None
    messages: int
    recipients: int
    failed: int
    last_sent_at: datetime


class SendLogRepository(Protocol):
    """Журнал отправок: кто, когда, сколько и кому. Адреса получателей — PII, в логи не пишем."""

    def record_send(self, new: NewSend) -> SendRecord: ...

    def list_sends(self, page: int, limit: int, flt: SendFilter) -> SendPage: ...

    def summarize_senders(self, flt: SendFilter) -> tuple[SenderSummary, ...]: ...


class Repository(
    UserRepository,
    AudienceRepository,
    GroupRepository,
    TemplateRepository,
    SendLogRepository,
    Protocol,
):
    """Полное хранилище приложения."""
