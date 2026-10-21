from typing import Any

from fastapi import APIRouter, Depends

from app.config import Settings
from app.deps import get_current_user, get_repository, get_settings
from app.editor_resources import load_editor_config, load_editor_profile
from app.envelope import Envelope, ok
from app.repository import Repository, User

router = APIRouter(prefix="/api/editor")


def effective_profile(user: User, repository: Repository, settings: Settings) -> dict[str, Any]:
    """Профиль аудитории пользователя; без назначенной берётся аудитория по умолчанию."""
    audience = repository.get_audience(user.audience_id) if user.audience_id else None
    audience = audience or repository.get_default_audience()
    if audience is not None:
        return audience.profile
    return load_editor_profile(settings.editor_profile, settings.resources_dir)


@router.get("/config", response_model=Envelope)
def editor_config(
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> dict:
    profile = effective_profile(user, repository, settings)
    return ok(load_editor_config(settings.resources_dir, profile.get("features")))


@router.get("/profile", response_model=Envelope)
def editor_profile(
    user: User = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> dict:
    return ok(effective_profile(user, repository, settings))
