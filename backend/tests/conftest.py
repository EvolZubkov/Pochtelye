import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.platform import StubPlatformClient
from app.repository import SqlRepository
from app.repository.sql import Base, make_engine


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
    settings = Settings(env="dev", database_url="sqlite:///:memory:")
    app = create_app(settings, repository=repository, platform_client=platform)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def prod_client(repository, platform):
    settings = Settings(env="prod", database_url="sqlite:///:memory:")
    app = create_app(settings, repository=repository, platform_client=platform)
    with TestClient(app) as client:
        yield client


ADMIN_SUB = "admin-0000"
EDITOR_SUB = "editor-0001"
OTHER_EDITOR_SUB = "editor-0002"
VIEWER_SUB = "viewer-0003"


class HeaderIdentityProvider:
    """Тестовая идентичность: sub берётся из заголовка x-test-sub."""

    def identify(self, request):
        from app.identity import Identity

        return Identity(sub=request.headers["x-test-sub"])


@pytest.fixture
def multi_client(repository, platform):
    from app.repository import Role

    settings = Settings(env="prod", database_url="sqlite:///:memory:", admin_subs=[ADMIN_SUB])
    app = create_app(
        settings,
        repository=repository,
        platform_client=platform,
        identity_provider=HeaderIdentityProvider(),
    )
    repository.ensure_user(VIEWER_SUB, Role.VIEWER)
    with TestClient(app) as client:
        yield client
