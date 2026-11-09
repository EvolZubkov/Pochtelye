from dataclasses import dataclass
from typing import Protocol

import jwt
from fastapi import Request

from app.errors import AppError

JWT_HEADER = "jwt"
MAX_SUB_LENGTH = 64  # по размеру колонок users.sub и templates.owner_sub


@dataclass(frozen=True)
class Identity:
    """Кто пришёл. login (почта) и name (ФИО) лежат в JWT платформы.

    verified: подпись токена проверена ключом платформы. Только проверенным login
    можно доверять при привязке записи пользователя по почте.
    """

    sub: str
    login: str | None = None
    name: str | None = None
    verified: bool = False


class IdentityProvider(Protocol):
    def identify(self, request: Request) -> Identity: ...


ASYMMETRIC_ALGORITHMS = ["RS256", "RS384", "RS512", "ES256", "ES384"]


class PlatformJwtProvider:
    """Читает JWT платформы из заголовка `jwt`.

    С public_key подпись проверяется (только асимметричные алгоритмы: HMAC с открытым
    ключом это подмена алгоритма). Без ключа (ключ платформы ещё не получен, ADR-0001)
    подпись не проверяется, только sub и срок жизни: приложение нельзя выставлять наружу
    мимо платформы, а привязка по login отключена.
    """

    def __init__(self, public_key: str | None = None) -> None:
        self._public_key = public_key.replace("\\n", "\n") if public_key else None

    def _decode(self, token: str) -> dict:
        if self._public_key:
            return jwt.decode(
                token,
                self._public_key,
                algorithms=ASYMMETRIC_ALGORITHMS,
                options={"verify_exp": True, "require": ["sub", "exp"]},
            )
        return jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True, "require": ["sub", "exp"]},
            algorithms=["RS256", "HS256"],
        )

    def identify(self, request: Request) -> Identity:
        token = request.headers.get(JWT_HEADER)
        if not token:
            raise AppError("auth_missing", "Нет токена платформы", 401)
        try:
            claims = self._decode(token)
        except jwt.ExpiredSignatureError as exc:
            raise AppError("auth_expired", "Токен платформы истёк", 401) from exc
        except jwt.PyJWTError as exc:
            raise AppError("auth_invalid", "Некорректный токен платформы", 401) from exc
        sub = str(claims["sub"])
        if not sub or len(sub) > MAX_SUB_LENGTH:
            raise AppError("auth_invalid", "Некорректный токен платформы", 401)
        return Identity(
            sub=sub,
            login=_text_claim(claims, "login"),
            name=_text_claim(claims, "name"),
            verified=self._public_key is not None,
        )


def _text_claim(claims: dict, key: str) -> str | None:
    value = claims.get(key)
    return value.strip() or None if isinstance(value, str) else None


class DevIdentityProvider:
    """Заглушка для локальной разработки без платформы."""

    def __init__(self, sub: str) -> None:
        self._identity = Identity(sub=sub)

    def identify(self, request: Request) -> Identity:
        return self._identity
