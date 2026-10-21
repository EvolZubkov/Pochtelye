import pytest

from tests.conftest import ADMIN_SUB, EDITOR_SUB

PROFILE = {
    "name": "Для HR",
    "blocks": {
        "text": {"enabled": True, "capabilities": ["background"]},
        "expert": {"enabled": False, "capabilities": []},
    },
}


def _as(sub):
    return {"x-test-sub": sub}


def _list(client):
    return client.get("/api/admin/audiences", headers=_as(ADMIN_SUB)).json()["data"]


def _create(client, name="HR", profile=None, **extra):
    return client.post(
        "/api/admin/audiences",
        json={"name": name, "profile": profile or PROFILE, **extra},
        headers=_as(ADMIN_SUB),
    )


def test_default_audience_is_seeded_from_bundled_profile(multi_client):
    audiences = _list(multi_client)

    assert len(audiences) == 1
    assert audiences[0]["isDefault"] is True
    assert audiences[0]["profile"]["blocks"]["text"]["enabled"] is True


def test_create_audience_keeps_profile_and_counts_users(multi_client):
    created = _create(multi_client).json()["data"]

    assert created["name"] == "HR"
    assert created["isDefault"] is False
    assert created["userCount"] == 0
    assert created["profile"]["blocks"]["expert"]["enabled"] is False


def test_profile_extra_keys_are_preserved(multi_client):
    profile = {
        "blocks": {"text": {"enabled": True, "defaults": {"fontSize": 14}, "hidden": ["font"]}},
        "contentPadding": 20,
        "features": {"bulk_mail": True},
    }

    created = _create(multi_client, profile=profile).json()["data"]["profile"]

    assert created["blocks"]["text"]["defaults"] == {"fontSize": 14}
    assert created["contentPadding"] == 20
    assert created["features"] == {"bulk_mail": True}


@pytest.mark.parametrize(
    "profile",
    [
        {"blocks": {"text": {"enabled": "maybe"}}},
        {"blocks": {"x" * 41: {"enabled": True}}},
        {"blocks": {"text": {"capabilities": ["a"] * 11}}},
        {"contentPadding": 999},
        {"blocks": "no"},
    ],
)
def test_invalid_profile_is_rejected(multi_client, profile):
    response = _create(multi_client, profile=profile)

    assert response.status_code == 422


def test_setting_default_moves_the_flag(multi_client):
    new_id = _create(multi_client).json()["data"]["id"]

    multi_client.patch(
        f"/api/admin/audiences/{new_id}", json={"isDefault": True}, headers=_as(ADMIN_SUB)
    )

    assert [a["name"] for a in _list(multi_client) if a["isDefault"]] == ["HR"]


def test_cannot_unset_default_directly(multi_client):
    default_id = _list(multi_client)[0]["id"]

    response = multi_client.patch(
        f"/api/admin/audiences/{default_id}", json={"isDefault": False}, headers=_as(ADMIN_SUB)
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "default_required"


def test_update_name_and_profile(multi_client):
    audience_id = _create(multi_client).json()["data"]["id"]

    response = multi_client.patch(
        f"/api/admin/audiences/{audience_id}",
        json={"name": "HR 2", "profile": {"blocks": {}}},
        headers=_as(ADMIN_SUB),
    )

    assert response.json()["data"]["name"] == "HR 2"
    assert response.json()["data"]["profile"] == {"blocks": {}}


def test_delete_rules(multi_client):
    default_id = _list(multi_client)[0]["id"]
    used_id = _create(multi_client, "Used").json()["data"]["id"]
    free_id = _create(multi_client, "Free").json()["data"]["id"]
    multi_client.post(
        "/api/admin/users",
        json={"email": "u@rt.ru", "audienceId": used_id},
        headers=_as(ADMIN_SUB),
    )

    on_default = multi_client.delete(f"/api/admin/audiences/{default_id}", headers=_as(ADMIN_SUB))
    in_use = multi_client.delete(f"/api/admin/audiences/{used_id}", headers=_as(ADMIN_SUB))
    free = multi_client.delete(f"/api/admin/audiences/{free_id}", headers=_as(ADMIN_SUB))

    assert on_default.json()["error"]["code"] == "audience_is_default"
    assert in_use.json()["error"]["code"] == "audience_in_use"
    assert free.status_code == 200


def test_unknown_audience_is_404(multi_client):
    patch = multi_client.patch(
        "/api/admin/audiences/nope", json={"name": "x"}, headers=_as(ADMIN_SUB)
    )
    delete = multi_client.delete("/api/admin/audiences/nope", headers=_as(ADMIN_SUB))

    assert patch.status_code == 404
    assert delete.status_code == 404


def test_editor_profile_follows_user_audience(multi_client, repository):
    audience_id = _create(multi_client, profile=PROFILE).json()["data"]["id"]
    user = repository.get_user_by_sub(EDITOR_SUB)
    repository.update_user(user.id, {"audience_id": audience_id})

    own = multi_client.get("/api/editor/profile", headers=_as(EDITOR_SUB)).json()["data"]
    admin = multi_client.get("/api/editor/profile", headers=_as(ADMIN_SUB)).json()["data"]

    assert own["blocks"]["expert"]["enabled"] is False
    assert admin.get("name") != "Для HR"


def test_editor_config_features_come_from_audience_profile(multi_client, repository):
    profile = {"blocks": {}, "features": {"bulk_mail": True}}
    audience_id = _create(multi_client, profile=profile).json()["data"]["id"]
    repository.update_user(repository.get_user_by_sub(EDITOR_SUB).id, {"audience_id": audience_id})

    config = multi_client.get("/api/editor/config", headers=_as(EDITOR_SUB)).json()["data"]

    assert config["features"] == {"bulk_mail": True, "exchange_send": False}
