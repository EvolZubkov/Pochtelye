"""Правила доступа к шаблонам.

- viewer: читает общие шаблоны и свои личные, ничего не меняет.
- Группа может ограничить видимые категории общих шаблонов (см. access.py).
- editor: создаёт и меняет только свои личные шаблоны.
- admin: дополнительно управляет общими шаблонами и видит их все на запись.
"""

from app.errors import AppError
from app.repository import Role, TemplateScope, User
from app.repository.base import TemplateSummary

_CAN_CREATE_PERSONAL = {Role.EDITOR, Role.ADMIN}


def can_read_template(
    user: User,
    template: TemplateSummary,
    shared_categories: frozenset[str] | None = None,
) -> bool:
    if template.owner_sub == user.sub:
        return True
    if template.scope != TemplateScope.SHARED:
        return False
    return shared_categories is None or template.category in shared_categories


def can_create_template(user: User, scope: TemplateScope) -> bool:
    if scope == TemplateScope.SHARED:
        return user.role == Role.ADMIN
    return user.role in _CAN_CREATE_PERSONAL


def can_modify_template(user: User, template: TemplateSummary) -> bool:
    if template.scope == TemplateScope.SHARED:
        return user.role == Role.ADMIN
    return template.owner_sub == user.sub and user.role in _CAN_CREATE_PERSONAL


def require(allowed: bool, message: str = "Недостаточно прав") -> None:
    if not allowed:
        raise AppError("forbidden", message, 403)


def not_found() -> AppError:
    # Чужой личный шаблон неотличим от несуществующего: не раскрываем факт его наличия.
    return AppError("template_not_found", "Шаблон не найден", 404)
