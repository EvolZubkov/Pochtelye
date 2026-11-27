"""Локальная проверка входа как на платформе: ключ, токены, команда запуска.

Запуск из backend:
    .venv\\Scripts\\python scripts\\dev_login.py admin@example.com ivan@example.com

Создаёт пару RSA-ключей в backend/.dev/*.key (в .gitignore) и печатает:
- переменные окружения для запуска приложения в прод-режиме с проверкой подписи;
- JWT для каждой почты (первая почта становится администратором по sub).
Токены кладите в заголовок `jwt` (расширение ModHeader или curl).
"""

import sys
import time
import uuid
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

KEY_DIR = Path(__file__).resolve().parent.parent / ".dev"
PRIVATE = KEY_DIR / "dev-private.key"
TOKEN_TTL_SECONDS = 8 * 3600


def load_or_create_key() -> rsa.RSAPrivateKey:
    KEY_DIR.mkdir(exist_ok=True)
    if PRIVATE.exists():
        return serialization.load_pem_private_key(PRIVATE.read_bytes(), password=None)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    PRIVATE.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return key


def sub_for(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"dev:{email.lower()}"))


def main(emails: list[str]) -> None:
    key = load_or_create_key()
    public = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    one_line = public.strip().replace("\n", "\\n")
    admin_sub = sub_for(emails[0])

    print("# 1. Окружение бэкенда (PowerShell):")
    print('$env:ENV = ""')
    print(f"$env:JWT_PUBLIC_KEY = '{one_line}'")
    print(f"$env:ADMIN_SUBS = '[\"{admin_sub}\"]'")
    print()
    now = int(time.time())
    for index, email in enumerate(emails):
        claims = {
            "sub": sub_for(email),
            "login": email,
            "name": email.split("@")[0],
            "iat": now,
            "exp": now + TOKEN_TTL_SECONDS,
        }
        token = jwt.encode(claims, key, algorithm="RS256")
        role = "администратор" if index == 0 else "по приглашению (заведите в админке)"
        print(f"# {email}: {role}\n{token}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Укажите хотя бы одну почту: первая станет администратором")
    main(sys.argv[1:])
