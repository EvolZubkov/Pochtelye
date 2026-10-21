from enum import StrEnum
from typing import Protocol

import httpx
import structlog

log = structlog.get_logger()

STATUS_TIMEOUT_SECONDS = 5.0


class PodStatus(StrEnum):
    CREATING = "CREATING"
    RUNNING = "RUNNING"
    WORKING = "WORKING"
    FINISHED = "FINISHED"
    ERROR = "ERROR"
    TERMINATING = "TERMINATING"


class PlatformClient(Protocol):
    async def send_status(self, status: PodStatus) -> None: ...


class StubPlatformClient:
    """Локальная заглушка: запоминает статусы, в сеть не ходит."""

    def __init__(self) -> None:
        self.sent: list[PodStatus] = []

    async def send_status(self, status: PodStatus) -> None:
        self.sent.append(status)
        log.info("platform_status_stub", status=status.value)


class HttpPlatformClient:
    """Шлёт статусы в POST /pods/status (URL берётся из PY_PLATFORM_SEND_STATUS).

    Формат тела `{"status": ...}` предположительный: уточнить по статье платформы.
    Сбой отправки не роняет приложение, но логируется: без статуса скрипт не стартует,
    а после TERMINATING статус отвергается.
    """

    def __init__(self, status_url: str, jwt_token: str | None = None) -> None:
        self._status_url = status_url
        self._jwt_token = jwt_token

    async def send_status(self, status: PodStatus) -> None:
        headers = {"jwt": self._jwt_token} if self._jwt_token else {}
        try:
            async with httpx.AsyncClient(timeout=STATUS_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    self._status_url, json={"status": status.value}, headers=headers
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            log.error("platform_status_failed", status=status.value, error=type(exc).__name__)
            return
        log.info("platform_status_sent", status=status.value)
