from fastapi import APIRouter, Depends

from app.config import Settings
from app.deps import get_current_user, get_settings
from app.editor_resources import load_editor_config, load_editor_profile
from app.envelope import Envelope, ok
from app.repository import User

router = APIRouter(prefix="/api/editor")


@router.get("/config", response_model=Envelope)
def editor_config(
    _: User = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> dict:
    return ok(load_editor_config(settings.resources_dir))


@router.get("/profile", response_model=Envelope)
def editor_profile(
    _: User = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> dict:
    return ok(load_editor_profile(settings.editor_profile, settings.resources_dir))
