from tests.conftest import ADMIN_SUB, EDITOR_SUB, OTHER_EDITOR_SUB


def _as(sub):
    return {"x-test-sub": sub}


def _audience(client, name="HR", **profile):
    base = {"name": name, "blocks": {"text": {"enabled": True}}}
    body = {"name": name, "profile": {**base, **profile}}
    response = client.post("/api/admin/audiences", json=body, headers=_as(ADMIN_SUB))
    return response.json()["data"]["id"]


def _group(client, audience_id, name="Рассылки", **extra):
    return client.post(
        "/api/admin/groups",
        json={"audienceId": audience_id, "name": name, **extra},
        headers=_as(ADMIN_SUB),
    )


def _user_id(client, email):
    users = client.get("/api/admin/users", headers=_as(ADMIN_SUB)).json()["data"]
    return next(u["id"] for u in users if u["email"] == email)


def _assign(client, email, group_id):
    return client.patch(
        f"/api/admin/users/{_user_id(client, email)}",
        json={"groupId": group_id},
        headers=_as(ADMIN_SUB),
    )


def _shared_template(client, name, category):
    response = client.post(
        "/api/templates",
        json={"name": name, "category": category, "scope": "shared"},
        headers=_as(ADMIN_SUB),
    )
    return response.json()["data"]["id"]


def _visible_names(client, sub):
    response = client.get("/api/templates", headers=_as(sub))
    return sorted(t["name"] for t in response.json()["data"])


def test_create_group_returns_dto_with_defaults(multi_client):
    audience_id = _audience(multi_client)

    response = _group(multi_client, audience_id, features={"bulk_mail": True})

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["audienceId"] == audience_id
    assert data["features"] == {"bulk_mail": True}
    assert data["categories"] is None
    assert data["limits"] == {}
    assert data["userCount"] == 0


def test_group_requires_existing_audience(multi_client):
    response = _group(multi_client, "no-such-audience")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "audience_not_found"


def test_group_endpoints_are_admin_only(multi_client):
    response = multi_client.get("/api/admin/groups", headers=_as(EDITOR_SUB))

    assert response.status_code == 403


def test_group_rejects_bad_limits_and_features(multi_client):
    audience_id = _audience(multi_client)

    bad_limit = _group(multi_client, audience_id, limits={"perDay": -1})
    bad_feature = _group(multi_client, audience_id, features={"bulk_mail": "yes"})

    assert bad_limit.status_code == 422
    assert bad_feature.status_code == 422


def test_update_group_changes_fields(multi_client):
    audience_id = _audience(multi_client)
    group_id = _group(multi_client, audience_id).json()["data"]["id"]

    response = multi_client.patch(
        f"/api/admin/groups/{group_id}",
        json={"name": "Базовые", "categories": ["Тема 1"], "limits": {"perDay": 20}},
        headers=_as(ADMIN_SUB),
    )

    data = response.json()["data"]
    assert (data["name"], data["categories"], data["limits"]) == (
        "Базовые",
        ["Тема 1"],
        {"perDay": 20},
    )


def test_update_unknown_group_is_404(multi_client):
    response = multi_client.patch(
        "/api/admin/groups/nope", json={"name": "X"}, headers=_as(ADMIN_SUB)
    )

    assert response.status_code == 404


def test_assign_user_to_group_and_count(multi_client):
    group_id = _group(multi_client, _audience(multi_client)).json()["data"]["id"]

    response = _assign(multi_client, "editor1@rt.ru", group_id)

    assert response.json()["data"]["groupId"] == group_id
    groups = multi_client.get("/api/admin/groups", headers=_as(ADMIN_SUB)).json()["data"]
    assert groups[0]["userCount"] == 1


def test_assign_unknown_group_is_rejected(multi_client):
    response = _assign(multi_client, "editor1@rt.ru", "nope")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "group_not_found"


def test_group_in_use_cannot_be_deleted_until_emptied(multi_client):
    group_id = _group(multi_client, _audience(multi_client)).json()["data"]["id"]
    _assign(multi_client, "editor1@rt.ru", group_id)

    busy = multi_client.delete(f"/api/admin/groups/{group_id}", headers=_as(ADMIN_SUB))
    _assign(multi_client, "editor1@rt.ru", None)
    free = multi_client.delete(f"/api/admin/groups/{group_id}", headers=_as(ADMIN_SUB))

    assert busy.status_code == 409
    assert busy.json()["error"]["code"] == "group_in_use"
    assert free.status_code == 200


def test_audience_with_groups_cannot_be_deleted(multi_client):
    audience_id = _audience(multi_client)
    _group(multi_client, audience_id)

    response = multi_client.delete(f"/api/admin/audiences/{audience_id}", headers=_as(ADMIN_SUB))

    assert response.status_code == 409


def test_editor_profile_follows_group_audience_and_features(multi_client):
    audience_id = _audience(multi_client, name="B2C", contentPadding=24)
    group_id = _group(
        multi_client, audience_id, features={"bulk_mail": True, "exchange_send": False}
    ).json()["data"]["id"]
    _assign(multi_client, "editor1@rt.ru", group_id)

    mine = multi_client.get("/api/editor/profile", headers=_as(EDITOR_SUB)).json()["data"]
    other = multi_client.get("/api/editor/profile", headers=_as(OTHER_EDITOR_SUB)).json()["data"]

    assert mine["name"] == "B2C"
    assert mine["contentPadding"] == 24
    assert mine["features"] == {"bulk_mail": True, "exchange_send": False}
    assert other["name"] != "B2C"


def test_group_features_override_audience_features(multi_client):
    audience_id = _audience(multi_client, features={"bulk_mail": True, "exchange_send": True})
    group_id = _group(multi_client, audience_id, features={"bulk_mail": False}).json()["data"]["id"]
    _assign(multi_client, "editor1@rt.ru", group_id)

    mine = multi_client.get("/api/editor/profile", headers=_as(EDITOR_SUB)).json()["data"]

    assert mine["features"] == {"bulk_mail": False, "exchange_send": True}


def test_shared_templates_are_filtered_by_group_categories(multi_client):
    _shared_template(multi_client, "Письмо 1", "Тема 1")
    _shared_template(multi_client, "Письмо 2", "Тема 2")
    group_id = _group(multi_client, _audience(multi_client), categories=["Тема 1"]).json()["data"][
        "id"
    ]
    _assign(multi_client, "editor1@rt.ru", group_id)

    restricted = _visible_names(multi_client, EDITOR_SUB)
    unrestricted = _visible_names(multi_client, OTHER_EDITOR_SUB)
    admin = _visible_names(multi_client, ADMIN_SUB)

    assert restricted == ["Письмо 1"]
    assert unrestricted == ["Письмо 1", "Письмо 2"]
    assert admin == ["Письмо 1", "Письмо 2"]


def test_hidden_shared_template_is_not_found_by_id(multi_client):
    hidden_id = _shared_template(multi_client, "Письмо 2", "Тема 2")
    group_id = _group(multi_client, _audience(multi_client), categories=["Тема 1"]).json()["data"][
        "id"
    ]
    _assign(multi_client, "editor1@rt.ru", group_id)

    response = multi_client.get(f"/api/templates/{hidden_id}", headers=_as(EDITOR_SUB))

    assert response.status_code == 404


def test_personal_templates_ignore_group_categories(multi_client):
    group_id = _group(multi_client, _audience(multi_client), categories=[]).json()["data"]["id"]
    _assign(multi_client, "editor1@rt.ru", group_id)
    multi_client.post(
        "/api/templates",
        json={"name": "Моё", "category": "Тема 9"},
        headers=_as(EDITOR_SUB),
    )

    assert _visible_names(multi_client, EDITOR_SUB) == ["Моё"]
