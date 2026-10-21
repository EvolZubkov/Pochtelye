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


class Repository(Protocol):
    """Хранилище скрыто за интерфейсом: SQLite локально, PostgreSQL в проде."""

    def get_user(self, sub: str) -> User | None: ...

    def ensure_user(self, sub: str, default_role: Role = Role.VIEWER) -> User:
        """Возвращает пользователя, создавая запись при первом входе."""
        ...

    def set_role(self, sub: str, role: Role) -> User | None: ...

    def delete_user(self, sub: str) -> bool:
        """Мягкое удаление (deleted_at). False, если пользователя нет."""
        ...
