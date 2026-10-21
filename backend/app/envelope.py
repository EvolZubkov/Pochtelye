"""Envelope ответа API по ADR-0002 хэндбука РТК: {data, error, meta}, поля camelCase."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorBody(CamelModel):
    code: str
    message: str


class Envelope(CamelModel):
    data: Any | None = None
    error: ErrorBody | None = None
    meta: dict[str, Any] | None = None


def ok(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return Envelope(data=data, meta=meta).model_dump(by_alias=True)


def fail(code: str, message: str) -> dict[str, Any]:
    return Envelope(error=ErrorBody(code=code, message=message)).model_dump(by_alias=True)
