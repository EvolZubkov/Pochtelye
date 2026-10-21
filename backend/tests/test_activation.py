from datetime import UTC, datetime, timedelta

from app import invites
from app.repository import NewUser, Role
from tests.conftest import ADMIN_SUB, EDITOR_SUB


def _as(sub):
    return {"x-test-sub": sub}


def _invite(client, email="new@rt.ru", **extra):
    response = client.post(
        "/api/admin/users", json={"email": email, **extra}, headers=_as(ADMIN_SUB)
    )
    return response.json()["data"]["inviteCode"]


def _activate(client, sub, code):
    return client.post("/api/me/activate", json={"code": code}, headers=_as(sub))


def test_full_invitation_flow(multi_client):
    code = _invite(multi_client, role="editor", displayName="Новичок")

    blocked = multi_client.get("/api/me", headers=_as("new-sub"))
    activated = _activate(multi_client, "new-sub", code)
    after = multi_client.get("/api/me", headers=_as("new-sub"))

    assert blocked.json()["error"]["code"] == "not_activated"
    assert activated.status_code == 200
    assert activated.json()["data"]["displayName"] == "Новичок"
    assert after.json()["data"]["sub"] == "new-sub"


def test_code_is_accepted_in_any_case_and_without_dash(multi_client):
    code = _invite(multi_client)

    response = _activate(multi_client, "s1", code.lower().replace("-", " "))

    assert response.status_code == 200


def test_code_works_only_once(multi_client):
    code = _invite(multi_client)
    assert _activate(multi_client, "s1", code).status_code == 200

    second = _activate(multi_client, "s2", code)

    assert second.status_code == 400
    assert second.json()["error"]["code"] == "invite_invalid"


def test_wrong_code_is_rejected(multi_client):
    _invite(multi_client)

    response = _activate(multi_client, "s1", "AAAA-AAAA-AAAA-AAAA")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invite_invalid"


def test_expired_code_is_rejected(multi_client, repository):
    user = repository.create_user(NewUser(email="old@rt.ru", role=Role.EDITOR))
    code = invites.generate_code()
    repository.set_invite(user.id, invites.hash_code(code), datetime.now(UTC) - timedelta(hours=1))

    response = _activate(multi_client, "s1", code)

    assert response.json()["error"]["code"] == "invite_invalid"


def test_already_active_user_cannot_activate_again(multi_client):
    response = _activate(multi_client, EDITOR_SUB, "AAAA-AAAA-AAAA-AAAA")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "already_active"


def test_repeated_failures_are_rate_limited(multi_client):
    for _ in range(5):
        assert _activate(multi_client, "attacker", "AAAA-AAAA-AAAA-AAAA").status_code == 400

    blocked = _activate(multi_client, "attacker", "AAAA-AAAA-AAAA-AAAA")
    real_code = _invite(multi_client)
    still_blocked = _activate(multi_client, "attacker", real_code)

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_attempts"
    assert still_blocked.status_code == 429


def test_empty_code_is_validation_error(multi_client):
    response = _activate(multi_client, "s1", "")

    assert response.status_code == 422
