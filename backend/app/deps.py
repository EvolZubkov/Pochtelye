from fastapi import Depends, Request

from app.config import Settings
from app.identity import Identity, IdentityProvider
from app.repository import Repository, Role, User


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_identity_provider(request: Request) -> IdentityProvider:
    return request.app.state.identity_provider


def get_identity(
    request: Request, provider: IdentityProvider = Depends(get_identity_provider)
) -> Identity:
    return provider.identify(request)


def get_current_user(
    identity: Identity = Depends(get_identity),
    repository: Repository = Depends(get_repository),
) -> User:
    return repository.ensure_user(identity.sub, Role.VIEWER)
