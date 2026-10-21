from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import Field

from app import invites
from app.deps import (
    get_activation_limiter,
    get_current_user,
    get_identity,
    get_repository,
)
from app.envelope import CamelModel, Envelope, ok
from app.errors import AppError
from app.identity import Identity
from app.ratelimit import FailureLimiter
from app.repository import Repository, Role, User

router = APIRouter(prefix="/api")


class HealthDto(CamelModel):
    status: str


class MeDto(CamelModel):
    id: str
    sub: str | None
    email: str | None
    display_name: str | None
    role: Role
    audience_id: str | None


class ActivateRequest(CamelModel):
    code: str = Field(min_length=1, max_length=64)


def me_dto(user: User) -> dict:
    return MeDto(
        id=user.id,
        sub=user.sub,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        audience_id=user.audience_id,
    ).model_dump(by_alias=True, mode="json")


@router.get("/health", response_model=Envelope)
def health() -> dict:
    return ok(HealthDto(status="ok").model_dump(by_alias=True))


@router.get("/me", response_model=Envelope)
def me(user: User = Depends(get_current_user)) -> dict:
    return ok(me_dto(user))


@router.post("/me/activate", response_model=Envelope)
def activate(
    body: ActivateRequest,
    identity: Identity = Depends(get_identity),
    repository: Repository = Depends(get_repository),
    limiter: FailureLimiter = Depends(get_activation_limiter),
) -> dict:
    """Первый вход: человек вводит код приглашения, и запись привязывается к его sub."""
    if repository.get_user_by_sub(identity.sub) is not None:
        raise AppError("already_active", "Доступ уже активирован", 409)
    if limiter.is_blocked(identity.sub):
        raise AppError("too_many_attempts", "Слишком много попыток, попробуйте позже", 429)

    user = repository.claim_invite(invites.hash_code(body.code), identity.sub, datetime.now(UTC))
    if user is None:
        limiter.record_failure(identity.sub)
        raise AppError("invite_invalid", "Код приглашения неверен или истёк", 400)
    limiter.reset(identity.sub)
    return ok(me_dto(user))
