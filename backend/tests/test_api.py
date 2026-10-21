import time

import jwt

from app.platform import PodStatus

SUB = "11111111-1111-1111-1111-111111111111"


def _token(**overrides) -> str:
    claims = {"sub": SUB, "exp": int(time.time()) + 600, **overrides}
    return jwt.encode(claims, "secret", algorithm="HS256")


def test_health_returns_envelope(dev_client):
    response = dev_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"data": {"status": "ok"}, "error": None, "meta": None}


def test_response_carries_request_id(dev_client):
    response = dev_client.get("/api/health", headers={"x-request-id": "abc"})

    assert response.headers["x-request-id"] == "abc"


def test_dev_me_uses_dev_identity_and_camel_case(dev_client):
    body = dev_client.get("/api/me").json()

    assert body["error"] is None
    assert body["data"]["role"] == "viewer"
    assert "displayName" in body["data"]


def test_prod_me_without_token_is_401(prod_client):
    response = prod_client.get("/api/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "auth_missing"


def test_prod_me_with_valid_token_creates_user(prod_client, repository):
    response = prod_client.get("/api/me", headers={"jwt": _token()})

    assert response.status_code == 200
    assert response.json()["data"]["sub"] == SUB
    assert repository.get_user(SUB) is not None


def test_prod_me_with_expired_token_is_401(prod_client):
    response = prod_client.get("/api/me", headers={"jwt": _token(exp=int(time.time()) - 10)})

    assert response.json()["error"]["code"] == "auth_expired"


def test_prod_me_with_garbage_token_is_401(prod_client):
    response = prod_client.get("/api/me", headers={"jwt": "not-a-jwt"})

    assert response.json()["error"]["code"] == "auth_invalid"


def test_unknown_route_uses_envelope(dev_client):
    response = dev_client.get("/api/nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_404"


def test_lifespan_reports_pod_statuses(dev_client, platform):
    assert platform.sent == [PodStatus.CREATING, PodStatus.RUNNING]
