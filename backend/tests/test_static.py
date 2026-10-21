from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.platform import StubPlatformClient


def _client(repository, static_dir):
    settings = Settings(env="dev", database_url="sqlite:///:memory:", static_dir=static_dir)
    app = create_app(settings, repository=repository, platform_client=StubPlatformClient())
    return TestClient(app)


def test_serves_frontend_and_keeps_api(repository, tmp_path):
    (tmp_path / "index.html").write_text("<h1>Почтелье</h1>", encoding="utf-8")

    with _client(repository, str(tmp_path)) as client:
        assert "Почтелье" in client.get("/").text
        assert client.get("/api/health").json()["data"]["status"] == "ok"


def test_skips_static_when_directory_missing(repository, tmp_path):
    with _client(repository, str(tmp_path / "nope")) as client:
        assert client.get("/").status_code == 404
