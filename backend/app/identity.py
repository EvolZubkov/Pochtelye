from dataclasses import dataclass
from typing import Protocol

import jwt
from fastapi import Request

from app.errors import AppError

JWT_HEADER = "jwt"


@dataclass(frozen=True)
class Identity:
    """Из JWT платформы доступен только sub (uuid пользователя)."""

    sub: str


class IdentityProvider(Protocol):
    def identify(self, request: Request) -> Identity: ...


class PlatformJwtProvider:
    """Читает JWT платформы из заголовка `jwt`.

    Подпись не проверяем: ключ платформы нам неизвестен (открытый вопрос к платформенной
    команде, см. ADR-0001). Проверяем наличие sub и срок жизни. Пока ключ не получен,
    приложение нельзя выставлять наружу мимо платформы.
    """

    def identify(self, request: Request) -> Identity:
        token = request.headers.get(JWT_HEADER)
        if not token:
            raise AppError("auth_missing", "Нет токена платформы", 401)
        try:
            claims = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": True, "require": ["sub", "exp"]},
                algorithms=["RS256", "HS256"],
            )
        except jwt.ExpiredSignatureError as exc:
            raise AppError("auth_expired", "Токен платформы истёк", 401) from exc
        except jwt.PyJWTError as exc:
            raise AppError("auth_invalid", "Некорректный токен платформы", 401) from exc
        return Identity(sub=str(claims["sub"]))


class DevIdentityProvider:
    """Заглушка для локальной разработки без платформы."""

    def __init__(self, sub: str) -> None:
        self._identity = Identity(sub=sub)

    def identify(self, request: Request) -> Identity:
        return self._identity
