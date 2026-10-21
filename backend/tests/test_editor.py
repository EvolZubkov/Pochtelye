import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.editor_resources import load_editor_config, load_editor_profile
from app.main import create_app
from app.platform import StubPlatformClient


@pytest.fixture
def resources(tmp_path):
    (tmp_path / "icons").mkdir()
    (tmp_path / "icons" / "star.png").write_bytes(b"png")
    config = {
        "version": "1.0",
        "icons": {
            "important": [
                {"id": "i1", "src": "icons/star.png"},
                {"id": "i2", "src": "icons/missing.png"},
                {"id": "i3", "src": "../outside.png"},
            ]
        },
        "bullets": [{"id": "b1", "src": "bullets/gone.png"}],
    }
    (tmp_path / "config.json").write_text(json.dumps(config), encoding="utf-8")
    return tmp_path


def _client(repository, resources_dir):
    settings = Settings(
        env="dev", database_url="sqlite:///:memory:", resources_dir=str(resources_dir)
    )
    app = create_app(settings, repository=repository, platform_client=StubPlatformClient())
    return TestClient(app)


def test_config_prunes_entries_with_missing_files(resources):
    config = load_editor_config(str(resources))

    assert [i["id"] for i in config["icons"]["important"]] == ["i1"]
    assert config["bullets"] == []


def test_config_without_resources_dir_is_empty_with_features():
    config = load_editor_config(None)

    assert config["features"] == {"bulk_mail": False, "exchange_send": False}
    assert config["icons"] == {}


def test_config_with_broken_json_falls_back_to_empty(tmp_path):
    (tmp_path / "config.json").write_text("{not json", encoding="utf-8")

    assert load_editor_config(str(tmp_path))["icons"] == {}


def test_profile_prefers_resources_dir_over_bundled(tmp_path):
    (tmp_path / "profiles").mkdir()
    (tmp_path / "profiles" / "custom.json").write_text('{"name": "Свой"}', encoding="utf-8")

    assert load_editor_profile("custom", str(tmp_path))["name"] == "Свой"


def test_profile_falls_back_to_bundled_default():
    assert load_editor_profile("unknown", None)["blocks"]["text"]["enabled"] is True


def test_editor_endpoints_return_envelope(repository, resources):
    with _client(repository, resources) as client:
        config = client.get("/api/editor/config").json()
        profile = client.get("/api/editor/profile").json()

    assert config["error"] is None
    assert config["data"]["icons"]["important"][0]["src"] == "icons/star.png"
    assert "blocks" in profile["data"]


def test_resources_are_served_from_site_root(repository, resources):
    with _client(repository, resources) as client:
        assert client.get("/icons/star.png").content == b"png"
        assert client.get("/icons/missing.png").status_code == 404
        assert client.get("/icons/../config.json").status_code in (400, 404)
