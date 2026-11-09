"""Админ-панель: пользователи, аудитории, журнал отправок. Все маршруты только для роли admin."""

import re
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import Field, StrictBool, StrictInt, field_validator

from app import invites
from app.deps import get_repository, require_admin
from app.envelope import CamelModel, Envelope, ok
from app.errors import AppError
from app.profile_schema import validate_profile
from app.repository import (
    Audience,
    DuplicateEmailError,
    Group,
    NewGroup,
    NewUser,
    Repository,
    Role,
    SendFilter,
    SendRecord,
    User,
)

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_EMAIL_LENGTH = 255

Page = Annotated[int, Query(ge=1)]
Limit = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _check_email(value: str) -> str:
    cleaned = value.strip().lower()
    if len(cleaned) > MAX_EMAIL_LENGTH or not EMAIL_PATTERN.match(cleaned):
        raise ValueError("некорректный email")
    return cleaned


# --- Пользователи -----------------------------------------------------------------


class UserDto(CamelModel):
    id: str
    sub: str | None
    email: str | None
    display_name: str | None
    role: Role
    audience_id: str | None
    group_id: str | None
    status: str
    created_at: str
    last_seen_at: str | None
    invite_expires_at: str | None


class UserCreate(CamelModel):
    email: str
    display_name: str | None = Field(default=None, max_length=255)
    role: Role = Role.EDITOR
    audience_id: str | None = None
    group_id: str | None = None

    _email = field_validator("email")(_check_email)


class UserUpdate(CamelModel):
    email: str | None = None
    display_name: str | None = Field(default=None, max_length=255)
    role: Role | None = None
    audience_id: str | None = None
    group_id: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str | None) -> str | None:
        return _check_email(value) if value is not None else None


def _user_dto(user: User) -> dict:
    return UserDto(
        id=user.id,
        sub=user.sub,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        audience_id=user.audience_id,
        group_id=user.group_id,
        status=user.status.value,
        created_at=user.created_at.isoformat(),
        last_seen_at=_iso(user.last_seen_at),
        invite_expires_at=_iso(user.invite_expires_at),
    ).model_dump(by_alias=True, mode="json")


def _require_audience(repository: Repository, audience_id: str | None) -> None:
    if audience_id is not None and repository.get_audience(audience_id) is None:
        raise AppError("audience_not_found", "Аудитория не найдена", 400)


def _group_audience(repository: Repository, group_id: str, audience_id: str | None) -> str:
    """Аудитория пользователя в группе всегда аудитория группы; расхождение это ошибка."""
    group = repository.get_group(group_id)
    if group is None:
        raise AppError("group_not_found", "Группа не найдена", 400)
    if audience_id is not None and audience_id != group.audience_id:
        raise AppError("group_audience_mismatch", "Группа относится к другой аудитории", 400)
    return group.audience_id


def _reconcile_group_audience(repository: Repository, user_id: str, changes: dict) -> None:
    """Правит changes так, чтобы аудитория пользователя совпадала с аудиторией его группы."""
    if changes.get("group_id") is not None:
        changes["audience_id"] = _group_audience(
            repository, changes["group_id"], changes.get("audience_id")
        )
        return
    if "audience_id" in changes and "group_id" not in changes:
        existing = repository.get_user(user_id)
        if existing is not None and existing.group_id:
            _group_audience(repository, existing.group_id, changes["audience_id"])


def _user_not_found() -> AppError:
    return AppError("user_not_found", "Пользователь не найден", 404)


def _duplicate_email() -> AppError:
    return AppError("email_taken", "Пользователь с такой почтой уже есть", 409)


def _issue_invite(repository: Repository, user_id: str) -> tuple[User, str]:
    code = invites.generate_code()
    user = repository.set_invite(
        user_id, invites.hash_code(code), invites.expires_at(datetime.now(UTC))
    )
    if user is None:
        raise _user_not_found()
    return user, code


@router.get("/users", response_model=Envelope)
def list_users(
    page: Page = 1,
    limit: Limit = DEFAULT_PAGE_SIZE,
    search: Annotated[str | None, Query(max_length=100)] = None,
    repository: Repository = Depends(get_repository),
) -> dict:
    result = repository.list_users(page, limit, search)
    meta = {"total": result.total, "page": page, "limit": limit}
    return ok([_user_dto(u) for u in result.items], meta)


@router.post("/users", response_model=Envelope, status_code=201)
def create_user(body: UserCreate, repository: Repository = Depends(get_repository)) -> dict:
    _require_audience(repository, body.audience_id)
    audience_id = body.audience_id
    if body.group_id is not None:
        audience_id = _group_audience(repository, body.group_id, body.audience_id)
    try:
        created = repository.create_user(
            NewUser(
                email=body.email,
                role=body.role,
                display_name=body.display_name,
                audience_id=audience_id,
                group_id=body.group_id,
            )
        )
    except DuplicateEmailError as exc:
        raise _duplicate_email() from exc
    user, code = _issue_invite(repository, created.id)
    return ok({"user": _user_dto(user), "inviteCode": code})


@router.patch("/users/{user_id}", response_model=Envelope)
def update_user(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    repository: Repository = Depends(get_repository),
) -> dict:
    changes = body.model_dump(exclude_unset=True)
    # Роль и почта обязательны: явный null означает «не менять», а не «очистить».
    for required in ("role", "email"):
        if changes.get(required, "") is None:
            changes.pop(required)
    if user_id == admin.id and changes.get("role", Role.ADMIN) != Role.ADMIN:
        raise AppError("cannot_modify_self", "Нельзя снять права администратора с себя", 409)
    _require_audience(repository, changes.get("audience_id"))
    _reconcile_group_audience(repository, user_id, changes)
    try:
        updated = repository.update_user(user_id, changes)
    except DuplicateEmailError as exc:
        raise _duplicate_email() from exc
    if updated is None:
        raise _user_not_found()
    return ok(_user_dto(updated))


@router.delete("/users/{user_id}", response_model=Envelope)
def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    repository: Repository = Depends(get_repository),
) -> dict:
    if user_id == admin.id:
        raise AppError("cannot_modify_self", "Нельзя удалить себя", 409)
    if not repository.delete_user(user_id):
        raise _user_not_found()
    return ok({"id": user_id})


@router.post("/users/{user_id}/invite", response_model=Envelope)
def reissue_invite(user_id: str, repository: Repository = Depends(get_repository)) -> dict:
    existing = repository.get_user(user_id)
    if existing is None:
        raise _user_not_found()
    if existing.sub:
        raise AppError("already_active", "Пользователь уже вошёл", 409)
    user, code = _issue_invite(repository, user_id)
    return ok({"user": _user_dto(user), "inviteCode": code})


# --- Аудитории --------------------------------------------------------------------


class AudienceDto(CamelModel):
    id: str
    name: str
    profile: dict[str, Any]
    is_default: bool
    user_count: int
    created_at: str
    updated_at: str


def _checked_profile(value: dict[str, Any]) -> dict[str, Any]:
    return validate_profile(value)


class AudienceCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    profile: dict[str, Any]
    is_default: bool = False

    _profile = field_validator("profile")(_checked_profile)


class AudienceUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    profile: dict[str, Any] | None = None
    is_default: bool | None = None

    @field_validator("profile")
    @classmethod
    def _valid_profile(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return validate_profile(value) if value is not None else None


def _audience_dto(audience: Audience, repository: Repository) -> dict:
    return AudienceDto(
        id=audience.id,
        name=audience.name,
        profile=audience.profile,
        is_default=audience.is_default,
        user_count=repository.count_users_by_audience(audience.id),
        created_at=audience.created_at.isoformat(),
        updated_at=audience.updated_at.isoformat(),
    ).model_dump(by_alias=True, mode="json")


def _audience_not_found() -> AppError:
    return AppError("audience_not_found", "Аудитория не найдена", 404)


@router.get("/audiences", response_model=Envelope)
def list_audiences(repository: Repository = Depends(get_repository)) -> dict:
    return ok([_audience_dto(a, repository) for a in repository.list_audiences()])


@router.post("/audiences", response_model=Envelope, status_code=201)
def create_audience(body: AudienceCreate, repository: Repository = Depends(get_repository)) -> dict:
    created = repository.create_audience(body.name, body.profile, body.is_default)
    return ok(_audience_dto(created, repository))


@router.patch("/audiences/{audience_id}", response_model=Envelope)
def update_audience(
    audience_id: str, body: AudienceUpdate, repository: Repository = Depends(get_repository)
) -> dict:
    existing = repository.get_audience(audience_id)
    if existing is None:
        raise _audience_not_found()
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if changes.get("is_default") is False and existing.is_default:
        raise AppError("default_required", "Сначала назначьте другую аудиторию по умолчанию", 409)
    updated = repository.update_audience(audience_id, changes)
    if updated is None:
        raise _audience_not_found()
    return ok(_audience_dto(updated, repository))


@router.delete("/audiences/{audience_id}", response_model=Envelope)
def delete_audience(audience_id: str, repository: Repository = Depends(get_repository)) -> dict:
    existing = repository.get_audience(audience_id)
    if existing is None:
        raise _audience_not_found()
    if existing.is_default:
        raise AppError("audience_is_default", "Нельзя удалить аудиторию по умолчанию", 409)
    if (
        repository.count_users_by_audience(audience_id) > 0
        or repository.count_groups_by_audience(audience_id) > 0
    ):
        raise AppError("audience_in_use", "Аудитория используется пользователями или группами", 409)
    repository.delete_audience(audience_id)
    return ok({"id": audience_id})


# --- Группы -----------------------------------------------------------------------

MAX_GROUP_KEYS = 30
MAX_CATEGORIES = 100
MAX_CATEGORY_LENGTH = 100
MAX_KEY_LENGTH = 40
MAX_LIMIT_VALUE = 1_000_000_000


def _checked_features(value: dict[str, StrictBool] | None) -> dict[str, StrictBool] | None:
    if value is not None and (
        len(value) > MAX_GROUP_KEYS or any(len(k) > MAX_KEY_LENGTH for k in value)
    ):
        raise ValueError("слишком много функций или слишком длинные имена")
    return value


def _checked_limits(value: dict[str, StrictInt] | None) -> dict[str, StrictInt] | None:
    if value is not None and (
        len(value) > MAX_GROUP_KEYS
        or any(len(k) > MAX_KEY_LENGTH or not 0 <= v <= MAX_LIMIT_VALUE for k, v in value.items())
    ):
        raise ValueError("некорректные лимиты")
    return value


def _checked_categories(value: list[str] | None) -> list[str] | None:
    if value is not None and (
        len(value) > MAX_CATEGORIES or any(len(c) > MAX_CATEGORY_LENGTH for c in value)
    ):
        raise ValueError("слишком много категорий или слишком длинные названия")
    return value


class GroupDto(CamelModel):
    id: str
    audience_id: str
    name: str
    features: dict[str, StrictBool]
    categories: list[str] | None
    limits: dict[str, StrictInt]
    user_count: int
    created_at: str
    updated_at: str


class GroupCreate(CamelModel):
    audience_id: str
    name: str = Field(min_length=1, max_length=100)
    features: dict[str, StrictBool] = Field(default_factory=dict)
    categories: list[str] | None = None
    limits: dict[str, StrictInt] = Field(default_factory=dict)

    _features = field_validator("features")(_checked_features)
    _limits = field_validator("limits")(_checked_limits)
    _categories = field_validator("categories")(_checked_categories)


class GroupUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    features: dict[str, StrictBool] | None = None
    categories: list[str] | None = None
    limits: dict[str, StrictInt] | None = None

    _features = field_validator("features")(_checked_features)
    _limits = field_validator("limits")(_checked_limits)
    _categories = field_validator("categories")(_checked_categories)


def _group_dto(group: Group, repository: Repository) -> dict:
    return GroupDto(
        id=group.id,
        audience_id=group.audience_id,
        name=group.name,
        features=group.features,
        categories=list(group.categories) if group.categories is not None else None,
        limits=group.limits,
        user_count=repository.count_users_by_group(group.id),
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat(),
    ).model_dump(by_alias=True, mode="json")


def _group_not_found() -> AppError:
    return AppError("group_not_found", "Группа не найдена", 404)


@router.get("/groups", response_model=Envelope)
def list_groups(repository: Repository = Depends(get_repository)) -> dict:
    return ok([_group_dto(g, repository) for g in repository.list_groups()])


@router.post("/groups", response_model=Envelope, status_code=201)
def create_group(body: GroupCreate, repository: Repository = Depends(get_repository)) -> dict:
    _require_audience(repository, body.audience_id)
    created = repository.create_group(
        NewGroup(
            audience_id=body.audience_id,
            name=body.name,
            features=body.features,
            categories=tuple(body.categories) if body.categories is not None else None,
            limits=body.limits,
        )
    )
    return ok(_group_dto(created, repository))


@router.patch("/groups/{group_id}", response_model=Envelope)
def update_group(
    group_id: str, body: GroupUpdate, repository: Repository = Depends(get_repository)
) -> dict:
    # Явный null у categories означает «видны все», у остальных полей «не менять».
    sent = body.model_dump(exclude_unset=True)
    changes = {k: v for k, v in sent.items() if v is not None or k == "categories"}
    updated = repository.update_group(group_id, changes)
    if updated is None:
        raise _group_not_found()
    return ok(_group_dto(updated, repository))


@router.delete("/groups/{group_id}", response_model=Envelope)
def delete_group(group_id: str, repository: Repository = Depends(get_repository)) -> dict:
    if repository.get_group(group_id) is None:
        raise _group_not_found()
    if repository.count_users_by_group(group_id) > 0:
        raise AppError("group_in_use", "В группе есть пользователи", 409)
    repository.delete_group(group_id)
    return ok({"id": group_id})


# --- Журнал отправок --------------------------------------------------------------


class SendRecordDto(CamelModel):
    id: str
    sender_id: str
    sender_email: str | None
    sent_at: str
    subject: str
    recipients: list[str]
    recipient_count: int
    status: str
    error_code: str | None
    template_id: str | None


class SenderSummaryDto(CamelModel):
    sender_id: str
    sender_email: str | None
    messages: int
    recipients: int
    failed: int
    last_sent_at: str


def _send_filter(
    sender_id: Annotated[str | None, Query(alias="senderId")] = None,
    date_from: Annotated[datetime | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[datetime | None, Query(alias="dateTo")] = None,
) -> SendFilter:
    return SendFilter(sender_id=sender_id, date_from=date_from, date_to=date_to)


def _record_dto(record: SendRecord) -> dict:
    return SendRecordDto(
        id=record.id,
        sender_id=record.sender_id,
        sender_email=record.sender_email,
        sent_at=record.sent_at.isoformat(),
        subject=record.subject,
        recipients=list(record.recipients),
        recipient_count=len(record.recipients),
        status=record.status.value,
        error_code=record.error_code,
        template_id=record.template_id,
    ).model_dump(by_alias=True, mode="json")


@router.get("/send-log", response_model=Envelope)
def list_sends(
    page: Page = 1,
    limit: Limit = DEFAULT_PAGE_SIZE,
    flt: SendFilter = Depends(_send_filter),
    repository: Repository = Depends(get_repository),
) -> dict:
    result = repository.list_sends(page, limit, flt)
    meta = {"total": result.total, "page": page, "limit": limit}
    return ok([_record_dto(r) for r in result.items], meta)


@router.get("/send-log/summary", response_model=Envelope)
def summarize_sends(
    flt: SendFilter = Depends(_send_filter), repository: Repository = Depends(get_repository)
) -> dict:
    rows = repository.summarize_senders(flt)
    return ok(
        [
            SenderSummaryDto(
                sender_id=r.sender_id,
                sender_email=r.sender_email,
                messages=r.messages,
                recipients=r.recipients,
                failed=r.failed,
                last_sent_at=r.last_sent_at.isoformat(),
            ).model_dump(by_alias=True, mode="json")
            for r in rows
        ]
    )
