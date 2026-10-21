import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import Field, field_validator

from app import permissions
from app.deps import get_current_user, get_repository
from app.envelope import CamelModel, Envelope, ok
from app.repository import (
    NewTemplate,
    Repository,
    Template,
    TemplateScope,
    TemplateSummary,
    User,
)

router = APIRouter(prefix="/api/templates")

MAX_BLOCKS = 1000
PREVIEW_PATTERN = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")
MAX_PREVIEW_CHARS = 700_000
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


def _image_data_url(value: str | None) -> str | None:
    """Миниатюра — только картинка-data URL: никаких внешних адресов и разметки."""
    if value is not None and not PREVIEW_PATTERN.match(value):
        raise ValueError("превью должно быть data:image (png, jpeg, webp)")
    return value


class TemplateSummaryDto(CamelModel):
    id: str
    name: str
    category: str
    scope: TemplateScope
    preview: str | None
    owner_sub: str
    created_at: str
    updated_at: str


class TemplateDto(TemplateSummaryDto):
    blocks: list[dict]


class TemplateCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="", max_length=100)
    scope: TemplateScope = TemplateScope.PERSONAL
    blocks: list[dict] = Field(default_factory=list, max_length=MAX_BLOCKS)
    preview: str | None = Field(default=None, max_length=MAX_PREVIEW_CHARS)

    _preview = field_validator("preview")(_image_data_url)


class TemplateUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    blocks: list[dict] | None = Field(default=None, max_length=MAX_BLOCKS)
    preview: str | None = Field(default=None, max_length=MAX_PREVIEW_CHARS)

    _preview = field_validator("preview")(_image_data_url)


def _summary_dto(t: TemplateSummary) -> dict:
    return TemplateSummaryDto(
        id=t.id,
        name=t.name,
        category=t.category,
        scope=t.scope,
        preview=t.preview,
        owner_sub=t.owner_sub,
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    ).model_dump(by_alias=True, mode="json")


def _full_dto(t: Template) -> dict:
    return {**_summary_dto(t), "blocks": list(t.blocks)}


def _load_readable(repository: Repository, user: User, template_id: str) -> Template:
    template = repository.get_template(template_id)
    if template is None or not permissions.can_read_template(user, template):
        raise permissions.not_found()
    return template


@router.get("", response_model=Envelope)
def list_templates(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    scope: TemplateScope | None = None,
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    result = repository.list_templates(user.sub, page, limit, scope)
    meta = {"total": result.total, "page": page, "limit": limit}
    return ok([_summary_dto(t) for t in result.items], meta)


@router.get("/{template_id}", response_model=Envelope)
def get_template(
    template_id: str,
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    return ok(_full_dto(_load_readable(repository, user, template_id)))


@router.post("", response_model=Envelope, status_code=201)
def create_template(
    body: TemplateCreate,
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    permissions.require(permissions.can_create_template(user, body.scope))
    created = repository.create_template(
        NewTemplate(
            owner_sub=user.sub,
            scope=body.scope,
            name=body.name,
            category=body.category,
            blocks=tuple(body.blocks),
            preview=body.preview,
        )
    )
    return ok(_full_dto(created))


@router.patch("/{template_id}", response_model=Envelope)
def update_template(
    template_id: str,
    body: TemplateUpdate,
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    existing = _load_readable(repository, user, template_id)
    permissions.require(permissions.can_modify_template(user, existing))
    changes = body.model_dump(exclude_unset=True)
    updated = repository.update_template(template_id, changes)
    if updated is None:
        raise permissions.not_found()
    return ok(_full_dto(updated))


@router.delete("/{template_id}", response_model=Envelope)
def delete_template(
    template_id: str,
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    existing = _load_readable(repository, user, template_id)
    permissions.require(permissions.can_modify_template(user, existing))
    if not repository.delete_template(template_id):
        raise permissions.not_found()
    return ok({"id": template_id})
