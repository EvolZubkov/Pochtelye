"""Схема профиля аудитории (формат совпадает с profiles/*.json редактора v2)."""

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_BLOCK_TYPES = 50
MAX_NAME_LENGTH = 40
MAX_PROFILE_BYTES = 50_000


class BlockProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    enabled: bool = True
    capabilities: list[str] = Field(default_factory=list, max_length=10)
    defaults: dict[str, Any] | None = None
    hidden: list[str] | None = Field(default=None, max_length=100)


class AudienceProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str | None = Field(default=None, max_length=100)
    blocks: dict[str, BlockProfile] = Field(default_factory=dict)
    contentPadding: int | None = Field(default=None, ge=0, le=200)  # noqa: N815 (формат v2)
    features: dict[str, bool] | None = None

    @field_validator("blocks")
    @classmethod
    def _limit_blocks(cls, blocks: dict[str, BlockProfile]) -> dict[str, BlockProfile]:
        if len(blocks) > MAX_BLOCK_TYPES or any(len(k) > MAX_NAME_LENGTH for k in blocks):
            raise ValueError("слишком много блоков или слишком длинные имена")
        return blocks


def validate_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Проверяет профиль и возвращает его в нормальном виде; ValueError при нарушении."""
    parsed = AudienceProfile.model_validate(profile).model_dump(exclude_none=True)
    if len(json.dumps(parsed, ensure_ascii=False)) > MAX_PROFILE_BYTES:
        raise ValueError("профиль слишком большой")
    return parsed
