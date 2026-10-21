from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OutgoingMessage:
    sender: str
    recipients: tuple[str, ...]
    subject: str
    html: str


@dataclass(frozen=True)
class SendResult:
    ok: bool
    error_code: str | None = None


class SenderBackend(Protocol):
    """Отправка писем: Exchange EWS, SMTP, в будущем почтовый клиент."""

    def send(self, message: OutgoingMessage) -> SendResult: ...


class MemorySenderBackend:
    """Тестовая и dev-реализация: письма не уходят, а копятся в списке."""

    def __init__(self) -> None:
        self.outbox: list[OutgoingMessage] = []

    def send(self, message: OutgoingMessage) -> SendResult:
        self.outbox.append(message)
        return SendResult(ok=True)
