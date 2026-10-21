from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.envelope import CamelModel, Envelope, ok
from app.repository import Role, User

router = APIRouter(prefix="/api")


class HealthDto(CamelModel):
    status: str


class UserDto(CamelModel):
    sub: str
    role: Role
    display_name: str | None
    email: str | None


@router.get("/health", response_model=Envelope)
def health() -> dict:
    return ok(HealthDto(status="ok").model_dump(by_alias=True))


@router.get("/me", response_model=Envelope)
def me(user: User = Depends(get_current_user)) -> dict:
    dto = UserDto(sub=user.sub, role=user.role, display_name=user.display_name, email=user.email)
    return ok(dto.model_dump(by_alias=True, mode="json"))
