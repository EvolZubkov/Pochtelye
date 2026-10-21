import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import Settings
from app.errors import register_error_handlers
from app.identity import DevIdentityProvider, IdentityProvider, PlatformJwtProvider
from app.logging_setup import RequestIdMiddleware, configure_logging
from app.migrate import upgrade_database
from app.platform import HttpPlatformClient, PlatformClient, PodStatus, StubPlatformClient
from app.repository import Repository, SqlRepository
from app.repository.sql import make_engine
from app.routes import router


def _build_platform_client(settings: Settings) -> PlatformClient:
    if settings.py_platform_send_status:
        return HttpPlatformClient(
            settings.py_platform_send_status, os.environ.get("PY_PLATFORM_JWT")
        )
    return StubPlatformClient()


def _build_identity_provider(settings: Settings) -> IdentityProvider:
    if settings.is_dev:
        return DevIdentityProvider(settings.dev_user_sub)
    return PlatformJwtProvider()


def create_app(
    settings: Settings | None = None,
    repository: Repository | None = None,
    identity_provider: IdentityProvider | None = None,
    platform_client: PlatformClient | None = None,
) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)

    if repository is None:
        upgrade_database(settings.database_url)
        repository = SqlRepository(make_engine(settings.database_url))
    platform_client = platform_client or _build_platform_client(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await platform_client.send_status(PodStatus.CREATING)
        await platform_client.send_status(PodStatus.RUNNING)
        yield
        await platform_client.send_status(PodStatus.TERMINATING)

    app = FastAPI(title="Почтелье v3", lifespan=lifespan)
    app.state.settings = settings
    app.state.repository = repository
    app.state.identity_provider = identity_provider or _build_identity_provider(settings)
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    app.include_router(router)
    return app
