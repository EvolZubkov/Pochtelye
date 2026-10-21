"""Коды приглашений: админ выдаёт код, человек вводит его при первом входе и привязывает sub."""

import hashlib
import secrets
from datetime import datetime, timedelta

# Алфавит без похожих символов (0/O, 1/I/L): код диктуют голосом и переписывают вручную.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 16  # 31^16 ≈ 2^79: перебор по утёкшему хэшу невозможен
GROUP_SIZE = 4
INVITE_TTL = timedelta(days=14)


def generate_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    return "-".join(raw[i : i + GROUP_SIZE] for i in range(0, CODE_LENGTH, GROUP_SIZE))


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def hash_code(code: str) -> str:
    """В базе лежит только хэш: утечка БД не раскрывает действующие коды."""
    return hashlib.sha256(normalize_code(code).encode("utf-8")).hexdigest()


def expires_at(now: datetime) -> datetime:
    return now + INVITE_TTL
