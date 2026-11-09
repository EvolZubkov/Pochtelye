from datetime import UTC, datetime, timedelta

from fastapi import Depends, Request

from app.config import Settings
from app.errors import AppError
from app.identity import Identity, IdentityProvider
from app.ratelimit import FailureLimiter
from app.repository import Repository, Role, User

LAST_SEEN_REFRESH = timedelta(minutes=5)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_identity_provider(request: Request) -> IdentityProvider:
    return request.app.state.identity_provider


def get_activation_limiter(request: Request) -> FailureLimiter:
    return request.app.state.activation_limiter


def get_identity(
    request: Request, provider: IdentityProvider = Depends(get_identity_provider)
) -> Identity:
    return provider.identify(request)


def get_current_user(
    identity: Identity = Depends(get_identity),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> User:
    """Пользователя заводит админ; чужой sub без приглашения доступа не получает."""
    if settings.is_admin_sub(identity.sub):
        user = repository.ensure_admin(identity.sub)
    else:
        user = repository.get_user_by_sub(identity.sub)
        if user is None and identity.verified and identity.login:
            user = repository.claim_by_email(
                identity.login, identity.sub, identity.name, datetime.now(UTC)
            )
    if user is None:
        raise AppError("not_activated", "Доступ не активирован: нужен код приглашения", 403)

    now = datetime.now(UTC)
    if user.last_seen_at is None or now - user.last_seen_at > LAST_SEEN_REFRESH:
        repository.touch_last_seen(user.id, now)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.ADMIN:
        raise AppError("forbidden", "Недостаточно прав", 403)
    return user
