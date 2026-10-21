from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.platform import StubPlatformClient


def test_app_migrates_database_on_startup(tmp_path):
    url = f"sqlite:///{tmp_path / 'app.sqlite3'}"
    app = create_app(Settings(env="dev", database_url=url), platform_client=StubPlatformClient())

    with TestClient(app) as client:
        response = client.get("/api/me")

    assert response.status_code == 200
    assert response.json()["data"]["role"] == "viewer"
