from tests.conftest import ADMIN_SUB, EDITOR_SUB


def _as(sub):
    return {"x-test-sub": sub}


def _create(client, email="new@rt.ru", **extra):
    return client.post("/api/admin/users", json={"email": email, **extra}, headers=_as(ADMIN_SUB))


def _my_id(client, sub):
    return client.get("/api/me", headers=_as(sub)).json()["data"]["id"]


def test_non_admin_cannot_use_admin_api(multi_client):
    for path in ("/api/admin/users", "/api/admin/audiences"):
        response = multi_client.get(path, headers=_as(EDITOR_SUB))
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "forbidden"


def test_admin_creates_invited_user_and_gets_one_time_code(multi_client):
    response = _create(multi_client, "Ivan@RT.ru", displayName="Иван", role="viewer")

    data = response.json()["data"]
    assert response.status_code == 201
    assert data["user"]["email"] == "ivan@rt.ru"
    assert data["user"]["status"] == "invited"
    assert data["user"]["role"] == "viewer"
    assert len(data["inviteCode"]) == 19  # XXXX-XXXX-XXXX-XXXX


def test_invite_code_is_not_stored_or_listed(multi_client):
    code = _create(multi_client).json()["data"]["inviteCode"]

    listing = multi_client.get("/api/admin/users", headers=_as(ADMIN_SUB)).text

    assert code not in listing
    assert "inviteHash" not in listing


def test_create_rejects_duplicate_and_bad_email(multi_client):
    assert _create(multi_client, "dup@rt.ru").status_code == 201

    duplicate = _create(multi_client, "DUP@rt.ru")
    bad = _create(multi_client, "not-an-email")

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "email_taken"
    assert bad.status_code == 422


def test_create_with_unknown_audience_is_rejected(multi_client):
    response = _create(multi_client, audienceId="nope")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "audience_not_found"


def test_list_users_has_pagination_meta_and_search(multi_client):
    _create(multi_client, "findme@rt.ru")

    body = multi_client.get(
        "/api/admin/users?search=findme&limit=10", headers=_as(ADMIN_SUB)
    ).json()

    assert [u["email"] for u in body["data"]] == ["findme@rt.ru"]
    assert body["meta"] == {"total": 1, "page": 1, "limit": 10}


def test_update_user_role_and_audience(multi_client):
    audiences = multi_client.get("/api/admin/audiences", headers=_as(ADMIN_SUB)).json()["data"]
    audience_id = audiences[0]["id"]
    user_id = _create(multi_client).json()["data"]["user"]["id"]

    response = multi_client.patch(
        f"/api/admin/users/{user_id}",
        json={"role": "admin", "audienceId": audience_id, "displayName": "Анна"},
        headers=_as(ADMIN_SUB),
    )

    data = response.json()["data"]
    assert (data["role"], data["audienceId"], data["displayName"]) == ("admin", audience_id, "Анна")


def test_admin_cannot_demote_or_delete_self(multi_client):
    admin_id = _my_id(multi_client, ADMIN_SUB)

    demote = multi_client.patch(
        f"/api/admin/users/{admin_id}", json={"role": "viewer"}, headers=_as(ADMIN_SUB)
    )
    delete = multi_client.delete(f"/api/admin/users/{admin_id}", headers=_as(ADMIN_SUB))

    assert demote.status_code == 409
    assert delete.status_code == 409
    assert demote.json()["error"]["code"] == "cannot_modify_self"


def test_update_and_delete_unknown_user_is_404(multi_client):
    patch = multi_client.patch(
        "/api/admin/users/nope", json={"role": "viewer"}, headers=_as(ADMIN_SUB)
    )
    delete = multi_client.delete("/api/admin/users/nope", headers=_as(ADMIN_SUB))

    assert patch.status_code == 404
    assert delete.status_code == 404


def test_update_email_conflict_is_409(multi_client):
    _create(multi_client, "one@rt.ru")
    other = _create(multi_client, "two@rt.ru").json()["data"]["user"]["id"]

    response = multi_client.patch(
        f"/api/admin/users/{other}", json={"email": "one@rt.ru"}, headers=_as(ADMIN_SUB)
    )

    assert response.status_code == 409


def test_deleted_user_loses_access(multi_client):
    editor_id = _my_id(multi_client, EDITOR_SUB)

    deleted = multi_client.delete(f"/api/admin/users/{editor_id}", headers=_as(ADMIN_SUB))
    after = multi_client.get("/api/me", headers=_as(EDITOR_SUB))

    assert deleted.status_code == 200
    assert after.status_code == 403
    assert after.json()["error"]["code"] == "not_activated"


def test_reissue_invite_changes_code_only_for_invited(multi_client):
    created = _create(multi_client).json()["data"]
    user_id = created["user"]["id"]
    editor_id = _my_id(multi_client, EDITOR_SUB)

    again = multi_client.post(f"/api/admin/users/{user_id}/invite", headers=_as(ADMIN_SUB))
    active = multi_client.post(f"/api/admin/users/{editor_id}/invite", headers=_as(ADMIN_SUB))
    unknown = multi_client.post("/api/admin/users/nope/invite", headers=_as(ADMIN_SUB))

    assert again.json()["data"]["inviteCode"] != created["inviteCode"]
    assert active.status_code == 409
    assert unknown.status_code == 404


def test_null_role_or_email_is_ignored_not_a_server_error(multi_client):
    user_id = _create(multi_client).json()["data"]["user"]["id"]

    response = multi_client.patch(
        f"/api/admin/users/{user_id}",
        json={"role": None, "email": None, "displayName": "Имя"},
        headers=_as(ADMIN_SUB),
    )

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["role"] == "editor"
    assert data["email"] == "new@rt.ru"
    assert data["displayName"] == "Имя"
