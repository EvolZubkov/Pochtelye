from fastapi import APIRouter, Depends

from app.access import Access, get_access
from app.config import Settings
from app.deps import get_settings
from app.editor_resources import load_editor_config
from app.envelope import Envelope, ok

router = APIRouter(prefix="/api/editor")


@router.get("/config", response_model=Envelope)
def editor_config(
    access: Access = Depends(get_access), settings: Settings = Depends(get_settings)
) -> dict:
    return ok(load_editor_config(settings.resources_dir, access.profile.get("features")))


@router.get("/profile", response_model=Envelope)
def editor_profile(access: Access = Depends(get_access)) -> dict:
    return ok(access.profile)
