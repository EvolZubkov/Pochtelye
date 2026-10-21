import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.editor_resources import RESOURCE_DIRS, load_editor_profile
from app.errors import register_error_handlers
from app.identity import DevIdentityProvider, IdentityProvider, PlatformJwtProvider
from app.logging_setup import RequestIdMiddleware, configure_logging
from app.migrate import upgrade_database
from app.platform import HttpPlatformClient, PlatformClient, PodStatus, StubPlatformClient
from app.ratelimit import FailureLimiter
from app.repository import Repository, SqlRepository
from app.repository.sql import make_engine
from app.routes import router
from app.routes_admin import router as admin_router
from app.routes_editor import router as editor_router
from app.routes_templates import router as templates_router


def _ensure_default_audience(repository: Repository, settings: Settings) -> None:
    """При первом запуске создаёт аудиторию по умолчанию из встроенного профиля."""
    if repository.get_default_audience() is None:
        profile = load_editor_profile(settings.editor_profile, settings.resources_dir)
        repository.create_audience("По умолчанию", profile, is_default=True)


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
    _ensure_default_audience(repository, settings)
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
    app.state.activation_limiter = FailureLimiter()
    app.state.identity_provider = identity_provider or _build_identity_provider(settings)
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    app.include_router(router)
    app.include_router(templates_router)
    app.include_router(admin_router)
    app.include_router(editor_router)
    _mount_resources(app, settings.resources_dir)
    _mount_static(app, settings.static_dir)
    return app


def _mount_resources(app: FastAPI, resources_dir: str | None) -> None:
    # Картинки редактора раздаются от корня сайта, поэтому монтируются до фронтенда.
    if not resources_dir:
        return
    for name in RESOURCE_DIRS:
        directory = Path(resources_dir) / name
        if directory.is_dir():
            app.mount(f"/{name}", StaticFiles(directory=directory), name=f"resources-{name}")


def _mount_static(app: FastAPI, static_dir: str | None) -> None:
    # Монтируем после API-роутов, иначе "/" перехватит /api/*.
    if static_dir and Path(static_dir).is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
