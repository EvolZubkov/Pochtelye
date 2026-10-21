import pytest

from tests.conftest import ADMIN_SUB, EDITOR_SUB, OTHER_EDITOR_SUB, VIEWER_SUB

BLOCKS = [{"id": 1, "type": "text"}]


def _as(sub: str) -> dict:
    return {"x-test-sub": sub}


def _create(client, sub: str, **body):
    payload = {"name": "Шаблон", "blocks": BLOCKS, **body}
    return client.post("/api/templates", json=payload, headers=_as(sub))


def test_editor_creates_personal_template_in_camel_case(multi_client):
    response = _create(multi_client, EDITOR_SUB, category="HR")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["scope"] == "personal"
    assert data["ownerSub"] == EDITOR_SUB
    assert data["blocks"] == BLOCKS
    assert "createdAt" in data


def test_viewer_cannot_create(multi_client):
    response = _create(multi_client, VIEWER_SUB)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_only_admin_creates_shared(multi_client):
    assert _create(multi_client, EDITOR_SUB, scope="shared").status_code == 403
    assert _create(multi_client, ADMIN_SUB, scope="shared").status_code == 201


def test_personal_template_is_hidden_from_others(multi_client):
    template_id = _create(multi_client, EDITOR_SUB).json()["data"]["id"]

    other = multi_client.get(f"/api/templates/{template_id}", headers=_as(OTHER_EDITOR_SUB))
    owner = multi_client.get(f"/api/templates/{template_id}", headers=_as(EDITOR_SUB))

    assert other.status_code == 404
    assert other.json()["error"]["code"] == "template_not_found"
    assert owner.status_code == 200


def test_list_shows_shared_and_own_with_pagination_meta(multi_client):
    _create(multi_client, ADMIN_SUB, scope="shared", name="Общий")
    _create(multi_client, EDITOR_SUB, name="Мой")
    _create(multi_client, OTHER_EDITOR_SUB, name="Чужой")

    body = multi_client.get("/api/templates", headers=_as(EDITOR_SUB)).json()

    assert [t["name"] for t in body["data"]] == ["Мой", "Общий"]
    assert body["meta"] == {"total": 2, "page": 1, "limit": 50}
    assert "blocks" not in body["data"][0]


def test_list_filters_by_scope_and_paginates(multi_client):
    for i in range(3):
        _create(multi_client, EDITOR_SUB, name=f"T{i}")
    _create(multi_client, ADMIN_SUB, scope="shared", name="S")

    page = multi_client.get(
        "/api/templates?scope=personal&limit=2&page=2", headers=_as(EDITOR_SUB)
    ).json()

    assert [t["name"] for t in page["data"]] == ["T2"]
    assert page["meta"]["total"] == 3


def test_owner_updates_only_given_fields(multi_client):
    template_id = _create(multi_client, EDITOR_SUB, category="HR").json()["data"]["id"]

    response = multi_client.patch(
        f"/api/templates/{template_id}", json={"name": "Новое"}, headers=_as(EDITOR_SUB)
    )

    data = response.json()["data"]
    assert data["name"] == "Новое"
    assert data["category"] == "HR"
    assert data["blocks"] == BLOCKS


def test_editor_cannot_modify_shared(multi_client):
    template_id = _create(multi_client, ADMIN_SUB, scope="shared").json()["data"]["id"]

    patch = multi_client.patch(
        f"/api/templates/{template_id}", json={"name": "x"}, headers=_as(EDITOR_SUB)
    )
    delete = multi_client.delete(f"/api/templates/{template_id}", headers=_as(EDITOR_SUB))

    assert patch.status_code == 403
    assert delete.status_code == 403


def test_admin_modifies_shared_but_not_foreign_personal(multi_client):
    shared_id = _create(multi_client, ADMIN_SUB, scope="shared").json()["data"]["id"]
    personal_id = _create(multi_client, EDITOR_SUB).json()["data"]["id"]

    shared = multi_client.patch(
        f"/api/templates/{shared_id}", json={"name": "y"}, headers=_as(ADMIN_SUB)
    )
    foreign = multi_client.patch(
        f"/api/templates/{personal_id}", json={"name": "y"}, headers=_as(ADMIN_SUB)
    )

    assert shared.status_code == 200
    assert foreign.status_code == 404


def test_delete_is_soft_and_removes_from_list(multi_client):
    template_id = _create(multi_client, EDITOR_SUB).json()["data"]["id"]

    deleted = multi_client.delete(f"/api/templates/{template_id}", headers=_as(EDITOR_SUB))
    again = multi_client.get(f"/api/templates/{template_id}", headers=_as(EDITOR_SUB))

    assert deleted.json()["data"] == {"id": template_id}
    assert again.status_code == 404
    assert multi_client.get("/api/templates", headers=_as(EDITOR_SUB)).json()["meta"]["total"] == 0


@pytest.mark.parametrize(
    "body",
    [
        {"name": ""},
        {"name": "x" * 201},
        {"name": "ok", "scope": "weird"},
        {"name": "ok", "blocks": "no"},
    ],
)
def test_create_validates_input(multi_client, body):
    response = multi_client.post("/api/templates", json=body, headers=_as(EDITOR_SUB))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_admin_sub_is_promoted_if_already_registered(multi_client, repository):
    from app.repository import Role

    repository.ensure_user(ADMIN_SUB, Role.VIEWER)

    me = multi_client.get("/api/me", headers=_as(ADMIN_SUB)).json()

    assert me["data"]["role"] == "admin"


def test_update_and_delete_unknown_template_is_404(multi_client):
    patch = multi_client.patch("/api/templates/nope", json={"name": "x"}, headers=_as(ADMIN_SUB))
    delete = multi_client.delete("/api/templates/nope", headers=_as(ADMIN_SUB))

    assert patch.status_code == 404
    assert delete.status_code == 404
