import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.identity import Identity
from app.main import create_app
from app.platform import StubPlatformClient
from app.repository import NewUser, Role, SqlRepository
from app.repository.sql import Base, make_engine

ADMIN_SUB = "admin-0000"
EDITOR_SUB = "editor-0001"
OTHER_EDITOR_SUB = "editor-0002"
VIEWER_SUB = "viewer-0003"


class HeaderIdentityProvider:
    """Тестовая идентичность: sub берётся из заголовка x-test-sub."""

    def identify(self, request):
        return Identity(sub=request.headers["x-test-sub"])


@pytest.fixture
def repository() -> SqlRepository:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return SqlRepository(engine)


@pytest.fixture
def platform() -> StubPlatformClient:
    return StubPlatformClient()


@pytest.fixture
def dev_client(repository, platform):
    settings = Settings(env="dev", database_url="sqlite:///:memory:", static_dir=None)
    app = create_app(settings, repository=repository, platform_client=platform)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def prod_client(repository, platform):
    settings = Settings(env="prod", database_url="sqlite:///:memory:", static_dir=None)
    app = create_app(settings, repository=repository, platform_client=platform)
    with TestClient(app) as client:
        yield client


def _user(repository, sub: str, role: Role, email: str):
    return repository.create_user(NewUser(email=email, role=role, sub=sub))


@pytest.fixture
def multi_app(repository, platform):
    settings = Settings(
        env="prod", database_url="sqlite:///:memory:", admin_subs=[ADMIN_SUB], static_dir=None
    )
    _user(repository, EDITOR_SUB, Role.EDITOR, "editor1@rt.ru")
    _user(repository, OTHER_EDITOR_SUB, Role.EDITOR, "editor2@rt.ru")
    _user(repository, VIEWER_SUB, Role.VIEWER, "viewer@rt.ru")
    return create_app(
        settings,
        repository=repository,
        platform_client=platform,
        identity_provider=HeaderIdentityProvider(),
    )


@pytest.fixture
def multi_client(multi_app):
    with TestClient(multi_app) as client:
        yield client
