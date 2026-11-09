import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.platform import StubPlatformClient
from app.repository import NewUser, Role

SUB = "22222222-2222-2222-2222-222222222222"
EMAIL = "ivanov@rt.ru"


@pytest.fixture(scope="module")
def private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _public_pem(private_key) -> str:
    return (
        private_key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )


def _token(key, algorithm="RS256", **overrides) -> str:
    claims = {
        "sub": SUB,
        "login": EMAIL,
        "name": "Иванов Иван",
        "exp": int(time.time()) + 600,
        **overrides,
    }
    return jwt.encode(claims, key, algorithm=algorithm)


def _client(repository, public_key: str | None):
    settings = Settings(
        env="prod",
        database_url="sqlite:///:memory:",
        static_dir=None,
        jwt_public_key=public_key,
        allow_unsigned_jwt=public_key is None,
    )
    app = create_app(settings, repository=repository, platform_client=StubPlatformClient())
    return TestClient(app)


def _invite(repository, email=EMAIL):
    return repository.create_user(NewUser(email=email, role=Role.EDITOR))


def test_verified_login_binds_invited_user_on_first_visit(repository, private_key):
    _invite(repository)

    with _client(repository, _public_pem(private_key)) as client:
        response = client.get("/api/me", headers={"jwt": _token(private_key)})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["sub"] == SUB
    assert data["email"] == EMAIL
    assert data["displayName"] == "Иванов Иван"


def test_login_matching_ignores_case_and_spaces(repository, private_key):
    _invite(repository)

    with _client(repository, _public_pem(private_key)) as client:
        token = _token(private_key, login="  Ivanov@RT.ru ")
        response = client.get("/api/me", headers={"jwt": token})

    assert response.status_code == 200


def test_unknown_login_is_not_activated(repository, private_key):
    with _client(repository, _public_pem(private_key)) as client:
        response = client.get("/api/me", headers={"jwt": _token(private_key)})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_activated"


def test_login_of_already_bound_user_does_not_take_over(repository, private_key):
    repository.create_user(NewUser(email=EMAIL, role=Role.EDITOR, sub="someone-else"))

    with _client(repository, _public_pem(private_key)) as client:
        response = client.get("/api/me", headers={"jwt": _token(private_key)})

    assert response.status_code == 403


def test_unsigned_platform_does_not_bind_by_login(repository):
    """Без ключа подпись не проверяется: привязка по почте открыла бы захват чужой записи."""
    _invite(repository)

    with _client(repository, None) as client:
        token = jwt.encode(
            {"sub": SUB, "login": EMAIL, "exp": int(time.time()) + 600}, "k" * 32, algorithm="HS256"
        )
        response = client.get("/api/me", headers={"jwt": token})

    assert response.status_code == 403


def test_token_signed_with_other_key_is_rejected(repository, private_key):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with _client(repository, _public_pem(private_key)) as client:
        response = client.get("/api/me", headers={"jwt": _token(other)})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "auth_invalid"


def test_symmetric_algorithm_is_rejected_when_key_is_configured(repository, private_key):
    """Защита от подмены алгоритма: открытый ключ нельзя использовать как HMAC-секрет."""
    public_pem = _public_pem(private_key)

    with _client(repository, public_pem) as client:
        forged = jwt.encode(
            {"sub": SUB, "login": EMAIL, "exp": int(time.time()) + 600},
            "k" * 32,
            algorithm="HS256",
        )
        response = client.get("/api/me", headers={"jwt": forged})

    assert response.status_code == 401


def test_parallel_first_visit_does_not_fail_for_the_loser(repository, private_key):
    """Второй запрос видит, что запись уже привязана этим же sub, и пускает человека."""
    _invite(repository)
    now = __import__("datetime").datetime.now(__import__("datetime").UTC)

    first = repository.claim_by_email(EMAIL, SUB, "Иванов Иван", now)
    second = repository.claim_by_email(EMAIL, SUB, "Иванов Иван", now)

    assert first is not None
    assert second is not None
    assert second.id == first.id


def test_claim_by_email_does_not_hand_over_a_record_bound_to_other_sub(repository):
    repository.create_user(NewUser(email=EMAIL, role=Role.EDITOR, sub="someone-else"))
    now = __import__("datetime").datetime.now(__import__("datetime").UTC)

    assert repository.claim_by_email(EMAIL, SUB, None, now) is None


def test_prod_refuses_to_start_without_key_unless_opted_out(repository):
    settings = Settings(env="prod", database_url="sqlite:///:memory:", static_dir=None)

    with pytest.raises(RuntimeError, match="JWT_PUBLIC_KEY"):
        create_app(settings, repository=repository, platform_client=StubPlatformClient())
