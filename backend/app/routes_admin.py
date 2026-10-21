"""Админ-панель: пользователи, аудитории, журнал отправок. Все маршруты только для роли admin."""

import re
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import Field, field_validator

from app import invites
from app.deps import get_repository, require_admin
from app.envelope import CamelModel, Envelope, ok
from app.errors import AppError
from app.profile_schema import validate_profile
from app.repository import (
    Audience,
    DuplicateEmailError,
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
    status: str
    created_at: str
    last_seen_at: str | None
    invite_expires_at: str | None


class UserCreate(CamelModel):
    email: str
    display_name: str | None = Field(default=None, max_length=255)
    role: Role = Role.EDITOR
    audience_id: str | None = None

    _email = field_validator("email")(_check_email)


class UserUpdate(CamelModel):
    email: str | None = None
    display_name: str | None = Field(default=None, max_length=255)
    role: Role | None = None
    audience_id: str | None = None

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
        status=user.status.value,
        created_at=user.created_at.isoformat(),
        last_seen_at=_iso(user.last_seen_at),
        invite_expires_at=_iso(user.invite_expires_at),
    ).model_dump(by_alias=True, mode="json")


def _require_audience(repository: Repository, audience_id: str | None) -> None:
    if audience_id is not None and repository.get_audience(audience_id) is None:
        raise AppError("audience_not_found", "Аудитория не найдена", 400)


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
    try:
        created = repository.create_user(
            NewUser(
                email=body.email,
                role=body.role,
                display_name=body.display_name,
                audience_id=body.audience_id,
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
    if repository.count_users_by_audience(audience_id) > 0:
        raise AppError("audience_in_use", "Аудитория назначена пользователям", 409)
    repository.delete_audience(audience_id)
    return ok({"id": audience_id})


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
