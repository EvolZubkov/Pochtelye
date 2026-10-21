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
