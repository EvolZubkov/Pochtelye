from pydantic_settings import BaseSettings, SettingsConfigDict

from app.repository.base import Role


class Settings(BaseSettings):
    """Настройки из окружения. Переменные PY_PLATFORM_* задаёт платформа skript.rt.ru."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "sqlite:///./pochtelye.sqlite3"
    log_level: str = "INFO"
    # Каталог собранного фронтенда (frontend/dist). Если не задан или не существует, не раздаём.
    static_dir: str | None = "../frontend/dist"

    py_platform_api_base: str | None = None
    py_platform_send_status: str | None = None

    # Идентичность разработчика, когда платформы нет (только env=dev).
    dev_user_sub: str = "00000000-0000-0000-0000-000000000001"

    # Роль нового пользователя; viewer включает режим «только чтение» по умолчанию.
    default_role: Role = Role.EDITOR
    # sub администраторов. В env задаётся JSON-списком: ADMIN_SUBS='["uuid1","uuid2"]'.
    admin_subs: list[str] = []

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"

    def is_admin_sub(self, sub: str) -> bool:
        return sub in self.admin_subs or (self.is_dev and sub == self.dev_user_sub)
