"""Итоговые настройки приложения пользователя: аудитория + группа.

- Аудитория задаёт вид и ограничения редактора (профиль: блоки, отступы, возможности).
- Группа внутри аудитории уточняет функции (features перекрывают профиль) и задаёт, какие
  категории общих шаблонов человек видит.
- Администратор ограничений по категориям не имеет.

Все проверки доступа (редактор, API шаблонов, позже отправка) берут настройки отсюда,
чтобы правила не расходились.
"""

from dataclasses import dataclass
from typing import Any

from fastapi import Depends

from app.config import Settings
from app.deps import get_current_user, get_repository, get_settings
from app.editor_resources import load_editor_profile
from app.repository import Group, Repository, Role, User


@dataclass(frozen=True)
class Access:
    profile: dict[str, Any]
    group: Group | None
    shared_categories: frozenset[str] | None  # None: видны все общие шаблоны


def resolve_access(user: User, repository: Repository, settings: Settings) -> Access:
    group = repository.get_group(user.group_id) if user.group_id else None
    audience_id = group.audience_id if group else user.audience_id
    audience = repository.get_audience(audience_id) if audience_id else None
    audience = audience or repository.get_default_audience()
    profile = (
        dict(audience.profile)
        if audience is not None
        else load_editor_profile(settings.editor_profile, settings.resources_dir)
    )
    if group is not None and group.features:
        profile["features"] = {**(profile.get("features") or {}), **group.features}

    restricted = group is not None and group.categories is not None and user.role != Role.ADMIN
    categories = frozenset(group.categories) if restricted else None
    return Access(profile=profile, group=group, shared_categories=categories)


def get_access(
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> Access:
    return resolve_access(user, repository, settings)
