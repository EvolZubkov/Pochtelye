from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки из окружения. Переменные PY_PLATFORM_* задаёт платформа skript.rt.ru."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "sqlite:///./pochtelye.sqlite3"
    log_level: str = "INFO"

    py_platform_api_base: str | None = None
    py_platform_send_status: str | None = None

    # Идентичность разработчика, когда платформы нет (только env=dev).
    dev_user_sub: str = "00000000-0000-0000-0000-000000000001"

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"
