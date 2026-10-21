from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol


class Role(StrEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


@dataclass(frozen=True)
class User:
    sub: str
    role: Role
    display_name: str | None
    email: str | None
    created_at: datetime


class UserRepository(Protocol):
    """Хранилище скрыто за интерфейсом: SQLite локально, PostgreSQL в проде."""

    def get_user(self, sub: str) -> User | None: ...

    def ensure_user(self, sub: str, default_role: Role = Role.VIEWER) -> User:
        """Возвращает пользователя, создавая запись при первом входе."""
        ...

    def set_role(self, sub: str, role: Role) -> User | None: ...

    def delete_user(self, sub: str) -> bool:
        """Мягкое удаление (deleted_at). False, если пользователя нет."""
        ...


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
        self, viewer_sub: str, page: int, limit: int, scope: TemplateScope | None = None
    ) -> TemplatePage:
        """Общие шаблоны и личные шаблоны viewer_sub; чужие личные не видны."""
        ...

    def get_template(self, template_id: str) -> Template | None: ...

    def create_template(self, new: NewTemplate) -> Template: ...

    def update_template(self, template_id: str, changes: dict) -> Template | None:
        """changes: name, category, blocks, preview. Прочие ключи игнорируются."""
        ...

    def delete_template(self, template_id: str) -> bool:
        """Мягкое удаление (deleted_at)."""
        ...


class Repository(UserRepository, TemplateRepository, Protocol):
    """Полное хранилище приложения: пользователи и шаблоны."""
